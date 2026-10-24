import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('../src/navigation', () => ({ AppNavigator: () => null }));
jest.mock('../src/screens', () => ({ LockScreen: () => null }));
jest.mock('../src/hooks/useAppState', () => ({ useAppState: jest.fn() }));
jest.mock('../src/hooks/useDownloads', () => ({ useDownloadListeners: jest.fn() }));
jest.mock('../src/services/downloadHydration', () => ({ hydrateDownloadStore: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/services/foundationModels', () => ({ foundationModelService: { refreshAvailability: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../src/services', () => ({
  hardwareService: { getDeviceInfo: jest.fn().mockResolvedValue({ totalMemory: 8e9 }), getModelRecommendation: jest.fn().mockReturnValue({}) },
  modelManager: {
    restoreInProgressDownloads: jest.fn().mockResolvedValue([42]),
    startBackgroundDownloadPolling: jest.fn(), watchDownload: jest.fn(),
    initialize: jest.fn().mockResolvedValue(undefined), cleanupMMProjEntries: jest.fn().mockResolvedValue(undefined),
    reconcileFinishedImageDownloads: jest.fn().mockResolvedValue(undefined),
    refreshModelLists: jest.fn().mockResolvedValue({ textModels: [], imageModels: [] }),
    downloadModelBackground: jest.fn(),
  },
  authService: { hasPassphrase: jest.fn().mockResolvedValue(false) },
  ragService: { ensureReady: jest.fn().mockResolvedValue(undefined) },
  remoteServerManager: { initializeProviders: jest.fn().mockResolvedValue(undefined) },
}));

import App from '../App';
import { hydrateDownloadStore } from '../src/services/downloadHydration';
import { foundationModelService } from '../src/services/foundationModels';
import { modelManager } from '../src/services';

it('restores existing downloads after hydration and checks Apple without starting a model download', async () => {
  const screen = render(<App />);
  await waitFor(() => expect(modelManager.refreshModelLists).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByTestId('app-loading')).toBeNull());
  expect(hydrateDownloadStore).toHaveBeenCalled();
  expect((hydrateDownloadStore as jest.Mock).mock.invocationCallOrder[0])
    .toBeLessThan((modelManager.restoreInProgressDownloads as jest.Mock).mock.invocationCallOrder[0]);
  expect(modelManager.watchDownload).toHaveBeenCalledWith(42, expect.any(Function), expect.any(Function));
  expect(foundationModelService.refreshAvailability).toHaveBeenCalledWith(expect.any(Function));
  expect(modelManager.downloadModelBackground).not.toHaveBeenCalled();
  screen.unmount();
});
