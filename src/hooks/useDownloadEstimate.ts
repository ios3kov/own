import { useEffect, useState } from 'react';
import { sampleTransfer, transferEstimate, formatTransferEstimate, TransferSample } from '../utils/downloadEstimate';

type DownloadProgress = { id: string; status: string; bytes: number; total: number };

export function useDownloadEstimate({ id, status, bytes, total }: DownloadProgress): string | null {
  const [sample, setSample] = useState<TransferSample | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const time = Date.now();
    setSample(previous => sampleTransfer(previous, { id, status, bytes }, time));
    setNow(time);
  }, [id, status, bytes]);
  useEffect(() => {
    if (status !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status]);
  if (status !== 'running' || total <= 0 || bytes >= total) return null;
  const currentSample = sample?.id === id && sample.bytes <= bytes ? sample : null;
  const estimate = transferEstimate(currentSample, total, now);
  return estimate ? formatTransferEstimate(estimate) : 'Measuring download speed…';
}
