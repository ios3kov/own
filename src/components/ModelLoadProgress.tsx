import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useModelLoadStore } from '../stores/modelLoadStore';
import { useTheme } from '../theme';
import { SPACING, TYPOGRAPHY } from '../constants';
export function ModelLoadProgress() {
  const state=useModelLoadStore(); const {colors}=useTheme();
  if(!state.active)return null;
  const percent=state.percent;
  const fillWidth: `${number}%` = `${percent ?? 30}%`;
  return <View testID="model-load-progress" style={styles.container}>
    <Text accessibilityLiveRegion="polite" style={[TYPOGRAPHY.bodySmall,{color:colors.text}]}>{state.phase}{percent===null?'':` · ${Math.round(percent)}%`}</Text>
    <View accessibilityRole="progressbar" accessibilityLabel="Preparing model for use"
      accessibilityValue={percent===null?{text:state.phase}:{min:0,max:100,now:Math.round(percent)}}
      style={[styles.track,{backgroundColor:colors.border}]}>
      <View style={[styles.fill,{backgroundColor:colors.primary,width:fillWidth},percent===null && styles.indeterminate]} />
    </View>
    {percent===null && <Text style={[TYPOGRAPHY.bodySmall,{color:colors.textSecondary}]}>This stage does not report a percentage. Large models can take longer.</Text>}
  </View>;
}
const styles=StyleSheet.create({container:{alignSelf:'stretch',gap:SPACING.sm,marginVertical:SPACING.md,minWidth:160},track:{height:6,borderRadius:3,overflow:'hidden'},fill:{height:6,borderRadius:3},indeterminate:{alignSelf:'center'}});
