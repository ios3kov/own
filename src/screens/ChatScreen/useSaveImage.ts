import { Dispatch,SetStateAction } from 'react';
import RNFS from 'react-native-fs';
import { AlertState,showAlert } from '../../components';
import logger from '../../utils/logger';

export async function saveImageToGallery(
  viewerImageUri: string | null,
  setAlertState: Dispatch<SetStateAction<AlertState>>,
): Promise<void> {
  if (!viewerImageUri) return;
  try {
    ;
    const sourcePath = viewerImageUri.replace('file://', '');
    const picturesDir = (`${RNFS.DocumentDirectoryPath}/Own_Images`);
    if (!(await RNFS.exists(picturesDir))) {
      await RNFS.mkdir(picturesDir);
    }
    const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
    const fileName = `generated_${timestamp}.png`;
    await RNFS.copyFile(sourcePath, `${picturesDir}/${fileName}`);
    setAlertState(showAlert(
      'Image Saved',
      (`Saved to ${fileName}`),
    ));
  } catch (error: any) {
    logger.error('[ChatScreen] Failed to save image:', error);
    setAlertState(showAlert('Error', `Failed to save image: ${error?.message || 'Unknown error'}`));
  }
}
