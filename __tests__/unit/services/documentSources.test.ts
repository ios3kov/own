import { sourcesFromChunks, mergeDocumentSources } from '../../../src/services/documentSources';
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
