import { ragDatabase, RagSearchResult, StoredEmbedding } from './database';
import { embeddingService } from './embedding';
import { cosineSimilarity } from './vectorMath';
import logger from '../../utils/logger';

export interface SearchResult {
  chunks: RagSearchResult[];
  truncated: boolean;
  unavailable?: string;
  durationMs?: number;
}

class SemanticSearchUnavailable extends Error {}

function retainBestMatch(state: {best:RagSearchResult[];queryVec:number[];limit:number}, entry: StoredEmbedding): void {
  const {best,queryVec,limit} = state;
  if (entry.embedding.length !== queryVec.length || queryVec.length === 0 || limit === 0) return;
  const score = cosineSimilarity(queryVec, entry.embedding);
  if (!Number.isFinite(score)) return;
  const index = best.findIndex(candidate => candidate.score < score);
  const candidate = {doc_id:entry.doc_id,name:entry.name,content:entry.content,position:entry.position,score};
  if (index >= 0) best.splice(index, 0, candidate);
  else if (best.length < limit) best.push(candidate);
  if (best.length > limit) best.pop();
}

class RetrievalService {
  async search(projectId: string, query: string, topK: number = 5): Promise<SearchResult> {
    const started=Date.now();
    try {
      const chunks = await this.searchSemantic(projectId, query, topK);
      return { chunks, truncated: false, durationMs:Math.max(0,Date.now()-started) };
    } catch (error) {
      if (!(error instanceof SemanticSearchUnavailable)) throw error;
      return { chunks: [], truncated: false, unavailable: error.message, durationMs:Math.max(0,Date.now()-started) };
    }
  }

  private async searchSemantic(projectId: string, query: string, topK: number): Promise<RagSearchResult[]> {
    if (!query.trim()) return [];

    let stored = ragDatabase.getEmbeddingsByProject(projectId, {afterId:0,limit:256});
    if (stored.length === 0) {
      if (ragDatabase.getChunksByProject(projectId, 1).length === 0) return [];
      throw new SemanticSearchUnavailable('Document search is unavailable. Index these documents with an embedding model first.');
    }

    if (!embeddingService.isLoaded()) {
      try {
        await embeddingService.load();
      } catch (err) {
        logger.error('[Retrieval] Failed to load embedding model', err);
        throw new SemanticSearchUnavailable('Document search is unavailable because the embedding model could not load.');
      }
    }

    const modelId=embeddingService.getModelIdentity();
    if(!modelId) throw new SemanticSearchUnavailable('Document search is unavailable. Reload the search model, then refresh document search.');
    if(ragDatabase.hasUnreadyDocuments(projectId,modelId)) throw new SemanticSearchUnavailable('Document search needs refreshing for the current model. Open Knowledge Base and choose Refresh document search.');
    let queryVec: number[];
    try {
      queryVec = await embeddingService.embed(query);
    } catch (err) {
      logger.error('[Retrieval] Failed to embed query', err);
      throw new SemanticSearchUnavailable('Document search is unavailable because the search query could not be processed.');
    }

    if(embeddingService.getModelIdentity()!==modelId) throw new SemanticSearchUnavailable('The document-search model changed. Try your search again.');
    // Keep only the requested winners; do not allocate and sort every scored row.
    const limit = Number.isFinite(topK) ? Math.min(100, Math.max(0, Math.floor(topK))) : 5;
    const best: RagSearchResult[] = [];
    const ranking = {best,queryVec,limit};
    let cursor = 0;
    while (stored.length) {
      if(stored.some(entry=>entry.model_id!==modelId)) throw new SemanticSearchUnavailable('Document search needs refreshing for the current model. Open Knowledge Base and choose Refresh document search.');
      for (const entry of stored) retainBestMatch(ranking, entry);
      if (stored.length < 256) break;
      const nextCursor = stored[stored.length - 1].embedding_rowid;
      if (!Number.isSafeInteger(nextCursor) || nextCursor! <= cursor) throw new Error('Document search page did not advance.');
      cursor = nextCursor!;
      // Yield between bounded pages so large projects do not monopolize the UI thread.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      stored = ragDatabase.getEmbeddingsByProject(projectId, {afterId:cursor,limit:256});
    }
    if (best.length === 0 && limit > 0) throw new SemanticSearchUnavailable('Document search is unavailable. Re-index these documents with the current embedding model.');
    return best;
  }

  formatForPrompt(result: SearchResult): string {
    if (result.unavailable) return result.unavailable;
    if (result.chunks.length === 0) return '';

    const sections = result.chunks.map((chunk) => {
      // Sanitize content to prevent prompt injection from user-uploaded documents
      const safeName = chunk.name.replaceAll(/[<>]/g, '');
      // Quoted data preserves mathematical signs and markup without creating delimiters.
      const safeContent = JSON.stringify(chunk.content).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e');
      return `[Source: ${safeName} (part ${chunk.position + 1})]\n${safeContent}`;
    });

    return `<knowledge_base>\nThe following excerpts are from the user's project knowledge base. Use them to inform your response when relevant.\n\n${sections.join('\n\n---\n\n')}\n</knowledge_base>`;
  }

  estimateCharBudget(contextLengthTokens: number): number {
    // 25% of context window reserved for RAG; ~4 chars per token → simplifies to contextLength
    return Number.isFinite(contextLengthTokens) ? Math.max(0, Math.floor(contextLengthTokens)) : 0;
  }

  async searchWithBudget(params: { projectId: string; query: string; contextLength: number; topK?: number }): Promise<SearchResult> {
    const result = await this.search(params.projectId, params.query, params.topK ?? 5);
    const budget = this.estimateCharBudget(params.contextLength);

    const fittingChunks: RagSearchResult[] = [];
    let truncated = false;

    for (const chunk of result.chunks) {
      const formatted = this.formatForPrompt({chunks:[...fittingChunks,chunk],truncated:false});
      if (formatted.length > budget) {
        truncated = true;
        break;
      }
      fittingChunks.push(chunk);
    }

    return { ...result, chunks: fittingChunks, truncated };
  }
}

export const retrievalService = new RetrievalService();
