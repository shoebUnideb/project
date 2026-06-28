import { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Play, FileText, GraduationCap, ExternalLink,
  CheckCircle2, Award, ChevronRight, X, Clock,
  AlignLeft, Layers, ClipboardList, Upload, Download,
} from 'lucide-react';
import {
  trainingApi,
  type TrainingEnrollment, type TrainingLesson, type TrainingModule,
  type LessonSubmission, type QuizFeedback,
} from '../api/orgApi';

// ── Helpers ────────────────────────────────────────────────────────────────────

type TabKey = 'all' | 'in_progress' | 'completed';

const LESSON_ICON: Record<string, React.ReactNode> = {
  video:         <Play size={12} />,
  pdf:           <FileText size={12} />,
  quiz:          <GraduationCap size={12} />,
  assessment:    <GraduationCap size={12} />,
  external_link: <ExternalLink size={12} />,
  article:       <AlignLeft size={12} />,
  embed:         <Layers size={12} />,
  assignment:    <ClipboardList size={12} />,
};

function statusBadge(status: string) {
  const MAP: Record<string, string> = {
    enrolled:    'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-50 text-blue-700',
    completed:   'bg-emerald-100 text-emerald-700',
    failed:      'bg-red-50 text-red-700',
  };
  const LABEL: Record<string, string> = {
    enrolled: 'Enrolled', in_progress: 'In Progress', completed: 'Completed', failed: 'Failed',
  };
  return { cls: MAP[status] ?? 'bg-gray-100 text-gray-600', label: LABEL[status] ?? status };
}

// ── Quiz Viewer ────────────────────────────────────────────────────────────────

function QuizViewer({
  lesson,
  enrollment,
  onSubmitted,
}: {
  lesson: TrainingLesson;
  enrollment: TrainingEnrollment;
  onSubmitted: (updated: TrainingEnrollment, feedback: QuizFeedback) => void;
}) {
  const existing: LessonSubmission | null =
    enrollment.lesson_submissions.find(s => s.lesson_id === lesson.id) ?? null;

  const [answers, setAnswers]               = useState<Record<string, string>>({});
  const [submitting, setSubmitting]         = useState(false);
  const [localSubmission, setLocalSub]      = useState<LessonSubmission | null>(existing);
  const [feedback, setFeedback]             = useState<QuizFeedback | null>(null);

  const questions = lesson.quiz_questions ?? [];

  const allAnswered =
    questions.length > 0 &&
    questions.every(q => {
      const a = answers[String(q.id)];
      return a !== undefined && a !== '';
    });

  const handleSubmit = async () => {
    if (submitting || !allAnswered) return;
    setSubmitting(true);
    try {
      const result = await trainingApi.submitLesson(enrollment.id, lesson.id, { answers });
      const sub = result.enrollment.lesson_submissions.find(s => s.lesson_id === lesson.id) ?? null;
      setLocalSub(sub);
      setFeedback(result.feedback);
      onSubmitted(result.enrollment, result.feedback);
    } catch { /* ignore */ } finally { setSubmitting(false); }
  };

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-gray-400">
        <GraduationCap size={32} className="text-gray-300" />
        <p className="text-[13px]">No questions added yet.</p>
      </div>
    );
  }

  // ── Results view ──
  if (localSubmission) {
    const score  = localSubmission.score ?? 0;
    const passed = localSubmission.passed;
    return (
      <div className="space-y-5">
        <div className={`flex items-center justify-between px-5 py-4 rounded-2xl ${
          passed === null  ? 'bg-gray-50 border border-gray-200' :
          passed           ? 'bg-emerald-50 border border-emerald-200' :
                             'bg-red-50 border border-red-200'
        }`}>
          <div>
            <p className={`text-[26px] font-bold leading-none ${
              passed === null ? 'text-gray-700' : passed ? 'text-emerald-700' : 'text-red-600'
            }`}>
              {score}<span className="text-[14px] font-medium opacity-50">/100</span>
            </p>
            <p className="text-[11.5px] text-gray-500 mt-1">Your Score</p>
          </div>
          {passed !== null && (
            <span className={`px-3 py-1.5 rounded-full text-[12px] font-bold ${
              passed ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
            }`}>
              {passed ? '✓ Passed' : '✗ Failed'}
            </span>
          )}
        </div>

        {feedback ? (
          questions.map((q, i) => {
            const fb        = feedback[String(q.id)];
            const myAnswer  = localSubmission.answers?.[String(q.id)] ?? '';
            const correctId = fb?.correct_option_id ?? null;
            const earned    = fb?.earned ?? 0;
            return (
              <div key={q.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold text-gray-800">{i + 1}. {q.text}</p>
                  <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    earned > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                  }`}>
                    {earned}/{q.points} pts
                  </span>
                </div>
                {q.question_type === 'short_answer' ? (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[11.5px] text-gray-500 font-medium mb-1">Your answer:</p>
                    <p className="text-[13px] text-gray-700">{myAnswer || '(no answer)'}</p>
                    <p className="text-[11px] text-gray-400 mt-1.5 italic">Short answers are reviewed manually.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {q.options.map(opt => {
                      const isSelected = myAnswer === String(opt.id);
                      const isCorrect  = correctId !== null && String(opt.id) === correctId;
                      return (
                        <div key={opt.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] border ${
                          isCorrect  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                          isSelected ? 'bg-red-50 border-red-200 text-red-700' :
                                       'bg-gray-50 border-transparent text-gray-600'
                        }`}>
                          <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                            isCorrect ? 'border-emerald-500' : isSelected ? 'border-red-400' : 'border-gray-300'
                          }`}>
                            {(isCorrect || isSelected) && (
                              <span className={`w-1.5 h-1.5 rounded-full ${isCorrect ? 'bg-emerald-500' : 'bg-red-400'}`} />
                            )}
                          </span>
                          <span>{opt.text}</span>
                          {isCorrect  && <span className="ml-auto text-[11px] font-semibold text-emerald-600">Correct</span>}
                          {isSelected && !isCorrect && <span className="ml-auto text-[11px] font-semibold text-red-500">Your answer</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-center text-[12px] text-gray-400">
            Submitted {new Date(localSubmission.submitted_at).toLocaleString()}
          </p>
        )}
      </div>
    );
  }

  // ── Quiz form ──
  return (
    <div className="space-y-5">
      <p className="text-[12px] text-gray-400">{questions.length} question{questions.length !== 1 ? 's' : ''} · answer all to submit</p>
      {questions.map((q, i) => (
        <div key={q.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold text-gray-800">{i + 1}. {q.text}</p>
            <span className="shrink-0 text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {q.points} pt{q.points !== 1 ? 's' : ''}
            </span>
          </div>
          {q.question_type === 'short_answer' ? (
            <textarea
              rows={3}
              placeholder="Type your answer…"
              value={answers[String(q.id)] ?? ''}
              onChange={e => setAnswers(prev => ({ ...prev, [String(q.id)]: e.target.value }))}
              className="w-full text-[13px] border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          ) : (
            <div className="space-y-2">
              {q.options.map(opt => {
                const selected = answers[String(q.id)] === String(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border ${
                      selected
                        ? 'bg-teal-50 border-teal-300 text-teal-800'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={String(opt.id)}
                      checked={selected}
                      onChange={() => setAnswers(prev => ({ ...prev, [String(q.id)]: String(opt.id) }))}
                      className="accent-teal-500"
                    />
                    <span className="text-[13px]">{opt.text}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}
      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
        className={`w-full py-3 rounded-xl text-[13.5px] font-bold transition-colors ${
          allAnswered && !submitting
            ? 'bg-teal-500 hover:bg-teal-600 text-white'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {submitting ? 'Submitting…' : 'Submit Quiz'}
      </button>
    </div>
  );
}

// ── Assignment Viewer ──────────────────────────────────────────────────────────

function AssignmentViewer({
  lesson,
  enrollment,
  onSubmitted,
}: {
  lesson: TrainingLesson;
  enrollment: TrainingEnrollment;
  onSubmitted: (updated: TrainingEnrollment) => void;
}) {
  const existing = enrollment.lesson_submissions.find(s => s.lesson_id === lesson.id) ?? null;
  const [note, setNote]           = useState('');
  const [file, setFile]           = useState<File | null>(null);
  const [submitting, setSubmit]   = useState(false);
  const [submitted, setSubmitted] = useState(!!existing);
  const fileRef                   = useRef<HTMLInputElement>(null);

  const instructions = (lesson.content_data?.instructions as string) || '';
  const allowFile    = !!(lesson.content_data?.allow_file_upload);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmit(true);
    try {
      let payload: FormData | { answers: Record<string, string> };
      if (allowFile && file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('answers', JSON.stringify({ note }));
        payload = fd;
      } else {
        payload = { answers: { note } };
      }
      const result = await trainingApi.submitLesson(enrollment.id, lesson.id, payload);
      setSubmitted(true);
      onSubmitted(result.enrollment);
    } catch { /* ignore */ } finally { setSubmit(false); }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-center">
        <CheckCircle2 size={40} className="text-emerald-400" />
        <p className="text-[14px] font-bold text-emerald-700">Assignment Submitted!</p>
        <p className="text-[12px] text-gray-500">Your submission has been recorded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {instructions ? (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-[12px] font-semibold text-blue-700 mb-1.5">Instructions</p>
          <p className="text-[13px] text-blue-900 whitespace-pre-wrap leading-relaxed">{instructions}</p>
        </div>
      ) : (
        <p className="text-[13px] text-gray-400 italic">No instructions provided.</p>
      )}

      {/* Instructor-uploaded reference file */}
      {lesson.content_file_url && (
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
          <FileText size={16} className="text-gray-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Reference File</p>
            <p className="text-[12.5px] text-gray-700 truncate">
              {lesson.content_file_url.split('/').pop() ?? 'Download'}
            </p>
          </div>
          <a
            href={lesson.content_file_url}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
          >
            <Download size={12} /> Download
          </a>
        </div>
      )}

      <div>
        <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
          Notes <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          rows={4}
          placeholder="Add any notes or comments…"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full text-[13px] border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>

      {allowFile && (
        <div>
          <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Attach File</label>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 text-[12.5px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              <Upload size={14} /> {file ? 'Change File' : 'Choose File'}
            </button>
            {file && (
              <span className="text-[12px] text-gray-500 truncate max-w-[200px]">{file.name}</span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-3 rounded-xl text-[13.5px] font-bold bg-teal-500 hover:bg-teal-600 text-white transition-colors disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit Assignment'}
      </button>
    </div>
  );
}

// ── Lesson Viewer ──────────────────────────────────────────────────────────────

function LessonViewer({
  lesson,
  enrollment,
  isCompleted,
  onComplete,
  onSubmitted,
}: {
  lesson: TrainingLesson;
  enrollment: TrainingEnrollment;
  isCompleted: boolean;
  onComplete: () => void;
  onSubmitted: (updated: TrainingEnrollment, feedback?: QuizFeedback) => void;
}) {
  const [confirmComplete, setConfirmComplete] = useState(false);

  const contentUrl    = lesson.content_url || lesson.content_file_url;
  const isSubmittable = ['quiz', 'assessment', 'assignment'].includes(lesson.lesson_type);

  const body        = (lesson.content_data?.body as string) || '';
  const embedCode   = (lesson.content_data?.embed_code as string) || '';
  const embedHeight = (lesson.content_data?.height as number) || 480;

  const renderContent = () => {
    switch (lesson.lesson_type) {
      case 'article':
        return (
          <div className="overflow-y-auto h-full">
            {body ? (
              <div className="p-5 text-[13.5px] leading-relaxed text-gray-800 whitespace-pre-wrap font-mono">
                {body}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400">
                <p className="text-[13px]">No article content yet.</p>
              </div>
            )}
            {lesson.content_file_url && (
              <div className="mx-5 mb-5 flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                <FileText size={15} className="text-gray-500 shrink-0" />
                <span className="flex-1 text-[12.5px] text-gray-700 truncate">
                  {lesson.content_file_url.split('/').pop() ?? 'Supporting file'}
                </span>
                <a href={lesson.content_file_url} target="_blank" rel="noopener noreferrer" download
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
                  <Download size={12} /> Download
                </a>
              </div>
            )}
          </div>
        );

      case 'embed':
        return embedCode ? (
          <iframe
            srcDoc={embedCode}
            style={{ height: embedHeight }}
            className="w-full border-0"
            title={lesson.title}
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        ) : contentUrl ? (
          <iframe
            src={contentUrl}
            style={{ height: embedHeight }}
            className="w-full border-0"
            title={lesson.title}
          />
        ) : (
          <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400">
            <p className="text-[13px]">No embed content yet.</p>
          </div>
        );

      case 'external_link':
        return (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 p-6 text-center">
            <ExternalLink size={32} className="text-gray-300" />
            <p className="text-[13.5px] font-semibold text-gray-700">External Resource</p>
            {contentUrl ? (
              <a
                href={contentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-teal-500 hover:bg-teal-600 rounded-xl"
              >
                <ExternalLink size={14} /> Open Link
              </a>
            ) : (
              <p className="text-[13px] text-gray-400">No URL provided.</p>
            )}
          </div>
        );

      case 'quiz':
      case 'assessment':
        return (
          <div className="p-4 overflow-y-auto h-full space-y-4">
            {lesson.content_file_url && (
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                <FileText size={15} className="text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Worksheet</p>
                  <p className="text-[12.5px] text-gray-700 truncate">
                    {lesson.content_file_url.split('/').pop() ?? 'Worksheet'}
                  </p>
                </div>
                <a href={lesson.content_file_url} target="_blank" rel="noopener noreferrer" download
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
                  <Download size={12} /> Download
                </a>
              </div>
            )}
            <QuizViewer
              lesson={lesson}
              enrollment={enrollment}
              onSubmitted={(updated, fb) => onSubmitted(updated, fb)}
            />
          </div>
        );

      case 'assignment':
        return (
          <div className="p-4 overflow-y-auto h-full">
            <AssignmentViewer
              lesson={lesson}
              enrollment={enrollment}
              onSubmitted={updated => onSubmitted(updated)}
            />
          </div>
        );

      case 'video':
        return contentUrl ? (
          <iframe
            src={contentUrl}
            className="w-full h-full min-h-[320px]"
            allow="autoplay; encrypted-media"
            allowFullScreen
            title={lesson.title}
          />
        ) : (
          <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400">
            <p className="text-[13px]">No video URL provided.</p>
          </div>
        );

      default: // pdf
        return contentUrl ? (
          <iframe
            src={contentUrl}
            className="w-full h-full min-h-[320px]"
            title={lesson.title}
          />
        ) : (
          <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400">
            <p className="text-[13px]">No file URL provided.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-gray-400">{LESSON_ICON[lesson.lesson_type]}</span>
            <p className="text-[11.5px] font-semibold text-gray-400 uppercase tracking-wide">
              {lesson.lesson_type.replace('_', ' ')}
            </p>
            {lesson.duration_minutes > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Clock size={10} /> {lesson.duration_minutes}m
              </span>
            )}
          </div>
          <h3 className="text-[16px] font-bold text-gray-900">{lesson.title}</h3>
        </div>
        {isCompleted && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full shrink-0">
            <CheckCircle2 size={11} /> Done
          </span>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 rounded-xl overflow-hidden bg-gray-50 border border-gray-200 mb-4">
        {renderContent()}
      </div>

      {/* Mark-complete button — hidden for quiz/assessment/assignment */}
      {!isSubmittable && !isCompleted && !confirmComplete && (
        <button
          onClick={() => setConfirmComplete(true)}
          className="flex items-center justify-center gap-2 w-full py-2.5 text-[13px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors"
        >
          <CheckCircle2 size={15} /> Mark as Complete
        </button>
      )}
      {!isSubmittable && !isCompleted && confirmComplete && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl">
          <p className="text-[13px] text-teal-800 font-medium">Mark this lesson as complete?</p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setConfirmComplete(false)}
              className="text-[12px] font-semibold text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-white"
            >
              Cancel
            </button>
            <button
              onClick={() => { setConfirmComplete(false); onComplete(); }}
              className="text-[12px] font-semibold text-white bg-teal-500 hover:bg-teal-600 px-3 py-1.5 rounded-lg"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Course Viewer ──────────────────────────────────────────────────────────────

function CourseViewer({
  enrollment,
  onClose,
  onUpdated,
}: {
  enrollment: TrainingEnrollment;
  onClose: () => void;
  onUpdated: (e: TrainingEnrollment) => void;
}) {
  const [local, setLocal]           = useState(enrollment);
  const [activeLesson, setActive]   = useState<TrainingLesson | null>(
    enrollment.course.modules[0]?.lessons[0] ?? null
  );
  const [completing, setCompleting] = useState(false);

  const completedIds = new Set(
    local.lesson_progress.filter(p => p.completed).map(p => p.lesson_id)
  );
  const isLessonDone = (id: number) => completedIds.has(id);

  const autoAdvance = (updated: TrainingEnrollment) => {
    const all = updated.course.modules.flatMap((m: TrainingModule) => m.lessons);
    const next = all.find(
      (l: TrainingLesson) => !updated.lesson_progress.some(p => p.lesson_id === l.id && p.completed)
    );
    if (next) setActive(next);
  };

  const handleComplete = async () => {
    if (!activeLesson || completing) return;
    setCompleting(true);
    try {
      const updated = await trainingApi.completeLesson(local.id, activeLesson.id);
      setLocal(updated);
      onUpdated(updated);
      autoAdvance(updated);
    } catch { /* ignore */ } finally { setCompleting(false); }
  };

  const handleSubmitted = (updated: TrainingEnrollment) => {
    setLocal(updated);
    onUpdated(updated);
    autoAdvance(updated);
  };

  const allModules = local.course.modules;

  return (
    <div className="fixed inset-0 z-50 flex bg-white">
      {/* Sidebar */}
      <div className="w-72 shrink-0 border-r border-gray-200 flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-gray-900 truncate">{local.course.title}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{local.progress_pct}% complete</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 ml-2">
            <X size={16} />
          </button>
        </div>
        {/* Progress bar */}
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${local.progress_pct}%` }}
            />
          </div>
        </div>
        {/* Module / lesson tree */}
        <div className="flex-1 overflow-y-auto py-2">
          {allModules.map((mod: TrainingModule) => (
            <div key={mod.id}>
              <p className="px-4 py-1.5 text-[10.5px] font-bold text-gray-400 uppercase tracking-widest">
                {mod.title}
              </p>
              {mod.lessons.map((lesson: TrainingLesson) => {
                const done   = isLessonDone(lesson.id);
                const active = activeLesson?.id === lesson.id;
                return (
                  <button
                    key={lesson.id}
                    onClick={() => setActive(lesson)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors ${
                      active ? 'bg-teal-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {done
                      ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      : <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                          active ? 'border-teal-500' : 'border-gray-300'
                        }`} />
                    }
                    <span className={`text-[12.5px] leading-snug truncate ${
                      active ? 'font-semibold text-teal-700' : done ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      {lesson.title}
                    </span>
                    <span className="shrink-0 ml-auto text-gray-300">
                      {LESSON_ICON[lesson.lesson_type]}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Certificate */}
        {local.status === 'completed' && local.certificate_issued && (
          <div className="px-4 py-4 border-t border-gray-100">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
              <Award size={16} className="text-amber-500 shrink-0" />
              <div>
                <p className="text-[12px] font-bold text-amber-700">Certificate Earned!</p>
                <p className="text-[10.5px] text-amber-600">
                  Completed {local.completion_date ? new Date(local.completion_date).toLocaleDateString() : ''}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lesson content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeLesson ? (
          <LessonViewer
            lesson={activeLesson}
            enrollment={local}
            isCompleted={isLessonDone(activeLesson.id)}
            onComplete={handleComplete}
            onSubmitted={(updated, feedback) => handleSubmitted(updated)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-[14px]">Select a lesson from the sidebar</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Enrollment Card ────────────────────────────────────────────────────────────

function EnrollmentCard({
  enrollment,
  onOpen,
}: {
  enrollment: TrainingEnrollment;
  onOpen: () => void;
}) {
  const badge = statusBadge(enrollment.status);
  return (
    <div
      onClick={onOpen}
      className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3 cursor-pointer hover:border-teal-300 hover:shadow-sm transition-all"
    >
      {enrollment.course.thumbnail_url ? (
        <img src={enrollment.course.thumbnail_url} alt="" className="w-full h-28 object-cover rounded-xl" />
      ) : (
        <div className="w-full h-28 rounded-xl bg-gradient-to-br from-indigo-100 to-teal-50 flex items-center justify-center">
          <BookOpen size={28} className="text-indigo-300" />
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <p className="text-[13.5px] font-bold text-gray-900 leading-snug">{enrollment.course.title}</p>
        <span className={`shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {enrollment.course.description && (
        <p className="text-[12px] text-gray-500 line-clamp-2 leading-relaxed">{enrollment.course.description}</p>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] text-gray-400">{enrollment.completed_lessons}/{enrollment.total_lessons} lessons</p>
          <p className="text-[11px] font-semibold text-teal-600">{enrollment.progress_pct}%</p>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-400 rounded-full transition-all duration-500"
            style={{ width: `${enrollment.progress_pct}%` }}
          />
        </div>
      </div>

      {enrollment.status === 'completed' && enrollment.certificate_issued && (
        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-600">
          <Award size={13} /> Certificate earned
        </div>
      )}

      <div className="flex items-center justify-between mt-auto">
        <p className="text-[11px] text-gray-400">
          {enrollment.course.modules.length} module{enrollment.course.modules.length !== 1 ? 's' : ''}
        </p>
        <span className="flex items-center gap-1 text-[12px] font-semibold text-teal-600">
          {enrollment.status === 'completed' ? 'Review' : 'Continue'} <ChevronRight size={13} />
        </span>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function OrgLearning() {
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<TabKey>('all');
  const [viewing, setViewing]         = useState<TrainingEnrollment | null>(null);

  useEffect(() => {
    trainingApi.getMyTraining()
      .then(setEnrollments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateEnrollment = (updated: TrainingEnrollment) =>
    setEnrollments(es => es.map(e => e.id === updated.id ? updated : e));

  const filtered = enrollments.filter(e => {
    if (tab === 'in_progress') return e.status === 'in_progress' || e.status === 'enrolled';
    if (tab === 'completed')   return e.status === 'completed';
    return true;
  });

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'all',         label: `All (${enrollments.length})` },
    { key: 'in_progress', label: `In Progress (${enrollments.filter(e => e.status === 'in_progress' || e.status === 'enrolled').length})` },
    { key: 'completed',   label: `Completed (${enrollments.filter(e => e.status === 'completed').length})` },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-100 rounded-xl animate-pulse w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">My Learning</h1>
        <p className="text-gray-500 text-sm">Continue your enrolled courses and track progress</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-[13px] font-semibold transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
            <BookOpen size={28} className="text-indigo-400" />
          </div>
          <p className="text-[15px] font-semibold text-gray-700">
            {tab === 'all' ? 'No courses enrolled yet' : tab === 'in_progress' ? 'No active courses' : 'No completed courses yet'}
          </p>
          <p className="text-[13px] text-gray-400 mt-1 max-w-sm leading-relaxed">
            {tab === 'all' ? 'Your admin will enroll you in training courses.' : ''}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(e => (
            <EnrollmentCard key={e.id} enrollment={e} onOpen={() => setViewing(e)} />
          ))}
        </div>
      )}

      {viewing && (
        <CourseViewer
          enrollment={viewing}
          onClose={() => setViewing(null)}
          onUpdated={updated => {
            updateEnrollment(updated);
            setViewing(updated);
          }}
        />
      )}
    </div>
  );
}
