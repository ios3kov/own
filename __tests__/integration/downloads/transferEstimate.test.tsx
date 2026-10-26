import React from 'react';
import { render, act } from '@testing-library/react-native';
import { ActiveDownloadCard } from '../../../src/screens/DownloadManagerScreen/items';
import { useDownloadStore } from '../../../src/stores/downloadStore';

function DownloadView() {
  const entry = useDownloadStore(s => s.downloads['test/model/model.gguf']);
  return <ActiveDownloadCard item={{type: 'active', modelType: 'text', modelId: entry.modelId, downloadId: entry.downloadId,
    fileName: entry.fileName, author: 'test', quantization: 'Q4', fileSize: entry.combinedTotalBytes,
    bytesDownloaded: entry.bytesDownloaded + (entry.mmProjBytesDownloaded || 0), progress: entry.progress, status: entry.status}}
    onRemove={jest.fn()} onRetry={jest.fn()} />;
}

describe('download progress to visible estimate', () => {
  beforeEach(() => {
    jest.useFakeTimers(); jest.setSystemTime(0);
    useDownloadStore.getState().setAll([{modelKey:'test/model/model.gguf', downloadId:'1', mmProjDownloadId:'2', modelId:'test/model',
      fileName:'model.gguf', quantization:'Q4', modelType:'text', status:'running', bytesDownloaded:0,
      totalBytes:8_000_000, combinedTotalBytes:10_000_000, progress:0, createdAt:0}]);
  });
  afterEach(() => { jest.useRealTimers(); useDownloadStore.getState().setAll([]); });
  it('combines the main file and vision progress, then clears the estimate while waiting', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const screen = render(<DownloadView />);
    expect(screen.getByText('Measuring download speed…')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(1000); useDownloadStore.getState().updateProgress('1', 1_000_000, 8_000_000); });
    act(() => { jest.advanceTimersByTime(2000); useDownloadStore.getState().updateMmProjProgress('2', 2_000_000); });
    expect(screen.getByText(/About 10 sec left/)).toBeTruthy();
    act(() => useDownloadStore.getState().setStatus('1', 'waiting_for_network'));
    expect(screen.queryByText(/sec left/)).toBeNull();
    screen.unmount();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    clearIntervalSpy.mockRestore();
  });
});
