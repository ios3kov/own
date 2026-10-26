#import <Foundation/Foundation.h>
#import <CommonCrypto/CommonCrypto.h>
#import <Security/Security.h>

static inline NSString *OwnHex(NSData *data) {
  const unsigned char *bytes = (const unsigned char *)data.bytes;
  NSMutableString *result = [NSMutableString stringWithCapacity:data.length * 2];
  for (NSUInteger i = 0; i < data.length; i++) [result appendFormat:@"%02x", bytes[i]];
  return result;
}

static inline NSData *OwnUnhex(NSString *value, NSUInteger length) {
  if (value.length != length * 2) return nil;
  NSMutableData *result = [NSMutableData dataWithLength:length];
  unsigned char *bytes = (unsigned char *)result.mutableBytes;
  for (NSUInteger i = 0; i < length; i++) {
    unsigned int n;
    NSString *pair = [value substringWithRange:NSMakeRange(i * 2, 2)];
    NSScanner *scanner = [NSScanner scannerWithString:pair];
    scanner.charactersToBeSkipped = nil;
    if (![scanner scanHexInt:&n] || !scanner.isAtEnd || n > 255) return nil;
    bytes[i] = (unsigned char)n;
  }
  return result;
}

static inline NSData *OwnDerivePassphrase(NSString *password, NSData *salt) {
  NSData *input = [password dataUsingEncoding:NSUTF8StringEncoding];
  if (!input || input.length == 0 || input.length > 4096 || salt.length != 16) return nil;
  unsigned char derived[32];
  int status = CCKeyDerivationPBKDF(kCCPBKDF2, (const char *)input.bytes, input.length,
    (const unsigned char *)salt.bytes, salt.length, kCCPRFHmacAlgSHA256, 600000, derived, sizeof(derived));
  if (status != kCCSuccess) return nil;
  NSData *result = [NSData dataWithBytes:derived length:sizeof(derived)];
  memset_s(derived, sizeof(derived), 0, sizeof(derived));
  return result;
}

static inline NSString *OwnCreatePassphraseVerifier(NSString *password) {
  unsigned char salt[16];
  if (SecRandomCopyBytes(kSecRandomDefault, sizeof(salt), salt) != errSecSuccess) return nil;
  NSData *saltData = [NSData dataWithBytes:salt length:sizeof(salt)];
  NSData *derived = OwnDerivePassphrase(password, saltData);
  if (!derived) return nil;
  return [NSString stringWithFormat:@"pbkdf2-sha256$600000$%@$%@", OwnHex(saltData), OwnHex(derived)];
}

static inline BOOL OwnVerifyPassphrase(NSString *password, NSString *verifier) {
  NSArray<NSString *> *parts = [verifier componentsSeparatedByString:@"$"];
  if (parts.count != 4 || ![parts[0] isEqualToString:@"pbkdf2-sha256"] ||
      ![parts[1] isEqualToString:@"600000"]) return NO;
  NSData *salt = OwnUnhex(parts[2], 16);
  NSData *expected = OwnUnhex(parts[3], 32);
  if (!salt || !expected) return NO;
  NSData *actual = OwnDerivePassphrase(password, salt);
  if (!actual) return NO;
  const unsigned char *a = (const unsigned char *)actual.bytes;
  const unsigned char *b = (const unsigned char *)expected.bytes;
  unsigned char difference = 0;
  for (NSUInteger i = 0; i < expected.length; i++) difference |= a[i] ^ b[i];
  return difference == 0;
}
