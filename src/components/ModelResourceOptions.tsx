import React from 'react';
import {View,Text,Switch,useWindowDimensions} from 'react-native';
import {useAppStore} from '../stores';
import {useTheme,useThemedStyles} from '../theme';
import type {ThemeColors} from '../theme';
import {TYPOGRAPHY,SPACING} from '../constants';
import {APPLE_MODEL_ID,useFoundationStore} from '../services/foundationModels';

const createStyles=(colors:ThemeColors)=>({
 row:{flexDirection:'row' as const,alignItems:'flex-start' as const,gap:SPACING.md,paddingVertical:SPACING.md},
 copy:{flex:1,minWidth:0},
 title:{...TYPOGRAPHY.body,color:colors.text},
 hint:{...TYPOGRAPHY.bodySmall,color:colors.textSecondary,marginTop:SPACING.xs},
 control:{minHeight:44,justifyContent:'center' as const},
 stacked:{flexDirection:'column' as const},
 stackedCopy:{flex:0,width:'100%' as const},
 stackedControl:{alignSelf:'flex-end' as const},
});

function ResourceOption({label,hint,enabled,disabled,onChange,testID}:{label:string;hint:string;enabled:boolean;disabled?:boolean;onChange:(value:boolean)=>void;testID:string}) {
 const {colors}=useTheme();const styles=useThemedStyles(createStyles);
 const stacked=useWindowDimensions().fontScale>1.6;
 return <View style={[styles.row,stacked&&styles.stacked]}>
  <View style={[styles.copy,stacked&&styles.stackedCopy]}><Text maxFontSizeMultiplier={1.8} style={styles.title}>{label}</Text><Text maxFontSizeMultiplier={1.8} style={styles.hint}>{hint}</Text></View>
  <View style={[styles.control,stacked&&styles.stackedControl]}><Switch value={enabled} disabled={disabled} onValueChange={value=>{if(!disabled)onChange(value);}}
   accessibilityState={{disabled:disabled===true,checked:enabled}}
   accessibilityLabel={label} accessibilityHint={hint} testID={testID}
   trackColor={{false:colors.surfaceLight,true:colors.primary}} thumbColor={colors.text}/></View>
 </View>;
}
export function ImagePreviewSetting() {
 const enabled=useAppStore(s=>s.settings.imagePreviewEnabled===true);const update=useAppStore(s=>s.updateSettings);
 return <ResourceOption label="Live image preview" hint="Shows drafts in longer drawings. May use more memory and time."
  enabled={enabled} onChange={value=>update({imagePreviewEnabled:value})} testID="image-live-preview"/>;
}
export function AppleReadySetting() {
 const selected=useAppStore(s=>s.activeModelId===APPLE_MODEL_ID);
 const available=useFoundationStore(s=>s.availability.available);
 const supported=useFoundationStore(s=>s.availability.sessionReuseSupported===true);
 const toolsOn=useAppStore(s=>s.settings.enabledTools.length>0);
 const enabled=useAppStore(s=>s.settings.appleSessionReuseEnabled===true);const update=useAppStore(s=>s.updateSettings);
 if(!selected || !supported)return null;
 return <ResourceOption label="Keep Apple chat ready" hint="Text chats with tools off. Uses extra memory; clears when you leave the app."
  enabled={enabled} disabled={!enabled && (!available || toolsOn)} onChange={value=>update({appleSessionReuseEnabled:value})} testID="apple-chat-ready"/>;
}

export function ImageReadySetting() {
 const enabled=useAppStore(s=>s.settings.keepImagePipelineReady===true);const update=useAppStore(s=>s.updateSettings);
 return <ResourceOption label="Keep image generator ready" hint="After drawing, keeps its setup for up to one minute. May use more memory; clears when you leave the app."
  enabled={enabled} onChange={value=>update({keepImagePipelineReady:value})} testID="image-pipeline-ready"/>;
}
