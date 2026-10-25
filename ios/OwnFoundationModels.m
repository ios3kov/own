#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
@interface RCT_EXTERN_MODULE(OwnFoundationModels, RCTEventEmitter)
RCT_EXTERN_METHOD(inspectLanguage:(NSString *)text resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(availability:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(generate:(NSDictionary *)params resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(cancel:(NSString *)requestId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(resolveTool:(NSString *)requestId callId:(NSString *)callId output:(NSString *)output)
@end
