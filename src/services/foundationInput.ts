import type { Message } from '../types';

/** Generated images in history are outputs, not new vision input. */
export function hasNewImageInput(messages: Message[]): boolean {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user' && !messages[i].isSystemInfo) {
      return messages[i].attachments?.some(attachment => attachment.type === 'image') ?? false;
    }
  }
  return false;
}

/** Bound the native request only; never edit the saved conversation. */
export function boundedFoundationHistory(messages: Message[], limit = 256): {messages:Message[];trimmed:boolean} {
  const visible=messages.filter(message=>!message.isSystemInfo);
  const instructions=visible.filter(message=>message.role==='system');
  if (instructions.length>=limit) throw new Error('Too many system instructions for the Apple model. Shorten the project instructions.');
  const history=visible.filter(message=>message.role!=='system');
  const capacity=limit-instructions.length;
  let start=Math.max(0,history.length-capacity);
  while(start<history.length-1 && history[start].role==='assistant')start+=1;
  return {messages:[...instructions,...history.slice(start)],trimmed:start>0};
}
