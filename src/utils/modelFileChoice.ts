import type { ModelFile } from '../types';

export function downloadableChoices(files: ModelFile[], ramGB: number): ModelFile[] {
  if (!Number.isFinite(ramGB) || ramGB <= 0) return [];
  return files.filter(file => {
    const bytes = file.size + (file.mmProjFile?.size ?? 0);
    return file.size > 0 && Number.isFinite(bytes) && /\.gguf$/i.test(file.name)
      && !/mmproj|projector|\d{5}-of-\d{5}/i.test(file.name)
      && bytes / 1024 ** 3 * 1.3 + 0.75 <= ramGB * 0.65;
  });
}
export function chooseModelFile(files: ModelFile[], ramGB: number, goal: 'balanced' | 'smaller' | 'larger' = 'balanced'): ModelFile | undefined {
  const rank = (file: ModelFile) => {
    const quant = (file.quantization || '').toUpperCase();
    const preferences = ['Q4_K_M', 'Q4_K_S', 'Q4_0', 'Q5_K_M', 'Q5_K_S', 'Q5_0', 'Q6_K', 'Q8_0'];
    const index = preferences.indexOf(quant);
    return index < 0 ? preferences.length : index;
  };
  const choices = downloadableChoices(files, ramGB);
  if (goal !== 'balanced') return choices.sort((a, b) => goal === 'smaller' ? a.size - b.size : b.size - a.size)[0];
  return choices.sort((a, b) => rank(a) - rank(b) || a.size - b.size)[0];
}
export function choiceSize(file: ModelFile): string {
  return `${((file.size + (file.mmProjFile?.size ?? 0)) / 1024 ** 3).toFixed(2)} GB`;
}
