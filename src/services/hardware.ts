import logger from '../utils/logger';
import DeviceInfo from 'react-native-device-info';
// Access NativeModules.CoreMLDiffusionModule dynamically (not destructured)
// so it can be mocked in tests after module import.

import {
DeviceInfo as DeviceInfoType,
ModelRecommendation,
SoCInfo,ImageModelRecommendation
} from '../types';
import { MODEL_RECOMMENDATIONS,RECOMMENDED_MODELS } from '../constants';


class HardwareService {
  private cachedDeviceInfo: DeviceInfoType | null = null;
  private cachedSoCInfo: SoCInfo | null = null;
  private cachedImageRecommendation: ImageModelRecommendation | null = null;

  async getDeviceInfo(): Promise<DeviceInfoType> {
    if (this.cachedDeviceInfo) {
      return this.cachedDeviceInfo;
    }
    const [
      totalMemory,
      usedMemory,
      deviceModel,
      systemName,
      systemVersion,
      isEmulator,
    ] = await Promise.all([
      DeviceInfo.getTotalMemory(),
      DeviceInfo.getUsedMemory(),
      DeviceInfo.getModel(),
      DeviceInfo.getSystemName(),
      DeviceInfo.getSystemVersion(),
      DeviceInfo.isEmulator(),
    ]);
    this.cachedDeviceInfo = {
      totalMemory,
      usedMemory,
      availableMemory: totalMemory - usedMemory,
      deviceModel,
      systemName,
      systemVersion,
      isEmulator,
    };
    return this.cachedDeviceInfo;
  }
  async refreshMemoryInfo(): Promise<DeviceInfoType> {
    // Force fresh fetch of all memory info
    const [totalMemory, usedMemory] = await Promise.all([
      DeviceInfo.getTotalMemory(),
      DeviceInfo.getUsedMemory(),
    ]);
    if (!this.cachedDeviceInfo) {
      await this.getDeviceInfo();
    }
    if (this.cachedDeviceInfo) {
      this.cachedDeviceInfo.totalMemory = totalMemory;
      this.cachedDeviceInfo.usedMemory = usedMemory;
      this.cachedDeviceInfo.availableMemory = totalMemory - usedMemory;
    }
    return this.cachedDeviceInfo!;
  }
  /**
   * Get app-specific memory usage (more accurate for tracking model memory)
   * Note: This is system memory, native allocations may not be fully reflected
   */
  async getAppMemoryUsage(): Promise<{
    used: number;
    available: number;
    total: number;
  }> {
    const total = await DeviceInfo.getTotalMemory();
    const used = await DeviceInfo.getUsedMemory();
    return {
      used,
      available: total - used,
      total,
    };
  }
  getTotalMemoryGB(): number {
    if (!this.cachedDeviceInfo) {
      DeviceInfo.getTotalMemory()
        .then(mem => {
          if (this.cachedDeviceInfo) {
            this.cachedDeviceInfo.totalMemory = mem;
          }
        })
        .catch(error =>
          logger.warn('Failed to fetch total memory in background:', error),
        );
      return 4; // Safe default until cache is populated
    }
    return this.cachedDeviceInfo.totalMemory / (1024 * 1024 * 1024);
  }
  getAvailableMemoryGB(): number {
    if (!this.cachedDeviceInfo) {
      DeviceInfo.getTotalMemory()
        .then(mem => {
          if (this.cachedDeviceInfo) {
            this.cachedDeviceInfo.totalMemory = mem;
            this.cachedDeviceInfo.availableMemory =
              mem - (this.cachedDeviceInfo.usedMemory || 0);
          }
        })
        .catch(error =>
          logger.warn(
            'Failed to fetch available memory in background:',
            error,
          ),
        );
      return 2; // Safe default until cache is populated
    }
    return this.cachedDeviceInfo.availableMemory / (1024 * 1024 * 1024);
  }
  getModelRecommendation(): ModelRecommendation {
    const totalRamGB = this.getTotalMemoryGB();
    // Find the appropriate recommendation tier
    const tier =
      MODEL_RECOMMENDATIONS.memoryToParams.find(
        t => totalRamGB >= t.minRam && totalRamGB < t.maxRam,
      ) || MODEL_RECOMMENDATIONS.memoryToParams[0];
    // Filter recommended models based on device capability
    const compatibleModels = RECOMMENDED_MODELS.filter(
      m => m.minRam <= totalRamGB,
    ).map(m => m.id);
    let warning: string | undefined;
    if (totalRamGB < 4) {
      warning =
        'Your device has limited memory. Only the smallest models will work well.';
    } else if (this.cachedDeviceInfo?.isEmulator) {
      warning = 'Running in emulator. Performance may be significantly slower.';
    }
    return {
      maxParameters: tier.maxParams,
      recommendedQuantization: tier.quantization,
      recommendedModels: compatibleModels,
      warning,
    };
  }
  canRunModel(
    parametersBillions: number,
    quantization: string = 'Q4_K_M',
  ): boolean {
    const availableMemoryGB = this.getAvailableMemoryGB();
    // Estimate model memory requirement
    // Q4_K_M uses ~0.5 bytes per parameter + overhead
    const bitsPerWeight = this.getQuantizationBits(quantization);
    const modelSizeGB = (parametersBillions * bitsPerWeight) / 8;
    // Need at least 1.5x the model size for safe operation
    const requiredMemory = modelSizeGB * 1.5;
    return availableMemoryGB >= requiredMemory;
  }
  estimateModelMemoryGB(
    parametersBillions: number,
    quantization: string = 'Q4_K_M',
  ): number {
    const bitsPerWeight = this.getQuantizationBits(quantization);
    return (parametersBillions * bitsPerWeight) / 8;
  }
  private getQuantizationBits(quantization: string): number {
    const bits: Record<string, number> = { Q2_K: 2.625, Q3_K_S: 3.4375, Q3_K_M: 3.4375, Q4_0: 4, Q4_K_S: 4.5, Q4_K_M: 4.5, Q5_K_S: 5.5, Q5_K_M: 5.5, Q6_K: 6.5, Q8_0: 8, F16: 16 };
    for (const [key, value] of Object.entries(bits)) {
      if (quantization.toUpperCase().includes(key)) return value;
    }
    return 4.5;
  }
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  }
  getModelTotalSize(model: { fileSize?: number; size?: number; mmProjFileSize?: number }): number {
    return (model.fileSize || model.size || 0) + (model.mmProjFileSize || 0);
  }
  formatModelSize(model: { fileSize?: number; size?: number; mmProjFileSize?: number }): string {
    return this.formatBytes(this.getModelTotalSize(model));
  }
  estimateModelRam(model: { fileSize?: number; size?: number; mmProjFileSize?: number }, multiplier = 1.5): number {
    return this.getModelTotalSize(model) * multiplier;
  }
  formatModelRam(model: { fileSize?: number; size?: number; mmProjFileSize?: number }, multiplier = 1.5): string {
    return `~${(this.estimateModelRam(model, multiplier) / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  private detectAppleChip(deviceId: string): SoCInfo['appleChip'] {
    const match = /iPhone(\d+)/.exec(deviceId);
    if (!match) return undefined;
    const major = Number.parseInt(match[1], 10);
    if (major >= 17) return 'A18';
    if (major >= 16) return 'A17Pro';
    if (major >= 15) return 'A16';
    if (major >= 14) return 'A15';
    if (major >= 13) return 'A14';
    return undefined;
  }
  async getSoCInfo(): Promise<SoCInfo> {
    if (this.cachedSoCInfo) return this.cachedSoCInfo;
    const ramGB = this.getTotalMemoryGB();
    const appleChip = this.detectAppleChip(DeviceInfo.getDeviceId()) ?? (ramGB >= 6 ? 'A15' : 'A14');
    this.cachedSoCInfo = {vendor:'apple', hasNPU:true, appleChip};
    return this.cachedSoCInfo;
  }


  private getIosImageRec(chip: SoCInfo['appleChip'], ramGB: number): ImageModelRecommendation {
    const coreml = 'coreml';
    if ((chip === 'A17Pro' || chip === 'A18') && ramGB >= 6)
      return { recommendedBackend: coreml, recommendedModels: ['sdxl', 'xl-base'], bannerText: 'All models supported \u2014 SDXL for best quality', compatibleBackends: [coreml] };
    if ((chip === 'A15' || chip === 'A16') && ramGB >= 6)
      return { recommendedBackend: coreml, recommendedModels: ['v1-5-palettized', '2-1-base-palettized'], bannerText: 'SD 1.5 or SD 2.1 Palettized recommended', compatibleBackends: [coreml] };
    if (ramGB < 4)
      return { recommendedBackend: coreml, recommendedModels: ['low ram'], bannerText: 'Low RAM models recommended for your device', compatibleBackends: [coreml] };
    return { recommendedBackend: coreml, recommendedModels: ['v1-5-palettized', '2-1-base-palettized'], bannerText: 'SD 1.5 or SD 2.1 Palettized recommended for your device', compatibleBackends: [coreml] };
  }

  async getImageModelRecommendation(): Promise<ImageModelRecommendation> {
    if (this.cachedImageRecommendation) return this.cachedImageRecommendation;
    const socInfo = await this.getSoCInfo();
    const ramGB = this.getTotalMemoryGB();
    let rec: ImageModelRecommendation;
    {
      rec = this.getIosImageRec(socInfo.appleChip, ramGB);
    }
    if (ramGB < 4) {
      rec.warning = 'Low RAM \u2014 expect slower performance';
    }
    this.cachedImageRecommendation = rec;
    return rec;
  }
  getDeviceTier(): 'low' | 'medium' | 'high' | 'flagship' {
    const ramGB = this.getTotalMemoryGB();
    if (ramGB < 4) return 'low';
    if (ramGB < 6) return 'medium';
    if (ramGB < 8) return 'high';
    return 'flagship';
  }
  async getCpuCoreCount(): Promise<number> { return 4; }
  async getRecommendedThreadCount(): Promise<number> {
    const cores = await this.getCpuCoreCount();
    return cores <= 4 ? cores : Math.floor(cores * 0.8);
  }

}
export const hardwareService = new HardwareService();
