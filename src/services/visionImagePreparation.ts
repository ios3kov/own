import {NativeModules} from 'react-native';
import type {Message} from '../types';

export const VISION_PREPROCESSING = Object.freeze({maximumEdge:1024, orientation:'exif', sizing:'aspect-fit-no-upscale', format:'png', frame:0, version:'own-vision-v1'});
/** Identity describes the actual loaded resources, not mutable weight files on disk. */
export class VisionPreparationIdentity {
 private contexts = new WeakMap<object,number>();
 private sequence = 0;
 private projectorRevision = 0;
 private projector: {path:string;useGpu:boolean}|null = null;
 setProjector(path?:string,useGpu=false):void {
  this.projectorRevision += 1;
  this.projector = path ? {path,useGpu} : null;
 }
 forContext(context:object,engine:string):string {
  let contextId=this.contexts.get(context);
  if(contextId===undefined){contextId=++this.sequence;this.contexts.set(context,contextId);}
  // Native hashes immutable source image bytes. Pixel preparation never reads weights.
  return JSON.stringify({contextId,engine,projector:this.projector,
   projectorRevision:this.projectorRevision,preprocessing:VISION_PREPROCESSING});
 }
}

let serial = 0;
type Options = {modelIdentity: string; maximumEdge?: number; signal?: AbortSignal};

/** Derived paths exist only in the request copy. Saved attachments and OCR keep the original. */
export async function withPreparedVisionMessages<T>(
  messages: Message[], options: Options, work: (prepared: Message[]) => Promise<T>,
): Promise<T> {
  if (options.signal?.aborted) throw new Error('Image preparation cancelled.');
  const attachments = messages.flatMap(message => message.role === 'user' && !message.isSystemInfo
    ? (message.attachments ?? []).filter(attachment => attachment.type === 'image') : []);
  if (!attachments.length) return work(messages);
  const bridge = NativeModules.PDFExtractorModule;
  if (!bridge?.prepareVisionImages || !bridge?.finishVisionPreparation) {
    throw new Error('Image preparation is unavailable. Please update the app.');
  }
  const request = `vision-${Date.now()}-${++serial}`;
  const edge = options.maximumEdge ?? 1024;
  const abort = () => { void bridge.finishVisionPreparation(request).catch(() => {}); };
  const check = () => { if (options.signal?.aborted) throw new Error('Image preparation cancelled.'); };
  check();
  options.signal?.addEventListener('abort', abort, {once: true});
  try {
    const paths: string[] = await bridge.prepareVisionImages(
      attachments.map(attachment => attachment.uri), {identity: options.modelIdentity, maximumEdge: edge}, request,
    );
    check();
    if (paths.length !== attachments.length || paths.some(path => typeof path !== 'string' || !path.startsWith('file://'))) {
      throw new Error('Invalid prepared images.');
    }
    let index = 0;
    const prepared = messages.map(message => message.role === 'user' && !message.isSystemInfo && message.attachments
      ? {...message, attachments: message.attachments.map(attachment => attachment.type === 'image'
        ? {...attachment, uri: paths[index++]} : attachment)} : message);
    return await work(prepared);
  } finally {
    options.signal?.removeEventListener('abort', abort);
    await bridge.finishVisionPreparation(request);
  }
}
