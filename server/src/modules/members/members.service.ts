import { WorkspaceRole } from '@prisma/client';
import prisma from '../../lib/db/prisma';
import { AppError } from '../../errors/app-error';
import { ErrorCode } from '../../errors/error-codes';

export class MembersService {
  async listMembers(workspaceId: string) {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
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

    return members;
  }

  async updateRole(params: {
    workspaceId: string;
    memberId: string;
    newRole: 'ADMIN' | 'MEMBER';
    actorId: string;
    actorRole: WorkspaceRole;
  }) {
    const { workspaceId, memberId, newRole, actorId } = params;

    const targetMember = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
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

    if (!targetMember) {
      throw AppError.notFound('Member not found in this workspace.', ErrorCode.MEMBER_NOT_FOUND);
    }

    // Owner's role cannot be changed via this endpoint
    if (targetMember.role === 'OWNER') {
      throw AppError.badRequest(
        'Cannot change the role of the workspace owner. Use transfer ownership instead.',
        ErrorCode.CANNOT_CHANGE_OWNER_ROLE
      );
    }

    // Cannot change your own role
    if (targetMember.userId === actorId) {
      throw AppError.badRequest(
        'You cannot change your own role.',
        ErrorCode.CANNOT_CHANGE_OWNER_ROLE
      );
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: newRole },
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

    return updated;
  }

  async removeMember(params: {
    workspaceId: string;
    memberId: string;
    actorId: string;
    actorRole: WorkspaceRole;
  }) {
    const { workspaceId, memberId } = params;

    const targetMember = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });

    if (!targetMember) {
      throw AppError.notFound('Member not found in this workspace.', ErrorCode.MEMBER_NOT_FOUND);
    }

    // Owner cannot be removed
    if (targetMember.role === 'OWNER') {
      throw AppError.badRequest(
        'Cannot remove the workspace owner. Transfer ownership or delete the workspace.',
        ErrorCode.CANNOT_REMOVE_OWNER
      );
    }

    await prisma.workspaceMember.delete({
      where: { id: memberId },
    });
  }
}

export const membersService = new MembersService();
