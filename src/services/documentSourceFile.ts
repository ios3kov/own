import { ragService } from './rag';
import type { DocumentSource } from '../types';

/** Resolve a trusted source against the current project records, never a generated URI. */
export async function resolveDocumentSource(source: DocumentSource): Promise<{uri:string; mimeType?:string}> {
  const documents = await ragService.getDocumentsByProject(source.projectId);
  const document = documents.find(d => d.id === source.documentId && d.project_id === source.projectId);
  if (!document) throw new Error('The original document is no longer available. The saved excerpt is shown below.');
  const path = document.path.startsWith('file://') ? document.path.slice(7) : document.path;
  if (!path.startsWith('/') || Array.from(path).some(character => character.charCodeAt(0) < 32)) throw new Error('The original document cannot be opened.');
  const extension = document.name.split('.').pop()?.toLowerCase();
  const types:Record<string,string> = {pdf:'application/pdf', txt:'text/plain', md:'text/markdown', csv:'text/csv', json:'application/json'};
  const uri = document.path.startsWith('file://') ? document.path : `file://${encodeURI(path).replace(/[?#]/g, encodeURIComponent)}`;
  return {uri, mimeType:extension ? types[extension] : undefined};
}
