import React,{ useState,useRef } from 'react';
import { View,Text,Image,ScrollView,TouchableOpacity,ActionSheetIOS } from 'react-native';
import { launchImageLibrary,launchCamera,Asset } from 'react-native-image-picker';
import { pick,types,isErrorWithCode,errorCodes } from '@react-native-documents/picker';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme,useThemedStyles } from '../../theme';
import { MediaAttachment } from '../../types';
import { documentService } from '../../services/documentService';
import { AlertState,showAlert } from '../CustomAlert';
import { createStyles } from './styles';
import { resolvePickedFileUri } from '../../utils/resolvePickedFileUri';
import { isPickerStuck } from '../../utils/pickerErrorUtils';

let _attachmentIdSeq = 0;
const nextAttachmentId = () => `${Date.now()}-${(++_attachmentIdSeq).toString(36)}`;

// ─── useAttachments hook ──────────────────────────────────────────────────────

export function useAttachments(setAlertState: (state: AlertState) => void) {
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const isPickingRef = useRef(false);
  const [processingAttachment, setProcessingAttachment] = useState(false);

  const addAttachments = (assets: Asset[]) => {
    const newAttachments: MediaAttachment[] = assets
      .filter(asset => asset.uri)
      .map(asset => ({
        id: nextAttachmentId(),
        type: 'image' as const,
        uri: asset.uri!,
        mimeType: asset.type,
        width: asset.width,
        height: asset.height,
        fileName: asset.fileName,
      }));
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const pickFromLibrary = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 1024, maxHeight: 1024 });
      if (result.assets && result.assets.length > 0) addAttachments(result.assets);
    } catch (_pickError) {
      // no-op: image picker already reports failure to the user via native UI
    }
  };

  const pickFromCamera = async () => {
    try {
      const result = await launchCamera({ mediaType: 'photo', quality: 0.8, maxWidth: 1024, maxHeight: 1024 });
      if (result.assets && result.assets.length > 0) addAttachments(result.assets);
    } catch (_cameraError) {
      // no-op: camera picker already reports failure to the user via native UI
    }
  };

  const handlePickImage = () => {
    {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Camera', 'Photo Library', 'Cancel'], cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) pickFromCamera();
          else if (index === 1) pickFromLibrary();
        },
      );
    }
  };

  const handlePickDocument = async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    setProcessingAttachment(true);
    try {
      const result = await pick({ type: [types.allFiles], allowMultiSelection: false });
      const file = result[0];
      if (!file) return;
      const fileName = file.name || 'document';
      if (!documentService.isSupported(fileName)) {
        setAlertState(showAlert(
          'Unsupported File',
          `"${fileName}" is not supported. Supported: documents, CSV/XLSX, photos for text recognition, and WAV/M4A/MP3 audio.`,
          [{ text: 'OK' }],
        ));
        return;
      }
      const localPath = await resolvePickedFileUri(file.uri, fileName);
      const attachment = await documentService.processDocumentFromPath(localPath, fileName);
      if (attachment) setAttachments(prev => [...prev, attachment]);
    } catch (pickError: any) {
      if (isErrorWithCode(pickError) && pickError.code === errorCodes.OPERATION_CANCELED) return;
      if (isPickerStuck(pickError)) {
        setAlertState(showAlert(
          'File Picker Unavailable',
          "The file picker isn't responding. Please close and reopen the app, then try again.",
          [{ text: 'OK' }],
        ));
        return;
      }
      setAlertState(showAlert('Error', pickError.message || 'Failed to read document', [{ text: 'OK' }]));
    } finally {
      isPickingRef.current = false;
      setProcessingAttachment(false);
    }
  };

  const handleReadPhoto = async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    setProcessingAttachment(true);
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, maxWidth: 3000, maxHeight: 3000 });
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      const attachment = await documentService.processDocumentFromPath(asset.uri, asset.fileName || 'Photo.jpg');
      if (attachment) setAttachments(previous => [...previous, attachment]);
    } catch (error: any) { setAlertState(showAlert('Could not read photo', error.message, [{ text: 'OK' }])); }
    finally { isPickingRef.current = false; setProcessingAttachment(false); }
  };

  const clearAttachments = () => setAttachments([]);

  return { attachments, removeAttachment, clearAttachments, handlePickImage, handlePickDocument, handleReadPhoto, processingAttachment };
}

// ─── AttachmentPreview component ─────────────────────────────────────────────

interface AttachmentPreviewProps {
  attachments: MediaAttachment[];
  onRemove: (id: string) => void;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachments, onRemove }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (attachments.length === 0) return null;

  return (
    <ScrollView
      testID="attachments-container"
      horizontal
      style={styles.attachmentsContainer}
      contentContainerStyle={styles.attachmentsContent}
      showsHorizontalScrollIndicator={false}
    >
      {attachments.map(attachment => (
        <View key={attachment.id} testID={`attachment-preview-${attachment.id}`} style={styles.attachmentPreview}>
          {attachment.type === 'image' ? (
            <Image
              testID={`attachment-image-${attachment.id}`}
              source={{ uri: attachment.uri }}
              style={styles.attachmentImage}
            />
          ) : (
            <View testID={`document-preview-${attachment.id}`} style={styles.documentPreview}>
              <Icon name="file-text" size={24} color={colors.primary} />
              <Text style={styles.documentName} numberOfLines={2}>
                {attachment.fileName || 'Document'}
              </Text>
            </View>
          )}
          <TouchableOpacity
            testID={`remove-attachment-${attachment.id}`}
            style={styles.removeAttachment}
            onPress={() => onRemove(attachment.id)}
          >
            <Text style={styles.removeAttachmentText}>&times;</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
};
