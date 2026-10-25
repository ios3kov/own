jest.mock('whisper.rn/NativeRNWhisper',()=>({__esModule:true,default:{
 getConstants:()=>({}),installJSIBindings:jest.fn().mockResolvedValue(undefined),
 initContext:jest.fn(),
}}));

it('preserves native multilingual metadata through the real Whisper JavaScript constructor',async()=>{
 const bridge=jest.requireMock('whisper.rn/NativeRNWhisper').default;
 const actual=jest.requireActual('whisper.rn/index');
 for(const multilingual of [false,true]) {
  bridge.initContext.mockResolvedValueOnce({contextPtr:1,contextId:12,gpu:false,reasonNoGPU:'',multilingual});
  const context=await actual.initWhisper({filePath:'/renamed.bin'});
  expect(context.multilingual).toBe(multilingual);
  expect(context.id).toBe(12);
 }
});
