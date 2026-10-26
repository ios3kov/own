import React from 'react';
import { render } from '@testing-library/react-native';
import { Button } from '../../../src/components/Button';

it('exposes its button role and disabled/busy state to native accessibility', () => {
  const screen = render(<Button title="Check again" onPress={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy();
  screen.rerender(<Button title="Check again" onPress={jest.fn()} loading />);
  expect(screen.getByRole('button').props.accessibilityState).toEqual(expect.objectContaining({ disabled: true, busy: true, selected: false }));
  screen.rerender(<Button title="Selected choice" onPress={jest.fn()} active />);
  expect(screen.getByRole('button', {name:'Selected choice', selected:true})).toBeTruthy();
});
