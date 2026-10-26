import React from 'react';
import { AppState, NativeModules } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { InstalledVoicePicker } from '../../../src/components/InstalledVoicePicker';
import { ReplySpeech } from '../../../src/services/replySpeech';
import { useAppStore } from '../../../src/stores/appStore';
import { resetStores } from '../../utils/testHelpers';
jest.mock('../../../src/components/AppSheet', () => {
  const {View} = require('react-native');
  return {AppSheet:({visible,children}:any) => visible ? <View>{children}</View> : null};
});

it('saves an installed Premium voice choice and supplies it to playback', async () => {
  resetStores(); AppState.currentState='active';
  NativeModules.OwnReplySpeech = {
    voices:jest.fn().mockResolvedValue([{id:'ava-premium',name:'Ava',language:'en-US',quality:'Premium'}]),
    setVoice:jest.fn().mockResolvedValue(null),begin:jest.fn().mockResolvedValue(null),stop:jest.fn().mockResolvedValue(null),speak:jest.fn().mockResolvedValue(null),
  };
  const view=render(<InstalledVoicePicker selectedId="" onSelect={replyVoiceId=>useAppStore.getState().updateSettings({replyVoiceId})}/>);
  fireEvent.press(view.getByLabelText('Choose reply voice'));
  await waitFor(()=>expect(view.getByLabelText('Ava, en-US, Premium')).toBeTruthy());
  fireEvent.press(view.getByLabelText('Ava, en-US, Premium'));
  expect(useAppStore.getState().settings.replyVoiceId).toBe('ava-premium');
  const speech = new ReplySpeech(); speech.begin(true);speech.update('Hello.');speech.finish();
  await waitFor(()=>expect(NativeModules.OwnReplySpeech.speak).toHaveBeenCalled());
  expect(NativeModules.OwnReplySpeech.setVoice).toHaveBeenCalledWith('ava-premium');
  await speech.stop();
});

it('shows a retryable voice-list error without changing the saved preference', async () => {
  NativeModules.OwnReplySpeech = {voices:jest.fn().mockRejectedValue(new Error('Unavailable'))};
  const onSelect=jest.fn();
  const view=render(<InstalledVoicePicker selectedId="saved" onSelect={onSelect}/>);
  fireEvent.press(view.getByLabelText('Choose reply voice'));
  await waitFor(()=>expect(view.getByText(/Could not read installed voices/)).toBeTruthy());
  expect(onSelect).not.toHaveBeenCalled();
});
