import { open } from '@op-engineering/op-sqlite';
import type { DB } from '@op-engineering/op-sqlite';
import type { Chunk } from './chunking';
import logger from '../../utils/logger';

export interface RagDocument {
  id: number;
  project_id: string;
  name: string;
  path: string;
  size: number;
  created_at: string;
  enabled: number;
}

export interface RagSearchResult {
  doc_id: number;
  name: string;
  content: string;
  position: number;
  score: number;
}

export interface StoredEmbedding {
  model_id?:string;
  embedding_rowid?: number;
  chunk_rowid: number;
  doc_id: number;
  name: string;
  content: string;
  position: number;
  embedding: number[];
}

class RagDatabase {
  private db: DB | null = null;
  private ready = false;

  async ensureReady(): Promise<void> {
    if (this.ready) return;
    try {
      this.db = open({ name: 'rag.db' });
      this.db.executeSync(
        `CREATE TABLE IF NOT EXISTS rag_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          name TEXT NOT NULL,
          path TEXT NOT NULL,
          size INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1
        )`
      );
      this.db.executeSync(
        `CREATE TABLE IF NOT EXISTS rag_chunks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          doc_id INTEGER NOT NULL,
          position INTEGER NOT NULL,
          FOREIGN KEY (doc_id) REFERENCES rag_documents(id)
        )`
      );
      this.db.executeSync(
        `CREATE TABLE IF NOT EXISTS rag_embeddings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chunk_rowid INTEGER NOT NULL,
          doc_id INTEGER NOT NULL,
          embedding BLOB NOT NULL,
          FOREIGN KEY (chunk_rowid) REFERENCES rag_chunks(id),
          FOREIGN KEY (doc_id) REFERENCES rag_documents(id)
        )`
      );
      this.db.executeSync(`CREATE TABLE IF NOT EXISTS rag_embedding_versions (
        doc_id INTEGER PRIMARY KEY, model_id TEXT NOT NULL
      )`);
      this.db.executeSync('CREATE INDEX IF NOT EXISTS rag_chunks_doc_idx ON rag_chunks(doc_id)');
      this.db.executeSync('CREATE INDEX IF NOT EXISTS rag_embeddings_doc_idx ON rag_embeddings(doc_id)');
      this.ready = true;
    } catch (error) {
      logger.error('[RagDB] Failed to initialize:', error);
      throw error;
    }
  }

  private getDb(): DB {
    if (!this.db) throw new Error('RagDatabase not initialized. Call ensureReady() first.');
    return this.db;
  }

  insertDocument(doc: { projectId: string; name: string; path: string; size: number }): number {
    const db = this.getDb();
    const result = db.executeSync(
      'INSERT INTO rag_documents (project_id, name, path, size, created_at) VALUES (?, ?, ?, ?, ?)',
      [doc.projectId, doc.name, doc.path, doc.size, new Date().toISOString()]
    );
    if (result.insertId == null) throw new Error('Failed to insert document: no insertId returned');
    return result.insertId;
  }

  private insertChunkRows(docId: number, chunks: Chunk[]): number[] {
    const rowIds: number[] = [];
    for (const chunk of chunks) {
      const result = this.getDb().executeSync(
        'INSERT INTO rag_chunks (content, doc_id, position) VALUES (?, ?, ?)',
        [chunk.content, docId, chunk.position]
      );
      if (result.insertId == null) throw new Error(`Failed to insert chunk at position ${chunk.position}`);
      rowIds.push(result.insertId);
    }
    return rowIds;
  }

  insertChunks(docId: number, chunks: Chunk[]): number[] {
    const db = this.getDb();
    db.executeSync('BEGIN');
    try {
      const rowIds = this.insertChunkRows(docId, chunks);
      db.executeSync('COMMIT');
      return rowIds;
    } catch (error) {
      db.executeSync('ROLLBACK');
      throw error;
    }
  }

  insertDocumentWithChunks(doc: Parameters<RagDatabase['insertDocument']>[0], chunks: Chunk[]): {docId:number;rowIds:number[]} {
    const db = this.getDb();
    db.executeSync('BEGIN');
    try {
      const docId = this.insertDocument(doc);
      const rowIds = this.insertChunkRows(docId, chunks);
      db.executeSync('COMMIT');
      return {docId,rowIds};
    } catch (error) {
      db.executeSync('ROLLBACK');
      throw error;
    }
  }

  private embeddingToBlob(embedding: number[]): ArrayBuffer {
    return new Float32Array(embedding).buffer;
  }

  private blobToEmbedding(blob: any): number[] {
    // SQLite may return a view into a larger backing buffer. Respect its slice.
    if (ArrayBuffer.isView(blob)) {
      if (blob.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) return [];
      const copy = new Uint8Array(blob.byteLength);
      copy.set(new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength));
      return Array.from(new Float32Array(copy.buffer));
    }
    // instanceof fails for ArrayBuffers returned from another JavaScript realm.
    if (Object.prototype.toString.call(blob) === '[object ArrayBuffer]') {
      if (blob.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) return [];
      return Array.from(new Float32Array(blob));
    }
    return [];
  }

  insertEmbeddingsBatch(entries: { chunkRowid: number; docId: number; embedding: number[] }[], modelId?:string|null): void {
    const db = this.getDb();
    db.executeSync('BEGIN');
    try {
      if(modelId!==undefined) {
        for(const docId of new Set(entries.map(entry=>entry.docId))) {
          db.executeSync('DELETE FROM rag_embeddings WHERE doc_id = ?', [docId]);
          db.executeSync('DELETE FROM rag_embedding_versions WHERE doc_id = ?', [docId]);
          if(modelId) db.executeSync('INSERT INTO rag_embedding_versions (doc_id, model_id) VALUES (?, ?)',[docId,modelId]);
        }
      }
      for (const entry of entries) {
        db.executeSync(
          'INSERT INTO rag_embeddings (chunk_rowid, doc_id, embedding) VALUES (?, ?, ?)',
          [entry.chunkRowid, entry.docId, this.embeddingToBlob(entry.embedding)]
        );
      }
      db.executeSync('COMMIT');
    } catch (e) {
      db.executeSync('ROLLBACK');
      throw e;
    }
  }

  getEmbeddingsByProject(projectId: string, page?: {afterId:number; limit:number}): StoredEmbedding[] {
    const db = this.getDb();
    const result = db.executeSync(
      `SELECT e.id AS embedding_rowid, e.chunk_rowid, e.doc_id, d.name, c.content, c.position, e.embedding, v.model_id
       FROM rag_embeddings e
       JOIN rag_chunks c ON e.chunk_rowid = c.id
       JOIN rag_documents d ON e.doc_id = d.id
       LEFT JOIN rag_embedding_versions v ON v.doc_id = e.doc_id
       WHERE d.project_id = ? AND d.enabled = 1${page ? ' AND e.id > ? ORDER BY e.id LIMIT ?' : ' ORDER BY e.id'}`,
      page ? [projectId, page.afterId, Math.min(256, Math.max(1, Math.floor(page.limit)))] : [projectId]
    );
    return ((result.rows ?? []) as unknown as any[]).map(row => ({
      ...row,
      embedding: this.blobToEmbedding(row.embedding),
    }));
  }

  hasUnreadyDocuments(projectId:string, modelId:string):boolean {
    const rows=this.getDb().executeSync(`SELECT COUNT(*) AS unready_count FROM rag_documents d
      LEFT JOIN rag_embedding_versions v ON v.doc_id = d.id
      WHERE d.project_id = ? AND d.enabled = 1 AND (
        v.model_id IS NULL OR v.model_id != ? OR
        (SELECT COUNT(*) FROM rag_chunks c WHERE c.doc_id = d.id) !=
        (SELECT COUNT(*) FROM rag_embeddings e WHERE e.doc_id = d.id))`,[projectId,modelId]).rows ?? [];
    return Number((rows as unknown as {unready_count?:number}[])[0]?.unready_count ?? 0)>0;
  }

  getDocumentEmbeddingVersion(docId:number):string|null {
    const rows=this.getDb().executeSync('SELECT model_id FROM rag_embedding_versions WHERE doc_id = ?',[docId]).rows ?? [];
    const value=(rows as unknown as {model_id?:unknown}[])[0]?.model_id;
    return typeof value==='string' ? value : null;
  }

  hasEmbeddingsForDocument(docId: number): boolean {
    const db = this.getDb();
    const result = db.executeSync(
      'SELECT COUNT(*) as count FROM rag_embeddings WHERE doc_id = ?',
      [docId]
    );
    const rows = (result.rows ?? []) as unknown as { count: number }[];
    return rows.length > 0 && rows[0].count > 0;
  }

  getChunksByDocument(docId: number): { id: number; content: string; position: number }[] {
    const db = this.getDb();
    const result = db.executeSync(
      'SELECT id, content, position FROM rag_chunks WHERE doc_id = ? ORDER BY position',
      [docId]
    );
    return (result.rows ?? []) as unknown as { id: number; content: string; position: number }[];
  }

  deleteDocument(docId: number): void {
    const db = this.getDb();
    db.executeSync('DELETE FROM rag_embeddings WHERE doc_id = ?', [docId]);
    db.executeSync('DELETE FROM rag_chunks WHERE doc_id = ?', [docId]);
    db.executeSync('DELETE FROM rag_embedding_versions WHERE doc_id = ?', [docId]);
    db.executeSync('DELETE FROM rag_documents WHERE id = ?', [docId]);
  }

  getDocumentsByProject(projectId: string): RagDocument[] {
    const db = this.getDb();
    const result = db.executeSync(
      'SELECT id, project_id, name, path, size, created_at, enabled FROM rag_documents WHERE project_id = ? ORDER BY created_at DESC',
      [projectId]
    );
    return (result.rows ?? []) as unknown as RagDocument[];
  }

  toggleEnabled(docId: number, enabled: boolean): void {
    const db = this.getDb();
    db.executeSync('UPDATE rag_documents SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, docId]);
  }

  getChunksByProject(projectId: string, topK: number = 5): RagSearchResult[] {
    const db = this.getDb();
    const result = db.executeSync(
      `SELECT c.doc_id, d.name, c.content, c.position, 0 as score
       FROM rag_chunks c JOIN rag_documents d ON c.doc_id = d.id
       WHERE d.project_id = ? AND d.enabled = 1
       ORDER BY c.position LIMIT ?`,
      [projectId, topK]
    );
    return (result.rows ?? []) as unknown as RagSearchResult[];
  }

  deleteDocumentsByProject(projectId: string): void {
    const db = this.getDb();
    db.executeSync('DELETE FROM rag_embeddings WHERE doc_id IN (SELECT id FROM rag_documents WHERE project_id = ?)', [projectId]);
    db.executeSync('DELETE FROM rag_chunks WHERE doc_id IN (SELECT id FROM rag_documents WHERE project_id = ?)', [projectId]);
    db.executeSync('DELETE FROM rag_embedding_versions WHERE doc_id IN (SELECT id FROM rag_documents WHERE project_id = ?)', [projectId]);
    db.executeSync('DELETE FROM rag_documents WHERE project_id = ?', [projectId]);
  }
}

export const ragDatabase = new RagDatabase();
