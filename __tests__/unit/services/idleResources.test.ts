jest.mock('../../../src/services/rag/embedding',()=>({embeddingService:{releaseIfIdle:jest.fn().mockResolvedValue(true)}}));
jest.mock('../../../src/services/whisperService',()=>({whisperService:{releaseIfIdle:jest.fn().mockResolvedValue(false)}}));
jest.mock('../../../src/services/llm',()=>({llmService:{releaseVisionIfIdle:jest.fn().mockResolvedValue(false)}}));
jest.mock('../../../src/services/activeModelService',()=>({activeModelService:{syncWithNativeState:jest.fn().mockResolvedValue(undefined),notifyAuxiliaryChange:jest.fn()}}));
import {releaseIdleAuxiliaries} from '../../../src/services/idleResources';
import {useAppStore} from '../../../src/stores/appStore';
import {embeddingService} from '../../../src/services/rag/embedding';
import {whisperService} from '../../../src/services/whisperService';
import {activeModelService} from '../../../src/services/activeModelService';
beforeEach(()=>{jest.clearAllMocks();useAppStore.setState({settings:{...useAppStore.getState().settings,modelLoadingStrategy:'performance'}});});
it('preserves helpers on ordinary background events in Performance mode',async()=>{
 await releaseIdleAuxiliaries('background');expect(embeddingService.releaseIfIdle).not.toHaveBeenCalled();
});
it('releases only resources their owners report idle, then refreshes diagnostics',async()=>{
 useAppStore.setState({settings:{...useAppStore.getState().settings,modelLoadingStrategy:'memory'}});
 await releaseIdleAuxiliaries('background');expect(embeddingService.releaseIfIdle).toHaveBeenCalledTimes(1);expect(whisperService.releaseIfIdle).toHaveBeenCalledTimes(1);expect(activeModelService.notifyAuxiliaryChange).toHaveBeenCalledTimes(1);
});
it('responds to a memory warning in either mode and tolerates an unavailable helper',async()=>{
 jest.mocked(whisperService.releaseIfIdle).mockRejectedValueOnce(new Error('unavailable'));
 await expect(releaseIdleAuxiliaries('memory-warning')).resolves.toBeUndefined();expect(activeModelService.syncWithNativeState).toHaveBeenCalledTimes(1);expect(activeModelService.notifyAuxiliaryChange).toHaveBeenCalledTimes(1);
});
