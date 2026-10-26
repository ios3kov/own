import { NativeModules } from 'react-native';
import { needsEnglishTranslation } from '../../../src/services/promptLanguage';
describe('local prompt language checks', () => {
  const previous = NativeModules.OwnFoundationModels;
  afterEach(() => { NativeModules.OwnFoundationModels = previous; });
  it.each(['es','fr','de','it','pt','pl','tr','ru','zh-Hans','ja','ko','ar','hi','th','und'])('requires preparation for %s, including Latin-script languages', async language => {
    NativeModules.OwnFoundationModels = {inspectLanguage:jest.fn().mockResolvedValue({language})};
    expect(await needsEnglishTranslation('sample')).toBe(true);
  });
  it('keeps recognized English and fails closed on recognizer failure', async () => {
    NativeModules.OwnFoundationModels = {inspectLanguage:jest.fn().mockResolvedValue({language:'en'})};
    expect(await needsEnglishTranslation('A puppy')).toBe(false);
    expect(await needsEnglishTranslation('A puppy playing in 東京')).toBe(true);
    NativeModules.OwnFoundationModels.inspectLanguage.mockRejectedValue(new Error('Unavailable'));
    expect(await needsEnglishTranslation('unknown')).toBe(true);
  });
});
