import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { useTheme } from '../theme';
import { SPACING, TYPOGRAPHY } from '../constants';
import { LocalTable, analyzeTable } from '../services/tableData';

export function TableInspector({ tables }: { tables: LocalTable[] }) {
  const { colors } = useTheme();
  const [sheet, setSheet] = useState(0);
  const [column, setColumn] = useState(0);
  const [valueColumn, setValueColumn] = useState(0);
  const [filter, setFilter] = useState('');
  const [operation, setOperation] = useState<'sum' | 'group' | 'filter' | 'duplicates'>('sum');
  const data = tables[sheet];
  if (!data) return null;
  let result: ReturnType<typeof analyzeTable> | null = null; let error = '';
  try { result = analyzeTable(data, { operation, column, argument: filter, valueColumn }); }
  catch (e: any) { error = e.message; }
  const numbers = result?.rows.map(r => Number(r[1])) ?? [];
  const max = Math.max(1, ...numbers.map(Math.abs));
  const button = (label: string, selected: boolean, action: () => void) => (
    <TouchableOpacity key={label} accessibilityRole="button" accessibilityState={{ selected }} onPress={action}
      style={[styles.button, { borderColor: selected ? colors.primary : colors.border }]}>
      <Text style={{ color: colors.text }}>{label}</Text>
    </TouchableOpacity>
  );
  return <View testID="table-inspector" style={styles.container}>
    <Text style={[TYPOGRAPHY.h3, { color: colors.text }]}>Table tools</Text>
    <Text style={{ color: colors.textSecondary }}>Calculated on your device. {data.rows.length} rows. Decimal point: .</Text>
    {tables.length > 1 && <View style={styles.row}>{tables.map((t, i) => button(t.name, sheet === i, () => { setSheet(i); setColumn(0); setValueColumn(0); }))}</View>}
    {data.warnings.map(w => <Text key={w} style={{ color: colors.textSecondary }}>{w}</Text>)}
    <Text style={[TYPOGRAPHY.label, { color: colors.text }]}>Match or group column</Text>
    <View style={styles.row}>{data.columns.map((c, i) => button(`${i + 1}. ${c}`, column === i, () => setColumn(i)))}</View>
    <Text style={[TYPOGRAPHY.label, { color: colors.text }]}>Column to add up</Text>
    <View style={styles.row}>{data.columns.map((c, i) => button(`${i + 1}. ${c}`, valueColumn === i, () => setValueColumn(i)))}</View>
    <View style={styles.row}>{([
      ['sum', 'Sum'], ['group', 'Group and chart'], ['filter', 'Filter'], ['duplicates', 'Duplicate rows'],
    ] as const).map(([key, label]) => button(label, operation === key, () => setOperation(key)))}</View>
    {operation === 'filter' && <TextInput accessibilityLabel="Exact value to match" placeholder="Exact value to match" placeholderTextColor={colors.textMuted}
      value={filter} onChangeText={setFilter} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text> : null}
    {result && <>
      <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>{result.rows.length} result rows. {'skipped' in result ? `${result.skipped} non-numeric cells excluded.` : ''}</Text>
      <ScrollView horizontal accessibilityLabel="Calculated table results">
        <Text selectable style={[TYPOGRAPHY.body, { color: colors.text }]}>{[result.columns, ...result.rows.slice(0, 100)].map(r => JSON.stringify(r)).join('\n')}</Text>
      </ScrollView>
      {result.rows.length > 100 && <Text style={{ color: colors.textSecondary }}>Showing the first 100 result rows.</Text>}
      {operation === 'group' && result.rows.length > 0 && <>
        <Text style={{ color: colors.text }}>Bar chart: first 20 groups. Values are also listed above.</Text>
        <Svg width="100%" height={Math.min(20, result.rows.length) * 28} viewBox={`0 0 300 ${Math.min(20, result.rows.length) * 28}`} accessible={false}>
          <Line x1={150} x2={150} y1={0} y2={560} stroke={colors.textMuted} />
          {result.rows.slice(0, 20).map((row, i) => { const n = Number(row[1]); const w = Math.abs(n) / max * 145;
            return <Rect key={i} x={n < 0 ? 150 - w : 150} y={i * 28 + 4} width={w} height={18} fill={colors.primary} />; })}
        </Svg>
      </>}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: SPACING.md, paddingBottom: SPACING.xl },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  button: { borderWidth: 1, borderRadius: 8, padding: SPACING.sm, minHeight: 44, justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 8, padding: SPACING.md, minHeight: 44 },
});
