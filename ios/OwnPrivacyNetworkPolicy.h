#import <Foundation/Foundation.h>

static inline NSString *OwnHostFingerprint(NSString *host) {
  uint32_t first = 2166136261u, second = 3339675911u;
  NSData *data = [host dataUsingEncoding:NSUTF8StringEncoding];
  const uint8_t *bytes = (const uint8_t *)data.bytes;
  for (NSUInteger i = 0; i < data.length; i++) {
    first = (first ^ bytes[i]) * 16777619u;
    second = (second ^ bytes[i]) * 16777619u;
  }
  return [NSString stringWithFormat:@"%08x%08x", first, second];
}
// Destination fingerprints preserve the deny list without retired identities.
static inline BOOL OwnPrivacyAllowsURL(NSURL *url) {
  NSString *scheme = url.scheme.lowercaseString;
  if (![scheme isEqualToString:@"https"] && ![scheme isEqualToString:@"http"]) return NO;
  NSString *host = url.host.lowercaseString;
  while ([host hasSuffix:@"."]) host = [host substringToIndex:host.length - 1];
  if (host.length == 0) return NO;
  NSArray *denied = @[@"4186571e2d463220", @"ffbc225e6a7ed3e0", @"c3a518bf3a65ba95", @"b379f12b4fc64fd5"];
  NSArray<NSString *> *labels = [host componentsSeparatedByString:@"."];
  for (NSUInteger i = 0; i < labels.count; i++) {
    NSString *suffix = [[labels subarrayWithRange:NSMakeRange(i, labels.count - i)] componentsJoinedByString:@"."];
    if ([denied containsObject:OwnHostFingerprint(suffix)]) return NO;
  }
  return YES;
}
static inline BOOL OwnPrivacyAllowsRedirect(NSURL *source, NSURL *destination) {
  if (!OwnPrivacyAllowsURL(destination)) return NO;
  return !([source.scheme.lowercaseString isEqualToString:@"https"] && [destination.scheme.lowercaseString isEqualToString:@"http"]);
}
static inline NSError *OwnPrivacyNetworkError(void) {
  return [NSError errorWithDomain:@"OwnPrivacy" code:NSURLErrorNoPermissionsToReadFile userInfo:@{NSLocalizedDescriptionKey: @"This destination is blocked by the privacy policy."}];
}
