import { beginModelLoad, reportModelLoad, finishModelLoad } from '../stores/modelLoadStore';
import { NativeModules,NativeEventEmitter } from 'react-native';
import {
ImageGenerationParams,
ImageGenerationProgress,
GeneratedImage,
} from '../types';
import { generateRandomSeed } from '../utils/generateId';
import logger from '../utils/logger';

const { CoreMLDiffusionModule } = NativeModules;

// Pick the right native module per platform
const DiffusionModule = (CoreMLDiffusionModule);

type ProgressCallback = (progress: ImageGenerationProgress) => void;
type PreviewCallback = (preview: { previewPath: string; step: number; totalSteps: number }) => void;

/** On-device Core ML image generation through the iOS bridge. */
class CoreMLImageGeneratorService {
  private loadedThreads: number | null = null;
  private generating = false;
  private modelLoadEpoch = 0;
  private pipelineWork: Promise<void> = Promise.resolve();

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = this.pipelineWork.then(work);
    this.pipelineWork = result.then(() => undefined, () => undefined);
    return result;
  }
  private eventEmitter: NativeEventEmitter | null = null;

  private getEmitter(): NativeEventEmitter {
    if (!this.eventEmitter) {
      this.eventEmitter = new NativeEventEmitter(DiffusionModule);
    }
    return this.eventEmitter;
  }

  isAvailable(): boolean {
    return DiffusionModule != null;
  }

  async isModelLoaded(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return await DiffusionModule.isModelLoaded();
    } catch {
      return false;
    }
  }

  async getLoadedModelPath(): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      return await DiffusionModule.getLoadedModelPath();
    } catch {
      return null;
    }
  }

  async loadModel(modelPath: string, threads?: number, opts: { cpuOnly?: boolean; attentionVariant?: 'split_einsum' | 'original'; signal?: AbortSignal } = {}): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Core ML image generation is not available on this platform');
    }

    const params: { modelPath: string; threads?: number; cpuOnly?: boolean; attentionVariant?: string } = {
      modelPath,
    };
    if (typeof threads === 'number') {
      params.threads = threads;
    }
    if (opts.cpuOnly) {
      params.cpuOnly = true;
    }
    if (opts.attentionVariant) {
      params.attentionVariant = opts.attentionVariant;
    }

    const epoch = this.modelLoadEpoch;
    const ticket=beginModelLoad('image');
    const listener=this.getEmitter().addListener('OwnImageLoadProgress',(event:{modelPath:string;phase:string})=>{
      if(event.modelPath===modelPath)reportModelLoad(ticket,event.phase);
    });
    try {
      return await this.serialize(async () => {
        if (opts.signal?.aborted || epoch !== this.modelLoadEpoch) throw new Error('Image model loading cancelled');
        const result = await DiffusionModule.loadModel(params);
        if (opts.signal?.aborted || epoch !== this.modelLoadEpoch) {
          // Dispose before allowing any newer operation into the native queue.
          await DiffusionModule.unloadModel();
          this.loadedThreads = null;
          throw new Error('Image model loading cancelled');
        }
        this.loadedThreads = typeof threads === 'number' ? threads : this.loadedThreads;
        return result;
      });
    } finally { listener.remove();finishModelLoad(ticket); }
  }

  getLoadedThreads(): number | null {
    return this.loadedThreads;
  }

  async unloadModel(): Promise<boolean> {
    if (!this.isAvailable()) return true;
    try {
      const result = await this.serialize<boolean>(() => DiffusionModule.unloadModel());
      this.loadedThreads = null;
      return result;
    } catch (e) {
      logger.log('[CoreML] unloadModel failed (bridge may be torn down):', e);
      this.loadedThreads = null;
      return false;
    }
  }

  private subscribeToProgress(onProgress?: ProgressCallback, onPreview?: PreviewCallback): any {
    return this.getEmitter().addListener(
      'OwnImageProgress',
      (event: { step: number; totalSteps: number; progress: number; previewPath?: string }) => {
        onProgress?.({
          step: event.step,
          totalSteps: event.totalSteps,
          progress: event.progress,
        });
        if (event.previewPath && onPreview) {
          onPreview({ previewPath: event.previewPath, step: event.step, totalSteps: event.totalSteps });
        }
      },
    );
  }

  private buildNativeParams(params: ImageGenerationParams & { previewInterval?: number }, prompt: string) {
    return {
      prompt,
      negativePrompt: params.negativePrompt || '',
      steps: params.steps || 8,
      guidanceScale: params.guidanceScale ?? 7.5,
      seed: params.seed ?? generateRandomSeed(),
      width: params.width || 512,
      height: params.height || 512,
      previewInterval: params.previewInterval ?? 2,
    };
  }

  private buildResult(params: ImageGenerationParams, result: any): GeneratedImage {
    return {
      id: result.id,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      imagePath: result.imagePath,
      width: result.width,
      height: result.height,
      steps: params.steps || 8,
      seed: result.seed,
      modelId: '',
      createdAt: Date.now().toString(),
    };
  }

  async generateImage(
    params: ImageGenerationParams & { previewInterval?: number },
    onProgress?: ProgressCallback,
    onPreview?: PreviewCallback,
  ): Promise<GeneratedImage> {
    if (!this.isAvailable()) {
      throw new Error('Core ML image generation is not available on this platform');
    }
    if (this.generating) {
      throw new Error('Image generation already in progress');
    }
    const trimmedPrompt = (params.prompt || '').trim();
    if (!trimmedPrompt) {
      throw new Error('Cannot generate image with an empty prompt');
    }

    this.generating = true;
    const progressSubscription = this.subscribeToProgress(onProgress, onPreview);

    try {
      const result = await this.serialize(() => DiffusionModule.generateImage(this.buildNativeParams(params, trimmedPrompt)));
      // Native side releases the CoreML pipeline after generation to free
      // memory, so clear TS-side state so the next request triggers a reload.
      this.loadedThreads = null;
      return this.buildResult(params, result);
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('ERR_NO_MODEL') || msg.includes('unloaded') || msg.includes('Pipeline failed')) {
        this.loadedThreads = null;
      }
      throw error;
    } finally {
      this.generating = false;
      progressSubscription?.remove();
    }
  }

  async cancelGeneration(): Promise<boolean> {
    this.modelLoadEpoch += 1;
    if (!this.isAvailable()) return true;
    return await DiffusionModule.cancelGeneration();
  }

  async isGenerating(): Promise<boolean> {
    return this.generating;
  }

  async getGeneratedImages(): Promise<GeneratedImage[]> {
    if (!this.isAvailable()) return [];
    try {
      const images = await DiffusionModule.getGeneratedImages();
      return images.map((img: any) => ({
        id: img.id,
        prompt: img.prompt || '',
        imagePath: img.imagePath,
        width: img.width || 512,
        height: img.height || 512,
        steps: img.steps || 20,
        seed: img.seed || 0,
        modelId: img.modelId || '',
        createdAt: img.createdAt,
      }));
    } catch {
      return [];
    }
  }

  async deleteGeneratedImage(imageId: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    return await DiffusionModule.deleteGeneratedImage(imageId);
  }

  getConstants() {
    if (!this.isAvailable()) {
      return {
        DEFAULT_STEPS: 20,
        DEFAULT_GUIDANCE_SCALE: 7.5,
        DEFAULT_WIDTH: 512,
        DEFAULT_HEIGHT: 512,
        SUPPORTED_WIDTHS: [128, 192, 256, 320, 384, 448, 512],
        SUPPORTED_HEIGHTS: [128, 192, 256, 320, 384, 448, 512],
      };
    }
    return DiffusionModule.getConstants();
  }
}

export const coreMLImageGeneratorService = new CoreMLImageGeneratorService();
