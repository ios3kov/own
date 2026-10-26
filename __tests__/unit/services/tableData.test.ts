import { zipSync, strToU8 } from 'fflate';
import { parseCSV, parseXLSX, analyzeTable, numericCell } from '../../../src/services/tableData';

describe('local tables', () => {
  it('keeps quoted commas, quotes, newlines, empty cells and operators', () => {
    const table = parseCSV('name,value,note\r\n"a,b",2,"x < 3\nnext"\r\n"a""b",,end\r\n');
    expect(table.rows).toEqual([['a,b', '2', 'x < 3\nnext'], ['a"b', '', 'end']]);
    expect(() => parseCSV('a\n"unterminated')).toThrow();
  });
  it('calculates independently of the AI and reports excluded cells', () => {
    const table = parseCSV('team,value\nA,2\nA,3\nB,-4\nA,missing\nB,-4');
    expect(analyzeTable(table, { operation: 'sum', column: 1 })).toEqual({ columns: ['Result', 'Sum'], rows: [['Total', '-3']], skipped: 1 });
    expect(analyzeTable(table, { operation: 'group', column: 0, valueColumn: 1 }).rows).toEqual([['A', '5'], ['B', '-8']]);
    expect(analyzeTable(table, { operation: 'filter', column: 0, argument: 'B' }).rows).toHaveLength(2);
    expect(analyzeTable(table, { operation: 'duplicates', column: 0 }).rows).toEqual([['B', '-4'], ['B', '-4']]);
    expect(numericCell('1,000')).toBeNull();
    expect(numericCell('Infinity')).toBeNull();
  });
  it('reads real zipped XLSX parts, shared strings, sparse cells and cached formulas', () => {
    const bytes = zipSync({
      'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Totals" r:id="r1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/sharedStrings.xml': strToU8('<sst><si><t>Name</t></si><si><r><t>North</t></r><r><t> West</t></r></si></sst>'),
      'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Value</t></is></c></row><row><c r="A2" t="s"><v>1</v></c><c r="B2"><f>1+2</f><v>3</v></c></row></sheetData></worksheet>'),
      '../outside.txt': strToU8('never extracted'),
    });
    const [table] = parseXLSX(bytes);
    expect(table.name).toBe('Totals');
    expect(table.rows).toEqual([['North West', '3']]);
    expect(table.warnings.join(' ')).toContain('never executed');
  });
  it('rejects malformed and oversized inputs', () => {
    expect(() => parseCSV('x\n'.repeat(5003))).toThrow();
    expect(() => parseXLSX(new Uint8Array([1, 2, 3]))).toThrow();
    expect(() => parseXLSX(new Uint8Array(5_000_001))).toThrow();
  });
});
