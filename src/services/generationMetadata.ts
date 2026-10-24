import { llmService } from './llm';
import { liteRTService } from './litert';
import { getActiveEngineService } from './engines';
import { useAppStore, useRemoteServerStore } from '../stores';
import type { GenerationMeta } from '../types';

function buildLiteRTMeta(svc: any, modelName: string | undefined): GenerationMeta {
  const backend = liteRTService.getActiveBackend() ?? 'cpu';
  const stats = svc.liteRTBenchmarkStats ?? liteRTService.getLastBenchmarkStats();
  if (stats) {
    return {
      gpu: backend !== 'cpu',
      gpuBackend: backend.toUpperCase(),
      modelName,
      decodeTokensPerSecond: stats.decodeTokensPerSecond,
      prefillTokensPerSecond: stats.prefillTokensPerSecond,
      timeToFirstToken: stats.ttft,
      tokenCount: stats.prefillTokenCount,
      modelLoadTimeSeconds: stats.initTimeSeconds > 0 ? stats.initTimeSeconds : undefined,
    };
  }
  const contentLength = svc.state.streamingContent?.length ?? 0;
  const estimatedTokenCount = Math.ceil(contentLength / 4);
  const genTime = svc.state.startTime ? (Date.now() - svc.state.startTime) / 1000 : 0;
  return {
    gpu: backend !== 'cpu',
    gpuBackend: backend.toUpperCase(),
    modelName,
    tokenCount: estimatedTokenCount,
    tokensPerSecond: genTime > 0 && estimatedTokenCount > 0 ? estimatedTokenCount / genTime : undefined,
  };
}

export function buildGenerationMetaImpl(svc: any): GenerationMeta {
  const meta = buildBaseGenerationMeta(svc);
  return svc.documentSources?.length ? {...meta, documentSources: [...svc.documentSources]} : meta;
}

function buildBaseGenerationMeta(svc: any): GenerationMeta {
  if (svc.isUsingRemoteProvider()) {
    const remoteStore = useRemoteServerStore.getState();
    const activeServer = remoteStore.getActiveServer();
    const contentLength = svc.state.streamingContent.length + svc.totalReasoningLength;
    const estimatedTokens = Math.ceil(contentLength / 4);
    const generationTime = svc.state.startTime ? (Date.now() - svc.state.startTime) / 1000 : 0;
    const tokensPerSecond = generationTime > 0 ? estimatedTokens / generationTime : undefined;
    return {
      gpu: false,
      gpuBackend: 'Remote',
      modelName: activeServer?.name || 'Remote Model',
      tokenCount: estimatedTokens,
      tokensPerSecond,
      timeToFirstToken: svc.remoteTimeToFirstToken,
    };
  }

  const { downloadedModels, activeModelId, settings } = useAppStore.getState();
  const modelName = downloadedModels.find((m: any) => m.id === activeModelId)?.name;

  if (getActiveEngineService() === liteRTService) {
    return buildLiteRTMeta(svc, modelName);
  }

  const { gpu, gpuBackend, gpuLayers } = llmService.getGpuInfo();
  const perf = llmService.getPerformanceStats();
  return {
    gpu, gpuBackend, gpuLayers,
    modelName,
    tokensPerSecond: perf.lastTokensPerSecond,
    decodeTokensPerSecond: perf.lastDecodeTokensPerSecond,
    timeToFirstToken: perf.lastTimeToFirstToken,
    tokenCount: perf.lastTokenCount,
    cacheType: settings.cacheType,
  };
}

