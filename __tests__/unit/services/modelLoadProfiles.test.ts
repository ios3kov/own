import AsyncStorage from '@react-native-async-storage/async-storage';
import { modelLoadProfiles } from '../../../src/services/modelLoadProfiles';
beforeEach(async () => {await AsyncStorage.clear();});
it('keeps successful settings and reason across reads', async () => {
  const profile = {key:'engine/file/settings',contextLength:2048,gpuLayers:0,fallbackReason:'memory'};
  await modelLoadProfiles.save(profile);
  expect(await modelLoadProfiles.get(profile.key)).toEqual(profile);
  expect(await modelLoadProfiles.get('different-file')).toBeUndefined();
});
it('bounds the profile store and replaces an existing profile', async () => {
  for(let i=0;i<34;i++) await modelLoadProfiles.save({key:`p${i}`,contextLength:2048,gpuLayers:0});
  expect(await modelLoadProfiles.get('p0')).toBeUndefined();
  await modelLoadProfiles.save({key:'p33',contextLength:1024,gpuLayers:1});
  expect((await modelLoadProfiles.get('p33'))?.contextLength).toBe(1024);
});
it('ignores malformed storage and invalid settings', async () => {
  await AsyncStorage.setItem('own-model-load-profiles-v1','[{}]');
  expect(await modelLoadProfiles.get('p')).toBeUndefined();
  await modelLoadProfiles.save({key:'p',contextLength:-1,gpuLayers:0});
  expect(await modelLoadProfiles.get('p')).toBeUndefined();
});
