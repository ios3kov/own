import React from 'react';
import Svg,{Path,Rect} from 'react-native-svg';
export function ComposerIcon({name,color}:{name:'attach'|'options'|'send'|'stop';color:string}) {
 const paths={attach:'M8.5 14.5 15 8a2.1 2.1 0 0 1 3 3l-8 8a4 4 0 0 1-5.7-5.7l8.3-8.2a5.8 5.8 0 0 1 8.2 8.2L13 20.1',options:'M5 4v6m0 4v6m7-16v10m0 4v2m7-16v2m0 4v10M2.5 10h5M9.5 14h5M16.5 6h5',send:'M12 20V4m-6 6 6-6 6 6'};
 return <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
  {name==='stop'?<Rect x={6} y={6} width={12} height={12} rx={2} fill={color}/>:<Path d={paths[name]} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none"/>}
 </Svg>;
}
