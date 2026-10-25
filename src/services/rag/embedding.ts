import {documentEmbeddingCache} from './documentEmbeddingCache';
import { initLlama,LlamaContext } from 'llama.rn';
import RNFS from 'react-native-fs';
import logger from '../../utils/logger';

const EMBEDDING_MODEL_FILENAME = 'all-MiniLM-L6-v2-Q8_0.gguf';
const EMBEDDING_DIMENSION = 384;
const EMBEDDING_CTX_SIZE = 512;

class EmbeddingService {
  private context: LlamaContext | null = null;
  private currentModelPath: string | null = null;
  private loading: Promise<void> | null = null;
  private loadEpoch = 0;
  private pendingWork=0;
  private pendingReleases=0;
  private workTail: Promise<void> = Promise.resolve();
  private modelIdentity:string|null=null;
  private queryCache = new Map<string, number[]>();

  private schedule<T>(work: () => Promise<T>): Promise<T> {
    this.pendingWork+=1;
    const result = this.workTail.then(work).finally(()=>{this.pendingWork-=1;});
    this.workTail = result.then(() => undefined, () => undefined);
    return result;
  }

  async load(): Promise<void> {
    if (this.context && this.pendingReleases===0) return;
    if (this.loading !== null) return this.loading;

    const epoch = this.loadEpoch;
    this.loading = this.schedule(() => this.doLoad(epoch));
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  private async doLoad(epoch: number): Promise<void> {
    const modelPath = await this.ensureModelCopied();
    const identity=await this.readModelIdentity(modelPath);
    logger.log('[Embedding] Loading embedding model...');
    if (epoch !== this.loadEpoch) throw new Error('Embedding load cancelled.');
    const context = await initLlama({
      model: modelPath,
      embedding: true,
      n_gpu_layers: 0,
      n_ctx: EMBEDDING_CTX_SIZE,
      n_batch: EMBEDDING_CTX_SIZE,
      n_threads: 2,
      use_mlock: false,
      use_mmap: true,
    } as any);
    if (epoch !== this.loadEpoch) {
      await context.release();
      throw new Error('Embedding load cancelled.');
    }
    this.queryCache.clear();
    this.context = context;
    this.currentModelPath = modelPath;
    this.modelIdentity=identity;
    logger.log('[Embedding] Model loaded successfully');
  }

  private async readModelIdentity(path:string):Promise<string|null> {
    try {
      const digest=await RNFS.hash(path,'sha256');
      return /^[a-f0-9]{64}$/i.test(digest) ? `${require('llama.rn/package.json').version}:384:${digest.toLowerCase()}` : null;
    } catch {return null;}
  }
  async clearDocumentCache():Promise<void> {
    return this.schedule(async()=>{this.queryCache.clear();await documentEmbeddingCache.clear();});
  }
  private async ensureModelCopied(): Promise<string> {
    const destPath = `${RNFS.DocumentDirectoryPath}/${EMBEDDING_MODEL_FILENAME}`;
    const exists = await RNFS.exists(destPath);
    if (!exists) {
      {
        const bundlePath = `${RNFS.MainBundlePath}/${EMBEDDING_MODEL_FILENAME}`;
        await RNFS.copyFile(bundlePath, destPath);
      }
      logger.log('[Embedding] Copied embedding model to documents directory');
    }
    return destPath;
  }

  async embed(text: string): Promise<number[]> {
    return this.schedule(async () => {
      if (!this.context) throw new Error('Embedding model not loaded. Call load() first.');
      const cached = this.queryCache.get(text);
      if (cached) {
        this.queryCache.delete(text); this.queryCache.set(text, cached);
        return [...cached];
      }
      const vector = await this.runEmbedding(text);
      if (text.length <= 4096) {
        if (this.queryCache.size >= 64) this.queryCache.delete(this.queryCache.keys().next().value!);
        this.queryCache.set(text, [...vector]);
      }
      return vector;
    });
  }

  private async runEmbedding(text: string): Promise<number[]> {
    if (!this.context) throw new Error('Embedding model not loaded. Call load() first.');
    try {
      const result = await (this.context as any).embedding(text);
      return result.embedding;
    } catch (error: any) {
      const msg = error?.message || String(error) || '';
      logger.error('[Embedding] Native error during embedding:', msg);
      // Attempt recovery by reloading the embedding model
      if (msg.includes('ggml') || msg.includes('abort') || msg.includes('alloc') || msg.includes('OOM')) {
        try {
          await this.releaseContext();
        } catch { /* ignore cleanup errors */ }
        throw new Error(`Embedding failed (native error). Model has been unloaded for safety. (${msg})`);
      }
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return this.schedule(async () => {
      if (!this.context) throw new Error('Embedding model not loaded. Call load() first.');
      if (this.modelIdentity) await documentEmbeddingCache.prepare(this.modelIdentity);
      const results: number[][] = [];
      for (const text of texts) {
        const cached=this.modelIdentity ? documentEmbeddingCache.get(text) : undefined;
        const vector=cached ?? await this.runEmbedding(text);
        results.push(vector);
        if(this.modelIdentity && !cached) documentEmbeddingCache.put(text,vector);
      }
      if(this.modelIdentity) await documentEmbeddingCache.save();
      return results;
    });
  }

  async unload(): Promise<void> {
    this.loadEpoch += 1;this.pendingReleases+=1;
    try {await this.schedule(() => this.releaseContext());} finally {this.pendingReleases-=1;}
  }

  async releaseIfIdle():Promise<boolean> {
    if(!this.context || this.loading || this.pendingWork || this.pendingReleases) return false;
    await this.unload();return true;
  }
  private async releaseContext(): Promise<void> {
    const context = this.context;
    this.context = null;
    this.currentModelPath = null;
    this.modelIdentity=null;
    this.queryCache.clear();
    if (context) {
      try { await context.release(); }
      catch (error) { logger.warn('[Embedding] Error releasing context:', error); }
      logger.log('[Embedding] Model unloaded');
    }
  }

  isLoaded(): boolean {
    return this.context !== null && this.pendingReleases===0;
  }

  getModelIdentity():string|null {return this.context && !this.pendingReleases ? this.modelIdentity : null;}
  getLoadedModelPath(): string | null { return this.context ? this.currentModelPath : null; }
  getDimension(): number {
    return EMBEDDING_DIMENSION;
  }
}

export const embeddingService = new EmbeddingService();
