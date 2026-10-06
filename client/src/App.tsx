import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { ThemeProvider } from '@/lib/theme';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';

import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import InvitationPage from '@/pages/invitations/InvitationPage';

import AppLayout from '@/layouts/AppLayout';
import WorkspacesPage from '@/pages/workspaces/WorkspacesPage';
import MembersPage from '@/pages/workspaces/MembersPage';
import SettingsPage from '@/pages/workspaces/SettingsPage';
import ProjectsPage from '@/pages/projects/ProjectsPage';
import ProjectTasksPage from '@/pages/tasks/ProjectTasksPage';
import TaskDetailPage from '@/pages/tasks/TaskDetailPage';

import { useParams } from 'react-router-dom';
import { useProject } from '@/features/projects/use-projects';
import { useTask } from '@/features/tasks/use-tasks';

function ProjectRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, isLoading, isError } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">Loading project...</p>
      </div>
    );
  }
  if (isError || !project) {
    return <Navigate to="/workspaces" replace />;
  }
  return (
    <Navigate
      to={`/workspaces/${project.workspaceId}/projects/${project.id}/tasks`}
      replace
    />
  );
}

function TaskRedirect() {
  const { taskId } = useParams<{ taskId: string }>();
  const { task, isLoading, isError } = useTask(taskId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">Loading task...</p>
      </div>
    );
  }
  const workspaceId = task?.project?.workspaceId;
  if (isError || !task || !workspaceId) {
    return <Navigate to="/workspaces" replace />;
  }
  return (
    <Navigate
      to={`/workspaces/${workspaceId}/projects/${task.projectId}/tasks/${task.id}`}
      replace
    />
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="agora-theme">
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/invitations/:token" element={<InvitationPage />} />

            {/* Protected App Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/workspaces" replace />} />
                <Route path="/workspaces" element={<WorkspacesPage />} />
                <Route
                  path="/workspaces/:workspaceId"
                  element={<Navigate to="projects" replace />}
                />
                <Route path="/workspaces/:workspaceId/projects" element={<ProjectsPage />} />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId"
                  element={<Navigate to="tasks" replace />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId/tasks"
                  element={<ProjectTasksPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId/tasks/:taskId"
                  element={<TaskDetailPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/tasks/:taskId"
                  element={<TaskDetailPage />}
                />
                <Route path="/workspaces/:workspaceId/members" element={<MembersPage />} />
                <Route path="/workspaces/:workspaceId/settings" element={<SettingsPage />} />

                {/* Legacy / Direct Link Redirects */}
                <Route path="/projects/:projectId" element={<ProjectRedirect />} />
                <Route path="/projects/:projectId/tasks" element={<ProjectRedirect />} />
                <Route path="/tasks/:taskId" element={<TaskRedirect />} />
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/workspaces" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
