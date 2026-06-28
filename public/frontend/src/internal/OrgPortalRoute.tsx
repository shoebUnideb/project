import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function OrgPortalRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  // Superadmin always has access; other users need the flag set
  if (user.role !== 'superadmin' && !user.has_internal_access) return <Navigate to="/feed" replace />;
  return <Outlet />;
}
