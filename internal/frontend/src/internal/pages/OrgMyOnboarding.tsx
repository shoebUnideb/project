import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2, Clock, Upload, FileText,
  Calendar, Award, Send, Paperclip, MessageSquare,
  Printer, X, ExternalLink, Link as LinkIcon,
  ChevronDown, ChevronUp, Info, AlertCircle, ListChecks,
  Search, MoreHorizontal, Eye, Copy,
} from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import {
  orgApi, formBuilderApi, commentsApi,
  type OnboardingInstance, type TaskInstance,
  type TaskType, type TaskStatus, type TaskComment,
} from '../api/orgApi';
import { useOrg } from '../context/OrgContext';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

const ONBOARDING_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What is My Onboarding?',
    bullets: [
      '**My Onboarding** is your personalised checklist of tasks to complete when you join.',
      'Your admin assigns an onboarding programme with phases and deadlines. Complete each task to progress.',
      'Once all tasks are done you receive a **completion certificate** you can download and share.',
    ],
  },
  {
    eyebrow: '2 · Task Types',
    bullets: [
      '**Upload** — attach a file (PDF, image, document) and submit it for admin review.',
      '**Approval** — request access or approval from your admin for a tool or system.',
      '**Form** — fill in an assigned survey or questionnaire directly in the portal.',
      '**Meeting** — schedule or join a meeting with your manager or buddy.',
      '**Info** — read-only material to acknowledge: policies, guides, videos.',
    ],
  },
  {
    eyebrow: '3 · Phases & Progress',
    bullets: [
      'Tasks are grouped into **phases** (e.g. Week 1 – Policy & Systems, Weeks 2–4 – Deep Dive).',
      'The progress bar and pie chart track your overall completion percentage.',
      'A task turns green once you complete it and an admin approves it (where required).',
    ],
  },
  {
    eyebrow: '4 · Overdue Tasks',
    bullets: [
      'Tasks with a **red Due date** are overdue — complete them as soon as possible.',
      'Overdue tasks appear in the **Overdue** filter tab so you can prioritise.',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'Click any task row to expand it and see instructions, links, or upload controls. Leave a comment in the task detail panel if you have a question.',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString('en-GB', opts ?? { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
function getFirstName(name: string) {
  return name.split(' ')[0];
}
function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const TYPE_ICON: Record<TaskType, React.ReactNode> = {
  info:     <Info size={13} className="text-gray-500" />,
  form:     <FileText size={13} className="text-gray-500" />,
  upload:   <Upload size={13} className="text-gray-500" />,
  approval: <CheckCircle2 size={13} className="text-gray-500" />,
  meeting:  <Calendar size={13} className="text-gray-500" />,
};
const TYPE_BADGE: Record<TaskType, string> = {
  info: 'bg-gray-100 text-gray-600', form: 'bg-gray-100 text-gray-600',
  upload: 'bg-gray-100 text-gray-600', approval: 'bg-gray-100 text-gray-600',
  meeting: 'bg-gray-100 text-gray-600',
};
const STATUS_BADGE: Record<TaskStatus, string> = {
  not_started: 'bg-gray-100 text-gray-500', in_progress: 'bg-gray-100 text-gray-700',
  completed: 'bg-gray-900 text-white', overdue: 'bg-red-50 text-red-600',
  blocked: 'bg-amber-50 text-amber-600',
};
const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: 'Not Started', in_progress: 'In Progress',
  completed: 'Done', overdue: 'Overdue', blocked: 'Blocked',
};

// ── Full TaskCard ─────────────────────────────────────────────────────────────

function TaskCard({
  task, onboardingId, onUpdated,
}: { task: TaskInstance; onboardingId: number; onUpdated: (t: TaskInstance) => void; }) {
  const [expanded, setExpanded]   = useState(true);
  const [notes, setNotes]         = useState(task.notes);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [taskErr, setTaskErr]     = useState('');
  const [confirmDone, setConfirmDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isDone = task.status === 'completed';

  const [formAnswers, setFormAnswers] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    (task.form_fields ?? []).forEach(f => { init[f.id] = f.response ?? ''; });
    return init;
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formErr, setFormErr]   = useState('');
  const [formSubmitted, setFormSubmitted] = useState(
    (task.form_fields ?? []).length > 0 && (task.form_fields ?? []).every(f => f.response !== null && f.response !== '')
  );

  const [comments, setComments]   = useState<TaskComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const hasForm = (task.form_fields ?? []).length > 0;

  const markDone = async () => {
    if (isDone || saving) return;
    setSaving(true); setTaskErr('');
    try { const u = await orgApi.updateTaskInstance(onboardingId, task.id, { status: 'completed' }); onUpdated(u); }
    catch { setTaskErr('Failed to mark as done.'); }
    finally { setSaving(false); }
  };
  const saveNotes = async () => {
    if (notes === task.notes) return;
    setSaving(true);
    try { const u = await orgApi.updateTaskInstance(onboardingId, task.id, { notes }); onUpdated(u); }
    catch { setTaskErr('Failed to save notes.'); }
    finally { setSaving(false); }
  };
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true); setTaskErr('');
    try { const u = await orgApi.uploadTaskFile(onboardingId, task.id, file, true); onUpdated(u); }
    catch { setTaskErr('Upload failed.'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const submitForm = async () => {
    const fields = task.form_fields ?? [];
    const missing = fields.filter(f => f.required && !formAnswers[f.id]?.trim());
    if (missing.length > 0) { setFormErr(`Please answer all required questions (${missing.length} missing).`); return; }
    setFormSubmitting(true); setFormErr('');
    try {
      const responses = fields.map(f => ({ field_id: f.id, answer: formAnswers[f.id] ?? '' }));
      const u = await formBuilderApi.submitForm(onboardingId, task.id, responses);
      setFormSubmitted(true); onUpdated(u);
    } catch { setFormErr('Failed to submit.'); }
    finally { setFormSubmitting(false); }
  };
  const loadComments = async () => {
    if (commentsLoaded) return;
    try { const d = await commentsApi.getComments(onboardingId, task.id); setComments(d); setCommentsLoaded(true); }
    catch { /* ignore */ }
  };
  const postComment = async () => {
    if (!commentBody.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const c = await commentsApi.postComment(onboardingId, task.id, commentBody.trim());
      setComments(prev => [...prev, c]); setCommentBody('');
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch { /* ignore */ }
    finally { setPostingComment(false); }
  };
  const handleExpand = () => { setExpanded(e => !e); if (!commentsLoaded) loadComments(); };

  // Auto-load comments when modal opens
  useEffect(() => { loadComments(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={['bg-white rounded-xl border transition-all', isDone ? 'border-gray-300 opacity-75' : 'border-gray-200'].join(' ')}>
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={handleExpand}>
        <button
          onClick={e => { e.stopPropagation(); if (!isDone && task.task_type !== 'approval' && !hasForm) setConfirmDone(true); }}
          disabled={isDone || task.task_type === 'approval' || saving || hasForm}
          className={['shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
            isDone ? 'border-gray-900 bg-gray-900' : 'border-gray-300 hover:border-gray-600',
            (task.task_type === 'approval' || hasForm) ? 'cursor-default' : 'cursor-pointer'].join(' ')}
        >
          {isDone && <CheckCircle2 size={12} className="text-white" />}
        </button>
        <div className="shrink-0 mt-0.5">{TYPE_ICON[task.task_type]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[13px] font-semibold leading-snug ${isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md ${STATUS_BADGE[task.status]}`}>{STATUS_LABEL[task.status]}</span>
              {expanded ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-md ${TYPE_BADGE[task.task_type]}`}>
              {TYPE_ICON[task.task_type]}{task.task_type.charAt(0).toUpperCase() + task.task_type.slice(1)}
            </span>
            {task.due_date && (
              <span className={`flex items-center gap-1 text-[11px] ${new Date(task.due_date) < new Date() && !isDone ? 'text-red-500' : 'text-gray-400'}`}>
                <Clock size={11} />Due {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {task.description && <p className="text-[12.5px] text-gray-600 leading-relaxed">{task.description}</p>}
          {task.task_type === 'info' && (task.content_url || task.content_body || task.content_file_url) && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              {task.content_url && (() => {
                const ytId = getYouTubeId(task.content_url);
                return ytId ? (
                  <div className="rounded-xl overflow-hidden aspect-video">
                    <iframe src={`https://www.youtube.com/embed/${ytId}`} className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                ) : (
                  <a href={task.content_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-[12.5px] font-semibold rounded-xl hover:bg-gray-50">
                    <LinkIcon size={13} /> Open Link <ExternalLink size={11} />
                  </a>
                );
              })()}
              {task.content_body && <p className="text-[12.5px] text-gray-700 leading-relaxed whitespace-pre-wrap">{task.content_body}</p>}
              {task.content_file_url && (
                <a href={task.content_file_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-[12.5px] font-semibold rounded-xl hover:bg-gray-50">
                  <Paperclip size={13} /> Download Attachment <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}
          {task.task_type === 'meeting' && (task.content_url || task.content_body) && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={11} /> Meeting Details
              </p>
              {task.content_url && (
                <a href={task.content_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-[12.5px] font-semibold rounded-xl hover:bg-gray-50">
                  <LinkIcon size={13} /> Join Meeting <ExternalLink size={11} />
                </a>
              )}
              {task.content_body && <p className="text-[12.5px] text-gray-700 leading-relaxed whitespace-pre-wrap">{task.content_body}</p>}
            </div>
          )}
          {hasForm && !isDone && (
            <div className="space-y-3">
              <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider">
                Form Questions {formSubmitted && <span className="text-gray-700 normal-case font-medium">— Submitted ✓</span>}
              </p>
              {(task.form_fields ?? []).map(field => (
                <div key={field.id} className="space-y-1">
                  <label className="block text-[12.5px] font-semibold text-gray-700">
                    {field.question}{field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {field.field_type === 'textarea' ? (
                    <textarea value={formAnswers[field.id] ?? ''} onChange={e => setFormAnswers(a => ({ ...a, [field.id]: e.target.value }))}
                      disabled={formSubmitted} rows={3} className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 resize-none disabled:bg-gray-50"/>
                  ) : field.field_type === 'choice' ? (
                    <div className="space-y-1.5">{(field.options ?? []).map(opt => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name={`field-${field.id}`} value={opt} checked={formAnswers[field.id] === opt}
                          onChange={() => setFormAnswers(a => ({ ...a, [field.id]: opt }))} disabled={formSubmitted} className="accent-gray-900"/>
                        <span className="text-[12.5px] text-gray-700">{opt}</span>
                      </label>
                    ))}</div>
                  ) : field.field_type === 'boolean' ? (
                    <div className="flex items-center gap-4">{['Yes', 'No'].map(opt => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name={`field-${field.id}`} value={opt} checked={formAnswers[field.id] === opt}
                          onChange={() => setFormAnswers(a => ({ ...a, [field.id]: opt }))} disabled={formSubmitted} className="accent-gray-900"/>
                        <span className="text-[12.5px] text-gray-700">{opt}</span>
                      </label>
                    ))}</div>
                  ) : field.field_type === 'date' ? (
                    <input type="date" value={formAnswers[field.id] ?? ''} onChange={e => setFormAnswers(a => ({ ...a, [field.id]: e.target.value }))}
                      disabled={formSubmitted} className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 disabled:bg-gray-50"/>
                  ) : (
                    <input type={field.field_type === 'number' ? 'number' : 'text'} value={formAnswers[field.id] ?? ''}
                      onChange={e => setFormAnswers(a => ({ ...a, [field.id]: e.target.value }))} disabled={formSubmitted}
                      placeholder="Your answer..." className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 disabled:bg-gray-50"/>
                  )}
                </div>
              ))}
              {formErr && <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{formErr}</p>}
              {!formSubmitted && (
                <button onClick={submitForm} disabled={formSubmitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-50">
                  <Send size={12} />{formSubmitting ? 'Submitting…' : 'Submit Form'}
                </button>
              )}
              {formSubmitted && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-[12.5px] text-gray-700 font-medium">
                  <CheckCircle2 size={13} /> Form submitted — this task is now complete.
                </div>
              )}
            </div>
          )}
          {hasForm && isDone && (
            <div className="space-y-2">
              <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider">Your Responses</p>
              {(task.form_fields ?? []).map(field => (
                <div key={field.id} className="py-1.5 border-b border-gray-100 last:border-0">
                  <p className="text-[11.5px] font-semibold text-gray-600">{field.question}</p>
                  <p className="text-[12.5px] text-gray-800 mt-0.5">{field.response || <span className="text-gray-400 italic">No answer</span>}</p>
                </div>
              ))}
            </div>
          )}
          {task.task_type === 'upload' && !isDone && (
            <div>
              <input
                type="file"
                ref={fileRef}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                className="hidden"
                onChange={handleFile}
              />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full flex flex-col items-center justify-center gap-1.5 px-3 py-5 text-[12.5px] font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-dashed border-gray-300 rounded-xl disabled:opacity-50 transition-colors">
                <Upload size={16} className="text-gray-500" />
                <span>{uploading ? 'Uploading…' : 'Upload Document or Image'}</span>
                <span className="text-[10.5px] font-normal text-gray-400">PDF, Word, Excel, PNG, JPG · up to 25 MB</span>
              </button>
            </div>
          )}
          {task.task_type === 'upload' && isDone && task.attachment_url && (
            <a href={task.attachment_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12.5px] text-gray-700 hover:text-gray-900 hover:underline font-medium">
              <Paperclip size={12} /> View uploaded file <ExternalLink size={11} />
            </a>
          )}
          {(task.task_type === 'info' || task.task_type === 'meeting') && !isDone && (
            <button onClick={() => setConfirmDone(true)} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg">
              <CheckCircle2 size={13} />{task.task_type === 'meeting' ? 'Mark as Attended' : 'Mark as Done'}
            </button>
          )}
          {task.task_type === 'approval' && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] font-medium border ${
              task.status === 'completed' ? 'bg-gray-100 text-gray-900 border-gray-200' : task.status === 'blocked' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}>
              <CheckCircle2 size={13} />
              {task.status === 'completed' ? 'Approved' : task.status === 'blocked' ? 'Rejected' : 'Awaiting approval from admin'}
            </div>
          )}
          <div>
            <label className="block text-[10.5px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} rows={2}
              placeholder="Add a note or comment..."
              className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 resize-none text-gray-700 placeholder:text-gray-300"/>
          </div>
          {taskErr && <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{taskErr}</p>}
          <div className="border-t border-gray-100 pt-3 space-y-3">
            <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare size={11} /> Comments {comments.length > 0 && `(${comments.length})`}
            </p>
            {comments.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {comments.map(c => (
                  <div key={c.id} className={`flex gap-2.5 ${c.is_mine ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${c.is_mine ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600'}`}>
                      {c.author_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className={`flex flex-col max-w-[80%] ${c.is_mine ? 'items-end' : 'items-start'}`}>
                      <div className={`px-3 py-2 rounded-2xl text-[12.5px] leading-relaxed ${c.is_mine ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>{c.body}</div>
                      <span className="text-[10.5px] text-gray-400 mt-0.5 px-1">
                        {c.is_mine ? 'You' : c.author_name} · {new Date(c.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
            )}
            {commentsLoaded && comments.length === 0 && <p className="text-[12px] text-gray-400">No comments yet.</p>}
            <div className="flex items-center gap-2">
              <input value={commentBody} onChange={e => setCommentBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                placeholder="Write a comment..."
                className="flex-1 px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"/>
              <button onClick={postComment} disabled={!commentBody.trim() || postingComment}
                className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-40 transition-colors">
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDone && !isDone && (
        <ConfirmDialog
          title={task.task_type === 'meeting' ? 'Mark as attended?' : 'Mark as done?'}
          message={`Once marked, this cannot be undone. Confirm you have completed "${task.title}".`}
          confirmLabel={task.task_type === 'meeting' ? 'Mark as Attended' : 'Mark as Done'}
          loading={saving}
          onConfirm={() => { setConfirmDone(false); markDone(); }}
          onCancel={() => setConfirmDone(false)}
        />
      )}
    </div>
  );
}

// ── Completion Certificate ────────────────────────────────────────────────────

function CompletionCertificate({ onboarding, onDismiss }: { onboarding: OnboardingInstance; onDismiss: () => void; }) {
  const memberName  = onboarding.user.display_name;
  const firstName   = onboarding.user.first_name || memberName.split(' ')[0];
  const completedDate = onboarding.completed_at
    ? new Date(onboarding.completed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const startDate   = new Date(onboarding.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const totalTasks  = onboarding.tasks.length;
  const phases = Array.from(new Set(onboarding.tasks.map(t => t.phase?.trim() || ''))).filter(Boolean);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:p-0 print:bg-white print:inset-auto print:static">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[600px] overflow-hidden print:shadow-none print:rounded-none">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 print:hidden">
          <div className="flex items-center gap-2 text-gray-900"><Award size={18} /><span className="text-[14px] font-bold">Onboarding Complete!</span></div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">
              <Printer size={13} /> Print Certificate
            </button>
            <button onClick={onDismiss} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={15} /></button>
          </div>
        </div>
        <div className="px-10 py-8 text-center print:px-12 print:py-10">
          <div className="border-4 border-double border-gray-300 rounded-2xl p-8 space-y-5">
            <div className="space-y-1">
              <div className="flex justify-center mb-3">
                <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center shadow-lg">
                  <Award size={26} className="text-white" />
                </div>
              </div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Certificate of Completion</p>
              <p className="text-[13px] text-gray-500 mt-2">This certifies that</p>
            </div>
            <div className="py-2 border-b border-gray-200">
              <p className="text-[28px] font-bold text-gray-900 tracking-tight leading-tight">{memberName}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[13px] text-gray-600">has successfully completed the</p>
              <p className="text-[18px] font-bold text-gray-900">{onboarding.template_name ?? 'Onboarding Program'}</p>
              <p className="text-[13px] text-gray-500">with all {totalTasks} task{totalTasks !== 1 ? 's' : ''} completed</p>
            </div>
            <div className="flex items-center justify-center gap-6 py-3 border-t border-b border-gray-100">
              <div className="text-center">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Started</p>
                <p className="text-[13px] font-semibold text-gray-700 mt-0.5">{startDate}</p>
              </div>
              <div className="w-8 h-px bg-gray-300" />
              <div className="text-center">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Completed</p>
                <p className="text-[13px] font-semibold text-gray-700 mt-0.5">{completedDate}</p>
              </div>
            </div>
            {phases.length > 0 && (
              <div className="text-center">
                <p className="text-[10.5px] text-gray-400 uppercase tracking-wider mb-2">Phases Completed</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {phases.map(ph => (
                    <span key={ph} className="text-[11px] font-semibold px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full border border-gray-200">{ph}</span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[13px] text-gray-500 italic">Congratulations, {firstName}! Welcome to the team. 🎉</p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between print:hidden">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-100 rounded-xl">
            <Printer size={14} /> Print / Save as PDF
          </button>
          <button onClick={onDismiss} className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg">
            View Task History
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page Skeleton ─────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-5 w-40 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-3.5 w-60 rounded-lg bg-gray-100 animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 items-start">
        <div className="col-span-2 h-[480px] rounded-xl bg-gray-100 animate-pulse" />
        <div className="space-y-4">
          <div className="h-52 rounded-xl bg-gray-100 animate-pulse" />
          <div className="h-36 rounded-xl bg-gray-100 animate-pulse" />
          <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ── Donut chart config ────────────────────────────────────────────────────────

const DONUT_COLORS = ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db'];

const TASK_CATEGORIES: { key: TaskType; label: string }[] = [
  { key: 'info',     label: 'Documentation' },
  { key: 'form',     label: 'Forms' },
  { key: 'upload',   label: 'Documents' },
  { key: 'meeting',  label: 'Meetings' },
  { key: 'approval', label: 'Approvals' },
];

const TYPE_LABEL: Record<TaskType, string> = {
  info: 'Info', form: 'Form', upload: 'Upload', approval: 'Approval', meeting: 'Meeting',
};

const TASK_DOT: Record<TaskStatus, string> = {
  not_started: 'bg-gray-400', in_progress: 'bg-gray-700',
  completed: 'bg-gray-900', overdue: 'bg-red-500', blocked: 'bg-amber-500',
};

// ── Task Row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, onboardingId, onOpen, onUpdated }: {
  task: TaskInstance;
  onboardingId: number;
  onOpen: () => void;
  onUpdated: (t: TaskInstance) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [acting, setActing]     = useState(false);
  const [copied, setCopied]     = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isDone   = task.status === 'completed';
  const hasForm  = (task.form_fields ?? []).length > 0;
  const canMarkDone = !isDone && task.task_type !== 'approval' && !hasForm;
  const canStart    = task.status === 'not_started';

  const quickUpdate = async (status: TaskStatus) => {
    setMenuOpen(false);
    setActing(true);
    try {
      const u = await orgApi.updateTaskInstance(onboardingId, task.id, { status });
      onUpdated(u);
    } catch { /* ignore */ }
    finally { setActing(false); }
  };

  const copyName = () => {
    navigator.clipboard.writeText(task.title).catch(() => {});
    setCopied(true);
    setTimeout(() => { setCopied(false); setMenuOpen(false); }, 1200);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div
      className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 px-4 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors items-center cursor-pointer group"
      onClick={onOpen}
    >
      {/* Task name + due date sub-line */}
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-gray-900 truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.phase && (
            <span className="text-[10.5px] text-gray-400 font-medium truncate">{task.phase}</span>
          )}
          {task.due_date && task.phase && <span className="text-[10px] text-gray-300">·</span>}
          {task.due_date && (
            <span className={`text-[10.5px] font-medium ${task.status !== 'completed' && new Date(task.due_date) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
              Due {fmtDate(task.due_date)}
            </span>
          )}
        </div>
      </div>

      {/* Phase */}
      <p className="text-[12px] text-gray-500 truncate">{task.phase || '—'}</p>

      {/* Type */}
      <div className="flex items-center gap-1.5">
        {TYPE_ICON[task.task_type]}
        <span className="text-[12px] text-gray-600">{TYPE_LABEL[task.task_type]}</span>
      </div>

      {/* Status + 3-dot */}
      <div className="flex items-center gap-2.5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${TASK_DOT[task.status]}`} />
          <span className="text-[11.5px] text-gray-700 whitespace-nowrap">{STATUS_LABEL[task.status]}</span>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            disabled={acting}
            className="p-1 rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-700 opacity-0 group-hover:opacity-100 disabled:opacity-40 transition-opacity"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-xl z-30 py-1">
              <button
                onClick={() => { setMenuOpen(false); onOpen(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50"
              >
                <Eye size={13} className="text-gray-400" /> Open Task
              </button>

              {canMarkDone && (
                <button
                  onClick={() => quickUpdate('completed')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50"
                >
                  <CheckCircle2 size={13} className="text-gray-400" />
                  {task.task_type === 'meeting' ? 'Mark as Attended' : 'Mark as Done'}
                </button>
              )}

              {canStart && (
                <button
                  onClick={() => quickUpdate('in_progress')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50"
                >
                  <Clock size={13} className="text-gray-400" /> Start Task
                </button>
              )}

              <div className="h-px bg-gray-100 my-1" />

              <button
                onClick={copyName}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50"
              >
                <Copy size={13} className="text-gray-400" />
                {copied ? 'Copied!' : 'Copy Task Name'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Task Modal ────────────────────────────────────────────────────────────────

function TaskModal({ task, onboardingId, onUpdated, onClose }: {
  task: TaskInstance;
  onboardingId: number;
  onUpdated: (t: TaskInstance) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-[5vh_5vw]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[90vw] h-[90vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <span className="text-[13px] font-semibold text-gray-900">Task Details</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        {/* Scrollable task content */}
        <div className="flex-1 overflow-y-auto p-5">
          <TaskCard task={task} onboardingId={onboardingId} onUpdated={onUpdated} />
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgMyOnboarding() {
  const { isLoading: orgLoading } = useOrg();

  const [onboarding, setOnboarding]         = useState<OnboardingInstance | null | undefined>(undefined);
  const [loading, setLoading]               = useState(true);
  const [showCertificate, setShowCertificate] = useState(false);
  const [selectedTask, setSelectedTask]     = useState<TaskInstance | null>(null);
  const [listTab, setListTab]               = useState<'all' | 'in_progress' | 'overdue' | 'completed'>('all');
  const [search, setSearch]                 = useState('');
  const [page, setPage]                     = useState(1);

  useEffect(() => {
    if (orgLoading) return;
    orgApi.getMyOnboarding()
      .catch(() => null)
      .then(ob => {
        setOnboarding(ob);
        if (ob?.status === 'completed') setShowCertificate(true);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgLoading]);

  const updateTask = (updated: TaskInstance) => {
    if (!onboarding) return;
    const tasks = onboarding.tasks.map(t => t.id === updated.id ? updated : t);
    const completed = tasks.filter(t => t.status === 'completed').length;
    const total = tasks.length;
    const allDone = total > 0 && completed === total;
    setOnboarding(prev => prev ? {
      ...prev, tasks,
      progress_pct: total > 0 ? Math.round(completed / total * 100) : 0,
      ...(allDone ? { status: 'completed' as const } : {}),
    } : prev);
    if (selectedTask?.id === updated.id) setSelectedTask(updated);
    if (allDone) {
      setShowCertificate(true);
      orgApi.getMyOnboarding().then(d => { if (d) setOnboarding(d); }).catch(() => {});
    }
  };

  if (orgLoading || loading) return <PageSkeleton />;

  if (!onboarding) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <h1 className="text-[16px] font-bold text-gray-900">My Onboarding</h1>
          <PageHelp title="How My Onboarding Works" sections={ONBOARDING_HELP} />
        </div>
        <p className="text-[12px] text-gray-500 mb-8">Your onboarding tasks and checklist</p>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
            <ListChecks size={28} className="text-gray-500" />
          </div>
          <p className="text-[15px] font-semibold text-gray-700">No onboarding set up yet</p>
          <p className="text-[13px] text-gray-400 mt-1 max-w-sm leading-relaxed">
            Your admin will create an onboarding program for you. Check back soon.
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const tasks = [...onboarding.tasks].sort((a, b) => {
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (a.due_date) return -1; if (b.due_date) return 1; return a.id - b.id;
  });

  const isOverdue = (t: TaskInstance) =>
    t.status !== 'completed' && !!t.due_date && new Date(t.due_date) < now;

  const filtered = tasks
    .filter(t => {
      if (listTab === 'in_progress') return t.status === 'in_progress' || t.status === 'not_started';
      if (listTab === 'overdue')     return isOverdue(t);
      if (listTab === 'completed')   return t.status === 'completed';
      return true;
    })
    .filter(t => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return t.title.toLowerCase().includes(q) || (t.phase || '').toLowerCase().includes(q);
    });

  const tabCounts = {
    all:         tasks.length,
    in_progress: tasks.filter(t => t.status === 'in_progress' || t.status === 'not_started').length,
    overdue:     tasks.filter(isOverdue).length,
    completed:   tasks.filter(t => t.status === 'completed').length,
  };

  const doneCount = tasks.filter(t => t.status === 'completed').length;

  const PAGE_SIZE   = 7;
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages);
  const paginated   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Sidebar: donut chart data
  const categoryData = TASK_CATEGORIES
    .map((cat, i) => ({
      ...cat,
      count: tasks.filter(t => t.task_type === cat.key).length,
      color: DONUT_COLORS[i],
    }))
    .filter(c => c.count > 0);

  // Sidebar: overdue tasks (top 5)
  const overdueTasks = tasks
    .filter(isOverdue)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 5);

  const onboardingStatusDot: Record<string, string> = {
    active: 'bg-gray-700', pending: 'bg-gray-400', completed: 'bg-gray-900',
    paused: 'bg-gray-300', archived: 'bg-gray-300',
  };

  return (
    <div>
      {showCertificate && (
        <CompletionCertificate onboarding={onboarding} onDismiss={() => setShowCertificate(false)} />
      )}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onboardingId={onboarding.id}
          onUpdated={updateTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-bold text-gray-900">My Onboarding</h1>
            <PageHelp title="How My Onboarding Works" sections={ONBOARDING_HELP} />
          </div>
          <p className="text-[12px] text-gray-500 mt-0.5">
            {onboarding.template_name ?? 'Custom Onboarding'} · {doneCount}/{tasks.length} tasks completed
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${onboardingStatusDot[onboarding.status] ?? 'bg-gray-400'}`} />
            <span className="text-[12px] text-gray-600 font-medium capitalize">{onboarding.status}</span>
          </div>
          {onboarding.status === 'completed' && (
            <button
              onClick={() => setShowCertificate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold bg-gray-900 text-white hover:bg-gray-800 rounded-lg"
            >
              <Award size={13} /> View Certificate
            </button>
          )}
        </div>
      </div>

      {/* ── Main Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 items-start">

        {/* ── Task List Card (col-span-2) ───────────────────────────────────── */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">

          {/* Card title + tabs */}
          <div className="px-4 pt-4">
            <p className="text-[13px] font-bold text-gray-900 mb-3">Active Onboarding Tasks</p>
            <div className="flex border-b border-gray-200">
              {([
                ['all',         'All'],
                ['in_progress', 'In Progress'],
                ['overdue',     'Overdue'],
                ['completed',   'Completed'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setListTab(key); setPage(1); }}
                  className={`px-3 pb-2.5 pt-0.5 text-[12px] font-semibold border-b-2 -mb-px transition-colors ${
                    listTab === key
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label} <span className="text-[11px]">({tabCounts[key]})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by task name or phase..."
                className="w-full pl-8 pr-3 py-2 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50/50">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Task</p>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Phase</p>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Type</p>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</p>
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-[13px] text-gray-400">No tasks found.</p>
            </div>
          ) : (
            paginated.map(task => (
              <TaskRow key={task.id} task={task} onboardingId={onboarding.id} onOpen={() => setSelectedTask(task)} onUpdated={updateTask} />
            ))
          )}

          {/* Footer: pagination + progress */}
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-4 bg-gray-50/30">
            {/* Progress */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] text-gray-500">Overall Progress</p>
                  <p className="text-[11px] font-bold text-gray-900">{onboarding.progress_pct}%</p>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-900 rounded-full transition-all duration-500"
                    style={{ width: `${onboarding.progress_pct}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-400 shrink-0">{doneCount} / {tasks.length} done</p>
            </div>

            {/* Divider */}
            {totalPages > 1 && <div className="w-px h-8 bg-gray-200 shrink-0" />}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 shrink-0">
                <p className="text-[11px] text-gray-400 mr-1">
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[13px]"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                  .reduce<(number | '…')[]>((acc, n, idx, arr) => {
                    if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…');
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, i) =>
                    n === '…' ? (
                      <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-[11px] text-gray-400">…</span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => setPage(n as number)}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-[12px] font-medium transition-colors border ${
                          safePage === n
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        {n}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[13px]"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Task Completion by Category */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[13px] font-bold text-gray-900 mb-3">Task Completion by Category</p>
            {categoryData.length === 0 ? (
              <p className="text-[12px] text-gray-400 text-center py-4">No tasks yet.</p>
            ) : (
              <div className="flex items-center gap-3">
                {/* Donut */}
                <div className="relative shrink-0">
                  <PieChart width={96} height={96}>
                    <Pie
                      data={categoryData}
                      cx={44} cy={44}
                      innerRadius={28} outerRadius={44}
                      dataKey="count"
                      strokeWidth={0}
                    >
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[9px] text-gray-400 leading-none">Total</p>
                    <p className="text-[16px] font-bold text-gray-900 leading-tight">{tasks.length}</p>
                    <p className="text-[9px] text-gray-400 leading-none">Tasks</p>
                  </div>
                </div>
                {/* Legend */}
                <div className="flex-1 space-y-1.5 min-w-0">
                  {categoryData.map((cat, i) => (
                    <div key={cat.key} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <span className="text-[11.5px] text-gray-700 truncate">{cat.label}</span>
                      </div>
                      <span className="text-[11.5px] font-semibold text-gray-900 shrink-0">
                        {cat.count} <span className="text-gray-400 font-normal">({tasks.length ? Math.round(cat.count / tasks.length * 100) : 0}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Overdue Tasks */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[13px] font-bold text-gray-900 mb-3">Overdue Tasks</p>
            {overdueTasks.length === 0 ? (
              <p className="text-[12px] text-gray-400 text-center py-3">No overdue tasks.</p>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_auto] gap-2 mb-2 px-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Task</p>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Days</p>
                </div>
                <div className="space-y-1">
                  {overdueTasks.map(task => {
                    const days = Math.ceil((now.getTime() - new Date(task.due_date!).getTime()) / 86400000);
                    return (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="w-full grid grid-cols-[1fr_auto] gap-2 hover:bg-gray-50 rounded-lg px-1 py-1.5 transition-colors text-left"
                      >
                        <p className="text-[12px] text-gray-700 truncate">{task.title}</p>
                        <p className="text-[12px] font-bold text-red-600">{days}d</p>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Program Info */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[13px] font-bold text-gray-900 mb-3">Program Info</p>
            <div className="space-y-2.5">
              {([
                { label: 'Template', value: onboarding.template_name },
                { label: 'Manager',  value: onboarding.manager_name },
                { label: 'Buddy',    value: onboarding.buddy_name },
                { label: 'Started',  value: fmtDate(onboarding.start_date) },
                { label: 'Due',      value: onboarding.due_date ? fmtDate(onboarding.due_date) : null },
              ] as { label: string; value: string | null | undefined }[]).map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[11.5px] text-gray-400 w-14 shrink-0">{label}</span>
                  <span className="text-[12px] font-semibold text-gray-800 flex-1 truncate">{value || '—'}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
