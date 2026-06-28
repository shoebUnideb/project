import { Hash, Megaphone, Smile } from 'lucide-react';
import type { User } from '../../../types';

export const EMOJI_MAP: Record<string, string> = {
  like: '👍', love: '❤️', clap: '👏', fire: '🔥', celebrate: '🎉',
};
export const EMOJI_KEYS = Object.keys(EMOJI_MAP);

export const STARRED_KEY = (wsId: number) => `starred_msgs_${wsId}`;
export const MUTED_KEY = 'ws_muted_v1';

export function channelIcon(type: string, size = 14) {
  if (type === 'announcements') return <Megaphone size={size} />;
  if (type === 'random') return <Smile size={size} />;
  return <Hash size={size} />;
}

export function senderName(u: User) {
  return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.username;
}

export function dateLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
}
