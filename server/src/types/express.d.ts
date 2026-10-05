import { WorkspaceMember, WorkspaceRole, Project } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      workspaceMember?: WorkspaceMember & { role: WorkspaceRole };
      project?: Project;
    }
  }
}
