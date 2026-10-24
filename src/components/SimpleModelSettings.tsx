import React,{useState,useRef,useEffect} from 'react';
import {View,Text,TextInput} from 'react-native';
import Slider from '@react-native-community/slider';
import {Button} from './Button';
import {useAppStore} from '../stores';
import {useRemoteServerStore} from '../stores/remoteServerStore';
import {useResponseProfilesStore} from '../stores/responseProfilesStore';
import {APPLE_MODEL_ID} from '../services/foundationModels';
import {useThemedStyles} from '../theme';
import type {ThemeColors} from '../theme';
import {ResponseBackend,RESPONSE_CAPABILITIES,responseSnapshot,responseDefaults,builtInResponses} from '../utils/modelResponseSettings';

export function useResponseBackend():ResponseBackend {
  const id=useAppStore(s=>s.activeModelId);
  const engine=useAppStore(s=>s.downloadedModels.find(model=>model.id===s.activeModelId)?.engine);
  const server=useRemoteServerStore(s=>s.activeServerId);
  if (id===APPLE_MODEL_ID) return 'apple';
  if (!id) return server?'remote':'none';
  return engine==='litert'?'litert':'llama';
}
function Choices({options,value,onChange}:{options:{title:string;value:number}[];value:number;onChange:(value:number)=>void}) {
  const styles=useThemedStyles(createStyles);
  return <View style={styles.choices}>{options.map(option=><Button key={option.title} title={option.title} size="small" variant="outline" active={value===option.value} onPress={()=>onChange(option.value)}/>)}</View>;
}
function MemoryNote({backend,memory}:{backend:ResponseBackend;memory?:number}) {
  const styles=useThemedStyles(createStyles);
  if (backend==='apple') return <Text style={styles.warning}>Apple manages memory. Long histories or replies may exceed its context. Choose less history if a request fails.</Text>;
  if (backend!=='llama'&&backend!=='litert') return null;
  return <Text style={styles.warning}>
    {(memory&&memory<512*1024*1024)?'The last device check showed little free memory. ':''}
    Large histories and context sizes can slow replies or run out of memory. Device memory can change; these settings cannot guarantee a model will fit.
  </Text>;
}
function selectedChoices(values:ReturnType<typeof responseSnapshot>,backend:ResponseBackend) {
  const temperature=backend==='litert'?values.liteRTTemperature!:values.temperature??0.7;
  return {temperature,variety:temperature<=0.4?0.2:temperature<=0.9?0.7:1.1,
    length:(values.maxTokens??1024)<=512?256:(values.maxTokens??1024)<=1024?1024:2048,
    history:values.historyTurns<=4?4:values.historyTurns<=12?12:24};
}
export function SimpleModelSettings({advancedContent}:{advancedContent?:React.ReactNode}) {
  const backend=useResponseBackend();
  const settings=useAppStore(s=>s.settings);
  const update=useAppStore(s=>s.updateSettings);
  const memory=useAppStore(s=>s.deviceInfo?.availableMemory);
  const profiles=useResponseProfilesStore(s=>s.profiles);
  const active=useResponseProfilesStore(s=>s.active[backend]);
  const select=useResponseProfilesStore(s=>s.select);
  const save=useResponseProfilesStore(s=>s.save);
  const remove=useResponseProfilesStore(s=>s.remove);
  const [name,setName]=useState('');
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [technical,setTechnical]=useState(false);
  const writeRequest=useRef(0);
  useEffect(()=>{setSaving(false);setMessage('');setName('');setTechnical(false);return()=>{writeRequest.current+=1;};},[backend]);
  const write=async(operation:()=>Promise<boolean>,success:string)=>{
    const owner=++writeRequest.current;setSaving(true);
    const saved=await operation();
    if (owner!==writeRequest.current) return false;
    setSaving(false);setMessage(saved?success:'Could not save the change. Use a name, keep no more than 20 profiles, and check free storage.');
    return saved;
  };
  const styles=useThemedStyles(createStyles);
  const values=responseSnapshot(backend,settings);
  const capability=RESPONSE_CAPABILITIES[backend];
  const {temperature,variety,length,history}=selectedChoices(values,backend);
  const apply=(patch:Partial<typeof settings>)=>{
    const reload=(patch.contextLength!==undefined&&patch.contextLength!==settings.contextLength)||(patch.liteRTMaxTokens!==undefined&&patch.liteRTMaxTokens!==settings.liteRTMaxTokens);
    update(patch);setMessage(reload?'Answer style is saved. Reload the model to apply its new context size.':'Applied to your next reply.');
  };
  const choose=async(profile:typeof values)=>{
    if (await write(()=>select(backend,profile),'Profile selected.')) apply(profile);
  };
  return <View style={styles.container}>
    <Text style={styles.heading}>Response profiles</Text>
    <Text style={styles.help}>Choose a starting point, then adjust it. Profiles stay on this device.</Text>
    <View style={styles.choices}>{builtInResponses(backend).map(profile=><Button key={profile.name} title={profile.name} variant="outline" size="small" onPress={()=>choose(profile.values)}/>)}</View>
    {capability.length?<View style={styles.section}>
      <Text style={styles.heading}>Answer length</Text>
      <Text style={styles.help}>Longer answers allow more detail, but take longer and use more memory. The model may finish earlier.</Text>
      <Choices value={length} options={[{title:'Short',value:256},{title:'Standard',value:1024},{title:'Long',value:2048}]} onChange={maxTokens=>apply({maxTokens})}/>
    </View>:<Text style={styles.help}>This engine does not expose a separate answer-length control.</Text>}
    {capability.variety?<View style={styles.section}>
      <Text style={styles.heading}>Wording variety</Text>
      <Text style={styles.help}>More variety makes wording less predictable. It does not improve accuracy. Speed and memory usually change little.</Text>
      <Choices value={variety} options={[{title:'Focused',value:0.2},{title:'Natural',value:0.7},{title:'Varied',value:1.1}]} onChange={value=>apply(backend==='litert'?{liteRTTemperature:value}:{temperature:value})}/>
    </View>:null}
    <View style={styles.section}>
      <Text style={styles.heading}>Recent conversation</Text>
      <Text style={styles.help}>More exchanges help follow-ups, but use more time and memory. Older chats stay saved; a saved summary may also be used.</Text>
      <Choices value={history} options={[{title:'Less',value:4},{title:'Usual',value:12},{title:'More',value:24}]} onChange={historyTurns=>apply({historyTurns})}/>
      <Text style={styles.help}>Up to {values.historyTurns} recent exchanges.</Text>
    </View>
    <MemoryNote backend={backend} memory={memory}/>
    {backend==='remote'?<Text style={styles.help}>This server does not report its supported response controls. Own can still limit recent history.</Text>:null}
    {backend==='none'?<Text style={styles.help}>Choose a model to see its response controls.</Text>:null}
    <Text style={styles.heading}>Your profiles</Text>
    <Text style={styles.help}>Save answer style and history size. A matching name replaces that profile for this engine.</Text>
    {profiles.filter(profile=>profile.backend===backend).map(profile=><View key={profile.name} style={styles.saved}>
      <Button title={profile.name} variant="outline" size="small" onPress={()=>choose(profile.values)}/>
      <Button title={`Remove ${profile.name}`} variant="ghost" size="small" disabled={saving} onPress={()=>write(()=>remove(profile.name,backend),'Profile removed.')}/>
    </View>)}
    <TextInput accessibilityLabel="Profile name" placeholder="Profile name" placeholderTextColor={styles.help.color}
      style={styles.input} value={name} onChangeText={setName} maxLength={48} autoCorrect={false} editable={!saving} returnKeyType="done"/>
    <Button title="Save response profile" variant="outline" disabled={backend==='none'||saving} loading={saving} onPress={async()=>{
      const saved=await write(()=>save({name,backend,values}),'Profile saved on this device.');
      if (saved) setName('');
    }}/>
    <Text style={styles.help}>Reset restores your last chosen profile, or the engine defaults if none was chosen.</Text>
    <Button title="Reset answer settings" variant="ghost" onPress={()=>apply(active??responseDefaults(backend))}/>
    {message?<Text accessibilityLiveRegion="polite" style={styles.help}>{message}</Text>:null}
    {capability.advanced&&(backend==='apple'||!!advancedContent)?<Button title={technical?'Hide technical settings':'Technical settings'} variant="outline" onPress={()=>setTechnical(!technical)}/>:null}
    {technical&&capability.advanced?(backend==='apple'?<View style={styles.section}>
      <Text style={styles.heading}>Temperature · {temperature.toFixed(2)}</Text>
      <Slider accessibilityLabel="Temperature" minimumValue={0} maximumValue={2} step={0.05} value={temperature} onSlidingComplete={value=>apply({temperature:value})}/>
      <Text style={styles.heading}>Maximum response tokens · {values.maxTokens}</Text>
      <Slider accessibilityLabel="Maximum response tokens" minimumValue={64} maximumValue={2048} step={64} value={values.maxTokens} onSlidingComplete={value=>apply({maxTokens:value})}/>
    </View>:advancedContent):null}
  </View>;
}
const createStyles=(colors:ThemeColors)=>({
  container:{padding:16,gap:12},section:{gap:8},heading:{color:colors.text,fontSize:16,fontWeight:'600' as const},
  help:{color:colors.textSecondary,fontSize:14,lineHeight:20},warning:{color:colors.textSecondary,fontSize:14,lineHeight:20},
  choices:{flexDirection:'row' as const,flexWrap:'wrap' as const,gap:8},saved:{gap:4},
  input:{color:colors.text,borderColor:colors.border,borderWidth:1,borderRadius:10,padding:12,minHeight:44},
});
