import { WorkspaceMember, WorkspaceRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      workspaceMember?: WorkspaceMember & { role: WorkspaceRole };
    }
  }
}
