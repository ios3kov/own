import { parse } from 'node-html-parser';

export interface GoogleResult { title: string; url: string; snippet: string }

export function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&udm=14&gbv=1`;
}

/** Parse result headings, not arbitrary navigation links or advertising text. */
export function parseGoogleResults(html: string): GoogleResult[] {
  const root = parse(html);
  if (/our systems have detected unusual traffic|before you continue to google|trouble accessing Google Search|enable javascript to use search/i.test(root.textContent)) {
    throw new Error('Google requires a browser check. Open Google in your browser and try again later.');
  }
  const results: GoogleResult[] = [];
  const seen = new Set<string>();
  for (const anchor of root.querySelectorAll('a')) {
    const heading = anchor.querySelector('h3') ?? anchor.querySelector('.vvjwJb');
    if (!heading) continue;
    const url = parseResultUrl(anchor.getAttribute('href') ?? '');
    if (!url) continue;
    const title = heading.textContent.replace(/\s+/g, ' ').trim();
    if (!title || seen.has(url.href)) continue;
    seen.add(url.href);
    const container = anchor.closest('.g') ?? anchor.closest('.MjjYud') ?? anchor.parentNode?.parentNode;
    const snippet = container?.querySelector('.VwiC3b, .s3v9rd')?.textContent.replace(/\s+/g, ' ').trim() ?? '';
    results.push({ title, url: url.href, snippet });
    if (results.length === 5) break;
  }
  if (!results.length && !/did not match any documents|no results found/i.test(root.textContent)) {
    throw new Error('Google returned an unreadable search page. Try again later.');
  }
  return results;
}

function parseResultUrl(href: string): URL | null {
  try {
    let url = new URL(href, 'https://www.google.com');
    if (['google.com', 'www.google.com'].includes(url.hostname) && url.pathname === '/url') {
      url = new URL(url.searchParams.get('q') ?? url.searchParams.get('url') ?? '');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.hostname === 'google.com' || url.hostname.endsWith('.google.com')) return null;
    return url;
  } catch { return null; }
}
