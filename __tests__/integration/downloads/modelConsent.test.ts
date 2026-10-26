jest.unmock('../../../src/services/downloadConsent');
import { Alert, NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import { modelManager } from '../../../src/services/modelManager';
import { backgroundDownloadService } from '../../../src/services/backgroundDownloadService';
import { DownloadCancelledError } from '../../../src/services/downloadConsent';

const file = {name: 'vision.gguf', downloadUrl: 'https://huggingface.co/test/resolve/main/vision.gguf', quantization: 'Q4', size: 1_000_000_000,
  mmProjFile: {name: 'mmproj.gguf', size: 500_000_000, downloadUrl: 'https://huggingface.co/test/resolve/main/mmproj.gguf'}};

describe('real text download entry point requires user confirmation', () => {
  beforeEach(() => {
    NativeModules.OwnNetworkInfo = {status: jest.fn().mockResolvedValue({kind: 'wifi'})};
    jest.spyOn(modelManager, 'isBackgroundDownloadSupported').mockReturnValue(true);
    jest.spyOn(modelManager, 'initialize').mockResolvedValue(undefined);
    jest.spyOn(RNFS, 'exists').mockResolvedValue(false);
  });
  afterEach(() => { jest.restoreAllMocks(); });
  it('shows the combined size and never creates a task when cancelled', async () => {
    const start = jest.spyOn(backgroundDownloadService, 'startDownload');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => buttons?.[0].onPress?.());
    await expect(modelManager.downloadModelBackground('test/model', file)).rejects.toBeInstanceOf(DownloadCancelledError);
    expect(alert.mock.calls[0][1]).toContain('1.50 GB');
    expect(start).not.toHaveBeenCalled();
    expect(modelManager.initialize).not.toHaveBeenCalled();
  });
  it('reaches the native transport only after explicit acceptance', async () => {
    const nativeReached = new Error('synthetic native boundary');
    const start = jest.spyOn(backgroundDownloadService, 'startDownload').mockRejectedValue(nativeReached);
    let buttons: any;
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, actions) => { buttons = actions; });
    const pending = modelManager.downloadModelBackground('test/model', file);
    await new Promise(resolve => setImmediate(resolve));
    expect(start).not.toHaveBeenCalled();
    buttons[1].onPress();
    await expect(pending).rejects.toBe(nativeReached);
    expect(start).toHaveBeenCalledTimes(1);
  });
  it('does not start transport when mobile-data confirmation is declined after a network change', async () => {
    NativeModules.OwnNetworkInfo.status.mockResolvedValueOnce({kind: 'wifi'})
      .mockResolvedValue({kind: 'cellular', expensive: true});
    const start = jest.spyOn(backgroundDownloadService, 'startDownload');
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      if (buttons?.[1].text === 'Download over mobile data') buttons[0].onPress?.();
      else buttons?.[1].onPress?.();
    });
    await expect(modelManager.downloadModelBackground('test/model', file)).rejects.toBeInstanceOf(DownloadCancelledError);
    expect(start).not.toHaveBeenCalled();
  });

});
