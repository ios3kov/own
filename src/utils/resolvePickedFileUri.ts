import { keepLocalCopy } from '@react-native-documents/picker';
import { localDocumentPath } from '../services/localDocumentPath';

/** Retain an imported document in a unique permanent app folder, not picker temp storage. */
export const resolvePickedFileUri = async (uri: string, fileName: string): Promise<string> => {
  if (!fileName || fileName === '.' || fileName === '..' || /[/\\]/.test(fileName) || Array.from(fileName).some(character => character.charCodeAt(0) < 32)) {
    throw new Error('Invalid document filename');
  }
  const result = await keepLocalCopy({
    files: [{uri, fileName}],
    destination: 'documentDirectory',
  });
  if (result[0]?.status !== 'success' || !result[0].localUri) {
    throw new Error('Failed to create a local copy of the document');
  }
  return localDocumentPath(result[0].localUri);
};
