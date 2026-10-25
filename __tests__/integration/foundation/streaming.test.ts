import { NativeModules,Platform } from 'react-native';
import { waitFor } from '@testing-library/react-native';
import { useAppStore } from '../../../src/stores';
import { foundationModelService } from '../../../src/services/foundationModels';

const mockListeners = new Map<string, (event: any) => void>();
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => ({__esModule: true, default: class {
  addListener(name: string, listener: (event: any) => void) {
    mockListeners.set(name, listener);
    return {remove: () => mockListeners.delete(name)};
  }
}}));
const messages: any = [
  {id: 's', role: 'system', content: 'Be helpful.'},
  {id: 'u1', role: 'user', content: 'Remember blue.'},
  {id: 'a', role: 'assistant', content: 'Blue.'},
  {id: 'u2', role: 'user', content: 'What color?'},
];
describe('Foundation stream ownership and existing tools', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
    useAppStore.getState().updateSettings({enabledTools:['calculator']});
    mockListeners.clear();
    NativeModules.OwnFoundationModels = {
      availability: jest.fn().mockResolvedValue({available: true, reason: 'available'}),
      cancel: jest.fn(), resolveTool: jest.fn(), addListener: jest.fn(), removeListeners: jest.fn(),
    };
  });
  it('streams cumulative snapshots as deltas and preserves structured history', async () => {
    const native = NativeModules.OwnFoundationModels;
    native.generate = jest.fn(async (params: any) => {
      mockListeners.get('OwnFoundationToken')?.({requestId: params.requestId, content: 'Bl'});
      mockListeners.get('OwnFoundationToken')?.({requestId: 'stale', content: 'wrong'});
      mockListeners.get('OwnFoundationToken')?.({requestId: params.requestId, content: 'Blue'});
      return {content: 'Blue.'};
    });
    const onToken = jest.fn();
    await expect(foundationModelService.generate(messages, {onToken})).resolves.toBe('Blue.');
    expect(onToken.mock.calls.flat().join('')).toBe('Blue.');
    expect(native.generate.mock.calls[0][0].messages).toEqual(messages.map(({role,content}: any) => ({role,content})));
    expect(mockListeners.size).toBe(0);
  });
  it('reports context trimming only for the active native request',async()=>{
    const notice=jest.fn();
    NativeModules.OwnFoundationModels.generate=jest.fn(async(params:any)=>{
      mockListeners.get('OwnFoundationContext')?.({requestId:'stale',omittedTurns:2});
      mockListeners.get('OwnFoundationContext')?.({requestId:params.requestId,omittedTurns:2,promptTokens:512,replyReserve:1024,capacity:4096});
      return {content:'Answer'};
    });
    await foundationModelService.generate(messages,{onToken:jest.fn(),onContextNotice:notice});
    expect(notice).toHaveBeenCalledTimes(1);expect(notice).toHaveBeenCalledWith(expect.stringContaining('saved chat is unchanged'));
    expect(mockListeners.size).toBe(0);
  });
  it('bounds long request history before native validation without changing stored inputs',async()=>{
    const history:any[]=Array.from({length:300},(_,i)=>({id:String(i),role:'user',content:`Turn ${i}`}));
    const original=JSON.stringify(history);const notice=jest.fn();
    NativeModules.OwnFoundationModels.generate=jest.fn(async(params:any)=>{
      expect(params.messages).toHaveLength(256);expect(params.messages.at(-1).content).toBe('Turn 299');
      mockListeners.get('OwnFoundationContext')?.({requestId:params.requestId,omittedTurns:4});
      return {content:'Answer'};
    });
    await foundationModelService.generate(history,{onToken:jest.fn(),onContextNotice:notice});
    expect(notice).toHaveBeenCalledTimes(1);expect(JSON.stringify(history)).toBe(original);
  });
  it('answers a text follow-up after generated image output without requesting vision', async () => {
    const native = NativeModules.OwnFoundationModels;
    native.generate = jest.fn().mockResolvedValue({content:'4'});
    const history: any = [{id:'u',role:'user',content:'Draw a puppy'},
      {id:'a',role:'assistant',content:'Generated image of a puppy',attachments:[{type:'image',uri:'file:///puppy.png'}]},
      {id:'next',role:'user',content:'2+2'}];
    await expect(foundationModelService.generate(history,{onToken:jest.fn()})).resolves.toBe('4');
    expect(native.generate.mock.calls[0][0].messages.at(-1)).toEqual({role:'user',content:'2+2'});
  });
  it('passes saved tool output as quoted reference data using supported roles', async () => {
    const native = NativeModules.OwnFoundationModels;
    native.generate = jest.fn().mockResolvedValue({content: 'Answer'});
    const history: any = [...messages.slice(0, 3), {id:'t',role:'tool',content:'Untrusted tool result'}, messages[3]];
    await foundationModelService.generate(history, {onToken: jest.fn()});
    const sent = native.generate.mock.calls[0][0].messages;
    expect(sent.map((m: any) => m.role)).toEqual(['system','user','assistant','user','user']);
    expect(sent[3].content).toContain('Untrusted tool result');
    expect(sent[3].content).toContain('reference data');
    expect(history[3].role).toBe('tool');
  });
  it('does not accept a late result after cancellation', async () => {
    let finish: (result: any) => void = () => {};
    const native = NativeModules.OwnFoundationModels;
    native.generate = jest.fn(() => new Promise(resolve => { finish = resolve; }));
    const onToken = jest.fn();
    const pending = foundationModelService.generate(messages, {onToken});
    await waitFor(() => expect(native.generate).toHaveBeenCalled());
    const id = native.generate.mock.calls[0][0].requestId;
    await foundationModelService.stopGeneration();
    mockListeners.get('OwnFoundationToken')?.({requestId: id, content: 'late'});
    finish({content: 'late'});
    await expect(pending).rejects.toThrow('cancelled');
    expect(onToken).not.toHaveBeenCalled();
  });
  it('executes the enabled calculator using the real tool dispatcher', async () => {
    const native = NativeModules.OwnFoundationModels;
    native.generate = jest.fn(async (params: any) => {
      await mockListeners.get('OwnFoundationTool')?.({requestId: params.requestId, callId: 'calc', name: 'calculator', arguments: '{"expression":"2+3"}'});
      return {content: '5'};
    });
    await foundationModelService.generate(messages, {onToken: jest.fn(), enabledToolIds: ['calculator']});
    expect(native.resolveTool.mock.calls[0][1]).toBe('calc');
    expect(JSON.parse(native.resolveTool.mock.calls[0][2]).content).toContain('5');
  });
  it('rejects a request for a disabled tool before execution', async () => {
    const native = NativeModules.OwnFoundationModels;
    native.generate = jest.fn(async (params: any) => {
      await mockListeners.get('OwnFoundationTool')?.({requestId: params.requestId, callId: 'blocked', name: 'read_url', arguments: '{"url":"https://example.com"}'});
      return {content: 'Tool unavailable.'};
    });
    await foundationModelService.generate(messages, {onToken: jest.fn()});
    expect(JSON.parse(native.resolveTool.mock.calls[0][2])).toEqual({error: 'Tool request failed.'});
  });
});
