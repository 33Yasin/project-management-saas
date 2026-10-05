import prisma from '../../lib/db/prisma';
import { CreateProjectInput, UpdateProjectInput } from './projects.schemas';

export class ProjectsService {
  async listWorkspaceProjects(workspaceId: string) {
    const projects = await prisma.project.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects;
  }

  async createProject(workspaceId: string, input: CreateProjectInput) {
    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: input.name,
        description: input.description ?? null,
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    return project;
  }

  async getProjectById(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    return project;
  }

  async updateProject(projectId: string, input: UpdateProjectInput) {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    return project;
  }

  async deleteProject(projectId: string) {
    await prisma.project.delete({
      where: { id: projectId },
    });
  }
}

export const projectsService = new ProjectsService();
