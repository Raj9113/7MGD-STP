export type Tone = 'good' | 'bad' | 'warn' | 'muted' | 'info';

export type DocCell = string | { text: string; tone?: Tone; bold?: boolean };

export interface DocImage { bytes: Buffer; caption: string; slot?: 'left' | 'right' }

export type Block =
  | { t: 'h1'; text: string }
  | { t: 'h2'; text: string; color?: string; tag?: string }
  | { t: 'h3'; text: string }
  | { t: 'p'; text: string; tone?: Tone; small?: boolean }
  | { t: 'note'; text: string; tone?: Tone }
  | { t: 'table'; head: string[]; rows: DocCell[][]; align?: ('left' | 'center' | 'right')[]; weights?: number[]; headColor?: string }
  | { t: 'images'; items: DocImage[] };

export interface Chapter {
  name: string;
  blocks: Block[];
}

export interface Doc {
  title: string;
  subtitle: string;
  generated: string;
  chapters: Chapter[];
}

export const cellText = (c: DocCell) => (typeof c === 'string' ? c : c.text);
export const cellTone = (c: DocCell): Tone | undefined => (typeof c === 'string' ? undefined : c.tone);
export const cellBold = (c: DocCell) => (typeof c === 'string' ? false : !!c.bold || c.tone === 'bad' || c.tone === 'good' || c.tone === 'warn');

export const TONE_HEX: Record<Tone, string> = { good: '1E8449', bad: 'C0392B', warn: 'B9770E', muted: '777777', info: '0062B8' };
export const TONE_FILL: Record<Tone, string> = { good: 'E8F6EE', bad: 'FBEAE8', warn: 'FEF5E7', muted: 'F2F3F4', info: 'EAF2FB' };

export const ddmmyyyy = (iso: string) => iso.split('-').reverse().join('-');
