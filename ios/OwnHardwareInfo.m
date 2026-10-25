#import <React/RCTBridgeModule.h>
@interface RCT_EXTERN_MODULE(OwnHardwareInfo, NSObject)
RCT_EXTERN_METHOD(memory:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(status:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
