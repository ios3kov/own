import React from 'react';
import {render,fireEvent,act} from '@testing-library/react-native';
import {ImagePreviewSetting,AppleReadySetting} from '../../../src/components/ModelResourceOptions';
import {installAppleSessionPolicy} from '../../../src/hooks/useAppleSessionPolicy';
import {useAppStore} from '../../../src/stores/appStore';
import {useChatStore} from '../../../src/stores/chatStore';
import {foundationModelService,useFoundationStore,APPLE_MODEL_ID} from '../../../src/services/foundationModels';
import {resetStores} from '../../utils/testHelpers';

beforeEach(()=>{resetStores();useFoundationStore.setState({availability:{available:true,reason:'available',sessionReuseSupported:true}});});
afterEach(()=>jest.restoreAllMocks());
it('keeps live drafts off by default, then applies an explicit user choice without editing chats',()=>{
 const before=JSON.stringify(useChatStore.getState().conversations);
 const models=JSON.stringify(useAppStore.getState().downloadedImageModels);
 const screen=render(<ImagePreviewSetting/>);
 const control=screen.getByRole('switch',{name:'Live image preview'});
 expect(control.props.value).toBe(false);
 fireEvent(control,'valueChange',true);
 expect(useAppStore.getState().settings.imagePreviewEnabled).toBe(true);
 expect(JSON.stringify(useChatStore.getState().conversations)).toBe(before);
 expect(JSON.stringify(useAppStore.getState().downloadedImageModels)).toBe(models);
});
it('shows Apple retention only for the supported current model and tools-off mode',()=>{
 useAppStore.setState({activeModelId:APPLE_MODEL_ID});
 useAppStore.getState().updateSettings({enabledTools:[]});
 const screen=render(<AppleReadySetting/>);
 fireEvent(screen.getByRole('switch',{name:'Keep Apple chat ready'}),'valueChange',true);
 expect(useAppStore.getState().settings.appleSessionReuseEnabled).toBe(true);
 act(()=>useFoundationStore.setState({availability:{available:true,reason:'available',sessionReuseSupported:false}}));
 expect(screen.queryByRole('switch',{name:'Keep Apple chat ready'})).toBeNull();
});
it('does not allow enabling session reuse while tools are enabled',()=>{
 useAppStore.setState({activeModelId:APPLE_MODEL_ID});
 useAppStore.getState().updateSettings({enabledTools:['calculator']});
 const screen=render(<AppleReadySetting/>);
 expect(screen.getByRole('switch',{name:'Keep Apple chat ready'})).toBeDisabled();
});
it('releases runtime cache on preference-off or model switch without cancelling replies or changing data',async()=>{
 useAppStore.setState({activeModelId:APPLE_MODEL_ID});
 const release=jest.spyOn(foundationModelService,'releaseSessionCache').mockResolvedValue(undefined);
 const stop=jest.spyOn(foundationModelService,'stopGeneration').mockResolvedValue(undefined);
 const before=JSON.stringify(useChatStore.getState().conversations);
 const records=JSON.stringify(useAppStore.getState().downloadedModels);
 const dispose=installAppleSessionPolicy();
 act(()=>useAppStore.getState().updateSettings({appleSessionReuseEnabled:true}));
 expect(release).not.toHaveBeenCalled();
 act(()=>useAppStore.getState().updateSettings({appleSessionReuseEnabled:false}));
 expect(release).toHaveBeenCalledTimes(1);
 act(()=>useAppStore.getState().setActiveModelId('other'));
 expect(release).toHaveBeenCalledTimes(2);
 expect(stop).not.toHaveBeenCalled();
 expect(JSON.stringify(useChatStore.getState().conversations)).toBe(before);
 expect(JSON.stringify(useAppStore.getState().downloadedModels)).toBe(records);
 dispose();
 expect(release).toHaveBeenCalledTimes(3);
});
