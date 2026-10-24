import { chooseModelFile, downloadableChoices } from '../../../src/utils/modelFileChoice';
const file = (quantization: string, size = 1e9): any => ({name:`model-${quantization}.gguf`,size,quantization});
it('suggests only a real available file when Q4_K_M is absent', () => {
 const files = [file('Q8_0',2e9),file('Q4_0')];
 expect(chooseModelFile(files,8)).toBe(files[1]);
 expect(chooseModelFile(files,8)?.name).not.toContain('Q4_K_M');
});
it('includes the vision companion in the memory estimate and rejects split/unknown-size files', () => {
 expect(downloadableChoices([{...file('Q4_K_M',1e9),mmProjFile:{size:6e9}},file('Q4_0',0),{...file('Q4_K_M'),name:'m-00001-of-00002.gguf'}],8)).toEqual([]);
 expect(chooseModelFile([file('Q4_K_M',20e9)],8)).toBeUndefined();
});
