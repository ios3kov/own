import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../../../src/stores/appStore';
import { useChatStore } from '../../../src/stores/chatStore';
import { resetStores, setupWithConversation } from '../../utils/testHelpers';
it('preserves memory mode, existing chats and model records while adding default voice preferences',async()=>{
  resetStores();
  setupWithConversation();
  const chats=useChatStore.getState().conversations;
  const models='[{"id":"already-downloaded","filePath":"/kept-model.gguf"}]';
  await AsyncStorage.setItem('@local_llm/downloaded_models',models);
  await AsyncStorage.setItem('local-llm-app-storage',JSON.stringify({version:0,state:{settings:{modelLoadingStrategy:'memory'}}}));
  await useAppStore.persist.rehydrate();
  expect(useAppStore.getState().settings.modelLoadingStrategy).toBe('memory');
  expect(useAppStore.getState().settings.replyVoiceId).toBe('');
  expect(useChatStore.getState().conversations).toEqual(chats);
  expect(await AsyncStorage.getItem('@local_llm/downloaded_models')).toBe(models);
});
