import {generationService} from '../../../src/services/generationService';
import {buildToolLoopHandlersImpl} from '../../../src/services/generationServiceHelpers';
import {executeToolCall} from '../../../src/services/tools/handlers';
import {llmService} from '../../../src/services/llm';
import {useChatStore} from '../../../src/stores/chatStore';
import {resetStores, setupWithActiveModel, setupWithConversation} from '../../utils/testHelpers';
import {sourcesFromChunks} from '../../../src/services/documentSources';
import {ragService} from '../../../src/services/rag';
import {resolveDocumentSource} from '../../../src/services/documentSourceFile';

jest.mock('../../../src/services/llm');
jest.mock('../../../src/services/litert');
jest.mock('../../../src/services/rag', () => ({ragService:{searchProject:jest.fn(),getDocumentsByProject:jest.fn()}}));
jest.mock('../../../src/utils/sharePrompt', () => ({shouldShowSharePrompt:()=>false,emitSharePrompt:jest.fn()}));
const chunks = [{doc_id:7,name:'Notes.txt',position:2,content:'The original passage.',score:1}];
describe('retrieved document references', () => {
  beforeEach(() => {
    resetStores(); jest.clearAllMocks(); setupWithActiveModel();
    (llmService.isModelLoaded as jest.Mock).mockReturnValue(true);
    (llmService.isCurrentlyGenerating as jest.Mock).mockReturnValue(false);
    (llmService.getGpuInfo as jest.Mock).mockReturnValue({gpu:false});
    (llmService.getPerformanceStats as jest.Mock).mockReturnValue({});
    (ragService.searchProject as jest.Mock).mockResolvedValue({chunks,truncated:false});
  });
  it('keeps actual source references from the knowledge-base dispatcher', async () => {
    const result = await executeToolCall({name:'search_knowledge_base',arguments:{query:'passage'},context:{projectId:'p'}});
    expect(result.documentSources).toEqual(sourcesFromChunks('p',chunks));
    expect(result.content).toContain('Notes.txt (part 3)');
  });
  it('attaches initial prompt references to the saved assistant reply', async () => {
    const id = setupWithConversation({projectId:'p'});
    const sources = sourcesFromChunks('p',chunks);
    (llmService.generateResponse as jest.Mock).mockImplementation(async (_messages,onToken,onDone) => {onToken('Answer.');onDone();});
    await generationService.generateResponse(id,[{id:'s',role:'system',content:'The original passage.',timestamp:0,documentSources:sources}, {id:'u',role:'user',content:'Question',timestamp:1}]);
    const reply = useChatStore.getState().conversations.find(c=>c.id===id)?.messages.find(m=>m.role==='assistant');
    expect(reply?.generationMeta?.documentSources).toEqual(sources);
  });
  it('rejects source results from an older generation', () => {
    const svc:any = {generationSequence:1,abortRequested:false,documentSources:[]};
    const handlers = buildToolLoopHandlersImpl(svc);
    svc.generationSequence = 2;
    handlers.onDocumentSources(sourcesFromChunks('p',chunks));
    expect(svc.documentSources).toEqual([]);
    expect(handlers.isAborted()).toBe(true);
  });
  it('opens only the current project-scoped document record', async () => {
    (ragService.getDocumentsByProject as jest.Mock).mockResolvedValue([{id:7,project_id:'p',name:'Notes.txt',path:'/local/notes.txt'}]);
    await expect(resolveDocumentSource(sourcesFromChunks('p',chunks)[0])).resolves.toEqual({uri:'file:///local/notes.txt',mimeType:'text/plain'});
    (ragService.getDocumentsByProject as jest.Mock).mockResolvedValue([{id:7,project_id:'another',name:'Wrong',path:'/local/wrong.txt'}]);
    await expect(resolveDocumentSource(sourcesFromChunks('p',chunks)[0])).rejects.toThrow('no longer available');
  });
  it('does not turn a missing document or a network path into an external link', async () => {
    (ragService.getDocumentsByProject as jest.Mock).mockResolvedValue([]);
    await expect(resolveDocumentSource(sourcesFromChunks('p',chunks)[0])).rejects.toThrow('no longer available');
    (ragService.getDocumentsByProject as jest.Mock).mockResolvedValue([{id:7,project_id:'p',name:'Wrong',path:'https://example.com/file'}]);
    await expect(resolveDocumentSource(sourcesFromChunks('p',chunks)[0])).rejects.toThrow('cannot be opened');
  });
});
