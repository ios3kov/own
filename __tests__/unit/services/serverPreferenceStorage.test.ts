import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { serverPreferenceStorage,withoutServerKeys } from '../../../src/services/serverPreferenceStorage';

const raw=JSON.stringify({state:{servers:[{id:'one',name:'Test',apiKey:'synthetic-old-key'}]},version:0});
describe('safe legacy server credential migration',()=>{
  beforeEach(()=>{(Keychain.getGenericPassword as jest.Mock).mockResolvedValue(false);(Keychain.setGenericPassword as jest.Mock).mockResolvedValue(true);});
  it('moves a legacy key before replacing preferences with metadata',async()=>{
    await AsyncStorage.setItem('legacy',raw);
    const cleaned=await serverPreferenceStorage.getItem('legacy');
    expect(cleaned).not.toContain('synthetic-old-key');
    expect(await AsyncStorage.getItem('legacy')).toBe(cleaned);
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith('server_one','synthetic-old-key',expect.objectContaining({service:'io.github.ios3kov.own.servers.one'}));
  });
  it('keeps the original preferences untouched when secure storage refuses a write',async()=>{
    await AsyncStorage.setItem('legacy',raw);
    (Keychain.setGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    await expect(serverPreferenceStorage.getItem('legacy')).rejects.toThrow('Secure credential');
    expect(await AsyncStorage.getItem('legacy')).toBe(raw);
  });
  it('preserves a newer Keychain key instead of replacing it with an old preference',async()=>{
    await AsyncStorage.setItem('legacy',raw);
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({username:'server_one',password:'new-key'});
    expect(await serverPreferenceStorage.getItem('legacy')).not.toContain('synthetic-old-key');
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  });
  it('does not erase corrupt JSON or a credential with no server identity',async()=>{
    for (const value of ['broken',JSON.stringify({state:{servers:[{apiKey:'synthetic-old-key'}]}})]) {
      await AsyncStorage.setItem('legacy',value);
      await expect(serverPreferenceStorage.getItem('legacy')).rejects.toThrow();
      expect(await AsyncStorage.getItem('legacy')).toBe(value);
    }
  });
  it('preserves old data when saving cleaned metadata fails, and permits a later retry',async()=>{
    await AsyncStorage.setItem('legacy',raw);
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Disk full'));
    await expect(serverPreferenceStorage.getItem('legacy')).rejects.toThrow('Disk full');
    expect(await AsyncStorage.getItem('legacy')).toBe(raw);
    expect(await serverPreferenceStorage.getItem('legacy')).not.toContain('synthetic-old-key');
  });
  it('handles empty records and strips empty keys without changing metadata',async()=>{
    expect(await serverPreferenceStorage.getItem('missing')).toBeNull();
    expect(withoutServerKeys({servers:null})).toEqual({servers:null});
    expect(withoutServerKeys({servers:[null,3,{id:'one',apiKey:'',name:'A'}]})).toEqual({servers:[null,3,{id:'one',name:'A'}]});
    await serverPreferenceStorage.setItem('legacy',JSON.stringify({state:{servers:[{id:'one',apiKey:'synthetic-direct-key'}]}}));
    expect(await AsyncStorage.getItem('legacy')).not.toContain('synthetic-direct-key');
    await serverPreferenceStorage.removeItem('legacy');expect(await AsyncStorage.getItem('legacy')).toBeNull();
  });
});
