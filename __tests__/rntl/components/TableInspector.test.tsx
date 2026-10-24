import React from 'react';
import {render,fireEvent} from '@testing-library/react-native';
import {TableInspector} from '../../../src/components/TableInspector';
import {parseCSV} from '../../../src/services/tableData';

describe('local table controls',()=>{
 it('calculates, groups, filters and finds duplicates through the visible controls',()=>{
  const table=parseCSV('Team,Amount\nA,2\nA,3\nB,4\nB,4');
  const ui=render(<TableInspector tables={[table]}/>);
  fireEvent.press(ui.getAllByText('2. Amount')[1]);
  expect(ui.getByText(/\["Total","13"\]/)).toBeTruthy();
  fireEvent.press(ui.getByText('Group and chart'));
  expect(ui.getByText(/\["A","5"\]/)).toBeTruthy();
  expect(ui.getByText(/Bar chart: first 20 groups/)).toBeTruthy();
  fireEvent.press(ui.getByText('Filter'));
  fireEvent.changeText(ui.getByLabelText('Exact value to match'),'B');
  expect(ui.getByText('2 result rows. ')).toBeTruthy();
  fireEvent.press(ui.getByText('Duplicate rows'));
  expect(ui.getByText(/\["B","4"/)).toBeTruthy();
 });
});
