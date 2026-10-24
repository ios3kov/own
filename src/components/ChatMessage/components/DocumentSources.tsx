import React, {useEffect, useRef, useState} from 'react';
import {View, Text, ScrollView, TouchableOpacity} from 'react-native';
import {viewDocument} from '@react-native-documents/viewer';
import {AppSheet} from '../../AppSheet';
import {Button} from '../../Button';
import {useThemedStyles} from '../../../theme';
import type {ThemeColors} from '../../../theme';
import type {DocumentSource} from '../../../types';
import {mergeDocumentSources} from '../../../services/documentSources';
import {resolveDocumentSource} from '../../../services/documentSourceFile';

export function DocumentSources({sources}: {sources:DocumentSource[]}) {
  const styles = useThemedStyles(createStyles);
  const [selected, setSelected] = useState<DocumentSource|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [opening, setOpening] = useState(false);
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);
  const close = () => { request.current += 1; setSelected(null); setOpening(false); };
  const open = async () => {
    if (!selected || opening) return;
    const id = ++request.current;
    setOpening(true); setError(null);
    try {
      const file = await resolveDocumentSource(selected);
      if (id !== request.current) return;
      await viewDocument({...file, grantPermissions:'read'});
    } catch (failure) {
      if (id === request.current) setError(failure instanceof Error ? failure.message : 'The original document cannot be opened.');
    } finally { if (id === request.current) setOpening(false); }
  };
  const valid = mergeDocumentSources([], Array.isArray(sources) ? sources : []);
  if (!valid.length) return null;
  return <View style={styles.container}>
    <Text style={styles.caption}>Documents used for context</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {valid.map(source => <TouchableOpacity accessibilityRole="button"
        accessibilityLabel={`${source.name}, part ${source.part}`} style={styles.source}
        key={JSON.stringify([source.projectId,source.documentId,source.part])}
        onPress={() => { request.current += 1; setSelected(source); setError(null); setOpening(false); }}>
        <Text style={styles.label} numberOfLines={2}>{source.name} · Part {source.part}</Text>
      </TouchableOpacity>)}
    </ScrollView>
    <AppSheet visible={!!selected} onClose={close} title={selected?.name || 'Document source'} snapPoints={['75%']} enableDynamicSizing={false}>
      <View style={styles.detail}>
        <Text style={styles.caption}>Saved excerpt · Part {selected?.part}</Text>
        <ScrollView style={styles.excerpt}><Text selectable style={styles.text}>{selected?.excerpt}</Text></ScrollView>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Button title="Open original document" onPress={open} disabled={opening} loading={opening} />
      </View>
    </AppSheet>
  </View>;
}
const createStyles = (colors:ThemeColors) => ({
  container:{marginTop:12}, caption:{color:colors.textSecondary,fontSize:12,marginBottom:8},
  source:{maxWidth:260,minHeight:44,justifyContent:'center' as const,paddingHorizontal:12,marginRight:8,borderWidth:1,borderColor:colors.border,borderRadius:12},
  label:{color:colors.text,fontSize:13}, detail:{flex:1,padding:16}, excerpt:{flex:1,marginBottom:16},
  text:{color:colors.text,fontSize:16,lineHeight:24}, error:{color:colors.error,fontSize:14,marginBottom:12},
});
