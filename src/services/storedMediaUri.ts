import { localDocumentPath } from './localDocumentPath';

/** Resolve saved app files after an in-place iOS update changes the container UUID.
 * Resolve at use time so the original chat/image records remain untouched.
 */
export function storedMediaUri(uri: string): string {
  if (!uri.startsWith('/') && !uri.startsWith('file://')) return uri;
  try {
    const path = localDocumentPath(uri);
    return `file://${path.split('/').map(encodeURIComponent).join('/')}`;
  } catch {
    return uri;
  }
}
