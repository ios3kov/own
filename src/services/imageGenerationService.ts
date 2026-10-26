import { foundationModelService, isAppleModelSelected } from './foundationModels';
/** ImageGenerationService - Handles image generation independently of UI lifecycle */
import { coreMLImageGeneratorService } from './coreMLImageGenerator';
import { activeModelService } from './activeModelService';
import { llmService } from './llm';
import { useAppStore,useChatStore } from '../stores';
import { GeneratedImage } from '../types';
import logger from '../utils/logger';
import { buildEnhancementMessages,getConversationContext,cleanEnhancedPrompt,buildImageGenMeta,isImagePromptRefusal,imagePromptPreparationStatus } from './imageGenerationHelpers';
import { needsEnglishTranslation } from './promptLanguage';


export interface ImageGenerationState {
  isGenerating: boolean;
  progress: { step: number; totalSteps: number } | null;
  status: string | null;
  previewPath: string | null;
  prompt: string | null;
  conversationId: string | null;
  error: string | null;
  result: GeneratedImage | null;
}

type ImageGenerationListener = (state: ImageGenerationState) => void;

interface GenerateImageParams {
  prompt: string;
  conversationId?: string;
  negativePrompt?: string;
  steps?: number;
  guidanceScale?: number;
  seed?: number;
  previewInterval?: number;
}

interface ActiveImageModel {
  id: string;
  name: string;
  modelPath: string;
  backend?: string;
}

interface RunGenerationOptions {
  params: GenerateImageParams;
  enhancedPrompt: string;
  activeImageModel: ActiveImageModel;
  steps: number;
  guidanceScale: number;
  imageWidth: number;
  imageHeight: number;
  }

interface UpdateEnhancementOptions {
  conversationId: string | undefined;
  tempMessageId: string | null;
  enhancedPrompt: string;
  originalPrompt: string;
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

class ImageGenerationService {
  private enhancing = false;
  private enhancementController: AbortController | null = null;
  private state: ImageGenerationState = {
    isGenerating: false, progress: null, status: null, previewPath: null,
    prompt: null, conversationId: null, error: null, result: null,
  };

  private readonly listeners: Set<ImageGenerationListener> = new Set();
  private cancelRequested: boolean = false;

  getState(): ImageGenerationState { return { ...this.state }; }

  isGeneratingFor(conversationId: string): boolean {
    return this.state.isGenerating && this.state.conversationId === conversationId;
  }

  subscribe(listener: ImageGenerationListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  private updateState(partial: Partial<ImageGenerationState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
    const appStore = useAppStore.getState();
    if ('isGenerating' in partial) appStore.setIsGeneratingImage(this.state.isGenerating);
    if ('progress' in partial) appStore.setImageGenerationProgress(this.state.progress);
    if ('status' in partial) appStore.setImageGenerationStatus(this.state.status);
    if ('previewPath' in partial) appStore.setImagePreviewPath(this.state.previewPath);
  }

  private async _resetLlmAfterEnhancement(): Promise<void> {
    logger.log('[ImageGen] 🔄 Starting cleanup - generating:', llmService.isCurrentlyGenerating());
    try {
      await llmService.stopGeneration();
      logger.log('[ImageGen] ✓ stopGeneration() called');
      logger.log('[ImageGen] ✅ LLM service reset complete - generating:', llmService.isCurrentlyGenerating());
    } catch (resetError) {
      logger.error('[ImageGen] ❌ Failed to reset LLM service:', resetError);
    }
  }

  private async _updateEnhancementMessage(opts: UpdateEnhancementOptions): Promise<void> {
    const { conversationId, tempMessageId, enhancedPrompt, originalPrompt } = opts;
    if (!conversationId || !tempMessageId) return;
    const chatStore = useChatStore.getState();
    if (enhancedPrompt && enhancedPrompt !== originalPrompt) {
      chatStore.updateMessageContent(conversationId, tempMessageId, `<think>__LABEL:Image prompt__\n${enhancedPrompt}</think>`);
      chatStore.updateMessageThinking(conversationId, tempMessageId, false);
    } else {
      logger.warn('[ImageGen] Enhancement produced no change, deleting thinking message');
      chatStore.deleteMessage(conversationId, tempMessageId);
    }
  }

  private deleteEnhancementMessage(conversationId?: string, messageId?: string | null): void {
    if (conversationId && messageId) useChatStore.getState().deleteMessage(conversationId, messageId);
  }

  private async _enhancePrompt(params: GenerateImageParams, steps: number): Promise<string> {
    const { settings } = useAppStore.getState();
    const needsTranslation = await needsEnglishTranslation(params.prompt);
    if (this.cancelRequested) return params.prompt;
    if (!settings.enhanceImagePrompts && !needsTranslation) {
      logger.log('[ImageGen] Enhancement disabled, using original prompt');
      return params.prompt;
    }
    const useApple = isAppleModelSelected();
    const isTextModelLoaded = useApple || llmService.isModelLoaded();
    const isLlmGenerating = llmService.isCurrentlyGenerating();
    logger.log('[ImageGen] 🎨 Starting prompt enhancement - Model loaded:', isTextModelLoaded, 'LLM generating:', isLlmGenerating);
    if (!isTextModelLoaded || (!useApple && isLlmGenerating)) {
      logger.warn('[ImageGen] No text model loaded, skipping enhancement');
      return params.prompt;
    }
    this.updateState({
      isGenerating: true, prompt: params.prompt, conversationId: params.conversationId || null,
      status: imagePromptPreparationStatus(needsTranslation), previewPath: null,
      progress: { step: 0, totalSteps: steps }, error: null, result: null,
    });
    const contextMessages = settings.enhanceImagePrompts && params.conversationId ? getConversationContext(params.conversationId) : [];
    let tempMessageId: string | null = null;
    if (params.conversationId) {
      const tempMessage = useChatStore.getState().addMessage(params.conversationId, {
        role: 'assistant', content: imagePromptPreparationStatus(needsTranslation), isThinking: true,
      });
      tempMessageId = tempMessage.id;
    }
    this.enhancing = !useApple;
    const controller = new AbortController();
    this.enhancementController = controller;
    try {
      logger.log('[ImageGen] 📤 Calling llmService.generateResponse for enhancement...');
      const messages = buildEnhancementMessages(params.prompt, contextMessages, settings.enhanceImagePrompts);
      let raw = useApple
        ? await foundationModelService.generate(messages, {onToken: () => {}, enabledToolIds: [], signal: controller.signal,maxTokens:256,temperature:0})
        : await llmService.generateResponse(messages, (_data) => {});
      logger.log('[ImageGen] 📥 llmService.generateResponse returned');
      logger.log('[ImageGen] LLM state after enhancement - generating:', llmService.isCurrentlyGenerating());
      raw = cleanEnhancedPrompt(raw);
      if (isImagePromptRefusal(raw)) throw new Error('The text model did not provide an image description.');
      logger.log('[ImageGen] ✅ Original prompt:', params.prompt);
      logger.log('[ImageGen] ✅ Enhanced prompt:', raw);
      if (!useApple) await this._resetLlmAfterEnhancement();
      if (this.cancelRequested) {
        this.deleteEnhancementMessage(params.conversationId, tempMessageId);
        return params.prompt;
      }
      const enhancedPrompt = raw || params.prompt;
      await this._updateEnhancementMessage({ conversationId: params.conversationId, tempMessageId, enhancedPrompt, originalPrompt: params.prompt });
      return enhancedPrompt;
    } catch (error: any) {
      logger.error('[ImageGen] ❌ Prompt enhancement failed:', error);
      logger.error('[ImageGen] Error details:', error?.message || 'Unknown error');
      if (!useApple) await this._resetLlmAfterEnhancement();
      this.deleteEnhancementMessage(params.conversationId, tempMessageId);
      return params.prompt;
    } finally { this.enhancing = false; this.enhancementController = null; }
  }

  private async _ensureImageModelLoaded(activeImageModelId: string | null, activeImageModel: ActiveImageModel): Promise<boolean> {
    const isImageModelLoaded = await coreMLImageGeneratorService.isModelLoaded();
    const loadedPath = await coreMLImageGeneratorService.getLoadedModelPath();
    if (isImageModelLoaded && loadedPath === activeImageModel.modelPath) return true;
    if (!activeImageModelId) {
      this.updateState({ error: 'No image model selected', isGenerating: false });
      return false;
    }
    try {
      this.updateState({ status: `Loading ${activeImageModel.name}...` });
      await activeModelService.loadImageModel(activeImageModelId);
      return true;
    } catch (error: any) {
      this.updateState({ isGenerating: false, progress: null, status: null, error: `Failed to load image model: ${error?.message || 'Unknown error'}` });
      return false;
    }
  }

  private _saveResult(result: any, opts: { params: GenerateImageParams; activeImageModel: any; meta: { steps: number; guidanceScale: number; startTime: number } }): GeneratedImage {
    const { params, activeImageModel, meta } = opts;
    result.modelId = activeImageModel.id;
    if (params.conversationId) result.conversationId = params.conversationId;
    useAppStore.getState().addGeneratedImage(result);
    useAppStore.getState().completeChecklistStep('triedImageGen');
    if (params.conversationId) {
      const genTime = Date.now() - meta.startTime;
      useChatStore.getState().addMessage(params.conversationId, {
        role: 'assistant',
        content: `Generated image for: "${params.prompt}"`,
        attachments: [{ id: result.id, type: 'image', uri: `file://${result.imagePath}`, width: result.width, height: result.height }],
        generationTimeMs: genTime,
        generationMeta: buildImageGenMeta(activeImageModel, { steps: meta.steps, guidanceScale: meta.guidanceScale, result }),
      });
    }
    this.updateState({ isGenerating: false, progress: null, status: null, previewPath: null, result, error: null });
    return result;
  }

  private async _runGenerationAndSave(opts: RunGenerationOptions): Promise<GeneratedImage | null> {
    const { params, enhancedPrompt, activeImageModel, steps, guidanceScale, imageWidth, imageHeight } = opts;

    this.updateState({status:'Starting image generation...'});
    const startTime = Date.now();
    try {
      const result = await coreMLImageGeneratorService.generateImage(
        { prompt: enhancedPrompt, negativePrompt: params.negativePrompt || '', steps, guidanceScale, seed: params.seed, width: imageWidth, height: imageHeight, previewInterval: useAppStore.getState().settings.imagePreviewEnabled === true
          ? Math.max(5, Number.isFinite(params.previewInterval) ? params.previewInterval! : 5) : 0 },
        (progress) => {
          if (this.cancelRequested) return;
          const displayStep = Math.min(progress.step, steps);
          this.updateState({progress:{step:displayStep,totalSteps:steps},status:`Generating image (${displayStep}/${steps})...`});
        },
        (preview) => {
          if (this.cancelRequested) return;
          const displayStep = Math.min(preview.step, steps);
          this.updateState({ previewPath: `file://${preview.previewPath}?t=${Date.now()}`, status: `Refining image (${displayStep}/${steps})...` });
        },
      );
      if (this.cancelRequested || !result?.imagePath) { this.resetState(); return null; }
      return this._saveResult(result, { params, activeImageModel, meta: { steps, guidanceScale, startTime } });
    } catch (error: any) {
      const errorMsg = error?.message || 'Image generation failed';
      if (errorMsg.includes('cancelled')) {
        this.resetState();
      } else {
        logger.error('[ImageGenerationService] Generation error:', error);

        // If the pipeline crashed or the model was unloaded, surface a
        // user-friendly message and allow retry (model will auto-reload).
        const isPipelineCrash = errorMsg.includes('Pipeline failed') ||
          errorMsg.includes('unloaded') ||
          errorMsg.includes('ERR_NO_MODEL') ||
          errorMsg.includes('TextEncoder');
        const userMessage = isPipelineCrash
          ? 'Image generation failed — the model encountered an error and was unloaded. Please try again.'
          : errorMsg;

        this.updateState({ isGenerating: false, progress: null, status: null, previewPath: null, error: userMessage });
      }
      return null;
    } finally {
      try { await activeModelService.syncWithNativeState(); }
      catch (error) { logger.warn('[ImageGenerationService] Could not refresh runtime state:', error); }
    }
  }

  /**
   * Generate an image. Runs independently of UI lifecycle.
   * If conversationId is provided, the result will be added as a chat message.
   */
  async generateImage(params: GenerateImageParams): Promise<GeneratedImage | null> {
    if (this.state.isGenerating) {
      logger.log('[ImageGenerationService] Already generating, ignoring request');
      return null;
    }
    const { settings, activeImageModelId, downloadedImageModels } = useAppStore.getState();
    const activeImageModel = downloadedImageModels.find(m => m.id === activeImageModelId);
    if (!activeImageModel) { this.updateState({ error: 'No image model selected' }); return null; }

    const steps = params.steps ?? settings.imageSteps ?? 8;
    const guidanceScale = params.guidanceScale ?? settings.imageGuidanceScale ?? 2.0;
    const imageWidth = settings.imageWidth || 256;
    const imageHeight = settings.imageHeight || 256;

    this.cancelRequested = false;
    this.updateState({
      isGenerating: true, prompt: params.prompt, conversationId: params.conversationId || null,
      status: 'Preparing image generation...', previewPath: null,
      progress: { step: 0, totalSteps: steps }, error: null, result: null,
    });
    let enhancedPrompt: string;
    try { enhancedPrompt = await this._enhancePrompt(params, steps); }
    catch { this.updateState({isGenerating:false,error:'Could not prepare the image prompt. Please retry.'}); return null; }
    if (this.cancelRequested) { this.resetState(); return null; }
    const stillNeedsTranslation = await needsEnglishTranslation(enhancedPrompt);
    if (this.cancelRequested) { this.resetState(); return null; }
    if (isImagePromptRefusal(enhancedPrompt) || stillNeedsTranslation) {
      this.updateState({isGenerating:false,progress:null,status:null,error:'On-device translation could not finish. The selected text model may not support this language. Choose a compatible local text model or enter the image description in English.'});
      return null;
    }
    logger.log('[ImageGen] enhanceImagePrompts setting:', settings.enhanceImagePrompts);

    if (!settings.enhanceImagePrompts) {
      this.updateState({
        isGenerating: true, prompt: params.prompt, conversationId: params.conversationId || null,
        status: 'Preparing image generation...', previewPath: null,
        progress: { step: 0, totalSteps: steps }, error: null, result: null,
      });
    } else {
      this.updateState({ status: 'Preparing image generation...' });
    }

    const loaded = await this._ensureImageModelLoaded(activeImageModelId, activeImageModel);
    if (!loaded) return null;
    if (this.cancelRequested) { this.resetState(); return null; }

    return this._runGenerationAndSave({ params, enhancedPrompt, activeImageModel, steps, guidanceScale, imageWidth, imageHeight });
  }

  async cancelGeneration(): Promise<void> {
    if (!this.state.isGenerating) return;
    this.cancelRequested = true;
    this.enhancementController?.abort();
    if (this.enhancing) { try { await llmService.stopGeneration(); } catch { /* Cancellation remains requested. */ } }
    try { await coreMLImageGeneratorService.cancelGeneration(); } catch { /* Ignore */ }
    // Keep the operation busy until its async work has observed cancellation.
    this.updateState({ status: 'Cancelling...' });
  }

  private resetState(): void {
    this.updateState({
      isGenerating: false, progress: null, status: null, previewPath: null,
      prompt: null, conversationId: null, error: null,
      // Keep result so the last generated image is still accessible
    });
  }
}

export const imageGenerationService = new ImageGenerationService();
