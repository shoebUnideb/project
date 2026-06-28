import { useRef, useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { WorkspaceProvider, useWorkspace } from '../../context/WorkspaceContext';
import WorkspaceSidebar from '../workspace/WorkspaceSidebar';
import WorkspaceLandingPage from '../../pages/workspace/WorkspaceLandingPage';
import Topbar from './Topbar';
import Footer from './Footer';
import OnboardingBanner from '../onboarding/OnboardingBanner';
import WorkspaceOnboardingForm from '../onboarding/WorkspaceOnboardingForm';
import { useAuth } from '../../context/AuthContext';
import { onboardingApi } from '../../api/onboarding';
import type { WorkspaceOnboardingQuestion, WorkspaceOnboardingAnswer } from '../../types';

const MIN_WIDTH = 120;
const MAX_WIDTH = 360;
const DEFAULT_WIDTH = 185;

function WorkspaceShellInner() {
  const { workspace, loading, error, isMember } = useWorkspace();
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  const [showWsForm, setShowWsForm]                   = useState(false);
  const [wsQuestions, setWsQuestions]                 = useState<WorkspaceOnboardingQuestion[]>([]);
  const [wsAnswers, setWsAnswers]                     = useState<WorkspaceOnboardingAnswer[]>([]);
  const [wsOnboardingLoaded, setWsOnboardingLoaded]   = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Fetch workspace questions + student's existing answers once workspace is ready
  useEffect(() => {
    if (!workspace || !isMember || user?.role !== 'student') return;
    Promise.all([
      onboardingApi.getQuestions(workspace.id),
      onboardingApi.getMyResponse(workspace.id),
    ]).then(([qs, ans]) => {
      setWsQuestions(qs);
      setWsAnswers(ans);
    }).catch(() => {}).finally(() => setWsOnboardingLoaded(true));
  }, [workspace?.id, isMember, user?.role]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + ev.clientX - startX.current));
      setSidebarWidth(next);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  // Show banner when: student + approved member + workspace has questions + not all required answered
  const answeredIds = new Set(wsAnswers.filter(a => a.answer_text.trim()).map(a => a.question));
  const hasUnanswered = wsOnboardingLoaded &&
    wsQuestions.length > 0 &&
    wsQuestions.some(q => !answeredIds.has(q.id));
  const showWsBanner = user?.role === 'student' && isMember && hasUnanswered;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[13px] text-gray-400">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">
        <div className="text-center">
          <p className="text-[16px] font-semibold text-gray-700 mb-1">Workspace not found</p>
          <p className="text-[13px] text-gray-400">This workspace doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <Topbar />
      <WorkspaceSidebar width={sidebarWidth} />

      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        className="fixed top-10 bottom-0 z-30 w-1 cursor-col-resize group"
        style={{ left: sidebarWidth - 1 }}
      >
        <div className="h-full w-full bg-transparent group-hover:bg-primary-400/40 transition-colors" />
      </div>

      <div className="mt-10 flex flex-col min-h-[calc(100vh-40px)]" style={{ marginLeft: sidebarWidth }}>
        {showWsBanner && (
          <OnboardingBanner
            message={`${workspace.name} has intake questions for you.`}
            ctaLabel="Answer questions →"
            onCta={() => setShowWsForm(true)}
          />
        )}
        <main className="flex-1 p-6">
          {!isMember ? <WorkspaceLandingPage /> : <Outlet />}
        </main>
        <Footer />
      </div>

      {showWsForm && (
        <WorkspaceOnboardingForm
          workspaceId={workspace.id}
          onClose={() => setShowWsForm(false)}
          onSaved={() => {
            // Optimistically mark all questions answered so banner hides immediately,
            // then reconcile with server state
            setWsAnswers(prev => {
              const existing = new Map(prev.map(a => [a.question, a]));
              wsQuestions.forEach(q => {
                if (!existing.has(q.id)) {
                  existing.set(q.id, { question: q.id, answer_text: ' ' });
                }
              });
              return Array.from(existing.values());
            });
            onboardingApi.getMyResponse(workspace.id).then(setWsAnswers).catch(() => {});
          }}
        />
      )}
    </div>
  );
}

export default function WorkspaceShell() {
  return (
    <WorkspaceProvider>
      <WorkspaceShellInner />
    </WorkspaceProvider>
  );
}
