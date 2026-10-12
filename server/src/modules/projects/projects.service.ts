import { WorkspaceRole } from '@prisma/client';
import prisma from '../../lib/db/prisma';
import { AppError } from '../../errors/app-error';
import { ErrorCode } from '../../errors/error-codes';
import { CreateProjectInput, UpdateProjectInput } from './projects.schemas';

export class ProjectsService {
  async listWorkspaceProjects(
    workspaceId: string,
    userId: string,
    role?: WorkspaceRole
  ) {
    // If user is regular MEMBER, filter by project membership
    const isMember = role === 'MEMBER';

    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
        ...(isMember && {
          OR: [
            {
              members: {
                some: { userId },
              },
            },
            {
              tasks: {
                some: { assigneeId: userId },
              },
            },
          ],
        }),
      },
      include: {
        _count: {
          select: { tasks: true, members: true },
        },
        members: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects;
  }

  async createProject(
    workspaceId: string,
    creatorUserId: string,
    input: CreateProjectInput
  ) {
    return await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId,
          name: input.name,
          description: input.description ?? null,
        },
      });

      // Always add project creator as a member
      const memberIdsToAssign = new Set<string>([creatorUserId]);
      if (input.memberIds && input.memberIds.length > 0) {
        input.memberIds.forEach((id) => memberIdsToAssign.add(id));
      }

      // Verify that all memberIds belong to this workspace
      const validWorkspaceMembers = await tx.workspaceMember.findMany({
        where: {
          workspaceId,
          userId: { in: Array.from(memberIdsToAssign) },
        },
        select: { userId: true },
      });

      const validUserIds = validWorkspaceMembers.map((m) => m.userId);

      if (validUserIds.length > 0) {
        await tx.projectMember.createMany({
          data: validUserIds.map((userId) => ({
            projectId: project.id,
            userId,
          })),
          skipDuplicates: true,
        });
      }

      const createdWithDetails = await tx.project.findUnique({
        where: { id: project.id },
        include: {
          _count: {
            select: { tasks: true, members: true },
          },
          members: {
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      return createdWithDetails!;
    });
  }

  async getProjectById(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: { tasks: true, members: true },
        },
        members: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return project;
  }

  async updateProject(projectId: string, input: UpdateProjectInput) {
    return await prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id: projectId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
        },
        include: {
          _count: {
            select: { tasks: true, members: true },
          },
        },
      });

      if (input.memberIds !== undefined) {
        // Sync members
        const validWorkspaceMembers = await tx.workspaceMember.findMany({
          where: {
            workspaceId: project.workspaceId,
            userId: { in: input.memberIds },
          },
          select: { userId: true },
        });

        const validUserIds = validWorkspaceMembers.map((m) => m.userId);

        // Delete members not in list
        await tx.projectMember.deleteMany({
          where: {
            projectId,
            userId: { notIn: validUserIds },
          },
        });

        // Insert new members
        if (validUserIds.length > 0) {
          await tx.projectMember.createMany({
            data: validUserIds.map((userId) => ({
              projectId,
              userId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return await tx.project.findUnique({
        where: { id: projectId },
        include: {
          _count: {
            select: { tasks: true, members: true },
          },
          members: {
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async deleteProject(projectId: string) {
    await prisma.project.delete({
      where: { id: projectId },
    });
  }

  async getProjectMembers(projectId: string) {
    return await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addProjectMember(
    projectId: string,
    targetUserId: string,
    workspaceId: string
  ) {
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId,
        },
      },
    });

    if (!wsMember) {
      throw AppError.badRequest(
        'User must be a member of the workspace to join the project.',
        ErrorCode.VALIDATION_ERROR
      );
    }

    return await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
      create: {
        projectId,
        userId: targetUserId,
      },
      update: {},
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async removeProjectMember(projectId: string, targetUserId: string) {
    await prisma.$transaction(async (tx) => {
      await tx.projectMember.deleteMany({
        where: {
          projectId,
          userId: targetUserId,
        },
      });

      // Clear task assignments for removed member in this project
      await tx.task.updateMany({
        where: {
          projectId,
          assigneeId: targetUserId,
        },
        data: {
          assigneeId: null,
        },
      });
    });
  }
}

export const projectsService = new ProjectsService();
