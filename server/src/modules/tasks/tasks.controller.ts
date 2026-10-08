import { Request, Response, NextFunction } from 'express';
import { tasksService } from './tasks.service';
import { TaskListQueryInput } from './tasks.schemas';

function getParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

export class TasksController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectId = getParam(req.params.projectId);
      const result = await tasksService.listProjectTasks(
        projectId,
        req.query as unknown as TaskListQueryInput
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectId = getParam(req.params.projectId);
      const workspaceId = req.project!.workspaceId;
      const task = await tasksService.createTask({
        projectId,
        workspaceId,
        createdById: req.session.userId!,
        input: req.body,
      });
      res.status(201).json({ task });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = getParam(req.params.taskId);
      const task = await tasksService.getTaskById(taskId);
      res.status(200).json({ task });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = getParam(req.params.taskId);
      const workspaceId = req.task!.project.workspaceId;
      const task = await tasksService.updateTask({
        taskId,
        workspaceId,
        actorId: req.session.userId,
        input: req.body,
      });
      res.status(200).json({ task });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = getParam(req.params.taskId);
      await tasksService.deleteTask(taskId, req.session.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async move(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = getParam(req.params.taskId);
      const { status, targetIndex } = req.body;
      const task = await tasksService.moveTask({
        taskId,
        targetIndex,
        newStatus: status,
        actorId: req.session.userId,
      });
      res.status(200).json({ task });
    } catch (error) {
      next(error);
    }
  }
}

export const tasksController = new TasksController();
