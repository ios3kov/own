/**
 * ImageFilterBar Component Tests
 *
 * Tests for the image model filter bar including:
 * - Platform-specific rendering (iOS vs Android)
 * - Filter selection and expansion
 * - Clear filters functionality
 * - Helper functions
 */

import React from 'react';
import { render,fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { ImageFilterBar } from '../../../src/screens/ModelsScreen/ImageFilterBar';
import { SD_VERSION_OPTIONS } from '../../../src/screens/ModelsScreen/constants';

// Mock useThemedStyles
jest.mock('../../../src/theme', () => ({
  useThemedStyles: jest.fn((createStyles) => {
    const mockColors = {
      background: '#fff',
      surface: '#f5f5f5',
      text: '#000',
      textSecondary: '#666',
      textMuted: '#999',
      border: '#ddd',
      primary: '#007AFF',
      card: '#fff',
    };
    const mockShadows = {
      small: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
      medium: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
      large: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    };
    return createStyles(mockColors, mockShadows);
  }),
}));

// Default props
const defaultProps = {
  backendFilter: 'all' as const,
  setBackendFilter: jest.fn(),
  styleFilter: 'all',
  setStyleFilter: jest.fn(),
  sdVersionFilter: 'all',
  setSdVersionFilter: jest.fn(),
  imageFilterExpanded: null,
  setImageFilterExpanded: jest.fn(),
  hasActiveImageFilters: false,
  clearImageFilters: jest.fn(),
  setUserChangedBackendFilter: jest.fn(),
};

describe('ImageFilterBar', () => {
  let originalOS: string;

  beforeEach(() => {
    jest.clearAllMocks();
    originalOS = Platform.OS;
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { get: () => originalOS, configurable: true });
  });


  describe('on iOS platform', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });
    });

    it('renders sdVersion filter pill', () => {
      const { getByText } = render(<ImageFilterBar {...defaultProps} />);
      expect(getByText(/Version/)).toBeTruthy();
    });

    it('does not render backend filter pill', () => {
      const { queryByText } = render(<ImageFilterBar {...defaultProps} />);
      expect(queryByText(/Backend/)).toBeNull();
    });

    it('does not render style filter pill', () => {
      const { queryByText } = render(<ImageFilterBar {...defaultProps} />);
      expect(queryByText(/Style/)).toBeNull();
    });

    it('shows active styling when sdVersionFilter is not "all"', () => {
      const { getByText } = render(<ImageFilterBar {...defaultProps} sdVersionFilter="sd15" />);
      expect(getByText(/SD 1.5/)).toBeTruthy();
    });

    it('toggles sdVersion filter expanded state', () => {
      const setImageFilterExpanded = jest.fn();
      const { getByText } = render(<ImageFilterBar {...defaultProps} setImageFilterExpanded={setImageFilterExpanded} />);

      fireEvent.press(getByText(/Version/));

      expect(setImageFilterExpanded).toHaveBeenCalledWith(expect.any(Function));
      const toggleFn = setImageFilterExpanded.mock.calls[0][0];
      expect(toggleFn(null)).toBe('sdVersion');
      expect(toggleFn('sdVersion')).toBeNull();
    });

    it('shows expanded sdVersion options when expanded', () => {
      const { getByText } = render(<ImageFilterBar {...defaultProps} imageFilterExpanded="sdVersion" />);

      SD_VERSION_OPTIONS.forEach(option => {
        expect(getByText(option.label)).toBeTruthy();
      });
    });

    it('does not show expanded backend options on iOS', () => {
      const { queryByText } = render(<ImageFilterBar {...defaultProps} imageFilterExpanded="backend" />);
      // Backend options should not render on iOS
      expect(queryByText('All')).toBeNull();
    });

    it('does not show expanded style options on iOS', () => {
      const { queryByText } = render(<ImageFilterBar {...defaultProps} imageFilterExpanded="style" />);
      // Style options should not render on iOS
      expect(queryByText('All Styles')).toBeNull();
    });

    it('selects sdVersion filter when chip is pressed', () => {
      const setSdVersionFilter = jest.fn();
      const setImageFilterExpanded = jest.fn();
      const { getByText } = render(
        <ImageFilterBar
          {...defaultProps}
          imageFilterExpanded="sdVersion"
          setSdVersionFilter={setSdVersionFilter}
          setImageFilterExpanded={setImageFilterExpanded}
        />
      );

      fireEvent.press(getByText('SD 1.5'));

      expect(setSdVersionFilter).toHaveBeenCalledWith('sd15');
      expect(setImageFilterExpanded).toHaveBeenCalledWith(null);
    });

    it('shows up arrow when sdVersion filter is expanded', () => {
      const { getByText } = render(<ImageFilterBar {...defaultProps} imageFilterExpanded="sdVersion" />);
      // Unicode \u25B4 = ▴ (small upward triangle)
      expect(getByText(/Version.*▴/)).toBeTruthy();
    });

    it('shows down arrow when filter is collapsed', () => {
      const { getByText } = render(<ImageFilterBar {...defaultProps} />);
      // Unicode \u25BE = ▾ (small downward triangle)
      expect(getByText(/Version.*▾/)).toBeTruthy();
    });
  });

  describe('clear filters button', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });
    });

    it('shows clear button when hasActiveImageFilters is true', () => {
      const { getByText } = render(<ImageFilterBar {...defaultProps} hasActiveImageFilters={true} />);
      expect(getByText('Clear')).toBeTruthy();
    });

    it('does not show clear button when hasActiveImageFilters is false', () => {
      const { queryByText } = render(<ImageFilterBar {...defaultProps} hasActiveImageFilters={false} />);
      expect(queryByText('Clear')).toBeNull();
    });

    it('calls clearImageFilters when clear button is pressed', () => {
      const clearImageFilters = jest.fn();
      const { getByText } = render(
        <ImageFilterBar {...defaultProps} hasActiveImageFilters={true} clearImageFilters={clearImageFilters} />
      );

      fireEvent.press(getByText('Clear'));

      expect(clearImageFilters).toHaveBeenCalledTimes(1);
    });
  });


  describe('getSdLabel helper', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });
    });

    it('returns "Version" for "all" filter', () => {
      const { getByText } = render(<ImageFilterBar {...defaultProps} sdVersionFilter="all" />);
      expect(getByText(/Version/)).toBeTruthy();
    });

    it('returns correct label for "sd15" filter', () => {
      const { getByText } = render(<ImageFilterBar {...defaultProps} sdVersionFilter="sd15" />);
      expect(getByText(/SD 1.5/)).toBeTruthy();
    });

    it('returns correct label for "sd21" filter', () => {
      const { getByText } = render(<ImageFilterBar {...defaultProps} sdVersionFilter="sd21" />);
      expect(getByText(/SD 2.1/)).toBeTruthy();
    });

    it('returns correct label for "sdxl" filter', () => {
      const { getByText } = render(<ImageFilterBar {...defaultProps} sdVersionFilter="sdxl" />);
      expect(getByText(/SDXL/)).toBeTruthy();
    });

    it('returns "Version" for unknown filter', () => {
      const { getByText } = render(<ImageFilterBar {...defaultProps} sdVersionFilter="unknown" />);
      expect(getByText(/Version/)).toBeTruthy();
    });
  });


  describe('iOS backend and style expansion', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });
    });

    it('returns null for backend expansion on iOS', () => {
      const { queryByText } = render(<ImageFilterBar {...defaultProps} imageFilterExpanded="backend" />);
      // BACKEND_OPTIONS should not appear
      expect(queryByText('All')).toBeNull();
    });

    it('returns null for style expansion on iOS', () => {
      const { queryByText } = render(<ImageFilterBar {...defaultProps} imageFilterExpanded="style" />);
      // STYLE_OPTIONS should not appear
      expect(queryByText('All Styles')).toBeNull();
    });
  });


});
