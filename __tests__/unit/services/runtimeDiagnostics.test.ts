import {NativeModules} from 'react-native';
import {processMemorySnapshot} from '../../../src/services/runtimeDiagnostics';
it('keeps unavailable/invalid memory readings unknown and distinguishes process-lifetime peak',async()=>{
 NativeModules.OwnHardwareInfo={memory:jest.fn().mockResolvedValue({currentBytes:100,peakBytes:200})};
 expect(await processMemorySnapshot()).toEqual({currentBytes:100,peakBytes:200});
 NativeModules.OwnHardwareInfo.memory.mockResolvedValue({currentBytes:100,peakBytes:50});expect(await processMemorySnapshot()).toEqual({currentBytes:100,peakBytes:undefined});
 for(const value of [null,{}, {currentBytes:-1}, {currentBytes:NaN},{currentBytes:1.5}]) {NativeModules.OwnHardwareInfo.memory.mockResolvedValue(value);expect(await processMemorySnapshot()).toBeNull();}
 NativeModules.OwnHardwareInfo.memory.mockRejectedValue(new Error('unavailable'));expect(await processMemorySnapshot()).toBeNull();
});
