import { useState, useRef, useEffect } from 'react';
import {
  Pin, MoreHorizontal, EyeOff, Eye, Pencil, Trash2,
  MessageCircle, Calendar, MapPin, ExternalLink, Send,
  Bookmark, Share2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { feedApi } from '../../api/feed';
import apiClient from '../../api/apiClient';
import { relativeTime } from '../../utils/time';
import Avatar from '../ui/Avatar';
import type { FeedPost, FeedComment, ReactionEmoji } from '../../types';

const EMOJI_MAP: Record<ReactionEmoji, string> = {
  like:      '👍',
  love:      '❤️',
  clap:      '👏',
  fire:      '🔥',
  celebrate: '🎉',
};

interface Props {
  post: FeedPost;
  onUpdate: (p: FeedPost) => void;
  onDelete: (id: number) => void;
  onEdit:   (p: FeedPost) => void;
}

export default function PostCard({ post, onUpdate, onDelete, onEdit }: Props) {
  const { user } = useAuth();
  const [menuOpen,          setMenuOpen]          = useState(false);
  const [expanded,          setExpanded]          = useState(false);
  const [showComments,      setShowComments]      = useState(false);
  const [comments,          setComments]          = useState<FeedComment[]>(post.comments ?? []);
  const [commentCount,      setCommentCount]      = useState(post.comment_count);
  const [commentsLoaded,    setCommentsLoaded]    = useState(!!post.comments);
  const [newComment,        setNewComment]        = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAuthor  = user?.id === post.author.id;
  const isAdmin   = user?.role === 'superadmin';
  const canManage = isAuthor || isAdmin;

  const bodyText = post.body ? post.body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
  const hasLongBody = bodyText.length > 240;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleReact = async (emoji: ReactionEmoji) => {
    await apiClient.initCsrf();
    if (post.my_reaction === emoji) {
      await feedApi.unreact(post.id);
      onUpdate({
        ...post,
        my_reaction: null,
        reaction_counts: { ...post.reaction_counts, [emoji]: Math.max(0, post.reaction_counts[emoji] - 1) },
      });
    } else {
      const prev = post.my_reaction;
      await feedApi.react(post.id, emoji);
      const counts = { ...post.reaction_counts, [emoji]: post.reaction_counts[emoji] + 1 };
      if (prev) counts[prev] = Math.max(0, counts[prev] - 1);
      onUpdate({ ...post, my_reaction: emoji, reaction_counts: counts });
    }
  };

  const loadComments = async () => {
    if (!commentsLoaded) {
      const data = await feedApi.getComments(post.id);
      setComments(data);
      setCommentsLoaded(true);
    }
    setShowComments(v => !v);
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await apiClient.initCsrf();
      const c = await feedApi.addComment(post.id, newComment.trim());
      setComments(prev => [...prev, c]);
      setCommentCount(n => n + 1);
      setNewComment('');
    } finally {
      setSubmittingComment(false);
    }
  };

  const deleteComment = async (cid: number) => {
    await apiClient.initCsrf();
    await feedApi.deleteComment(post.id, cid);
    setComments(prev => prev.filter(c => c.id !== cid));
    setCommentCount(n => Math.max(0, n - 1));
  };

  const handlePin = async () => {
    setMenuOpen(false);
    onUpdate(await feedApi.pin(post.id));
  };

  const handleHide = async () => {
    setMenuOpen(false);
    onUpdate(await feedApi.hide(post.id));
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (!confirm('Delete this post?')) return;
    await apiClient.initCsrf();
    await feedApi.delete(post.id);
    onDelete(post.id);
  };

  const handleBookmark = async () => {
    await apiClient.initCsrf();
    if (post.is_bookmarked) {
      await feedApi.unbookmark(post.id);
      onUpdate({ ...post, is_bookmarked: false });
    } else {
      await feedApi.bookmark(post.id);
      onUpdate({ ...post, is_bookmarked: true });
    }
  };

  const authorName = `${post.author.first_name ?? ''} ${post.author.last_name ?? ''}`.trim() || post.author.username;
  const postedIn   = post.tags_list[0] ?? (post.post_type !== 'general' ? post.post_type : null);

  return (
    <div className={`bg-white rounded-xl border ${post.is_hidden ? 'border-amber-200 opacity-75' : 'border-[#e0e0e0]'}`}>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <Avatar name={authorName} size="sm" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[13px] font-semibold text-gray-900">{authorName}</p>
              <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                post.author.role === 'mentor' ? 'bg-primary-50 text-primary-600' : 'bg-violet-50 text-violet-600'
              }`}>
                {post.author.role === 'superadmin' ? 'Admin' : post.author.role}
              </span>
              {post.is_pinned && (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  <Pin size={9} fill="currentColor" /> Pinned
                </span>
              )}
              {post.is_hidden && (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  <EyeOff size={9} /> Hidden
                </span>
              )}
              {post.post_type === 'event' && (
                <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Event</span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {relativeTime(post.created_at)}
              {postedIn && <> · <span className="text-primary-500">#{postedIn}</span></>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={handleBookmark}
            title={post.is_bookmarked ? 'Remove bookmark' : 'Bookmark'}
            className={`p-1.5 rounded-md transition-colors ${post.is_bookmarked ? 'text-primary-600' : 'text-gray-300 hover:text-gray-500'}`}
          >
            <Bookmark size={15} fill={post.is_bookmarked ? 'currentColor' : 'none'} />
          </button>

          {canManage && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="p-1.5 text-gray-300 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
              >
                <MoreHorizontal size={15} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                  {isAuthor && (
                    <button onClick={() => { setMenuOpen(false); onEdit(post); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50">
                      <Pencil size={13} /> Edit post
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={handlePin} className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50">
                      <Pin size={13} /> {post.is_pinned ? 'Unpin' : 'Pin to top'}
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={handleHide} className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50">
                      {post.is_hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                      {post.is_hidden ? 'Unhide' : 'Hide post'}
                    </button>
                  )}
                  <button onClick={handleDelete} className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-red-500 hover:bg-red-50">
                    <Trash2 size={13} /> Delete post
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div className="px-5 pb-3">
        <h3 className="text-[14.5px] font-bold text-gray-900 mb-2 leading-snug">{post.title}</h3>

        {/* Body + image side-by-side */}
        {(post.body || post.image) && (
          <div className="flex gap-4 items-start">
            {post.body && (
              <div className="flex-1 min-w-0">
                <div
                  className={`post-body text-[13px] text-gray-600 leading-relaxed prose prose-sm max-w-none ${!expanded && hasLongBody ? 'line-clamp-3' : ''}`}
                  dangerouslySetInnerHTML={{ __html: post.body }}
                />
                {hasLongBody && (
                  <button
                    onClick={() => setExpanded(v => !v)}
                    className="flex items-center gap-1 mt-1.5 text-[12px] font-medium text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    {expanded
                      ? <><ChevronUp size={12} /> See less</>
                      : <><ChevronDown size={12} /> See more</>
                    }
                  </button>
                )}
              </div>
            )}
            {post.image && (
              <img
                src={post.image}
                alt=""
                className={`rounded-lg object-cover shrink-0 ${post.body ? 'w-36 h-24' : 'w-full max-h-64'}`}
              />
            )}
          </div>
        )}

        {/* Link card */}
        {post.link_url && (
          <a
            href={post.link_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-lg text-[12.5px] text-primary-600 hover:bg-gray-100 transition-colors"
          >
            <ExternalLink size={13} className="shrink-0" />
            <span className="truncate">{post.link_title || post.link_url}</span>
          </a>
        )}

        {/* Event details */}
        {post.post_type === 'event' && (post.event_date || post.event_location) && (
          <div className="mt-3 flex flex-wrap gap-4 px-3 py-2.5 bg-green-50 border border-green-100 rounded-lg">
            {post.event_date && (
              <div className="flex items-center gap-1.5 text-[12px] text-green-800">
                <Calendar size={12} />
                {new Date(post.event_date).toLocaleString(undefined, {
                  weekday: 'short', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            )}
            {post.event_location && (
              <div className="flex items-center gap-1.5 text-[12px] text-green-700">
                <MapPin size={12} /> {post.event_location}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {post.tags_list.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.tags_list.map(t => (
              <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[11px] rounded-md">#{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Reactions + Actions bar ───────────────────────────── */}
      {(post.allow_reactions || post.allow_comments) && (
        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-0.5 flex-wrap">
          {post.allow_reactions && (
            <>
              {(Object.entries(EMOJI_MAP) as [ReactionEmoji, string][]).map(([emoji, glyph]) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className={[
                    'flex items-center gap-1 px-2 py-1.5 rounded-lg text-[12.5px] transition-colors',
                    post.my_reaction === emoji
                      ? 'bg-primary-50 text-primary-700 font-semibold'
                      : 'hover:bg-gray-100 text-gray-500',
                  ].join(' ')}
                  title={emoji}
                >
                  <span>{glyph}</span>
                  {post.reaction_counts[emoji] > 0 && (
                    <span className="text-[11.5px]">{post.reaction_counts[emoji]}</span>
                  )}
                </button>
              ))}
              <div className="h-4 w-px bg-gray-200 mx-1.5 shrink-0" />
            </>
          )}

          {post.allow_comments && (
            <button
              onClick={loadComments}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors ${showComments ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <MessageCircle size={13} />
              {commentCount > 0 ? commentCount : 'Comment'}
            </button>
          )}

          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-gray-500 hover:bg-gray-100 transition-colors ml-auto">
            <Share2 size={13} /> Share
          </button>
        </div>
      )}

      {/* ── Comments ──────────────────────────────────────────── */}
      {showComments && (
        <div className="px-5 py-3 border-t border-gray-100 space-y-3">
          {comments.length === 0 && (
            <p className="text-[12px] text-gray-400 text-center">No comments yet.</p>
          )}
          {comments.map(c => {
            const cName = `${c.author.first_name ?? ''} ${c.author.last_name ?? ''}`.trim() || c.author.username;
            const canDelete = user?.id === c.author.id || user?.role === 'superadmin';
            return (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar name={cName} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-semibold text-gray-800">{cName}</span>
                    <span className="text-[11px] text-gray-400">{relativeTime(c.created_at)}</span>
                  </div>
                  <p className="text-[12.5px] text-gray-700 leading-snug whitespace-pre-wrap">{c.body}</p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => deleteComment(c.id)}
                    className="shrink-0 text-gray-300 hover:text-red-400 transition-colors mt-0.5"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-2 pt-1">
            <input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment()}
              placeholder="Add a comment…"
              className="flex-1 px-3 py-2 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={submitComment}
              disabled={submittingComment || !newComment.trim()}
              className="px-3 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
