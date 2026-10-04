import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/lib/db/prisma';
import { clearDatabase, teardown } from './setup';

describe('Workspaces & RBAC Integration Tests', () => {
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

  describe('POST /api/workspaces', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .send({ name: 'Acme Corp' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should validate workspace name (min 2 chars)', async () => {
      const { cookie } = await createAuthenticatedUser('User 1', 'user1@example.com');

      const res = await request(app)
        .post('/api/workspaces')
        .set('Cookie', cookie)
        .send({ name: 'A' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should create workspace and assign creator as OWNER atomically', async () => {
      const { user, cookie } = await createAuthenticatedUser('User 1', 'user1@example.com');

      const res = await request(app)
        .post('/api/workspaces')
        .set('Cookie', cookie)
        .send({ name: 'Acme Corp' });

      expect(res.status).toBe(201);
      expect(res.body.workspace.name).toBe('Acme Corp');
      expect(res.body.workspace.role).toBe('OWNER');

      // Verify DB state
      const member = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId: res.body.workspace.id,
          },
        },
      });

      expect(member).toBeDefined();
      expect(member?.role).toBe('OWNER');
    });
  });

  describe('GET /api/workspaces', () => {
    it('should list only workspaces user is a member of', async () => {
      const user1 = await createAuthenticatedUser('User 1', 'user1@example.com');
      const user2 = await createAuthenticatedUser('User 2', 'user2@example.com');

      // User 1 creates 2 workspaces
      await request(app)
        .post('/api/workspaces')
        .set('Cookie', user1.cookie)
        .send({ name: 'Workspace A' });

      await request(app)
        .post('/api/workspaces')
        .set('Cookie', user1.cookie)
        .send({ name: 'Workspace B' });

      // User 2 creates 1 workspace
      await request(app)
        .post('/api/workspaces')
        .set('Cookie', user2.cookie)
        .send({ name: 'User2 Workspace' });

      // User 1 requests workspaces
      const res1 = await request(app)
        .get('/api/workspaces')
        .set('Cookie', user1.cookie);

      expect(res1.status).toBe(200);
      expect(res1.body.workspaces).toHaveLength(2);
      expect(res1.body.workspaces.map((w: { name: string }) => w.name)).toContain('Workspace A');
      expect(res1.body.workspaces.map((w: { name: string }) => w.name)).toContain('Workspace B');

      // User 2 requests workspaces
      const res2 = await request(app)
        .get('/api/workspaces')
        .set('Cookie', user2.cookie);

      expect(res2.status).toBe(200);
      expect(res2.body.workspaces).toHaveLength(1);
      expect(res2.body.workspaces[0].name).toBe('User2 Workspace');
    });
  });

  describe('GET /api/workspaces/:workspaceId', () => {
    it('should allow a member to view details', async () => {
      const user1 = await createAuthenticatedUser('User 1', 'user1@example.com');

      const createRes = await request(app)
        .post('/api/workspaces')
        .set('Cookie', user1.cookie)
        .send({ name: 'Engineering' });

      const workspaceId = createRes.body.workspace.id;

      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}`)
        .set('Cookie', user1.cookie);

      expect(res.status).toBe(200);
      expect(res.body.workspace.name).toBe('Engineering');
      expect(res.body.workspace.role).toBe('OWNER');
    });

    it('should return 404 when non-member tries to view workspace', async () => {
      const user1 = await createAuthenticatedUser('User 1', 'user1@example.com');
      const user2 = await createAuthenticatedUser('User 2', 'user2@example.com');

      const createRes = await request(app)
        .post('/api/workspaces')
        .set('Cookie', user1.cookie)
        .send({ name: 'Private Ops' });

      const workspaceId = createRes.body.workspace.id;

      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}`)
        .set('Cookie', user2.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('WORKSPACE_NOT_FOUND');
    });
  });

  describe('PATCH /api/workspaces/:workspaceId (RBAC)', () => {
    it('should allow OWNER and ADMIN to edit workspace name', async () => {
      const owner = await createAuthenticatedUser('Owner', 'owner@example.com');
      const admin = await createAuthenticatedUser('Admin', 'admin@example.com');

      const createRes = await request(app)
        .post('/api/workspaces')
        .set('Cookie', owner.cookie)
        .send({ name: 'Old Name' });

      const workspaceId = createRes.body.workspace.id;

      // Add admin to workspace
      await prisma.workspaceMember.create({
        data: {
          userId: admin.user.id,
          workspaceId,
          role: 'ADMIN',
        },
      });

      // Admin updates name
      const adminUpdate = await request(app)
        .patch(`/api/workspaces/${workspaceId}`)
        .set('Cookie', admin.cookie)
        .send({ name: 'Admin Renamed' });

      expect(adminUpdate.status).toBe(200);
      expect(adminUpdate.body.workspace.name).toBe('Admin Renamed');

      // Owner updates name
      const ownerUpdate = await request(app)
        .patch(`/api/workspaces/${workspaceId}`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Owner Renamed' });

      expect(ownerUpdate.status).toBe(200);
      expect(ownerUpdate.body.workspace.name).toBe('Owner Renamed');
    });

    it('should forbid regular MEMBER from editing workspace name (403)', async () => {
      const owner = await createAuthenticatedUser('Owner', 'owner@example.com');
      const member = await createAuthenticatedUser('Member', 'member@example.com');

      const createRes = await request(app)
        .post('/api/workspaces')
        .set('Cookie', owner.cookie)
        .send({ name: 'Secret Name' });

      const workspaceId = createRes.body.workspace.id;

      // Add member to workspace with MEMBER role
      await prisma.workspaceMember.create({
        data: {
          userId: member.user.id,
          workspaceId,
          role: 'MEMBER',
        },
      });

      // Member attempts edit
      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}`)
        .set('Cookie', member.cookie)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WORKSPACE_ACCESS_DENIED');
    });
  });

  describe('DELETE /api/workspaces/:workspaceId (RBAC)', () => {
    it('should forbid non-OWNER from deleting workspace (403 OWNER_REQUIRED)', async () => {
      const owner = await createAuthenticatedUser('Owner', 'owner@example.com');
      const admin = await createAuthenticatedUser('Admin', 'admin@example.com');

      const createRes = await request(app)
        .post('/api/workspaces')
        .set('Cookie', owner.cookie)
        .send({ name: 'Protected Workspace' });

      const workspaceId = createRes.body.workspace.id;

      await prisma.workspaceMember.create({
        data: {
          userId: admin.user.id,
          workspaceId,
          role: 'ADMIN',
        },
      });

      // Admin attempts delete
      const res = await request(app)
        .delete(`/api/workspaces/${workspaceId}`)
        .set('Cookie', admin.cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OWNER_REQUIRED');
    });

    it('should allow OWNER to delete workspace and cascade delete all children', async () => {
      const owner = await createAuthenticatedUser('Owner', 'owner@example.com');

      const createRes = await request(app)
        .post('/api/workspaces')
        .set('Cookie', owner.cookie)
        .send({ name: 'To Be Deleted' });

      const workspaceId = createRes.body.workspace.id;

      const deleteRes = await request(app)
        .delete(`/api/workspaces/${workspaceId}`)
        .set('Cookie', owner.cookie);

      expect(deleteRes.status).toBe(204);

      // Verify DB cleanup
      const deletedWs = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      expect(deletedWs).toBeNull();

      const remainingMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId },
      });
      expect(remainingMembers).toHaveLength(0);
    });
  });

  describe('POST /api/workspaces/:workspaceId/transfer-ownership', () => {
    it('should atomically transfer ownership to another member', async () => {
      const owner = await createAuthenticatedUser('Owner', 'owner@example.com');
      const member = await createAuthenticatedUser('Member', 'member@example.com');

      const createRes = await request(app)
        .post('/api/workspaces')
        .set('Cookie', owner.cookie)
        .send({ name: 'Transferred Workspace' });

      const workspaceId = createRes.body.workspace.id;

      // Add member to workspace
      await prisma.workspaceMember.create({
        data: {
          userId: member.user.id,
          workspaceId,
          role: 'MEMBER',
        },
      });

      // Transfer ownership
      const transferRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/transfer-ownership`)
        .set('Cookie', owner.cookie)
        .send({ targetUserId: member.user.id });

      expect(transferRes.status).toBe(200);

      // Verify in DB: old owner is now ADMIN, new owner is OWNER
      const oldOwnerMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: owner.user.id,
            workspaceId,
          },
        },
      });
      expect(oldOwnerMember?.role).toBe('ADMIN');

      const newOwnerMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: member.user.id,
            workspaceId,
          },
        },
      });
      expect(newOwnerMember?.role).toBe('OWNER');

      // Verify Partial Unique Index: exactly 1 OWNER exists
      const owners = await prisma.workspaceMember.findMany({
        where: {
          workspaceId,
          role: 'OWNER',
        },
      });
      expect(owners).toHaveLength(1);
    });

    it('should reject ownership transfer when requester is not OWNER', async () => {
      const owner = await createAuthenticatedUser('Owner', 'owner@example.com');
      const admin = await createAuthenticatedUser('Admin', 'admin@example.com');
      const member = await createAuthenticatedUser('Member', 'member@example.com');

      const createRes = await request(app)
        .post('/api/workspaces')
        .set('Cookie', owner.cookie)
        .send({ name: 'Immutable Workspace' });

      const workspaceId = createRes.body.workspace.id;

      await prisma.workspaceMember.create({
        data: {
          userId: admin.user.id,
          workspaceId,
          role: 'ADMIN',
        },
      });

      // Admin attempts ownership transfer
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/transfer-ownership`)
        .set('Cookie', admin.cookie)
        .send({ targetUserId: member.user.id });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OWNER_REQUIRED');
    });

    it('should reject ownership transfer to someone who is not a member', async () => {
      const owner = await createAuthenticatedUser('Owner', 'owner@example.com');
      const outsider = await createAuthenticatedUser('Outsider', 'outsider@example.com');

      const createRes = await request(app)
        .post('/api/workspaces')
        .set('Cookie', owner.cookie)
        .send({ name: 'Strict Workspace' });

      const workspaceId = createRes.body.workspace.id;

      // Transfer to outsider
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/transfer-ownership`)
        .set('Cookie', owner.cookie)
        .send({ targetUserId: outsider.user.id });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
    });
  });
});
