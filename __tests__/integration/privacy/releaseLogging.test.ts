import RNFS from 'react-native-fs';
import { documentService } from '../../../src/services/documentService';

describe('document privacy in Release logging',()=>{
  it('reads a local document without writing its path or contents to console',async()=>{
    const previous=(global as any).__DEV__;
    const spies=[jest.spyOn(console,'log'),jest.spyOn(console,'warn'),jest.spyOn(console,'error')];
    try {
      (global as any).__DEV__=false;
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      (RNFS.stat as jest.Mock).mockResolvedValue({size:26});
      (RNFS.readFile as jest.Mock).mockResolvedValue('Synthetic private passage.');
      const result=await documentService.processDocumentFromPath('/mock/documents/private-qa.txt','private-qa.txt');
      expect(result?.textContent).toBe('Synthetic private passage.');
      expect(RNFS.readFile).toHaveBeenCalled();
      for(const spy of spies)expect(spy).not.toHaveBeenCalled();
    } finally {
      (global as any).__DEV__=previous;
      spies.forEach(spy=>spy.mockRestore());
    }
  });
});
