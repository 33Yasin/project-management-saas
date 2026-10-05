import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/lib/db/prisma';
import { clearDatabase, teardown } from './setup';

describe('Members & Role Management Integration Tests', () => {
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

  async function setupWorkspaceWithMembers() {
    const owner = await createAuthenticatedUser('Owner', 'owner@example.com');
    const admin = await createAuthenticatedUser('Admin', 'admin@example.com');
    const member = await createAuthenticatedUser('Member', 'member@example.com');
    const outsider = await createAuthenticatedUser('Outsider', 'outsider@example.com');

    // Owner creates workspace
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', owner.cookie)
      .send({ name: 'Acme Workspace' });

    const workspaceId = wsRes.body.workspace.id;

    // Add admin and member directly to DB
    const adminMember = await prisma.workspaceMember.create({
      data: {
        userId: admin.user.id,
        workspaceId,
        role: 'ADMIN',
      },
    });

    const standardMember = await prisma.workspaceMember.create({
      data: {
        userId: member.user.id,
        workspaceId,
        role: 'MEMBER',
      },
    });

    const ownerMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: owner.user.id,
          workspaceId,
        },
      },
    });

    return {
      workspaceId,
      owner: { ...owner, memberId: ownerMember!.id },
      admin: { ...admin, memberId: adminMember.id },
      member: { ...member, memberId: standardMember.id },
      outsider,
    };
  }

  describe('GET /api/workspaces/:workspaceId/members', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/workspaces/some-id/members');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should return 404 for outsider (not leaking existence)', async () => {
      const { workspaceId, outsider } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/members`)
        .set('Cookie', outsider.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('WORKSPACE_NOT_FOUND');
    });

    it('should allow MEMBER to view members list', async () => {
      const { workspaceId, member } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/members`)
        .set('Cookie', member.cookie);

      expect(res.status).toBe(200);
      expect(res.body.members).toHaveLength(3);
      expect(res.body.members[0]).toHaveProperty('user');
      expect(res.body.members[0].user).toHaveProperty('name');
      expect(res.body.members[0].user).toHaveProperty('email');
    });

    it('should allow ADMIN and OWNER to view members list', async () => {
      const { workspaceId, owner, admin } = await setupWorkspaceWithMembers();

      const ownerRes = await request(app)
        .get(`/api/workspaces/${workspaceId}/members`)
        .set('Cookie', owner.cookie);
      expect(ownerRes.status).toBe(200);

      const adminRes = await request(app)
        .get(`/api/workspaces/${workspaceId}/members`)
        .set('Cookie', admin.cookie);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.members).toHaveLength(3);
    });
  });

  describe('PATCH /api/workspaces/:workspaceId/members/:memberId', () => {
    it('should reject MEMBER from modifying roles (403)', async () => {
      const { workspaceId, member, admin } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}/members/${admin.memberId}`)
        .set('Cookie', member.cookie)
        .send({ role: 'MEMBER' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WORKSPACE_ACCESS_DENIED');
    });

    it('should reject role value OWNER via validation (400)', async () => {
      const { workspaceId, owner, member } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}/members/${member.memberId}`)
        .set('Cookie', owner.cookie)
        .send({ role: 'OWNER' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent changing the role of the OWNER', async () => {
      const { workspaceId, admin, owner } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}/members/${owner.memberId}`)
        .set('Cookie', admin.cookie)
        .send({ role: 'MEMBER' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_CHANGE_OWNER_ROLE');
    });

    it('should prevent user from changing their own role', async () => {
      const { workspaceId, admin } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}/members/${admin.memberId}`)
        .set('Cookie', admin.cookie)
        .send({ role: 'MEMBER' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_CHANGE_OWNER_ROLE');
    });

    it('should allow OWNER to promote MEMBER to ADMIN', async () => {
      const { workspaceId, owner, member } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}/members/${member.memberId}`)
        .set('Cookie', owner.cookie)
        .send({ role: 'ADMIN' });

      expect(res.status).toBe(200);
      expect(res.body.member.role).toBe('ADMIN');

      const dbMember = await prisma.workspaceMember.findUnique({
        where: { id: member.memberId },
      });
      expect(dbMember?.role).toBe('ADMIN');
    });

    it('should allow ADMIN to demote another ADMIN to MEMBER', async () => {
      const { workspaceId, admin, member } = await setupWorkspaceWithMembers();

      // First promote member to admin
      await prisma.workspaceMember.update({
        where: { id: member.memberId },
        data: { role: 'ADMIN' },
      });

      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}/members/${member.memberId}`)
        .set('Cookie', admin.cookie)
        .send({ role: 'MEMBER' });

      expect(res.status).toBe(200);
      expect(res.body.member.role).toBe('MEMBER');
    });

    it('should return 404 for non-existent memberId', async () => {
      const { workspaceId, owner } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}/members/non-existent-id`)
        .set('Cookie', owner.cookie)
        .send({ role: 'ADMIN' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('MEMBER_NOT_FOUND');
    });
  });

  describe('DELETE /api/workspaces/:workspaceId/members/:memberId', () => {
    it('should reject MEMBER from removing members (403)', async () => {
      const { workspaceId, member, admin } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .delete(`/api/workspaces/${workspaceId}/members/${admin.memberId}`)
        .set('Cookie', member.cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WORKSPACE_ACCESS_DENIED');
    });

    it('should prevent removing the OWNER (400)', async () => {
      const { workspaceId, owner, admin } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .delete(`/api/workspaces/${workspaceId}/members/${owner.memberId}`)
        .set('Cookie', admin.cookie);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_REMOVE_OWNER');
    });

    it('should allow ADMIN to remove a MEMBER (204)', async () => {
      const { workspaceId, admin, member } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .delete(`/api/workspaces/${workspaceId}/members/${member.memberId}`)
        .set('Cookie', admin.cookie);

      expect(res.status).toBe(204);

      const dbMember = await prisma.workspaceMember.findUnique({
        where: { id: member.memberId },
      });
      expect(dbMember).toBeNull();
    });

    it('should allow OWNER to remove an ADMIN (204)', async () => {
      const { workspaceId, owner, admin } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .delete(`/api/workspaces/${workspaceId}/members/${admin.memberId}`)
        .set('Cookie', owner.cookie);

      expect(res.status).toBe(204);

      const dbAdmin = await prisma.workspaceMember.findUnique({
        where: { id: admin.memberId },
      });
      expect(dbAdmin).toBeNull();
    });
  });
});
