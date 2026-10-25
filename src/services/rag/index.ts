import { ragDatabase } from './database';
import { chunkDocument } from './chunking';
import { retrievalService } from './retrieval';
import { embeddingService } from './embedding';
import { documentService } from '../documentService';
import logger from '../../utils/logger';

export type { Chunk, ChunkOptions } from './chunking';
export type { RagDocument, RagSearchResult } from './database';
export type { SearchResult } from './retrieval';
export { chunkDocument } from './chunking';
export { retrievalService } from './retrieval';
export { embeddingService } from './embedding';

export interface IndexProgress {
  stage: 'extracting' | 'chunking' | 'indexing' | 'embedding' | 'done';
  message: string;
}

export interface IndexDocumentParams {
  projectId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  onProgress?: (progress: IndexProgress) => void;
}

class RagService {
  private indexing=new Set<string>();
  private workTail:Promise<void>=Promise.resolve();
  private schedule<T>(work:()=>Promise<T>):Promise<T> {
    const result=this.workTail.then(work);this.workTail=result.then(()=>undefined,()=>undefined);return result;
  }
  async ensureReady(): Promise<void> {
    await ragDatabase.ensureReady();
  }

  async indexDocument(params: IndexDocumentParams): Promise<number> {
    const keys=[JSON.stringify([params.projectId,'path',params.filePath]),JSON.stringify([params.projectId,'name',params.fileName])];
    if (keys.some(key=>this.indexing.has(key))) throw new Error('This document is already being indexed');
    keys.forEach(key=>this.indexing.add(key));
    try { return await this.schedule(()=>this.indexDocumentImpl(params)); }
    finally { keys.forEach(key=>this.indexing.delete(key)); }
  }

  private async indexDocumentImpl(params: IndexDocumentParams): Promise<number> {
    const { projectId, filePath, fileName, fileSize, onProgress } = params;
    await this.ensureReady();

    // Prevent duplicate indexing of the same file
    const existing = ragDatabase.getDocumentsByProject(projectId);
    if (existing.some(d => d.path === filePath || d.name === fileName)) {
      throw new Error(`Document "${fileName}" is already in the knowledge base`);
    }

    onProgress?.({ stage: 'extracting', message: `Extracting text from ${fileName}...` });
    // Extract full document text for RAG — don't truncate based on context window
    const RAG_MAX_CHARS = 500_000;
    const attachment = await documentService.processDocumentFromPath(filePath, fileName, RAG_MAX_CHARS);
    if (!attachment?.textContent) {
      throw new Error('Could not extract text from document');
    }

    onProgress?.({ stage: 'chunking', message: 'Splitting into chunks...' });
    const chunks = chunkDocument(attachment.textContent);
    if (chunks.length === 0) {
      throw new Error('Document produced no indexable content');
    }

    onProgress?.({ stage: 'indexing', message: 'Indexing chunks...' });
    const {docId,rowIds} = ragDatabase.insertDocumentWithChunks({ projectId, name: fileName, path: filePath, size: fileSize }, chunks);

    onProgress?.({ stage: 'embedding', message: 'Generating embeddings...' });
    try {
      await embeddingService.load();
      const modelId=embeddingService.getModelIdentity();
      if(!modelId) throw new Error('Could not verify the document-search model.');
      const texts = chunks.map(c => c.content);
      const embeddings = await embeddingService.embedBatch(texts);
      const entries = rowIds.map((rowId, i) => ({
        chunkRowid: rowId,
        docId,
        embedding: embeddings[i],
      }));
      if(embeddingService.getModelIdentity()!==modelId) throw new Error('Document-search model changed. Refresh document search.');
      ragDatabase.insertEmbeddingsBatch(entries,modelId);
      logger.log(`[RAG] Generated ${embeddings.length} embeddings for ${fileName}`);
    } catch (err) {
      logger.error('[RAG] Embedding generation failed (non-fatal):', err);
    }

    onProgress?.({ stage: 'done', message: 'Done' });
    logger.log(`[RAG] Indexed ${fileName}: ${chunks.length} chunks`);
    return docId;
  }

  backfillEmbeddings(projectId:string):Promise<number> {return this.schedule(()=>this.backfillEmbeddingsImpl(projectId));}
  private async backfillEmbeddingsImpl(projectId: string): Promise<number> {
    await this.ensureReady();
    const docs = ragDatabase.getDocumentsByProject(projectId);
    let total = 0;let failures=0;
    if(!docs.length) return 0;
    await embeddingService.load();
    const modelId=embeddingService.getModelIdentity();
    if(!modelId) throw new Error('Could not verify the document-search model. Reload it and try again.');
    for (const doc of docs) {
      if (ragDatabase.getDocumentEmbeddingVersion(doc.id)===modelId && ragDatabase.hasEmbeddingsForDocument(doc.id)) continue;

      const chunks = ragDatabase.getChunksByDocument(doc.id);
      if (chunks.length === 0) continue;

      try {
        await embeddingService.load();
        const texts = chunks.map(c => c.content);
        const embeddings = await embeddingService.embedBatch(texts);
        const entries = chunks.map((chunk, i) => ({
          chunkRowid: chunk.id,
          docId: doc.id,
          embedding: embeddings[i],
        }));
        if(embeddingService.getModelIdentity()!==modelId) throw new Error('Document-search model changed. Refresh document search.');
      ragDatabase.insertEmbeddingsBatch(entries,modelId);
        total += embeddings.length;
        logger.log(`[RAG] Backfilled ${embeddings.length} embeddings for ${doc.name}`);
      } catch (err) {
        failures+=1;logger.error(`[RAG] Backfill failed for ${doc.name}:`, err);
      }
    }

    if(failures) throw new Error(`${failures} documents could not refresh. Try again.`);
    return total;
  }

  async deleteDocument(docId: number): Promise<void> {
    return this.schedule(async()=>{
      await this.ensureReady();await embeddingService.clearDocumentCache();ragDatabase.deleteDocument(docId);
    });
  }

  async getDocumentsByProject(projectId: string) {
    await this.ensureReady();
    return ragDatabase.getDocumentsByProject(projectId);
  }

  async toggleDocument(docId: number, enabled: boolean): Promise<void> {
    await this.ensureReady();
    ragDatabase.toggleEnabled(docId, enabled);
  }

  async searchProject(projectId: string, query: string, contextLength?: number) {
    await this.ensureReady();
    if (contextLength) {
      return retrievalService.searchWithBudget({ projectId, query, contextLength });
    }
    return retrievalService.search(projectId, query);
  }

  async deleteProjectDocuments(projectId: string): Promise<void> {
    return this.schedule(async()=>{
      await this.ensureReady();await embeddingService.clearDocumentCache();ragDatabase.deleteDocumentsByProject(projectId);
    });
  }
}

export const ragService = new RagService();
