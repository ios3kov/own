import { sampleTransfer, transferEstimate, formatTransferEstimate } from '../../../src/utils/downloadEstimate';

describe('recent transfer estimate', () => {
  it('measures a steady 1 MB/s transfer after enough observations', () => {
    let sample = sampleTransfer(null, { id: '1', status: 'running', bytes: 0 }, 0);
    sample = sampleTransfer(sample, { id: '1', status: 'running', bytes: 1_000_000 }, 1000);
    sample = sampleTransfer(sample, { id: '1', status: 'running', bytes: 3_000_000 }, 3000);
    expect(transferEstimate(sample, 10_000_000, 3000)).toEqual({ bytesPerSecond: 1_000_000, secondsRemaining: 7 });
    expect(formatTransferEstimate({ bytesPerSecond: 1_000_000, secondsRemaining: 7 })).toContain('About 10 sec left');
  });
  it('does not invent an estimate for a single update, unknown size or completed file', () => {
    const sample = sampleTransfer(null, { id: '1', status: 'running', bytes: 100 }, 1000);
    expect(transferEstimate(sample, 1000, 1000)).toBeNull();
    expect(transferEstimate(sample, 0, 1000)).toBeNull();
  });
  it('discards stale speed after ten seconds without progress', () => {
    let sample = sampleTransfer(null, { id: '1', status: 'running', bytes: 0 }, 0);
    sample = sampleTransfer(sample, { id: '1', status: 'running', bytes: 1000 }, 1000);
    sample = sampleTransfer(sample, { id: '1', status: 'running', bytes: 3000 }, 3000);
    expect(transferEstimate(sample, 10000, 14000)).toBeNull();
    sample = sampleTransfer(sample, { id: '1', status: 'running', bytes: 9000 }, 20000);
    expect(transferEstimate(sample, 10000, 20000)).toBeNull();
  });
  it.each(['retrying', 'waiting_for_network', 'processing', 'completed', 'failed'])('resets for %s', status => {
    const sample = sampleTransfer(null, { id: '1', status: 'running', bytes: 1000 }, 0);
    expect(sampleTransfer(sample, { id: '1', status, bytes: 1000 }, 3000)).toBeNull();
  });
  it('starts fresh for a replacement task, byte rollback and clock rollback', () => {
    const sample = sampleTransfer(null, { id: '1', status: 'running', bytes: 1000 }, 1000);
    for (const [id, bytes, now] of [['2', 4000, 3000], ['1', 100, 3000], ['1', 2000, 100]] as const) {
      expect(transferEstimate(sampleTransfer(sample, { id, status: 'running', bytes }, now), 10000, now)).toBeNull();
    }
  });
});
