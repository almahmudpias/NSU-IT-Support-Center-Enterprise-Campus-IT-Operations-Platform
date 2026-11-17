import { Routes, Route, Navigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { canAccess, homePathFor } from './lib/rbac';
import { WorkspaceProvider } from './context/WorkspaceContext';
import LoginPage from './pages/Login';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/dashboard/Dashboard';
import IncidentStream from './pages/IncidentStream';
import TicketNew from './pages/TicketNew';
import Pipeline from './pages/Pipeline';
import Lab from './pages/Lab';
import TicketDetail from './pages/TicketDetail';
import UsersPage from './pages/Users';
import UserNewPage from './pages/UserNew';
import UserDetailPage from './pages/UserDetail';
import UserEditPage from './pages/UserEdit';
import SettingsPage from './pages/Settings';
import EventsList from './pages/events/EventsList';
import EventDetail from './pages/events/EventDetail';
import EventNew from './pages/events/EventNew';
import EventEdit from './pages/events/EventEdit';
import PublicEventView from './pages/events/PublicEventView';
import ErrorBoundary from './components/ErrorBoundary';
import CompletedWork from './pages/CompletedWork';
import MyWorkPage from './pages/MyWork';
import EngineerReportsPage from './pages/EngineerReports';
import CampusPoolPage from './pages/CampusPool';
import EngineerTicketSubmitPage from './pages/EngineerTicketSubmit';
import RequestersPage from './pages/Requesters';
import ReportsPage from './pages/Reports';
import EngineerPerformancePage from './pages/EngineerPerformance';


function LegacyEventEditRedirect() {
  const { id } = useParams();
  return <Navigate to={`/events/${id}?action=edit`} replace />;
}

function EventResource() {
  const [params] = useSearchParams();
  const { id } = useParams();
  const action = (params.get('action') || 'view').toLowerCase();
  const rk = `event:${id}:${action}`;
  if (action === 'edit') {
    return (
      <ErrorBoundary homeTo="/events" resetKey={rk}>
        <EventEdit />
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary homeTo="/events" resetKey={rk}>
      <EventDetail />
    </ErrorBoundary>
  );
}

function TicketResource() {
  const [params] = useSearchParams();
  const { id } = useParams();
  const action = params.get('action') || 'view';
  return (
    <ErrorBoundary homeTo="/campus-support" resetKey={`ticket:${id}:${action}`}>
      <TicketDetail />
    </ErrorBoundary>
  );
}

/** Staff: /users/:id?action=edit → UserEdit, otherwise UserDetail (same pattern as events) */
function StaffResource() {
  const [params] = useSearchParams();
  const action = (params.get('action') || 'view').toLowerCase();
  if (action === 'edit') {
    return (
      <ErrorBoundary homeTo="/users" resetKey="staff-edit">
        <UserEditPage />
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary homeTo="/users" resetKey="staff-view">
      <UserDetailPage />
    </ErrorBoundary>
  );
}

function LegacyStaffEditRedirect() {
  const { id } = useParams();
  return <Navigate to={`/users/${id}?action=edit`} replace />;
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0B0F19]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RoleGate({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!canAccess(user, location.pathname)) {
    return <Navigate to={homePathFor()} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
        <Route path="/e/:token" element={<PublicEventView />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <WorkspaceProvider>
              <AppShell />
            </WorkspaceProvider>
          </Protected>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <RoleGate>
              <Dashboard />
            </RoleGate>
          }
        />
        {/* Campus Support (was 1400) */}
        <Route
          path="campus-support"
          element={
            <RoleGate>
              <IncidentStream />
            </RoleGate>
          }
        />
        <Route
          path="campus-support/new"
          element={
            <RoleGate>
              <TicketNew />
            </RoleGate>
          }
        />
        <Route
          path="campus-support/pipeline"
          element={
            <RoleGate>
              <Pipeline />
            </RoleGate>
          }
        />
        {/* Support Workstation (was 6004) */}
        <Route
          path="support-workstation"
          element={
            <RoleGate>
              <Lab />
            </RoleGate>
          }
        />
        <Route
          path="support-workstation/queue"
          element={
            <RoleGate>
              <Lab />
            </RoleGate>
          }
        />
        <Route
          path="support-workstation/my-work"
          element={
            <RoleGate>
              <Lab />
            </RoleGate>
          }
        />
        {/* Legacy numeric paths → named paths (bookmarks still work) */}
        <Route path="1400" element={<Navigate to="/campus-support" replace />} />
        <Route path="1400/new" element={<Navigate to="/campus-support/new" replace />} />
        <Route path="1400/pipeline" element={<Navigate to="/campus-support/pipeline" replace />} />
        <Route path="6004" element={<Navigate to="/support-workstation" replace />} />
        <Route path="6004/queue" element={<Navigate to="/support-workstation/queue" replace />} />
        <Route path="6004/my-work" element={<Navigate to="/support-workstation/my-work" replace />} />
        {/* Shared ticket detail */}
        <Route
          path="tickets/:id"
          element={
            <RoleGate>
              <TicketResource />
            </RoleGate>
          }
        />
        {/* Management */}

        <Route
          path="events"
          element={
            <RoleGate>
              <ErrorBoundary homeTo="/dashboard" resetKey="events-list">
                <EventsList />
              </ErrorBoundary>
            </RoleGate>
          }
        />
        <Route
          path="events/new"
          element={
            <RoleGate>
              <ErrorBoundary homeTo="/events" resetKey="events-new">
                <EventNew />
              </ErrorBoundary>
            </RoleGate>
          }
        />
        <Route
          path="events/:id"
          element={
            <RoleGate>
              <EventResource />
            </RoleGate>
          }
        />
        {/* Legacy edit path → UUID resource + ?action=edit */}
        <Route
          path="events/:id/edit"
          element={<LegacyEventEditRedirect />}
        />
        <Route
          path="my-work"
          element={
            <RoleGate>
              <MyWorkPage />
            </RoleGate>
          }
        />
        <Route
          path="campus-pool"
          element={
            <RoleGate>
              <CampusPoolPage />
            </RoleGate>
          }
        />
        <Route
          path="submit-ticket"
          element={
            <RoleGate>
              <EngineerTicketSubmitPage />
            </RoleGate>
          }
        />
        <Route
          path="my-reports"
          element={
            <RoleGate>
              <EngineerReportsPage />
            </RoleGate>
          }
        />
        <Route
          path="completed"
          element={
            <RoleGate>
              <CompletedWork />
            </RoleGate>
          }
        />
        <Route
          path="requesters"
          element={
            <RoleGate>
              <RequestersPage />
            </RoleGate>
          }
        />
        <Route
          path="requesters/:id"
          element={
            <RoleGate>
              <RequestersPage />
            </RoleGate>
          }
        />
        <Route
          path="reports"
          element={
            <RoleGate>
              <ReportsPage />
            </RoleGate>
          }
        />
        <Route
          path="reports/engineers"
          element={
            <RoleGate>
              <EngineerPerformancePage />
            </RoleGate>
          }
        />
        <Route
          path="users"
          element={
            <RoleGate>
              <UsersPage />
            </RoleGate>
          }
        />
        <Route
          path="users/new"
          element={
            <RoleGate>
              <UserNewPage />
            </RoleGate>
          }
        />
        <Route
          path="users/:id"
          element={
            <RoleGate>
              <StaffResource />
            </RoleGate>
          }
        />
        {/* Legacy path → same resource + ?action=edit */}
        <Route
          path="users/:id/edit"
          element={
            <RoleGate>
              <LegacyStaffEditRedirect />
            </RoleGate>
          }
        />
        <Route
          path="settings"
          element={
            <RoleGate>
              <SettingsPage />
            </RoleGate>
          }
        />
      </Route>
      {/* Legacy redirects */}
      <Route path="/lab" element={<Navigate to="/support-workstation" replace />} />
      <Route path="/pipeline" element={<Navigate to="/campus-support/pipeline" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
