import React from 'react';
import {render,fireEvent} from '@testing-library/react-native';
jest.mock('../../../src/components',()=>({ChatMessage:jest.fn((props:any)=>{
  const {TouchableOpacity,Text}=require('react-native');
  return <TouchableOpacity accessibilityLabel="Copy this answer" onPress={()=>props.onCopy(props.message.content)}><Text>{props.message.content}</Text></TouchableOpacity>;
})}));
import {ChatMessage} from '../../../src/components';
import {MessageRenderer} from '../../../src/screens/ChatScreen/MessageRenderer';
import {createAssistantMessage} from '../../utils/factories';
it('keeps an unchanged row out of stream rerenders while actions use the latest committed handler',()=>{
  const oldCopy=jest.fn();const newCopy=jest.fn();
  const props={item:createAssistantMessage('Saved answer'),index:0,displayMessagesLength:3,animateLastN:0,imageModelLoaded:false,isStreaming:true,isGeneratingImage:false,showGenerationDetails:false,onCopy:oldCopy,onRetry:jest.fn(),onEdit:jest.fn(),onGenerateImage:jest.fn(),onImagePress:jest.fn()};
  (ChatMessage as jest.Mock).mockClear();
  const view=render(<MessageRenderer {...props}/>);
  view.rerender(<MessageRenderer {...props} onCopy={newCopy}/>);
  expect(ChatMessage).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByLabelText('Copy this answer'));
  expect(newCopy).toHaveBeenCalledWith('Saved answer');expect(oldCopy).not.toHaveBeenCalled();
  view.rerender(<MessageRenderer {...props} item={{...props.item,content:'Edited answer'}} onCopy={newCopy}/>);
  expect(ChatMessage).toHaveBeenCalledTimes(2);
  expect(view.getByText('Edited answer')).toBeTruthy();
});
