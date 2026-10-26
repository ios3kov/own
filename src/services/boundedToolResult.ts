/** Keep the complete Apple tool envelope valid; this is a transport bound, not a token count. */
export function serializeBoundedToolResult(result:{content:string;error?:string},requestedLimit=24000):string {
 const limit=Number.isSafeInteger(requestedLimit) ? Math.max(256,Math.min(24000,requestedLimit)) : 24000;
 const content=typeof result.content==='string' ? result.content : '';
 const originalError=typeof result.error==='string' ? result.error : undefined;
 const full=JSON.stringify({content,error:originalError});
 if(full.length<=limit) return full;
 const error=originalError===undefined ? undefined : safePrefix(originalError,Math.floor(limit/16));
 let low=0;let high=content.length;
 while(low<high) {
  const middle=Math.ceil((low+high)/2);
  if(JSON.stringify({content:content.slice(0,middle),error,truncated:true}).length<=limit) low=middle;
  else high=middle-1;
 }
 return JSON.stringify({content:safePrefix(content,low),error,truncated:true});
}

function safePrefix(text:string,length:number):string {
 let end=length;
 const last=text.charCodeAt(end-1);const next=text.charCodeAt(end);
 if(last>=0xD800 && last<=0xDBFF && next>=0xDC00 && next<=0xDFFF) end-=1;
 return text.slice(0,end);
}
