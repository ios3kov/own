import React from 'react';
import { render,fireEvent,act } from '@testing-library/react-native';
import { cancelAnimation,useReducedMotion,withRepeat } from 'react-native-reanimated';
import { ModelLoadProgress } from '../../../src/components/ModelLoadProgress';
import { useModelLoadStore,beginModelLoad,reportModelLoad } from '../../../src/stores/modelLoadStore';

beforeEach(()=>{
  jest.clearAllMocks();
  (useReducedMotion as jest.Mock).mockReturnValue(false);
  useModelLoadStore.setState({active:false,type:null,percent:null});
});
afterEach(()=>useModelLoadStore.setState({active:false,type:null,percent:null}));

it('runs an unknown-progress sweep after layout and cancels it when hidden',()=>{
  beginModelLoad('image');
  const view=render(<ModelLoadProgress />);
  fireEvent(view.getByTestId('model-load-track'),'layout',{nativeEvent:{layout:{width:240,height:4}}});
  expect(withRepeat).toHaveBeenCalledWith(1,-1,false);
  expect(view.getByRole('progressbar').props.accessibilityValue).toEqual({text:'Checking model files'});
  expect(view.queryByText(/Large models/)).toBeNull();
  jest.clearAllMocks();
  act(()=>useModelLoadStore.setState({active:false}));
  expect(cancelAnimation).toHaveBeenCalled();
  expect(view.queryByTestId('model-load-progress')).toBeNull();
});

it('shows only real percentages and respects reduced motion',()=>{
  (useReducedMotion as jest.Mock).mockReturnValue(true);
  const ticket=beginModelLoad('text');
  const view=render(<ModelLoadProgress />);
  fireEvent(view.getByTestId('model-load-track'),'layout',{nativeEvent:{layout:{width:240,height:4}}});
  expect(withRepeat).not.toHaveBeenCalled();
  act(()=>reportModelLoad(ticket,'Loading weights',46));
  expect(view.getByText('46%')).toBeTruthy();
  expect(view.getByRole('progressbar').props.accessibilityValue).toEqual({min:0,max:100,now:46});
});
