import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../src/app';
import prisma from '../src/lib/db/prisma';
import { clearDatabase, teardown } from './setup';

describe('Invitations Integration Tests', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await teardown();
  });

  async function createAuthenticatedUser(name: string, email: string) {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name, email, password: 'Password123!' });

    const cookie = res.headers['set-cookie'];
    return { user: res.body.user, cookie };
  }

  async function setupWorkspace() {
    const owner = await createAuthenticatedUser('Owner', 'owner@example.com');
    const admin = await createAuthenticatedUser('Admin', 'admin@example.com');
    const member = await createAuthenticatedUser('Member', 'member@example.com');
    const invitee = await createAuthenticatedUser('Invitee', 'invitee@example.com');
    const outsider = await createAuthenticatedUser('Outsider', 'outsider@example.com');

    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', owner.cookie)
      .send({ name: 'Acme Workspace' });

    const workspaceId = wsRes.body.workspace.id;

    await prisma.workspaceMember.create({
      data: {
        userId: admin.user.id,
        workspaceId,
        role: 'ADMIN',
      },
    });

    await prisma.workspaceMember.create({
      data: {
        userId: member.user.id,
        workspaceId,
        role: 'MEMBER',
      },
    });

    return {
      workspaceId,
      owner,
      admin,
      member,
      invitee,
      outsider,
    };
  }

  describe('GET /api/workspaces/:workspaceId/invitations', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/workspaces/some-id/invitations');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should reject MEMBER from viewing invitations (403)', async () => {
      const { workspaceId, member } = await setupWorkspace();

      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', member.cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WORKSPACE_ACCESS_DENIED');
    });

    it('should allow ADMIN to list invitations and not expose tokenHash', async () => {
      const { workspaceId, admin } = await setupWorkspace();

      // Create an invite via POST
      await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', admin.cookie)
        .send({ email: 'newperson@example.com', role: 'MEMBER' });

      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', admin.cookie);

      expect(res.status).toBe(200);
      expect(res.body.invitations).toHaveLength(1);
      expect(res.body.invitations[0].email).toBe('newperson@example.com');
      expect(res.body.invitations[0].role).toBe('MEMBER');
      expect(res.body.invitations[0].tokenHash).toBeUndefined();
      expect(res.body.invitations[0].invitedBy).toHaveProperty('name', 'Admin');
    });
  });

  describe('POST /api/workspaces/:workspaceId/invitations', () => {
    it('should validate email format and role', async () => {
      const { workspaceId, owner } = await setupWorkspace();

      const invalidEmailRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', owner.cookie)
        .send({ email: 'not-an-email', role: 'MEMBER' });

      expect(invalidEmailRes.status).toBe(400);
      expect(invalidEmailRes.body.error.code).toBe('VALIDATION_ERROR');

      const invalidRoleRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', owner.cookie)
        .send({ email: 'valid@example.com', role: 'OWNER' });

      expect(invalidRoleRes.status).toBe(400);
      expect(invalidRoleRes.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject MEMBER from creating invitations (403)', async () => {
      const { workspaceId, member } = await setupWorkspace();

      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', member.cookie)
        .send({ email: 'newperson@example.com', role: 'MEMBER' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WORKSPACE_ACCESS_DENIED');
    });

    it('should create invitation, hash token in DB, and return token once', async () => {
      const { workspaceId, owner } = await setupWorkspace();

      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', owner.cookie)
        .send({ email: 'candidate@example.com', role: 'ADMIN' });

      expect(res.status).toBe(201);
      expect(res.body.invitation).toHaveProperty('token');
      expect(res.body.invitation.email).toBe('candidate@example.com');
      expect(res.body.invitation.role).toBe('ADMIN');

      const rawToken = res.body.invitation.token;
      expect(typeof rawToken).toBe('string');
      expect(rawToken.length).toBe(64); // 32 hex bytes

      // Check DB
      const dbInvite = await prisma.invitation.findUnique({
        where: { id: res.body.invitation.id },
      });
      expect(dbInvite).toBeDefined();
      expect(dbInvite?.tokenHash).not.toBe(rawToken);

      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      expect(dbInvite?.tokenHash).toBe(expectedHash);
    });

    it('should reject inviting an existing workspace member (409)', async () => {
      const { workspaceId, owner } = await setupWorkspace();

      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', owner.cookie)
        .send({ email: 'member@example.com', role: 'MEMBER' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('MEMBER_ALREADY_EXISTS');
    });

    it('should reject duplicate active invite for the same email (409)', async () => {
      const { workspaceId, owner } = await setupWorkspace();

      await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', owner.cookie)
        .send({ email: 'same@example.com', role: 'MEMBER' });

      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', owner.cookie)
        .send({ email: 'same@example.com', role: 'ADMIN' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ACTIVE_INVITATION_EXISTS');
    });

    it('should allow re-inviting if previous invitation is expired', async () => {
      const { workspaceId, owner } = await setupWorkspace();

      // Create an expired invite directly
      const token = 'expiredtoken12345678901234567890';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await prisma.invitation.create({
        data: {
          workspaceId,
          invitedById: owner.user.id,
          email: 'expired@example.com',
          role: 'MEMBER',
          tokenHash,
          expiresAt: new Date(Date.now() - 1000 * 60), // 1 minute ago
        },
      });

      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', owner.cookie)
        .send({ email: 'expired@example.com', role: 'ADMIN' });

      expect(res.status).toBe(201);
      expect(res.body.invitation.role).toBe('ADMIN');
    });
  });

  describe('DELETE /api/workspaces/:workspaceId/invitations/:invitationId', () => {
    it('should allow ADMIN to revoke an invitation (204)', async () => {
      const { workspaceId, admin } = await setupWorkspace();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', admin.cookie)
        .send({ email: 'torevoke@example.com', role: 'MEMBER' });

      const invitationId = createRes.body.invitation.id;

      const deleteRes = await request(app)
        .delete(`/api/workspaces/${workspaceId}/invitations/${invitationId}`)
        .set('Cookie', admin.cookie);

      expect(deleteRes.status).toBe(204);

      const dbInvite = await prisma.invitation.findUnique({
        where: { id: invitationId },
      });
      expect(dbInvite).toBeNull();
    });

    it('should return 404 for non-existent invitation', async () => {
      const { workspaceId, owner } = await setupWorkspace();

      const res = await request(app)
        .delete(`/api/workspaces/${workspaceId}/invitations/non-existent-id`)
        .set('Cookie', owner.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INVITATION_NOT_FOUND');
    });
  });

  describe('GET /api/invitations/:token/preview', () => {
    it('should be accessible without authentication', async () => {
      const { workspaceId, owner } = await setupWorkspace();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', owner.cookie)
        .send({ email: 'preview@example.com', role: 'MEMBER' });

      const token = createRes.body.invitation.token;

      // Unauthenticated request
      const res = await request(app).get(`/api/invitations/${token}/preview`);

      expect(res.status).toBe(200);
      expect(res.body.invitation.email).toBe('preview@example.com');
      expect(res.body.invitation.role).toBe('MEMBER');
      expect(res.body.invitation.workspace.name).toBe('Acme Workspace');
      expect(res.body.invitation.invitedBy.name).toBe('Owner');
    });

    it('should return 404 for invalid token', async () => {
      const res = await request(app).get('/api/invitations/invalid-token/preview');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INVITATION_NOT_FOUND');
    });

    it('should return 400 for expired invitation', async () => {
      const { workspaceId, owner } = await setupWorkspace();

      const rawToken = 'myexpiredtoken123456789012345678';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.invitation.create({
        data: {
          workspaceId,
          invitedById: owner.user.id,
          email: 'expired@example.com',
          role: 'MEMBER',
          tokenHash,
          expiresAt: new Date(Date.now() - 1000 * 60),
        },
      });

      const res = await request(app).get(`/api/invitations/${rawToken}/preview`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVITATION_EXPIRED');
    });
  });

  describe('POST /api/invitations/:token/accept', () => {
    it('should require authentication (401)', async () => {
      const res = await request(app).post('/api/invitations/some-token/accept');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should reject when user email does not match invitation email (403)', async () => {
      const { workspaceId, owner, outsider } = await setupWorkspace();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', owner.cookie)
        .send({ email: 'target@example.com', role: 'MEMBER' });

      const token = createRes.body.invitation.token;

      // Outsider has outsider@example.com
      const res = await request(app)
        .post(`/api/invitations/${token}/accept`)
        .set('Cookie', outsider.cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INVITATION_EMAIL_MISMATCH');
    });

    it('should successfully accept invitation, add member, and consume invitation atomically', async () => {
      const { workspaceId, owner, invitee } = await setupWorkspace();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Cookie', owner.cookie)
        .send({ email: invitee.user.email, role: 'ADMIN' });

      const token = createRes.body.invitation.token;

      const res = await request(app)
        .post(`/api/invitations/${token}/accept`)
        .set('Cookie', invitee.cookie);

      expect(res.status).toBe(200);
      expect(res.body.member.role).toBe('ADMIN');
      expect(res.body.member.userId).toBe(invitee.user.id);

      // Verify member exists in DB
      const member = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: invitee.user.id,
            workspaceId,
          },
        },
      });
      expect(member).toBeDefined();
      expect(member?.role).toBe('ADMIN');

      // Verify invitation was consumed (deleted)
      const dbInvite = await prisma.invitation.findUnique({
        where: { id: createRes.body.invitation.id },
      });
      expect(dbInvite).toBeNull();
    });
  });
});
