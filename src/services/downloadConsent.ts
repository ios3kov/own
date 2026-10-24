import { Alert, NativeModules } from 'react-native';

export interface ModelDownloadPlan {
  name: string;
  files: { size: number | null | undefined; url?: string }[];
  estimated?: boolean;
}
export class DownloadCancelledError extends Error {
  constructor() {
    super('Download cancelled.');
    this.name = 'DownloadCancelledError';
  }
}
function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1000)} kB`;
}
export function describeDownload(plan: ModelDownloadPlan): string {
  const known =
    plan.files.length > 0 &&
    plan.files.every(
      file =>
        typeof file.size === 'number' &&
        Number.isFinite(file.size) &&
        file.size > 0,
    );
  const size = known
    ? `${plan.estimated ? 'About ' : ''}${formatBytes(
        plan.files.reduce((total, file) => total + (file.size || 0), 0),
      )}`
    : 'The full download size is not yet known.';
  return `${plan.name}\n${
    known ? 'Total model files: ' : ''
  }${size}\n\nUse Wi-Fi for large downloads to avoid mobile data charges. Models may need extra space to unpack.`;
}
async function resolveDownloadSizes(
  plan: ModelDownloadPlan,
): Promise<ModelDownloadPlan> {
  let estimated = false;
  const files = await Promise.all(
    plan.files.map(async file => {
      const known =
        typeof file.size === 'number' &&
        file.size > 0 &&
        Number.isFinite(file.size);
      if (known && !plan.estimated) return file;
      if (!file.url || !/^https?:\/\//i.test(file.url)) {
        estimated ||= !!plan.estimated;
        return file;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(file.url, {
          method: 'HEAD',
          signal: controller.signal,
        });
        const bytes = Number(response.headers?.get('content-length'));
        if (response.ok && Number.isSafeInteger(bytes) && bytes > 0)
          return { ...file, size: bytes };
      } catch {
        /* Preserve an honest estimate/unknown value. */
      } finally {
        clearTimeout(timeout);
      }
      estimated ||= !!plan.estimated;
      return file;
    }),
  );
  return { ...plan, files, estimated };
}
type NetworkStatus = { kind: string; expensive?: boolean };
async function readNetwork(): Promise<NetworkStatus> {
  try {
    return (
      (await NativeModules.OwnNetworkInfo?.status()) || { kind: 'unknown' }
    );
  } catch {
    return { kind: 'unknown' };
  }
}
function networkRisk(network: NetworkStatus): number {
  if (network.kind === 'cellular') return 3;
  if (network.expensive) return 2;
  if (network.kind === 'unknown' || network.kind === 'unavailable') return 1;
  return 0;
}
const pending = new Set<string>();
export async function requestDownloadConsent(
  plan: ModelDownloadPlan,
): Promise<boolean> {
  if (pending.has(plan.name)) return false;
  pending.add(plan.name);
  try {
    const resolvedPlan = await resolveDownloadSizes(plan);
    let network = await readNetwork();
    let acknowledgedRisk = -1;
    while (networkRisk(network) > acknowledgedRisk) {
      acknowledgedRisk = networkRisk(network);
      const mobile = network.kind === 'cellular';
      const metered = !mobile && network.expensive;
      const warning = mobile
        ? '\n\nYou are using mobile data. This download may use a large part of your data allowance.'
        : metered
        ? '\n\nThis connection may charge for data.'
        : network.kind === 'unknown'
        ? '\n\nYour network type could not be verified. The download may use mobile data.'
        : network.kind === 'unavailable'
        ? '\n\nNo connection is available. A requested background download may wait for connectivity.'
        : '';
      const approved = await new Promise<boolean>(resolve => {
        Alert.alert(
          'Download model?',
          `${
            describeDownload(resolvedPlan) + warning
          }\n\nYour connection may change while a background download continues.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: mobile
                ? 'Download over mobile data'
                : metered
                ? 'Download on this connection'
                : 'Download',
              onPress: () => resolve(true),
            },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      });
      if (!approved) return false;
      network = await readNetwork();
    }
    return true;
  } finally {
    pending.delete(plan.name);
  }
}
export async function requireDownloadConsent(
  plan: ModelDownloadPlan,
): Promise<void> {
  if (!(await requestDownloadConsent(plan))) throw new DownloadCancelledError();
}
