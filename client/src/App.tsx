import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
              <Route path="/workspaces/:workspaceId/members" element={<MembersPage />} />
              <Route path="/workspaces/:workspaceId/settings" element={<SettingsPage />} />

              <Route
                path="/projects/:projectId"
                element={<Navigate to="tasks" replace />}
              />
              <Route path="/projects/:projectId/tasks" element={<ProjectTasksPage />} />
              <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/workspaces" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
