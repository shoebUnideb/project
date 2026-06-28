import { Hash, Megaphone, Smile } from 'lucide-react';

export const EMOJI_MAP: Record<string, string> = {
  like: '👍', love: '❤️', clap: '👏', fire: '🔥', celebrate: '🎉',
};
export const EMOJI_KEYS = Object.keys(EMOJI_MAP);

export const ORG_STARRED_KEY = (channelId: number) => `org_starred_${channelId}`;
export const ORG_STARRED_DM_KEY = 'org_starred_dms';
export const ORG_MUTED_KEY = 'org_muted_v1';

export function channelIcon(type: string, size = 14) {
  if (type === 'announcements') return <Megaphone size={size} />;
  if (type === 'random') return <Smile size={size} />;
  return <Hash size={size} />;
}

export function senderName(u: { first_name?: string; last_name?: string; username: string; display_name?: string }) {
  if (u.display_name) return u.display_name;
  return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.username;
}

export function dateLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}
