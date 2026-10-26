import {useAppStore} from '../stores/appStore';
import {embeddingService} from './rag/embedding';
import {whisperService} from './whisperService';
import {llmService} from './llm';
import {activeModelService} from './activeModelService';
let pending:Promise<void>|null=null;
/** Release RAM only. Original model files, selections and downloads are retained. */
export function releaseIdleAuxiliaries(reason:'background'|'memory-warning'):Promise<void> {
 if(reason==='background' && useAppStore.getState().settings.modelLoadingStrategy!=='memory') return Promise.resolve();
 if(pending) return pending;
 pending=Promise.allSettled([embeddingService.releaseIfIdle(),whisperService.releaseIfIdle(),llmService.releaseVisionIfIdle()]).then(async results=>{
  await activeModelService.syncWithNativeState();
  if(results.some(result=>result.status==='fulfilled' && result.value)) activeModelService.notifyAuxiliaryChange();
 }).finally(()=>{pending=null;});
 return pending;
}
