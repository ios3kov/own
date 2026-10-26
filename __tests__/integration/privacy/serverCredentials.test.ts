import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { remoteServerManager } from '../../../src/services/remoteServerManager';
import { useRemoteServerStore } from '../../../src/stores/remoteServerStore';

jest.mock('../../../src/services/providers/registry',()=>({providerRegistry:{registerProvider:jest.fn(),unregisterProvider:jest.fn()}}));
jest.mock('../../../src/services/providers/openAICompatibleProvider',()=>({createOpenAIProvider:jest.fn(()=>({dispose:jest.fn()}))}));

describe('server credentials at the real persistence boundary',()=>{
  beforeEach(()=>{jest.clearAllMocks();useRemoteServerStore.getState().clearAllServers();});
  it('stores a new key in Keychain without writing it into preferences',async()=>{
    await remoteServerManager.addServer({name:'Private test server',endpoint:'https://example.test',providerType:'openai-compatible',apiKey:'synthetic-private-key'});
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(expect.any(String),'synthetic-private-key',expect.any(Object));
    const writes=(AsyncStorage.setItem as jest.Mock).mock.calls.filter(([key])=>key==='remote-servers');
    expect(writes.length).toBeGreaterThan(0);
    expect(writes.every(([,value])=>!value.includes('synthetic-private-key'))).toBe(true);
    expect(useRemoteServerStore.getState().servers[0].apiKey).toBeUndefined();
  });
  it('never persists keys passed directly to the store',()=>{
    useRemoteServerStore.getState().addServer({name:'Test',endpoint:'https://example.test',providerType:'openai-compatible',apiKey:'synthetic-direct-key'});
    const writes=(AsyncStorage.setItem as jest.Mock).mock.calls.filter(([key])=>key==='remote-servers');
    expect(writes.every(([,value])=>!value.includes('synthetic-direct-key'))).toBe(true);
  });
});
