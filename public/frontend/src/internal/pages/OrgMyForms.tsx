import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, CheckCircle2, Star,
  ClipboardList, FileText, Calendar, Tag, AlignJustify,
  ArrowRight, Search, SlidersHorizontal, Shield, Bell,
} from 'lucide-react';
import {
  formsApi,
  type MyForm, type StandaloneFormField, type StandaloneFormFieldType,
} from '../api/orgApi';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

const FORMS_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What are Forms?',
    bullets: [
      '**Forms** are surveys, questionnaires, and intake forms assigned to you by your admin.',
      'Common examples: attendance sheets, feedback surveys, policy acknowledgements, and check-ins.',
    ],
  },
  {
    eyebrow: '2 · Filling Out a Form',
    bullets: [
      'Click **Fill Out Form** on any pending form to open it.',
      'Answer each required field — text, multiple choice, date, or file upload.',
      'Click **Submit** to send your response. You cannot edit a form after submission.',
    ],
  },
  {
    eyebrow: '3 · Deadlines',
    bullets: [
      'Forms with a **Due date** show a countdown badge — complete them before the deadline.',
      'Overdue forms are highlighted in red in the **Pending** tab.',
    ],
  },
  {
    eyebrow: '4 · Status',
    bullets: [
      '**Pending** — assigned to you, not yet submitted.',
      '**Submitted** — your response has been recorded.',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'Use the **Search** bar and **Filters** to quickly find a specific form, especially when you have many assigned.',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isPast(iso: string | null) {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

function fmtDeadlineDate(iso: string) {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day:   d.getDate(),
  };
}

function dueInDays(iso: string) {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0)  return 'Overdue';
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `Due in ${diff} days`;
}

function cap(s: string) {
  if (!s) return 'General';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formIcon(form: MyForm) {
  if (form.form_type === 'survey') return <FileText size={17} className="text-gray-600" />;
  return <ClipboardList size={17} className="text-gray-600" />;
}

// ── Poll results bar ──────────────────────────────────────────────────────────

function PollBar({ counts, options, total }: { counts: Record<string, number>; options: string[]; total: number }) {
  const keys = options.length ? options : Object.keys(counts);
  if (!keys.length) return null;
  return (
    <div className="space-y-1.5 mt-2">
      {keys.map(k => {
        const count = counts[k] ?? 0;
        const p = total ? Math.round((count / total) * 100) : 0;
        return (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="w-28 truncate text-gray-600 shrink-0">{k}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2">
              <div className="bg-gray-800 h-2 rounded-full" style={{ width: `${p}%` }} />
            </div>
            <span className="text-gray-400 w-10 text-right">{p}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Form Fill Modal ───────────────────────────────────────────────────────────

function FormFillModal({
  form,
  onClose,
  onSubmitted,
}: {
  form: MyForm;
  onClose: () => void;
  onSubmitted: (updated: MyForm) => void;
}) {
  const [answers, setAnswers]     = useState<Record<string, string>>(form.my_answers ?? {});
  const [fileInputs, setFileInputs] = useState<Record<string, File>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [submitted, setSubmitted] = useState(form.submitted);
  const [result, setResult]       = useState<MyForm | null>(form.submitted ? form : null);

  const requiredFields = form.fields.filter(f => f.required);
  const answeredRequired = requiredFields.filter(f => {
    const a = answers[String(f.id)];
    return a && a.trim() !== '';
  }).length;
  const progress = requiredFields.length ? Math.round((answeredRequired / requiredFields.length) * 100) : 100;
  const canSubmit = answeredRequired === requiredFields.length;

  function setAnswer(fieldId: number, value: string) {
    setAnswers(prev => ({ ...prev, [String(fieldId)]: value }));
  }

  function toggleMultiselect(fieldId: number, option: string) {
    const current = answers[String(fieldId)] ?? '';
    const parts = current ? current.split(',').map(s => s.trim()).filter(Boolean) : [];
    const idx = parts.indexOf(option);
    if (idx >= 0) parts.splice(idx, 1);
    else parts.push(option);
    setAnswer(fieldId, parts.join(', '));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const responses = form.fields.map(f => ({
        field_id: f.id,
        answer:   answers[String(f.id)] ?? '',
      }));
      let updated: MyForm;
      if (Object.keys(fileInputs).length > 0) {
        const fd = new FormData();
        fd.append('responses', JSON.stringify(responses));
        Object.entries(fileInputs).forEach(([fieldId, file]) => fd.append(`file_${fieldId}`, file));
        updated = await formsApi.submitFormWithFiles(form.id, fd);
      } else {
        updated = await formsApi.submitForm(form.id, responses);
      }
      setSubmitted(true);
      setResult(updated);
      onSubmitted(updated);
    } catch {
      setError('Failed to submit form. Please try again.');
    } finally { setSubmitting(false); }
  }

  function renderField(field: StandaloneFormField) {
    const val = answers[String(field.id)] ?? '';

    switch (field.field_type) {
      case 'text':
        return (
          <input type="text"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            value={val} onChange={e => setAnswer(field.id, e.target.value)} disabled={submitted} />
        );
      case 'textarea':
        return (
          <textarea rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none"
            value={val} onChange={e => setAnswer(field.id, e.target.value)} disabled={submitted} />
        );
      case 'choice':
        return (
          <div className="space-y-1.5">
            {field.options.map(opt => (
              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name={`field_${field.id}`} value={opt} checked={val === opt}
                  onChange={() => setAnswer(field.id, opt)} disabled={submitted} />
                {opt}
              </label>
            ))}
          </div>
        );
      case 'multiselect': {
        const selected = val ? val.split(',').map(s => s.trim()) : [];
        return (
          <div className="space-y-1.5">
            {field.options.map(opt => (
              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={selected.includes(opt)}
                  onChange={() => toggleMultiselect(field.id, opt)} disabled={submitted} />
                {opt}
              </label>
            ))}
          </div>
        );
      }
      case 'boolean':
        return (
          <div className="flex gap-4">
            {['Yes', 'No'].map(opt => (
              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name={`field_${field.id}`} value={opt} checked={val === opt}
                  onChange={() => setAnswer(field.id, opt)} disabled={submitted} />
                {opt}
              </label>
            ))}
          </div>
        );
      case 'date':
        return (
          <input type="date"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            value={val} onChange={e => setAnswer(field.id, e.target.value)} disabled={submitted} />
        );
      case 'number':
        return (
          <input type="number"
            className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            value={val} onChange={e => setAnswer(field.id, e.target.value)} disabled={submitted} />
        );
      case 'rating': {
        const max     = field.rating_max ?? 5;
        const current = Number(val) || 0;
        return (
          <div className="flex gap-1">
            {[...Array(max)].map((_, i) => {
              const n = i + 1;
              return (
                <button key={n} type="button"
                  onClick={() => !submitted && setAnswer(field.id, String(n))}
                  className={`w-8 h-8 rounded text-sm font-medium border transition-colors ${
                    n <= current ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-400 hover:border-gray-400'
                  } ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        );
      }
      case 'file': {
        const existingUrl = val && (val.startsWith('/') || val.startsWith('http')) ? val : null;
        const selectedName = fileInputs[String(field.id)]?.name;
        return (
          <div className="space-y-2">
            {existingUrl && (
              <a href={existingUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                <span>📎</span>
                <span className="truncate max-w-[280px]">{existingUrl.split('/').pop()}</span>
                <span className="text-gray-400 shrink-0">— view uploaded file</span>
              </a>
            )}
            {!submitted && (
              <input type="file"
                className="text-sm text-gray-600 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:rounded file:text-xs file:text-gray-600 file:bg-gray-50 hover:file:bg-gray-100"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFileInputs(prev => ({ ...prev, [String(field.id)]: file }));
                    setAnswer(field.id, file.name);
                  }
                }}
              />
            )}
            {selectedName && <p className="text-[11px] text-gray-500">Selected: {selectedName}</p>}
          </div>
        );
      }
      default:
        return null;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-8 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 mb-12">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-gray-800 text-lg">{form.title}</h2>
              {form.description && <p className="text-sm text-gray-500 mt-0.5">{form.description}</p>}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4 shrink-0"><X size={18} /></button>
          </div>
          {!submitted && requiredFields.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Required fields</span><span>{answeredRequired} / {requiredFields.length}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full">
                <div className="h-1.5 bg-gray-900 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 space-y-6">
          {submitted && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <CheckCircle2 size={16} /> You have already submitted this form.
            </div>
          )}
          {form.fields.map((field, i) => (
            <div key={field.id} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {i + 1}. {field.question}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              {renderField(field)}
              {submitted && result?.poll_results?.[String(field.id)] && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1 font-medium">Poll results</p>
                  <PollBar
                    counts={result.poll_results[String(field.id)]}
                    options={field.options}
                    total={Object.values(result.poll_results[String(field.id)]).reduce((a, b) => a + b, 0)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {!submitted ? (
          <div className="flex items-center justify-between p-5 border-t border-gray-100">
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="ml-auto">
              <button onClick={handleSubmit} disabled={!canSubmit || submitting}
                className="bg-gray-900 text-white text-sm px-5 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? 'Submitting…' : 'Submit Form'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end p-5 border-t border-gray-100">
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Form row — Pending ────────────────────────────────────────────────────────

function PendingFormRow({ form, onFill }: { form: MyForm; onFill: () => void }) {
  const overdue = isPast(form.due_date);
  return (
    <div onClick={onFill} className="flex items-start gap-4 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors cursor-pointer">
      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        {formIcon(form)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-gray-900 truncate">{form.title}</p>
            {form.description && (
              <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-1">{form.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <AlignJustify size={10} />
                {form.fields.length} of {form.fields.length} questions
              </span>
              {form.due_date && (
                <span className={`flex items-center gap-1 text-[11px] font-medium ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
                  <Calendar size={10} />
                  Due {fmtDate(form.due_date)}
                </span>
              )}
              {form.category && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Tag size={10} /> {cap(form.category)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
              overdue ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
            }`}>
              {overdue ? 'Overdue' : 'Pending'}
            </span>
            <button
              onClick={e => { e.stopPropagation(); onFill(); }}
              className="flex items-center gap-1.5 bg-gray-900 text-white text-[12.5px] font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
            >
              Fill Out Form <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Form row — Submitted ──────────────────────────────────────────────────────

function SubmittedFormRow({ form, onView }: { form: MyForm; onView: () => void }) {
  const isApproved = form.status === 'closed';
  return (
    <div onClick={onView} className="flex items-start gap-4 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors cursor-pointer">
      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        {formIcon(form)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-gray-900 truncate">{form.title}</p>
            {form.description && (
              <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-1">{form.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {form.submitted_at && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Calendar size={10} />
                  Submitted on {fmtDate(form.submitted_at)}
                </span>
              )}
              {form.category && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Tag size={10} /> {cap(form.category)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
              isApproved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {isApproved ? 'Approved' : 'Submitted'}
            </span>
            <button
              onClick={e => { e.stopPropagation(); onView(); }}
              className="border border-gray-200 text-gray-700 hover:bg-gray-50 text-[12.5px] font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type TabFilter = 'pending' | 'submitted' | 'all';

const PAGE_SIZE = 7;

export default function OrgMyForms() {
  const [forms, setForms]           = useState<MyForm[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<TabFilter>('all');
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [filling, setFilling]       = useState<MyForm | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType]         = useState<'all' | 'survey' | 'form'>('all');
  const [filterOverdue, setFilterOverdue]   = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    formsApi.getMyForms()
      .then(setForms)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(1); }, [tab, search, filterCategory, filterType, filterOverdue]);

  // ── Computed ────────────────────────────────────────────────────────────────

  const pending   = useMemo(() => forms.filter(f => !f.submitted), [forms]);
  const submitted = useMemo(() => forms.filter(f => f.submitted),  [forms]);
  const approved  = useMemo(() => forms.filter(f => f.submitted && f.status === 'closed'), [forms]);

  const kpis = [
    { label: 'TOTAL FORMS', value: forms.length,     sub: 'All time' },
    { label: 'PENDING',     value: pending.length,   sub: 'Awaiting your response' },
    { label: 'SUBMITTED',   value: submitted.length, sub: 'Completed by you' },
    { label: 'APPROVED',    value: approved.length,  sub: 'Reviewed & approved' },
  ];

  const baseList = tab === 'pending' ? pending : tab === 'submitted' ? submitted : forms;
  const searchFiltered = useMemo(() => {
    let list = baseList;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(f =>
        f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
      );
    }
    if (filterCategory !== 'all') {
      list = list.filter(f => cap(f.category || 'General') === filterCategory);
    }
    if (filterType !== 'all') {
      list = list.filter(f =>
        filterType === 'survey' ? f.form_type === 'survey' : f.form_type !== 'survey'
      );
    }
    if (filterOverdue) {
      list = list.filter(f => !f.submitted && isPast(f.due_date));
    }
    return list;
  }, [baseList, search, filterCategory, filterType, filterOverdue]);

  // In "All" tab: pending first, then submitted
  const sortedList = useMemo(() => {
    if (tab !== 'all') return searchFiltered;
    return [...searchFiltered].sort((a, b) => {
      if (!a.submitted && b.submitted) return -1;
      if (a.submitted && !b.submitted) return 1;
      return 0;
    });
  }, [searchFiltered, tab]);

  const totalPages = Math.max(1, Math.ceil(sortedList.length / PAGE_SIZE));
  const pagedForms = sortedList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Active filter count for badge
  const activeFilterCount =
    (filterCategory !== 'all' ? 1 : 0) +
    (filterType !== 'all' ? 1 : 0) +
    (filterOverdue ? 1 : 0);

  // Sidebar — categories
  const categories = useMemo(() => {
    const map: Record<string, number> = {};
    forms.forEach(f => {
      const cat = cap(f.category || 'General');
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [forms]);

  // Sidebar — upcoming deadlines (pending with due_date, soonest first)
  const upcomingDeadlines = useMemo(() =>
    pending
      .filter(f => f.due_date)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 3),
    [pending]
  );

  // Pagination helper
  function pageNumbers(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, '…', totalPages];
    if (page >= totalPages - 3) return [1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '…', page - 1, page, page + 1, '…', totalPages];
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-6 bg-gray-100 rounded-xl animate-pulse w-32" />
        <div className="grid grid-cols-[1fr_280px] gap-5">
          <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
          <div className="space-y-4">
            <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── JSX ───────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Form fill / view modal */}
      {filling && (
        <FormFillModal
          form={filling}
          onClose={() => setFilling(null)}
          onSubmitted={updated => {
            setForms(prev => prev.map(f => f.id === updated.id ? updated : f));
            setFilling(null);
          }}
        />
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-[16px] font-bold text-gray-900">Forms</h1>
          <PageHelp title="How Forms Work" sections={FORMS_HELP} />
        </div>
        <p className="text-[12px] text-gray-500 mt-0.5">Forms and surveys assigned to you</p>
      </div>

      {/* Main 2-col */}
      <div className="grid grid-cols-[1fr_280px] gap-4 items-start">

        {/* ── Left: Main card ── */}
        <div className="bg-white border border-gray-200 rounded-xl flex flex-col">

          {/* Tab bar + search */}
          <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-b border-gray-100 flex-wrap gap-y-2 shrink-0">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['all', 'pending', 'submitted'] as TabFilter[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`text-[12.5px] px-3 py-1.5 rounded-md font-semibold capitalize transition-colors ${
                    tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'all'       ? `All (${forms.length})`           :
                   t === 'pending'   ? `Pending (${pending.length})`     :
                   `Submitted (${submitted.length})`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search forms..."
                  className="w-full pl-8 pr-3 py-1.5 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
                />
              </div>
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setFilterOpen(o => !o)}
                  className={`flex items-center gap-1.5 border text-[12.5px] font-semibold px-3 py-1.5 rounded-xl transition-colors ${
                    filterOpen || activeFilterCount > 0
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <SlidersHorizontal size={13} />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 w-4 h-4 rounded-full bg-white text-gray-900 text-[10px] font-bold flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {filterOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-30 p-4 space-y-4">
                    {/* Category */}
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(['all', ...categories.map(([c]) => c)] as string[]).map(cat => (
                          <button
                            key={cat}
                            onClick={() => setFilterCategory(cat)}
                            className={`text-[11.5px] px-2.5 py-1 rounded-lg font-medium transition-colors ${
                              filterCategory === cat
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {cat === 'all' ? 'All' : cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Type */}
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Type</p>
                      <div className="flex gap-1.5">
                        {(['all', 'form', 'survey'] as const).map(t => (
                          <button
                            key={t}
                            onClick={() => setFilterType(t)}
                            className={`text-[11.5px] px-2.5 py-1 rounded-lg font-medium capitalize transition-colors ${
                              filterType === t
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {t === 'all' ? 'All' : t === 'survey' ? 'Survey' : 'Form'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Overdue toggle */}
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-medium text-gray-700">Overdue only</p>
                      <button
                        onClick={() => setFilterOverdue(v => !v)}
                        className={`w-9 h-5 rounded-full transition-colors relative ${filterOverdue ? 'bg-gray-900' : 'bg-gray-200'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${filterOverdue ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    {/* Clear all */}
                    {activeFilterCount > 0 && (
                      <button
                        onClick={() => { setFilterCategory('all'); setFilterType('all'); setFilterOverdue(false); }}
                        className="w-full text-[12px] text-gray-500 hover:text-gray-800 font-medium pt-1 border-t border-gray-100 text-left"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fixed-height rows area */}
          <div className="h-[560px] overflow-hidden">
            {sortedList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                {tab === 'pending' ? (
                  <>
                    <CheckCircle2 size={34} className="text-gray-200 mb-2" />
                    <p className="text-[13px]">You're all caught up — no pending forms!</p>
                  </>
                ) : (
                  <>
                    <ClipboardList size={36} className="text-gray-200 mb-3" />
                    <p className="text-[13px]">No forms here yet.</p>
                  </>
                )}
              </div>
            ) : (
              pagedForms.map(form =>
                form.submitted
                  ? <SubmittedFormRow key={form.id} form={form} onView={() => setFilling(form)} />
                  : <PendingFormRow   key={form.id} form={form} onFill={() => setFilling(form)} />
              )
            )}
          </div>

          {/* Always-visible pagination footer */}
          <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between shrink-0">
            <p className="text-[11px] text-gray-400">
              {sortedList.length === 0
                ? 'No forms'
                : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sortedList.length)} of ${sortedList.length}`}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
              >‹</button>
              {pageNumbers().map((n, i) =>
                n === '…'
                  ? <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-[11px] text-gray-300">…</span>
                  : <button
                      key={n}
                      onClick={() => setPage(n as number)}
                      className={`w-7 h-7 flex items-center justify-center rounded-md text-[11px] font-medium transition-colors ${
                        page === n ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >{n}</button>
              )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
              >›</button>
            </div>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">

          {/* Form Categories */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[13px] font-bold text-gray-900 mb-3">Form Categories</p>
            {categories.length === 0 ? (
              <p className="text-[12px] text-gray-400">No categories yet.</p>
            ) : (
              <div className="space-y-2">
                {categories.map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-[13px] text-gray-700">{cat}</span>
                    <span className="text-[13px] font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setTab('all')}
              className="flex items-center gap-1 mt-4 text-[12.5px] font-semibold text-gray-600 hover:text-gray-900 transition-colors"
            >
              View all categories <ArrowRight size={12} />
            </button>
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[13px] font-bold text-gray-900 mb-3">Upcoming Deadlines</p>
            {upcomingDeadlines.length === 0 ? (
              <p className="text-[12px] text-gray-400">No upcoming deadlines.</p>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map(form => {
                  const { month, day } = fmtDeadlineDate(form.due_date!);
                  return (
                    <div key={form.id} className="flex items-start gap-3">
                      <div className="w-10 shrink-0 bg-gray-100 rounded-lg flex flex-col items-center py-1.5">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">{month}</span>
                        <span className="text-[16px] font-bold text-gray-900 leading-tight">{day}</span>
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[12.5px] font-semibold text-gray-900 truncate">{form.title}</p>
                        <p className="text-[11.5px] text-gray-400">{dueInDays(form.due_date!)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button className="flex items-center gap-1 mt-4 text-[12.5px] font-semibold text-gray-600 hover:text-gray-900 transition-colors">
              View calendar <ArrowRight size={12} />
            </button>
          </div>

          {/* Why Forms Matter */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[13px] font-bold text-gray-900 mb-3">Why Forms Matter</p>
            <div className="space-y-2">
              {[
                { icon: <Shield size={14} className="text-gray-500 shrink-0 mt-0.5" />, text: 'Help us give you the best possible experience.' },
                { icon: <CheckCircle2 size={14} className="text-gray-500 shrink-0 mt-0.5" />, text: 'Ensure accuracy and compliance.' },
                { icon: <Bell size={14} className="text-gray-500 shrink-0 mt-0.5" />, text: 'Your information is always secure.' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  {item.icon}
                  <p className="text-[12px] text-gray-600 leading-snug">{item.text}</p>
                </div>
              ))}
            </div>
            <button className="flex items-center gap-1 mt-4 text-[12.5px] font-semibold text-gray-600 hover:text-gray-900 transition-colors">
              Learn more about your data and privacy <ArrowRight size={12} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
