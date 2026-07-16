import { useRef, useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Footer from './Footer';
import OnboardingBanner from '../onboarding/OnboardingBanner';
import GlobalOnboardingModal from '../onboarding/GlobalOnboardingModal';
import { useAuth } from '../../context/AuthContext';

const MIN_WIDTH = 120;
const MAX_WIDTH = 360;
const DEFAULT_WIDTH = 204;
const COLLAPSED_WIDTH = 56;

export default function AppLayout() {
  const { user, refreshUser } = useAuth();
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  const handleToggle = useCallback(() => {
    setCollapsed(c => {
      const next = !c;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  }, []);

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

  const effectiveWidth = collapsed ? COLLAPSED_WIDTH : sidebarWidth;
  const showGlobalBanner = user?.role === 'student' && user.onboarding_complete === false;

  return (
    <div className="min-h-screen bg-[#f8f8f8] font-sans">
      <Sidebar width={effectiveWidth} collapsed={collapsed} onToggle={handleToggle} />
      <Topbar />

      {/* Drag handle — only when expanded */}
      {!collapsed && (
        <div
          onMouseDown={onDragStart}
          className="fixed top-10 bottom-0 z-30 w-1 cursor-col-resize group"
          style={{ left: sidebarWidth - 1 }}
        >
          <div className="h-full w-full bg-transparent group-hover:bg-primary-400/40 transition-colors" />
        </div>
      )}

      <div
        className="mt-10 flex flex-col min-h-[calc(100vh-40px)] transition-all duration-200"
        style={{ marginLeft: effectiveWidth }}
      >
        {showGlobalBanner && (
          <OnboardingBanner
            message="Complete your profile so mentors can get to know you."
            ctaLabel="Get started →"
            onCta={() => setShowOnboarding(true)}
          />
        )}
        <main className="flex-1 p-5">
          <Outlet />
        </main>
        <Footer />
      </div>

      {showOnboarding && (
        <GlobalOnboardingModal
          onComplete={() => { refreshUser(); setShowOnboarding(false); }}
          onClose={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}
