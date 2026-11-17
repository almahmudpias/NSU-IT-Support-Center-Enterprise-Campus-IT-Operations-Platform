import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { isEngineerOnly, isSuper, isAdmin } from '../lib/rbac';

const WorkspaceContext = createContext({
  workspace: 'all', // all | 1400 | 6004
  setWorkspace: () => {},
  allowedWorkspaces: ['all', '1400', '6004'],
});

export function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const engineer = isEngineerOnly(user);

  const allowedWorkspaces = useMemo(() => {
    if (engineer) return ['6004'];
    if (isSuper(user) || isAdmin(user)) return ['all', '1400', '6004'];
    return ['6004'];
  }, [user, engineer]);

  const [workspace, setWorkspaceState] = useState(engineer ? '6004' : 'all');

  useEffect(() => {
    if (engineer) setWorkspaceState('6004');
    else if (!allowedWorkspaces.includes(workspace)) setWorkspaceState(allowedWorkspaces[0]);
  }, [engineer, allowedWorkspaces, workspace]);

  function setWorkspace(w) {
    if (allowedWorkspaces.includes(w)) setWorkspaceState(w);
  }

  return (
    <WorkspaceContext.Provider value={{ workspace, setWorkspace, allowedWorkspaces }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
