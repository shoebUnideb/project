import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';
import ScrollToTop from '../components/ScrollToTop';
import WorkspaceShell from '../components/layout/WorkspaceShell';

// Public pages
import LoginPage          from '../pages/auth/LoginPage';
import SignupPage         from '../pages/auth/SignupPage';
import AboutPage          from '../pages/AboutPage';
import AuthCallbackPage   from '../pages/auth/AuthCallbackPage';

// Student pages
import StudentDashboard      from '../pages/student/StudentDashboard';
import StudentProfilePage    from '../pages/student/StudentProfilePage';

// Mentor pages
import MentorDashboard       from '../pages/mentor/MentorDashboard';
import StudentDetailPage     from '../pages/mentor/StudentDetailPage';
import MentorProfilePage     from '../pages/mentor/MentorProfilePage';
import MentorStudentsPage    from '../pages/mentor/MentorStudentsPage';

// Admin pages
import AdminDashboard    from '../pages/admin/AdminDashboard';
import UserManagementPage from '../pages/admin/UserManagementPage';
import AssignmentPage    from '../pages/admin/AssignmentPage';
import AdminSettingsPage from '../pages/admin/AdminSettingsPage';

// Shared pages
import MarketplacePage      from '../pages/shared/MarketplacePage';
import ConversationPage     from '../pages/shared/ConversationPage';
import WorkspacesPage       from '../pages/shared/WorkspacesPage';
import WorkspaceDetailPage  from '../pages/shared/WorkspaceDetailPage';
import MessagesPage         from '../pages/shared/MessagesPage';
import FeedPage             from '../pages/shared/FeedPage';
import PublicProfilePage    from '../pages/shared/PublicProfilePage';
import NotificationsPage    from '../pages/shared/NotificationsPage';

// Workspace mini-platform pages
import WorkspaceHome          from '../pages/workspace/WorkspaceHome';
import WorkspaceResourcesPage from '../pages/workspace/WorkspaceResourcesPage';
import WorkspaceMembersPage   from '../pages/workspace/WorkspaceMembersPage';
import WorkspaceTasksPage     from '../pages/workspace/WorkspaceTasksPage';
import WorkspaceChatPage      from '../pages/workspace/WorkspaceChatPage';
import WorkspaceSettingsPage    from '../pages/workspace/WorkspaceSettingsPage';
import WorkspaceTaskDetailPage  from '../pages/workspace/WorkspaceTaskDetailPage';
import WorkspaceGradebookPage   from '../pages/workspace/WorkspaceGradebookPage';
import WorkspaceOnboardingPage  from '../pages/workspace/WorkspaceOnboardingPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ScrollToTop />
          <Routes>
          {/* Public */}
          <Route path="/login"         element={<LoginPage />} />
          <Route path="/signup"        element={<SignupPage />} />
          <Route path="/about"         element={<AboutPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/"              element={<Navigate to="/login" replace />} />

          {/* ── Student routes ─────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route element={<AppLayout />}>
              <Route path="/student/dashboard"        element={<StudentDashboard />} />
              <Route path="/student/profile"          element={<StudentProfilePage />} />
            </Route>
          </Route>

          {/* ── Mentor routes ──────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['mentor']} />}>
            <Route element={<AppLayout />}>
              <Route path="/mentor/dashboard"              element={<MentorDashboard />} />
              <Route path="/mentor/students"               element={<MentorStudentsPage />} />
              <Route path="/mentor/students/:studentId"    element={<StudentDetailPage />} />
              <Route path="/mentor/profile"                element={<MentorProfilePage />} />
              <Route path="/mentor/messages"               element={<MessagesPage />} />
            </Route>
          </Route>

          {/* ── Admin routes ───────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['superadmin']} />}>
            <Route element={<AppLayout />}>
              <Route path="/admin/dashboard"   element={<AdminDashboard />} />
              <Route path="/admin/users"       element={<UserManagementPage />} />
              <Route path="/admin/assignments" element={<AssignmentPage />} />
              <Route path="/admin/messages"    element={<MessagesPage />} />
              <Route path="/admin/settings"    element={<AdminSettingsPage />} />
            </Route>
          </Route>

          {/* ── Shared routes (all authenticated) ─── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/marketplace"          element={<MarketplacePage />} />
              <Route path="/messages"             element={<MessagesPage />} />
              <Route path="/messages/:userId"     element={<ConversationPage />} />
              <Route path="/workspaces"           element={<WorkspacesPage />} />
              <Route path="/workspaces/:id"       element={<WorkspaceDetailPage />} />
              <Route path="/feed"                 element={<FeedPage />} />
              <Route path="/notifications"        element={<NotificationsPage />} />
              <Route path="/profiles/:userId"    element={<PublicProfilePage />} />
            </Route>
          </Route>

          {/* ── Workspace mini-platform (isolated shell, no AppLayout) ── */}
          <Route element={<ProtectedRoute />}>
            <Route path="/w/:slug" element={<WorkspaceShell />}>
              <Route index element={<WorkspaceHome />} />
              <Route path="resources" element={<WorkspaceResourcesPage />} />
              <Route path="members"   element={<WorkspaceMembersPage />} />
              <Route path="tasks"     element={<WorkspaceTasksPage />} />
              <Route path="tasks/:taskId" element={<WorkspaceTaskDetailPage />} />
              <Route path="gradebook" element={<WorkspaceGradebookPage />} />
              <Route path="chat"        element={<WorkspaceChatPage />} />
              <Route path="settings"    element={<WorkspaceSettingsPage />} />
              <Route path="submissions" element={<WorkspaceOnboardingPage />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
