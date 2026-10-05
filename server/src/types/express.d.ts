import { WorkspaceMember, WorkspaceRole, Project, Task } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      workspaceMember?: WorkspaceMember & { role: WorkspaceRole };
      project?: Project;
      task?: Task;
    }
  }
}
