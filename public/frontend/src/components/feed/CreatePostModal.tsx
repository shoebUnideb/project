import { useState, useRef } from 'react';
import { X, ImagePlus, Link, MapPin, Calendar } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { feedApi } from '../../api/feed';
import type { FeedPost, PostType } from '../../types';
import RichTextEditor from '../ui/RichTextEditor';

interface Props {
  mode: 'create' | 'edit';
  initial?: FeedPost;
  onClose: () => void;
  onSaved: (post: FeedPost) => void;
}

export default function CreatePostModal({ mode, initial, onClose, onSaved }: Props) {
  const [postType, setPostType]           = useState<PostType>(initial?.post_type ?? 'general');
  const [title, setTitle]                 = useState(initial?.title ?? '');
  const [body, setBody]                   = useState(initial?.body ?? '');
  const [tags, setTags]                   = useState(initial?.tags ?? '');
  const [linkUrl, setLinkUrl]             = useState(initial?.link_url ?? '');
  const [linkTitle, setLinkTitle]         = useState(initial?.link_title ?? '');
  const [eventDate, setEventDate]         = useState(initial?.event_date?.slice(0, 16) ?? '');
  const [eventLocation, setEventLocation] = useState(initial?.event_location ?? '');
  const [allowComments, setAllowComments] = useState(initial?.allow_comments ?? true);
  const [allowReactions, setAllowReactions] = useState(initial?.allow_reactions ?? true);
  const [imageFile, setImageFile]         = useState<File | null>(null);
  const [imagePreview, setImagePreview]   = useState<string | null>(initial?.image ?? null);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await apiClient.initCsrf();
      const fd = new FormData();
      fd.append('post_type', postType);
      fd.append('title', title.trim());
      fd.append('body', body);
      fd.append('tags', tags);
      fd.append('link_url', linkUrl);
      fd.append('link_title', linkTitle);
      fd.append('event_location', eventLocation);
      fd.append('allow_comments', String(allowComments));
      fd.append('allow_reactions', String(allowReactions));
      if (eventDate) fd.append('event_date', eventDate);
      if (imageFile) fd.append('image', imageFile);

      const saved = mode === 'create'
        ? await feedApi.create(fd)
        : await feedApi.update(initial!.id, fd);
      onSaved(saved);
    } catch {
      setError('Failed to save post. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-[14px] font-bold text-gray-900">
              {mode === 'create' ? 'New Post' : 'Edit Post'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Post type toggle */}
            <div className="flex gap-2">
              {(['general', 'event'] as PostType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setPostType(t)}
                  className={[
                    'flex-1 py-2 text-[12px] font-semibold rounded-lg capitalize transition-colors',
                    postType === t
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Title */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                Title *
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Post title…"
                className="w-full px-3 py-2.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                Body
              </label>
              <RichTextEditor value={body} onChange={setBody} placeholder="Write your post…" minHeight={120} />
            </div>

            {/* Image */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                Image
              </label>
              {imagePreview && (
                <div className="relative mb-2">
                  <img src={imagePreview} alt="" className="w-full max-h-40 object-cover rounded-lg" />
                  <button
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-gray-500 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ImagePlus size={14} /> {imagePreview ? 'Change image' : 'Add image'}
              </button>
            </div>

            {/* Link */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                  <Link size={10} /> Link URL
                </label>
                <input
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full px-3 py-2 text-[12px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                  Link label
                </label>
                <input
                  value={linkTitle}
                  onChange={e => setLinkTitle(e.target.value)}
                  placeholder="Label…"
                  className="w-full px-3 py-2 text-[12px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Event fields */}
            {postType === 'event' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Calendar size={10} /> Event date
                  </label>
                  <input
                    type="datetime-local"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 text-[12px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <MapPin size={10} /> Location
                  </label>
                  <input
                    value={eventLocation}
                    onChange={e => setEventLocation(e.target.value)}
                    placeholder="Location…"
                    className="w-full px-3 py-2 text-[12px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                Tags <span className="normal-case font-normal">(comma-separated)</span>
              </label>
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="e.g. visa, scholarship, event"
                className="w-full px-3 py-2 text-[12px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Permissions */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={e => setAllowComments(e.target.checked)}
                  className="accent-primary-600"
                />
                <span className="text-[12px] text-gray-600">Allow comments</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowReactions}
                  onChange={e => setAllowReactions(e.target.checked)}
                  className="accent-primary-600"
                />
                <span className="text-[12px] text-gray-600">Allow reactions</span>
              </label>
            </div>

            {error && <p className="text-[12px] text-red-500">{error}</p>}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="px-4 py-2 text-[13px] font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : mode === 'create' ? 'Post' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
