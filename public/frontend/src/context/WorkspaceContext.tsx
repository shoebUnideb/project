import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { workspacesApi } from '../api/workspaces';
import type { Workspace } from '../types';

interface WorkspaceContextValue {
  workspace: Workspace | null;
  loading: boolean;
  error: boolean;
  refetch: () => void;
  isOwner: boolean;
  isMember: boolean;
  isMentor: boolean;
}

const WorkspaceCtx = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceContext');
  return ctx;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetch = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(false);
    try {
      const data = await workspacesApi.getBySlug(slug);
      setWorkspace(data);
    } catch {
      setError(true);
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetch(); }, [fetch]);

  const isOwner  = workspace?.my_status === 'owner';
  const isMentor = workspace?.my_status === 'mentor';
  const isMember = ['owner', 'approved', 'mentor'].includes(workspace?.my_status ?? '');

  return (
    <WorkspaceCtx.Provider value={{
      workspace, loading, error, refetch: fetch,
      isOwner, isMember, isMentor,
    }}>
      {children}
    </WorkspaceCtx.Provider>
  );
}
