import 'react-native-url-polyfill/auto';
import { googleSearchUrl, parseGoogleResults } from '../../../../src/services/tools/googleSearch';

const result = (href: string, title = 'Example') => `<div class="g"><a href="${href}"><h3>${title}</h3></a><div class="VwiC3b">Useful snippet</div></div>`;

describe('Google search contract', () => {
  it('encodes the complete query as one parameter', () => {
    const url = new URL(googleSearchUrl('cats & dogs #1'));
    expect(url.hostname).toBe('www.google.com');
    expect(url.searchParams.get('q')).toBe('cats & dogs #1');
  });
  it('unwraps Google links, decodes text and removes duplicates', () => {
    const html = result('/url?q=https%3A%2F%2Fexample.com%2Farticle', 'A &amp; B') + result('https://example.com/article');
    expect(parseGoogleResults(html)).toEqual([{ title: 'A & B', url: 'https://example.com/article', snippet: 'Useful snippet' }]);
  });
  it.each(['javascript:alert(1)', 'file:///private/test', 'https://user:secret@example.com', 'https://accounts.google.com'])('rejects unsafe or internal result %s', href => {
    expect(() => parseGoogleResults(result(href))).toThrow('unreadable');
  });
  it('limits actual distinct results to five', () => {
    expect(parseGoogleResults(Array.from({length: 8}, (_, i) => result(`https://example.com/${i}`)).join(''))).toHaveLength(5);
  });
  it.each(['Before you continue to Google', 'Our systems have detected unusual traffic', "If you're having trouble accessing Google Search"])('reports a browser challenge: %s', text => {
    expect(() => parseGoogleResults(text)).toThrow('browser check');
  });
  it('recognizes an explicit empty result page', () => {
    expect(parseGoogleResults('Your search did not match any documents')).toEqual([]);
  });
});
