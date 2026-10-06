import { WorkspaceMember, WorkspaceRole, Project, Task } from '@prisma/client';

export type TaskWithProject = Task & {
  project: {
    id: string;
    workspaceId: string;
  };
};

declare global {
  namespace Express {
    interface Request {
      workspaceMember?: WorkspaceMember & { role: WorkspaceRole };
      project?: Project;
      task?: TaskWithProject;
    }
  }
}
