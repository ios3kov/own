import type { DocumentSource } from '../types';
import type { RagSearchResult } from './rag/database';

export function sourcesFromChunks(projectId: string, chunks: RagSearchResult[]): DocumentSource[] {
  return mergeDocumentSources([], chunks.map(chunk => ({
    projectId, documentId: chunk.doc_id, name: chunk.name, part: chunk.position + 1, excerpt: chunk.content,
  })));
}

/** Only retrieval results may enter this map. Never derive targets from generated links. */
export function mergeDocumentSources(existing: DocumentSource[], incoming: DocumentSource[]): DocumentSource[] {
  const result: DocumentSource[] = [];
  const seen = new Set<string>();
  for (const source of [...existing, ...incoming]) {
    if (!source || typeof source.projectId !== 'string' || !source.projectId ||
        !Number.isSafeInteger(source.documentId) || source.documentId <= 0 ||
        !Number.isSafeInteger(source.part) || source.part <= 0 ||
        typeof source.name !== 'string' || typeof source.excerpt !== 'string') continue;
    const key = JSON.stringify([source.projectId, source.documentId, source.part]);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({...source, name: source.name.slice(0, 300), excerpt: source.excerpt.slice(0, 8000)});
    if (result.length >= 12) break;
  }
  return result;
}
