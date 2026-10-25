import React from 'react';
import { render,act } from '@testing-library/react-native';
import { ImageProgressIndicator } from '../../../src/screens/ChatScreen/ChatScreenComponents';
import { useModelLoadStore,beginModelLoad,reportModelLoad,finishModelLoad } from '../../../src/stores/modelLoadStore';

afterEach(() => useModelLoadStore.setState({active:false,type:null,percent:null}));

it('shows actual model-loading phases in chat, then switches to image steps', () => {
  const view=render(<ImageProgressIndicator styles={{} as any} colors={{primary:'#000',error:'#f00'} as any}
    imagePreviewPath={null} imageGenerationStatus="Loading SDXL..." imageGenerationProgress={{step:0,totalSteps:20}} onStop={jest.fn()} />);
  let ticket=0;
  act(()=>{ticket=beginModelLoad('image');reportModelLoad(ticket,'Preparing CoreML components');});
  expect(view.getByText('Preparing CoreML components')).toBeTruthy();
  expect(view.getByTestId('model-load-progress')).toBeTruthy();
  expect(view.queryByText('0/20')).toBeNull();
  expect(view.queryByText(/This stage does not report a percentage/)).toBeNull();
  act(()=>finishModelLoad(ticket));
  expect(view.queryByTestId('model-load-progress')).toBeNull();
  expect(view.getByText('0/20')).toBeTruthy();
});
