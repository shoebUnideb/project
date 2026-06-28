import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import ScrollToTop from '../components/ScrollToTop';

// Auth pages
import LoginPage        from '../pages/auth/LoginPage';
import AuthCallbackPage from '../pages/AuthCallbackPage';

// Internal portal
import OrgPortalRoute    from '../internal/OrgPortalRoute';
import OrgShell          from '../internal/layout/OrgShell';
import OrgMyOnboarding   from '../internal/pages/OrgMyOnboarding';
import OrgContributions  from '../internal/pages/OrgContributions';
import OrgMembers        from '../internal/pages/OrgMembers';
import OrgRecruitment    from '../internal/pages/OrgRecruitment';
import OrgRoles          from '../internal/pages/OrgRoles';
import OrgDepartments    from '../internal/pages/OrgDepartments';
import OrgTaskTemplates  from '../internal/pages/OrgTaskTemplates';
import OrgAnalytics      from '../internal/pages/OrgAnalytics';
import OrgOnboardingMgmt from '../internal/pages/OrgOnboardingMgmt';
import OrgDocTemplates   from '../internal/pages/OrgDocTemplates';
import OrgTemplateHub    from '../internal/pages/OrgTemplateHub';
import OrgDocuments      from '../internal/pages/OrgDocuments';
import OrgTraining       from '../internal/pages/OrgTraining';
import OrgLearning       from '../internal/pages/OrgLearning';
import OrgEvents         from '../internal/pages/OrgEvents';
import OrgDirectory      from '../internal/pages/OrgDirectory';
import OrgMemberFingerprint from '../internal/pages/OrgMemberFingerprint';
import OrgForms         from '../internal/pages/OrgForms';
import OrgMyForms       from '../internal/pages/OrgMyForms';
import OrgChat          from '../internal/pages/OrgChat';
import OrgDashboard      from '../internal/pages/OrgDashboard';
import OrgAdminGuide     from '../internal/pages/OrgAdminGuide';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          {/* Auth */}
          <Route path="/login"          element={<LoginPage />} />
          <Route path="/auth/callback"  element={<AuthCallbackPage />} />
          <Route path="/"               element={<Navigate to="/login" replace />} />

          {/* ── Internal Portal ── */}
          <Route element={<OrgPortalRoute />}>
            <Route path="/org" element={<OrgShell />}>
              <Route index element={<Navigate to="/org/dashboard" replace />} />
              <Route path="dashboard"     element={<OrgDashboard />} />
              <Route path="onboarding"    element={<OrgMyOnboarding />} />
              <Route path="contributions" element={<OrgContributions />} />
              <Route path="members"         element={<OrgMembers />} />
              <Route path="recruitment"     element={<OrgRecruitment />} />
              <Route path="roles"           element={<OrgRoles />} />
              <Route path="learning"        element={<OrgLearning />} />
              <Route path="directory"       element={<OrgDirectory />} />
              <Route path="documents"       element={<OrgDocuments />} />
              <Route path="onboarding-mgmt" element={<OrgOnboardingMgmt />} />
              <Route path="task-templates"  element={<OrgTaskTemplates />} />
              <Route path="template-hub"    element={<OrgTemplateHub />} />
              <Route path="doc-templates"   element={<OrgDocTemplates />} />
              <Route path="training"        element={<OrgTraining />} />
              <Route path="events"          element={<OrgEvents />} />
              <Route path="departments"     element={<OrgDepartments />} />
              <Route path="analytics"       element={<OrgAnalytics />} />
              <Route path="members/:memberId" element={<OrgMemberFingerprint />} />
              <Route path="forms"          element={<OrgForms />} />
              <Route path="my-forms"       element={<OrgMyForms />} />
              <Route path="chat"           element={<OrgChat />} />
              <Route path="admin-guide"    element={<OrgAdminGuide />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
