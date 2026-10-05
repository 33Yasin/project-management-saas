import { Request, Response, NextFunction } from 'express';
import { membersService } from './members.service';

function getParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

export class MembersController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = getParam(req.params.workspaceId);
      const members = await membersService.listMembers(workspaceId);
      res.status(200).json({ members });
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = getParam(req.params.workspaceId);
      const memberId = getParam(req.params.memberId);
      const updatedMember = await membersService.updateRole({
        workspaceId,
        memberId,
        newRole: req.body.role,
        actorId: req.session.userId!,
        actorRole: req.workspaceMember!.role,
      });
      res.status(200).json({ member: updatedMember });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = getParam(req.params.workspaceId);
      const memberId = getParam(req.params.memberId);
      await membersService.removeMember({
        workspaceId,
        memberId,
        actorId: req.session.userId!,
        actorRole: req.workspaceMember!.role,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const membersController = new MembersController();
