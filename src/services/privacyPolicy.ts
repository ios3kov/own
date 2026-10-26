// Compare every host suffix to preserve subdomain blocking. These fingerprints
// keep retired identities out of the product. This is a deny list, not a firewall.
const DENIED_HOST_FINGERPRINTS = new Set(["4186571e2d463220", "ffbc225e6a7ed3e0", "c3a518bf3a65ba95", "b379f12b4fc64fd5"]);
export const PRIVACY_BLOCK_MESSAGE = 'This destination is blocked in your personal app.';
function hostFingerprint(host: string): string {
  let first = 2166136261, second = 3339675911;
  for (let i = 0; i < host.length; i++) {
    first = Math.imul(first ^ host.charCodeAt(i), 16777619) >>> 0;
    second = Math.imul(second ^ host.charCodeAt(i), 16777619) >>> 0;
  }
  return first.toString(16).padStart(8, '0') + second.toString(16).padStart(8, '0');
}
export function isDeveloperDestination(raw: string): boolean {
  const host = new URL(raw).hostname.toLowerCase().replace(/\.+$/, '');
  const labels = host.split('.');
  return labels.some((_, i) => DENIED_HOST_FINGERPRINTS.has(hostFingerprint(labels.slice(i).join('.'))));
}
export function assertAllowedDestination(raw: string): void {
  if (isDeveloperDestination(raw)) throw new Error(PRIVACY_BLOCK_MESSAGE);
}
