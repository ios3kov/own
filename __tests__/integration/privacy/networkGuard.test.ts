function decodeFixture(text: string): string { return Buffer.from(text, 'base64').toString('utf8'); }
import 'react-native-url-polyfill/auto';
import { Alert, Linking } from 'react-native';
import { installPrivacyGuard } from '../../../src/services/privacyGuard';
import { executeToolCall } from '../../../src/services/tools/handlers';

describe('installed network guard and actual callers', () => {
  let restore: () => void;
  let originalFetch: typeof fetch;
  let originalLink: typeof Linking.openURL;
  let transport: jest.Mock;
  const originalXHR = globalThis.XMLHttpRequest;
  const originalSocket = globalThis.WebSocket;
  beforeEach(() => {
    // Only transport endpoints are mocked; the installed guard and tool logic are real.
    globalThis.XMLHttpRequest = class { open() {} } as any;
    globalThis.WebSocket = class {} as any;
    originalFetch = globalThis.fetch;
    originalLink = Linking.openURL;
    transport = jest.fn().mockResolvedValue({status: 200, text: async () => '<div class="g"><a href="https://example.com"><h3>Example</h3></a></div>'});
    globalThis.fetch = transport;
    Linking.openURL = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    restore = installPrivacyGuard();
  });
  afterEach(() => {
    restore?.();
    globalThis.fetch = originalFetch;
    Linking.openURL = originalLink;
    globalThis.XMLHttpRequest = originalXHR;
    globalThis.WebSocket = originalSocket;
    jest.restoreAllMocks();
  });
  it.each([decodeFixture('aHR0cHM6Ly9nZXRvZmZncmlkYWkuY28vcHJpdmF0ZQ=='), decodeFixture('aHR0cHM6Ly9BUEkuV0VETkVTREFZLklTLi9jb2xsZWN0'), decodeFixture('aHR0cHM6Ly9saWNlbnNpbmcua2V5Z2VuLnNo')])('blocks %s before fetch transport', async url => {
    await expect(fetch(url)).rejects.toThrow('blocked');
    expect(transport).not.toHaveBeenCalled();
  });
  it('allows the real Google tool through the guard and parser', async () => {
    const response = await executeToolCall({id: 'privacy-test', name: 'web_search', arguments: {query: 'synthetic query'}});
    expect(response.error).toBeUndefined();
    expect(response.content).toContain('Example');
    expect(transport.mock.calls[0][0]).toContain('https://www.google.com/search?q=synthetic%20query');
  });
  it('does not block a host just because a query mentions the developer', async () => {
    await fetch(decodeFixture('aHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9zZWFyY2g/cT1nZXRvZmZncmlkYWkuY28='));
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('blocks native XHR and WebSocket entry points before connection', () => {
    expect(() => new XMLHttpRequest().open('GET', decodeFixture('aHR0cHM6Ly9nZXRvZmZncmlkYWkuY28='))).toThrow('blocked');
    expect(() => new WebSocket(decodeFixture('d3NzOi8vZ2V0b2ZmZ3JpZGFpLmNv'))).toThrow('blocked');
  });
  it('blocks a developer link with a local message', async () => {
    await Linking.openURL(decodeFixture('aHR0cHM6Ly93ZWRuZXNkYXkuaXM='));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });
  it('allows explicitly requested external links', async () => {
    await expect(Linking.openURL('https://example.com')).resolves.toBeUndefined();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
