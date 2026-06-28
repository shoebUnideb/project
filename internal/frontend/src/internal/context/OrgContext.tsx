import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { orgApi, type OrgMember } from '../api/orgApi';

interface OrgContextValue {
  orgMember: OrgMember | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  // Derived permission helpers
  isSuperadmin: boolean;
  canManageMembers: boolean;
  canViewAllContributions: boolean;
  canApproveCheckins: boolean;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orgMember, setOrgMember] = useState<OrgMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const member = await orgApi.getMe();
      setOrgMember(member);
    } catch {
      setOrgMember(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.has_internal_access) {
      fetchMe();
    } else {
      setOrgMember(null);
      setIsLoading(false);
    }
  }, [user]);

  const isSuperadmin = user?.role === 'superadmin';

  return (
    <OrgContext.Provider value={{
      orgMember,
      isLoading,
      refresh: fetchMe,
      isSuperadmin,
      canManageMembers:         isSuperadmin || !!orgMember?.role.can_manage_members,
      canViewAllContributions:  isSuperadmin || !!orgMember?.role.can_view_all_contributions,
      canApproveCheckins:       isSuperadmin || !!orgMember?.role.can_approve_checkins,
    }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used inside <OrgProvider>');
  return ctx;
}
