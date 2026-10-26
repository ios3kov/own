import { Alert, Linking } from 'react-native';
import { assertAllowedDestination, PRIVACY_BLOCK_MESSAGE } from './privacyPolicy';

/** Install before loading App, so module-level services cannot capture the old clients. */
export function installPrivacyGuard(): () => void {
  const fetchBefore = globalThis.fetch;
  const openBefore = globalThis.XMLHttpRequest.prototype.open;
  const linkingBefore = Linking.openURL;
  const socketBefore = globalThis.WebSocket;

  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    assertAllowedDestination(url);
    return fetchBefore(input, init);
  };

  globalThis.XMLHttpRequest.prototype.open = function (...args: [method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null]) {
    const [method, url, async = true, username, password] = args;
    assertAllowedDestination(String(url));
    return openBefore.call(this, method, String(url), async, username, password);
  };

  if (socketBefore) {
    globalThis.WebSocket = class extends socketBefore {
      constructor(...args: ConstructorParameters<typeof WebSocket>) {
        assertAllowedDestination(String(args[0]));
        super(...args);
      }
    };
  }

  Linking.openURL = async (url: string) => {
    try {
      assertAllowedDestination(url);
    } catch {
      Alert.alert('Connection blocked', PRIVACY_BLOCK_MESSAGE);
      return;
    }
    return linkingBefore.call(Linking, url);
  };

  return () => {
    globalThis.fetch = fetchBefore;
    globalThis.XMLHttpRequest.prototype.open = openBefore;
    globalThis.WebSocket = socketBefore;
    Linking.openURL = linkingBefore;
  };
}
