import {useEffect} from 'react';
import {useAppStore} from '../stores/appStore';
import {APPLE_MODEL_ID,foundationModelService} from '../services/foundationModels';
import logger from '../utils/logger';

/** Own only runtime resources; selection/history/model records remain unchanged. */
export function installAppleSessionPolicy():()=>void {
  const release=()=>Promise.resolve(foundationModelService.releaseSessionCache?.()).catch(()=>{
   logger.warn('[Apple] Ready-session release could not complete.');
  });
  const unsubscribe=useAppStore.subscribe((state,previous)=>{
   const leftApple=previous.activeModelId===APPLE_MODEL_ID && state.activeModelId!==APPLE_MODEL_ID;
   const disabled=previous.settings.appleSessionReuseEnabled===true && state.settings.appleSessionReuseEnabled!==true;
   if(leftApple || disabled) void release();
  });
  return ()=>{unsubscribe();void release();};
}

export function useAppleSessionPolicy():void {
 useEffect(installAppleSessionPolicy,[]);
}
