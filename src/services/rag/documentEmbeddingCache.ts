import AsyncStorage from '@react-native-async-storage/async-storage';
const KEY='own-document-embeddings-v1';
const MAX_SERIALIZED_CHARS=750_000;
const MAX_ENTRIES=128;
const MAX_TEXT=4096;
export class DocumentEmbeddingCache {
 private identity:string|null=null;
 private loaded=false;
 private dirty=false;
 private entries=new Map<string,number[]>();
 async prepare(identity:string):Promise<void> {
  if(this.loaded && this.identity===identity) return;
  this.loaded=true;this.identity=identity;this.dirty=false;this.entries.clear();
  try {
   const raw=await AsyncStorage.getItem(KEY);
   if(!raw || raw.length>MAX_SERIALIZED_CHARS) return;
   const value=JSON.parse(raw);
   if(value?.version!==1 || value.identity!==identity || !Array.isArray(value.entries)) return;
   for(const entry of value.entries.slice(-MAX_ENTRIES)) {
    if(Array.isArray(entry) && typeof entry[0]==='string' && entry[0].length<=MAX_TEXT && validVector(entry[1])) this.entries.set(entry[0],entry[1]);
   }
  } catch { /* Cache failures never prevent indexing. */ }
 }
 get(text:string):number[]|undefined {
  const value=this.entries.get(text);
  if(!value) return;
  this.entries.delete(text);this.entries.set(text,value);
  return [...value];
 }
 put(text:string,vector:number[]):void {
  if(text.length>MAX_TEXT || !validVector(vector)) return;
  this.entries.delete(text);this.entries.set(text,[...vector]);this.dirty=true;
  while(this.entries.size>MAX_ENTRIES) this.entries.delete(this.entries.keys().next().value!);
 }
 async save():Promise<void> {
  if(!this.identity || !this.dirty) return;
  let raw=this.serialized();
  while(raw.length>MAX_SERIALIZED_CHARS && this.entries.size) {this.entries.delete(this.entries.keys().next().value!);raw=this.serialized();}
  try {await AsyncStorage.setItem(KEY,raw);this.dirty=false;} catch { /* Derived cache is optional. */ }
 }
 async clear():Promise<void> {
  this.entries.clear();this.identity=null;this.loaded=false;this.dirty=false;
  // Surface deletion failures so the UI does not claim complete cache deletion.
  await AsyncStorage.removeItem(KEY);
 }
 private serialized():string {return JSON.stringify({version:1,identity:this.identity,entries:[...this.entries]});}
}
function validVector(value:unknown):value is number[] {
 return Array.isArray(value) && value.length===384 && value.every(n=>typeof n==='number' && Number.isFinite(n)) && value.some(n=>n!==0);
}
export const documentEmbeddingCache=new DocumentEmbeddingCache();
