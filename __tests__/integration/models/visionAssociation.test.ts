import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {modelManager} from '../../../src/services/modelManager';
import {createDownloadedModel} from '../../utils/factories';

describe('startup vision association',()=>{
 beforeEach(()=>{jest.clearAllMocks();(RNFS.exists as jest.Mock).mockResolvedValue(true);});
 it('keeps an unlinked vision model unlinked despite a matching file on disk',async()=>{
  const model=createDownloadedModel({id:'vision-fixture',name:'Synthetic Vision',fileName:'fixture-Q4_K_M.gguf',filePath:'/models/fixture.gguf',isVisionModel:false});
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([model]));
  (RNFS.readDir as jest.Mock).mockResolvedValue([{name:'fixture-mmproj.gguf',path:'/models/fixture-mmproj.gguf',isFile:()=>true}]);
  await modelManager.linkOrphanMmProj();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(RNFS.readDir).not.toHaveBeenCalled();
 });
 it('keeps an explicit association even when its filename differs',async()=>{
  const model=createDownloadedModel({id:'vision-fixture',mmProjPath:'/models/chosen-companion.gguf',isVisionModel:true});
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([model]));
  await modelManager.linkOrphanMmProj();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
 });
});
