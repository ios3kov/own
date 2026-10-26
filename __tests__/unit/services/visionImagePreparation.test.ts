const mockPrepare = jest.fn();
const mockFinish = jest.fn().mockResolvedValue(true);
jest.mock('react-native', () => ({NativeModules: {PDFExtractorModule: {
  prepareVisionImages: (...args: unknown[]) => mockPrepare(...args),
  finishVisionPreparation: (...args: unknown[]) => mockFinish(...args),
}}}));
import {withPreparedVisionMessages} from '../../../src/services/visionImagePreparation';
import type {Message} from '../../../src/types';
const messages = [{id: 'one', role: 'user', content: 'Read this', attachments: [
  {id: 'photo', type: 'image', uri: 'file:///original.jpg'},
]}] as Message[];
beforeEach(() => {jest.clearAllMocks(); mockPrepare.mockResolvedValue(['file:///derived.png']);});
test('only request copy receives prepared paths; native lease spans completion', async () => {
  const snapshot = JSON.stringify(messages);
  await withPreparedVisionMessages(messages, {modelIdentity: 'model/vision-v1'}, async mockPrepared => {
    expect(mockPrepared[0].attachments?.[0].uri).toBe('file:///derived.png');
    expect(mockFinish).not.toHaveBeenCalled();
    expect(JSON.stringify(messages)).toBe(snapshot);
  });
  expect(mockPrepare.mock.calls[0].slice(0, 2)).toEqual([['file:///original.jpg'], {identity: 'model/vision-v1', maximumEdge: 1024}]);
  expect(mockFinish).toHaveBeenCalledTimes(1);
  expect(mockFinish).toHaveBeenCalledWith(mockPrepare.mock.calls[0][2]);
});
test('failed completion releases lease', async () => {
  await expect(withPreparedVisionMessages(messages, {modelIdentity: 'model'}, async () => {throw new Error('failed');})).rejects.toThrow('failed');
  expect(mockFinish).toHaveBeenCalledTimes(1);
});
test('abort rejects late prepared images without invoking the engine', async () => {
  const controller = new AbortController();
  let complete!: (paths: string[]) => void;
  mockPrepare.mockImplementation(() => new Promise(resolve => {complete = resolve;}));
  const work = jest.fn();
  const pending = withPreparedVisionMessages(messages, {modelIdentity: 'model', signal: controller.signal}, work);
  controller.abort();
  complete(['file:///late.png']);
  await expect(pending).rejects.toThrow('cancelled');
  expect(work).not.toHaveBeenCalled();
  expect(mockFinish).toHaveBeenCalled();
});
test('text requests do not call the native image path', async () => {
  await withPreparedVisionMessages([], {modelIdentity: 'model'}, async mockPrepared => expect(mockPrepared).toEqual([]));
  expect(mockPrepare).not.toHaveBeenCalled();
});

test('already cancelled text request cannot restart completion', async () => {
  const controller = new AbortController();
  controller.abort();
  const work = jest.fn();
  await expect(withPreparedVisionMessages([], {modelIdentity: 'model', signal: controller.signal}, work)).rejects.toThrow('cancelled');
  expect(work).not.toHaveBeenCalled();
  expect(mockPrepare).not.toHaveBeenCalled();
});
