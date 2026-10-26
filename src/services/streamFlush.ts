export const FLUSH_INTERVAL_MS=50;
/** Show the first model text without an artificial batching wait; batch later updates. */
export function scheduleTokenFlush(svc:any):void {
 if(!svc.hasFlushedContent && (svc.tokenBuffer || svc.reasoningBuffer)) {
  svc.hasFlushedContent=true;svc.forceFlushTokens();return;
 }
 if(!svc.flushTimer && (svc.tokenBuffer || svc.reasoningBuffer)) svc.flushTimer=setTimeout(()=>svc.flushTokenBuffer(),FLUSH_INTERVAL_MS);
}
