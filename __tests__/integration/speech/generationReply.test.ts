import { NativeModules, Platform, AppState } from 'react-native';
import { generationService } from '../../../src/services/generationService';
import { replySpeech } from '../../../src/services/replySpeech';
import { llmService } from '../../../src/services/llm';
import { useAppStore } from '../../../src/stores/appStore';
import { useChatStore } from '../../../src/stores/chatStore';
import { resetStores, setupWithActiveModel, setupWithConversation } from '../../utils/testHelpers';

jest.mock('../../../src/services/llm');
jest.mock('../../../src/services/litert');
jest.mock('../../../src/utils/sharePrompt', () => ({shouldShowSharePrompt: () => false, emitSharePrompt: jest.fn()}));
const tick = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };

describe('generation to local spoken replies', () => {
  beforeEach(() => {
    resetStores(); jest.clearAllMocks(); Platform.OS = 'ios'; AppState.currentState = 'active';
    NativeModules.OwnReplySpeech = {begin: jest.fn().mockResolvedValue(null), stop: jest.fn().mockResolvedValue(null), speak: jest.fn().mockResolvedValue(null)};
    (llmService.isModelLoaded as jest.Mock).mockReturnValue(true);
    (llmService.isCurrentlyGenerating as jest.Mock).mockReturnValue(false);
    (llmService.stopGeneration as jest.Mock).mockResolvedValue(undefined);
    (llmService.getGpuInfo as jest.Mock).mockReturnValue({gpu: false});
    (llmService.getPerformanceStats as jest.Mock).mockReturnValue({});
    setupWithActiveModel();
  });
  afterEach(async () => { await replySpeech.stop(); });
  it('speaks the streamed answer and the unfinished final sentence, never separate reasoning', async () => {
    useAppStore.getState().updateSettings({readRepliesAloud: true});
    const id = setupWithConversation();
    (llmService.generateResponse as jest.Mock).mockImplementation(async (_messages, onToken, onDone) => {
      onToken('<think>Private.</think>**Hello world.**\nGoodbye');
      onDone();
    });
    await generationService.generateResponse(id, [{id:'u',role:'user',content:'Hi',timestamp:Date.now()}]);
    await tick();
    expect(NativeModules.OwnReplySpeech.speak.mock.calls.map((call: string[]) => call[0])).toEqual(['Hello world.', 'Goodbye']);
    expect(useChatStore.getState().conversations.find(c => c.id === id)?.messages.some(m => m.role === 'assistant')).toBe(true);
  });
  it('keeps generation functional while spoken replies are off', async () => {
    const id = setupWithConversation();
    (llmService.generateResponse as jest.Mock).mockImplementation(async (_messages, onToken, onDone) => { onToken('Hello.'); onDone(); });
    await generationService.generateResponse(id, [{id:'u',role:'user',content:'Hi',timestamp:Date.now()}]); await tick();
    expect(NativeModules.OwnReplySpeech.begin).not.toHaveBeenCalled();
    expect(NativeModules.OwnReplySpeech.speak).not.toHaveBeenCalled();
  });
  it('does not begin playback when a reply starts in the background', async () => {
    useAppStore.getState().updateSettings({readRepliesAloud: true}); AppState.currentState = 'background';
    const id = setupWithConversation();
    (llmService.generateResponse as jest.Mock).mockImplementation(async (_messages, onToken, onDone) => { onToken('Hello.'); onDone(); });
    await generationService.generateResponse(id, [{id:'u',role:'user',content:'Hi',timestamp:Date.now()}]); await tick();
    expect(NativeModules.OwnReplySpeech.speak).not.toHaveBeenCalled();
  });
});
