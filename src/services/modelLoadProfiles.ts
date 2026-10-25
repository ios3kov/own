import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'own-model-load-profiles-v1';
export interface ModelLoadProfile {
  key: string;
  contextLength: number;
  gpuLayers: number;
  fallbackReason?: string;
}
function valid(value: any): value is ModelLoadProfile {
  return typeof value?.key === 'string' && value.key.length <= 8192
    && Number.isInteger(value.contextLength) && value.contextLength > 0
    && Number.isInteger(value.gpuLayers) && value.gpuLayers >= 0
    && (value.fallbackReason === undefined || typeof value.fallbackReason === 'string');
}
async function readProfiles(): Promise<ModelLoadProfile[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const values: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(values) ? values.filter(valid).slice(-32) : [];
  } catch { return []; }
}
let writes: Promise<void> = Promise.resolve();
export const modelLoadProfiles = {
  async get(key: string): Promise<ModelLoadProfile | undefined> {
    await writes;
    return (await readProfiles()).find(profile => profile.key === key);
  },
  async save(profile: ModelLoadProfile): Promise<void> {
    if (!valid(profile)) return;
    const work = writes.then(async () => {
      const previous = (await readProfiles()).filter(value => value.key !== profile.key);
      const limited = {...profile, fallbackReason:profile.fallbackReason?.slice(0,512)};
      try { await AsyncStorage.setItem(STORAGE_KEY,JSON.stringify([...previous,limited].slice(-32))); }
      catch { /* A preference write must not discard a successfully loaded model. */ }
    });
    writes = work.catch(() => {});
    await writes;
  },
};
