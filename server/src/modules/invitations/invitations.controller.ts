import { Request, Response, NextFunction } from 'express';
import { invitationsService } from './invitations.service';

function getParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

export class InvitationsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = getParam(req.params.workspaceId);
      const invitations = await invitationsService.listInvitations(workspaceId);
      res.status(200).json({ invitations });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = getParam(req.params.workspaceId);
      const invitation = await invitationsService.createInvitation({
        workspaceId,
        invitedById: req.session.userId!,
        email: req.body.email,
        role: req.body.role,
      });
      res.status(201).json({ invitation });
    } catch (error) {
      next(error);
    }
  }

  async revoke(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = getParam(req.params.workspaceId);
      const invitationId = getParam(req.params.invitationId);
      await invitationsService.revokeInvitation({ workspaceId, invitationId });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async preview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = getParam(req.params.token);
      const invitation = await invitationsService.previewInvitation(token);
      res.status(200).json({ invitation });
    } catch (error) {
      next(error);
    }
  }

  async accept(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = getParam(req.params.token);
      const member = await invitationsService.acceptInvitation({
        rawToken: token,
        userId: req.session.userId!,
      });
      res.status(200).json({
        message: 'Invitation accepted successfully.',
        member,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const invitationsController = new InvitationsController();
