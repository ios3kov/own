import { runImageFinalization, isImageFinalizing } from '../../../../src/screens/ModelsScreen/imageFinalization';
it('gives live completion and recovery a single shared owner',async()=>{
 let finish!:()=>void;const work=jest.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));const duplicate=jest.fn();
 const first=runImageFinalization('synthetic',work),second=runImageFinalization('synthetic',duplicate);
 expect(first).toBe(second);expect(isImageFinalizing('synthetic')).toBe(true);
 await Promise.resolve();expect(work).toHaveBeenCalledTimes(1);expect(duplicate).not.toHaveBeenCalled();
 finish();await first;expect(isImageFinalizing('synthetic')).toBe(false);
});
it('releases failed jobs for retry without blocking other models',async()=>{
 const a=runImageFinalization('failed',async()=>{throw new Error('disk error');});
 const b=runImageFinalization('other',async()=>{});
 await expect(a).rejects.toThrow('disk error');await b;
 await expect(runImageFinalization('failed',async()=>{})).resolves.toBeUndefined();
});
