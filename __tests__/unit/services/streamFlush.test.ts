import {scheduleTokenFlush} from '../../../src/services/streamFlush';
it('flushes first content immediately, batches later content, and does not schedule empty work',()=>{
 jest.useFakeTimers();const svc:any={tokenBuffer:'first',reasoningBuffer:'',flushTimer:null,hasFlushedContent:false};
 svc.forceFlushTokens=jest.fn(()=>{svc.tokenBuffer='';});svc.flushTokenBuffer=jest.fn(()=>{svc.tokenBuffer='';svc.flushTimer=null;});
 scheduleTokenFlush(svc);expect(svc.forceFlushTokens).toHaveBeenCalledTimes(1);expect(svc.flushTimer).toBeNull();
 svc.tokenBuffer=' next';scheduleTokenFlush(svc);jest.advanceTimersByTime(49);expect(svc.flushTokenBuffer).not.toHaveBeenCalled();jest.advanceTimersByTime(1);expect(svc.flushTokenBuffer).toHaveBeenCalledTimes(1);
 scheduleTokenFlush(svc);expect(svc.flushTimer).toBeNull();jest.useRealTimers();
});
