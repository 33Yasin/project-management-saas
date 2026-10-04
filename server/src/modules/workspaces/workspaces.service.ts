import { WorkspaceRole } from '@prisma/client';
import prisma from '../../lib/db/prisma';
import { AppError } from '../../errors/app-error';
import { ErrorCode } from '../../errors/error-codes';
import { CreateWorkspaceInput, UpdateWorkspaceInput } from './workspaces.schemas';

export interface WorkspaceResponse {
  id: string;
  name: string;
  role: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
}

export class WorkspacesService {
  async getUserWorkspaces(userId: string): Promise<WorkspaceResponse[]> {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
      createdAt: m.workspace.createdAt,
      updatedAt: m.workspace.updatedAt,
    }));
  }

  async createWorkspace(userId: string, input: CreateWorkspaceInput): Promise<WorkspaceResponse> {
    return await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: input.name.trim(),
        },
      });

      const member = await tx.workspaceMember.create({
        data: {
          userId,
          workspaceId: workspace.id,
          role: 'OWNER',
        },
      });

      return {
        id: workspace.id,
        name: workspace.name,
        role: member.role,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      };
    });
  }

  async getWorkspaceById(workspaceId: string, userId: string): Promise<WorkspaceResponse> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { userId },
        },
      },
    });

    if (!workspace || workspace.members.length === 0) {
      throw AppError.notFound(
        'Workspace not found or access denied.',
        ErrorCode.WORKSPACE_NOT_FOUND
      );
    }

    return {
      id: workspace.id,
      name: workspace.name,
      role: workspace.members[0].role,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  async updateWorkspace(
    workspaceId: string,
    input: UpdateWorkspaceInput,
    userRole: WorkspaceRole
  ): Promise<WorkspaceResponse> {
    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: input.name.trim(),
      },
    });

    return {
      id: workspace.id,
      name: workspace.name,
      role: userRole,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    await prisma.workspace.delete({
      where: { id: workspaceId },
    });
  }

  async transferOwnership(
    workspaceId: string,
    currentOwnerId: string,
    targetUserId: string
  ): Promise<void> {
    if (currentOwnerId === targetUserId) {
      throw AppError.badRequest(
        'You are already the owner of this workspace.',
        ErrorCode.VALIDATION_ERROR
      );
    }

    const targetMembership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId,
        },
      },
    });

    if (!targetMembership) {
      throw AppError.badRequest(
        'Target user must be a member of this workspace to become the owner.',
        ErrorCode.INVALID_ASSIGNEE
      );
    }

    // Execute atomic role transfer in order to obey the partial unique index (at most 1 OWNER per workspace)
    await prisma.$transaction(async (tx) => {
      // 1. Demote current owner to ADMIN
      await tx.workspaceMember.update({
        where: {
          userId_workspaceId: {
            userId: currentOwnerId,
            workspaceId,
          },
        },
        data: { role: 'ADMIN' },
      });

      // 2. Promote target member to OWNER
      await tx.workspaceMember.update({
        where: {
          userId_workspaceId: {
            userId: targetUserId,
            workspaceId,
          },
        },
        data: { role: 'OWNER' },
      });
    });
  }
}

export const workspacesService = new WorkspacesService();
