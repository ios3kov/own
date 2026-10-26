/**
 * Standalone utility helpers for ActiveModelService.
 */

import { useAppStore } from '../../stores';
import { hardwareService } from '../hardware';
import { llmService } from '../llm';

import { coreMLImageGeneratorService } from '../coreMLImageGenerator';
import { ResourceUsage } from './types';
import { residentAuxiliaryMemory } from '../residentAuxiliaryMemory';

export async function getResourceUsage(): Promise<ResourceUsage> {
  const info = await hardwareService.refreshMemoryInfo();
  const store = useAppStore.getState();
  let estimatedModelMemory = 0;

  if (llmService.isModelLoaded()) {
    const residentPath=llmService.getLoadedModelPath?.();
    const tm = store.downloadedModels.find(m => residentPath ? m.filePath === residentPath : m.id === store.activeModelId);
    if (tm?.fileSize) {
      estimatedModelMemory += tm.fileSize * 1.2;
    }
  }
  if (store.activeImageModelId && await coreMLImageGeneratorService.isModelLoaded()) {
    const im = store.downloadedImageModels.find(m => m.id === store.activeImageModelId);
    if (im?.size) {
      estimatedModelMemory += im.size * 1.3;
    }
  }

  const auxiliary = await residentAuxiliaryMemory();
  estimatedModelMemory += auxiliary.estimatedBytes;
  return {
    auxiliaryMemoryEstimateComplete:auxiliary.complete,
    memoryUsed: info.usedMemory,
    memoryTotal: info.totalMemory,
    memoryAvailable: info.availableMemory,
    memoryUsagePercent: (info.usedMemory / info.totalMemory) * 100,
    estimatedModelMemory,
  };
}

export interface SyncStateTarget {
  setLoadedTextModelId: (id: string | null) => void;
  setLoadedImageModelId: (id: string | null) => void;
  setLoadedImageModelThreads: (n: number | null) => void;
  loadedTextModelId: string | null;
  loadedImageModelId: string | null;
}

export async function syncWithNativeState(target: SyncStateTarget): Promise<void> {
  const store = useAppStore.getState();

  const textModelLoaded = llmService.isModelLoaded();
  if (!textModelLoaded) {
    target.setLoadedTextModelId(null);
  } else if (!target.loadedTextModelId && store.activeModelId) {
    target.setLoadedTextModelId(store.activeModelId);
  }

  const imageModelLoaded = await coreMLImageGeneratorService.isModelLoaded();
  if (!imageModelLoaded) {
    target.setLoadedImageModelId(null);
    target.setLoadedImageModelThreads(null);
  } else if (!target.loadedImageModelId && store.activeImageModelId) {
    target.setLoadedImageModelId(store.activeImageModelId);
  }
}
