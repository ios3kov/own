import { storedMediaUri } from '../../../src/services/storedMediaUri';
const old = '/var/mobile/Containers/Data/Application/11111111-1111-1111-1111-111111111111';
describe('saved media after an iOS container move', () => {
  it('relocates absolute and encoded file URLs without changing filenames', () => {
    expect(storedMediaUri(`${old}/Documents/generated_images/puppy.png`)).toBe('file:///mock/documents/generated_images/puppy.png');
    expect(storedMediaUri(`file://${old}/Documents/My%20dog%23one.png`)).toBe('file:///mock/documents/My%20dog%23one.png');
  });
  it('keeps external URLs and malformed saved values unchanged', () => {
    expect(storedMediaUri('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(storedMediaUri('file:///a/%ZZ')).toBe('file:///a/%ZZ');
  });
});
