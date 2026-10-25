import RNFS from 'react-native-fs';
import { llmService } from './llm';
import { whisperService } from './whisperService';
import { embeddingService } from './rag/embedding';

/** File-based estimates only; actual memory remains the OS footprint, not this sum. */
export async function residentAuxiliaryMemory(includeVision = true): Promise<{estimatedBytes:number;complete:boolean}> {
  const readers = [
    () => whisperService.getLoadedModelPath?.(),
    () => embeddingService.getLoadedModelPath?.(),
    () => includeVision ? llmService.getLoadedVisionPath?.() : null,
  ];
  let estimatedBytes=0;
  let complete=true;
  const seen=new Set<string>();
  for(const read of readers) {
    const path=read();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    try {
      const stat=await RNFS.stat(path);
      const bytes=Number(stat.size);
      if (read() !== path) continue;
      if (Number.isFinite(bytes) && bytes>0) estimatedBytes+=bytes*1.2;
      else complete=false;
    } catch {if(read()===path)complete=false;}
  }
  return {estimatedBytes,complete};
}
