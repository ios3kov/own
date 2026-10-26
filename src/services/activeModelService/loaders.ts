/**
 * Low-level load/unload helpers for ActiveModelService.
 * Extracted to keep index.ts under the max-lines limit.
 */

import { useAppStore } from '../../stores';
import { DownloadedModel,LlamaDownloadedModel,ONNXImageModel } from '../../types';
import { llmService } from '../llm';

import { coreMLImageGeneratorService } from '../coreMLImageGenerator';
import logger from '../../utils/logger';
import RNFS from 'react-native-fs';

export async function resolveMmProjPath(
  model: LlamaDownloadedModel,
  _modelId: string,
): Promise<string | undefined> {
  // Fast path: persisted mmProjPath still exists on disk
  if (model.mmProjPath) {
    if (await RNFS.exists(model.mmProjPath)) {
      return model.mmProjPath;
    }
  }

  // Never attach an unlinked projector by filename. Compatibility must be
  // established during an explicit paired download/import.
  return undefined;
}

// ---------------------------------------------------------------------------
// Text model loader
// ---------------------------------------------------------------------------

export interface TextLoadContext {
  model: DownloadedModel;
  modelId: string;
  store: ReturnType<typeof useAppStore.getState>;
  timeoutMs: number;
  loadedTextModelId: string | null;
  onLoaded: (modelId: string) => void;
  onError: () => void;
  onFinally: () => void;
}


export async function doLoadTextModel(ctx: TextLoadContext): Promise<void> {
  ;

  try {
    if (ctx.loadedTextModelId && ctx.loadedTextModelId !== ctx.modelId) {
      try {
        await llmService.unloadModel();
      } catch (unloadErr) {
        // Log but continue — loadModel will also attempt to release the old context
        logger.warn('[ActiveModel] Error unloading previous model, continuing:', unloadErr);
      }
      ctx.onError(); // resets loadedTextModelId to null before reassignment
    }

    const mmProjPath = await resolveMmProjPath(ctx.model, ctx.modelId);

    const cancellation = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => {
          cancellation.abort();
          reject(
            new Error(
              `Text model loading timed out after ${ctx.timeoutMs / 1000}s. ` +
                'Try a smaller model or reduce context length in settings.',
            ),
          );
        },
        ctx.timeoutMs,
      );
    });

    try {
      await Promise.race([
        llmService.loadModel(ctx.model.filePath, mmProjPath, cancellation.signal),
        timeoutPromise,
      ]);
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
    // Capture settings that require model reload
    const { settings } = ctx.store;
    const reloadSettings = {
      enableGpu: settings.enableGpu,
      inferenceBackend: settings.inferenceBackend,
      gpuLayers: settings.gpuLayers,
      nThreads: settings.nThreads,
      nBatch: settings.nBatch,
      nUbatch: settings.nUbatch ?? 0,
      contextLength: settings.contextLength,
      flashAttn: settings.flashAttn,
      cacheType: settings.cacheType,
    };
    ctx.store.setLoadedSettings(reloadSettings);

    ctx.onLoaded(ctx.modelId);
    ctx.store.setActiveModelId(ctx.modelId);
  } catch (error) {
    ctx.onError();
    throw error;
  } finally {
    ctx.onFinally();
  }
}

// ---------------------------------------------------------------------------
// Image model loader
// ---------------------------------------------------------------------------

export interface ImageLoadContext {
  model: ONNXImageModel;
  modelId: string;
  imageThreads: number;
  needsThreadReload: boolean;
  cpuOnly: boolean;
  store: ReturnType<typeof useAppStore.getState>;
  timeoutMs: number;
  loadedImageModelId: string | null;
  onLoaded: (modelId: string, threads: number) => void;
  onError: () => void;
  onFinally: () => void;
}

export async function doLoadImageModel(ctx: ImageLoadContext): Promise<void> {
  try {
    if (
      ctx.loadedImageModelId &&
      (ctx.loadedImageModelId !== ctx.modelId || ctx.needsThreadReload)
    ) {
      await coreMLImageGeneratorService.unloadModel();
      ctx.onError(); // resets loadedImageModelId/threads to null
    }

    const cancellation = new AbortController();
    let imgTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      imgTimeoutId = setTimeout(
        () => { cancellation.abort(); reject(new Error('Image model loading timed out')); },
        ctx.timeoutMs,
      );
    });

    try {
      await Promise.race([
        coreMLImageGeneratorService.loadModel(
          ctx.model.modelPath,
          ctx.imageThreads,
          {
            cpuOnly: ctx.cpuOnly,
            attentionVariant: ctx.model.attentionVariant,
            signal: cancellation.signal,
          },
        ),
        timeoutPromise,
      ]);
    } finally {
      if (imgTimeoutId !== null) clearTimeout(imgTimeoutId);
    }

    ctx.onLoaded(ctx.modelId, ctx.imageThreads);
    ctx.store.setActiveImageModelId(ctx.modelId);
  } catch (error) {
    ctx.onError();
    throw error;
  } finally {
    ctx.onFinally();
  }
}
