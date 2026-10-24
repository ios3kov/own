import React from 'react';
import { Text } from 'react-native';
import { render,fireEvent } from '@testing-library/react-native';
import { AnimatedListItem } from '../../../src/components/AnimatedListItem';
it('announces an actionable row as a button and activates its actual handler',()=>{
  const press=jest.fn();const screen=render(<AnimatedListItem index={0} onPress={press}><Text>QA saved chat</Text></AnimatedListItem>);
  fireEvent.press(screen.getByRole('button',{name:'QA saved chat'}));expect(press).toHaveBeenCalledTimes(1);
});
