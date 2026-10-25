import React,{useLayoutEffect,useRef} from 'react';
import {View} from 'react-native';
import {recordReplyTextBounds,registerReplyMeasurer,requestReplyMeasurement} from '../../../services/replyTiming';
export function ReplyTextLayout({traceId,children,testID='message-text'}:{traceId?:string;children:React.ReactNode;testID?:string}):React.JSX.Element {
 const ref=useRef<View>(null);
 useLayoutEffect(()=>{
  if(!traceId) return;
  let alive=true;let frame:number|undefined;
  const measure=()=>{
   if(frame!==undefined) cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    frame=undefined;
    if(!alive) return;
    ref.current?.measureInWindow((...bounds)=>{
     const [,y,width,height]=bounds;
     if(alive && width>0 && height>0) recordReplyTextBounds(traceId,{top:y,bottom:y+height});
    });
   });
  };
  const unregister=registerReplyMeasurer(traceId,measure);
  return ()=>{alive=false;if(frame!==undefined) cancelAnimationFrame(frame);unregister();};
 },[traceId]);
 return <View ref={ref} collapsable={false} testID={testID} onLayout={()=>requestReplyMeasurement(traceId,true)}>{children}</View>;
}
