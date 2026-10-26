import React,{ useState,useRef } from 'react';
import { View,Text,TextInput,TouchableOpacity,StyleSheet,ActionSheetIOS } from 'react-native';
import { ComposerIcon } from './ComposerIcon';
import { useTheme,useThemedStyles } from '../../theme';
import { ImageModeState,MediaAttachment } from '../../types';
import { VoiceRecordButton } from '../VoiceRecordButton';
import { AttachStep } from 'react-native-spotlight-tour';
import { triggerHaptic } from '../../utils/haptics';
import { CustomAlert,showAlert,hideAlert,AlertState,initialAlertState } from '../CustomAlert';
import { createStyles } from './styles';
import { QueueRow } from './Toolbar';
import { AttachmentPreview,useAttachments } from './Attachments';
import { useVoiceInput } from './Voice';
import { QuickSettingsPopover } from './Popovers';
import { useKeyboardAwarePopover } from './useKeyboardAwarePopover';

interface ChatInputProps {
  onSend: (message: string, attachments?: MediaAttachment[], imageMode?: ImageModeState) => void;
  onStop?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
  placeholder?: string;
  supportsVision?: boolean;
  conversationId?: string | null;
  imageModelLoaded?: boolean;
  onImageModeChange?: (mode: ImageModeState) => void;
  onOpenSettings?: () => void;
  queueCount?: number;
  queuedTexts?: string[];
  onClearQueue?: () => void;
  onToolsPress?: () => void;
  enabledToolCount?: number;
  supportsToolCalling?: boolean;
  supportsThinking?: boolean;
  onRepairVision?: () => void;
  /** When set, mounts a single AttachStep for that index. Only one at a time to avoid waypoint dots. */
  activeSpotlight?: number | null;
  showSettingsDot?: boolean;
}

const IMAGE_MODE_CYCLE: ImageModeState[] = ['auto', 'force', 'disabled'];

// ─── Main Component ─────────────────────────────────────────────────────────

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onStop,
  disabled,
  isGenerating,
  placeholder = 'Message',
  supportsVision = false,
  conversationId,
  imageModelLoaded = false,
  onImageModeChange,
  onOpenSettings: _onOpenSettings,
  queueCount = 0,
  queuedTexts = [],
  onClearQueue,
  onToolsPress,
  enabledToolCount = 0,
  supportsToolCalling = false,
  supportsThinking = false,
  onRepairVision,
  activeSpotlight = null,
  showSettingsDot = false,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [message, setMessage] = useState('');
  const [imageMode, setImageMode] = useState<ImageModeState>('auto');
  const [alertState, setAlertState] = useState<AlertState>(initialAlertState);
  const quickSettings = useKeyboardAwarePopover();
  const attachPicker = useKeyboardAwarePopover();
  const inputRef = useRef<TextInput>(null);
  const { attachments, removeAttachment, clearAttachments, handlePickImage, handlePickDocument, handleReadPhoto, processingAttachment } = useAttachments(setAlertState);

  const { isRecording, isModelLoading, isTranscribing, partialResult, error, voiceAvailable, startRecording, stopRecording, clearResult } = useVoiceInput({
    conversationId,
    onTranscript: (text) => {
      setMessage(prev => {
        const prefix = prev.trim() ? `${prev.trim()} ` : '';
        return prefix + text;
      });
    },
  });

  const canSend = (message.trim().length > 0 || attachments.length > 0) && !disabled && !processingAttachment;

  const handleSend = () => {
    if (!canSend) return;
    triggerHaptic('impactMedium');
    onSend(message.trim(), attachments.length > 0 ? attachments : undefined, imageMode);
    setMessage('');
    clearAttachments();
    inputRef.current?.focus();
    if (imageMode === 'force') {
      setImageMode('auto');
      onImageModeChange?.('auto');
    }
  };

  const handleImageModeToggle = () => {
    if (!imageModelLoaded) { setAlertState(showAlert('No Image Model', 'Download an image generation model from the Models screen to enable this feature.', [{ text: 'OK' }])); quickSettings.hide(); return; }
    const newMode = IMAGE_MODE_CYCLE[(IMAGE_MODE_CYCLE.indexOf(imageMode) + 1) % IMAGE_MODE_CYCLE.length];
    setImageMode(newMode);
    onImageModeChange?.(newMode);
  };

  const handleVisionPress = () => {
    if (!supportsVision) {
      setAlertState(showAlert(
        'Vision Not Supported',
        'The loaded model does not have vision support.\n\nIf this model supports vision, open Download Manager and tap the eye icon next to the model to repair it.',
        [
          { text: 'Cancel', onPress: () => setAlertState(hideAlert()) },
          ...(onRepairVision ? [{ text: 'Go to Download Manager', onPress: () => { setAlertState(hideAlert()); onRepairVision(); } }] : [{ text: 'OK' }]),
        ],
      ));
      return;
    }
    handlePickImage();
  };

  const handleStop = () => {
    if (onStop && isGenerating) {
      triggerHaptic('impactLight');
      onStop();
    }
  };

  const handleQuickSettingsPress = () => quickSettings.show();

  const handleAttachPress = () => {
    {
      const actions = [
        ...(supportsVision ? [{ title: 'Photo', run: handleVisionPress }] : []),
        { title: 'Document', run: handlePickDocument },
        { title: 'Read text from photo', run: handleReadPhoto },
        { title: 'Audio recording', run: handlePickDocument },
      ];
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...actions.map(a => a.title), 'Cancel'], cancelButtonIndex: actions.length },
        index => { actions[index]?.run(); },
      );
    }
  };

  const actionButton = canSend ? (
    <TouchableOpacity
      testID="send-button"
      accessibilityRole="button" accessibilityLabel="Send message"
      style={styles.circleButton}
      onPress={handleSend}
    >
      <ComposerIcon name="send" color={colors.background} />
    </TouchableOpacity>
  ) : isGenerating && onStop ? (
    <TouchableOpacity
      testID="stop-button"
      accessibilityRole="button" accessibilityLabel="Stop generation"
      style={[styles.circleButton, styles.circleButtonStop]}
      onPress={handleStop}
    >
      <ComposerIcon name="stop" color={colors.background} />
    </TouchableOpacity>
  ) : (
    <VoiceRecordButton
      isRecording={isRecording}
      isAvailable={voiceAvailable}
      isModelLoading={isModelLoading}
      isTranscribing={isTranscribing}
      asSendButton
      partialResult={partialResult}
      error={error}
      disabled={disabled}
      onStartRecording={startRecording}
      onStopRecording={stopRecording}
      onCancelRecording={() => { stopRecording(); clearResult(); }}
    />
  );

  const content = (
    <View style={styles.container}>
      {processingAttachment && <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>Reading file on your device…</Text>}
      <AttachmentPreview attachments={attachments} onRemove={removeAttachment} />
      <QueueRow
        queueCount={queueCount}
        queuedTexts={queuedTexts}
        onClearQueue={onClearQueue}
      />
      <View style={styles.mainRow}>
        {/* Pill: text input + right icons */}
        <View style={styles.pill}>
          <TextInput
            ref={inputRef}
            testID="chat-input"
            maxFontSizeMultiplier={1.5}
            style={styles.pillInput}
            value={message}
            onChangeText={setMessage}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            multiline
            scrollEnabled
            editable={!disabled}
            blurOnSubmit={false}
            returnKeyType="default"
          />
          {/* Keep attachment and options available while composing a draft. */}
          <View testID="composer-actions" style={styles.pillIcons}>
            {/* Attach button — opens picker for image or document */}
            <TouchableOpacity
              ref={attachPicker.triggerRef}
              testID="attach-button"
              accessibilityRole="button" accessibilityLabel="Add attachment"
              style={styles.pillIconButton}
              onPress={handleAttachPress}
              disabled={disabled}
            >
              <ComposerIcon
                name="attach"
                color={disabled ? colors.textMuted : colors.textSecondary}
              />
            </TouchableOpacity>

            {/* Quick settings button */}
            <TouchableOpacity
              ref={quickSettings.triggerRef}
              testID="quick-settings-button"
              accessibilityRole="button" accessibilityLabel="Chat options"
              style={styles.pillIconButton}
              onPress={handleQuickSettingsPress}
              disabled={disabled}
            >
              <View style={styles.iconWrapper}>
                <ComposerIcon name="options" color={disabled ? colors.textMuted : colors.textSecondary} />
                {showSettingsDot && <View style={styles.toolWarningDot} />}
              </View>
            </TouchableOpacity>

          </View>
        </View>

        {/* Circular action button — conditionally wrapped with AttachStep */}
        {activeSpotlight === 12 ? (
          <AttachStep index={12} style={spotlightStyles.centered}>{actionButton}</AttachStep>
        ) : actionButton}
      </View>

      {false}

      <QuickSettingsPopover
        visible={quickSettings.visible}
        onClose={quickSettings.hide}
        anchorY={quickSettings.anchor.y}
        anchorX={quickSettings.anchor.x}
        imageMode={imageMode}
        onImageModeToggle={handleImageModeToggle}
        imageModelLoaded={imageModelLoaded}
        supportsThinking={supportsThinking}
        supportsToolCalling={supportsToolCalling}
        enabledToolCount={enabledToolCount}
        onToolsPress={onToolsPress}
      />

      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onClose={() => setAlertState(hideAlert())}
      />
    </View>
  );

  return content;
};

const spotlightStyles = StyleSheet.create({
  centered: { alignSelf: 'center' },
});
