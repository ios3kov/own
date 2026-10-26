import React from 'react';
import { Image } from 'react-native';
import { render } from '@testing-library/react-native';
import { GalleryGridItem } from '../../../src/screens/GalleryScreen/GridItem';
import { FullscreenViewer } from '../../../src/screens/GalleryScreen/FullscreenViewer';
import { createGeneratedImage } from '../../utils/factories';

jest.mock('../../../src/components/AnimatedEntry', () => ({AnimatedEntry: ({children}:any) => children}));

it('opens the same relocated file in the grid and full-screen viewer, preserving the saved record', () => {
  const image = createGeneratedImage({imagePath:'/var/mobile/Containers/Data/Application/11111111-1111-1111-1111-111111111111/Documents/generated_images/old.png'});
  const original = JSON.stringify(image);
  const grid = render(<GalleryGridItem item={image} index={0} isSelectMode={false} isSelected={false} onPress={jest.fn()} onLongPress={jest.fn()} />);
  expect(grid.UNSAFE_getByType(Image).props.source.uri).toBe('file:///mock/documents/generated_images/old.png');
  const viewer = render(<FullscreenViewer image={image} showDetails={false} onClose={jest.fn()} onToggleDetails={jest.fn()} onSave={jest.fn()} onDelete={jest.fn()} />);
  expect(viewer.UNSAFE_getAllByType(Image).every(node => node.props.source.uri === 'file:///mock/documents/generated_images/old.png')).toBe(true);
  expect(JSON.stringify(image)).toBe(original);
});
