import { NativeModules } from 'react-native';

/** Apple's local language recognizer also covers Latin-script languages. No network. */
export async function promptLanguage(text: string): Promise<string | null> {
  const inspect = NativeModules.OwnFoundationModels?.inspectLanguage;
  if (typeof inspect !== 'function') return null;
  try {
    const result = await inspect(text);
    return typeof result?.language === 'string' ? result.language : null;
  } catch { return null; }
}

export async function needsEnglishTranslation(text: string): Promise<boolean> {
  const nonLatin = /[^\p{Script=Latin}\p{Number}\p{Punctuation}\p{Symbol}\s]/u.test(text);
  if (nonLatin) return true;
  const language = await promptLanguage(text);
  if (language) return language !== 'en';
  // Unknown language must not silently be treated as English on a real device.
  return typeof NativeModules.OwnFoundationModels?.inspectLanguage === 'function';
}
