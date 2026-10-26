import {waitFor} from '@testing-library/react-native';
jest.mock('react-native',()=>{
 return {Platform:{OS:'ios'}, NativeModules:{CoreMLDiffusionModule:{loadModel:jest.fn()}},
 NativeEventEmitter:jest.fn(()=>({addListener:jest.fn(()=>({remove:jest.fn()}))}))};
});
import {NativeModules,NativeEventEmitter} from 'react-native';
import {coreMLImageGeneratorService} from '../../../src/services/coreMLImageGenerator';
import {useModelLoadStore} from '../../../src/stores/modelLoadStore';

describe('native model loading progress wiring',()=>{
 it('shows phases while loading and clears progress after native failure',async()=>{
  let rejectLoad!:(error:Error)=>void;
  NativeModules.CoreMLDiffusionModule.loadModel=jest.fn(()=>new Promise((_resolve,reject)=>{rejectLoad=reject;}));
  const loading=coreMLImageGeneratorService.loadModel('/fixture/model');
  expect(useModelLoadStore.getState()).toMatchObject({active:true,type:'image'});
  // The bridge event listener itself is mocked; loading lifecycle uses the real service and store.
  expect(NativeEventEmitter).toHaveBeenCalled();
  await waitFor(() => expect(rejectLoad).toBeDefined());
  rejectLoad(new Error('Synthetic load failure'));
  await expect(loading).rejects.toThrow('Synthetic load failure');
  expect(useModelLoadStore.getState().active).toBe(false);
 });
});
