import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

interface Props {
  allowedRoles?: Role[];
}

/**
 * Redirects unauthenticated users to /login.
 * If allowedRoles is provided, redirects wrong-role users to their dashboard.
 */
export default function ProtectedRoute({ allowedRoles }: Props) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to the correct home for this role
    const home: Record<Role, string> = {
      superadmin: '/admin/dashboard',
      mentor: '/mentor/dashboard',
      student: '/workspaces',
    };
    return <Navigate to={home[user.role]} replace />;
  }

  return <Outlet />;
}
