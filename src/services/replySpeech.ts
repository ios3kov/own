import { AppState, NativeModules, Platform } from 'react-native';
import { create } from 'zustand';

function stripInlineCode(text: string): string {
  let result = '';
  let offset = 0;
  while (offset < text.length) {
    const start = text.indexOf('`', offset);
    if (start < 0) return result + text.slice(offset);
    result += text.slice(offset, start);
    let count = 1;
    while (text[start + count] === '`') count += 1;
    const end = text.indexOf('`'.repeat(count), start + count);
    if (end < 0) return result;
    offset = end + count;
  }
  return result;
}

// This parser only exposes a stable prefix. Unclosed protected blocks stay silent.
export function speechText(raw: string, final = false): string {
  let text = raw.replace(/<\|channel>thought\n[\s\S]*?<channel\|>/gi, '').replace(/<\|channel>thought\n[\s\S]*$/gi, '')
    .replace(/<\|channel\|>analysis<\|message\|>[\s\S]*?<\|channel\|>final<\|message\|>/gi, '')
    .replace(/<\|channel\|>analysis<\|message\|>[\s\S]*$/gi, '')
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').replace(/<tool_call>[\s\S]*$/g, '')
    .replace(/<\|tool_call>[\s\S]*?<tool_call\|>/g, '').replace(/<\|tool_call>[\s\S]*$/g, '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '');
  text = text.replace(/```[\s\S]*?```/g, '').replace(/```[\s\S]*$/g, '');
  text = text.replace(/~~~[\s\S]*?~~~/g, '').replace(/~~~[\s\S]*$/g, '');
  text = stripInlineCode(text);
  text = text.replace(/\[\d+\]/g, '');
  // Hold partial markup, tags and links until their closing token arrives.
  for (const marker of ['`', '<', '[']) {
    const start = text.lastIndexOf(marker);
    const end = marker === '<' ? '>' : marker === '[' ? ')' : '`';
    if (start >= 0 && (marker === '`' || text.indexOf(end, start + 1) < 0)) text = text.slice(0, start).replace(/!$/, '');
  }
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\[\d+\]/g, '')
    .replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+/g, '')
    .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/[*_~]/g, '').replace(/[ \t]+/g, ' ');
  if (!final) {
    // A trailing tag/backtick may be only the start of a protected block.
    text = text.replace(/(?:<[^>]*|`{1,2}|~{1,2})$/, '');
  }
  return text;
}

export const useReplySpeechState = create<{ error: string | null }>(() => ({ error: null }));
const bridge = () => Platform.OS === 'ios' ? NativeModules.OwnReplySpeech : null;

export class ReplySpeech {
  private session = 0;
  private active = false;
  private emitted = '';
  private raw = '';
  private queue: string[] = [];
  private draining = false;
  private ready: Promise<unknown> = Promise.resolve();

  begin(enabled: boolean): void {
    this.stop();
    useReplySpeechState.setState({ error: null });
    this.active = enabled && AppState.currentState === 'active' && !!bridge();
    if (!this.active) return;
    const id = this.session;
    this.ready = Promise.resolve(bridge().begin(String(id))).catch(() => {
      if (id === this.session) this.fail('Spoken replies are unavailable.');
    });
  }
  update(raw: string): void {
    if (!this.active) return;
    if (raw.length > 64_000) { this.fail('Spoken reply stopped because it was too long.'); return; }
    this.raw = raw;
    this.collect(false);
  }
  resetText(): void { this.begin(this.active); }
  finish(): void { if (this.active) this.collect(true); }
  stop(): Promise<void> {
    this.session += 1;
    this.active = false; this.emitted = ''; this.raw = ''; this.queue = []; this.draining = false;
    return Promise.resolve(bridge()?.stop()).then(() => undefined, () => undefined);
  }
  private fail(message: string): void {
    this.stop();
    useReplySpeechState.setState({ error: message });
  }
  private collect(final: boolean): void {
    const text = speechText(this.raw, final);
    if (!text.startsWith(this.emitted)) {
      this.fail('Spoken reply stopped because the response changed.'); return;
    }
    let rest = text.slice(this.emitted.length);
    while (rest.length) {
      const match = /[.!?。！？]\s|\n/.exec(rest);
      const end = match ? match.index + match[0].length : final ? rest.length : 0;
      if (!end) break;
      const part = rest.slice(0, end);
      this.emitted += part; rest = rest.slice(end);
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.length > 800 || this.queue.length >= 12) {
        this.fail('Spoken reply stopped because it was too long.'); return;
      }
      this.queue.push(trimmed);
    }
    this.drain();
  }
  private async drain(): Promise<void> {
    if (this.draining || !this.active) return;
    this.draining = true;
    const id = this.session;
    try {
      await this.ready;
      while (this.active && id === this.session && this.queue.length) {
        await bridge().speak(this.queue.shift(), String(id));
      }
    } catch {
      if (id === this.session) this.fail('No suitable local voice is available, or playback was interrupted.');
    } finally { if (id === this.session) this.draining = false; }
  }
}
export const replySpeech = new ReplySpeech();
