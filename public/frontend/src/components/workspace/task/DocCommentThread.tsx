import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { workspacesApi } from '../../../api/workspaces';
import apiClient from '../../../api/apiClient';
import type { DocumentInlineComment } from '../../../types';
import Avatar from '../../ui/Avatar';

export function DocCommentThread({
  workspaceId, taskId, submissionId, docId,
}: {
  workspaceId: number; taskId: number; submissionId: number; docId: number;
}) {
  const [open, setOpen]         = useState(false);
  const [comments, setComments] = useState<DocumentInlineComment[]>([]);
  const [loadingC, setLoadingC] = useState(false);
  const [text, setText]         = useState('');
  const [posting, setPosting]   = useState(false);

  const load = async () => {
    setLoadingC(true);
    try {
      const data = await workspacesApi.getDocInlineComments(workspaceId, taskId, submissionId, docId);
      setComments(Array.isArray(data) ? data : []);
    } catch {
      setComments([]);
    } finally { setLoadingC(false); }
  };

  useEffect(() => { load(); }, [docId]);

  const post = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.addDocInlineComment(workspaceId, taskId, submissionId, docId, {
        page_number: 1, x_pct: 0, y_pct: 0, body: text.trim(),
      });
      setText('');
      load();
    } finally { setPosting(false); }
  };

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11.5px] text-gray-400 hover:text-primary-600 transition-colors">
        <MessageSquare size={12} />
        {open ? 'Hide comments' : `${comments.length} comment${comments.length !== 1 ? 's' : ''}`}
      </button>
      {open && (
        <div className="mt-2 pl-3 border-l-2 border-gray-100 space-y-2">
          {loadingC && <p className="text-[11px] text-gray-400">Loading…</p>}
          {!loadingC && comments.length === 0 && (
            <p className="text-[11.5px] text-gray-400 italic">No comments yet.</p>
          )}
          {comments.map(c => (
            <div key={c.id} className="flex gap-2">
              <Avatar name={c.author.username} size="xs" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11.5px] font-semibold text-gray-700">{c.author.username}</span>
                  <span className="text-[10.5px] text-gray-400">
                    {new Date(c.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="text-[12.5px] text-gray-700 leading-snug">{c.body}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); } }}
              placeholder="Add a comment…"
              className="flex-1 px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
            <button onClick={post} disabled={posting || !text.trim()}
              className="px-3 py-1.5 text-[12px] font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors shrink-0">
              {posting ? '…' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
