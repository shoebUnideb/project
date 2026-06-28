import { useState, useRef } from 'react';
import {
  X, Calendar, ThumbsUp, AlertTriangle, RotateCcw, CheckSquare,
  CheckCircle, Paperclip, UploadCloud, FileText, Eye, Download,
  Trash2, Send, MessageSquare, History, GitMerge, Loader2,
  MoreHorizontal,
} from 'lucide-react';
import { useApi } from '../../../hooks/useApi';
import { workspacesApi } from '../../../api/workspaces';
import apiClient from '../../../api/apiClient';
import type { WorkspaceTaskSubmission, WorkspaceTaskRubricCriteria } from '../../../types';
import Avatar from '../../../components/ui/Avatar';
import MentionTextarea from '../../../components/ui/MentionTextarea';
import { StatusPill } from '../../../components/workspace/task/TaskStatusPill';
import { RevisionTimeline } from '../../../components/workspace/task/RevisionTimeline';
import { MentorNotesPanel } from '../../../components/workspace/task/MentorNotesPanel';
import { RubricScorePanel } from '../../../components/workspace/task/RubricScorePanel';
import { PeerReviewDrawerPanel } from '../../../components/workspace/task/PeerReviewPanels';
import { DocCommentThread } from '../../../components/workspace/task/DocCommentThread';

type DrawerTab = 'review' | 'comments' | 'history' | 'notes' | 'peer';

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export function SubmissionDrawer({
  workspaceId, taskId, submissionId,
  criteria,
  onClose, onReviewed,
}: {
  workspaceId: number; taskId: number; submissionId: number;
  criteria?: WorkspaceTaskRubricCriteria[];
  onClose: () => void; onReviewed: () => void;
}) {
  const { data: sub, loading, refetch } = useApi<WorkspaceTaskSubmission>(
    () => workspacesApi.getSubmission(workspaceId, taskId, submissionId),
    [submissionId],
  );
  const [comment, setComment]         = useState('');
  const [posting, setPosting]         = useState(false);
  const [reviewing, setReviewing]     = useState(false);
  const [overrideDue, setOverrideDue] = useState<string>('');
  const [savingDue, setSavingDue]     = useState(false);
  const [savingLate, setSavingLate]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading]     = useState(false);
  const [drawerTab, setDrawerTab]     = useState<DrawerTab>('review');
  const [dueInitialised, setDueInitialised] = useState(false);

  if (sub && !dueInitialised) {
    setOverrideDue(sub.due_date_override ?? '');
    setDueInitialised(true);
  }

  if (loading || !sub) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-10 w-full max-w-5xl text-center text-gray-400">
        <Loader2 size={24} className="animate-spin mx-auto mb-3 text-primary-500" />
        Loading submission…
      </div>
    </div>
  );

  const name = `${sub.student.user.first_name || ''} ${sub.student.user.last_name || ''}`.trim() || sub.student.user.username;
  const initials = name.split(' ').map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const avatarPalette = ['bg-emerald-500', 'bg-primary-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-teal-500'];
  const avatarColor   = avatarPalette[name.charCodeAt(0) % avatarPalette.length];
  const effDue = overrideDue || sub.effective_due_date;

  const handleReview = async (action: 'completed' | 'needs_revision') => {
    setReviewing(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.reviewSubmission(workspaceId, taskId, sub.id, action);
      onReviewed();
    } finally { setReviewing(false); }
  };

  const handleReopen = async () => {
    setReviewing(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.reopenSubmission(workspaceId, taskId, sub.id);
      onReviewed();
    } finally { setReviewing(false); }
  };

  const handleUndoReview = async () => {
    setReviewing(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.undoReviewSubmission(workspaceId, taskId, sub.id);
      onReviewed();
    } finally { setReviewing(false); }
  };

  const saveDueOverride = async () => {
    setSavingDue(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.setSubmissionDueDate(workspaceId, taskId, sub.id, overrideDue || null);
      refetch();
    } finally { setSavingDue(false); }
  };

  const saveLateOverride = async (val: boolean | null) => {
    setSavingLate(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.setLateOverride(workspaceId, taskId, sub.id, val);
      refetch();
    } finally { setSavingLate(false); }
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.addComment(workspaceId, taskId, sub.id, comment.trim());
      setComment('');
      refetch();
    } finally { setPosting(false); }
  };

  const uploadDoc = async (file: File) => {
    setUploading(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.uploadDocument(workspaceId, taskId, sub.id, file, file.name);
      refetch();
    } finally { setUploading(false); }
  };

  const deleteDoc = async (docId: number) => {
    await apiClient.initCsrf();
    await workspacesApi.deleteDocument(workspaceId, taskId, sub.id, docId);
    refetch();
  };

  const tabs = [
    { key: 'review'   as DrawerTab, label: 'Review' },
    { key: 'comments' as DrawerTab, label: `Comments (${sub.comments.length})` },
    { key: 'history'  as DrawerTab, label: `History (${sub.status_events.length})` },
    { key: 'notes'    as DrawerTab, label: 'Private Notes' },
    ...(criteria && criteria.length > 0 && sub.peer_reviews && sub.peer_reviews.length > 0
      ? [{ key: 'peer' as DrawerTab, label: `Peer (${sub.peer_reviews.length})` }]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full ${avatarColor} flex items-center justify-center shrink-0`}>
              <span className="text-white text-[15px] font-bold leading-none">{initials || '?'}</span>
            </div>
            <div>
              <p className="text-[17px] font-bold text-gray-900 leading-tight">{name}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <StatusPill s={sub.status} />
                {sub.effective_late && (
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-widest">Late</span>
                )}
                {effDue && (
                  <span className="text-[12px] text-gray-500 flex items-center gap-1">
                    <Calendar size={11} className="shrink-0" />
                    Due {fmtDate(effDue)}
                    {sub.due_date_override && <span className="ml-1 text-amber-600 font-medium">(custom)</span>}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-100 shrink-0 px-2">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setDrawerTab(t.key)}
              className={`px-5 py-3.5 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                drawerTab === t.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* Review tab */}
          {drawerTab === 'review' && (
            <div className="space-y-6">

              {(sub.status === 'submitted' || sub.status === 'resubmitted') && (
                <div className="p-5 bg-primary-50 rounded-2xl border border-primary-100">
                  <p className="text-[13px] font-semibold text-primary-800 mb-3">Review this submission</p>
                  <div className="flex gap-2.5">
                    <button onClick={() => handleReview('completed')} disabled={reviewing}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl transition-colors">
                      <ThumbsUp size={14} /> Mark Complete
                    </button>
                    <button onClick={() => handleReview('needs_revision')} disabled={reviewing}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl transition-colors">
                      <AlertTriangle size={14} /> Needs Revision
                    </button>
                  </div>
                </div>
              )}

              {(sub.status === 'completed' || sub.status === 'needs_revision' || !['not_started', 'in_progress'].includes(sub.status)) && (
                <div className="grid grid-cols-2 gap-3">
                  {(sub.status === 'completed' || sub.status === 'needs_revision') && (
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col gap-2">
                      <p className="text-[13px] font-semibold text-gray-700">Undo Review</p>
                      <p className="text-[11.5px] text-gray-500 flex-1">Move this submission back to its previous submitted state so you can re-review it.</p>
                      <button onClick={handleUndoReview} disabled={reviewing}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-60 text-gray-700 text-[12.5px] font-semibold rounded-xl transition-colors self-start">
                        <RotateCcw size={13} /> Undo Review
                      </button>
                    </div>
                  )}
                  {!['not_started', 'in_progress'].includes(sub.status) && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex flex-col gap-2">
                      <p className="text-[13px] font-semibold text-amber-800">Reopen for Student</p>
                      <p className="text-[11.5px] text-amber-700 flex-1">Reset to In Progress so the student can make changes and resubmit.</p>
                      <button onClick={handleReopen} disabled={reviewing}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-[12.5px] font-semibold rounded-xl transition-colors self-start">
                        <RotateCcw size={13} /> Reopen Submission
                      </button>
                    </div>
                  )}
                </div>
              )}

              {sub.effective_late !== undefined && (
                <section>
                  <h3 className="text-[13px] font-semibold text-gray-700 flex items-center gap-2 mb-3">
                    <AlertTriangle size={14} className="text-amber-500" /> Late Override
                  </h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-[13px] font-medium ${sub.effective_late ? 'text-red-600' : 'text-green-600'}`}>
                      Currently: {sub.effective_late ? 'Marked late' : 'Not late'}
                    </span>
                    <button
                      onClick={() => saveLateOverride(sub.effective_late ? false : true)}
                      disabled={savingLate}
                      className="px-4 py-2 text-[12.5px] font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors text-gray-600">
                      {savingLate ? '…' : sub.effective_late ? 'Excuse (not late)' : 'Mark as late'}
                    </button>
                    {sub.late_override !== null && (
                      <button onClick={() => saveLateOverride(null)} disabled={savingLate}
                        className="text-[12px] text-gray-400 hover:text-gray-600 underline">Reset</button>
                    )}
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-[13px] font-semibold text-gray-700 flex items-center gap-2 mb-3">
                  <Calendar size={14} className="text-gray-400" /> Due Date
                </h3>
                <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/60">
                  <p className="text-[12px] font-medium text-gray-500 mb-2.5">Custom due date</p>
                  <div className="flex gap-2.5 items-center flex-wrap">
                    <input
                      type="date"
                      value={overrideDue}
                      onChange={e => setOverrideDue(e.target.value)}
                      className="px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                    />
                    {overrideDue && (
                      <button onClick={() => setOverrideDue('')} className="text-gray-400 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                    <button onClick={saveDueOverride} disabled={savingDue}
                      className="px-4 py-2 text-[13px] font-semibold bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl transition-colors disabled:opacity-50">
                      {savingDue ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                  <p className="text-[11.5px] text-gray-400 mt-2.5">Override the task due date for this student only.</p>
                </div>
              </section>

              {criteria && criteria.length > 0 && (
                <RubricScorePanel
                  workspaceId={workspaceId}
                  taskId={taskId}
                  submissionId={sub.id}
                  criteria={criteria}
                  existingScores={sub.rubric_scores}
                  onSaved={refetch}
                />
              )}

              {sub.checks.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-[13px] font-semibold text-gray-700 flex items-center gap-2">
                      <CheckSquare size={14} className="text-gray-400" /> Deliverables
                    </h3>
                    <span className="text-[12px] text-gray-400 font-medium">{sub.checks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {sub.checks.map(c => (
                      <div key={c.id}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl ${c.is_done ? 'bg-green-50' : 'bg-gray-50'}`}>
                        <div className="flex items-center gap-2.5">
                          <CheckCircle size={16} className={c.is_done ? 'text-green-500' : 'text-gray-300'} />
                          <span className={`text-[13px] font-medium ${c.is_done ? 'text-green-800' : 'text-gray-500'}`}>
                            {c.deliverable.title}
                          </span>
                        </div>
                        {c.is_done && (
                          <span className="text-[11px] font-semibold text-green-600 bg-white px-2.5 py-1 rounded-full border border-green-200">
                            Completed
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold text-gray-700 flex items-center gap-2">
                      <Paperclip size={14} className="text-gray-400" /> Documents
                    </h3>
                    <span className="text-[12px] text-gray-400 font-medium">{sub.documents.length}</span>
                  </div>
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-600 hover:text-primary-800 border border-primary-200 hover:border-primary-400 bg-primary-50 hover:bg-primary-100 px-3.5 py-2 rounded-xl transition-colors disabled:opacity-50">
                    <UploadCloud size={13} /> {uploading ? 'Uploading…' : 'Upload Document'}
                  </button>
                </div>
                {sub.documents.length === 0 && (
                  <p className="text-[12.5px] text-gray-400 text-center py-4 bg-gray-50 rounded-xl">No files attached yet.</p>
                )}
                <div className="space-y-2">
                  {sub.documents.map(doc => {
                    const ext = doc.file_url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
                    const isPdf = ext === 'pdf';
                    const isStudentUpload = doc.uploaded_by.id === sub.student.user.id;
                    return (
                      <div key={doc.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                        <div className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPdf ? 'bg-red-50' : 'bg-primary-50'}`}>
                            <FileText size={18} className={isPdf ? 'text-red-500' : 'text-primary-500'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <a href={doc.file_url} target="_blank" rel="noreferrer"
                                className="text-[13px] font-medium text-gray-800 hover:text-primary-600 truncate">
                                {doc.title}
                              </a>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                                isStudentUpload ? 'bg-primary-50 text-primary-600' : 'bg-purple-50 text-purple-600'
                              }`}>
                                {isStudentUpload ? 'Student' : 'Mentor'}
                              </span>
                            </div>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">
                              {ext.toUpperCase()} • Uploaded {new Date(doc.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a href={doc.file_url} target="_blank" rel="noreferrer"
                              className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-300 transition-colors"
                              title="View"><Eye size={14} /></a>
                            <a href={doc.file_url} download
                              className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-300 transition-colors"
                              title="Download"><Download size={14} /></a>
                            <button onClick={() => deleteDoc(doc.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
                              title="Delete"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div className="px-4 pb-3">
                          <DocCommentThread workspaceId={workspaceId} taskId={taskId} submissionId={sub.id} docId={doc.id} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <input ref={fileRef} type="file" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f); }} />
              </section>
            </div>
          )}

          {/* Comments tab */}
          {drawerTab === 'comments' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto space-y-5 pb-6">
                {sub.comments.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                    <MessageSquare size={32} className="text-gray-200" />
                    <p className="text-[13px]">No comments yet. Start the conversation.</p>
                  </div>
                )}
                {sub.comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar name={c.author.username} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-gray-800">{c.author.username}</span>
                          <span className="text-[11.5px] text-gray-400">
                            {new Date(c.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        <button className="text-gray-300 hover:text-gray-500 transition-colors p-1">
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                      <p className="text-[13px] text-gray-700 leading-relaxed">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-4 mt-auto shrink-0">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 min-w-0">
                    <MentionTextarea
                      value={comment}
                      onChange={setComment}
                      workspaceId={workspaceId}
                      placeholder="Write a comment visible to both sides…"
                      rows={3}
                      className="w-full px-4 py-3 text-[13px] border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                    />
                  </div>
                  <button onClick={postComment} disabled={posting || !comment.trim()}
                    className="flex items-center gap-1.5 px-5 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-2xl font-semibold text-[13px] transition-colors shrink-0">
                    <Send size={14} /> Send
                  </button>
                </div>
                <p className="text-[11.5px] text-gray-400 mt-2">Comments are visible to both mentor and student.</p>
              </div>
            </div>
          )}

          {/* History tab */}
          {drawerTab === 'history' && (
            <div>
              <p className="text-[12px] font-semibold text-gray-500 flex items-center gap-2 mb-5">
                <History size={13} /> Revision Timeline
              </p>
              <RevisionTimeline events={sub.status_events} />
            </div>
          )}

          {/* Private Notes tab */}
          {drawerTab === 'notes' && (
            <MentorNotesPanel workspaceId={workspaceId} taskId={taskId} submissionId={sub.id} />
          )}

          {/* Peer Review tab */}
          {drawerTab === 'peer' && (
            <div>
              <p className="text-[12px] font-semibold text-gray-500 flex items-center gap-2 mb-5">
                <GitMerge size={13} /> Peer Review Results
              </p>
              <PeerReviewDrawerPanel reviews={sub.peer_reviews ?? []} criteria={criteria ?? []} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
