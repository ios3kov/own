import {serializeBoundedToolResult} from '../../../src/services/boundedToolResult';

it('keeps short tool envelopes unchanged',()=>{
 expect(serializeBoundedToolResult({content:'5'})).toBe('{"content":"5"}');
 expect(JSON.parse(serializeBoundedToolResult({content:'',error:'No model'}))).toEqual({content:'',error:'No model'});
});
it.each(['"\\\n'.repeat(20000),'🦊'.repeat(20000),'a'.repeat(50000)])('bounds encoded contents and preserves complete Unicode',content=>{
 const output=serializeBoundedToolResult({content},511);const result=JSON.parse(output);
 expect(output.length).toBeLessThanOrEqual(511);
 expect(result.truncated).toBe(true);
 expect(content.startsWith(result.content)).toBe(true);
 expect(result.content).not.toMatch(/[\uD800-\uDBFF]$/);
});
it('bounds huge escaped errors as well as content',()=>{
 const output=serializeBoundedToolResult({content:'🦊'.repeat(1000),error:'"\\\n'.repeat(5000)},256);
 expect(output.length).toBeLessThanOrEqual(256);
 expect(JSON.parse(output)).toEqual(expect.objectContaining({truncated:true,error:expect.any(String)}));
});
it('never accepts a caller limit above the native transport cap',()=>{
 const output=serializeBoundedToolResult({content:'x'.repeat(50000)},1000000);
 expect(output.length).toBeLessThanOrEqual(24000);
});
