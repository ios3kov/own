#import <React/RCTBridgeModule.h>
@interface RCT_EXTERN_MODULE(AudioImport, NSObject)
RCT_EXTERN_METHOD(prepare:(NSString *)path resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
