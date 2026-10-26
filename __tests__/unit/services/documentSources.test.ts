import { sourcesFromChunks,mergeDocumentSources } from '../../../src/services/documentSources';
describe('trusted document references', () => {
  it('keeps the actual document, part and excerpt without creating a file URL', () => {
    expect(sourcesFromChunks('project', [{doc_id:7,name:'Notes',position:2,content:'Original excerpt',score:1}])).toEqual([
      {projectId:'project',documentId:7,name:'Notes',part:3,excerpt:'Original excerpt'},
    ]);
  });
  it('deduplicates by project, document and part, keeping the original snapshot', () => {
    const sources = sourcesFromChunks('one', [{doc_id:7,name:'Notes',position:0,content:'Original',score:1}]);
    expect(mergeDocumentSources(sources, [{...sources[0],excerpt:'Changed'}, {...sources[0],projectId:'two'}])).toEqual([sources[0], {...sources[0],projectId:'two'}]);
  });
  it('rejects invalid IDs and bounds retained excerpts and count', () => {
    const invalid = [{doc_id:0,name:'bad',position:0,content:'bad',score:1}, {doc_id:1,name:'bad',position:-1,content:'bad',score:1}];
    expect(sourcesFromChunks('one',invalid)).toEqual([]);
    const many = Array.from({length:20},(_,i)=>({doc_id:i+1,name:'Notes',position:0,content:'x'.repeat(9000),score:1}));
    const result = sourcesFromChunks('one',many);
    expect(result).toHaveLength(12); expect(result[0].excerpt).toHaveLength(8000);
  });
});

describe('untrusted persisted document metadata',()=>{
  const valid={projectId:'p',documentId:1,part:1,name:'Notes',excerpt:'Saved text'};
  it.each([null,{...valid,projectId:''},{...valid,projectId:7},{...valid,documentId:'1'},{...valid,part:NaN},{...valid,name:null},{...valid,excerpt:{text:'unsafe'}}])('rejects malformed source %#',source=>{
    expect(mergeDocumentSources([], [source as any])).toEqual([]);
  });
  it('bounds the displayed name independently of the source text',()=>{
    expect(mergeDocumentSources([], [{...valid,name:'x'.repeat(400)}])[0].name).toHaveLength(300);
  });
});
