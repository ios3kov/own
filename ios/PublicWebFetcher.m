#import <React/RCTBridgeModule.h>
@interface RCT_EXTERN_MODULE(PublicWebFetcher, NSObject)
RCT_EXTERN_METHOD(fetch:(NSString *)url resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
