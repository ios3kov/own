#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PDFExtractorModule, NSObject)

RCT_EXTERN_METHOD(extractText:(NSString *)filePath
                  maxChars:(double)maxChars
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(extractImageText:(NSString *)filePath maxChars:(double)maxChars resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(prepareVisionImages:(NSArray *)paths options:(NSDictionary *)options request:(NSString *)request resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(finishVisionPreparation:(NSString *)request resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

@end
