const BLOCKS=[['<think>','</think>'],['<tool_call>','</tool_call>'],['<|tool_call>','<tool_call|>'],['<|channel>thought\n','<channel|>'],['<|channel|>analysis<|message|>','<|channel|>final<|message|>']] as const;

/** Commit closed lines or bounded, whitespace-ended spans. Protected markup retains its context. */
export class IncrementalSpeechText {
 private previous='';private committed='';private offset=0;private cursor=0;
 private end='';private cached='';private wasFinal=false;
 constructor(private readonly sanitize:(raw:string,final?:boolean)=>string) {}
 reset():void {this.previous='';this.committed='';this.offset=0;this.cursor=0;this.end='';this.cached='';this.wasFinal=false;}
 get(raw:string,final=false):string {
  if(raw===this.previous && final===this.wasFinal) return this.cached;
  if(!raw.startsWith(this.previous)) this.reset();
  const boundary=this.scan(raw);
  if(boundary>this.offset) {
   const part=this.clean(raw.slice(this.offset,boundary),this.committed.length===0 || this.committed.endsWith('\n'));
   // Keep leading whitespace with its upcoming heading/list instead of committing it.
   if(part.endsWith('\n') || /\S/.test(part.slice(part.lastIndexOf('\n')+1))) {
    this.committed=this.join(this.committed,part);this.offset=boundary;
   }
  }
  this.cached=this.join(this.committed,this.clean(raw.slice(this.offset),this.committed.length===0 || this.committed.endsWith('\n'),final));
  this.previous=raw;this.wasFinal=final;
  return this.cached;
 }
 private clean(part:string,lineStart:boolean,final=false):string {
  // Prevent a mid-line "1. " or "- " from being treated as a new Markdown list.
  return lineStart ? this.sanitize(part,final) : this.sanitize(`x${part}`,final).slice(1);
 }
 private join(left:string,right:string):string {
  // The full sanitizer collapses whitespace even across a committed span boundary.
  return left+(left.endsWith(' ') && right.startsWith(' ') ? right.slice(1) : right);
 }
 private scan(raw:string):number {
  let boundary=this.offset;
  while(this.cursor<raw.length) {
   if(this.end) {
    const relative=raw.slice(this.cursor).toLowerCase().indexOf(this.end);
    const index=relative<0 ? -1 : this.cursor+relative;
    if(index<0) {this.cursor=Math.max(this.cursor,raw.length-this.end.length+1);break;}
    this.cursor=index+this.end.length;this.end='';continue;
   }
   const char=raw[this.cursor];
   if(char==='<' && !this.readTag(raw)) break;
   if(char==='<') continue;
   if(char==='`' || char==='~') {
    if(!this.readCode(raw,char)) break;
    continue;
   }
   if(char==='[') {
    const close=raw.indexOf(']',this.cursor+1);
    if(close<0) break;
    if(/^\d+$/.test(raw.slice(this.cursor+1,close))) {this.cursor=close+1;continue;}
    this.end=')';this.cursor+=1;continue;
   }
   if(char==='\n' || ((char===' ' || char==='\t') && this.cursor-this.offset>=512 && this.cursor+1<raw.length)) boundary=this.cursor+1;
   this.cursor+=1;
  }
  return boundary;
 }
 private readTag(raw:string):boolean {
  const tail=raw.slice(this.cursor).toLowerCase();
  const block=BLOCKS.find(([open])=>tail.startsWith(open));
  if(block) {this.cursor+=block[0].length;this.end=block[1];return true;}
  if(BLOCKS.some(([open])=>open.startsWith(tail))) return false;
  if(/^<\/?[a-z]/i.test(tail)) {
   const close=raw.indexOf('>',this.cursor);
   if(close<0) return false;
   this.cursor=close+1;return true;
  }
  this.cursor+=1;return true;
 }
 private readCode(raw:string,char:string):boolean {
  let count=1;while(raw[this.cursor+count]===char) count+=1;
  if(this.cursor+count===raw.length) return false;
  this.cursor+=count;
  if(char==='`' || count>=3) this.end=char.repeat(count);
  return true;
 }
}
