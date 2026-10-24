import { Unzip, UnzipInflate, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';

export interface LocalTable { name: string; columns: string[]; rows: string[][]; warnings: string[] }
const MAX_ROWS = 5000;
const MAX_COLS = 100;
const MAX_CELLS = 100000;
function table(name: string, rows: string[][], warnings: string[] = []): LocalTable {
  if (!rows.length) throw new Error('The table is empty.');
  if (rows.length > MAX_ROWS + 1 || rows.some(r => r.length > MAX_COLS)
    || rows.reduce((n, r) => n + r.length, 0) > MAX_CELLS) throw new Error('Table limit: 5,000 rows, 100 columns, 100,000 cells.');
  const count = Math.max(...rows.map(r => r.length));
  const columns = Array.from({ length: count }, (_, i) => rows[0][i] || `Column ${i + 1}`);
  return { name, columns, rows: rows.slice(1).map(r => Array.from({ length: count }, (_, i) => r[i] ?? '')), warnings };
}

export function parseCSV(text: string, name = 'CSV'): LocalTable {
  if (text.length > 5_000_000) throw new Error('CSV is too large.');
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false; let closed = false;
  const source = text.replace(/^\uFEFF/, '');
  const pushCell = () => { row.push(cell); cell = ''; closed = false; if (row.length > MAX_COLS) throw new Error('Too many columns.'); };
  const pushRow = () => { pushCell(); rows.push(row); row = []; if (rows.length > MAX_ROWS + 1) throw new Error('Too many rows.'); };
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; } else cell += c;
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === ',') pushCell();
    else if (c === '\r' || c === '\n') { if (c === '\r' && source[i + 1] === '\n') i++; pushRow(); }
    else { if (closed) throw new Error('Invalid CSV after a quoted value.'); cell += c; }
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  if (cell || row.length || closed) pushRow();
  return table(name, rows);
}

const array = (value: any): any[] => value == null ? [] : Array.isArray(value) ? value : [value];
function xml(text: string): any {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XML declarations are not supported.');
  return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: false, trimValues: false }).parse(text);
}
function richText(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (value.t != null) return typeof value.t === 'object' ? String(value.t['#text'] ?? '') : String(value.t);
  return array(value.r).map(richText).join('');
}
export function parseXLSX(bytes: Uint8Array): LocalTable[] {
  if (bytes.length > 5_000_000) throw new Error('Workbook is too large.');
  const parts: Record<string, string> = Object.create(null); let expanded = 0; let entries = 0;
  const zip = new Unzip(file => {
    if (++entries > 1000) throw new Error('Too many workbook entries.');
    if (!/^(xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml))$/.test(file.name)) return;
    if ((file.originalSize ?? 0) > 10_000_000) throw new Error('Workbook entry is too large.');
    const chunks: Uint8Array[] = []; let length = 0;
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      expanded += chunk.length; length += chunk.length;
      if (expanded > 20_000_000 || length > 10_000_000) { file.terminate(); throw new Error('Expanded workbook is too large.'); }
      chunks.push(chunk);
      if (final) { const data = new Uint8Array(length); let offset = 0; for (const c of chunks) { data.set(c, offset); offset += c.length; } parts[file.name] = strFromU8(data); }
    };
    file.start();
  });
  zip.register(UnzipInflate);
  for (let i = 0; i < bytes.length; i += 4096) zip.push(bytes.subarray(i, i + 4096), i + 4096 >= bytes.length);
  const workbook = xml(parts['xl/workbook.xml'] || '').workbook;
  if (!workbook) throw new Error('Invalid XLSX workbook.');
  const relationships = array(xml(parts['xl/_rels/workbook.xml.rels'] || '').Relationships?.Relationship);
  const shared = array(xml(parts['xl/sharedStrings.xml'] || '').sst?.si).map(richText);
  return array(workbook.sheets?.sheet).map(sheet => {
    const relation = relationships.find(r => r['@Id'] === sheet['@r:id'] && r['@TargetMode'] !== 'External');
    const target = relation?.['@Target'] as string | undefined;
    const key = target?.startsWith('/xl/') ? target.slice(1) : `xl/${target}`;
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(key) || !parts[key]) throw new Error('Unsupported worksheet reference.');
    const rows: string[][] = []; let formulas = false;
    for (const row of array(xml(parts[key]).worksheet?.sheetData?.row)) {
      const values: string[] = [];
      for (const cell of array(row.c)) {
        const reference = /^([A-Z]+)\d+$/.exec(cell['@r'] || '');
        if (!reference) throw new Error('Invalid cell reference.');
        const index = [...reference[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
        if (index >= MAX_COLS) throw new Error('Too many columns.');
        formulas ||= cell.f != null;
        values[index] = cell['@t'] === 's' ? (shared[Number(cell.v)] ?? '') : cell['@t'] === 'inlineStr' ? richText(cell.is) : String(cell.v ?? '');
      }
      rows.push(values);
      if (rows.length > MAX_ROWS + 1) throw new Error('Too many rows.');
    }
    return table(String(sheet['@name'] || 'Sheet'), rows, [
      'First row is used as column headings. Dates remain Excel serial values.',
      ...(formulas ? ['Formula results use saved values; formulas are never executed or recalculated.'] : []),
    ]);
  });
}

export function numericCell(value: string): number | null {
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) return null;
  const number = Number(trimmed); return Number.isFinite(number) ? number : null;
}
export function analyzeTable(data: LocalTable, options: { operation: 'sum' | 'group' | 'filter' | 'duplicates'; column: number; argument?: string; valueColumn?: number }) {
  const { operation, column, argument = '', valueColumn = column } = options;
  if (column < 0 || column >= data.columns.length || valueColumn < 0 || valueColumn >= data.columns.length) throw new Error('Choose an existing column.');
  if (operation === 'filter') return { rows: data.rows.filter(r => r[column] === argument), columns: data.columns };
  if (operation === 'duplicates') {
    const counts = new Map<string, number>();
    data.rows.forEach(r => { const key = JSON.stringify(r); counts.set(key, (counts.get(key) ?? 0) + 1); });
    return { rows: data.rows.filter(r => (counts.get(JSON.stringify(r)) ?? 0) > 1), columns: data.columns };
  }
  const sums = new Map<string, number>(); let skipped = 0;
  data.rows.forEach(row => {
    const number = numericCell(row[valueColumn]);
    if (number === null) { skipped++; return; }
    const key = operation === 'sum' ? 'Total' : row[column];
    const result = (sums.get(key) ?? 0) + number;
    if (!Number.isFinite(result)) throw new Error('The total is outside the supported numeric range.');
    sums.set(key, result);
  });
  return { columns: [operation === 'sum' ? 'Result' : data.columns[column], 'Sum'], rows: [...sums].map(([key, value]) => [key, String(value)]), skipped };
}
