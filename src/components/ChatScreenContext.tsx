import React from 'react';
import {Text} from 'react-native';
import {useContextUsage,contextUsageLabel} from '../services/contextUsage';
import {useThemedStyles} from '../theme';
import type {ThemeColors} from '../theme';
export function ChatScreenContext({conversationId}:{conversationId?:string|null}) {
  const latest=useContextUsage(s=>s.latest);
  const styles=useThemedStyles(createStyles);
  if (!latest || latest.conversationId !== conversationId) return null;
  return <Text style={styles.text}>{contextUsageLabel(latest)}</Text>;
}
const createStyles=(colors:ThemeColors)=>({text:{color:colors.textSecondary,fontSize:12,paddingHorizontal:16,paddingVertical:6}});
