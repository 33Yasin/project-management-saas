import { Request, Response, NextFunction } from 'express';
import { workspacesService } from './workspaces.service';

function getParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

export class WorkspacesController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaces = await workspacesService.getUserWorkspaces(req.session.userId!);
      res.status(200).json({ workspaces });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspace = await workspacesService.createWorkspace(
        req.session.userId!,
        req.body
      );
      res.status(201).json({ workspace });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspace = await workspacesService.getWorkspaceById(
        getParam(req.params.workspaceId),
        req.session.userId!
      );
      res.status(200).json({ workspace });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspace = await workspacesService.updateWorkspace(
        getParam(req.params.workspaceId),
        req.body,
        req.workspaceMember!.role
      );
      res.status(200).json({ workspace });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await workspacesService.deleteWorkspace(getParam(req.params.workspaceId));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async transferOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await workspacesService.transferOwnership(
        getParam(req.params.workspaceId),
        req.session.userId!,
        req.body.targetUserId
      );
      res.status(200).json({ message: 'Ownership transferred successfully.' });
    } catch (error) {
      next(error);
    }
  }
}

export const workspacesController = new WorkspacesController();
