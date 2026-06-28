import { useState } from 'react';
import { StickyNote, Pencil, Trash2, X } from 'lucide-react';
import { useApiList } from '../../../hooks/useApi';
import { workspacesApi } from '../../../api/workspaces';
import apiClient from '../../../api/apiClient';
import type { WorkspaceTaskMentorNote } from '../../../types';

export function MentorNotesPanel({
  workspaceId, taskId, submissionId,
}: {
  workspaceId: number; taskId: number; submissionId: number;
}) {
  const { data: notes, loading, refetch } = useApiList<WorkspaceTaskMentorNote>(
    () => workspacesApi.getNotes(workspaceId, taskId, submissionId),
    [submissionId],
  );
  const [text, setText]           = useState('');
  const [posting, setPosting]     = useState(false);
  const [editId, setEditId]       = useState<number | null>(null);
  const [editText, setEditText]   = useState('');

  const addNote = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.addNote(workspaceId, taskId, submissionId, text.trim());
      setText('');
      refetch();
    } finally { setPosting(false); }
  };

  const saveEdit = async (noteId: number) => {
    if (!editText.trim()) return;
    await apiClient.initCsrf();
    await workspacesApi.updateNote(workspaceId, taskId, submissionId, noteId, editText.trim());
    setEditId(null);
    refetch();
  };

  const deleteNote = async (noteId: number) => {
    await apiClient.initCsrf();
    await workspacesApi.deleteNote(workspaceId, taskId, submissionId, noteId);
    refetch();
  };

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-600 mb-2 flex items-center gap-1.5">
        <StickyNote size={11} /> Private Notes <span className="text-gray-400 normal-case font-normal">(only you see these)</span>
      </p>
      {loading && <p className="text-[12px] text-gray-400">Loading…</p>}

      <div className="space-y-2 mb-3">
        {notes.map(n => (
          <div key={n.id} className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 group">
            {editId === n.id ? (
              <div className="flex gap-2">
                <input
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-[12.5px] border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(n.id); if (e.key === 'Escape') setEditId(null); }}
                />
                <button onClick={() => saveEdit(n.id)} className="text-amber-600 hover:text-amber-800 text-[11.5px] font-semibold">Save</button>
                <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <p className="flex-1 text-[12.5px] text-amber-900 leading-relaxed">{n.text}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => { setEditId(n.id); setEditText(n.text); }} className="text-amber-400 hover:text-amber-700">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => deleteNote(n.id)} className="text-amber-400 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )}
            <p className="text-[10px] text-amber-400 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
          placeholder="Add a private note…"
          className="flex-1 px-3 py-2 text-[12.5px] border border-amber-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400 bg-amber-50/50 placeholder-amber-300"
        />
        <button onClick={addNote} disabled={posting || !text.trim()}
          className="px-3 py-2 text-[12px] font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl transition-colors">
          {posting ? '…' : 'Add'}
        </button>
      </div>
    </div>
  );
}
