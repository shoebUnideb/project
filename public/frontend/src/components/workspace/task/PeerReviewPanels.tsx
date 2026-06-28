import { useState } from 'react';
import { GitMerge, Star } from 'lucide-react';
import { useApiList } from '../../../hooks/useApi';
import { workspacesApi } from '../../../api/workspaces';
import apiClient from '../../../api/apiClient';
import type { PeerReviewAssignment, WorkspaceTaskRubricCriteria } from '../../../types';

export function PeerReviewDrawerPanel({
  reviews, criteria,
}: {
  reviews: PeerReviewAssignment[];
  criteria: WorkspaceTaskRubricCriteria[];
}) {
  if (reviews.length === 0) {
    return <p className="text-[12px] text-gray-400 py-4 text-center">No peer reviews assigned yet.</p>;
  }
  return (
    <div className="space-y-4">
      {reviews.map((pr, i) => (
        <div key={pr.id} className="border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12.5px] font-semibold text-gray-700">{pr.reviewer_label || `Peer ${i + 1}`}</span>
            <span className={`text-[10.5px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
              pr.status === 'submitted' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
            }`}>{pr.status}</span>
          </div>
          {pr.status === 'submitted' && (
            <>
              <p className="text-[11.5px] font-bold text-violet-600 mb-2">Score: {pr.total_score} pts</p>
              <div className="space-y-1.5">
                {pr.scores.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-[12px]">
                    <span className="text-gray-600">
                      {criteria.find(c => c.id === s.criteria.id)?.title ?? s.criteria.title}
                    </span>
                    <span className="font-semibold text-gray-800">{s.points}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
      {reviews.some(r => r.status === 'submitted') && (
        <div className="px-3 py-2 bg-violet-50 rounded-xl text-[12.5px] text-violet-700 font-medium">
          Avg peer score: {Math.round((reviews.filter(r => r.status === 'submitted').reduce((s, r) => s + r.total_score, 0) / reviews.filter(r => r.status === 'submitted').length) * 10) / 10} pts
        </div>
      )}
    </div>
  );
}

export function StudentPeerReviewSection({
  workspaceId, taskId, criteria,
}: {
  workspaceId: number; taskId: number;
  criteria: WorkspaceTaskRubricCriteria[];
}) {
  const { data: prs, loading, refetch } = useApiList<PeerReviewAssignment>(
    () => workspacesApi.getMyPeerReviews(workspaceId, taskId),
    [workspaceId, taskId],
  );
  const [scores, setScores]       = useState<Record<number, Record<number, number>>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);

  const updateScore = (prId: number, criteriaId: number, val: number) =>
    setScores(prev => ({ ...prev, [prId]: { ...(prev[prId] ?? {}), [criteriaId]: val } }));

  const submitPR = async (prId: number) => {
    if (criteria.length === 0) return;
    setSubmitting(prId);
    try {
      await apiClient.initCsrf();
      await workspacesApi.submitPeerReview(workspaceId, taskId, prId,
        criteria.map(c => ({ criteria_id: c.id, points: scores[prId]?.[c.id] ?? 0 }))
      );
      refetch();
    } finally { setSubmitting(null); }
  };

  if (loading) return null;
  if (prs.length === 0) return null;

  const pending = prs.filter(p => p.status === 'assigned');
  const done    = prs.filter(p => p.status === 'submitted');

  return (
    <div className="border border-violet-100 rounded-xl bg-violet-50 p-4 space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-500 flex items-center gap-1.5">
        <GitMerge size={11} /> Peer Reviews Assigned to You
      </p>
      {done.length > 0 && (
        <p className="text-[12px] text-violet-600">{done.length} review{done.length > 1 ? 's' : ''} submitted.</p>
      )}
      {pending.map(pr => (
        <div key={pr.id} className="bg-white rounded-xl border border-violet-100 p-4 space-y-3">
          <p className="text-[12.5px] font-semibold text-gray-700">Anonymous submission to review</p>
          {criteria.length === 0 && (
            <p className="text-[12px] text-gray-400">No rubric criteria configured for this task.</p>
          )}
          {criteria.map(c => (
            <div key={c.id}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[12.5px] font-medium text-gray-700">{c.title}</p>
                <span className="text-[11px] text-gray-400">/ {c.max_points} pts</span>
              </div>
              <input
                type="range" min={0} max={c.max_points} step={1}
                value={scores[pr.id]?.[c.id] ?? 0}
                onChange={e => updateScore(pr.id, c.id, Number(e.target.value))}
                className="w-full accent-violet-600"
              />
              <div className="flex justify-between text-[10.5px] text-gray-400">
                <span>0</span>
                <span className="font-semibold text-violet-600">{scores[pr.id]?.[c.id] ?? 0}</span>
                <span>{c.max_points}</span>
              </div>
            </div>
          ))}
          <button
            onClick={() => submitPR(pr.id)}
            disabled={submitting === pr.id || criteria.length === 0}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-[12.5px] font-semibold rounded-lg transition-colors">
            {submitting === pr.id ? 'Submitting…' : 'Submit Peer Review'}
          </button>
        </div>
      ))}
    </div>
  );
}

export function SelfAssessmentForm({
  questions, values, onChange,
}: {
  questions: { id: number; text: string }[];
  values: Record<number, number>;
  onChange: (qId: number, rating: number) => void;
}) {
  if (questions.length === 0) return null;
  return (
    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500 flex items-center gap-1.5">
        <Star size={11} /> Self-Assessment (required)
      </p>
      {questions.map(q => (
        <div key={q.id}>
          <p className="text-[12.5px] font-medium text-gray-700 mb-1.5">{q.text}</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => onChange(q.id, n)}
                className={`w-8 h-8 rounded-full text-[12.5px] font-bold transition-colors ${
                  values[q.id] === n
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-500 hover:border-indigo-300'
                }`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
