import { useState } from 'react';
import { X, Plus, Check, Trash2 } from 'lucide-react';
import { workspacesApi } from '../../../api/workspaces';
import apiClient from '../../../api/apiClient';
import { relativeTime } from '../../../utils/time';
import type { WorkspacePoll, User } from '../../../types';
import { senderName } from './chatUtils';

export function PollCard({
  poll, currentUserId, isOwner, onVote, onClose, onDelete,
}: {
  poll: WorkspacePoll;
  workspaceId: number;
  currentUserId: number;
  isOwner: boolean;
  onVote: (pollId: number, optionId: number) => void;
  onClose: (pollId: number) => void;
  onDelete: (pollId: number) => void;
}) {
  const authorName = senderName(poll.author as User);
  const isAuthor = poll.author.id === currentUserId;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-gray-800">{poll.question}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">By {authorName} · {relativeTime(poll.created_at)}</p>
        </div>
        {(isOwner || isAuthor) && !poll.is_closed && (
          <button onClick={() => onClose(poll.id)}
                  className="text-[11px] text-gray-400 hover:text-amber-600 transition-colors shrink-0">Close</button>
        )}
        {(isOwner || isAuthor) && (
          <button onClick={() => onDelete(poll.id)} className="text-red-400 hover:text-red-600 shrink-0">
            <Trash2 size={12} />
          </button>
        )}
      </div>
      {poll.is_closed && (
        <div className="text-[11px] font-semibold text-amber-700 bg-amber-50 rounded px-2 py-0.5 inline-block">Closed</div>
      )}
      <div className="space-y-1.5">
        {poll.options.map(opt => {
          const pct = poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
          return (
            <button
              key={opt.id}
              onClick={() => !poll.is_closed && onVote(poll.id, opt.id)}
              disabled={poll.is_closed}
              className={`w-full text-left relative px-3 py-2 rounded-lg border transition-colors ${
                opt.my_vote ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
              } ${poll.is_closed ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <div className="absolute inset-0 rounded-lg overflow-hidden">
                <div className="h-full bg-primary-100/40 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="relative flex items-center justify-between">
                <span className="text-[12.5px] text-gray-700">{opt.text}</span>
                <span className="flex items-center gap-1 text-[11px] text-gray-500">
                  {opt.my_vote && <Check size={11} className="text-primary-600" />}
                  {opt.vote_count} · {pct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-400">{poll.total_votes} vote{poll.total_votes !== 1 ? 's' : ''}{poll.allow_multiple ? ' · Multiple choice' : ''}</p>
    </div>
  );
}

export function CreatePollModal({ workspaceId, onClose, onCreated }: {
  workspaceId: number;
  onClose: () => void;
  onCreated: (poll: WorkspacePoll) => void;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const filled = options.filter(o => o.trim());
    if (!question.trim() || filled.length < 2) {
      setError('Question and at least 2 options are required.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.initCsrf();
      const poll = await workspacesApi.createPoll(workspaceId, {
        question: question.trim(),
        options: filled,
        allow_multiple: allowMultiple,
      });
      onCreated(poll);
    } catch { setError('Failed to create poll.'); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"><X size={16} /></button>
        <h3 className="text-[15px] font-bold text-gray-800 mb-4">Create Poll</h3>
        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Question</label>
            <textarea value={question} onChange={e => setQuestion(e.target.value)}
                      rows={2} placeholder="Ask a question..."
                      className="w-full mt-1 px-3 py-2 text-[13px] border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Options</label>
            <div className="mt-1 space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input value={opt} onChange={e => {
                    const next = [...options]; next[i] = e.target.value; setOptions(next);
                  }} placeholder={`Option ${i + 1}`}
                         className="flex-1 px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  {options.length > 2 && (
                    <button onClick={() => setOptions(options.filter((_, j) => j !== i))}
                            className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <button onClick={() => setOptions([...options, ''])}
                        className="text-[12px] text-primary-600 hover:text-primary-700 flex items-center gap-1">
                  <Plus size={12} /> Add option
                </button>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={allowMultiple} onChange={e => setAllowMultiple(e.target.checked)}
                   className="rounded border-gray-300" />
            <span className="text-[12.5px] text-gray-600">Allow multiple selections</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-[12.5px] text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={loading}
                  className="px-4 py-2 text-[12.5px] text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50">
            {loading ? 'Creating…' : 'Create poll'}
          </button>
        </div>
      </div>
    </div>
  );
}
