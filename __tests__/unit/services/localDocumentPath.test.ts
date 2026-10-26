import { localDocumentPath } from '../../../src/services/localDocumentPath';
const old = '/var/mobile/Containers/Data/Application/11111111-1111-1111-1111-111111111111';
describe('saved local document paths',()=>{
  it('preserves an exact nested path after a sandbox move',()=>{
    expect(localDocumentPath(`${old}/Documents/Inbox/one.txt`)).toBe('/mock/documents/Inbox/one.txt');
    expect(localDocumentPath(`file://${old}/Documents/My%20notes%3F.txt`)).toBe('/mock/documents/My notes?.txt');
    expect(localDocumentPath(`${old}/Library/Caches/one.txt`)).toBe('/mock/caches/one.txt');
  });
  it('does not relocate a newly picked external container',()=>{
    expect(localDocumentPath(`file://${old}/Documents/Other%20notes.txt`,false)).toBe(`${old}/Documents/Other notes.txt`);
    expect(localDocumentPath('/mock/documents/100% ready.txt',false)).toBe('/mock/documents/100% ready.txt');
  });
  it('does not guess by filename or a loose Documents suffix',()=>{
    expect(localDocumentPath('/local/Documents/one.txt')).toBe('/local/Documents/one.txt');
    expect(localDocumentPath(`${old}/Documents2/one.txt`)).toBe(`${old}/Documents2/one.txt`);
  });
  it.each(['https://example.com/a','file://host/a','file:///a/%ZZ','/a/../b','/a/./b','file:///a/%2e%2e/b','//host/file','/a\\b','/a/\n'])('rejects unsafe or ambiguous targets: %s',path=>{
    expect(()=>localDocumentPath(path)).toThrow('cannot be opened');
  });
});
