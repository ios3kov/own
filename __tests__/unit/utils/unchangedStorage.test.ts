import { skipUnchangedStorage } from '../../../src/utils/unchangedStorage';

describe('unchanged persisted slice', () => {
  it('skips repeated references but writes new snapshots and permits retry after failure', async () => {
    const base = { getItem: jest.fn(), removeItem: jest.fn(), setItem: jest.fn().mockResolvedValue(undefined) };
    const storage = skipUnchangedStorage<{ items: string[] }>(base, (a, b) => a.items === b.items);
    const items = ['saved'];
    await storage.setItem('history', {state:{items},version:0});
    for (let i = 0; i < 20; i++) await storage.setItem('history', {state:{items},version:0});
    expect(base.setItem).toHaveBeenCalledTimes(1);
    const next = {state:{items:['finished']},version:0};
    base.setItem.mockRejectedValueOnce(new Error('disk'));
    await expect(storage.setItem('history', next)).rejects.toThrow('disk');
    await storage.setItem('history', next);
    expect(base.setItem).toHaveBeenCalledTimes(3);
    await storage.removeItem('history');
    await storage.setItem('history', next);
    expect(base.setItem).toHaveBeenCalledTimes(4);
  });
});
