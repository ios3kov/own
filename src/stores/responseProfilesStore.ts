import {create} from 'zustand';
import {persist,createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {cleanResponseValues,ResponseBackend,ResponseValues} from '../utils/modelResponseSettings';
export type ResponseProfile={name:string;backend:ResponseBackend;values:ResponseValues};
function validName(value:unknown):value is string {
  return typeof value==='string'&&value.trim().length>0&&value.length<=48&&!Array.from(value).some(character=>character.charCodeAt(0)<32);
}
const backends:ResponseBackend[]=['apple','llama','litert','remote'];
interface Profiles {
  profiles:ResponseProfile[];
  active:Partial<Record<ResponseBackend,ResponseValues>>;
  select:(backend:ResponseBackend,values:ResponseValues)=>Promise<boolean>;
  save:(profile:ResponseProfile)=>Promise<boolean>;
  remove:(name:string,backend:ResponseBackend)=>Promise<boolean>;
}
export const useResponseProfilesStore=create<Profiles>()(persist((set,get)=>({
  profiles:[],active:{},
  select:async(backend,values)=>{
    const clean=cleanResponseValues(backend,values);
    if (!clean||!backends.includes(backend)) return false;
    try {await set(state=>({active:{...state.active,[backend]:clean}}));return true;} catch {return false;}
  },
  save:async profile=>{
    const values=cleanResponseValues(profile.backend,profile.values);
    if (!values||!validName(profile.name)||!backends.includes(profile.backend)) return false;
    const name=profile.name.trim();
    const other=get().profiles.filter(item=>item.name!==name||item.backend!==profile.backend);
    if (other.length>=20) return false;
    try { await set({profiles:[...other,{name,backend:profile.backend,values}]}); return true; } catch { return false; }
  },
  remove:async(name,backend)=>{
    try { await set(state=>({profiles:state.profiles.filter(profile=>profile.name!==name||profile.backend!==backend)})); return true; } catch { return false; }
  },
}),{
  name:'own-response-profiles',version:1,storage:createJSONStorage(()=>AsyncStorage),
  partialize:state=>({profiles:state.profiles,active:state.active}),
  merge:(saved,current)=>{
    const profiles:ResponseProfile[]=[];
    const stored=(saved as {profiles?:unknown})?.profiles;
    if (Array.isArray(stored)) for (const profile of stored.slice(0,20)) {
      if (!profile||!validName(profile.name)||!backends.includes(profile.backend)) continue;
      const values=cleanResponseValues(profile.backend,profile.values);
      if (profiles.some(item=>item.backend===profile.backend&&item.name===profile.name.trim())) continue;
      if (values) profiles.push({name:profile.name.trim(),backend:profile.backend,values});
    }
    const active:Profiles['active']={};
    const storedActive=(saved as {active?:Partial<Record<ResponseBackend,ResponseValues>>})?.active;
    for (const backend of backends) {
      const values=storedActive?.[backend]&&cleanResponseValues(backend,storedActive[backend]!);
      if (values) active[backend]=values;
    }
    return {...current,profiles,active};
  },
}));
