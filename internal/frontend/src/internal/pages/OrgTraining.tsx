import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  GraduationCap, Plus, Pencil, Trash2, X, Search, Users,
  ChevronDown, ChevronUp, BookOpen, Clock, AlertCircle,
  CheckCircle2, Play, MoreVertical,
  UserPlus, TrendingUp, FileText, Settings, Download, BarChart3,
  ExternalLink, FileQuestion, Layers, ClipboardList, Radio,
  CheckSquare, AlignLeft, Save, ChevronRight, ChevronLeft, Paperclip, Upload, UserMinus,
  Star, Copy, Printer, Send, Award, FolderOpen, GripVertical, Eye, ArrowUpDown,
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import LinkExt from '@tiptap/extension-link';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS as DndCSS } from '@dnd-kit/utilities';
import {
  trainingApi, orgApi, settingsApi, analyticsApi,
  type TrainingCourse, type TrainingModule, type TrainingLesson, type TrainingCategory,
  type OrgMember, type Department, type OrgSettingsData, type AnalyticsData,
  type LessonType, type QuizQuestion, type QuizOption,
} from '../api/orgApi';
import { useOrg } from '../context/OrgContext';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

const TRAINING_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What is a Training Course?',
    bullets: [
      'A **course** is a structured learning path: video lessons, reading material, quizzes, and assignments.',
      'Courses are organized into **modules** (chapters), and each module contains **lessons**.',
      'Use it for onboarding-day-1 culture training, role-specific upskilling, or mandatory compliance training.',
    ],
  },
  {
    eyebrow: '2 · Create a Course',
    bullets: [
      'Click **+ New Course** to start. Give it a name, category (Onboarding / Compliance / Skills…), and mark it **Mandatory** if everyone in scope must complete it.',
      'Mandatory courses appear in **Training Compliance** metrics and trigger reminders for non-completers.',
      'Set a **duration estimate** so members can plan their time.',
    ],
  },
  {
    eyebrow: '3 · Build Modules & Lessons',
    bullets: [
      'Open a course and add **modules** (chapters). Each module is a logical grouping of lessons.',
      'Inside a module, add lessons of each kind: **Video** (URL or upload), **Reading** (rich text + attachments), **Quiz** (multiple-choice questions), or **Assignment** (member submits a file).',
      'For **Quiz** lessons, define questions inline with one correct answer per question. Members must pass to mark the lesson complete.',
    ],
  },
  {
    eyebrow: '4 · Enroll Members',
    bullets: [
      'Click a course → **Enroll** to add specific members, or auto-enroll everyone in a department.',
      'Enrolled members see the course in **My Training** with progress tracked lesson by lesson.',
      'You can **Unenroll** a member from the enrollments panel if circumstances change.',
    ],
  },
  {
    eyebrow: '5 · Track Progress',
    bullets: [
      'The **Training Overview** donut shows In Progress vs. Not Started across all active enrollments.',
      '**Popular Trainings** ranks courses by enrollment volume.',
      '**Training Compliance** tracks the percent of mandatory courses completed across the org.',
      'The row 3-dot menu offers **View Enrollments**, **Edit Course**, **Archive**, and **Delete**.',
    ],
  },
];

const MEMBER_TRAINING_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What is Training?',
    bullets: [
      '**Training** is a set of structured courses assigned to you — video lessons, readings, quizzes, and assignments.',
      'Courses may be **Mandatory** (required by your role or compliance) or optional for personal development.',
    ],
  },
  {
    eyebrow: '2 · Starting a Course',
    bullets: [
      'Click **Continue** on an in-progress course, or **Start** on a new one.',
      'Work through each module in order — lessons unlock as you progress.',
      'You can pause and resume at any time; your progress is saved automatically.',
    ],
  },
  {
    eyebrow: '3 · Lesson Types',
    bullets: [
      '**Video** — watch the video and mark as done.',
      '**Reading** — read the material and mark complete.',
      '**Quiz** — answer multiple-choice questions; you must pass to proceed.',
      '**Assignment** — upload a file or document for admin review.',
    ],
  },
  {
    eyebrow: '4 · Certificates',
    bullets: [
      'Complete all lessons in a course to earn a **completion certificate**.',
      'Download and share your certificate from the course detail page.',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'Check the **Upcoming Deadlines** sidebar on the right — mandatory courses with due dates are listed there so you can plan ahead.',
  },
];

const CAT_COLORS: Record<string, string> = {
  compliance:    'text-gray-600',
  technical:     'text-gray-600',
  soft_skills:   'text-gray-600',
  leadership:    'text-gray-600',
  onboarding:    'text-gray-600',
  health_safety: 'text-gray-600',
  other:         'text-gray-500',
};

const CAT_LABELS: Record<string, string> = {
  compliance:    'Compliance',
  technical:     'Technical',
  soft_skills:   'Soft Skills',
  leadership:    'Leadership',
  onboarding:    'Onboarding',
  health_safety: 'Health & Safety',
  other:         'Other',
};

const CAT_DOT: Record<string, string> = {
  compliance:    'bg-gray-500',
  technical:     'bg-gray-500',
  soft_skills:   'bg-gray-500',
  leadership:    'bg-gray-500',
  onboarding:    'bg-gray-500',
  health_safety: 'bg-gray-500',
  other:         'bg-gray-400',
};

const CATEGORY_OPTIONS = Object.entries(CAT_LABELS).map(([value, label]) => ({ value, label }));

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDuration(minutes: number): string {
  if (minutes === 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ── Row Menu (portal) ──────────────────────────────────────────────────────────

function CourseRowMenu({
  course,
  canManage,
  onEdit,
  onManage,
  onEnroll,
  onToggle,
  onDelete,
}: {
  course: TrainingCourse;
  canManage: boolean;
  onEdit: () => void;
  onManage: () => void;
  onEnroll: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef          = useRef<HTMLButtonElement>(null);
  const menuRef         = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const estimatedH = canManage ? 220 : 80;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < estimatedH
      ? Math.max(8, rect.top - estimatedH - 4)
      : rect.bottom + 4;
    setPos({ top, left: rect.right - 168 });
    setOpen(true);
  };

  const act = (fn: () => void) => { setOpen(false); fn(); };

  const menu = (
    <div ref={menuRef}
      className="fixed z-[9999] bg-white rounded-xl border border-gray-200 shadow-lg py-1 min-w-[168px]"
      style={{ top: pos.top, left: pos.left }}
    >
      <button onClick={() => act(onManage)}
        className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
        <BookOpen size={12} className="text-gray-400" /> Manage Content
      </button>
      <button onClick={() => act(onEnroll)}
        className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
        <UserPlus size={12} className="text-gray-400" /> Enroll Users
      </button>
      {canManage && (
        <>
          <div className="my-1 border-t border-gray-100" />
          <button onClick={() => act(onEdit)}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
            <Pencil size={12} className="text-gray-400" /> Edit Course
          </button>
          <button onClick={() => act(onToggle)}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
            {course.is_active
              ? <><CheckCircle2 size={12} className="text-gray-400" /> Set Inactive</>
              : <><CheckCircle2 size={12} className="text-gray-500" /> Set Active</>
            }
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button onClick={() => act(onDelete)}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-600 hover:bg-gray-50">
            <Trash2 size={12} className="text-gray-400" /> Delete
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      {open && createPortal(menu, document.body)}
      <button
        ref={btnRef}
        onClick={openMenu}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <MoreVertical size={13} />
      </button>
    </>
  );
}

// ── Lesson type metadata ───────────────────────────────────────────────────────

const LESSON_TYPE_OPTIONS: { value: LessonType; label: string; icon: React.ReactNode }[] = [
  { value: 'video',         label: 'Video',         icon: <Play size={13} /> },
  { value: 'pdf',           label: 'PDF',           icon: <FileText size={13} /> },
  { value: 'article',       label: 'Article',       icon: <AlignLeft size={13} /> },
  { value: 'embed',         label: 'Embed / SCORM', icon: <Layers size={13} /> },
  { value: 'external_link', label: 'External Link', icon: <ExternalLink size={13} /> },
  { value: 'quiz',          label: 'Quiz',          icon: <FileQuestion size={13} /> },
];

function lessonIcon(type: LessonType): React.ReactNode {
  return LESSON_TYPE_OPTIONS.find(o => o.value === type)?.icon ?? <BookOpen size={13} />;
}

const LESSON_ICON_MAP: Record<string, React.ReactNode> = {
  video: <Play size={11} />, pdf: <FileText size={11} />, quiz: <FileQuestion size={11} />,
  assessment: <ClipboardList size={11} />, external_link: <ExternalLink size={11} />,
  article: <AlignLeft size={11} />, embed: <Layers size={11} />, assignment: <CheckSquare size={11} />,
};

// ── Quiz Builder ───────────────────────────────────────────────────────────────

type DraftOption = { tempId: string; text: string; is_correct: boolean };
type DraftQuestion = {
  id?: number;
  tempId: string;
  text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  points: number;
  options: DraftOption[];
  saving: boolean;
  error: string | null;
};

function newTempId() { return Math.random().toString(36).slice(2); }

function newTfOptions(): DraftOption[] {
  return [
    { tempId: newTempId(), text: 'True',  is_correct: true  },
    { tempId: newTempId(), text: 'False', is_correct: false },
  ];
}

function QuizBuilder({ lessonId }: { lessonId: number }) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading]     = useState(true);
  const [drafting, setDrafting]   = useState<DraftQuestion | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    trainingApi.loadQuestions(lessonId)
      .then(setQuestions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lessonId]);

  const startNew = () => setDrafting({
    tempId: newTempId(),
    text: '', question_type: 'multiple_choice', points: 1,
    options: [
      { tempId: newTempId(), text: '', is_correct: true  },
      { tempId: newTempId(), text: '', is_correct: false },
    ],
    saving: false, error: null,
  });

  const setDraftType = (qt: DraftQuestion['question_type']) => {
    if (!drafting) return;
    setDrafting(d => d ? {
      ...d, question_type: qt,
      options: qt === 'true_false' ? newTfOptions()
             : qt === 'short_answer' ? []
             : d.options.length >= 2 ? d.options : [
                 { tempId: newTempId(), text: '', is_correct: true  },
                 { tempId: newTempId(), text: '', is_correct: false },
               ],
    } : d);
  };

  const setOptionCorrect = (tempId: string) => {
    setDrafting(d => d ? {
      ...d,
      options: d.options.map(o => ({ ...o, is_correct: o.tempId === tempId })),
    } : d);
  };

  const updateOptionText = (tempId: string, text: string) => {
    setDrafting(d => d ? {
      ...d, options: d.options.map(o => o.tempId === tempId ? { ...o, text } : o),
    } : d);
  };

  const addOption = () => {
    setDrafting(d => d ? {
      ...d, options: [...d.options, { tempId: newTempId(), text: '', is_correct: false }],
    } : d);
  };

  const removeOption = (tempId: string) => {
    setDrafting(d => d ? {
      ...d, options: d.options.filter(o => o.tempId !== tempId),
    } : d);
  };

  const saveQuestion = async () => {
    if (!drafting || !drafting.text.trim()) return;
    setDrafting(d => d ? { ...d, saving: true, error: null } : d);
    try {
      const payload = {
        text: drafting.text.trim(),
        question_type: drafting.question_type,
        points: drafting.points,
        order: questions.length,
        options: drafting.options.map((o, i) => ({ text: o.text.trim(), is_correct: o.is_correct, order: i })),
      };
      let saved: QuizQuestion;
      if (drafting.id) {
        saved = await trainingApi.updateQuestion(drafting.id, payload);
        setQuestions(qs => qs.map(q => q.id === saved.id ? saved : q));
      } else {
        saved = await trainingApi.createQuestion(lessonId, payload);
        setQuestions(qs => [...qs, saved]);
      }
      setDrafting(null);
    } catch {
      setDrafting(d => d ? { ...d, saving: false, error: 'Failed to save question.' } : d);
    }
  };

  const editQuestion = (q: QuizQuestion) => {
    setDrafting({
      id: q.id,
      tempId: newTempId(),
      text: q.text,
      question_type: q.question_type,
      points: q.points,
      options: q.options.map(o => ({ tempId: newTempId(), text: o.text, is_correct: o.is_correct ?? false })),
      saving: false, error: null,
    });
  };

  const deleteQuestion = async (id: number) => {
    try {
      await trainingApi.deleteQuestion(id);
      setQuestions(qs => qs.filter(q => q.id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  if (loading) {
    return <div className="space-y-2 mt-4">{[...Array(2)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>;
  }

  const TYPE_LABELS: Record<string, string> = { multiple_choice: 'MCQ', true_false: 'T/F', short_answer: 'Short Answer' };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] font-bold text-gray-600 uppercase tracking-wide">Questions ({questions.length})</p>
        {!drafting && (
          <button onClick={startNew}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11.5px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg">
            <Plus size={11} /> Add Question
          </button>
        )}
      </div>

      {questions.length === 0 && !drafting && (
        <p className="text-[12px] text-gray-400 text-center py-4">No questions yet. Click "Add Question" to start.</p>
      )}

      {/* Existing questions */}
      {questions.map((q, idx) => (
        <div key={q.id} className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-start gap-2 px-3.5 py-2.5 bg-gray-50">
            <span className="text-[10.5px] font-bold text-gray-400 mt-0.5 shrink-0">Q{idx + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-gray-800">{q.text}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-semibold text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-200">
                  {TYPE_LABELS[q.question_type] ?? q.question_type}
                </span>
                <span className="text-[10.5px] text-gray-400">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => editQuestion(q)} className="p-1 text-gray-300 hover:text-gray-500 rounded"><Pencil size={11} /></button>
              <button onClick={() => setDeletingId(q.id)} className="p-1 text-gray-300 hover:text-gray-400 rounded"><Trash2 size={11} /></button>
            </div>
          </div>
          {deletingId === q.id && (
            <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-gray-50 border-t border-gray-200">
              <p className="text-[11.5px] text-gray-700 font-medium">Delete this question?</p>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setDeletingId(null)} className="text-[11px] font-semibold text-gray-500 px-2 py-1 rounded-lg hover:bg-gray-100">Cancel</button>
                <button onClick={() => deleteQuestion(q.id)} className="text-[11px] font-semibold text-white bg-gray-500 hover:bg-gray-700 px-2 py-1 rounded-lg">Delete</button>
              </div>
            </div>
          )}
          {q.options.length > 0 && (
            <div className="px-3.5 py-2 divide-y divide-gray-100">
              {q.options.map(opt => (
                <div key={opt.id} className="flex items-center gap-2 py-1.5">
                  {opt.is_correct
                    ? <CheckCircle2 size={11} className="text-gray-500 shrink-0" />
                    : <span className="w-2.5 h-2.5 rounded-full border border-gray-300 shrink-0 inline-block" />
                  }
                  <span className={`text-[12px] ${opt.is_correct ? 'font-semibold text-gray-700' : 'text-gray-600'}`}>{opt.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Draft question form */}
      {drafting && (
        <div className="border border-gray-200 rounded-xl bg-gray-50/40 overflow-hidden">
          <div className="px-4 py-3 space-y-3">
            <div>
              <label className="block text-[10.5px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Question Text *</label>
              <textarea
                value={drafting.text}
                onChange={e => setDrafting(d => d ? { ...d, text: e.target.value } : d)}
                rows={2}
                placeholder="Enter your question..."
                disabled={drafting.saving}
                className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none disabled:opacity-60 bg-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-[10.5px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Type</label>
                <div className="flex gap-1">
                  {(['multiple_choice', 'true_false', 'short_answer'] as const).map(t => (
                    <button key={t} onClick={() => setDraftType(t)} disabled={drafting.saving}
                      className={`flex-1 py-1.5 text-[10.5px] font-semibold rounded-lg border transition-colors disabled:opacity-60 ${
                        drafting.question_type === t ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 border-gray-200 hover:bg-gray-50 bg-white'
                      }`}>
                      {t === 'multiple_choice' ? 'MCQ' : t === 'true_false' ? 'T/F' : 'Short'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Points</label>
                <input type="number" min={1} max={100} value={drafting.points}
                  onChange={e => setDrafting(d => d ? { ...d, points: Number(e.target.value) } : d)}
                  disabled={drafting.saving}
                  className="w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white disabled:opacity-60" />
              </div>
            </div>

            {/* Options */}
            {drafting.question_type !== 'short_answer' && (
              <div>
                <label className="block text-[10.5px] font-bold text-gray-500 mb-2 uppercase tracking-wide">
                  Options {drafting.question_type === 'multiple_choice' ? '— click circle to mark correct' : '— toggle correct answer'}
                </label>
                <div className="space-y-2">
                  {drafting.options.map(opt => (
                    <div key={opt.tempId} className="flex items-center gap-2">
                      <button onClick={() => setOptionCorrect(opt.tempId)} disabled={drafting.saving}
                        className={`shrink-0 w-4 h-4 rounded-full border-2 transition-colors disabled:opacity-60 ${
                          opt.is_correct ? 'bg-gray-500 border-gray-600' : 'border-gray-300 hover:border-gray-400'
                        }`} />
                      <input value={opt.text} onChange={e => updateOptionText(opt.tempId, e.target.value)}
                        placeholder="Option text..."
                        disabled={drafting.saving || drafting.question_type === 'true_false'}
                        className="flex-1 px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white disabled:opacity-60" />
                      {drafting.question_type === 'multiple_choice' && drafting.options.length > 2 && (
                        <button onClick={() => removeOption(opt.tempId)} disabled={drafting.saving}
                          className="p-1 text-gray-300 hover:text-gray-400 disabled:opacity-60"><X size={12} /></button>
                      )}
                    </div>
                  ))}
                  {drafting.question_type === 'multiple_choice' && drafting.options.length < 6 && (
                    <button onClick={addOption} disabled={drafting.saving}
                      className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 hover:text-gray-700 disabled:opacity-60">
                      <Plus size={11} /> Add Option
                    </button>
                  )}
                </div>
              </div>
            )}
            {drafting.question_type === 'short_answer' && (
              <p className="text-[11.5px] text-gray-400 italic">Short answers are manually reviewed. No options needed.</p>
            )}

            {drafting.error && (
              <p className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">{drafting.error}</p>
            )}

            <div className="flex items-center gap-2">
              <button onClick={saveQuestion} disabled={drafting.saving || !drafting.text.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg">
                <Save size={11} /> {drafting.saving ? 'Saving…' : drafting.id ? 'Update Question' : 'Save Question'}
              </button>
              <button onClick={() => setDrafting(null)} disabled={drafting.saving}
                className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-60">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lesson Editor (right panel) ────────────────────────────────────────────────

// ── Rich Text Editor ─────────────────────────────────────────────────────────

function TiptapEditor({
  content, onChange, disabled, minHeight = '140px',
}: { content: string; onChange: (v: string) => void; disabled?: boolean; minHeight?: string }) {
  const editor = useEditor({
    extensions: [StarterKit, UnderlineExt, LinkExt.configure({ openOnClick: false })],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editable: !disabled,
  });
  const prevRef = useRef(content);
  useEffect(() => {
    if (editor && content !== prevRef.current) {
      prevRef.current = content;
      if (editor.getHTML() !== content) editor.commands.setContent(content || '');
    }
  }, [editor, content]);
  useEffect(() => { if (editor) editor.setEditable(!disabled); }, [editor, disabled]);

  const T = ({ active, onMD, children }: { active?: boolean; onMD: () => void; children: React.ReactNode }) => (
    <button type="button" onMouseDown={e => { e.preventDefault(); onMD(); }}
      className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors ${active ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
      {children}
    </button>
  );
  if (!editor) return <div className="border border-gray-200 rounded-xl bg-gray-50 animate-pulse" style={{ minHeight }} />;
  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
        <select value={editor.isActive('heading',{level:1})?'h1':editor.isActive('heading',{level:2})?'h2':editor.isActive('heading',{level:3})?'h3':'p'}
          onChange={e => { const v=e.target.value; v==='p'?editor.chain().focus().setParagraph().run():editor.chain().focus().toggleHeading({level:Number(v.slice(1)) as 1|2|3}).run(); }}
          className="text-[11px] border border-gray-200 bg-white text-gray-600 rounded px-1.5 py-0.5 focus:outline-none mr-1">
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option>
        </select>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <T active={editor.isActive('bold')} onMD={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></T>
        <T active={editor.isActive('italic')} onMD={() => editor.chain().focus().toggleItalic().run()}><em>I</em></T>
        <T active={editor.isActive('underline')} onMD={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></T>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <T active={editor.isActive('bulletList')} onMD={() => editor.chain().focus().toggleBulletList().run()}>• List</T>
        <T active={editor.isActive('orderedList')} onMD={() => editor.chain().focus().toggleOrderedList().run()}>1. List</T>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <T active={editor.isActive('blockquote')} onMD={() => editor.chain().focus().toggleBlockquote().run()}>"</T>
      </div>
      <EditorContent editor={editor}
        className="prose prose-sm max-w-none px-3 py-2.5 text-[13px] [&_.ProseMirror]:outline-none"
        style={{ minHeight }} />
    </div>
  );
}

// ── Lesson Preview Modal ──────────────────────────────────────────────────────

function LessonPreviewModal({ lesson, onClose }: { lesson: TrainingLesson; onClose: () => void }) {
  const embedSrc = (url: string) => {
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vi = url.match(/vimeo\.com\/(\d+)/);
    if (vi) return `https://player.vimeo.com/video/${vi[1]}`;
    return url;
  };
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden w-[800px] max-w-[95vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest">Learner Preview</p>
            <h3 className="text-[14px] font-bold text-gray-900 truncate">{lesson.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {lesson.lesson_type === 'video' && lesson.content_url ? (
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <iframe src={embedSrc(lesson.content_url)} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          ) : lesson.lesson_type === 'article' ? (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: (lesson.content_data?.body as string) || '<p style="color:#9ca3af;font-style:italic">No content yet.</p>' }} />
          ) : lesson.lesson_type === 'pdf' ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <FileText size={40} className="text-gray-300" />
              {(lesson.content_url || lesson.content_file_url) ? (
                <a href={lesson.content_url || lesson.content_file_url!} target="_blank" rel="noreferrer"
                  className="px-5 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors">Open PDF</a>
              ) : <p className="text-[13px] text-gray-400">No PDF provided yet.</p>}
            </div>
          ) : lesson.lesson_type === 'embed' && (lesson.content_data?.embed_code as string) ? (
            <div dangerouslySetInnerHTML={{ __html: lesson.content_data.embed_code as string }} />
          ) : lesson.lesson_type === 'external_link' && lesson.content_url ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <ExternalLink size={40} className="text-gray-300" />
              <a href={lesson.content_url} target="_blank" rel="noreferrer"
                className="px-5 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors">Open Link</a>
            </div>
          ) : (lesson.lesson_type === 'quiz' || lesson.lesson_type === 'assessment') ? (
            <div className="space-y-4">
              {lesson.quiz_questions.length === 0
                ? <p className="text-[13px] text-gray-400 text-center py-8">No questions added yet.</p>
                : lesson.quiz_questions.map((q, qi) => (
                  <div key={q.id} className="border border-gray-200 rounded-xl p-4">
                    <p className="text-[13px] font-semibold text-gray-800 mb-3">{qi + 1}. {q.text}</p>
                    {q.question_type === 'short_answer'
                      ? <textarea disabled rows={2} placeholder="Member types their answer here..." className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg resize-none opacity-50" />
                      : <div className="space-y-2">{q.options.map(opt => (
                          <div key={opt.id} className="flex items-center gap-2.5 px-3 py-2 border border-gray-200 rounded-lg">
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                            <span className="text-[12.5px] text-gray-700">{opt.text}</span>
                          </div>
                        ))}</div>}
                  </div>
                ))}
            </div>
          ) : lesson.lesson_type === 'assignment' ? (
            <div className="space-y-4">
              {(lesson.content_data?.instructions as string)
                ? <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: lesson.content_data.instructions as string }} />
                : <p className="text-[13px] text-gray-400">No instructions provided.</p>}
            </div>
          ) : (
            <p className="text-[13px] text-gray-400 text-center py-12">Preview not available for this lesson type.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Sortable Lesson (DnD) ─────────────────────────────────────────────────────

function SortableLesson({
  lesson, moduleId: _moduleId, isActive, onEdit, onDelete,
}: {
  lesson: TrainingLesson; moduleId: number; isActive: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const style = { transform: DndCSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style}
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors ${isActive ? 'bg-gray-900' : 'hover:bg-gray-50'}`}>
      <button {...attributes} {...listeners} onClick={e => e.stopPropagation()}
        className={`p-0.5 rounded cursor-grab active:cursor-grabbing shrink-0 ${isActive ? 'text-gray-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
        <GripVertical size={12} />
      </button>
      <span className={`shrink-0 ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>{LESSON_ICON_MAP[lesson.lesson_type] ?? <BookOpen size={11} />}</span>
      <p onClick={onEdit} className={`flex-1 min-w-0 text-[11.5px] truncate cursor-pointer ${isActive ? 'font-semibold text-white' : 'text-gray-700'}`}>{lesson.title}</p>
      {!lesson.is_published && (
        <span className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wide shrink-0 ${isActive ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-400'}`}>Draft</span>
      )}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity">
        <button onClick={onEdit} className={`p-1 rounded-md ${isActive ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}><Pencil size={11} /></button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className={`p-1 rounded-md ${isActive ? 'text-gray-400 hover:text-gray-400' : 'text-gray-400 hover:text-gray-500 hover:bg-gray-50'}`}><Trash2 size={11} /></button>
      </div>
    </div>
  );
}

// ── Lesson Sidebar (Overview + Quick Actions) ─────────────────────────────────

function LessonSidebar({
  lesson, course, onPreview, onDuplicate, onDelete, onMoveUp, onMoveDown,
}: {
  lesson: TrainingLesson; course: TrainingCourse;
  onPreview: () => void; onDuplicate: () => void; onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
}) {
  const allLessons = course.modules.flatMap(m => m.lessons);
  const posIdx = allLessons.findIndex(l => l.id === lesson.id);
  const pos = posIdx >= 0 ? posIdx + 1 : '?';
  const fmt = (d: string | null) => d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const rows: [string, React.ReactNode][] = [
    ['Lesson ID', <span className="text-[11.5px] font-semibold text-gray-800 font-mono">{lesson.lesson_reference}</span>],
    ['Status',   <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${lesson.is_published ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-500'}`}>{lesson.is_published ? 'Published' : 'Draft'}</span>],
    ['Position', <span className="text-[11.5px] font-semibold text-gray-800">{pos} of {allLessons.length}</span>],
    ['Created',  <span className="text-[11.5px] font-semibold text-gray-800">{fmt(lesson.created_at)}</span>],
    ['Last Updated', <div className="text-right"><p className="text-[11.5px] font-semibold text-gray-800">{fmt(lesson.updated_at)}</p>{lesson.updated_by_name && <p className="text-[10px] text-gray-400">by {lesson.updated_by_name}</p>}</div>],
  ];
  const actions = [
    { icon: <Eye size={13} />,        label: 'Preview Lesson',   onClick: onPreview },
    { icon: <Eye size={13} />,        label: 'View as Learner',  onClick: onPreview },
    { icon: <Copy size={13} />,       label: 'Duplicate Lesson', onClick: onDuplicate },
    { icon: <ArrowUpDown size={13} />,label: 'Move Up',          onClick: onMoveUp },
    { icon: <ArrowUpDown size={13} />,label: 'Move Down',        onClick: onMoveDown },
    { icon: <Trash2 size={13} className="text-gray-400" />, label: 'Delete Lesson', onClick: onDelete, danger: true },
  ];
  return (
    <div className="flex flex-col divide-y divide-gray-100">
      <div className="p-4">
        <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest mb-3">Lesson Overview</p>
        <div className="space-y-3">
          {rows.map(([label, val]) => (
            <div key={label as string} className="flex items-start justify-between gap-2">
              <span className="text-[11px] text-gray-400 shrink-0">{label}</span>
              {val}
            </div>
          ))}
        </div>
      </div>
      <div className="p-4">
        <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="space-y-1.5">
          {actions.map(({ icon, label, onClick, danger }) => (
            <button key={label} onClick={onClick}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-[12px] font-medium rounded-lg border transition-colors ${danger ? 'text-gray-600 border-gray-200 hover:bg-gray-50' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
              {icon} {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


// ── Lesson Editor (tabbed) ────────────────────────────────────────────────────

type LessonEditorTab = 'content' | 'settings' | 'resources' | 'quiz' | 'assignments';

const LESSON_EDITOR_TABS: { id: LessonEditorTab; label: string }[] = [
  { id: 'content',     label: 'Content'     },
  { id: 'settings',    label: 'Settings'    },
  { id: 'resources',   label: 'Resources'   },
  { id: 'quiz',        label: 'Quiz'        },
  { id: 'assignments', label: 'Assignments' },
];

function LessonEditor({
  lesson,
  moduleId,
  coursePassScore,
  onSaved,
  onCancel,
  onDelete,
  onDuplicate,
  onPreview,
}: {
  lesson: TrainingLesson | null;
  moduleId: number | null;
  coursePassScore: number;
  onSaved: (saved: TrainingLesson, isNew: boolean) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onPreview?: () => void;
}) {
  const [lessonTab,     setLessonTab]     = useState<LessonEditorTab>('content');
  const [title,         setTitle]         = useState(lesson?.title ?? '');
  const [type,          setType]          = useState<LessonType>(lesson?.lesson_type ?? 'video');
  const [url,           setUrl]           = useState(lesson?.content_url ?? '');
  const [duration,      setDuration]      = useState(lesson?.duration_minutes ?? 0);
  const [isPub,         setIsPub]         = useState(lesson?.is_published ?? true);
  const [desc,          setDesc]          = useState((lesson?.content_data?.description as string) ?? '');
  const [body,          setBody]          = useState((lesson?.content_data?.body as string) ?? '');
  const [embedCode,     setEmbedCode]     = useState((lesson?.content_data?.embed_code as string) ?? '');
  const [embedHeight,   setEmbedHeight]   = useState((lesson?.content_data?.height as number) ?? 480);
  const [instructions,  setInstructions]  = useState((lesson?.content_data?.instructions as string) ?? '');
  const [allowFile,     setAllowFile]     = useState((lesson?.content_data?.allow_file_upload as boolean) ?? false);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [pendingFile,   setPendingFile]   = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [currentFileUrl,setCurrentFileUrl]= useState<string | null>(lesson?.content_file_url ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const FILE_UPLOAD_TYPES: LessonType[] = ['pdf', 'assignment', 'assessment', 'article'];
  const supportsFile = FILE_UPLOAD_TYPES.includes(type);
  const isQuizType   = type === 'quiz' || type === 'assessment';

  const buildContentData = (): Record<string, unknown> => {
    if (type === 'article')    return { body };
    if (type === 'embed')      return { embed_code: embedCode, height: embedHeight };
    if (type === 'assignment') return { instructions, allow_file_upload: allowFile };
    if (type === 'video' || type === 'pdf' || type === 'external_link') return { description: desc };
    return {};
  };

  const doSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    try {
      const data = {
        title: title.trim(), lesson_type: type,
        content_url: url.trim(), duration_minutes: duration,
        is_published: isPub,
        content_data: buildContentData(),
      };
      const saved = lesson
        ? await trainingApi.updateLesson(lesson.id, data)
        : await trainingApi.createLesson(moduleId!, data);
      if (pendingFile) {
        setUploadingFile(true);
        try {
          const res = await trainingApi.uploadLessonFile(saved.id, pendingFile);
          saved.content_file_url = res.content_file_url;
          setCurrentFileUrl(res.content_file_url);
          setPendingFile(null);
        } catch { setError('Lesson saved, but file upload failed.'); }
        finally { setUploadingFile(false); }
      }
      onSaved(saved, !lesson);
    } catch { setError('Failed to save lesson.'); }
    finally { setSaving(false); }
  };

  const handleSave = () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (lesson) setShowConfirm(true); else doSave();
  };

  const handleRemoveFile = async () => {
    if (!lesson) { setPendingFile(null); setCurrentFileUrl(null); return; }
    try {
      await trainingApi.deleteLessonFile(lesson.id);
      setCurrentFileUrl(null); setPendingFile(null);
    } catch { setError('Failed to remove file.'); }
  };

  const fileLabel: Partial<Record<LessonType, string>> = {
    pdf: 'Upload PDF File', assignment: 'Upload Reference File (optional)',
    assessment: 'Upload Worksheet (optional)', article: 'Attach Supporting File (optional)',
  };

  const headerActions = (
    <div className="flex items-center gap-1">
      <button onClick={handleSave} disabled={saving || uploadingFile || !title.trim()}
        className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors">
        <Save size={11} /> {saving || uploadingFile ? 'Saving…' : lesson ? 'Save' : 'Create'}
      </button>
      {lesson && (
        <>
          <button onClick={onDuplicate} title="Duplicate"
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11.5px] font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">
            <Copy size={11} /> Duplicate
          </button>
          <button onClick={onDelete} title="Delete"
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11.5px] font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200">
            <Trash2 size={11} /> Delete
          </button>
        </>
      )}
      {!lesson && (
        <button onClick={onCancel} disabled={saving}
          className="px-3 py-1.5 text-[12px] font-medium text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-60 transition-colors border border-gray-200">
          Cancel
        </button>
      )}
    </div>
  );

  return (
    <>
    <div className="flex flex-col h-full bg-white">
      {/* Header bar */}
      <div className="shrink-0 px-5 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">LESSON</p>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[15px] font-bold text-gray-900 leading-snug">{title || (lesson ? 'Untitled' : 'New Lesson')}</h3>
              {lesson && (
                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${isPub ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-500'}`}>
                  {isPub ? 'Published' : 'Draft'}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0">{headerActions}</div>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-600">
            <AlertCircle size={11} className="shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-0 px-5 border-b border-gray-100">
        {LESSON_EDITOR_TABS.map(t => (
          <button key={t.id} onClick={() => setLessonTab(t.id)}
            className={`py-2.5 px-3 text-[12px] font-semibold border-b-2 transition-colors ${
              lessonTab === t.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Content tab ─────────────────────────────────────── */}
        {lessonTab === 'content' && (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} disabled={saving}
                placeholder="Lesson title..."
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60" />
            </div>

            {/* Lesson type picker */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Lesson Type</label>
              <div className="flex flex-wrap gap-2">
                {LESSON_TYPE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setType(opt.value)} disabled={saving}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-semibold transition-colors disabled:opacity-60 ${
                      type === opt.value ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-800'
                    }`}>
                    <span className="shrink-0">{opt.icon}</span> {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type-specific content */}
            {(type === 'video' || type === 'pdf' || type === 'external_link') && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">
                    {type === 'video' ? 'Video URL' : type === 'pdf' ? 'PDF URL' : 'URL'}
                  </label>
                  <input value={url} onChange={e => setUrl(e.target.value)} disabled={saving}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60" />
                  {type === 'video' && <p className="text-[10.5px] text-gray-400 mt-1">YouTube, Vimeo, or direct embed URL</p>}
                  {type === 'pdf' && <p className="text-[10.5px] text-gray-400 mt-1">Enter a public PDF URL, or upload a file below.</p>}
                </div>
                {type === 'pdf' && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Upload PDF File</label>
                    <div className="border border-dashed border-gray-300 rounded-xl p-3 space-y-2">
                      {(currentFileUrl || pendingFile) ? (
                        <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                          <Paperclip size={12} className="text-gray-500 shrink-0" />
                          <span className="flex-1 text-[11.5px] text-gray-700 truncate">
                            {pendingFile ? pendingFile.name : currentFileUrl?.split('/').pop() ?? 'Uploaded file'}
                          </span>
                          {currentFileUrl && !pendingFile && (
                            <a href={currentFileUrl} target="_blank" rel="noreferrer"
                              className="text-[10.5px] font-semibold text-gray-600 hover:text-gray-900 underline shrink-0">View</a>
                          )}
                          <button onClick={handleRemoveFile} disabled={saving}
                            className="p-0.5 rounded text-gray-400 hover:text-gray-500 hover:bg-gray-50 transition-colors shrink-0"><X size={11} /></button>
                        </div>
                      ) : (
                        <button onClick={() => fileInputRef.current?.click()} disabled={saving}
                          className="flex items-center gap-2 w-full px-3 py-2.5 text-[12px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <Upload size={12} className="shrink-0" />
                          Choose PDF file
                          <span className="text-[10.5px] text-gray-400 ml-auto">.pdf</span>
                        </button>
                      )}
                      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,application/pdf"
                        onChange={e => { const f=e.target.files?.[0]; if(f){setPendingFile(f);setCurrentFileUrl(null);setUrl('');} e.target.value=''; }} />
                      {pendingFile && <p className="text-[10.5px] text-gray-500">File will upload when you save.</p>}
                      {uploadingFile && <p className="text-[10.5px] text-gray-500 animate-pulse">Uploading…</p>}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Description (optional)</label>
                  <textarea
                    value={desc}
                    onChange={e => { setDesc(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                    rows={1}
                    disabled={saving}
                    placeholder="Brief description..."
                    className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none disabled:opacity-60 overflow-hidden"
                    style={{ minHeight: '42px' }}
                  />
                </div>
              </div>
            )}

            {type === 'article' && (
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Article Body</label>
                <TiptapEditor content={body} onChange={setBody} disabled={saving} minHeight="240px" />
              </div>
            )}

            {type === 'embed' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Embed Code or URL</label>
                  <textarea value={embedCode} onChange={e => setEmbedCode(e.target.value)} rows={5} disabled={saving}
                    placeholder={'<iframe src="..."></iframe>\n— or —\nhttps://...'}
                    className="w-full px-3 py-2 text-[12px] font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none disabled:opacity-60" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Height (px)</label>
                  <input type="number" min={200} value={embedHeight} onChange={e => setEmbedHeight(Number(e.target.value))} disabled={saving}
                    className="w-[120px] px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60" />
                </div>
              </div>
            )}

            {type === 'assignment' && (
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Instructions</label>
                <TiptapEditor content={instructions} onChange={setInstructions} disabled={saving} minHeight="200px" />
              </div>
            )}

            {isQuizType && (
              <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                <FileQuestion size={13} className="text-gray-400 shrink-0" />
                <p className="text-[12px] text-gray-700">Quiz questions are managed in the <strong>Quiz</strong> tab.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Settings tab ────────────────────────────────────── */}
        {lessonTab === 'settings' && (
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <div>
                <p className="text-[13px] font-semibold text-gray-800">Published</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Members can see and complete this lesson</p>
              </div>
              <button onClick={() => setIsPub(!isPub)} disabled={saving}
                className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 disabled:opacity-60 ${isPub ? 'bg-gray-900' : 'bg-gray-300'}`}
                style={{ height: '22px', width: '40px' }}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPub ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {!isQuizType && (
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">
                  {type === 'embed' ? 'Height (px)' : type === 'article' ? 'Read Time (min)' : 'Duration (min)'}
                </label>
                <input type="number" min={0}
                  value={type === 'embed' ? embedHeight : duration}
                  onChange={e => type === 'embed' ? setEmbedHeight(Number(e.target.value)) : setDuration(Number(e.target.value))}
                  disabled={saving}
                  className="w-[140px] px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60" />
              </div>
            )}
            {isQuizType && (
              <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                <AlertCircle size={13} className="text-gray-400 shrink-0" />
                <p className="text-[12px] text-gray-600">Pass score set at course level: <strong>{coursePassScore}%</strong></p>
              </div>
            )}
          </div>
        )}

        {/* ── Resources tab ────────────────────────────────────── */}
        {lessonTab === 'resources' && (
          <div className="p-5 space-y-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">File Attachment</p>
            {supportsFile ? (
              <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-2.5">
                <p className="text-[11px] text-gray-500">{fileLabel[type] ?? 'Upload a file'}</p>
                {(currentFileUrl || pendingFile) ? (
                  <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <Paperclip size={12} className="text-gray-500 shrink-0" />
                    <span className="flex-1 text-[11.5px] text-gray-700 truncate">
                      {pendingFile ? pendingFile.name : currentFileUrl?.split('/').pop() ?? 'Uploaded file'}
                    </span>
                    {currentFileUrl && !pendingFile && (
                      <a href={currentFileUrl} target="_blank" rel="noreferrer"
                        className="text-[10.5px] font-semibold text-gray-600 hover:text-gray-900 underline shrink-0">View</a>
                    )}
                    <button onClick={handleRemoveFile} disabled={saving}
                      className="p-0.5 rounded text-gray-400 hover:text-gray-500 hover:bg-gray-50 transition-colors shrink-0"><X size={11} /></button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()} disabled={saving}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-[12px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <Upload size={12} className="shrink-0" />
                    {type === 'pdf' ? 'Choose PDF file' : 'Choose file'}
                    <span className="text-[10.5px] text-gray-400 ml-auto">{type === 'pdf' ? '.pdf' : 'any format'}</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" className="hidden"
                  accept={type === 'pdf' ? '.pdf,application/pdf' : undefined}
                  onChange={e => { const f=e.target.files?.[0]; if(f){setPendingFile(f);setCurrentFileUrl(null);} e.target.value=''; }} />
                {pendingFile && <p className="text-[10.5px] text-gray-500">File will upload when you save.</p>}
                {uploadingFile && <p className="text-[10.5px] text-gray-500 animate-pulse">Uploading…</p>}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                <AlertCircle size={13} className="text-gray-400 shrink-0" />
                <p className="text-[12px] text-gray-500">File uploads are available for PDF, Article, Assignment, and Assessment lesson types.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Quiz tab ─────────────────────────────────────────── */}
        {lessonTab === 'quiz' && (
          <div className="p-5">
            {isQuizType ? (
              lesson ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl mb-4">
                    <AlertCircle size={12} className="text-gray-400 shrink-0" />
                    <p className="text-[11.5px] text-gray-600">Pass score: <strong>{coursePassScore}%</strong> (set at course level)</p>
                  </div>
                  <QuizBuilder lessonId={lesson.id} />
                </>
              ) : (
                <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <AlertCircle size={13} className="text-gray-500 shrink-0" />
                  <p className="text-[12px] text-gray-700">Save the lesson first, then add quiz questions.</p>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                <FileQuestion size={13} className="text-gray-400 shrink-0" />
                <p className="text-[12px] text-gray-500">Switch lesson type to <strong>Quiz</strong> or <strong>Assessment</strong> to add questions.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Assignments tab ──────────────────────────────────── */}
        {lessonTab === 'assignments' && (
          <div className="p-5 space-y-4">
            {type === 'assignment' ? (
              <>
                <label className="flex items-center gap-2.5 cursor-pointer p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <input type="checkbox" checked={allowFile} onChange={e => setAllowFile(e.target.checked)}
                    disabled={saving} className="w-3.5 h-3.5 accent-gray-800" />
                  <div>
                    <p className="text-[13px] font-medium text-gray-800">Allow file upload submission</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Members can attach a file when submitting</p>
                  </div>
                </label>
                <div className="px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-[12px] text-gray-700">Upload a reference/template file for members in the <strong>Resources</strong> tab.</p>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                <CheckSquare size={13} className="text-gray-400 shrink-0" />
                <p className="text-[12px] text-gray-500">Switch lesson type to <strong>Assignment</strong> to configure submission settings.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>

    {showConfirm && createPortal(
      <ConfirmDialog
        title="Save Changes?"
        body={`Update "${title.trim()}"? This will overwrite the current lesson content for all enrolled members.`}
        confirmLabel="Save Changes"
        danger={false}
        onConfirm={() => { setShowConfirm(false); doSave(); }}
        onCancel={() => setShowConfirm(false)}
      />,
      document.body,
    )}
    </>
  );
}



// ── Confirm Dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Delete',
  danger = true,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-[13px] text-gray-500 leading-relaxed mb-6">{body}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2.5 text-[13px] font-semibold text-white rounded-xl transition-colors ${
              danger ? 'bg-gray-500 hover:bg-gray-700' : 'bg-gray-900 hover:bg-gray-800'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Drawer sub-tab: Overview ───────────────────────────────────────────────────

function OverviewTab({
  course,
  onEnroll,
  onGoContent,
  onToggleActive,
}: {
  course: TrainingCourse;
  onEnroll: () => void;
  onGoContent: () => void;
  onToggleActive: () => void;
}) {
  const completed  = Math.round(course.enrolled_count * course.completion_pct / 100);
  const inProgress = Math.max(0, course.enrolled_count - completed);

  const donutData = [
    { name: 'Completed',   value: completed },
    { name: 'In Progress', value: Math.max(0, Math.round(inProgress * 0.6)) },
    { name: 'Not Started', value: Math.max(0, Math.round(inProgress * 0.4)) },
  ].filter(d => d.value > 0);

  const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);

  const DETAIL_ROWS: [string, string][] = [
    ['Category',    CAT_LABELS[course.category] ?? course.category],
    ['Type',        course.is_mandatory ? 'Mandatory' : 'Elective'],
    ['Pass Score',  `${course.pass_score}%`],
    ['Duration',    fmtDuration(course.total_duration)],
    ['Modules',     String(course.modules.length)],
    ['Lessons',     String(totalLessons)],
    ['Created By',  course.created_by_name ?? '—'],
    ['Created On',  new Date(course.created_at).toLocaleDateString()],
  ];

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Left: Description + Details */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3 min-w-0">
        {/* Description */}
        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Training Description</p>
          <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">
            {course.description || <span className="text-gray-400 italic">No description provided.</span>}
          </p>
        </div>

        {/* Details grid */}
        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Course Details</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
            {DETAIL_ROWS.map(([label, value]) => (
              <div key={label}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-[12.5px] text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Status + Actions */}
      <div className="w-[260px] shrink-0 overflow-y-auto p-4 border-l border-gray-100 space-y-3">
        {/* Training Status */}
        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Training Status</p>
          {course.enrolled_count > 0 ? (
            <>
              <div className="flex justify-center mb-2">
                <PieChart width={110} height={90}>
                  <Pie data={donutData} cx={50} cy={40} innerRadius={25} outerRadius={38}
                    dataKey="value" paddingAngle={2}>
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#111' : i === 1 ? '#6b7280' : '#e5e7eb'} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </div>
              <div className="space-y-1.5">
                {[
                  ['Enrolled',    course.enrolled_count, ''],
                  ['Completed',   completed,             `(${course.completion_pct}%)`],
                  ['In Progress', Math.max(0, course.enrolled_count - completed), ''],
                ].map(([label, val, extra]) => (
                  <div key={label as string} className="flex items-center justify-between">
                    <span className="text-[11.5px] text-gray-600">{label as string}</span>
                    <span className="text-[11.5px] font-semibold text-gray-900">
                      {val as number} {extra as string}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[11.5px] text-gray-400 text-center py-2">No enrollments yet</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Quick Actions</p>
          <div className="space-y-0.5">
            <button onClick={onEnroll}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left">
              <UserPlus size={12} className="text-gray-400 shrink-0" /> Enroll Users
            </button>
            <button onClick={onGoContent}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left">
              <BookOpen size={12} className="text-gray-400 shrink-0" /> Edit Content
            </button>
            <button onClick={onToggleActive}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left">
              <CheckCircle2 size={12} className="text-gray-400 shrink-0" />
              {course.is_active ? 'Set Inactive' : 'Set Active'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Drawer sub-tab: Enrolled Users ─────────────────────────────────────────────

function EnrolledUsersTab({ courseId }: { courseId: number }) {
  const [enrollments,    setEnrollments]    = useState<import('../api/orgApi').TrainingEnrollment[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [unenrolling,    setUnenrolling]    = useState<number | null>(null); // user_id pending confirm
  const [removingUserId, setRemovingUserId] = useState<number | null>(null); // in-flight

  useEffect(() => {
    trainingApi.getCourseEnrollments(courseId)
      .then(setEnrollments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  const doUnenroll = async (userId: number) => {
    setUnenrolling(null);
    setRemovingUserId(userId);
    try {
      await trainingApi.unenrollUser(courseId, userId);
      setEnrollments(prev => prev.filter(e => e.user_id !== userId));
    } catch { /* ignore */ }
    finally { setRemovingUserId(null); }
  };

  const STATUS_LABEL: Record<string, string> = {
    enrolled:    'Enrolled',
    in_progress: 'In Progress',
    completed:   'Completed',
    failed:      'Failed',
  };

  const pendingEnrollment = unenrolling !== null
    ? enrollments.find(e => e.user_id === unenrolling)
    : null;

  return (
    <div className="flex-1 overflow-y-auto p-5">
      {loading ? (
        <div className="space-y-1.5">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : enrollments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
            <Users size={20} className="text-gray-400" />
          </div>
          <p className="text-[13.5px] font-semibold text-gray-700">No enrollments yet</p>
          <p className="text-[12px] text-gray-400 mt-1">Enroll users from the Overview tab.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_130px_110px_150px_100px] px-4 py-2 bg-gray-50 border-b border-gray-200">
            {['User', 'Department', 'Enrolled On', 'Status', 'Progress', ''].map((h, i) => (
              <p key={i} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</p>
            ))}
          </div>
          <div className="divide-y divide-gray-100">
            {enrollments.map(e => (
              <div key={e.id} className={`grid grid-cols-[2fr_1fr_130px_110px_150px_100px] px-4 py-2 items-center transition-colors ${removingUserId === e.user_id ? 'opacity-40' : 'hover:bg-gray-50'}`}>
                {/* User */}
                <div className="flex items-center gap-2 min-w-0">
                  {e.user_picture ? (
                    <img src={e.user_picture} alt="" className="w-6 h-6 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-gray-500">
                        {(e.user_name ?? '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{e.user_name ?? '—'}</p>
                    <p className="text-[10.5px] text-gray-400 truncate">{e.user_email ?? ''}</p>
                  </div>
                </div>
                {/* Department */}
                <p className="text-[12px] text-gray-600 truncate">{e.department_name ?? '—'}</p>
                {/* Enrolled On */}
                <p className="text-[12px] text-gray-600">{new Date(e.enrolled_at).toLocaleDateString()}</p>
                {/* Status */}
                <p className="text-[12px] text-gray-700 capitalize">{STATUS_LABEL[e.status] ?? e.status}</p>
                {/* Progress */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-800 rounded-full" style={{ width: `${e.progress_pct}%` }} />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700 shrink-0 w-8 text-right">
                    {e.progress_pct}%
                  </span>
                </div>
                {/* Unenroll */}
                <div className="flex justify-end">
                  <button
                    onClick={() => e.user_id !== undefined && setUnenrolling(e.user_id)}
                    disabled={removingUserId === e.user_id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold text-gray-600 border border-red-200 bg-gray-50 hover:bg-gray-100 hover:border-red-300 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <UserMinus size={12} /> Unenroll
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unenrolling !== null && pendingEnrollment && createPortal(
        <ConfirmDialog
          title="Unenroll User?"
          body={`Remove ${pendingEnrollment.user_name ?? 'this user'} from the course? Their progress will be permanently deleted.`}
          confirmLabel="Unenroll"
          danger
          onConfirm={() => doUnenroll(unenrolling)}
          onCancel={() => setUnenrolling(null)}
        />,
        document.body,
      )}
    </div>
  );
}

// ── Drawer sub-tab: Settings ───────────────────────────────────────────────────

function SettingsTab({
  course, departments, onSaved,
}: {
  course: TrainingCourse;
  departments: Department[];
  onSaved: (c: TrainingCourse) => void;
}) {
  const [title,     setTitle]     = useState(course.title);
  const [desc,      setDesc]      = useState(course.description);
  const [category,  setCategory]  = useState<TrainingCategory>(course.category);
  const [mandatory, setMandatory] = useState(course.is_mandatory);
  const [isActive,  setIsActive]  = useState(course.is_active);
  const [passScore, setPassScore] = useState(course.pass_score);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState('');

  const submit = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      const updated = await trainingApi.updateCourse(course.id, {
        title: title.trim(), description: desc, category,
        is_mandatory: mandatory, is_active: isActive, pass_score: passScore,
      });
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { setError('Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[12px] text-gray-700">
            <AlertCircle size={12} /> {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[12px] text-gray-700">
            <CheckCircle2 size={12} /> Changes saved.
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} disabled={saving}
            className="w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60" />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Description</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} disabled={saving}
            className="w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none disabled:opacity-60" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value as TrainingCategory)} disabled={saving}
              className="w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white disabled:opacity-60">
              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Pass Score (%)</label>
            <input type="number" min={0} max={100} value={passScore}
              onChange={e => setPassScore(Number(e.target.value))} disabled={saving}
              className="w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60" />
          </div>
        </div>

        <div className="flex items-center gap-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={mandatory} onChange={e => setMandatory(e.target.checked)}
              disabled={saving} className="w-3.5 h-3.5 accent-gray-800" />
            <span className="text-[12.5px] text-gray-700">Mandatory</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
              disabled={saving} className="w-3.5 h-3.5 accent-gray-800" />
            <span className="text-[12.5px] text-gray-700">Active</span>
          </label>
        </div>

        <button onClick={submit} disabled={saving || !title.trim()}
          className="flex items-center gap-2 px-4 py-2 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors">
          <Save size={12} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Course Drawer ──────────────────────────────────────────────────────────────

type DrawerTab = 'overview' | 'content' | 'enrolled' | 'settings';

function CourseDrawer({
  course, onClose, onUpdated, onDeleted, members, departments, asPage = false,
}: {
  course: TrainingCourse;
  onClose: () => void;
  onUpdated: (c: TrainingCourse) => void;
  onDeleted?: () => void;
  members: OrgMember[];
  departments: Department[];
  asPage?: boolean;
}) {
  const [tab, setTab]                             = useState<DrawerTab>('overview');
  const [localCourse, setLocalCourse]             = useState(course);
  const [showEnroll, setShowEnroll]               = useState(false);
  const [addingModuleTitle, setAddingModuleTitle] = useState('');
  const [savingModule, setSavingModule]           = useState(false);
  const [deletingModule, setDeletingModule]       = useState<number | null>(null);
  const [activeLesson, setActiveLesson]           = useState<TrainingLesson | null>(null);
  const [activeModuleId, setActiveModuleId]       = useState<number | null>(null);
  const [deletingLesson, setDeletingLesson]       = useState<{ modId: number; lessonId: number } | null>(null);
  const [showEditCourse, setShowEditCourse]       = useState(false);
  const [showDeleteCourse, setShowDeleteCourse]   = useState(false);
  const [actionsOpen, setActionsOpen]             = useState(false);
  const [actionsPos, setActionsPos]               = useState({ top: 0, left: 0 });
  const actionsBtnRef                             = useRef<HTMLButtonElement>(null);
  const actionsMenuRef                            = useRef<HTMLDivElement>(null);
  const [toggling, setToggling]                   = useState(false);
  const [deleting, setDeleting]                   = useState(false);
  const [showPreviewLesson, setShowPreviewLesson] = useState(false);

  useEffect(() => {
    if (!actionsOpen) return;
    const dismiss = (ev: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(ev.target as Node)) setActionsOpen(false);
    };
    const closeOnScroll = () => setActionsOpen(false);
    const closeOnKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActionsOpen(false); };
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);
    document.addEventListener('keydown', closeOnKey);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
      document.removeEventListener('keydown', closeOnKey);
    };
  }, [actionsOpen]);

  const openActions = () => {
    if (!actionsBtnRef.current) return;
    const r = actionsBtnRef.current.getBoundingClientRect();
    setActionsPos({ top: r.bottom + 4, left: r.right - 200 });
    setActionsOpen(true);
  };

  const actAct = (fn: () => void) => { setActionsOpen(false); fn(); };

  const handleToggleActive = async () => {
    setToggling(true);
    try {
      const updated = await trainingApi.updateCourse(localCourse.id, { is_active: !localCourse.is_active });
      update(updated);
    } catch { /* ignore */ }
    finally { setToggling(false); }
  };

  const handleDeleteCourse = async () => {
    setDeleting(true);
    try {
      await trainingApi.deleteCourse(localCourse.id);
      setShowDeleteCourse(false);
      onDeleted?.();
      onClose();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const update = (c: TrainingCourse) => { setLocalCourse(c); onUpdated(c); };

  const openEditor = (lesson: TrainingLesson | null, moduleId: number) => {
    setActiveLesson(lesson);
    setActiveModuleId(moduleId);
  };

  const addModule = async () => {
    if (!addingModuleTitle.trim()) return;
    setSavingModule(true);
    try {
      const mod = await trainingApi.createModule(localCourse.id, { title: addingModuleTitle.trim() });
      update({ ...localCourse, modules: [...localCourse.modules, { ...mod, lessons: [] }] });
      setAddingModuleTitle('');
    } catch { /* ignore */ }
    finally { setSavingModule(false); }
  };

  const deleteModule = async (modId: number) => {
    try {
      await trainingApi.deleteModule(modId);
      update({ ...localCourse, modules: localCourse.modules.filter(m => m.id !== modId) });
    } catch { /* ignore */ }
    setDeletingModule(null);
  };

  const handleLessonSaved = (saved: TrainingLesson, isNew: boolean) => {
    if (!activeModuleId) return;
    const updated = {
      ...localCourse,
      modules: localCourse.modules.map(m => {
        if (m.id !== activeModuleId) return m;
        const lessons = isNew
          ? [...m.lessons, saved]
          : m.lessons.map(l => l.id === saved.id ? saved : l);
        return { ...m, lessons, lesson_count: lessons.length };
      }),
    };
    setLocalCourse(updated);
    onUpdated(updated);
    setActiveLesson(saved);
  };

  const deleteLesson = async (moduleId: number, lessonId: number) => {
    try {
      await trainingApi.deleteLesson(lessonId);
      const updated = {
        ...localCourse,
        modules: localCourse.modules.map(m => {
          if (m.id !== moduleId) return m;
          const lessons = m.lessons.filter(l => l.id !== lessonId);
          return { ...m, lessons, lesson_count: lessons.length };
        }),
      };
      setLocalCourse(updated);
      onUpdated(updated);
      if (activeLesson?.id === lessonId) { setActiveLesson(null); setActiveModuleId(null); }
    } catch { /* ignore */ }
    setDeletingLesson(null);
  };

  const totalLessons = localCourse.modules.reduce((s, m) => s + m.lessons.length, 0);

  const handleDuplicateLesson = async (lesson: TrainingLesson) => {
    try {
      const dup = await trainingApi.duplicateLesson(lesson.id);
      const updated = {
        ...localCourse,
        modules: localCourse.modules.map(m => {
          if (m.id !== activeModuleId) return m;
          const lessons = [...m.lessons, dup];
          return { ...m, lessons, lesson_count: lessons.length };
        }),
      };
      setLocalCourse(updated);
      onUpdated(updated);
      setActiveLesson(dup);
    } catch { /* ignore */ }
  };

  const handleDragEnd = (moduleId: number, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const mod = localCourse.modules.find(m => m.id === moduleId);
    if (!mod) return;
    const oldIdx = mod.lessons.findIndex(l => l.id === active.id);
    const newIdx = mod.lessons.findIndex(l => l.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const newLessons = arrayMove(mod.lessons, oldIdx, newIdx).map((l, i) => ({ ...l, order: i }));
    const updated = {
      ...localCourse,
      modules: localCourse.modules.map(m => m.id === moduleId ? { ...m, lessons: newLessons } : m),
    };
    setLocalCourse(updated);
    onUpdated(updated);
    trainingApi.reorderLessons(moduleId, newLessons.map(l => l.id)).catch(() => {});
  };

  const handleMoveLesson = (lesson: TrainingLesson, direction: 'up' | 'down') => {
    const mod = localCourse.modules.find(m => m.id === activeModuleId);
    if (!mod) return;
    const idx = mod.lessons.findIndex(l => l.id === lesson.id);
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= mod.lessons.length) return;
    const newLessons = arrayMove(mod.lessons, idx, newIdx).map((l, i) => ({ ...l, order: i }));
    const updated = {
      ...localCourse,
      modules: localCourse.modules.map(m => m.id === activeModuleId ? { ...m, lessons: newLessons } : m),
    };
    setLocalCourse(updated);
    onUpdated(updated);
    trainingApi.reorderLessons(activeModuleId!, newLessons.map(l => l.id)).catch(() => {});
  };

  const TABS: { id: DrawerTab; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'content',   label: 'Content' },
    { id: 'enrolled',  label: 'Enrolled Users' },
    { id: 'settings',  label: 'Settings' },
  ];

  return (
    <>
      {showEnroll && (
        <EnrollModal
          course={localCourse}
          members={members}
          departments={departments}
          onClose={() => setShowEnroll(false)}
        />
      )}

      {deletingModule !== null && (
        <ConfirmDialog
          title="Delete Module"
          body={`"${localCourse.modules.find(m => m.id === deletingModule)?.title}" and all its lessons will be permanently removed.`}
          confirmLabel="Delete Module"
          onConfirm={() => deleteModule(deletingModule)}
          onCancel={() => setDeletingModule(null)}
        />
      )}

      {deletingLesson !== null && (() => {
        const lesson = localCourse.modules
          .find(m => m.id === deletingLesson.modId)?.lessons
          .find(l => l.id === deletingLesson.lessonId);
        return (
          <ConfirmDialog
            title="Delete Lesson"
            body={`"${lesson?.title ?? 'This lesson'}" will be permanently removed.`}
            confirmLabel="Delete Lesson"
            onConfirm={() => deleteLesson(deletingLesson.modId, deletingLesson.lessonId)}
            onCancel={() => setDeletingLesson(null)}
          />
        );
      })()}

      {showEditCourse && (
        <CourseModal
          course={localCourse}
          departments={departments}
          onClose={() => setShowEditCourse(false)}
          onSaved={saved => { update({ ...saved, modules: localCourse.modules }); setShowEditCourse(false); }}
        />
      )}

      {showPreviewLesson && activeLesson && (
        <LessonPreviewModal lesson={activeLesson} onClose={() => setShowPreviewLesson(false)} />
      )}

      {showDeleteCourse && (
        <ConfirmDialog
          title="Delete Course"
          body={`"${localCourse.title}" and all its modules and lessons will be permanently deleted. This cannot be undone.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete Course'}
          danger
          onConfirm={handleDeleteCourse}
          onCancel={() => setShowDeleteCourse(false)}
        />
      )}

      {/* Actions dropdown portal */}
      {actionsOpen && createPortal(
        <div ref={actionsMenuRef}
          className="fixed z-[9999] bg-white rounded-xl border border-gray-200 shadow-xl py-1.5 w-[200px]"
          style={{ top: actionsPos.top, left: actionsPos.left }}>
          <p className="px-3.5 pt-1 pb-1 text-[9.5px] font-bold text-gray-400 uppercase tracking-widest">Enrollment</p>
          <button onClick={() => actAct(() => setShowEnroll(true))}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
            <UserPlus size={13} className="text-gray-400" /> Enroll Users
          </button>
          <button onClick={() => actAct(() => setTab('enrolled'))}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
            <Users size={13} className="text-gray-400" /> View Enrolled
          </button>
          <div className="my-1 border-t border-gray-100" />
          <p className="px-3.5 pt-1 pb-1 text-[9.5px] font-bold text-gray-400 uppercase tracking-widest">Course</p>
          <button onClick={() => actAct(() => setShowEditCourse(true))}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
            <Pencil size={13} className="text-gray-400" /> Edit Course
          </button>
          <button onClick={() => actAct(handleToggleActive)} disabled={toggling}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            <CheckCircle2 size={13} className={localCourse.is_active ? 'text-gray-400' : 'text-gray-500'} />
            {toggling ? 'Saving…' : localCourse.is_active ? 'Set Inactive' : 'Set Active'}
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button onClick={() => actAct(() => setShowDeleteCourse(true))}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-600 hover:bg-gray-50">
            <Trash2 size={13} className="text-gray-400" /> Delete Course
          </button>
        </div>,
        document.body,
      )}

      <div className={asPage ? 'flex flex-col h-full' : 'fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm'} onClick={asPage ? undefined : onClose}>
        <div
          className={asPage
            ? 'flex flex-col flex-1 min-h-0 bg-white rounded-xl border border-gray-200 overflow-hidden'
            : 'bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden'}
          style={asPage ? undefined : { width: '95vw', height: '95vh' }}
          onClick={asPage ? undefined : e => e.stopPropagation()}
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 shrink-0">
            {asPage && (
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors mr-1">
                <ChevronLeft size={15} />
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <GraduationCap size={15} className="text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[14px] font-bold text-gray-900 leading-snug truncate">{localCourse.title}</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {localCourse.modules.length} module{localCourse.modules.length !== 1 ? 's' : ''}
                <span className="mx-1">·</span>
                {totalLessons} lesson{totalLessons !== 1 ? 's' : ''}
                <span className="mx-1">·</span>
                {localCourse.enrolled_count} enrolled
                {localCourse.is_mandatory && (
                  <><span className="mx-1">·</span><span className="text-gray-600 font-medium">Mandatory</span></>
                )}
              </p>
            </div>
            {asPage && (
              <button
                ref={actionsBtnRef}
                onClick={openActions}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
              >
                <MoreVertical size={13} /> Actions
              </button>
            )}
            {!asPage && (
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={15} />
              </button>
            )}
          </div>

          {/* ── Tab bar ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-1 px-5 py-2 border-b border-gray-100 shrink-0">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${
                  tab === t.id
                    ? 'border border-gray-300 text-gray-900 bg-white'
                    : 'border border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab body ────────────────────────────────────────────────── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {tab === 'overview' && (
              <OverviewTab
                course={localCourse}
                onEnroll={() => setShowEnroll(true)}
                onGoContent={() => setTab('content')}
                onToggleActive={async () => {
                  try {
                    const updated = await trainingApi.updateCourse(localCourse.id, { is_active: !localCourse.is_active });
                    update(updated);
                  } catch { /* ignore */ }
                }}
              />
            )}

            {tab === 'content' && (
              <div className="flex flex-1 min-h-0">

                {/* ── LEFT: Course Structure (280px) ──────────────── */}
                <div className="w-[280px] shrink-0 border-r border-gray-100 flex flex-col bg-white">
                  <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                    <p className="text-[12px] font-bold text-gray-800">Course Structure</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {localCourse.modules.length} module{localCourse.modules.length !== 1 ? 's' : ''} · {totalLessons} lesson{totalLessons !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
                    {localCourse.modules.map(mod => (
                      <DndContext key={mod.id} collisionDetection={closestCenter} onDragEnd={e => handleDragEnd(mod.id, e)}>
                        <div>
                          <div className="flex items-center justify-between px-2 py-1.5 group">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate flex-1">{mod.title}</p>
                            <p className="text-[9.5px] text-gray-400 mx-2">{mod.lesson_count}</p>
                            <button onClick={() => setDeletingModule(mod.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-500 hover:bg-gray-50 rounded-md transition-all">
                              <Trash2 size={11} />
                            </button>
                          </div>
                          <SortableContext items={mod.lessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
                            <div className="pl-1 space-y-0.5">
                              {mod.lessons.map(lesson => (
                                <SortableLesson
                                  key={lesson.id}
                                  lesson={lesson}
                                  moduleId={mod.id}
                                  isActive={activeLesson?.id === lesson.id && activeModuleId === mod.id}
                                  onEdit={() => openEditor(lesson, mod.id)}
                                  onDelete={() => setDeletingLesson({ modId: mod.id, lessonId: lesson.id })}
                                />
                              ))}
                            </div>
                          </SortableContext>
                          <button onClick={() => openEditor(null, mod.id)}
                            className={`flex items-center gap-1.5 w-full px-2 py-2 mt-1 text-[11.5px] font-medium rounded-lg border border-dashed transition-colors ${
                              activeLesson === null && activeModuleId === mod.id
                                ? 'border-gray-500 text-gray-800 bg-gray-50'
                                : 'border-gray-300 text-gray-500 hover:border-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}>
                            <Plus size={11} /> Add Lesson
                          </button>
                        </div>
                      </DndContext>
                    ))}
                    <div className="flex flex-col gap-1.5 pt-2 pb-2 px-1">
                      <input value={addingModuleTitle} onChange={e => setAddingModuleTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addModule()}
                        placeholder="New module title..."
                        className="w-full px-3 py-2 text-[12px] border border-dashed border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400" />
                      <button onClick={addModule} disabled={savingModule || !addingModuleTitle.trim()}
                        className="w-full py-2 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-50 transition-colors">
                        {savingModule ? 'Adding…' : '+ Add Module'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── CENTER: Lesson editor ────────────────────────── */}
                <div className="flex-1 min-w-0 bg-gray-50 overflow-hidden">
                  {activeModuleId !== null ? (
                    <LessonEditor
                      key={activeLesson?.id ?? `new-${activeModuleId}`}
                      lesson={activeLesson}
                      moduleId={activeModuleId}
                      coursePassScore={localCourse.pass_score}
                      onSaved={handleLessonSaved}
                      onCancel={() => { setActiveLesson(null); setActiveModuleId(null); }}
                      onDelete={() => { if (activeLesson && activeModuleId) setDeletingLesson({ modId: activeModuleId, lessonId: activeLesson.id }); }}
                      onDuplicate={() => { if (activeLesson) handleDuplicateLesson(activeLesson); }}
                      onPreview={() => setShowPreviewLesson(true)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center px-8">
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                        <BookOpen size={20} className="text-gray-400" />
                      </div>
                      <p className="text-[13.5px] font-semibold text-gray-700">Select a lesson to edit</p>
                      <p className="text-[12px] text-gray-400 mt-1">Or click "+ Add Lesson" under any module.</p>
                      {localCourse.modules.length === 0 && (
                        <div className="flex items-center gap-2 mt-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                          <ChevronRight size={13} className="text-gray-400 shrink-0" />
                          <p className="text-[11.5px] text-gray-500">Start by adding a module on the left.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── RIGHT: Lesson Overview + Quick Actions (260px) ── */}
                <div className="w-[260px] shrink-0 border-l border-gray-100 bg-white overflow-y-auto">
                  {activeLesson ? (
                    <LessonSidebar
                      lesson={activeLesson}
                      course={localCourse}
                      onPreview={() => setShowPreviewLesson(true)}
                      onDuplicate={() => handleDuplicateLesson(activeLesson)}
                      onDelete={() => { if (activeModuleId) setDeletingLesson({ modId: activeModuleId, lessonId: activeLesson.id }); }}
                      onMoveUp={() => handleMoveLesson(activeLesson, 'up')}
                      onMoveDown={() => handleMoveLesson(activeLesson, 'down')}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                        <FileText size={16} className="text-gray-400" />
                      </div>
                      <p className="text-[12px] font-semibold text-gray-600">No lesson selected</p>
                      <p className="text-[11px] text-gray-400 mt-1">Select a lesson to see details</p>
                    </div>
                  )}
                </div>

              </div>
            )}

            {tab === 'enrolled' && (
              <EnrolledUsersTab courseId={localCourse.id} />
            )}

            {tab === 'settings' && (
              <SettingsTab
                course={localCourse}
                departments={departments}
                onSaved={c => update(c)}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Enroll Modal ───────────────────────────────────────────────────────────────

function EnrollModal({
  course, members, departments, onClose,
}: {
  course: TrainingCourse;
  members: OrgMember[];
  departments: Department[];
  onClose: () => void;
}) {
  const [mode, setMode]         = useState<'users' | 'dept'>('users');
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [deptId, setDeptId]     = useState<number | null>(null);
  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState(0);

  const filtered = members.filter(m =>
    m.user.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: number) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const enroll = async () => {
    setSaving(true);
    try {
      const res = await trainingApi.enrollUsers(course.id, {
        ...(mode === 'users' ? { user_ids: selected.map(id => members.find(m => m.id === id)!.user.id) } : {}),
        ...(mode === 'dept' && deptId ? { department_id: deptId } : {}),
      });
      setDone(res.enrolled);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[14px] font-bold text-gray-900">Enroll — {course.title}</h2>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>

        {done > 0 ? (
          <div className="flex flex-col items-center py-10 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
              <CheckCircle2 size={22} className="text-gray-500" />
            </div>
            <p className="text-[13.5px] font-semibold text-gray-700">{done} user{done !== 1 ? 's' : ''} enrolled</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl">Done</button>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 space-y-3">
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                {(['users', 'dept'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 py-2 text-[12px] font-semibold transition-colors ${mode === m ? 'bg-gray-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {m === 'users' ? 'Specific Users' : 'By Department'}
                  </button>
                ))}
              </div>

              {mode === 'users' ? (
                <>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..."
                      className="w-full pl-8 pr-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" />
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-0.5">
                    {filtered.map(m => (
                      <label key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} className="w-3.5 h-3.5 accent-gray-900" />
                        <div>
                          <p className="text-[12.5px] font-semibold text-gray-800">{m.user.display_name}</p>
                          <p className="text-[11px] text-gray-400">{m.user.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <select value={deptId ?? ''} onChange={e => setDeptId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white">
                  <option value="">Select department…</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <button onClick={onClose} className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-50 rounded-xl">Cancel</button>
              <button onClick={enroll} disabled={saving || (mode === 'users' ? selected.length === 0 : !deptId)}
                className="px-4 py-2 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-xl">
                {saving ? 'Enrolling…' : 'Enroll'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Course Modal ───────────────────────────────────────────────────────────────

function CourseModal({
  course, departments, onClose, onSaved,
}: {
  course?: TrainingCourse;
  departments: Department[];
  onClose: () => void;
  onSaved: (c: TrainingCourse) => void;
}) {
  const [title, setTitle]         = useState(course?.title ?? '');
  const [description, setDesc]    = useState(course?.description ?? '');
  const [category, setCategory]   = useState<TrainingCategory>(course?.category ?? 'other');
  const [deptId, setDeptId]       = useState<number | null>(null);
  const [mandatory, setMandatory] = useState(course?.is_mandatory ?? false);
  const [isActive, setIsActive]   = useState(course?.is_active ?? true);
  const [passScore, setPassScore] = useState(course?.pass_score ?? 70);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const submit = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const data = {
        title: title.trim(), description, category,
        is_mandatory: mandatory, is_active: isActive, pass_score: passScore,
        ...(deptId ? { department_id: deptId } : {}),
      };
      const saved = course
        ? await trainingApi.updateCourse(course.id, data)
        : await trainingApi.createCourse(data);
      onSaved(saved);
    } catch { setError('Failed to save course.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-[14px] font-bold text-gray-900">{course ? 'Edit Course' : 'New Course'}</h2>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[12px] text-gray-700">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <div>
            <label className="block text-[10.5px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" />
          </div>
          <div>
            <label className="block text-[10.5px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Description</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as TrainingCategory)}
                className="w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white">
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Department</label>
              <select value={deptId ?? ''} onChange={e => setDeptId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white">
                <option value="">All</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Pass Score (%)</label>
              <input type="number" min={0} max={100} value={passScore} onChange={e => setPassScore(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" />
            </div>
            <div className="flex flex-col justify-end gap-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={mandatory} onChange={e => setMandatory(e.target.checked)} className="w-3.5 h-3.5 accent-gray-900" />
                <span className="text-[12.5px] text-gray-700">Mandatory</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-3.5 h-3.5 accent-gray-900" />
                <span className="text-[12.5px] text-gray-700">Active</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-50 rounded-xl">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-2 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-xl">
            {saving ? 'Saving…' : course ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Enroll Modal ──────────────────────────────────────────────────────────

function BulkEnrollModal({
  courses, members, departments, onClose,
}: {
  courses: TrainingCourse[];
  members: OrgMember[];
  departments: Department[];
  onClose: () => void;
}) {
  const [step, setStep]           = useState<'pick' | 'enroll'>('pick');
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<TrainingCourse | null>(null);
  const [mode, setMode]           = useState<'users' | 'dept'>('users');
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<number[]>([]);
  const [deptId, setDeptId]       = useState<number | null>(null);
  const [saving, setSaving]       = useState(false);
  const [done, setDone]           = useState(0);

  const filteredCourses = courses.filter(c =>
    c.title.toLowerCase().includes(courseSearch.toLowerCase()),
  );
  const filteredMembers = members.filter(m =>
    m.user.display_name.toLowerCase().includes(search.toLowerCase()),
  );
  const toggle = (id: number) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const enroll = async () => {
    if (!selectedCourse) return;
    setSaving(true);
    try {
      const res = await trainingApi.enrollUsers(selectedCourse.id, {
        ...(mode === 'users' ? { user_ids: selected.map(id => members.find(m => m.id === id)!.user.id) } : {}),
        ...(mode === 'dept' && deptId ? { department_id: deptId } : {}),
      });
      setDone(res.enrolled);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {step === 'enroll' && !done && (
              <button onClick={() => setStep('pick')} className="text-gray-400 hover:text-gray-600 mr-1">
                <ChevronDown size={16} className="rotate-90" />
              </button>
            )}
            <h2 className="text-[14px] font-bold text-gray-900">
              {done > 0 ? 'Enrolled!' : step === 'pick' ? 'Bulk Enroll — Select Course' : `Enroll into "${selectedCourse?.title}"`}
            </h2>
          </div>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>

        {done > 0 ? (
          <div className="flex flex-col items-center py-10 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
              <CheckCircle2 size={22} className="text-gray-500" />
            </div>
            <p className="text-[13.5px] font-semibold text-gray-700">{done} user{done !== 1 ? 's' : ''} enrolled in "{selectedCourse?.title}"</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl">Done</button>
          </div>
        ) : step === 'pick' ? (
          <div className="px-5 py-4 space-y-3">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={courseSearch} onChange={e => setCourseSearch(e.target.value)} placeholder="Search courses…"
                className="w-full pl-8 pr-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredCourses.map(c => (
                <button key={c.id} onClick={() => { setSelectedCourse(c); setStep('enroll'); }}
                  className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg hover:bg-gray-50 text-left group">
                  <div>
                    <p className="text-[12.5px] font-semibold text-gray-800">{c.title}</p>
                    <p className="text-[11px] text-gray-400">{c.enrolled_count} enrolled · {c.completion_pct}% complete</p>
                  </div>
                  <ChevronDown size={13} className="-rotate-90 text-gray-300 group-hover:text-gray-500" />
                </button>
              ))}
              {filteredCourses.length === 0 && (
                <p className="text-[12px] text-gray-400 text-center py-6">No courses found</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 space-y-3">
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                {(['users', 'dept'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 py-2 text-[12px] font-semibold transition-colors ${mode === m ? 'bg-gray-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {m === 'users' ? 'Specific Users' : 'By Department'}
                  </button>
                ))}
              </div>
              {mode === 'users' ? (
                <>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members…"
                      className="w-full pl-8 pr-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" />
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-0.5">
                    {filteredMembers.map(m => (
                      <label key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} className="w-3.5 h-3.5 accent-gray-900" />
                        <div>
                          <p className="text-[12.5px] font-semibold text-gray-800">{m.user.display_name}</p>
                          <p className="text-[11px] text-gray-400">{m.user.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <select value={deptId ?? ''} onChange={e => setDeptId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white">
                  <option value="">Select department…</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <button onClick={onClose} className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-50 rounded-xl">Cancel</button>
              <button onClick={enroll} disabled={saving || (mode === 'users' ? selected.length === 0 : !deptId)}
                className="px-4 py-2 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-xl">
                {saving ? 'Enrolling…' : `Enroll ${mode === 'users' ? selected.length || '' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Progress Report Modal ──────────────────────────────────────────────────────

function ProgressReportModal({
  courses, onClose,
}: {
  courses: TrainingCourse[];
  onClose: () => void;
}) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');

  useEffect(() => {
    analyticsApi.getAnalytics()
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
      .finally(() => setLoading(false));
  }, []);

  const courseMap = useMemo(() => {
    const map: Record<string, TrainingCourse> = {};
    courses.forEach(c => { map[c.title] = c; });
    return map;
  }, [courses]);

  const rows = useMemo(() => {
    const analyticsRows = analytics?.training?.by_course ?? [];
    const analyticsSet  = new Set(analyticsRows.map(r => r.course_title));
    const extra = courses
      .filter(c => !analyticsSet.has(c.title))
      .map(c => ({ course_title: c.title, enrolled: c.enrolled_count, completed: Math.round(c.enrolled_count * c.completion_pct / 100) }));
    return [...analyticsRows, ...extra].filter(r =>
      !search || r.course_title.toLowerCase().includes(search.toLowerCase()),
    );
  }, [analytics, courses, search]);

  const totalEnrolled  = courses.reduce((s, c) => s + c.enrolled_count, 0);
  const totalCompleted = courses.reduce((s, c) => s + Math.round(c.enrolled_count * c.completion_pct / 100), 0);
  const overallRate    = totalEnrolled > 0 ? Math.round(totalCompleted / totalEnrolled * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-gray-500" />
            <h2 className="text-[14px] font-bold text-gray-900">Progress Report</h2>
          </div>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 px-5 py-3 border-b border-gray-100 shrink-0">
          {[
            { label: 'Total Courses', value: courses.length, color: 'text-gray-800' },
            { label: 'Total Enrolled', value: totalEnrolled, color: 'text-gray-600' },
            { label: 'Overall Completion', value: `${overallRate}%`, color: overallRate >= 70 ? 'text-gray-700' : overallRate >= 40 ? 'text-gray-600' : 'text-gray-500' },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-xl px-4 py-2.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</p>
              <p className={`text-[18px] font-bold ${s.color} mt-0.5 leading-none`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="px-5 py-2.5 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by course name…"
              className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-0 px-5 py-2 bg-gray-50 border-b border-gray-200 sticky top-0">
            {['Course', 'Category', 'Type', 'Enrolled', 'Completion'].map(h => (
              <p key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</p>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2 p-5">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[13px] font-semibold text-gray-600">No data yet</p>
              <p className="text-[11.5px] text-gray-400 mt-1">Enroll members in courses to see progress here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.map((row, i) => {
                const course = courseMap[row.course_title];
                const rate   = row.enrolled > 0 ? Math.round(row.completed / row.enrolled * 100) : (course?.completion_pct ?? 0);
                return (
                  <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-0 px-5 py-2.5 hover:bg-gray-50">
                    <div className="flex flex-col justify-center min-w-0 pr-2">
                      <p className="text-[12.5px] font-semibold text-gray-800 truncate">{row.course_title}</p>
                      {course?.description && (
                        <p className="text-[11px] text-gray-400 truncate">{course.description}</p>
                      )}
                    </div>
                    <div className="flex items-center">
                      <span className={`text-[11.5px] font-medium ${CAT_COLORS[course?.category ?? 'other'] ?? 'text-gray-500'}`}>
                        {CAT_LABELS[course?.category ?? 'other'] ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className={`text-[11.5px] font-medium ${course?.is_mandatory ? 'text-gray-600' : 'text-gray-600'}`}>
                        {course?.is_mandatory ? 'Mandatory' : 'Elective'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users size={10} className="text-gray-400" />
                      <span className="text-[11.5px] text-gray-600">{row.enrolled}</span>
                      <span className="text-[10.5px] text-gray-400">/ {row.completed} done</span>
                    </div>
                    <div className="flex flex-col justify-center gap-0.5 pr-2">
                      <span className="text-[10.5px] text-gray-500">{rate}%</span>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${rate >= 70 ? 'bg-gray-500' : rate >= 40 ? 'bg-gray-500' : 'bg-gray-300'}`}
                          style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end px-5 py-3 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-50 rounded-xl">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Training Settings Modal ────────────────────────────────────────────────────

function TrainingSettingsModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [settings, setSettings]     = useState<OrgSettingsData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [autoEnroll, setAutoEnroll] = useState(false);
  const [certificates, setCerts]    = useState(true);
  const [reminderDays, setReminder] = useState(3);
  const [defaultPass, setDefaultPass] = useState(70);

  useEffect(() => {
    settingsApi.getSettings().then(s => {
      setSettings(s);
      setAutoEnroll(s.training_auto_enroll_mandatory);
      setCerts(s.training_certificate_enabled);
      setReminder(s.training_reminder_days);
      setDefaultPass(s.training_default_pass_score);
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await settingsApi.updateSettings({
        training_auto_enroll_mandatory: autoEnroll,
        training_certificate_enabled:   certificates,
        training_reminder_days:         reminderDays,
        training_default_pass_score:    defaultPass,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Settings size={15} className="text-gray-500" />
            <h2 className="text-[14px] font-bold text-gray-900">Training Settings</h2>
          </div>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>

        {loading ? (
          <div className="px-5 py-6 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <div className="px-5 py-4 space-y-5">
            {/* Auto-enroll */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12.5px] font-semibold text-gray-800">Auto-enroll in mandatory courses</p>
                <p className="text-[11.5px] text-gray-400 mt-0.5">Automatically enroll all members when a mandatory course is created</p>
              </div>
              <button
                onClick={() => setAutoEnroll(v => !v)}
                className={`relative w-10 h-5.5 shrink-0 rounded-full transition-colors ${autoEnroll ? 'bg-gray-500' : 'bg-gray-200'}`}
                style={{ minWidth: 40, height: 22 }}
              >
                <span className={`absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform ${autoEnroll ? 'translate-x-[19px]' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Certificates */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12.5px] font-semibold text-gray-800">Issue completion certificates</p>
                <p className="text-[11.5px] text-gray-400 mt-0.5">Generate and issue certificates when members complete a course</p>
              </div>
              <button
                onClick={() => setCerts(v => !v)}
                className={`relative shrink-0 rounded-full transition-colors ${certificates ? 'bg-gray-500' : 'bg-gray-200'}`}
                style={{ minWidth: 40, width: 40, height: 22 }}
              >
                <span className={`absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform ${certificates ? 'translate-x-[19px]' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Default pass score */}
            <div>
              <label className="block text-[10.5px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Default Pass Score (%)</label>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={100} step={5} value={defaultPass}
                  onChange={e => setDefaultPass(Number(e.target.value))}
                  className="flex-1 accent-gray-900" />
                <span className="text-[13px] font-bold text-gray-800 w-10 text-right">{defaultPass}%</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Applied to new courses as the default minimum score to pass</p>
            </div>

            {/* Reminder days */}
            <div>
              <label className="block text-[10.5px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Completion Reminder (days before due)</label>
              <div className="flex items-center gap-2">
                {[1, 3, 5, 7, 14].map(d => (
                  <button key={d} onClick={() => setReminder(d)}
                    className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg border transition-colors ${reminderDays === d ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {d}d
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Send reminder notifications this many days before the due date</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          {saved ? (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-700">
              <CheckCircle2 size={13} /> Saved
            </span>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-50 rounded-xl">Cancel</button>
            <button onClick={save} disabled={saving || loading}
              className="px-4 py-2 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-xl">
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Right Sidebar ──────────────────────────────────────────────────────────────

const DONUT_COLORS = ['#111827', '#6b7280', '#e5e7eb'];

function RightSidebar({
  courses,
  totalEnrolled,
  totalCompleted,
  canManage,
  onNewCourse,
  onBulkEnroll,
  onProgressReport,
  onExportData,
  onTrainingSettings,
}: {
  courses: TrainingCourse[];
  totalEnrolled: number;
  totalCompleted: number;
  canManage: boolean;
  onNewCourse: () => void;
  onBulkEnroll: () => void;
  onProgressReport: () => void;
  onExportData: () => void;
  onTrainingSettings: () => void;
}) {
  const notStarted = Math.max(0, totalEnrolled - totalCompleted);
  const inProgress = Math.max(0, totalEnrolled - totalCompleted - Math.round(notStarted * 0.4));

  const donutData = [
    { name: 'Completed', value: totalCompleted },
    { name: 'In Progress', value: inProgress },
    { name: 'Not Started', value: Math.max(0, notStarted - inProgress) },
  ].filter(d => d.value > 0);

  const popular = [...courses]
    .sort((a, b) => b.enrolled_count - a.enrolled_count)
    .slice(0, 5);

  const mandatoryCourses  = courses.filter(c => c.is_mandatory);
  const complianceRate    = mandatoryCourses.length > 0
    ? Math.round(mandatoryCourses.reduce((s, c) => s + c.completion_pct, 0) / mandatoryCourses.length)
    : 0;

  return (
    <div className="w-[260px] shrink-0 space-y-3">
      {/* Training Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[11.5px] font-bold text-gray-700 mb-3">Training Overview</p>
        {totalEnrolled > 0 ? (
          <>
            <div className="flex justify-center">
              <PieChart width={120} height={110}>
                <Pie data={donutData} cx={55} cy={50} innerRadius={28} outerRadius={44}
                  dataKey="value" paddingAngle={2}>
                  {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} stroke="none" />)}
                </Pie>
                <ReTooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(v: number) => [`${v} users`, '']}
                />
              </PieChart>
            </div>
            <div className="space-y-1.5 mt-1">
              {[['Completed', DONUT_COLORS[0], totalCompleted], ['In Progress', DONUT_COLORS[1], inProgress], ['Not Started', DONUT_COLORS[2], Math.max(0, notStarted - inProgress)]]
                .filter(([, , v]) => (v as number) > 0)
                .map(([label, color, value]) => (
                  <div key={label as string} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color as string }} />
                      <span className="text-[11px] text-gray-600">{label as string}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-800">{value as number}</span>
                  </div>
                ))
              }
            </div>
          </>
        ) : (
          <p className="text-[11.5px] text-gray-400 text-center py-4">No enrollments yet</p>
        )}
      </div>

      {/* Popular Trainings */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[11.5px] font-bold text-gray-700 mb-3">Popular Trainings</p>
        {popular.length > 0 ? (
          <div className="space-y-2">
            {popular.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2.5">
                <span className="text-[10.5px] font-bold text-gray-400 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11.5px] font-semibold text-gray-800 truncate">{c.title}</p>
                  <p className="text-[10.5px] text-gray-400">{c.enrolled_count} enrolled</p>
                </div>
                <span className="text-[10.5px] font-semibold text-gray-600 shrink-0">{c.completion_pct}%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11.5px] text-gray-400 text-center py-2">No courses yet</p>
        )}
      </div>

      {/* Training Compliance */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[11.5px] font-bold text-gray-700 mb-3">Training Compliance</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-500">Mandatory courses</span>
            <span className="text-[11.5px] font-bold text-gray-800">{mandatoryCourses.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-500">Compliance rate</span>
            <span className={`text-[11.5px] font-bold ${complianceRate >= 80 ? 'text-gray-700' : complianceRate >= 50 ? 'text-gray-600' : 'text-gray-600'}`}>
              {complianceRate}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-500">Active courses</span>
            <span className="text-[11.5px] font-bold text-gray-800">{courses.filter(c => c.is_active).length}</span>
          </div>
          {mandatoryCourses.length > 0 && (
            <div className="mt-1">
              <div className="flex justify-between mb-1">
                <span className="text-[10px] text-gray-400">Avg completion</span>
                <span className="text-[10px] text-gray-500">{complianceRate}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${complianceRate >= 80 ? 'bg-gray-500' : complianceRate >= 50 ? 'bg-gray-500' : 'bg-gray-500'}`}
                  style={{ width: `${complianceRate}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[11.5px] font-bold text-gray-700 mb-3">Quick Actions</p>
        <div className="space-y-1.5">
          {canManage && (
            <button onClick={onNewCourse}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg text-left transition-colors">
              <Plus size={13} className="text-gray-500 shrink-0" /> New Course
            </button>
          )}
          <button onClick={onBulkEnroll} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg text-left transition-colors">
            <Users size={13} className="text-gray-500 shrink-0" /> Bulk Enroll
          </button>
          <button onClick={onProgressReport} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg text-left transition-colors">
            <BarChart3 size={13} className="text-gray-500 shrink-0" /> Progress Report
          </button>
          <button onClick={onExportData} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg text-left transition-colors">
            <Download size={13} className="text-gray-500 shrink-0" /> Export Data
          </button>
          {canManage && (
            <button onClick={onTrainingSettings} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg text-left transition-colors">
              <Settings size={13} className="text-gray-400 shrink-0" /> Training Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Member Training View ───────────────────────────────────────────────────────

type MemberTabKey = 'all' | 'in_progress' | 'completed' | 'not_started';
const MEMBER_PAGE_SIZE = 5;

const DIFF_BADGE: Record<string, string> = {
  compliance:    'bg-gray-100 text-gray-600',
  technical:     'bg-gray-100 text-gray-600',
  soft_skills:   'bg-gray-100 text-gray-600',
  leadership:    'bg-gray-100 text-gray-600',
  onboarding:    'bg-gray-100 text-gray-600',
  health_safety: 'bg-gray-100 text-gray-600',
  other:         'bg-gray-100 text-gray-500',
};

const CAT_BG: Record<string, string> = {
  compliance:    'bg-gray-300',
  technical:     'bg-gray-300',
  soft_skills:   'bg-gray-300',
  leadership:    'bg-gray-300',
  onboarding:    'bg-gray-300',
  health_safety: 'bg-gray-300',
  other:         'bg-gray-200',
};

function enrollmentStatus(e: import('../api/orgApi').TrainingEnrollment): 'completed' | 'in_progress' | 'not_started' {
  if (e.status === 'completed') return 'completed';
  if (e.progress_pct > 0 || e.status === 'in_progress') return 'in_progress';
  return 'not_started';
}

function RateCourseModal({
  courseTitle,
  onClose,
  onSubmit,
}: {
  courseTitle: string;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
}) {
  const [rating, setRating]   = useState(0);
  const [hover, setHover]     = useState(0);
  const [comment, setComment] = useState('');

  const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  return createPortal(
    <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-[14px] font-bold text-gray-900">Rate This Course</p>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={14} /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <p className="text-[12.5px] text-gray-500 truncate">{courseTitle}</p>
          {/* Stars */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={32}
                    className={`transition-colors ${n <= (hover || rating) ? 'text-gray-700 fill-gray-700' : 'text-gray-200'}`}
                  />
                </button>
              ))}
            </div>
            {(hover || rating) > 0 && (
              <p className="text-[12px] font-semibold text-gray-600">{LABELS[hover || rating]}</p>
            )}
          </div>
          {/* Comment */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Comments <span className="font-normal text-gray-400 normal-case">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              placeholder="What did you find most helpful? Any suggestions?"
              className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 text-gray-700 placeholder-gray-300"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(rating, comment)}
            disabled={rating === 0}
            className="px-4 py-2 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Submit Rating
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MemberCourseRow({
  enrollment,
  orgName,
  onOpen,
  onUpdate,
}: {
  enrollment: import('../api/orgApi').TrainingEnrollment;
  orgName: string;
  onOpen: () => void;
  onUpdate: (updated: import('../api/orgApi').TrainingEnrollment) => void;
}) {
  const c   = enrollment.course;
  const est = enrollmentStatus(enrollment);
  const totalLessons = c.modules.reduce((s, m) => s + m.lessons.length, 0) || enrollment.total_lessons;
  const { orgMember } = useOrg();
  const memberDisplayName = enrollment.user_name || orgMember?.user.display_name || 'Member';

  const [menuOpen, setMenuOpen]         = useState(false);
  const [menuPos, setMenuPos]           = useState({ top: 0, left: 0 });
  const menuBtnRef                      = useRef<HTMLButtonElement>(null);
  const menuRef                         = useRef<HTMLDivElement>(null);
  const [toast, setToast]               = useState<string | null>(null);
  const [showRating, setShowRating]     = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!menuBtnRef.current) return;
    const r = menuBtnRef.current.getBoundingClientRect();
    const estimatedH = 290;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow < estimatedH
      ? Math.max(8, r.top - estimatedH - 4)
      : r.bottom + 4;
    setMenuPos({ top, left: r.right - 220 });
    setMenuOpen(true);
  };

  const act = (fn: () => void) => { setMenuOpen(false); fn(); };


  const handleCopyLink = () => {
    act(() => {
      const url = `${window.location.origin}/org/training`;
      navigator.clipboard.writeText(url).then(
        () => setToast('Link copied to clipboard'),
        () => setToast('Could not copy link'),
      );
    });
  };

  const handlePrintSyllabus = () => {
    act(() => {
      const win = window.open('', '_blank', 'width=800,height=700');
      if (!win) return;
      const modules = c.modules.map(m => `
        <div style="margin-bottom:16px">
          <p style="font-weight:700;font-size:13px;color:#111;margin:0 0 6px">${m.title}</p>
          <ol style="margin:0;padding-left:20px">
            ${m.lessons.map(l => `<li style="font-size:12px;color:#374151;margin-bottom:3px">${l.title} <span style="color:#9ca3af;font-size:11px">(${l.lesson_type.replace('_',' ')})</span></li>`).join('')}
          </ol>
        </div>`).join('');
      win.document.write(`
        <!DOCTYPE html><html><head>
          <title>${c.title} — Course Syllabus</title>
          <style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin:0 0 4px}p{margin:2px 0;color:#6b7280;font-size:13px}hr{border:none;border-top:1px solid #e5e7eb;margin:16px 0}</style>
        </head><body>
          <h1>${c.title}</h1>
          <p>${CAT_LABELS[c.category] ?? c.category} · ${c.is_mandatory ? 'Mandatory' : 'Elective'} · ${fmtDuration(c.total_duration)}</p>
          ${c.description ? `<p style="margin-top:6px;color:#374151">${c.description}</p>` : ''}
          <hr />
          <p style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:12px">Course Outline</p>
          ${modules || '<p style="color:#9ca3af;font-size:12px">No modules defined.</p>'}
          <hr />
          <p style="font-size:11px;color:#9ca3af">Printed from GILE Portal · ${new Date().toLocaleDateString()}</p>
        </body></html>`);
      win.document.close();
      win.focus();
      win.print();
    });
  };

  const handleDownloadCertificate = () => {
    act(() => {
      const win = window.open('', '_blank', 'width=900,height=680');
      if (!win) return;
      const completionDate = enrollment.completion_date
        ? new Date(enrollment.completion_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const certRef = `CERT-${new Date(enrollment.completion_date ?? '').getFullYear() || new Date().getFullYear()}-${enrollment.id.toString().padStart(4, '0')}`;
      const org = orgName || 'GILE Foundation';
      win.document.write(`<!DOCTYPE html><html><head>
        <title>Certificate of Completion — ${c.title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', system-ui, sans-serif; background: #f9f7f4; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
          .cert { background: #fff; width: 820px; padding: 0; border-radius: 4px; box-shadow: 0 4px 40px rgba(0,0,0,0.12); overflow: hidden; position: relative; }
          .border-top { height: 8px; background: linear-gradient(90deg, #0f766e 0%, #14b8a6 50%, #0f766e 100%); }
          .inner { padding: 56px 64px 48px; border: 1.5px solid #e5e7eb; margin: 16px; border-radius: 2px; }
          .org-name { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; color: #0f766e; margin-bottom: 32px; }
          .heading { font-family: 'Playfair Display', Georgia, serif; font-size: 42px; font-weight: 700; color: #111827; line-height: 1.1; margin-bottom: 8px; }
          .sub { font-size: 13px; color: #6b7280; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 36px; }
          .divider { height: 1px; background: #e5e7eb; margin: 0 0 32px; }
          .presented { font-size: 13px; color: #6b7280; margin-bottom: 10px; }
          .member-name { font-family: 'Playfair Display', Georgia, serif; font-size: 34px; font-weight: 600; color: #111827; margin-bottom: 8px; border-bottom: 1.5px solid #d1fae5; padding-bottom: 10px; display: inline-block; }
          .completion-text { font-size: 13.5px; color: #374151; margin-top: 24px; line-height: 1.8; }
          .course-title { font-weight: 600; color: #111827; }
          .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
          .sig-block { text-align: center; }
          .sig-line { width: 160px; border-top: 1px solid #374151; margin-bottom: 6px; }
          .sig-label { font-size: 11px; color: #6b7280; letter-spacing: .05em; text-transform: uppercase; }
          .cert-meta { text-align: right; }
          .cert-ref { font-size: 10px; color: #9ca3af; font-family: monospace; letter-spacing: .05em; }
          .cert-date { font-size: 11px; color: #6b7280; margin-top: 4px; }
          .seal { width: 72px; height: 72px; border-radius: 50%; border: 3px solid #0f766e; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; }
          @media print {
            body { background: white; padding: 0; }
            .cert { box-shadow: none; }
            @page { size: landscape; margin: 0; }
          }
        </style>
      </head><body>
        <div class="cert">
          <div class="border-top"></div>
          <div class="inner">
            <p class="org-name">${org}</p>
            <h1 class="heading">Certificate</h1>
            <p class="sub">of Completion</p>
            <div class="divider"></div>
            <p class="presented">This certifies that</p>
            <p class="member-name">${memberDisplayName}</p>
            <p class="completion-text">
              has successfully completed the course<br/>
              <span class="course-title">${c.title}</span><br/>
              on ${completionDate}
              ${enrollment.score !== null ? `<br/><span style="color:#6b7280;font-size:12px">Final Score: ${enrollment.score}%</span>` : ''}
            </p>
            <div class="footer">
              <div class="sig-block">
                <div class="sig-line"></div>
                <p class="sig-label">Program Coordinator</p>
              </div>
              <div class="sig-block">
                <div class="seal">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0f766e" stroke-width="1.5">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <p class="sig-label">${org}</p>
              </div>
              <div class="cert-meta">
                <p class="cert-ref">${certRef}</p>
                <p class="cert-date">Issued: ${completionDate}</p>
              </div>
            </div>
          </div>
        </div>
        <script>window.onload = () => { window.print(); }<\/script>
      </body></html>`);
      win.document.close();
    });
  };

  const statusBadge = est === 'completed'
    ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-gray-200 bg-white text-gray-700">Completed</span>
    : est === 'in_progress'
    ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-gray-200 bg-white text-gray-600">In Progress</span>
    : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-gray-200 bg-white text-gray-500"><Clock size={10} />Not Started</span>;

  const actionLabel = est === 'completed' ? 'Review' : est === 'in_progress' ? 'Continue' : 'Start';

  return (
    <>
      <div
        className="flex items-start gap-4 px-5 py-3 border-b border-gray-100 hover:bg-gray-50/80 transition-colors cursor-pointer"
        onClick={onOpen}
      >
        {/* Thumbnail */}
        <div className="w-[60px] h-[60px] rounded-xl shrink-0 bg-gray-100 flex items-center justify-center">
          <BookOpen size={28} className="text-gray-400" />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[13.5px] font-bold text-gray-900">{c.title}</p>
            {c.is_mandatory && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-gray-100 text-gray-600 uppercase tracking-wide">Mandatory</span>
            )}
          </div>
          {c.description && (
            <p className="text-[12px] text-gray-400 mb-2 line-clamp-2 leading-relaxed">{c.description}</p>
          )}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[11.5px] text-gray-500 shrink-0">
              {enrollment.completed_lessons} of {totalLessons || '—'} lessons completed
            </span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${enrollment.progress_pct >= 100 ? 'bg-gray-500' : enrollment.progress_pct > 0 ? 'bg-gray-800' : 'bg-gray-200'}`}
                style={{ width: `${Math.max(enrollment.progress_pct, 0)}%` }}
              />
            </div>
            <span className="text-[11.5px] font-semibold text-gray-700 shrink-0">{enrollment.progress_pct}%</span>
          </div>
          <div className="flex items-center gap-3.5">
            {totalLessons > 0 && (
              <span className="flex items-center gap-1 text-[11.5px] text-gray-400">
                <Play size={11} className="text-gray-300" />{totalLessons} Lessons
              </span>
            )}
            {c.total_duration > 0 && (
              <span className="flex items-center gap-1 text-[11.5px] text-gray-400">
                <Clock size={11} className="text-gray-300" />{fmtDuration(c.total_duration)}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11.5px] text-gray-400">
              <TrendingUp size={11} className="text-gray-300" />{CAT_LABELS[c.category] ?? c.category}
            </span>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-2 pt-0.5">
          <div className="flex items-center gap-1.5">
            {statusBadge}
            <button ref={menuBtnRef} onClick={openMenu}
              className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <MoreVertical size={14} />
            </button>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onOpen(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition-colors"
          >
            {actionLabel} <ChevronRight size={13} />
          </button>
        </div>

        {/* Portal menu */}
        {menuOpen && createPortal(
          <div ref={menuRef} className="fixed z-[9999] bg-white rounded-xl border border-gray-200 shadow-xl py-1.5 w-[220px]"
            style={{ top: menuPos.top, left: menuPos.left }}>
            {/* Section 1: Course actions */}
            <p className="px-3.5 pt-1 pb-1 text-[9.5px] font-bold text-gray-400 uppercase tracking-widest">Course</p>
            <button onClick={() => act(onOpen)}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
              <BookOpen size={13} className="text-gray-400" /> View Details
            </button>
            <button onClick={() => act(handlePrintSyllabus)}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
              <Printer size={13} className="text-gray-400" /> Print Syllabus
            </button>
            <button onClick={handleCopyLink}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
              <Copy size={13} className="text-gray-400" /> Copy Link
            </button>

            <div className="my-1 border-t border-gray-100" />

            {/* Section 2: Progress */}
            <p className="px-3.5 pt-1 pb-1 text-[9.5px] font-bold text-gray-400 uppercase tracking-widest">Progress</p>
            <button onClick={() => act(() => setShowRating(true))}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
              <Star size={13} className="text-gray-400" /> Rate This Course
            </button>

            <div className="my-1 border-t border-gray-100" />

            {/* Section 3: Certificate */}
            <p className="px-3.5 pt-1 pb-1 text-[9.5px] font-bold text-gray-400 uppercase tracking-widest">Support</p>
            <button
              disabled={!enrollment.certificate_issued}
              onClick={() => handleDownloadCertificate()}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Award size={13} className={enrollment.certificate_issued ? 'text-gray-400' : 'text-gray-400'} />
              Download Certificate
            </button>
          </div>,
          document.body,
        )}
      </div>

      {/* Toast */}
      {toast && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-gray-900 text-white text-[12px] font-medium px-4 py-2.5 rounded-xl shadow-xl animate-fade-in">
          {toast}
        </div>,
        document.body,
      )}

      {/* Rate modal */}
      {showRating && (
        <RateCourseModal
          courseTitle={c.title}
          onClose={() => setShowRating(false)}
          onSubmit={(rating, comment) => {
            setShowRating(false);
            setToast(`Thanks! You rated "${c.title}" ${rating}/5 ★`);
            console.info('Course rating submitted', { courseId: c.id, rating, comment });
          }}
        />
      )}

    </>
  );
}

const LESSON_TYPE_LABEL: Record<string, string> = {
  video:         'Video',
  pdf:           'PDF',
  article:       'Article',
  quiz:          'Quiz',
  assignment:    'Assignment',
  external_link: 'Link',
  embed:         'Embed',
  assessment:    'Assessment',
};

function MemberCourseDetailPage({
  enrollment,
  onBack,
  onLessonComplete,
}: {
  enrollment: import('../api/orgApi').TrainingEnrollment;
  onBack: () => void;
  onLessonComplete: (updated: import('../api/orgApi').TrainingEnrollment) => void;
}) {
  const c = enrollment.course;
  const [completing, setCompleting]       = useState(false);
  const [collapsedModules, setCollapsedModules] = useState<Set<number>>(new Set());

  const allLessons = c.modules.flatMap(m => m.lessons);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(allLessons[0]?.id ?? null);

  // Quiz state
  const [quizAnswers,    setQuizAnswers]   = useState<Record<string, string>>({});
  const [quizFeedback,   setQuizFeedback]  = useState<import('../api/orgApi').QuizFeedback | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizScore,      setQuizScore]     = useState<number | null>(null);

  // Reset quiz state when lesson changes
  useEffect(() => {
    setQuizAnswers({});
    setQuizFeedback(null);
    setQuizScore(null);
  }, [selectedLessonId]);

  const selectedLesson = allLessons.find(l => l.id === selectedLessonId) ?? null;
  const currentIdx    = allLessons.findIndex(l => l.id === selectedLessonId);
  const prevLesson    = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson    = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  const completedIds = new Set(
    enrollment.lesson_progress.filter(lp => lp.completed).map(lp => lp.lesson_id),
  );
  const isDone = selectedLessonId ? completedIds.has(selectedLessonId) : false;

  const isQuizLesson = selectedLesson?.lesson_type === 'quiz' || selectedLesson?.lesson_type === 'assessment';

  const handleComplete = async () => {
    if (!selectedLessonId || completing) return;
    setCompleting(true);
    try {
      const updated = await trainingApi.completeLesson(enrollment.id, selectedLessonId);
      onLessonComplete(updated);
    } catch { /* ignore */ }
    finally { setCompleting(false); }
  };

  const handleQuizSubmit = async () => {
    if (!selectedLessonId || quizSubmitting) return;
    setQuizSubmitting(true);
    try {
      const result = await trainingApi.submitLesson(enrollment.id, selectedLessonId, { answers: quizAnswers });
      setQuizFeedback(result.feedback);
      setQuizScore(result.enrollment.score ?? null);
      onLessonComplete(result.enrollment);
    } catch { /* ignore */ }
    finally { setQuizSubmitting(false); }
  };

  const toggleModule = (modId: number) => {
    setCollapsedModules(prev => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId); else next.add(modId);
      return next;
    });
  };

  return (
    <div className="flex h-[calc(100vh-40px)] -m-6 overflow-hidden bg-gray-50 p-4 gap-4">

      {/* ── LEFT: Course nav panel ─────────────────────────────────── */}
      <div className="w-[240px] shrink-0 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-start mb-1">
            <p className="text-[13px] font-bold text-gray-900 leading-snug">{c.title}</p>
          </div>
          <p className="text-[11px] text-gray-400 mb-2">{enrollment.progress_pct}% complete</p>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-800 rounded-full transition-all" style={{ width: `${enrollment.progress_pct}%` }} />
          </div>
        </div>

        {/* Course Overview */}
        <button className="flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 shrink-0 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <BookOpen size={13} className="text-gray-500" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-gray-800">Course Overview</p>
            <p className="text-[10.5px] text-gray-400">Overview & objectives</p>
          </div>
        </button>

        {/* Scrollable module/lesson list */}
        <div className="flex-1 overflow-y-auto">
          {c.modules.map((mod, modIdx) => {
            const isCollapsed = collapsedModules.has(mod.id);
            return (
              <div key={mod.id}>
                <button
                  onClick={() => toggleModule(mod.id)}
                  className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.12em]">
                    Module {modIdx + 1}
                  </span>
                  {isCollapsed
                    ? <ChevronDown size={12} className="text-gray-400" />
                    : <ChevronUp   size={12} className="text-gray-400" />
                  }
                </button>

                {!isCollapsed && mod.lessons.map((lesson, lessonIdx) => {
                  const isSelected   = lesson.id === selectedLessonId;
                  const isDoneLesson = completedIds.has(lesson.id);
                  // flat lesson index across all modules
                  const flatIdx = allLessons.findIndex(l => l.id === lesson.id);
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => setSelectedLessonId(lesson.id)}
                      className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-left transition-colors ${
                        isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Radio circle */}
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'border-gray-700' : 'border-gray-300'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-gray-700" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-[11.5px] leading-snug ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                          {flatIdx + 1}. {lesson.title}
                        </p>
                        {lesson.duration_minutes > 0 && (
                          <p className="text-[10.5px] text-gray-400">{lesson.duration_minutes} min</p>
                        )}
                      </div>

                      {/* Status icon */}
                      {isDoneLesson ? (
                        <CheckCircle2 size={13} className="text-gray-500 shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {c.modules.length === 0 && (
            <p className="text-[11.5px] text-gray-400 text-center py-8 px-4">No content available yet.</p>
          )}
        </div>

        {/* Course Resources */}
        <div className="shrink-0 px-3 pb-1 border-t border-gray-100">
          <button className="flex items-center justify-center gap-2 w-full mt-2 px-4 py-2.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50 transition-colors border border-gray-200 rounded-lg">
            <FolderOpen size={13} className="text-gray-400" />
            Course Resources
          </button>
        </div>

        {/* Need Help? */}
        <div className="shrink-0 mx-3 mb-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
              <AlertCircle size={11} className="text-gray-500" />
            </div>
            <p className="text-[11px] font-bold text-gray-700">Need Help?</p>
          </div>
          <p className="text-[10.5px] text-gray-400 mb-2 leading-relaxed">Reach out to your buddy, manager or HR team.</p>
          <a href="mailto:support@gileorg.com"
            className="flex items-center gap-1 text-[11px] font-semibold text-gray-700 hover:text-gray-800 transition-colors">
            Contact Support <ChevronRight size={11} />
          </a>
        </div>
      </div>

      {/* ── RIGHT: Lesson content ──────────────────────────────────── */}
      <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden">
        {!selectedLesson ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <BookOpen size={32} className="text-gray-200 mb-3" />
            <p className="text-[13px] text-gray-400">No content available yet</p>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div className="flex items-center gap-3 px-5 py-2.5 bg-white border-b border-gray-200 shrink-0">
              <span className="px-2 py-0.5 text-[10.5px] font-bold text-gray-500 bg-gray-100 rounded-md uppercase tracking-wide shrink-0">
                {LESSON_TYPE_LABEL[selectedLesson.lesson_type] ?? selectedLesson.lesson_type}
              </span>
              <p className="text-[13.5px] font-semibold text-gray-900 flex-1 truncate">
                {currentIdx + 1}. {selectedLesson.title}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => prevLesson && setSelectedLessonId(prevLesson.id)}
                  disabled={!prevLesson}
                  className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={13} /> Previous
                </button>
                <button
                  onClick={() => nextLesson && setSelectedLessonId(nextLesson.id)}
                  disabled={!nextLesson}
                  className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight size={13} />
                </button>

                {/* Completion button inline in header */}
                {!isQuizLesson && (
                  isDone ? (
                    <button
                      onClick={async () => {
                        if (!selectedLessonId || completing) return;
                        setCompleting(true);
                        try { const u = await trainingApi.uncompleteLesson(enrollment.id, selectedLessonId); onLessonComplete(u); }
                        catch { /* ignore */ } finally { setCompleting(false); }
                      }}
                      disabled={completing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle2 size={13} /> {completing ? 'Saving…' : 'Completed'}
                    </button>
                  ) : (
                    <button
                      onClick={handleComplete}
                      disabled={completing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle2 size={13} /> {completing ? 'Saving…' : 'Mark Done'}
                    </button>
                  )
                )}

                <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                  <MoreVertical size={14} />
                </button>
                <div className="w-px h-5 bg-gray-200 mx-1 shrink-0" />
                <button
                  onClick={onBack}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-600 hover:border-red-200 transition-colors"
                >
                  <X size={13} /> Exit
                </button>
              </div>
            </div>

            {/* Split body: content left + sidebar right */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* ── LEFT: lesson content (scrollable) ───────────────── */}
              <div className="flex-1 min-w-0 overflow-y-auto p-5 space-y-4 bg-gray-50">

                {/* ── Quiz / Assessment ─────────────────────────────── */}
                {isQuizLesson ? (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {/* Quiz header */}
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-bold text-gray-900">
                        {selectedLesson.quiz_questions.length} Question{selectedLesson.quiz_questions.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-[11.5px] text-gray-400 mt-0.5">Pass score: {c.pass_score}%</p>
                    </div>
                    {quizScore !== null && (
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-semibold ${
                        isDone ? 'bg-gray-50 text-gray-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {isDone
                          ? <><CheckCircle2 size={14} /> Passed · {quizScore}%</>
                          : <><X size={14} /> {quizScore}% · Try again</>
                        }
                      </div>
                    )}
                  </div>

                  {/* Questions */}
                  <div className="divide-y divide-gray-100">
                    {selectedLesson.quiz_questions.length === 0 ? (
                      <p className="px-6 py-8 text-[12px] text-gray-400 text-center">No questions added yet.</p>
                    ) : (
                      selectedLesson.quiz_questions.map((q, qi) => {
                        const selectedOpt = quizAnswers[String(q.id)];
                        const fb          = quizFeedback?.[String(q.id)];
                        const isCorrect   = fb ? selectedOpt === fb.correct_option_id : null;
                        return (
                          <div key={q.id} className="px-6 py-5">
                            {/* Question text */}
                            <div className="flex items-start gap-2.5 mb-3">
                              <span className="shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-500 mt-0.5">
                                {qi + 1}
                              </span>
                              <p className="text-[13px] font-semibold text-gray-800 leading-snug flex-1">{q.text}</p>
                              {fb && (
                                <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  isCorrect ? 'bg-gray-50 text-gray-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {isCorrect ? `+${fb.earned}pts` : '0pts'}
                                </span>
                              )}
                            </div>

                            {/* Options (MCQ / True-False) */}
                            {q.question_type !== 'short_answer' && (
                              <div className="space-y-2 ml-8">
                                {q.options.map(opt => {
                                  const isSelected = selectedOpt === String(opt.id);
                                  const isThisCorrect = fb?.correct_option_id === String(opt.id);
                                  const wasWrong = fb && isSelected && !isThisCorrect;
                                  return (
                                    <label
                                      key={opt.id}
                                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                                        wasWrong        ? 'border-red-300 bg-gray-50' :
                                        isThisCorrect && fb ? 'border-gray-300 bg-gray-50' :
                                        isSelected      ? 'border-gray-800 bg-gray-50' :
                                        'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                      } ${isDone || quizFeedback ? 'pointer-events-none' : ''}`}
                                    >
                                      <input
                                        type="radio"
                                        name={`q-${q.id}`}
                                        value={String(opt.id)}
                                        checked={isSelected}
                                        onChange={() => setQuizAnswers(prev => ({ ...prev, [String(q.id)]: String(opt.id) }))}
                                        disabled={!!quizFeedback || isDone}
                                        className="accent-gray-800 shrink-0"
                                      />
                                      <span className={`text-[12.5px] flex-1 ${
                                        wasWrong     ? 'text-gray-700' :
                                        isThisCorrect && fb ? 'text-gray-700 font-semibold' :
                                        'text-gray-700'
                                      }`}>{opt.text}</span>
                                      {isThisCorrect && fb && <CheckCircle2 size={14} className="text-gray-500 shrink-0" />}
                                      {wasWrong          && <X size={14} className="text-gray-400 shrink-0" />}
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {/* Short answer */}
                            {q.question_type === 'short_answer' && (
                              <div className="ml-8">
                                <textarea
                                  rows={3}
                                  value={quizAnswers[String(q.id)] ?? ''}
                                  onChange={e => setQuizAnswers(prev => ({ ...prev, [String(q.id)]: e.target.value }))}
                                  disabled={!!quizFeedback || isDone}
                                  placeholder="Type your answer here…"
                                  className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:bg-gray-50 disabled:text-gray-500"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              ) : (
                /* ── Non-quiz content ────────────────────────────── */
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {(() => {
                    const lt  = selectedLesson.lesson_type;
                    const url = selectedLesson.content_url;
                    const fileUrl = selectedLesson.content_file_url;

                    /* ── helpers ── */
                    function getVideoEmbed(raw: string): { kind: 'youtube' | 'vimeo' | 'direct'; src: string } | null {
                      if (!raw) return null;
                      // YouTube
                      const yt = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
                      if (yt) return { kind: 'youtube', src: `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1` };
                      // Vimeo
                      const vm = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/);
                      if (vm) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${vm[1]}?dnt=1` };
                      // Direct video file
                      if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(raw)) return { kind: 'direct', src: raw };
                      return null;
                    }

                    /* ── VIDEO ── */
                    if (lt === 'video' && url) {
                      const embed = getVideoEmbed(url);
                      if (embed) {
                        return embed.kind === 'direct' ? (
                          <video controls className="w-full bg-black" style={{ maxHeight: '72vh' }}>
                            <source src={embed.src} />
                          </video>
                        ) : (
                          <div className="relative w-full bg-black" style={{ paddingTop: '56.25%' }}>
                            <iframe
                              src={embed.src}
                              title={selectedLesson.title}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="absolute inset-0 w-full h-full border-0"
                            />
                          </div>
                        );
                      }
                      // Unrecognised URL — fall through to open button
                    }

                    /* ── PDF ── */
                    if (lt === 'pdf' && (fileUrl || url)) {
                      const embedSrc = fileUrl
                        ? fileUrl
                        : `https://docs.google.com/viewer?url=${encodeURIComponent(url!)}&embedded=true`;
                      const openHref = fileUrl || url || '#';
                      return (
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                            <div className="flex items-center gap-2 text-[12px] font-medium text-gray-700">
                              <FileText size={13} className="text-gray-500" />
                              {selectedLesson.title}
                            </div>
                            <a href={openHref} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                              <ExternalLink size={11} /> Open in new tab
                            </a>
                          </div>
                          {fileUrl
                            ? <embed src={fileUrl} type="application/pdf" className="w-full border-0" style={{ height: '72vh' }} />
                            : <iframe src={embedSrc} title={selectedLesson.title} className="w-full border-0" style={{ height: '72vh' }} />
                          }
                        </div>
                      );
                    }

                    /* ── ARTICLE ── */
                    if (lt === 'article') {
                      const bodyHtml = (selectedLesson.content_data as Record<string, string>)?.body ?? '';
                      if (bodyHtml) return (
                        <div className="px-6 py-5 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: bodyHtml }} />
                      );
                    }

                    /* ── EMBED / SCORM ── */
                    if (lt === 'embed' && url) {
                      const isTag = url.trim().startsWith('<');
                      return isTag ? (
                        <div className="w-full" dangerouslySetInnerHTML={{ __html: url }} />
                      ) : (
                        <iframe src={url} title={selectedLesson.title} className="w-full border-0"
                          style={{ height: '72vh' }} />
                      );
                    }

                    /* ── EXTERNAL LINK ── */
                    if (lt === 'external_link' && url) {
                      return (
                        <div className="flex flex-col items-center justify-center py-16 bg-gray-50/60 gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                            <ExternalLink size={22} className="text-gray-400" />
                          </div>
                          <p className="text-[13px] font-semibold text-gray-700">External Resource</p>
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors">
                            <ExternalLink size={13} /> Open Link
                          </a>
                        </div>
                      );
                    }

                    /* ── FALLBACK placeholder ── */
                    return (
                      <div className="flex flex-col items-center justify-center py-20 bg-gray-50/60">
                        <div className="w-16 h-16 rounded-2xl bg-gray-200 flex items-center justify-center mb-4">
                          <span className="text-gray-400 [&>svg]:w-6 [&>svg]:h-6">{lessonIcon(lt)}</span>
                        </div>
                        <p className="text-[14px] font-semibold text-gray-700 mb-1">No content attached yet</p>
                        <p className="text-[12px] text-gray-400 max-w-xs text-center leading-relaxed">
                          {lt === 'video' && 'Add a YouTube, Vimeo, or direct video URL to this lesson.'}
                          {lt === 'pdf'   && 'Upload a PDF or add a PDF URL to this lesson.'}
                          {lt === 'article' && 'Add article content to this lesson.'}
                        </p>
                        {(url || fileUrl) && (
                          <a href={url || fileUrl || '#'} target="_blank" rel="noopener noreferrer"
                            className="mt-5 flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors">
                            <ExternalLink size={12} /> Open Content
                          </a>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              </div>{/* end left scroll */}

              {/* ── RIGHT: lesson sidebar ──────────────────────────── */}
              <div className="w-[280px] shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-y-auto">

                {/* Lesson meta */}
                <div className="px-5 pt-5 pb-4 border-b border-gray-100 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">
                      <span className="[&>svg]:w-[11px] [&>svg]:h-[11px]">{lessonIcon(selectedLesson.lesson_type)}</span>
                      {LESSON_TYPE_LABEL[selectedLesson.lesson_type] ?? selectedLesson.lesson_type}
                    </span>
                    {isDone && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-50 text-gray-700">
                        <CheckCircle2 size={10} /> Completed
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {selectedLesson.duration_minutes > 0 && (
                      <div className="flex items-center gap-2 text-[11.5px] text-gray-500">
                        <Clock size={12} className="text-gray-400 shrink-0" />
                        {selectedLesson.duration_minutes} min
                      </div>
                    )}
                    {selectedLesson.lesson_reference && (
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono">
                        <BookOpen size={12} className="text-gray-300 shrink-0" />
                        {selectedLesson.lesson_reference}
                      </div>
                    )}
                  </div>
                </div>

                {/* About */}
                {(selectedLesson.content_data as Record<string, string>)?.description && (
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">About</p>
                    <p className="text-[12px] text-gray-600 leading-relaxed">
                      {(selectedLesson.content_data as Record<string, string>).description}
                    </p>
                  </div>
                )}

                {/* Resources */}
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Resources</p>
                  {selectedLesson.content_file_url ? (
                    <a href={selectedLesson.content_file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors group">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                        <FileText size={13} className="text-gray-500" />
                      </div>
                      <span className="flex-1 text-[11.5px] font-medium text-gray-700 truncate min-w-0">{selectedLesson.title}</span>
                      <Download size={12} className="text-gray-400 shrink-0 group-hover:text-gray-700 transition-colors" />
                    </a>
                  ) : (
                    <p className="text-[11.5px] text-gray-400">No resources for this lesson.</p>
                  )}
                </div>

                {/* Spacer */}
                <div className="flex-1" />

              </div>{/* end sidebar */}
            </div>{/* end split body */}
          </>
        )}
      </div>
    </div>
  );
}

function MemberTrainingView() {
  const [enrollments, setEnrollments]     = useState<import('../api/orgApi').TrainingEnrollment[]>([]);
  const [loading, setLoading]             = useState(true);
  const [apiError, setApiError]           = useState<string | null>(null);
  const [tab, setTab]                     = useState<MemberTabKey>('all');
  const [search, setSearch]               = useState('');
  const [filterCat, setFilterCat]         = useState('');
  const [page, setPage]                   = useState(1);
  const [openEnrollment, setOpenEnrollment] = useState<import('../api/orgApi').TrainingEnrollment | null>(null);
  const [orgName, setOrgName]               = useState('');

  const loadData = () => {
    setLoading(true);
    setApiError(null);
    Promise.all([
      trainingApi.getMyTraining(),
      settingsApi.getSettings().catch(() => null),
    ])
      .then(([data, s]) => {
        setEnrollments(Array.isArray(data) ? data : []);
        if (s) setOrgName(s.org_name);
      })
      .catch(err => { setApiError(err?.message ?? 'Failed to load training data'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => { setPage(1); }, [tab, search, filterCat]);

  const updateEnrollment = (updated: import('../api/orgApi').TrainingEnrollment) => {
    setEnrollments(prev => prev.map(e => e.id === updated.id ? updated : e));
    setOpenEnrollment(updated);
  };

  // KPI stats
  const totalCourses  = enrollments.length;
  const inProgressCnt = enrollments.filter(e => enrollmentStatus(e) === 'in_progress').length;
  const completedCnt  = enrollments.filter(e => enrollmentStatus(e) === 'completed').length;

  // Filtered list
  const filtered = useMemo(() => {
    let list = [...enrollments];
    if (tab !== 'all') list = list.filter(e => enrollmentStatus(e) === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.course.title.toLowerCase().includes(q) ||
        e.course.description.toLowerCase().includes(q),
      );
    }
    if (filterCat) list = list.filter(e => e.course.category === filterCat);
    return list;
  }, [enrollments, tab, search, filterCat]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / MEMBER_PAGE_SIZE));
  const pageStart  = (page - 1) * MEMBER_PAGE_SIZE;
  const pageEnd    = pageStart + MEMBER_PAGE_SIZE;
  const paged      = filtered.slice(pageStart, pageEnd);

  // Sidebar: donut data
  const donutData = [
    { name: 'Completed',   value: completedCnt,                               color: '#111827' },
    { name: 'In Progress', value: inProgressCnt,                              color: '#6b7280' },
    { name: 'Not Started', value: Math.max(0, totalCourses - completedCnt - inProgressCnt), color: '#e5e7eb' },
  ].filter(d => d.value > 0);

  const overallPct = totalCourses > 0 ? Math.round(completedCnt / totalCourses * 100) : 0;

  // Upcoming deadlines: mandatory in-progress/not-started, oldest enrolled first
  const deadlines = useMemo(() =>
    enrollments
      .filter(e => e.course.is_mandatory && enrollmentStatus(e) !== 'completed')
      .sort((a, b) => new Date(a.enrolled_at).getTime() - new Date(b.enrolled_at).getTime())
      .slice(0, 4),
    [enrollments],
  );

  // Recommended: incomplete mandatory courses
  const recommended = useMemo(() =>
    enrollments
      .filter(e => enrollmentStatus(e) !== 'completed')
      .sort((a, b) => (b.course.is_mandatory ? 1 : 0) - (a.course.is_mandatory ? 1 : 0))
      .slice(0, 3),
    [enrollments],
  );

  const TABS: { key: MemberTabKey; label: string; count: number }[] = [
    { key: 'all',         label: 'All',         count: enrollments.length },
    { key: 'in_progress', label: 'In Progress',  count: inProgressCnt },
    { key: 'completed',   label: 'Completed',    count: completedCnt },
    { key: 'not_started', label: 'Not Started',  count: Math.max(0, totalCourses - completedCnt - inProgressCnt) },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-100 rounded-xl animate-pulse w-36" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
          <AlertCircle size={22} className="text-gray-400" />
        </div>
        <p className="text-[13px] font-semibold text-gray-700 mb-1">Failed to load training</p>
        <p className="text-[11.5px] text-gray-400 mb-4">{apiError}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 text-[12px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  if (openEnrollment) {
    return (
      <MemberCourseDetailPage
        enrollment={openEnrollment}
        onBack={() => setOpenEnrollment(null)}
        onLessonComplete={updateEnrollment}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-bold text-gray-900">Training</h1>
            <PageHelp title="How Training Works" sections={MEMBER_TRAINING_HELP} />
          </div>
          <p className="text-[12px] text-gray-500 mt-0.5">Your enrolled courses and learning progress</p>
        </div>
      </div>

      {/* Main content + right sidebar */}
      <div className="flex gap-4 min-h-0">
        {/* Left: course list */}
        <div className="flex-1 min-w-0 flex flex-col gap-0">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden shrink-0">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold transition-colors border-b-2 ${
                  tab === t.key
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                {t.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search + filter bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-x border-gray-200 shrink-0">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search courses…"
                className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
            <div className="relative">
              <select
                value={filterCat}
                onChange={e => setFilterCat(e.target.value)}
                className="pl-3 pr-7 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white appearance-none min-w-[130px]"
              >
                <option value="">All Categories</option>
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Course rows — fixed height = 5 × max row height so block never resizes */}
          <div className="bg-white border border-gray-200 border-t-0 min-h-[580px]">
            {paged.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <GraduationCap size={22} className="text-gray-400" />
                </div>
                <p className="text-[13px] font-semibold text-gray-700">No courses found</p>
                <p className="text-[11.5px] text-gray-400 mt-1">
                  {enrollments.length === 0
                    ? 'You have not been enrolled in any courses yet.'
                    : 'Try adjusting your filters.'}
                </p>
              </div>
            ) : (
              paged.map(e => (
                <MemberCourseRow
                  key={e.id}
                  enrollment={e}
                  orgName={orgName}
                  onOpen={() => setOpenEnrollment(e)}
                  onUpdate={updateEnrollment}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {filtered.length > MEMBER_PAGE_SIZE && (
            <div className="flex items-center justify-between bg-white border border-t-0 border-gray-200 rounded-b-xl px-4 py-2.5 shrink-0">
              <p className="text-[11.5px] text-gray-500">
                Showing {Math.min(pageStart + 1, filtered.length)}–{Math.min(pageEnd, filtered.length)} of {filtered.length} course{filtered.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2.5 py-1 text-[11.5px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 text-[11.5px] font-semibold rounded-lg ${page === p ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-2.5 py-1 text-[11.5px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-[264px] shrink-0 flex flex-col gap-3">
          {/* Learning Progress donut */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[12px] font-bold text-gray-800 mb-3">Learning Progress</p>
            {totalCourses > 0 ? (
              <>
                <div className="flex justify-center relative mb-3">
                  <PieChart width={130} height={110}>
                    <Pie data={donutData} cx={60} cy={50} innerRadius={32} outerRadius={48}
                      dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
                      {donutData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[18px] font-bold text-gray-900">{overallPct}%</p>
                    <p className="text-[9.5px] text-gray-400">Complete</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Completed',   value: completedCnt,   color: 'bg-gray-900' },
                    { label: 'In Progress', value: inProgressCnt,  color: 'bg-gray-500' },
                    { label: 'Not Started', value: Math.max(0, totalCourses - completedCnt - inProgressCnt), color: 'bg-gray-200' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${color}`} />
                        <span className="text-[11px] text-gray-500">{label}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-gray-700">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[11.5px] text-gray-400 text-center py-6">No courses enrolled yet.</p>
            )}
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[12px] font-bold text-gray-800 mb-3">Upcoming Deadlines</p>
            {deadlines.length === 0 ? (
              <p className="text-[11.5px] text-gray-400 text-center py-4">No pending mandatory courses.</p>
            ) : (
              <div className="space-y-2.5">
                {deadlines.map(e => (
                  <div key={e.id} className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${e.course.is_mandatory ? 'bg-gray-400' : 'bg-gray-400'}`} />
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-medium text-gray-700 truncate">{e.course.title}</p>
                      <p className="text-[10.5px] text-gray-400">Enrolled {timeAgo(e.enrolled_at)} · {e.progress_pct}% done</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommended for You */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[12px] font-bold text-gray-800 mb-3">Recommended for You</p>
            {recommended.length === 0 ? (
              <p className="text-[11.5px] text-gray-400 text-center py-4">All mandatory courses completed!</p>
            ) : (
              <div className="space-y-2.5">
                {recommended.map(e => (
                  <button
                    key={e.id}
                    onClick={() => setOpenEnrollment(e)}
                    className="w-full text-left flex items-center gap-2.5 group"
                  >
                    <div className={`w-8 h-8 rounded-lg shrink-0 ${CAT_BG[e.course.category] ?? 'bg-gray-400'} flex items-center justify-center`}>
                      <GraduationCap size={13} className="text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-medium text-gray-700 truncate group-hover:text-gray-900 transition-colors">{e.course.title}</p>
                      <p className="text-[10.5px] text-gray-400">{e.progress_pct}% complete</p>
                    </div>
                    <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Need Help? */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-4">
            <p className="text-[12px] font-bold text-gray-800 mb-1">Need Help?</p>
            <p className="text-[11px] text-gray-600 leading-relaxed mb-3">
              Contact your program coordinator if you have questions about required trainings or need an extension.
            </p>
            <a href="mailto:support@gileorg.com"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <BookOpen size={11} /> Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type TabKey = 'all' | 'mandatory' | 'elective' | 'by_dept' | 'by_cat';

export default function OrgTraining() {
  const { isSuperadmin, orgMember, isLoading: orgLoading } = useOrg();
  const canManage = isSuperadmin || !!orgMember?.role.can_manage_members;

  const [courses, setCourses]         = useState<TrainingCourse[]>([]);
  const [members, setMembers]         = useState<OrgMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<TabKey>('all');
  const [search, setSearch]           = useState('');
  const [filterCat, setFilterCat]     = useState('');
  const [filterDept, setFilterDept]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage]               = useState(1);
  const [creating, setCreating]       = useState(false);
  const [editing, setEditing]         = useState<TrainingCourse | null>(null);
  const [managing, setManaging]       = useState<TrainingCourse | null>(null);
  const [enrolling, setEnrolling]     = useState<TrainingCourse | null>(null);
  const [deleting, setDeleting]       = useState<TrainingCourse | null>(null);
  const [bulkEnrolling, setBulkEnrolling]       = useState(false);
  const [progressReport, setProgressReport]     = useState(false);
  const [trainingSettings, setTrainingSettings] = useState(false);

  useEffect(() => {
    Promise.all([
      trainingApi.getCourses(),
      orgApi.getMembers(),
      orgApi.getDepartments(),
    ]).then(([c, m, d]) => {
      setCourses(c);
      setMembers(m);
      setDepartments(d);
    }).finally(() => setLoading(false));
  }, []);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [tab, search, filterCat, filterDept, filterStatus]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await trainingApi.deleteCourse(deleting.id);
      setCourses(cs => cs.filter(c => c.id !== deleting.id));
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  };

  const handleToggle = async (course: TrainingCourse) => {
    try {
      const updated = await trainingApi.toggleCourse(course.id, !course.is_active);
      setCourses(cs => cs.map(c => c.id === updated.id ? { ...c, is_active: updated.is_active } : c));
    } catch { /* ignore */ }
  };

  const exportData = () => {
    const headers = ['ID', 'Title', 'Category', 'Type', 'Department', 'Status', 'Enrolled', 'Completion %', 'Duration (min)', 'Pass Score', 'Created'];
    const rows = courses.map(c => [
      c.id,
      `"${c.title.replace(/"/g, '""')}"`,
      CAT_LABELS[c.category] ?? c.category,
      c.is_mandatory ? 'Mandatory' : 'Elective',
      c.department_name ?? '',
      c.is_active ? 'Active' : 'Inactive',
      c.enrolled_count,
      c.completion_pct,
      c.total_duration,
      c.pass_score,
      new Date(c.created_at).toLocaleDateString(),
    ].join(','));
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `training-courses-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total         = courses.length;
    const active        = courses.filter(c => c.is_active).length;
    const totalEnrolled = courses.reduce((s, c) => s + c.enrolled_count, 0);
    const totalCompleted = courses.reduce((s, c) => s + Math.round(c.enrolled_count * c.completion_pct / 100), 0);
    const avgCompletion = total > 0 ? Math.round(courses.reduce((s, c) => s + c.completion_pct, 0) / total) : 0;
    return { total, active, totalEnrolled, totalCompleted, avgCompletion };
  }, [courses]);

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return courses.filter(c => {
      if (tab === 'mandatory' && !c.is_mandatory) return false;
      if (tab === 'elective'  && c.is_mandatory)  return false;
      if (search && !c.title.toLowerCase().includes(search.toLowerCase()) &&
          !c.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCat  && c.category     !== filterCat)  return false;
      if (filterDept && c.department_name !== filterDept) return false;
      if (filterStatus === 'active'   && !c.is_active)  return false;
      if (filterStatus === 'inactive' && c.is_active)   return false;
      return true;
    });
  }, [courses, tab, search, filterCat, filterDept, filterStatus]);

  // ── Grouping for by_dept / by_cat ──────────────────────────────────────────

  type GroupedRow = { type: 'header'; label: string } | { type: 'row'; course: TrainingCourse };

  const rows = useMemo((): GroupedRow[] => {
    if (tab === 'by_dept') {
      const groups: Record<string, TrainingCourse[]> = {};
      filtered.forEach(c => {
        const key = c.department_name ?? 'No Department';
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
      });
      return Object.entries(groups).flatMap(([label, cs]) => [
        { type: 'header' as const, label },
        ...cs.map(course => ({ type: 'row' as const, course })),
      ]);
    }
    if (tab === 'by_cat') {
      const groups: Record<string, TrainingCourse[]> = {};
      filtered.forEach(c => {
        const key = CAT_LABELS[c.category] ?? c.category;
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
      });
      return Object.entries(groups).flatMap(([label, cs]) => [
        { type: 'header' as const, label },
        ...cs.map(course => ({ type: 'row' as const, course })),
      ]);
    }
    return filtered.map(c => ({ type: 'row' as const, course: c }));
  }, [filtered, tab]);

  // Paginate only data rows
  const dataRows     = rows.filter(r => r.type === 'row');
  const totalPages   = Math.max(1, Math.ceil(dataRows.length / PAGE_SIZE));
  const pageStart    = (page - 1) * PAGE_SIZE;
  const pageEnd      = pageStart + PAGE_SIZE;
  // For grouped view: track which data-row indices are in page range, then include adjacent headers
  const pagedRows = useMemo(() => {
    if (tab !== 'by_dept' && tab !== 'by_cat') {
      return rows.slice(pageStart, pageEnd);
    }
    let dataIdx = 0;
    const result: GroupedRow[] = [];
    for (const row of rows) {
      if (row.type === 'header') {
        result.push(row);
      } else {
        if (dataIdx >= pageStart && dataIdx < pageEnd) result.push(row);
        dataIdx++;
      }
    }
    // Remove trailing/leading orphan headers
    return result.filter((r, i, arr) => {
      if (r.type === 'row') return true;
      const next = arr[i + 1];
      return next && next.type === 'row';
    });
  }, [rows, pageStart, pageEnd, tab]);

  // ── Trend chart data (mock from current stats) ─────────────────────────────

  const trendData = useMemo(() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const factor = (i + 2) / 7;
      return {
        month: months[d.getMonth()],
        enrolled:  Math.round(stats.totalEnrolled * factor),
        completed: Math.round(stats.totalCompleted * factor),
      };
    });
  }, [stats]);

  // ── Recent Activities from courses ordered by created_at ──────────────────

  const recentActivities = useMemo(() =>
    [...courses]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6)
      .map(c => ({ title: `Course added: ${c.title}`, sub: timeAgo(c.created_at), cat: c.category })),
    [courses],
  );

  // ── Tabs ───────────────────────────────────────────────────────────────────

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: 'all',      label: 'All Trainings',  count: courses.length },
    { key: 'mandatory',label: 'Mandatory',       count: courses.filter(c => c.is_mandatory).length },
    { key: 'elective', label: 'Elective',        count: courses.filter(c => !c.is_mandatory).length },
    { key: 'by_dept',  label: 'By Department' },
    { key: 'by_cat',   label: 'By Category' },
  ];

  const deptOptions = [...new Set(courses.map(c => c.department_name).filter(Boolean))] as string[];

  if (orgLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-100 rounded-xl animate-pulse w-48" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!canManage) return <MemberTrainingView />;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-100 rounded-xl animate-pulse w-48" />
        <div className="grid grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (managing) {
    return (
      <div className="flex flex-col gap-0 h-full">
        <CourseDrawer
          asPage
          course={managing}
          onClose={() => setManaging(null)}
          onUpdated={updated => {
            setCourses(cs => cs.map(c => c.id === updated.id ? updated : c));
            setManaging(updated);
          }}
          onDeleted={() => {
            setCourses(cs => cs.filter(c => c.id !== managing.id));
            setManaging(null);
          }}
          members={members}
          departments={departments}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-bold text-gray-900 leading-tight">Training Management</h1>
            <PageHelp title="How Training Works" sections={TRAINING_HELP} />
          </div>
          <p className="text-[12px] text-gray-500 mt-0.5">Create and manage training courses for your team</p>
        </div>
        {canManage && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shrink-0">
            <Plus size={13} /> New Course
          </button>
        )}
      </div>

      {/* Main content + right sidebar */}
      <div className="flex gap-4 min-h-0">
        {/* Left: table area */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Filter bar */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses…"
                className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" />
            </div>
            {[
              {
                value: filterCat, setter: setFilterCat, placeholder: 'All Categories',
                options: CATEGORY_OPTIONS.map(o => ({ value: o.value, label: o.label })),
              },
              {
                value: filterDept, setter: setFilterDept, placeholder: 'All Departments',
                options: deptOptions.map(d => ({ value: d, label: d })),
              },
              {
                value: filterStatus, setter: setFilterStatus, placeholder: 'All Status',
                options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
              },
            ].map((f, i) => (
              <div key={i} className="relative">
                <select value={f.value} onChange={e => f.setter(e.target.value)}
                  className="pl-3 pr-7 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white appearance-none min-w-[120px]">
                  <option value="">{f.placeholder}</option>
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[2fr_1fr_80px_70px_80px_90px_90px_44px] gap-0 px-4 py-2 bg-gray-50 border-b border-gray-200">
              {['Training Name', 'Category', 'Type', 'Duration', 'Enrolled', 'Completion', 'Updated', ''].map(h => (
                <p key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</p>
              ))}
            </div>

            {/* Rows — fixed height so card never resizes */}
            <div className="divide-y divide-gray-100 h-[352px] overflow-hidden">
              {pagedRows.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                    <GraduationCap size={22} className="text-gray-400" />
                  </div>
                  <p className="text-[13px] font-semibold text-gray-700">No courses found</p>
                  <p className="text-[11.5px] text-gray-400 mt-1">Try adjusting your filters.</p>
                </div>
              ) : (
                pagedRows.map((row, idx) => {
                  if (row.type === 'header') {
                    return (
                      <div key={`h-${row.label}-${idx}`} className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{row.label}</p>
                      </div>
                    );
                  }
                  const c = row.course;
                  return (
                    <div key={c.id} onClick={() => setManaging(c)} className="grid grid-cols-[2fr_1fr_80px_70px_80px_90px_90px_44px] gap-0 px-4 py-2 hover:bg-gray-50 transition-colors cursor-pointer">
                      {/* Name + description */}
                      <div className="flex flex-col justify-center min-w-0 pr-2">
                        <p className="text-[12.5px] font-semibold text-gray-800 truncate">{c.title}</p>
                        {c.description && (
                          <p className="text-[11px] text-gray-400 truncate mt-0.5">{c.description}</p>
                        )}
                      </div>
                      {/* Category */}
                      <div className="flex items-center">
                        <span className={`text-[11.5px] font-medium ${CAT_COLORS[c.category] ?? 'text-gray-500'}`}>
                          {CAT_LABELS[c.category] ?? c.category}
                        </span>
                      </div>
                      {/* Type */}
                      <div className="flex items-center">
                        <span className={`text-[11.5px] font-medium ${c.is_mandatory ? 'text-gray-600' : 'text-gray-600'}`}>
                          {c.is_mandatory ? 'Mandatory' : 'Elective'}
                        </span>
                      </div>
                      {/* Duration */}
                      <div className="flex items-center">
                        <span className="text-[11.5px] text-gray-600">{fmtDuration(c.total_duration)}</span>
                      </div>
                      {/* Enrolled */}
                      <div className="flex items-center gap-1">
                        <Users size={10} className="text-gray-400 shrink-0" />
                        <span className="text-[11.5px] text-gray-600">{c.enrolled_count}</span>
                      </div>
                      {/* Completion Rate */}
                      <div className="flex flex-col justify-center gap-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] text-gray-500">{c.completion_pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
                          <div className={`h-full rounded-full ${c.completion_pct >= 70 ? 'bg-gray-500' : c.completion_pct >= 40 ? 'bg-gray-500' : 'bg-gray-300'}`}
                            style={{ width: `${c.completion_pct}%` }} />
                        </div>
                      </div>
                      {/* Status + Updated */}
                      <div className="flex flex-col justify-center">
                        <span className={`text-[11.5px] font-medium ${c.is_active ? 'text-gray-700' : 'text-gray-400'}`}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-[10.5px] text-gray-400">{timeAgo(c.created_at)}</span>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center justify-end" onClick={e => e.stopPropagation()}>
                        <CourseRowMenu
                          course={c}
                          canManage={canManage}
                          onEdit={() => setEditing(c)}
                          onManage={() => setManaging(c)}
                          onEnroll={() => setEnrolling(c)}
                          onToggle={() => handleToggle(c)}
                          onDelete={() => setDeleting(c)}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pagination */}
          {dataRows.length > 0 && (
            <div className="flex items-center justify-between shrink-0 px-1">
              <p className="text-[11.5px] text-gray-500">
                Showing {Math.min(pageStart + 1, dataRows.length)}–{Math.min(pageEnd, dataRows.length)} of {dataRows.length} course{dataRows.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2.5 py-1 text-[11.5px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 text-[11.5px] font-semibold rounded-lg ${page === p ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-2.5 py-1 text-[11.5px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Bottom: Trend chart + Recent Activities */}
          <div className="grid grid-cols-[1fr_280px] gap-4 shrink-0 mt-1">
            {/* Line chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[12px] font-bold text-gray-700">Training Progress Trend</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-500" /><span className="text-[10.5px] text-gray-500">Enrolled</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-400" /><span className="text-[10.5px] text-gray-500">Completed</span></div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <ReTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Line type="monotone" dataKey="enrolled"  stroke="#14b8a6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="completed" stroke="#60a5fa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Recent Activities */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-[12px] font-bold text-gray-700 mb-3">Recent Activities</p>
              {recentActivities.length > 0 ? (
                <div className="space-y-2">
                  {recentActivities.map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${CAT_DOT[a.cat] ?? 'bg-gray-400'}`} />
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-medium text-gray-700 truncate">{a.title}</p>
                        <p className="text-[10.5px] text-gray-400">{a.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11.5px] text-gray-400 text-center py-4">No recent activity</p>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <RightSidebar
          courses={courses}
          totalEnrolled={stats.totalEnrolled}
          totalCompleted={stats.totalCompleted}
          canManage={canManage}
          onNewCourse={() => setCreating(true)}
          onBulkEnroll={() => setBulkEnrolling(true)}
          onProgressReport={() => setProgressReport(true)}
          onExportData={exportData}
          onTrainingSettings={() => setTrainingSettings(true)}
        />
      </div>

      {/* Modals */}
      {(creating || editing) && (
        <CourseModal
          course={editing ?? undefined}
          departments={departments}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={saved => {
            setCourses(cs => editing
              ? cs.map(c => c.id === saved.id ? { ...saved, modules: c.modules } : c)
              : [...cs, { ...saved, modules: [] }]
            );
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {enrolling && (
        <EnrollModal
          course={enrolling}
          members={members}
          departments={departments}
          onClose={() => setEnrolling(null)}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h2 className="text-[14px] font-bold text-gray-900 mb-2">Delete Course?</h2>
            <p className="text-[12.5px] text-gray-500 mb-5">Delete <span className="font-semibold text-gray-700">"{deleting.title}"</span>? All enrollments and progress will be lost.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-50 rounded-xl">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 text-[12.5px] font-semibold text-white bg-gray-500 hover:bg-gray-700 rounded-xl">Delete</button>
            </div>
          </div>
        </div>
      )}

      {bulkEnrolling && (
        <BulkEnrollModal
          courses={courses}
          members={members}
          departments={departments}
          onClose={() => setBulkEnrolling(false)}
        />
      )}

      {progressReport && (
        <ProgressReportModal
          courses={courses}
          onClose={() => setProgressReport(false)}
        />
      )}

      {trainingSettings && (
        <TrainingSettingsModal
          onClose={() => setTrainingSettings(false)}
        />
      )}
    </div>
  );
}
