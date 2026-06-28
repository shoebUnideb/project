import { useState, type FormEvent } from 'react';
import { X, Send } from 'lucide-react';
import { messagesApi } from '../../api/messages';
import { ApiError } from '../../api/apiClient';
import apiClient from '../../api/apiClient';
import type { MarketplaceUser } from '../../types';
import Avatar from './Avatar';

interface Props {
  user: MarketplaceUser;
  onClose: () => void;
  onSent: (userId: number) => void;
}

const TEMPLATES: Record<MarketplaceUser['role'], string> = {
  mentor:  "Hi, I came across your profile on the Marketplace and I'm really interested in your expertise. I'd love to connect and learn more about your experience. Looking forward to hearing from you!",
  student: "Hi, I found your profile on the Marketplace and it looks like we share similar interests. I'd love to connect and exchange thoughts. Feel free to reach out anytime!",
};

export default function IntroMessageModal({ user, onClose, onSent }: Props) {
  const fullName = `${user.first_name} ${user.last_name}`.trim() || user.username;
  const [body, setBody]     = useState(TEMPLATES[user.role]);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setError('');
    setLoading(true);
    try {
      await apiClient.initCsrf();
      await messagesApi.send(user.id, body.trim());
      onSent(user.id);
    } catch (err) {
      if (err instanceof ApiError) {
        const d = err.data as Record<string, string | string[]>;
        setError(String((Array.isArray(d.detail) ? d.detail[0] : d.detail) ?? 'Failed to send.'));
      } else {
        setError('Server error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar name={fullName} src={user.profile_picture} size="md" />
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">Introduce yourself</h2>
              <p className="text-[12px] text-gray-500 mt-0.5">To {fullName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
              Your intro message
            </label>
            <textarea
              rows={5}
              value={body}
              onChange={e => setBody(e.target.value)}
              className="w-full px-3.5 py-2.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none placeholder-gray-300 bg-white"
            />
            <p className="text-[11px] text-gray-400 mt-1">{body.length} characters</p>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:text-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || !body.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-lg shadow-sm transition-colors">
              <Send size={13} />
              {loading ? 'Sending…' : 'Send & open chat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
