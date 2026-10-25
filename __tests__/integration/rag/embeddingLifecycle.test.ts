import { initLlama } from 'llama.rn';
import { embeddingService } from '../../../src/services/rag/embedding';

it('disposes a cancelled load, then permits fresh initialization and document embedding', async () => {
  await embeddingService.unload();
  let complete!: (value: any) => void;
  (initLlama as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const loading = embeddingService.load().catch(error => error);
  while (!complete) await Promise.resolve();
  const unloading = embeddingService.unload();
  const release = jest.fn().mockResolvedValue(undefined);
  complete({release});
  expect(await loading).toEqual(expect.objectContaining({message: 'Embedding load cancelled.'}));
  await unloading;
  expect(release).toHaveBeenCalledTimes(1);
  expect(embeddingService.isLoaded()).toBe(false);
  const embedding = jest.fn().mockResolvedValue({embedding:[0.2, 0.8]});
  const freshRelease = jest.fn().mockResolvedValue(undefined);
  (initLlama as jest.Mock).mockResolvedValueOnce({embedding, release:freshRelease});
  await embeddingService.load();
  expect(await embeddingService.embed('document')).toEqual([0.2,0.8]);
  await embeddingService.unload();
  expect(freshRelease).toHaveBeenCalledTimes(1);
});

it('serializes embedding and unload, and invalidates query cache on reload', async () => {
  await embeddingService.unload();
  let complete!: (value: any) => void;
  const nativeEmbedding = jest.fn().mockImplementationOnce(() => new Promise(resolve => {complete=resolve;}))
    .mockResolvedValue({embedding:[3,4]});
  const release = jest.fn().mockResolvedValue(undefined);
  (initLlama as jest.Mock).mockResolvedValue({embedding:nativeEmbedding,release});
  await embeddingService.load();
  const first = embeddingService.embed('same query');
  while (!complete) await Promise.resolve();
  const duplicate = embeddingService.embed('same query');
  const unloading = embeddingService.unload();
  expect(release).not.toHaveBeenCalled();
  complete({embedding:[1,2]});
  const vector = await first;
  vector[0] = 999;
  expect(await duplicate).toEqual([1,2]);
  await unloading;
  expect(nativeEmbedding).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledTimes(1);
  await embeddingService.load();
  expect(await embeddingService.embed('same query')).toEqual([3,4]);
  expect(nativeEmbedding).toHaveBeenCalledTimes(2);
  await embeddingService.unload();
});

it('lets a fresh load wait for an idle release rather than reuse a soon-to-be-released context',async()=>{
 await embeddingService.unload();let finish!:()=>void;
 const oldRelease=jest.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
 const fresh={embedding:jest.fn().mockResolvedValue({embedding:[1,2]}),release:jest.fn().mockResolvedValue(undefined)};
 (initLlama as jest.Mock).mockResolvedValueOnce({release:oldRelease}).mockResolvedValueOnce(fresh);
 await embeddingService.load();const releasing=embeddingService.releaseIfIdle();const loading=embeddingService.load();while(!finish) await Promise.resolve();
 expect(embeddingService.isLoaded()).toBe(false);finish();await releasing;await loading;expect(await embeddingService.embed('query')).toEqual([1,2]);await embeddingService.unload();
});
it('keeps a busy embedding context resident',async()=>{
 await embeddingService.unload();let finish!:(value:any)=>void;
 (initLlama as jest.Mock).mockResolvedValue({embedding:()=>new Promise(resolve=>{finish=resolve;}),release:jest.fn()});
 await embeddingService.load();const work=embeddingService.embed('busy');while(!finish) await Promise.resolve();expect(await embeddingService.releaseIfIdle()).toBe(false);finish({embedding:[1,2]});await work;await embeddingService.unload();
});
