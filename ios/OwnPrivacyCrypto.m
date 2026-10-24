#import <React/RCTBridgeModule.h>
#import "OwnPrivacyCrypto.h"

@interface OwnPrivacyCrypto : NSObject <RCTBridgeModule>
@end

@implementation OwnPrivacyCrypto
RCT_EXPORT_MODULE(PrivacyCrypto)

+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_EXPORT_METHOD(createVerifier:(NSString *)password
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSString *verifier = OwnCreatePassphraseVerifier(password);
    if (verifier) resolve(verifier);
    else reject(@"CRYPTO_FAILED", @"Could not protect the app passphrase.", nil);
  });
}

RCT_EXPORT_METHOD(verifyPassphrase:(NSString *)password
                  verifier:(NSString *)verifier
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    resolve(@(OwnVerifyPassphrase(password, verifier)));
  });
}
@end
