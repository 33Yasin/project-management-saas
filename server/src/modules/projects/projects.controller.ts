import { Request, Response, NextFunction } from 'express';
import { projectsService } from './projects.service';

function getParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

export class ProjectsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = getParam(req.params.workspaceId);
      const projects = await projectsService.listWorkspaceProjects(workspaceId);
      res.status(200).json({ projects });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = getParam(req.params.workspaceId);
      const project = await projectsService.createProject(workspaceId, req.body);
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
}

export const projectsController = new ProjectsController();
