import type { Message, Conversation } from '../../../types';

export const COMMON_EMOJIS = [
  '😀','😂','😍','🥺','😎','🤔','😅','😊',
  '👍','👏','🙌','❤️','🔥','✨','🎉','💯',
  '😭','🤣','😢','😡','🙏','💪','🎊','🚀',
];

export function loadSet(key: string): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]') as number[]); }
  catch { return new Set(); }
}

export function saveSet(key: string, set: Set<number>) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

export function loadMuted(): Map<number, number | null> {
  try {
    const raw = JSON.parse(localStorage.getItem('msgs_muted') || '{}') as Record<string, number | null>;
    return new Map(Object.entries(raw).map(([k, v]) => [Number(k), v]));
  } catch { return new Map(); }
}

export function saveMuted(m: Map<number, number | null>) {
  const obj: Record<string, number | null> = {};
  m.forEach((v, k) => { obj[String(k)] = v; });
  localStorage.setItem('msgs_muted', JSON.stringify(obj));
}

export function isMutedNow(m: Map<number, number | null>, id: number): boolean {
  if (!m.has(id)) return false;
  const until = m.get(id)!;
  return until === null || Date.now() < until;
}

export function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatDateLabel(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function groupByDate(msgs: Message[]): [string, Message[]][] {
  const map = new Map<string, Message[]>();
  for (const m of msgs) {
    const key = new Date(m.timestamp).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return [...map.entries()];
}

export function convName(conv: Conversation) {
  return `${conv.user.first_name ?? ''} ${conv.user.last_name ?? ''}`.trim() || conv.user.username;
}
