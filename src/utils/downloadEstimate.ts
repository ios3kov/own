export type TransferSample = {
  id: string; bytes: number; at: number; startedAt: number;
  lastProgressAt: number; rate: number | null; observations: number;
};
type Progress = { id: string; status: string; bytes: number };
const STALE_MS = 10_000;

/** Transient observations only. Never infer transfer speed from a saved byte offset. */
export function sampleTransfer(previous: TransferSample | null, progress: Progress, now: number): TransferSample | null {
  if (progress.status !== 'running' || !Number.isFinite(progress.bytes) || progress.bytes < 0) return null;
  if (!previous || previous.id !== progress.id || progress.bytes < previous.bytes || now < previous.at || now - previous.lastProgressAt > STALE_MS) {
    return { id: progress.id, bytes: progress.bytes, at: now, startedAt: now, lastProgressAt: now, rate: null, observations: 0 };
  }
  const elapsed = now - previous.at;
  if (elapsed < 250 || progress.bytes === previous.bytes) return previous;
  const instant = (progress.bytes - previous.bytes) * 1000 / elapsed;
  const weight = 1 - Math.exp(-elapsed / 4000);
  return { ...previous, bytes: progress.bytes, at: now, lastProgressAt: now,
    rate: previous.rate === null ? instant : previous.rate + weight * (instant - previous.rate),
    observations: previous.observations + 1 };
}
export type TransferEstimate = { bytesPerSecond: number; secondsRemaining: number };
export function transferEstimate(sample: TransferSample | null, total: number, now: number): TransferEstimate | null {
  if (!sample || sample.observations < 2 || now - sample.startedAt < 2000 || now < sample.at ||
      now - sample.lastProgressAt > STALE_MS || !sample.rate || !Number.isFinite(total) || total <= sample.bytes) return null;
  return { bytesPerSecond: sample.rate, secondsRemaining: (total - sample.bytes) / sample.rate };
}
export function formatTransferEstimate(estimate: TransferEstimate): string {
  const rate = estimate.bytesPerSecond >= 1e6 ? `${(estimate.bytesPerSecond / 1e6).toFixed(1)} MB/s` : `${Math.max(1, Math.round(estimate.bytesPerSecond / 1000))} kB/s`;
  const seconds = Math.max(10, Math.ceil(estimate.secondsRemaining / 10) * 10);
  const remaining = seconds < 60 ? `${seconds} sec` : seconds < 3600 ? `${Math.ceil(seconds / 60)} min` : `${Math.ceil(seconds / 3600)} hr`;
  return `${rate} · About ${remaining} left`;
}
