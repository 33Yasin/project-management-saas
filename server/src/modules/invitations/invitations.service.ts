import crypto from 'crypto';
import prisma from '../../lib/db/prisma';
import { AppError } from '../../errors/app-error';
import { ErrorCode } from '../../errors/error-codes';
import { emailService } from '../../lib/email/email.service';
import { logger } from '../../lib/logger';

export class InvitationsService {
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async listInvitations(workspaceId: string) {
    const invitations = await prisma.invitation.findMany({
      where: { workspaceId },
      select: {
        id: true,
        workspaceId: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations;
  }

  async createInvitation(params: {
    workspaceId: string;
    invitedById: string;
    email: string;
    role: 'ADMIN' | 'MEMBER';
  }) {
    const normalizedEmail = params.email.toLowerCase().trim();

    // Check if user is already a member of the workspace
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: params.workspaceId,
        user: { email: normalizedEmail },
      },
    });

    if (existingMember) {
      throw AppError.conflict(
        'User is already a member of this workspace.',
        ErrorCode.MEMBER_ALREADY_EXISTS
      );
    }

    // Check if an invitation already exists for this email
    const existingInvite = await prisma.invitation.findUnique({
      where: {
        workspaceId_email: {
          workspaceId: params.workspaceId,
          email: normalizedEmail,
        },
      },
    });

    if (existingInvite) {
      if (existingInvite.expiresAt > new Date()) {
        throw AppError.conflict(
          'An active invitation already exists for this email.',
          ErrorCode.ACTIVE_INVITATION_EXISTS
        );
      }
      // If expired, delete it so we can create a fresh one
      await prisma.invitation.delete({
        where: { id: existingInvite.id },
      });
    }

    // 256-bit cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiration

    const invitation = await prisma.invitation.create({
      data: {
        workspaceId: params.workspaceId,
        invitedById: params.invitedById,
        email: normalizedEmail,
        role: params.role,
        tokenHash,
        expiresAt,
      },
      select: {
        id: true,
        workspaceId: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // Query inviter and workspace metadata to compose personalized invitation email
    const [inviter, workspace] = await Promise.all([
      prisma.user.findUnique({
        where: { id: params.invitedById },
        select: { name: true },
      }),
      prisma.workspace.findUnique({
        where: { id: params.workspaceId },
        select: { name: true },
      }),
    ]);

    const appUrl = process.env.APP_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const inviteUrl = `${appUrl}/invitations/${rawToken}`;

    // Deliver email asynchronously outside of DB transaction; log failures without leaking details
    try {
      await emailService.sendInvitationEmail({
        to: normalizedEmail,
        inviterName: inviter?.name || 'A team member',
        workspaceName: workspace?.name || 'their workspace',
        inviteUrl,
        role: params.role,
        expiresAt,
      });
    } catch (err) {
      logger.error('Failed to deliver invitation email', {
        err: err instanceof Error ? err.message : String(err),
        recipient: normalizedEmail,
      });
    }

    return {
      ...invitation,
      token: rawToken, // Returned ONLY once at creation
    };
  }

  async revokeInvitation(params: { workspaceId: string; invitationId: string }) {
    const invitation = await prisma.invitation.findFirst({
      where: {
        id: params.invitationId,
        workspaceId: params.workspaceId,
      },
    });

    if (!invitation) {
      throw AppError.notFound('Invitation not found.', ErrorCode.INVITATION_NOT_FOUND);
    }

    await prisma.invitation.delete({
      where: { id: params.invitationId },
    });
  }

  async previewInvitation(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invitation) {
      throw AppError.notFound('Invitation not found or invalid.', ErrorCode.INVITATION_NOT_FOUND);
    }

    if (invitation.expiresAt <= new Date()) {
      throw AppError.badRequest('This invitation has expired.', ErrorCode.INVITATION_EXPIRED);
    }

    return invitation;
  }

  async acceptInvitation(params: { rawToken: string; userId: string }) {
    const tokenHash = this.hashToken(params.rawToken);

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
    });

    if (!user) {
      throw AppError.unauthenticated('User not found.', ErrorCode.AUTH_REQUIRED);
    }

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      throw AppError.notFound('Invitation not found or invalid.', ErrorCode.INVITATION_NOT_FOUND);
    }

    if (invitation.expiresAt <= new Date()) {
      throw AppError.badRequest('This invitation has expired.', ErrorCode.INVITATION_EXPIRED);
    }

    // Authenticated user's email must match the invitation email
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw AppError.unauthorized(
        'This invitation was sent to a different email address.',
        ErrorCode.INVITATION_EMAIL_MISMATCH
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: invitation.workspaceId,
        },
      },
    });

    if (existingMember) {
      await prisma.invitation.delete({ where: { id: invitation.id } });
      throw AppError.conflict(
        'You are already a member of this workspace.',
        ErrorCode.MEMBER_ALREADY_EXISTS
      );
    }

    // Atomic transaction: create membership + consume invitation
    const [newMember] = await prisma.$transaction([
      prisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        },
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.invitation.delete({
        where: { id: invitation.id },
      }),
    ]);

    return newMember;
  }
}

export const invitationsService = new InvitationsService();
