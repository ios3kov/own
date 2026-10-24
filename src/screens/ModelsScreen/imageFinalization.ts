// Live completion and recovery can observe the same processing transition.
// One owner must finish/unpack/register a model at a time.
const jobs = new Map<string, Promise<void>>();
export function isImageFinalizing(modelId: string): boolean { return jobs.has(modelId); }
export function runImageFinalization(modelId: string, work: () => Promise<void>): Promise<void> {
  const existing = jobs.get(modelId);
  if (existing) return existing;
  const operation = Promise.resolve().then(work).finally(() => {
    if (jobs.get(modelId) === operation) jobs.delete(modelId);
  });
  jobs.set(modelId, operation);
  return operation;
}
