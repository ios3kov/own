import {renderHook,act} from '@testing-library/react-native';
import RNFS from 'react-native-fs';
import {pick,keepLocalCopy} from '@react-native-documents/picker';
import {useAttachments} from '../../../src/components/ChatInput/Attachments';
import {resetStores} from '../../utils/testHelpers';

describe('Files picker to structured chat attachment',()=>{
 it('copies provider data locally before reading a CSV and keeps its table content',async()=>{
  resetStores();jest.clearAllMocks();
  (pick as jest.Mock).mockResolvedValue([{uri:'file:///provider/amounts.csv',name:'amounts.csv'}]);
  (keepLocalCopy as jest.Mock).mockResolvedValue([{status:'success',localUri:'file:///mock/documents/amounts.csv'}]);
  (RNFS.stat as jest.Mock).mockResolvedValue({size:30});
  (RNFS.exists as jest.Mock).mockResolvedValue(true);
  (RNFS.readFile as jest.Mock).mockResolvedValue('Name,Amount\nA,2\nB,3');
  (RNFS.copyFile as jest.Mock).mockResolvedValue(undefined);
  const alert=jest.fn();const {result}=renderHook(()=>useAttachments(alert));
  await act(async()=>{await result.current.handlePickDocument();});
  expect(keepLocalCopy).toHaveBeenCalledWith({files:[{uri:'file:///provider/amounts.csv',fileName:'amounts.csv'}],destination:'documentDirectory'});
  expect(result.current.attachments).toHaveLength(1);
  expect(result.current.attachments[0].textContent).toContain('"columns":["Name","Amount"]');
  expect(result.current.attachments[0].textContent).toContain('["B","3"]');
  expect(alert).not.toHaveBeenCalled();
  expect(result.current.processingAttachment).toBe(false);
 });
});
