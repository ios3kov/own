import { NativeModules } from 'react-native';

it('releases timed-out native weights before the queued replacement can become ready', async () => {
  const order: string[] = [];
  let finish!: (value: boolean) => void;
  NativeModules.CoreMLDiffusionModule = {
    loadModel: jest.fn().mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}))
      .mockImplementationOnce(async () => {order.push('new ready');return true;}),
    unloadModel: jest.fn(async () => {order.push('old released');return true;}),
    addListener: jest.fn(), removeListeners: jest.fn(),
  };
  const {coreMLImageGeneratorService: service} = require('../../../src/services/coreMLImageGenerator');
  const abort = new AbortController();
  const old = service.loadModel('/old',4,{signal:abort.signal}).catch((error: Error) => error);
  while (!finish) await Promise.resolve();
  abort.abort();
  const next = service.loadModel('/new',4);
  finish(true);
  expect((await old).message).toContain('cancelled');
  await next;
  expect(order).toEqual(['old released','new ready']);
});
