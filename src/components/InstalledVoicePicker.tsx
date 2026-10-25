import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, NativeModules, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppSheet } from './AppSheet';
import { useTheme } from '../theme';

type Voice = {id:string; name:string; language:string; quality:string};
export function InstalledVoicePicker({selectedId,onSelect}: {selectedId:string; onSelect:(id:string)=>void}): React.JSX.Element {
  const {colors} = useTheme();
  const [visible,setVisible] = useState(false);
  const [voices,setVoices] = useState<Voice[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [query,setQuery] = useState('');
  useEffect(() => {
    if (!visible && !selectedId) return;
    let cancelled = false;
    setLoading(true); setError(''); setQuery('');
    Promise.resolve().then(() => {
      if (!NativeModules.OwnReplySpeech?.voices) throw new Error('Voice selection is unavailable in this build.');
      return NativeModules.OwnReplySpeech.voices();
    }).then(values => {
      if (cancelled) return;
      if (!Array.isArray(values)) throw new Error('Could not read installed voices.');
      setVoices(values.filter((v:Voice) => typeof v?.id === 'string' && typeof v.name === 'string' && typeof v.language === 'string' && typeof v.quality === 'string'));
    }).catch(() => {if (!cancelled) setError('Could not read installed voices. Close this panel and try again.');})
      .finally(() => {if (!cancelled) setLoading(false);});
    return () => {cancelled=true;};
  },[visible,selectedId]);
  const choose = (id:string) => {onSelect(id);setVisible(false);};
  const selected = voices.find(voice => voice.id === selectedId);
  const filtered = voices.filter(voice => `${voice.name} ${voice.language} ${voice.quality}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose reply voice" onPress={() => setVisible(true)} style={styles.row}>
      <Text style={{color:colors.primary}}>Voice: {selected ? `${selected.name} (${selected.quality})` : selectedId ? 'Saved voice' : 'Automatic by language'}</Text>
    </TouchableOpacity>
    <AppSheet opaque visible={visible} onClose={() => setVisible(false)} title="Installed voices" snapPoints={['80%']} enableDynamicSizing={false}>
      <View style={styles.body}>
        <TextInput maxFontSizeMultiplier={1.5} accessibilityLabel="Search installed voices" placeholder="Search name or language" placeholderTextColor={colors.textSecondary} value={query} onChangeText={setQuery} style={[styles.search,{color:colors.text,borderColor:colors.border}]} />
        {loading ? <ActivityIndicator accessibilityLabel="Loading installed voices" /> : error ? <Text accessibilityRole="alert" style={{color:colors.text}}>{error}</Text> :
          <FlatList ListFooterComponent={<Text style={{color:colors.textSecondary}}>Choose a voice for its language. Other languages use automatic selection. No download starts here.</Text>} ListHeaderComponent={<View>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{selected:!selectedId}} onPress={() => choose('')} style={styles.row}>
          <Text style={{color:colors.primary}}>Automatic by language{!selectedId ? ' ✓' : ''}</Text>
        </TouchableOpacity>
</View>} data={filtered} keyExtractor={voice => voice.id} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Text style={{color:colors.textSecondary}}>No installed voices match.</Text>} renderItem={({item}) =>
            <TouchableOpacity accessibilityRole="button" accessibilityState={{selected:item.id===selectedId}} accessibilityLabel={`${item.name}, ${item.language}, ${item.quality}`} onPress={() => choose(item.id)} style={styles.row}>
              <Text style={{color:colors.text}}>{item.name}{item.id===selectedId ? ' ✓' : ''}</Text>
              <Text style={{color:colors.textSecondary}}>{item.language} · {item.quality}</Text>
            </TouchableOpacity>} />}
      </View>
    </AppSheet>
  </>;
}
const styles = {
  row:{minHeight:48,paddingVertical:12,paddingHorizontal:4,justifyContent:'center' as const},
  body:{flex:1,paddingHorizontal:20,paddingBottom:20,gap:8},
  search:{minHeight:44,borderWidth:1,borderRadius:12,paddingHorizontal:12},
};
