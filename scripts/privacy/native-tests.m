#import "../../ios/OwnPrivacyCrypto.h"
#import "../../ios/OwnPrivacyNetworkPolicy.h"

static NSString *DecodeFixture(NSString *text) {
  return [[NSString alloc] initWithData:[[NSData alloc] initWithBase64EncodedString:text options:0] encoding:NSUTF8StringEncoding];
}

#define CHECK(value, label) if (!(value)) { fprintf(stderr, "FAIL: %s\n", label); return 1; }

int main(void) {
  @autoreleasepool {
    // Expected value generated independently with Node's PBKDF2 implementation.
    NSString *known = @"pbkdf2-sha256$600000$000102030405060708090a0b0c0d0e0f$6b0cb8111ed9e2a6f8ad4df04d564c149f3c09971290f2290abf9cd4f33e0e38";
    CHECK(OwnVerifyPassphrase(@"Aa12345", known), "PBKDF2 independent vector");
    CHECK(!OwnVerifyPassphrase(@"BB12345", known), "legacy hash collision rejected");
    NSString *first = OwnCreatePassphraseVerifier(@"пароль🔑");
    NSString *second = OwnCreatePassphraseVerifier(@"пароль🔑");
    CHECK(first && second && ![first isEqualToString:second], "fresh random salt");
    CHECK(OwnVerifyPassphrase(@"пароль🔑", first), "Unicode roundtrip");
    CHECK(!OwnVerifyPassphrase(@"wrong", first), "wrong password");
    CHECK(!OwnVerifyPassphrase(@"password", @"legacy-weak-hash"), "legacy verifier rejected");
    CHECK(!OwnVerifyPassphrase(@"Aa12345", [known stringByReplacingOccurrencesOfString:@"600000" withString:@"999999999"]), "untrusted work factor rejected");
    CHECK(!OwnCreatePassphraseVerifier(@""), "empty password rejected");
    CHECK(!OwnUnhex(@"zz", 1), "malformed salt rejected");

    for (NSString *url in @[DecodeFixture(@"aHR0cHM6Ly9nZXRvZmZncmlkYWkuY28="), DecodeFixture(@"aHR0cHM6Ly9hcGkuV0VETkVTREFZLklTLi94"), DecodeFixture(@"aHR0cHM6Ly9hcGkua2V5Z2VuLnNo"), DecodeFixture(@"aHR0cHM6Ly9vZmZncmlkbW9iaWxlYWkuY28="), @"file:///private/file"]) {
      CHECK(!OwnPrivacyAllowsURL([NSURL URLWithString:url]), "blocked destination");
    }
    for (NSString *url in @[DecodeFixture(@"aHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9zZWFyY2g/cT13ZWRuZXNkYXkuaXM="), @"https://huggingface.co", @"http://192.168.1.2:11434", DecodeFixture(@"aHR0cHM6Ly9nZXRvZmZncmlkYWkuY28uZXhhbXBsZS5jb20=")]) {
      CHECK(OwnPrivacyAllowsURL([NSURL URLWithString:url]), "selected third-party service allowed");
    }
    CHECK(!OwnPrivacyAllowsRedirect([NSURL URLWithString:@"https://example.com"], [NSURL URLWithString:DecodeFixture(@"aHR0cHM6Ly9hcGkuZ2V0b2ZmZ3JpZGFpLmNv")]), "developer redirect rejected");
    CHECK(!OwnPrivacyAllowsRedirect([NSURL URLWithString:@"https://example.com"], [NSURL URLWithString:@"http://example.com"]), "TLS downgrade rejected");
    CHECK(OwnPrivacyAllowsRedirect([NSURL URLWithString:@"https://huggingface.co"], [NSURL URLWithString:@"https://cdn-lfs.huggingface.co/model"]), "model CDN redirect allowed");
    puts("PASS: native crypto and destination-policy tests");
  }
  return 0;
}
