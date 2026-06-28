import { useState } from 'react';
import { Award } from 'lucide-react';
import { workspacesApi } from '../../../api/workspaces';
import apiClient from '../../../api/apiClient';
import type { WorkspaceTaskRubricCriteria, WorkspaceTaskSubmission } from '../../../types';

export function RubricScorePanel({
  workspaceId, taskId, submissionId,
  criteria, existingScores,
  onSaved,
}: {
  workspaceId: number; taskId: number; submissionId: number;
  criteria: WorkspaceTaskRubricCriteria[];
  existingScores: WorkspaceTaskSubmission['rubric_scores'];
  onSaved: () => void;
}) {
  const [scores, setScores] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    existingScores.forEach(s => { init[s.criteria.id] = s.points; });
    return init;
  });
  const [saving, setSaving] = useState(false);

  const maxTotal     = criteria.reduce((s, c) => s + c.max_points, 0);
  const currentTotal = criteria.reduce((s, c) => s + (scores[c.id] ?? 0), 0);

  const saveScores = async () => {
    setSaving(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.setRubricScores(workspaceId, taskId, submissionId,
        criteria.map(c => ({ criteria_id: c.id, points: scores[c.id] ?? 0, feedback: '' }))
      );
      onSaved();
    } finally { setSaving(false); }
  };

  if (criteria.length === 0) return null;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
        <Award size={11} /> Rubric Score
        <span className="ml-auto text-[12px] font-bold text-gray-700 normal-case tracking-normal">
          {currentTotal} / {maxTotal}
        </span>
      </p>
      <div className="space-y-2.5 mb-3">
        {criteria.map(c => (
          <div key={c.id} className="bg-gray-50 rounded-xl px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[12.5px] font-medium text-gray-800">{c.title}</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min={0} max={c.max_points}
                  value={scores[c.id] ?? 0}
                  onChange={e => setScores(prev => ({ ...prev, [c.id]: Math.min(c.max_points, Math.max(0, Number(e.target.value))) }))}
                  className="w-14 text-center px-2 py-1 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <span className="text-[11px] text-gray-400">/ {c.max_points}</span>
              </div>
            </div>
            {c.description && <p className="text-[11px] text-gray-400">{c.description}</p>}
            <div className="mt-1.5 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${c.max_points ? ((scores[c.id] ?? 0) / c.max_points) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
      <button onClick={saveScores} disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors">
        <Award size={12} /> {saving ? 'Saving…' : 'Save Scores'}
      </button>
    </div>
  );
}
