import React from 'react';
import {render,act} from '@testing-library/react-native';
import {ChatScreenContext} from '../../../src/components/ChatScreenContext';
import {beginContextUsage,measureLocalContext,useContextUsage} from '../../../src/services/contextUsage';
import {useChatStore} from '../../../src/stores/chatStore';
describe('context measurement to visible chat indicator',()=>{
  beforeEach(()=>{useContextUsage.setState({latest:null});useChatStore.setState({streamingForConversationId:'one'});});
  it('shows only this chat and marks unavailable counters honestly',async()=>{
    const screen=render(<ChatScreenContext conversationId="one"/>);
    act(()=>{beginContextUsage('one');});
    expect(screen.getByText(/context size is unavailable/)).toBeTruthy();
    const context:any={getFormattedChat:async()=>({prompt:'actual prompt'}),tokenize:async()=>({tokens:[1,2]})};
    await act(async()=>{await measureLocalContext(context,{messages:[],n_predict:8},20);});
    expect(screen.getByText(/about 50%/)).toBeTruthy();
    screen.rerender(<ChatScreenContext conversationId="another"/>);
    expect(screen.queryByText(/Latest request/)).toBeNull();
  });
});
