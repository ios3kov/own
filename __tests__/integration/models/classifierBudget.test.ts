import { initLlama } from 'llama.rn';
import RNFS from 'react-native-fs';
import { llmService } from '../../../src/services/llm';
import { intentClassifier } from '../../../src/services/intentClassifier';
import { createMockLlamaContext, resetStores } from '../../utils/testHelpers';

beforeEach(async () => {
  await llmService.unloadModel();
  resetStores();
  intentClassifier.clearCache();
  (RNFS.exists as jest.Mock).mockResolvedValue(true);
});
afterEach(async () => { await llmService.unloadModel(); jest.restoreAllMocks(); });

it('passes a full ambiguous request through the classifier to a capped native completion', async () => {
  const context = createMockLlamaContext();
  (context.completion as jest.Mock).mockImplementation(async (_params, onToken) => {
    onToken({ token: 'YES' });
    return { text: 'YES' };
  });
  (initLlama as jest.Mock).mockResolvedValue(context);
  await llmService.loadModel('/classifier.gguf');
  const message = `${'ambiguous context '.repeat(30)} final task details`;
  expect(await intentClassifier.classifyIntent(message, { useLLM: true })).toBe('image');
  expect(context.completion).toHaveBeenCalledWith(
    expect.objectContaining({ n_predict: 8, enable_thinking:false, messages: expect.arrayContaining([
      expect.objectContaining({ content: expect.stringContaining('final task details') }),
    ]) }), expect.any(Function),
  );
});
