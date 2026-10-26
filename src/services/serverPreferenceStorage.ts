import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { create } from 'zustand';

export const useServerStorageStatus=create<{failed:boolean}>(()=>({failed:false}));
export function withoutServerKeys<T extends {servers?:unknown}>(state:T):T {
  if (!Array.isArray(state.servers)) return state;
  return {...state,servers:state.servers.map(server=>{
    if (!server||typeof server!=='object') return server;
    const {apiKey:_secret,...metadata}=server;
    return metadata;
  })};
}
/** Upgrade old preferences only after every credential is safely stored. Never reset on failure. */
export const serverPreferenceStorage={
  getItem:async(name:string)=>{
    const raw=await AsyncStorage.getItem(name);
    if (!raw) return raw;
    const value=JSON.parse(raw);
    if (Array.isArray(value?.state?.servers)) {
      let changed=false;
      for (const server of value.state.servers) {
        if (!server||typeof server.apiKey!=='string'||!server.apiKey) continue;
        if (typeof server.id!=='string'||!server.id) throw new Error('Invalid saved server credential');
        const service=`io.github.ios3kov.own.servers.${server.id}`;
        const current=await Keychain.getGenericPassword({service});
        if (!current) {
          const saved=await Keychain.setGenericPassword(`server_${server.id}`,server.apiKey,{service,accessible:Keychain.ACCESSIBLE.WHEN_UNLOCKED});
          if (!saved) throw new Error('Secure credential storage unavailable');
        }
        changed=true;
      }
      value.state=withoutServerKeys(value.state);
      if (changed) {
        const cleaned=JSON.stringify(value);
        await AsyncStorage.setItem(name,cleaned);
        return cleaned;
      }
    }
    return JSON.stringify(value);
  },
  setItem:(name:string,value:string)=>{
    const parsed=JSON.parse(value);
    return AsyncStorage.setItem(name,JSON.stringify({...parsed,state:withoutServerKeys(parsed.state)}));
  },
  removeItem:(name:string)=>AsyncStorage.removeItem(name),
};
