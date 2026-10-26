import { keepLocalCopy } from '@react-native-documents/picker';
import { resolvePickedFileUri } from '../../../src/utils/resolvePickedFileUri';
jest.mock('@react-native-documents/picker',()=>({keepLocalCopy:jest.fn()}));
const copy = keepLocalCopy as jest.Mock;
describe('permanent imported documents',()=>{
  beforeEach(()=>jest.clearAllMocks());
  it('retains a unique permanent copy before returning its decoded path',async()=>{
    copy.mockResolvedValue([{status:'success',localUri:'file:///mock/documents/unique/my%20file.pdf'}]);
    await expect(resolvePickedFileUri('file:///tmp/picker/file.pdf','my file.pdf')).resolves.toBe('/mock/documents/unique/my file.pdf');
    expect(copy).toHaveBeenCalledWith({files:[{uri:'file:///tmp/picker/file.pdf',fileName:'my file.pdf'}],destination:'documentDirectory'});
  });
  it.each([[],[{status:'error'}],[{status:'success',localUri:null}]].map(result=>[result]))('rejects a failed copy without using a temporary original: %j',async result=>{
    copy.mockResolvedValue(result);
    await expect(resolvePickedFileUri('file:///tmp/picker/file.pdf','file.pdf')).rejects.toThrow('Failed to create');
  });
  it('preserves the actual storage error',async()=>{
    copy.mockRejectedValue(new Error('Storage full'));
    await expect(resolvePickedFileUri('file:///tmp/file.pdf','file.pdf')).rejects.toThrow('Storage full');
  });
  it.each(['../file.pdf','/file.pdf','folder/file.pdf','folder\\file.pdf','bad\nfile.pdf','','.','..'])('rejects an unsafe filename before native storage: %s',async name=>{
    await expect(resolvePickedFileUri('file:///tmp/a',name)).rejects.toThrow('Invalid');
    expect(copy).not.toHaveBeenCalled();
  });
});
