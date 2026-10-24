/**
 * DocumentPreviewScreen Tests
 */

import React from 'react';
import { render,act,fireEvent } from '@testing-library/react-native';
import RNFS from 'react-native-fs';

const mockGoBack = jest.fn();
let mockFilePath = '/mock/documents/test.txt';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      goBack: mockGoBack,
      setOptions: jest.fn(),
    }),
    useRoute: () => ({
      params: { filePath: mockFilePath, fileName: 'test.txt', fileSize: 1024 },
    }),
  };
});

const mockProcessDocument = jest.fn();

jest.mock('../../../src/services', () => ({
  documentService: {
    processDocumentFromPath: (...args: any[]) => mockProcessDocument(...args),
  },
}));

const flushPromises = () => act(async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
});

jest.mock('react-native-vector-icons/Feather', () => {
  const { Text } = require('react-native');
  return ({ name }: any) => <Text>{name}</Text>;
});

import { DocumentPreviewScreen } from '../../../src/screens/DocumentPreviewScreen';

describe('DocumentPreviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFilePath = '/mock/documents/test.txt';
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    mockProcessDocument.mockResolvedValue({ textContent: 'Hello world content' });
  });

  describe('basic rendering', () => {
    it('shows the file name in header', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      const { getByText } = render(<DocumentPreviewScreen />);
      await flushPromises();
      expect(getByText('test.txt')).toBeTruthy();
    });

    it('shows file size in header when > 0', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      const { getByText } = render(<DocumentPreviewScreen />);
      await flushPromises();
      expect(getByText('1.0 KB')).toBeTruthy();
    });

    it('shows loading indicator initially', () => {
      const { UNSAFE_getByType } = render(<DocumentPreviewScreen />);
      const { ActivityIndicator } = require('react-native');
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });
  });

  describe('content loading', () => {
    it('shows content when file exists and text extracted', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      mockProcessDocument.mockResolvedValue({ textContent: 'Hello world content' });
      const { getByText } = render(<DocumentPreviewScreen />);
      await flushPromises();
      expect(getByText('Hello world content')).toBeTruthy();
    });

    it('shows error when file not found in any location', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(false);
      const { getByText } = render(<DocumentPreviewScreen />);
      await flushPromises();
      expect(getByText(/File not found/)).toBeTruthy();
    });

    it('shows error when processDocument returns no text content', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      mockProcessDocument.mockResolvedValue({ textContent: null });
      const { getByText } = render(<DocumentPreviewScreen />);
      await flushPromises();
      expect(getByText('Could not extract text from this document')).toBeTruthy();
    });

    it('shows error when processDocument returns null', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      mockProcessDocument.mockResolvedValue(null);
      const { getByText } = render(<DocumentPreviewScreen />);
      await flushPromises();
      expect(getByText('Could not extract text from this document')).toBeTruthy();
    });

    it('shows error message when loadContent throws', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      mockProcessDocument.mockRejectedValue(new Error('Read failed'));
      const { getByText } = render(<DocumentPreviewScreen />);
      await flushPromises();
      expect(getByText('Read failed')).toBeTruthy();
    });
  });

  describe('exact document resolution', () => {
    it('rebases a moved sandbox without guessing the filename', async () => {
      mockFilePath = 'file:///var/mobile/Containers/Data/Application/11111111-1111-1111-1111-111111111111/Documents/Inbox/My%20notes.txt';
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      render(<DocumentPreviewScreen />);
      await flushPromises();
      expect(mockProcessDocument).toHaveBeenCalledWith('/mock/documents/Inbox/My notes.txt', 'test.txt');
    });
    it('never substitutes an unrelated file with the same filename', async () => {
      mockFilePath = '/missing/original.txt';
      (RNFS.exists as jest.Mock).mockImplementation(path => Promise.resolve(path === '/mock/documents/test.txt'));
      const {getByText} = render(<DocumentPreviewScreen />);
      await flushPromises();
      expect(getByText(/File not found/)).toBeTruthy();
      expect(RNFS.exists).toHaveBeenCalledTimes(1);
      expect(mockProcessDocument).not.toHaveBeenCalled();
    });
    it('rejects traversal before passing a target to native code', async () => {
      mockFilePath = 'file:///mock/documents/%2e%2e/other.txt';
      const {getByText} = render(<DocumentPreviewScreen />);
      await flushPromises();
      expect(getByText(/cannot be opened/)).toBeTruthy();
      expect(RNFS.exists).not.toHaveBeenCalled();
      expect(mockProcessDocument).not.toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    it('calls goBack when back button pressed', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      const { getByText } = render(<DocumentPreviewScreen />);
      await flushPromises();
      fireEvent.press(getByText('arrow-left'));
      expect(mockGoBack).toHaveBeenCalled();
    });
  });
});
