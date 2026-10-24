import RNFS from 'react-native-fs';

/** Keep the exact relative target when iOS relocates an application's sandbox. */
export function localDocumentPath(storedPath: string): string {
  let path = storedPath;
  if (path.startsWith('file://')) {
    try { path = decodeURIComponent(path.slice(7)); }
    catch { throw new Error('The original document cannot be opened.'); }
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') ||
      Array.from(path).some(character => character.charCodeAt(0) < 32) ||
      path.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('The original document cannot be opened.');
  }
  // Match a complete iOS app-container boundary, never a filename or a loose suffix.
  const moved = path.match(/^.*\/Containers\/Data\/Application\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/(Documents|Library\/Caches|tmp)\/(.+)$/i);
  if (!moved) return path;
  const roots: Record<string, string> = {
    Documents: RNFS.DocumentDirectoryPath,
    'Library/Caches': RNFS.CachesDirectoryPath,
    tmp: RNFS.TemporaryDirectoryPath,
  };
  const root = roots[moved[1]];
  if (!root) throw new Error('The original document cannot be opened.');
  return `${root.replace(/\/$/, '')}/${moved[2]}`;
}
