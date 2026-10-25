import { responseDefaults } from '../../utils/modelResponseSettings';
import { SimpleModelSettings, useResponseBackend } from '../SimpleModelSettings';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { AppSheet } from '../AppSheet';
import { useTheme, useThemedStyles } from '../../theme';
import { useAppStore } from '../../stores';
import { llmService } from '../../services';
import { createStyles } from './styles';
import { ConversationActionsSection } from './ConversationActionsSection';
import { ImageGenerationSection } from './ImageGenerationSection';
import { TextGenerationSection } from './TextGenerationSection';

interface GenerationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenProject?: () => void;
  onOpenGallery?: () => void;
  onDeleteConversation?: () => void;
  conversationImageCount?: number;
  activeProjectName?: string | null;
  isRemote?: boolean;
}

export const GenerationSettingsModal: React.FC<GenerationSettingsModalProps> = ({
  visible,
  onClose,
  onOpenProject,
  onOpenGallery,
  onDeleteConversation,
  conversationImageCount = 0,
  activeProjectName,
  isRemote,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { updateSettings } = useAppStore();
  const backend=useResponseBackend();

  const [performanceStats, setPerformanceStats] = useState(llmService.getPerformanceStats());
  const [imageSettingsOpen, setImageSettingsOpen] = useState(false);
  const [textSettingsOpen, setTextSettingsOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setPerformanceStats(llmService.getPerformanceStats());
    }
  }, [visible]);

  const handleResetDefaults = () => {
    updateSettings(responseDefaults(backend));
  };

  const hasConversationActions = !!(onOpenProject || onOpenGallery || onDeleteConversation);

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['50%', '90%']}
      title="Chat Settings"
    >
      {performanceStats.lastTokensPerSecond > 0 && (
        <View style={styles.statsBar}>
          <Text style={styles.statsLabel}>Last Generation:</Text>
          <Text style={styles.statsValue}>
            {performanceStats.lastTokenCountSource === 'stream-events-estimate' ? '~' : ''}{performanceStats.lastTokensPerSecond.toFixed(1)} tok/s
          </Text>
          <Text style={styles.statsSeparator}>•</Text>
          <Text style={styles.statsValue}>
            {performanceStats.lastTokenCountSource === 'stream-events-estimate' ? '~' : ''}{performanceStats.lastTokenCount} tokens
          </Text>
          <Text style={styles.statsSeparator}>•</Text>
          <Text style={styles.statsValue}>
            {performanceStats.lastGenerationTime.toFixed(1)}s
          </Text>
        </View>
      )}

      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <ConversationActionsSection
          onClose={onClose}
          onOpenProject={onOpenProject}
          onOpenGallery={onOpenGallery}
          onDeleteConversation={onDeleteConversation}
          conversationImageCount={conversationImageCount}
          activeProjectName={activeProjectName}
        />

        {/* IMAGE GENERATION SETTINGS */}
        <TouchableOpacity
          style={[
            styles.accordionHeader,
            !hasConversationActions && styles.accordionHeaderNoMargin,
          ]}
          onPress={() => setImageSettingsOpen(!imageSettingsOpen)}
          activeOpacity={0.7}
        >
          <Text style={styles.accordionTitle}>IMAGE GENERATION</Text>
          <Icon
            name={imageSettingsOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
          />
        </TouchableOpacity>
        {imageSettingsOpen && <ImageGenerationSection />}

        {/* TEXT GENERATION SETTINGS */}
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => setTextSettingsOpen(!textSettingsOpen)}
          activeOpacity={0.7}
        >
          <Text style={styles.accordionTitle}>TEXT GENERATION</Text>
          <Icon
            name={textSettingsOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
          />
        </TouchableOpacity>
        {textSettingsOpen && (
          <>
            {isRemote && (
              <View style={styles.remoteNotice}>
                <Icon name="info" size={13} color={colors.textMuted} />
                <Text style={styles.remoteNoticeText}>
                  Supported controls depend on the selected model. History limits also apply to remote chats.
                </Text>
              </View>
            )}
            <SimpleModelSettings advancedContent={<TextGenerationSection />} />
          </>
        )}

        <TouchableOpacity style={styles.resetButton} onPress={handleResetDefaults}>
          <Text style={styles.resetButtonText}>Reset to Defaults</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </AppSheet>
  );
};
