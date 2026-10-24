/**
 * useSaveImage Unit Tests
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (obj: any) => obj.ios },

}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/docs',
  ExternalStorageDirectoryPath: '/ext',
  exists: jest.fn(),
  mkdir: jest.fn(),
  copyFile: jest.fn(),
}));

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
}));

jest.mock('../../../../src/components', () => ({
  showAlert: (title: string, message: string) => ({ visible: true, title, message, buttons: [] }),
}));

import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { saveImageToGallery } from '../../../../src/screens/ChatScreen/useSaveImage';


const mockExists = RNFS.exists as jest.Mock;
const mockMkdir = RNFS.mkdir as jest.Mock;
const mockCopyFile = RNFS.copyFile as jest.Mock;

describe('saveImageToGallery', () => {
  const setAlertState = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockExists.mockResolvedValue(true);
    mockCopyFile.mockResolvedValue(undefined);
    (Platform as any).OS = 'ios';
  });

  it('does nothing when viewerImageUri is null', async () => {
    await saveImageToGallery(null, setAlertState);
    expect(mockCopyFile).not.toHaveBeenCalled();
    expect(setAlertState).not.toHaveBeenCalled();
  });

  it('copies file to iOS documents directory', async () => {
    await saveImageToGallery('file:///tmp/image.png', setAlertState);
    expect(mockCopyFile).toHaveBeenCalledWith(
      '/tmp/image.png', // NOSONAR
      expect.stringContaining('/docs/Own_Images/'),
    );
  });

  it('strips file:// prefix from source path', async () => {
    await saveImageToGallery('file:///path/to/image.png', setAlertState);
    const [src] = mockCopyFile.mock.calls[0];
    expect(src).not.toContain('file://');
    expect(src).toBe('/path/to/image.png');
  });

  it('creates directory when it does not exist', async () => {
    mockExists.mockResolvedValue(false);
    await saveImageToGallery('file:///tmp/img.png', setAlertState);
    expect(mockMkdir).toHaveBeenCalled();
  });

  it('does not create directory when it already exists', async () => {
    mockExists.mockResolvedValue(true);
    await saveImageToGallery('file:///tmp/img.png', setAlertState);
    expect(mockMkdir).not.toHaveBeenCalled();
  });

  it('shows Image Saved alert on success (iOS)', async () => {
    await saveImageToGallery('file:///tmp/img.png', setAlertState);
    expect(setAlertState).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Image Saved' }),
    );
  });

  it('shows Error alert when copyFile throws', async () => {
    mockCopyFile.mockRejectedValue(new Error('disk full'));
    await saveImageToGallery('file:///tmp/img.png', setAlertState);
    expect(setAlertState).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Error' }),
    );
  });


});
