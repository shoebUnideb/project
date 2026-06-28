import { useState } from 'react';
import { Hash, X } from 'lucide-react';
import { orgChatApi } from '../../api/orgApi';
import apiClient from '../../../api/apiClient';
import type { OrgChatChannel } from '../../api/orgApi';

export function OrgCreateChannelModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (ch: OrgChatChannel) => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) { setError('Channel name is required.'); return; }
    setLoading(true);
    try {
      await apiClient.initCsrf();
      const ch = await orgChatApi.createChannel({ name: name.trim(), description: desc });
      onCreated(ch);
    } catch { setError('Failed to create channel.'); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"><X size={16} /></button>
        <h3 className="text-[15px] font-bold text-gray-800 mb-4">Create Channel</h3>
        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Name</label>
            <div className="mt-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary-500">
              <Hash size={13} className="text-gray-400 shrink-0" />
              <input value={name} onChange={e => setName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                     placeholder="channel-name" className="flex-1 text-[13px] focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Description <span className="font-normal text-gray-400">(optional)</span></label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's this channel about?"
                   className="mt-1 w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-[12.5px] text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={loading}
                  className="px-4 py-2 text-[12.5px] text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50">
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrgEditChannelModal({ channel, onClose, onSaved }: {
  channel: OrgChatChannel;
  onClose: () => void;
  onSaved: (ch: OrgChatChannel) => void;
}) {
  const [name, setName] = useState(channel.name);
  const [desc, setDesc] = useState(channel.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) { setError('Channel name is required.'); return; }
    setLoading(true);
    try {
      await apiClient.initCsrf();
      const updated = await orgChatApi.updateChannel(channel.id, { name: name.trim(), description: desc });
      onSaved(updated);
    } catch { setError('Failed to update channel.'); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"><X size={16} /></button>
        <h3 className="text-[15px] font-bold text-gray-800 mb-4">Edit Channel</h3>
        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Name</label>
            <div className="mt-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary-500">
              <Hash size={13} className="text-gray-400 shrink-0" />
              <input value={name} onChange={e => setName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                     placeholder="channel-name" className="flex-1 text-[13px] focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Description <span className="font-normal text-gray-400">(optional)</span></label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's this channel about?"
                   className="mt-1 w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-[12.5px] text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={loading}
                  className="px-4 py-2 text-[12.5px] text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50">
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrgConfirmDialog({ title, message, confirmLabel = 'Delete', danger = true, onConfirm, onCancel }: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6">
        <h3 className="text-[15px] font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-[13px] text-gray-500 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
                  className="px-4 py-2 text-[12.5px] text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm}
                  className={`px-4 py-2 text-[12.5px] text-white rounded-lg ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
