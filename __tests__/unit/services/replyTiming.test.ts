import {AppState} from 'react-native';
import {registerReplySend,beginReplyTiming,activeReplyTiming,clearReplyTimings,focusReplyConversation,setReplyViewport,markReplyVisibility,recordReplyTextBounds,registerReplyMeasurer,requestReplyMeasurement} from '../../../src/services/replyTiming';
let now=100;
beforeEach(()=>{clearReplyTimings();now=100;jest.spyOn(performance,'now').mockImplementation(()=>now);AppState.currentState='active';});
afterEach(()=>{jest.restoreAllMocks();clearReplyTimings();});
function begin(){registerReplySend('user',100,20);now=200;beginReplyTiming('chat','user');return activeReplyTiming('chat')!.id;}
it('waits for focused, active, viewable text intersecting the chat viewport',()=>{
 const id=begin();setReplyViewport('chat',{top:100,bottom:400});markReplyVisibility(id,true);recordReplyTextBounds(id,{top:150,bottom:200});
 expect(activeReplyTiming('chat')?.firstVisibleAt).toBeUndefined();focusReplyConversation('chat');
 recordReplyTextBounds(id,{top:500,bottom:600});expect(activeReplyTiming('chat')?.firstVisibleAt).toBeUndefined();
 AppState.currentState='background';recordReplyTextBounds(id,{top:150,bottom:200});expect(activeReplyTiming('chat')?.firstVisibleAt).toBeUndefined();
 AppState.currentState='active';now=350;recordReplyTextBounds(id,{top:150,bottom:200});expect(activeReplyTiming('chat')?.firstVisibleAt).toBe(350);
 now=900;recordReplyTextBounds(id,{top:150,bottom:200});expect(activeReplyTiming('chat')?.firstVisibleAt).toBe(350);
});
it('does not invent a tap time for internal generation or accept invalid/clock-reversed input',()=>{
 beginReplyTiming('chat','unknown');expect(activeReplyTiming('chat')).toBeUndefined();
 registerReplySend('bad',NaN);beginReplyTiming('chat','bad');expect(activeReplyTiming('chat')).toBeUndefined();
 registerReplySend('future',200);beginReplyTiming('chat','future');expect(activeReplyTiming('chat')).toBeUndefined();
});
it('keeps a newer native measurer when an old row unmounts and throttles scroll measurements',()=>{
 const id=begin();focusReplyConversation('chat');const old=jest.fn();const next=jest.fn();const unregister=registerReplyMeasurer(id,old);registerReplyMeasurer(id,next);unregister();next.mockClear();old.mockClear();
 now=400;requestReplyMeasurement(id);requestReplyMeasurement(id);expect(next).toHaveBeenCalledTimes(1);expect(old).not.toHaveBeenCalled();
});
