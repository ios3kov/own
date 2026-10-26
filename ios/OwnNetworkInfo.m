#import <React/RCTBridgeModule.h>
@interface RCT_EXTERN_MODULE(OwnNetworkInfo, NSObject)
RCT_EXTERN_METHOD(status:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
