/** Filename identity is conservative; native loading must still validate the pair. */
export function projectorCandidates<T extends {path:string}>(modelPath:string, projectors:T[], modelPaths:string[]):T[] {
 const directory=(path:string)=>path.slice(0,path.lastIndexOf('/')+1);
 const identity=(path:string)=>path.split('/').pop()!.toLowerCase().replace(/\.gguf$/,'')
  .replace(/(?:^|[-_.])(?:mmproj|projector)(?:[-_.]|$)/g,'-')
  .replace(/[-_.](?:q\d|iq\d|f\d|fp\d|bf\d).*$/i,'').replace(/[^a-z0-9]/g,'');
 const family=identity(modelPath);
 if(!family)return [];
 const named=projectors.filter(file=>identity(file.path)===family);
 if(named.length)return named;
 // Generic components can belong to the whole repository only when it has a
 // single model identity. Never borrow one from another model/directory.
 if(new Set(modelPaths.map(identity)).size!==1)return [];
 return projectors.filter(file=>!identity(file.path)&&directory(file.path)===directory(modelPath));
}
