import type {Message} from '../types';
export type ResponseBackend='apple'|'llama'|'litert'|'remote'|'none';
export type ResponseValues={historyTurns:number; temperature?:number; maxTokens?:number; topP?:number; repeatPenalty?:number; contextLength?:number; liteRTTemperature?:number; liteRTTopP?:number; liteRTMaxTokens?:number};
export const RESPONSE_CAPABILITIES={
  apple:{length:true,variety:true,advanced:true}, llama:{length:true,variety:true,advanced:true},
  litert:{length:false,variety:true,advanced:true}, remote:{length:false,variety:false,advanced:false}, none:{length:false,variety:false,advanced:false},
};
const keys:Record<ResponseBackend,(keyof ResponseValues)[]>={
  apple:['historyTurns','temperature','maxTokens'],
  llama:['historyTurns','temperature','maxTokens','topP','repeatPenalty','contextLength'],
  litert:['historyTurns','liteRTTemperature','liteRTTopP','liteRTMaxTokens'], remote:['historyTurns'],none:['historyTurns'],
};
export function responseDefaults(backend:ResponseBackend):ResponseValues {
  const all={historyTurns:24,temperature:0.7,maxTokens:1024,topP:0.9,repeatPenalty:1.1,contextLength:4096,liteRTTemperature:0.7,liteRTTopP:0.9,liteRTMaxTokens:4096};
  return Object.fromEntries(keys[backend].map(key=>[key,all[key]])) as ResponseValues;
}
const ranges:Record<keyof ResponseValues,[number,number,boolean]>={
  historyTurns:[1,32,true],temperature:[0,2,false],maxTokens:[1,32768,true],topP:[0,1,false],
  repeatPenalty:[0.5,2,false],contextLength:[512,131072,true],liteRTTemperature:[0,2,false],liteRTTopP:[0,1,false],liteRTMaxTokens:[512,131072,true],
};
export function cleanResponseValues(backend:ResponseBackend,input:unknown):ResponseValues|null {
  if (!Object.prototype.hasOwnProperty.call(keys,backend)||!input||typeof input!=='object') return null;
  const result:Record<string,number>={};
  for (const key of keys[backend]) {
    const value=(input as Record<string,unknown>)[key];
    if (value === undefined) continue;
    const [min,max,integer]=key==='maxTokens'&&backend==='apple'?[1,2048,true]:ranges[key];
    if (typeof value!=='number'||!Number.isFinite(value)||value<min||value>max) return null;
    if (integer&&!Number.isSafeInteger(value)) return null;
    result[key]=value;
  }
  return typeof result.historyTurns==='number'?result as ResponseValues:null;
}
export function responseSnapshot(backend:ResponseBackend,settings:Record<string,unknown>):ResponseValues {
  const defaults=responseDefaults(backend);
  const picked=Object.fromEntries(keys[backend].map(key=>[key,settings[key]??defaults[key]]));
  if (backend==='apple'&&typeof picked.maxTokens==='number') picked.maxTokens=Math.min(picked.maxTokens,2048);
  return cleanResponseValues(backend,picked)||defaults;
}
export function builtInResponses(backend:ResponseBackend):{name:string;values:ResponseValues}[] {
  return [{name:'Quick',temperature:0.2,maxTokens:256,historyTurns:4},{name:'Everyday',temperature:0.7,maxTokens:1024,historyTurns:12},{name:'Detailed',temperature:0.5,maxTokens:2048,historyTurns:24}].map(profile=>({
    name:!RESPONSE_CAPABILITIES[backend].length&&profile.name==='Detailed'?'More history':profile.name,values:{...responseDefaults(backend),historyTurns:profile.historyTurns,
      ...(RESPONSE_CAPABILITIES[backend].length?{maxTokens:profile.maxTokens}:{}),
      ...(backend==='litert'?{liteRTTemperature:profile.temperature}:RESPONSE_CAPABILITIES[backend].variety?{temperature:profile.temperature}:{}),
    },
  }));
}
/** Keep whole recent exchanges. This never deletes saved messages. */
export function limitChatHistory(messages:Message[],turns:number):Message[] {
  const limit=Number.isSafeInteger(turns)&&turns>0?Math.min(turns,32):24;
  const users=messages.map((message,index)=>message.role==='user'?index:-1).filter(index=>index>=0);
  if (users.length<=limit) return messages;
  const start=users[users.length-limit];
  return messages.filter((message,index)=>index>=start||message.role==='system'||message.id==='compaction-summary');
}
