import { Request, Response, NextFunction } from 'express';
import { projectsService } from './projects.service';

function getParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

export class ProjectsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = getParam(req.params.workspaceId);
      const userId = req.session!.userId!;
      const role = req.workspaceMember?.role;
      const projects = await projectsService.listWorkspaceProjects(
        workspaceId,
        userId,
        role
      );
      res.status(200).json({ projects });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = getParam(req.params.workspaceId);
      const userId = req.session!.userId!;
      const project = await projectsService.createProject(
        workspaceId,
        userId,
        req.body
      );
      res.status(201).json({ project });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectId = getParam(req.params.projectId);
      const project = await projectsService.getProjectById(projectId);
      res.status(200).json({ project });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectId = getParam(req.params.projectId);
      const project = await projectsService.updateProject(projectId, req.body);
      res.status(200).json({ project });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectId = getParam(req.params.projectId);
      await projectsService.deleteProject(projectId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectId = getParam(req.params.projectId);
      const members = await projectsService.getProjectMembers(projectId);
      res.status(200).json({ members });
    } catch (error) {
      next(error);
    }
  }

  async addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectId = getParam(req.params.projectId);
      const project = req.project!;
      const member = await projectsService.addProjectMember(
        projectId,
        req.body.userId,
        project.workspaceId
      );
      res.status(201).json({ member });
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectId = getParam(req.params.projectId);
      const targetUserId = getParam(req.params.userId);
      await projectsService.removeProjectMember(projectId, targetUserId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const projectsController = new ProjectsController();
