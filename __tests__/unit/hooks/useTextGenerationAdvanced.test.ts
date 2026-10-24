import { renderHook,act } from '@testing-library/react-native';
import { resetStores } from '../../utils/testHelpers';
import { useAppStore } from '../../../src/stores/appStore';
import { useTextGenerationAdvanced } from '../../../src/hooks/useTextGenerationAdvanced';

describe('useTextGenerationAdvanced', () => {
  beforeEach(() => {
    resetStores();
  });



  it('shows Auto (N) for cpu threads when nThreads uses the auto sentinel', async () => {
    act(() => {
      useAppStore.getState().updateSettings({ nThreads: 0 });
    });

    const { result } = renderHook(() => useTextGenerationAdvanced());

    await act(async () => {});

    expect(result.current.cpuThreadsDisplayValue).toMatch(/^Auto \(\d+\)$/);
    expect(result.current.cpuThreadsSliderValue).toBe(1);
  });
});
