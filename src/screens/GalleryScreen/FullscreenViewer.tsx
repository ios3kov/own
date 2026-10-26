import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme, useThemedStyles } from '../../theme';
import { GeneratedImage } from '../../types';
import { createStyles } from './styles';
import { formatDate } from './useGalleryActions';
import { storedMediaUri } from '../../services/storedMediaUri';
import type { AlertState } from '../../components/CustomAlert';

interface FullscreenViewerProps {
  alert?: AlertState;
  onDismissAlert?: () => void;
  image: GeneratedImage | null;
  showDetails: boolean;
  onClose: () => void;
  onToggleDetails: () => void;
  onSave: (image: GeneratedImage) => void;
  onDelete: (image: GeneratedImage) => void;
}

export const FullscreenViewer: React.FC<FullscreenViewerProps> = ({
  image,
  alert, onDismissAlert,
  showDetails,
  onClose,
  onToggleDetails,
  onSave,
  onDelete,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal
      visible={!!image}
      transparent
      animationType="fade"
      onRequestClose={alert?.visible ? onDismissAlert : onClose}
    >
      <View style={styles.viewerContainer}>
        <TouchableOpacity
          style={styles.viewerBackdrop}
          activeOpacity={1}
          onPress={alert?.visible ? onDismissAlert : onClose}
        />
        {image && (
          <View style={styles.viewerContent} accessibilityElementsHidden={!!alert?.visible} importantForAccessibility={alert?.visible ? 'no-hide-descendants' : 'auto'}>
            {!showDetails && (
              <Image
                source={{ uri: storedMediaUri(image.imagePath) }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            )}
            {showDetails && (
              <View style={styles.detailsSheet}>
                <View style={styles.detailsSheetHeader}>
                  <Text style={styles.detailsSheetTitle}>Image Details</Text>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Done" onPress={onToggleDetails}>
                    <Text style={styles.detailsSheetClose}>Done</Text>
                  </TouchableOpacity>
                </View>
                <Image
                  source={{ uri: storedMediaUri(image.imagePath) }}
                  style={styles.detailsPreview}
                  resizeMode="contain"
                />
                <ScrollView style={styles.detailsContent}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>PROMPT</Text>
                    <Text style={styles.detailValue}>{image.prompt}</Text>
                  </View>
                  {image.negativePrompt ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>NEGATIVE</Text>
                      <Text style={styles.detailValue}>{image.negativePrompt}</Text>
                    </View>
                  ) : null}
                  <View style={styles.detailsMetaRow}>
                    <View style={styles.detailChip}>
                      <Text style={styles.detailChipText}>{image.steps} steps</Text>
                    </View>
                    <View style={styles.detailChip}>
                      <Text style={styles.detailChipText}>{image.width}x{image.height}</Text>
                    </View>
                    <View style={styles.detailChip}>
                      <Text style={styles.detailChipText}>Seed: {image.seed}</Text>
                    </View>
                  </View>
                  <Text style={styles.detailDate}>{formatDate(image.createdAt)}</Text>
                </ScrollView>
              </View>
            )}
            <View style={styles.viewerActions}>
              <TouchableOpacity
                accessibilityRole="button" accessibilityLabel="Image details" style={[styles.viewerButton, showDetails && styles.viewerButtonActive]}
                onPress={onToggleDetails}
              >
                <Icon name="info" size={22} color={showDetails ? colors.primary : colors.text} />
                <Text style={showDetails ? styles.viewerButtonTextPrimary : styles.viewerButtonText}>
                  Info
                </Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save image" style={styles.viewerButton} onPress={() => onSave(image)}>
                <Icon name="download" size={22} color={colors.text} />
                <Text style={styles.viewerButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Delete image" style={styles.viewerButton} onPress={() => onDelete(image)}>
                <Icon name="trash-2" size={22} color={colors.error} />
                <Text style={styles.viewerButtonTextError}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close image" style={styles.viewerButton} onPress={onClose}>
                <Icon name="x" size={22} color={colors.text} />
                <Text style={styles.viewerButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {alert?.visible && <View testID="gallery-viewer-alert" accessibilityViewIsModal style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <Text testID="alert-title" accessibilityRole="header" style={styles.alertTitle}>{alert.title}</Text>
            <Text testID="alert-message" style={{color:colors.text}}>{alert.message}</Text>
            {(alert.buttons || [{text:'OK'}]).map(button => <TouchableOpacity key={button.text} testID={`alert-button-${button.text}`} accessibilityRole="button"
              onPress={() => { button.onPress?.(); onDismissAlert?.(); }} style={styles.alertButton}>
              <Text style={[styles.alertButtonText,{color:button.style==='destructive'?colors.error:colors.primary}]}>{button.text}</Text>
            </TouchableOpacity>)}
          </View>
        </View>}
      </View>
    </Modal>
  );
};
