import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Message } from '../../../types';

interface GenerationMetaProps {
  generationMeta: NonNullable<Message['generationMeta']>;
  styles: any;
}

type MetaItem = { key: string; label: string; maxLines?: number };

function runtimeEntries(m:NonNullable<Message['generationMeta']>):Array<[string,string|undefined,number?]> {
  return [
    ['visible-reply', m.sendToVisibleMs!==undefined ? `send to visible ${(m.sendToVisibleMs/1000).toFixed(2)}s` : undefined],
    ['queue-wait', m.queueWaitMs ? `queue ${(m.queueWaitMs/1000).toFixed(2)}s` : undefined],
    ['memory', m.processMemoryBytes ? `app memory ${Math.round(m.processMemoryBytes/1024**2)} MB` : undefined],
    ['peak-memory', m.processPeakMemoryBytes ? `app peak ${Math.round(m.processPeakMemoryBytes/1024**2)} MB since launch` : undefined],
  ];
}

function formatOptionalMeta(meta: NonNullable<Message['generationMeta']>, tps: number | null | undefined): MetaItem[] {
  const m = meta;
  const entries: Array<[string, string | undefined, number?]> = [
    ['model', m.modelName, 1],
    ['load', m.modelLoadTimeSeconds != null && m.modelLoadTimeSeconds > 0 ? `load ${m.modelLoadTimeSeconds.toFixed(1)}s` : undefined],
    ['prefill', m.prefillTokensPerSecond != null && m.prefillTokensPerSecond > 0 ? `prefill ${m.prefillTokensPerSecond.toFixed(0)} tok/s` : undefined],
    ['tps', tps != null && tps > 0 ? `${m.tokenCountSource === 'stream-events-estimate' ? '~' : ''}${tps.toFixed(1)} tok/s` : undefined],
    ['ttft', m.timeToFirstToken != null && m.timeToFirstToken > 0 ? `TTFT ${m.timeToFirstToken.toFixed(2)}s` : undefined],
    ['tokens', m.tokenCount != null && m.tokenCount > 0 ? `${m.tokenCountSource === 'stream-events-estimate' ? '~' : ''}${m.tokenCount} tokens` : undefined],
    ['steps', m.steps == null ? undefined : `${m.steps} steps`],
    ['cfg', m.guidanceScale == null ? undefined : `cfg ${m.guidanceScale}`],
    ['res', m.resolution],
    ['cached-tokens', m.cachedTokenCount != null ? `${m.cachedTokenCount} cached tokens` : undefined],
    ['cache', m.cacheType ? `KV ${m.cacheType}` : undefined],
    ...runtimeEntries(m),
  ];
  return entries
    .filter((e): e is [string, string, number?] => e[1] != null)
    .map(([key, label, maxLines]) => ({ key, label, maxLines }));
}

function buildMetaItems(
  meta: NonNullable<Message['generationMeta']>,
  tps: number | null | undefined,
): MetaItem[] {
  const layers = meta.gpuLayers != null && meta.gpuLayers > 0 ? ` (${meta.gpuLayers}L)` : '';
  const backend = meta.gpuBackend || (meta.gpu ? 'GPU' : 'CPU');
  return [
    { key: 'backend', label: `${backend}${layers}` },
    ...formatOptionalMeta(meta, tps),
  ];
}

export function GenerationMeta({ generationMeta, styles }: Readonly<GenerationMetaProps>) {
  const rawTps = generationMeta.decodeTokensPerSecond ?? generationMeta.tokensPerSecond;
  const tps = rawTps && rawTps > 0 ? rawTps : undefined;
  const items = buildMetaItems(generationMeta, tps);

  return (
    <Animated.View entering={FadeIn.duration(250)}>
      <View testID="generation-meta" style={styles.generationMetaRow}>
        {items.map((item, index) => (
          <React.Fragment key={item.key}>
            {index > 0 && <Text style={styles.generationMetaSep}>·</Text>}
            <Text style={styles.generationMetaText} numberOfLines={item.maxLines}>
              {item.label}
            </Text>
          </React.Fragment>
        ))}
      </View>
    </Animated.View>
  );
}
