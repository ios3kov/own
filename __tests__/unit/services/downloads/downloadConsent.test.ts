jest.unmock('../../../../src/services/downloadConsent');
import { Alert, NativeModules } from 'react-native';
import { requestDownloadConsent, describeDownload } from '../../../../src/services/downloadConsent';

describe('informed model download', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    NativeModules.OwnNetworkInfo = {status: jest.fn().mockResolvedValue({kind: 'wifi', expensive: false})};
  });
  it('includes both the text model and required vision file', () => {
    expect(describeDownload({name: 'Vision model', files: [{size: 1_000_000_000}, {size: 500_000_000}]})).toContain('1.50 GB');
  });
  it('does not present an unknown component as zero bytes', () => {
    expect(describeDownload({name: 'Vision model', files: [{size: 1000}, {size: null}]})).toContain('not yet known');
  });
  it('does not approve the download before the user confirms', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    let approved = false;
    const pending = requestDownloadConsent({name: 'Model', files: [{size: 2_000_000_000}]}).then(value => { approved = value; });
    await new Promise(resolve => setImmediate(resolve));
    expect(approved).toBe(false);
    expect(alert.mock.calls[0][1]).toContain('Wi-Fi');
    alert.mock.calls[0][2]?.[0].onPress?.();
    await pending;
    expect(approved).toBe(false);
  });
  it('requires explicit acceptance of mobile data', async () => {
    NativeModules.OwnNetworkInfo.status.mockResolvedValue({kind: 'cellular', expensive: true});
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      expect(buttons?.[1].text).toBe('Download over mobile data');
      buttons?.[1].onPress?.();
    });
    await expect(requestDownloadConsent({name: 'Whisper', files: [{size: 75_000_000}]})).resolves.toBe(true);
    expect(alert.mock.calls[0][1]).toContain('75.0 MB');
  });
  it('states that the network is unknown when the native check fails', async () => {
    NativeModules.OwnNetworkInfo.status.mockRejectedValue(new Error('offline'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[0].onPress?.());
    await expect(requestDownloadConsent({name: 'Model', files: [{size: 1}]})).resolves.toBe(false);
    expect(alert.mock.calls[0][1]).toContain('could not be verified');
  });
  it('asks again if Wi-Fi changes to mobile data before acceptance', async () => {
    NativeModules.OwnNetworkInfo.status
      .mockResolvedValueOnce({kind: 'wifi'})
      .mockResolvedValue({kind: 'cellular', expensive: true});
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      if (buttons?.[1].text === 'Download over mobile data') buttons[0].onPress?.();
      else buttons?.[1].onPress?.();
    });
    await expect(requestDownloadConsent({name: 'Changed network', files: [{size: 1000}]})).resolves.toBe(false);
    expect(alert).toHaveBeenCalledTimes(2);
  });

});
