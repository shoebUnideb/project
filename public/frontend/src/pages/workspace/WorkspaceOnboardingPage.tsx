import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useApiList } from '../../hooks/useApi';
import { onboardingApi } from '../../api/onboarding';
import type { WorkspaceOnboardingSubmission, WorkspaceOnboardingQuestion } from '../../types';
import Avatar from '../../components/ui/Avatar';

export default function WorkspaceOnboardingPage() {
  const { workspace, isOwner } = useWorkspace();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (workspace && !isOwner) {
      navigate(`/w/${workspace.slug}`, { replace: true });
    }
  }, [workspace?.id, isOwner, navigate]);

  const { data: questions } = useApiList<WorkspaceOnboardingQuestion>(
    () => (workspace ? onboardingApi.getQuestions(workspace.id) : Promise.resolve([])),
    [workspace?.id]
  );
  const { data: submissions } = useApiList<WorkspaceOnboardingSubmission>(
    () => (workspace ? onboardingApi.getSubmissions(workspace.id) : Promise.resolve([])),
    [workspace?.id]
  );

  if (!workspace || !isOwner) return null;

  const filtered = submissions.filter(s =>
    !search || s.student_name.toLowerCase().includes(search.toLowerCase())
  );

  const answeredMap = (s: WorkspaceOnboardingSubmission) => {
    const map: Record<number, string> = {};
    s.answers.forEach(a => { map[a.question] = a.answer_text; });
    return map;
  };

  const hasAnswered = (s: WorkspaceOnboardingSubmission) =>
    s.answers.some(a => a.answer_text.trim());

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList size={18} className="text-primary-600" />
            <h1 className="text-[20px] font-bold text-gray-900">Intake Submissions</h1>
          </div>
          <p className="text-[13px] text-gray-500">
            {submissions.length} approved member{submissions.length !== 1 ? 's' : ''} ·{' '}
            {submissions.filter(hasAnswered).length} submitted
          </p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members…"
            className="pl-8 pr-3 py-2 text-[12.5px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 w-52"
          />
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <ClipboardList size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-[14px] font-semibold text-gray-600 mb-1">No intake questions yet</p>
          <p className="text-[12.5px] text-gray-400">
            Add questions in{' '}
            <button onClick={() => navigate(`/w/${workspace.slug}/settings`)}
              className="text-primary-600 hover:underline">workspace settings</button>
            {' '}to start collecting responses.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[13px] text-gray-400 text-center py-10">No members found.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map(sub => {
            const answers = answeredMap(sub);
            const submitted = hasAnswered(sub);
            return (
              <div key={sub.student_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Student header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <Avatar src={sub.student_picture ?? undefined} name={sub.student_name} size="sm" />
                  <span className="flex-1 text-[13px] font-semibold text-gray-900">{sub.student_name}</span>
                  {submitted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
                      <CheckCircle2 size={11} /> Submitted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
                      <AlertCircle size={11} /> Not submitted
                    </span>
                  )}
                </div>

                {/* Answers */}
                <div className="px-5 py-4 space-y-4">
                  {questions.map(q => (
                    <div key={q.id}>
                      <p className="text-[12px] font-semibold text-gray-600 mb-1">{q.question_text}</p>
                      {answers[q.id] ? (
                        <p className="text-[13px] text-gray-800 whitespace-pre-wrap">{answers[q.id]}</p>
                      ) : (
                        <p className="text-[12.5px] text-gray-400 italic">No answer</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
