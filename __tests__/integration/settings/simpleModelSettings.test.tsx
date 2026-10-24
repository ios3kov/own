import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { ModelSettingsScreen } from '../../../src/screens/ModelSettingsScreen';
import React from 'react';
import { render,fireEvent,act,waitFor } from '@testing-library/react-native';
import { SimpleModelSettings } from '../../../src/components/SimpleModelSettings';
import { useAppStore } from '../../../src/stores/appStore';
import { useRemoteServerStore } from '../../../src/stores/remoteServerStore';
import { useResponseProfilesStore } from '../../../src/stores/responseProfilesStore';
import { APPLE_MODEL_ID } from '../../../src/services/foundationModels';
import { generationService } from '../../../src/services/generationService';
import { llmService } from '../../../src/services/llm';
import { resetStores,setupWithActiveModel,setupWithConversation } from '../../utils/testHelpers';

jest.mock('../../../src/services/llm');
describe('understandable model settings to real generation state',()=>{
  beforeEach(()=>{resetStores();jest.clearAllMocks();useResponseProfilesStore.setState({profiles:[],active:{}});useAppStore.getState().setActiveModelId(APPLE_MODEL_ID);});
  it('changes supported Apple controls, saves a custom profile, restores it and resets in one action',async()=>{
    const screen=render(<SimpleModelSettings/>);
    fireEvent.press(screen.getByText('Short'));fireEvent.press(screen.getByText('Varied'));fireEvent.press(screen.getByText('Less'));
    expect(useAppStore.getState().settings).toEqual(expect.objectContaining({maxTokens:256,temperature:1.1,historyTurns:4,allowAppleSpeech:false,readRepliesAloud:false}));
    fireEvent.changeText(screen.getByLabelText('Profile name'),'My answers');fireEvent.press(screen.getByText('Save response profile'));
    await waitFor(()=>expect(screen.getByText('Profile saved on this device.')).toBeTruthy());
    fireEvent.press(screen.getByText('Reset answer settings'));expect(useAppStore.getState().settings.maxTokens).toBe(1024);
    fireEvent.press(screen.getByText('My answers'));await waitFor(()=>expect(useAppStore.getState().settings.maxTokens).toBe(256));
    fireEvent.press(screen.getByText('Long'));
    fireEvent.press(screen.getByText('Reset answer settings'));
    expect(useAppStore.getState().settings.maxTokens).toBe(256);
    screen.unmount();
    const reopened=render(<SimpleModelSettings/>);
    fireEvent.press(reopened.getByText('Long'));
    fireEvent.press(reopened.getByText('Reset answer settings'));
    expect(useAppStore.getState().settings.maxTokens).toBe(256);
    fireEvent.press(reopened.getByText('Technical settings'));expect(reopened.getByLabelText('Temperature')).toBeTruthy();
    expect(reopened.queryByText('CPU Threads')).toBeNull();expect(reopened.queryByText('Top P')).toBeNull();
  });
  it('wires the real settings screen to model-specific controls',()=>{
    const screen=render(<NavigationContainer><ModelSettingsScreen/></NavigationContainer>);
    fireEvent.press(screen.getByTestId('text-generation-accordion'));
    fireEvent.press(screen.getByText('Short'));
    expect(useAppStore.getState().settings.maxTokens).toBe(256);
    fireEvent.press(screen.getByText('Technical settings'));
    expect(screen.getByLabelText('Maximum response tokens')).toBeTruthy();
    expect(screen.queryByText('CPU Threads')).toBeNull();
  });
  it('keeps a failed save visible instead of claiming success',async()=>{
    const screen=render(<SimpleModelSettings/>);
    fireEvent.changeText(screen.getByLabelText('Profile name'),'Not saved');
    const failure=jest.spyOn(AsyncStorage,'setItem').mockRejectedValueOnce(new Error('Storage unavailable'));
    fireEvent.press(screen.getByText('Save response profile'));
    await waitFor(()=>expect(screen.getByText(/Could not save the change/)).toBeTruthy());
    expect(screen.queryByText('Profile saved on this device.')).toBeNull();
    failure.mockRestore();
  });
  it('hides unsupported remote controls while keeping history usable',()=>{
    useAppStore.getState().setActiveModelId(null);useRemoteServerStore.setState({activeServerId:'server'});
    const screen=render(<SimpleModelSettings/>);
    expect(screen.queryByText('Answer length')).toBeNull();expect(screen.queryByText('Wording variety')).toBeNull();
    expect(screen.queryByText('Technical settings')).toBeNull();
    fireEvent.press(screen.getByText('Less'));expect(useAppStore.getState().settings.historyTurns).toBe(4);
  });
  it('sends only the selected recent exchanges without deleting the stored messages',async()=>{
    setupWithActiveModel();const id=setupWithConversation();
    const {useChatStore}=require('../../../src/stores/chatStore');
    for(let i=0;i<8;i+=1){useChatStore.getState().addMessage(id,{role:'user',content:`Question ${i}`});useChatStore.getState().addMessage(id,{role:'assistant',content:`Answer ${i}`});}
    const screen=render(<SimpleModelSettings/>);fireEvent.press(screen.getByText('Less'));
    (llmService.isModelLoaded as jest.Mock).mockReturnValue(true);(llmService.isCurrentlyGenerating as jest.Mock).mockReturnValue(false);
    (llmService.getGpuInfo as jest.Mock).mockReturnValue({gpu:false});(llmService.getPerformanceStats as jest.Mock).mockReturnValue({});
    (llmService.generateResponse as jest.Mock).mockImplementation(async(_messages,onToken,onDone)=>{onToken('New answer.');onDone();});
    const before=useChatStore.getState().conversations.find((c:any)=>c.id===id).messages;
    await act(async()=>{await generationService.generateResponse(id,before);});
    const sent=(llmService.generateResponse as jest.Mock).mock.calls[0][0];
    expect(sent.filter((m:any)=>m.role==='user').map((m:any)=>m.content)).toEqual(['Question 4','Question 5','Question 6','Question 7']);
    expect(useChatStore.getState().conversations.find((c:any)=>c.id===id).messages).toHaveLength(before.length+1);
  });
});
