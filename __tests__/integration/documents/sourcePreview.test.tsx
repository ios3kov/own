import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {viewDocument} from '@react-native-documents/viewer';
import {DocumentSources} from '../../../src/components/ChatMessage/components/DocumentSources';
import {ragService} from '../../../src/services/rag';

jest.mock('../../../src/services/rag', () => ({ragService:{getDocumentsByProject:jest.fn()}}));
jest.mock('@react-native-documents/viewer', () => ({viewDocument:jest.fn().mockResolvedValue(undefined)}));
jest.mock('../../../src/components/AppSheet', () => ({AppSheet:({visible,children,onClose}:any) => {
  const {View,Text}=require('react-native');
  return visible ? <View>{children}<Text onPress={onClose}>Close source</Text></View> : null;
}}));
const sources = [{projectId:'p',documentId:7,name:'Notes.txt',part:3,excerpt:'The saved original passage.'}];
describe('source preview and local document opening', () => {
  beforeEach(() => {jest.clearAllMocks();});
  it('opens the saved fragment and resolves the original from current project records', async () => {
    (ragService.getDocumentsByProject as jest.Mock).mockResolvedValue([{id:7,project_id:'p',name:'Notes.txt',path:'/local/notes.txt'}]);
    const screen=render(<DocumentSources sources={sources}/>);
    fireEvent.press(screen.getByLabelText('Notes.txt, part 3'));
    expect(screen.getByText('The saved original passage.')).toBeTruthy();
    expect(screen.getByText('Saved excerpt · Part 3')).toBeTruthy();
    fireEvent.press(screen.getByText('Open original document'));
    await waitFor(()=>expect(viewDocument).toHaveBeenCalledWith({uri:'file:///local/notes.txt',mimeType:'text/plain',grantPermissions:'read'}));
  });
  it('keeps a readable excerpt and explains when the original was deleted', async () => {
    (ragService.getDocumentsByProject as jest.Mock).mockResolvedValue([]);
    const screen=render(<DocumentSources sources={sources}/>);
    fireEvent.press(screen.getByLabelText('Notes.txt, part 3'));
    fireEvent.press(screen.getByText('Open original document'));
    await waitFor(()=>expect(screen.getByText(/no longer available/)).toBeTruthy());
    expect(viewDocument).not.toHaveBeenCalled();
    expect(screen.getByText('The saved original passage.')).toBeTruthy();
  });
  it('does not open a late result after the source sheet is closed', async () => {
    let finish!:(documents:any[])=>void;
    (ragService.getDocumentsByProject as jest.Mock).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const screen=render(<DocumentSources sources={sources}/>);
    fireEvent.press(screen.getByLabelText('Notes.txt, part 3'));
    fireEvent.press(screen.getByText('Open original document'));
    fireEvent.press(screen.getByText('Close source'));
    finish([{id:7,project_id:'p',name:'Notes.txt',path:'/local/notes.txt'}]);
    await waitFor(()=>expect(screen.queryByText('Open original document')).toBeNull());
    expect(viewDocument).not.toHaveBeenCalled();
  });
});
