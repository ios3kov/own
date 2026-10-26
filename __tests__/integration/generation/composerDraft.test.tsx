import React from 'react';
import {render,fireEvent} from '@testing-library/react-native';
import {ChatInput} from '../../../src/components/ChatInput';
import {useChatStore} from '../../../src/stores/chatStore';
import {resetStores,setupWithConversation} from '../../utils/testHelpers';

jest.mock('../../../src/components/ChatInput/Voice',()=>({useVoiceInput:()=>({isRecording:false,isModelLoading:false,isTranscribing:false,partialResult:'',error:null,voiceAvailable:false,startRecording:jest.fn(),stopRecording:jest.fn(),clearResult:jest.fn()})}));

describe('composer draft and chat persistence',()=>{
 it('keeps a typed draft through chat options and saves it only when sent',()=>{
  resetStores();const id=setupWithConversation();
  const before=useChatStore.getState().conversations.find(c=>c.id===id)!.messages.length;
  const ui=render(<ChatInput onSend={content=>{useChatStore.getState().addMessage(id,{role:'user',content});}}/>);
  fireEvent.changeText(ui.getByTestId('chat-input'),'Synthetic draft for QA');
  fireEvent.press(ui.getByLabelText('Chat options'));
  expect(ui.getByTestId('chat-input').props.value).toBe('Synthetic draft for QA');
  fireEvent.press(ui.getByTestId('quick-settings-close'));
  fireEvent.press(ui.getByLabelText('Send message'));
  const messages=useChatStore.getState().conversations.find(c=>c.id===id)!.messages;
  expect(messages).toHaveLength(before+1);
  expect(messages.at(-1)?.content).toBe('Synthetic draft for QA');
  expect(ui.getByTestId('chat-input').props.value).toBe('');
 });
});
