import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Pencil, Trash2, Send, ImagePlus, X, ArrowUpDown, Pin } from 'lucide-react';
import { workspacesApi } from '../../api/workspaces';
import RichTextEditor from '../ui/RichTextEditor';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../../pages/workspace/tasks/ConfirmDialog';
import type { FeedPost } from '../../types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function UserAvatar({ src, name, size = 8 }: { src?: string | null; name?: string; size?: number }) {
  const initials = name
    ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  return (
    <div className={`w-${size} h-${size} rounded-lg overflow-hidden shrink-0 bg-gray-200 flex items-center justify-center`}>
      {src ? (
        <img src={src} alt={name ?? ''} className="w-full h-full object-cover" />
      ) : (
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect width="100" height="100" fill="#b0b3b8" />
          <circle cx="50" cy="38" r="20" fill="white" />
          <ellipse cx="50" cy="85" rx="30" ry="22" fill="white" />
        </svg>
      )}
    </div>
  );
}

interface PostCardProps {
  post: FeedPost;
  canEdit: boolean;
  canPin: boolean;
  onDelete: (id: number) => void;
  onUpdate: (id: number, updated: Partial<FeedPost>) => void;
  onPin: (id: number, pinned: boolean) => void;
  workspaceId: number;
  imageRight: boolean;
}

function PostCard({ post, canEdit, canPin, onDelete, onUpdate, onPin, workspaceId, imageRight }: PostCardProps) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(post.body);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(post.image ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const editImgRef = useRef<HTMLInputElement>(null);

  const plainText = post.body.replace(/<[^>]*>/g, '').trim();
  const isLong = plainText.length > 300;

  const startEdit = () => {
    setEditBody(post.body);
    setEditImageFile(null);
    setEditImagePreview(post.image ?? null);
    setRemoveImage(false);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const fd = new FormData();
    fd.append('body', editBody);
    if (editImageFile) fd.append('image', editImageFile);
    else if (removeImage) fd.append('remove_image', 'true');
    const updated = await workspacesApi.updatePost(workspaceId, post.id, fd);
    onUpdate(post.id, { body: updated.body, image: updated.image });
    setEditing(false);
    setSaving(false);
  };

  const initials = (post.author.first_name || post.author.last_name)
    ? `${post.author.first_name?.[0] ?? ''}${post.author.last_name?.[0] ?? ''}`.toUpperCase()
    : post.author.username[0].toUpperCase();

  const displayName = (post.author.first_name || post.author.last_name)
    ? `${post.author.first_name ?? ''} ${post.author.last_name ?? ''}`.trim()
    : post.author.username;

  const hasImage = editing ? (editImagePreview && !removeImage) : !!post.image;
  const hasText  = editing ? !!editBody.replace(/<[^>]*>/g, '').trim() : !!plainText;

  return (
    <div className="bg-white rounded-xl border border-[#e0e0e0] p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <UserAvatar src={post.author.profile_picture} name={displayName} />
          <div>
            <p className="text-[13px] font-semibold text-gray-900 leading-none">{displayName}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(post.created_at)}</p>
          </div>
        </div>
        {(canPin || canEdit) && !editing && (
          <div className="flex items-center gap-1">
            {canPin && (
              <button
                onClick={() => onPin(post.id, !post.is_pinned)}
                title={post.is_pinned ? 'Unpin post' : 'Pin post'}
                className={`p-1.5 rounded-lg transition-colors ${
                  post.is_pinned
                    ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                    : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                }`}
              >
                <Pin size={13} className={post.is_pinned ? 'fill-amber-400' : ''} />
              </button>
            )}
            {canEdit && (
              <button onClick={startEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <Pencil size={13} />
              </button>
            )}
            {canEdit && (
              <button onClick={() => onDelete(post.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      {editing ? (
        <div className="space-y-3">
          <RichTextEditor value={editBody} onChange={setEditBody} placeholder="Write your update…" minHeight={80} />

          {/* Image row in edit mode */}
          <div className="flex items-center gap-3">
            {editImagePreview && !removeImage ? (
              <div className="relative">
                <img src={editImagePreview} alt="" className="h-20 rounded-lg object-cover border border-gray-200" />
                <button
                  onClick={() => { setEditImageFile(null); setEditImagePreview(null); setRemoveImage(true); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => editImgRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ImagePlus size={13} />
                Add image
              </button>
            )}
            <input ref={editImgRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={e => {
              const f = e.target.files?.[0];
              if (!f) return;
              setEditImageFile(f);
              setEditImagePreview(URL.createObjectURL(f));
              setRemoveImage(false);
            }} />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-[12px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-[12px] font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        /* View mode — text + image layout */
        <div>
          {hasText && hasImage ? (
            /* Alternating: even index = text left / image right, odd = image left / text right */
            <div className={`flex gap-5 items-start ${imageRight ? '' : 'flex-row-reverse'}`}>
              <div className="flex-1 min-w-0">
                <div
                  className={`post-body prose prose-sm max-w-none text-gray-700 text-[13.5px] leading-relaxed overflow-hidden ${!expanded && isLong ? 'line-clamp-6' : ''}`}
                  dangerouslySetInnerHTML={{ __html: post.body }}
                />
              </div>
              <img
                src={post.image!}
                alt=""
                className="w-[38%] shrink-0 rounded-lg border border-gray-100"
                style={{ aspectRatio: '4/3', objectFit: 'cover' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          ) : hasImage ? (
            <img
              src={post.image!}
              alt=""
              className="w-full rounded-lg border border-gray-100 max-h-80 object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div
              className={`post-body prose prose-sm max-w-none text-gray-700 text-[13.5px] leading-relaxed overflow-hidden ${!expanded && isLong ? 'line-clamp-4' : ''}`}
              dangerouslySetInnerHTML={{ __html: post.body }}
            />
          )}

          {isLong && (
            <button onClick={() => setExpanded(v => !v)} className="mt-2 text-[12px] font-semibold text-gray-500 hover:text-gray-800 transition-colors">
              {expanded ? 'See less' : 'See more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  workspaceId: number;
  children?: React.ReactNode;
  onPostsChange?: (posts: FeedPost[]) => void;
}

export default function WorkspaceFeed({ workspaceId, children, onPostsChange }: Props) {
  const { isOwner, isMentor, workspace } = useWorkspace();
  const canWrite = isOwner || isMentor;
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [body, setBody] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<number | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  const fetchPosts = useCallback(async () => {
    const data = await workspacesApi.listFeed(workspaceId);
    setPosts(data);
  }, [workspaceId]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handlePost = async () => {
    const trimmed = body.replace(/<[^>]*>/g, '').trim();
    if (!trimmed && !imageFile) return;
    setPosting(true);
    const fd = new FormData();
    fd.append('body', body);
    if (imageFile) fd.append('image', imageFile);
    const newPost = await workspacesApi.createPost(workspaceId, fd);
    setPosts(prev => [newPost, ...prev]);
    setBody('');
    setImageFile(null);
    setImagePreview(null);
    setEditorKey(k => k + 1);
    setPosting(false);
  };

  const handleDelete = async (id: number) => {
    setDeletingPost(true);
    await workspacesApi.deletePost(workspaceId, id);
    setPosts(prev => prev.filter(p => p.id !== id));
    setConfirmDeletePostId(null);
    setDeletingPost(false);
  };

  const handleUpdate = (id: number, updated: Partial<FeedPost>) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
  };

  const handlePin = async (id: number, pinned: boolean) => {
    await workspacesApi.pinPost(workspaceId, id, pinned);
    setPosts(prev => prev.map(p => p.id === id ? { ...p, is_pinned: pinned } : p));
  };

  useEffect(() => { onPostsChange?.(posts); }, [posts, onPostsChange]);

  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [filter, setFilter] = useState<'all' | 'images' | 'text'>('all');

  const displayedPosts = useMemo(() => {
    let result = [...posts];
    if (filter === 'images') result = result.filter(p => !!p.image);
    else if (filter === 'text') result = result.filter(p => !p.image);
    if (sortOrder === 'oldest') result = result.reverse();
    return result;
  }, [posts, sortOrder, filter]);

  const ownerInitials = workspace?.mentor_name
    ? workspace.mentor_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'M';

  const canPost = !posting && (!!body.replace(/<[^>]*>/g, '').trim() || !!imageFile);

  if (!canWrite && posts.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Compose box — coordinator and mentors */}
      {canWrite && (
        <div className="bg-white rounded-xl border border-[#e0e0e0] p-4">
          <div className="flex items-center gap-3 mb-3">
            <UserAvatar src={user?.profile_picture} name={user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username : ''} />
            <p className="text-[13px] font-medium text-gray-500">Share an update with your workspace…</p>
          </div>

          <RichTextEditor key={editorKey} value={body} onChange={setBody} placeholder="Write something for your members…" minHeight={80} />

          {/* Image preview */}
          {imagePreview && (
            <div className="relative mt-3 inline-block">
              <img src={imagePreview} alt="" className="h-28 rounded-lg object-cover border border-gray-200" />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          )}

          {/* Footer row */}
          <div className="flex items-center justify-between mt-3">
            <button
              type="button"
              onClick={() => imgRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ImagePlus size={14} />
              {imagePreview ? 'Change image' : 'Attach image'}
            </button>
            <input ref={imgRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={e => {
              const f = e.target.files?.[0];
              if (!f) return;
              setImageFile(f);
              setImagePreview(URL.createObjectURL(f));
            }} />

            <button
              onClick={handlePost}
              disabled={!canPost}
              className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-colors"
            >
              <Send size={13} />
              {posting ? 'Posting…' : 'Post update'}
            </button>
          </div>
        </div>
      )}

      {/* Slotted content (Announcement + Welcome) */}
      {children}

      {/* Sort / filter toolbar — only when there are posts */}
      {posts.length > 0 && (
        <div className="flex items-center justify-between px-1">
          {/* Filter pills */}
          <div className="flex items-center gap-1">
            {(['all', 'images', 'text'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-[11.5px] font-medium rounded-full transition-colors ${
                  filter === f
                    ? 'bg-primary-600 text-white'
                    : 'bg-white border border-[#e0e0e0] text-gray-500 hover:border-gray-400 hover:text-gray-700'
                }`}
              >
                {f === 'all' ? 'All posts' : f === 'images' ? 'With images' : 'Text only'}
              </button>
            ))}
          </div>

          {/* Sort toggle */}
          <button
            onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-1.5 px-3 py-1 text-[11.5px] font-medium text-gray-500 bg-white border border-[#e0e0e0] rounded-full hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowUpDown size={11} />
            {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
          </button>
        </div>
      )}

      {/* Post list */}
      {displayedPosts.length === 0 && posts.length > 0 ? (
        <p className="text-center text-[13px] text-gray-400 py-6">No posts match this filter.</p>
      ) : (
        displayedPosts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            canEdit={isOwner || (isMentor && post.author.id === user?.id)}
            canPin={isOwner}
            onDelete={id => setConfirmDeletePostId(id)}
            onUpdate={handleUpdate}
            onPin={handlePin}
            workspaceId={workspaceId}
            imageRight={index % 2 === 0}
          />
        ))
      )}

      {confirmDeletePostId !== null && (
        <ConfirmDialog
          title="Delete post?"
          message="This post will be permanently deleted and cannot be recovered."
          confirmLabel="Delete"
          variant="danger"
          loading={deletingPost}
          onConfirm={() => handleDelete(confirmDeletePostId)}
          onCancel={() => setConfirmDeletePostId(null)}
        />
      )}
    </div>
  );
}
