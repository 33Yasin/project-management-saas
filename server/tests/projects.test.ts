import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/lib/db/prisma';
import { clearDatabase, teardown } from './setup';

describe('Projects Integration Tests', () => {
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

    // Create primary workspace
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', owner.cookie)
      .send({ name: 'Acme Workspace' });

    const workspaceId = wsRes.body.workspace.id;

    // Add admin and member
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

    // Create outsider workspace
    const otherWsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', outsider.cookie)
      .send({ name: 'Outsider Workspace' });

    const otherWorkspaceId = otherWsRes.body.workspace.id;

    return {
      workspaceId,
      otherWorkspaceId,
      owner,
      admin,
      member,
      outsider,
    };
  }

  describe('POST /api/workspaces/:workspaceId/projects', () => {
    it('should require authentication (401)', async () => {
      const res = await request(app)
        .post('/api/workspaces/some-id/projects')
        .send({ name: 'Alpha Project' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should validate project name length (min 2, max 100)', async () => {
      const { workspaceId, owner } = await setupWorkspaceWithMembers();

      const shortRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'A' });

      expect(shortRes.status).toBe(400);
      expect(shortRes.body.error.code).toBe('VALIDATION_ERROR');

      const longRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'x'.repeat(101) });

      expect(longRes.status).toBe(400);
      expect(longRes.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for outsider attempting to create project', async () => {
      const { workspaceId, outsider } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', outsider.cookie)
        .send({ name: 'Infiltrator Project' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('WORKSPACE_NOT_FOUND');
    });

    it('should allow MEMBER to create project in workspace (201)', async () => {
      const { workspaceId, member } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', member.cookie)
        .send({
          name: 'Mobile App Redesign',
          description: 'Revamping the user interface for iOS and Android',
        });

      expect(res.status).toBe(201);
      expect(res.body.project.name).toBe('Mobile App Redesign');
      expect(res.body.project.description).toBe(
        'Revamping the user interface for iOS and Android'
      );
      expect(res.body.project.workspaceId).toBe(workspaceId);
      expect(res.body.project._count.tasks).toBe(0);

      // Verify DB
      const dbProject = await prisma.project.findUnique({
        where: { id: res.body.project.id },
      });
      expect(dbProject).toBeDefined();
      expect(dbProject?.name).toBe('Mobile App Redesign');
    });

    it('should allow OWNER and ADMIN to create projects', async () => {
      const { workspaceId, owner, admin } = await setupWorkspaceWithMembers();

      const ownerRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Owner Project' });
      expect(ownerRes.status).toBe(201);

      const adminRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', admin.cookie)
        .send({ name: 'Admin Project' });
      expect(adminRes.status).toBe(201);
    });
  });

  describe('GET /api/workspaces/:workspaceId/projects', () => {
    it('should require authentication (401)', async () => {
      const res = await request(app).get('/api/workspaces/some-id/projects');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should return 404 for outsider (not leaking existence)', async () => {
      const { workspaceId, outsider } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', outsider.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('WORKSPACE_NOT_FOUND');
    });

    it('should list only projects of the target workspace', async () => {
      const { workspaceId, otherWorkspaceId, member, outsider } =
        await setupWorkspaceWithMembers();

      // Create 2 projects in primary workspace
      await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', member.cookie)
        .send({ name: 'Project 1' });

      await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', member.cookie)
        .send({ name: 'Project 2' });

      // Create 1 project in outsider's workspace
      await request(app)
        .post(`/api/workspaces/${otherWorkspaceId}/projects`)
        .set('Cookie', outsider.cookie)
        .send({ name: 'Secret Other Project' });

      // Member queries primary workspace
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', member.cookie);

      expect(res.status).toBe(200);
      expect(res.body.projects).toHaveLength(2);
      expect(res.body.projects.map((p: any) => p.name)).toEqual([
        'Project 2',
        'Project 1',
      ]);
    });
  });

  describe('GET /api/projects/:projectId', () => {
    it('should require authentication (401)', async () => {
      const res = await request(app).get('/api/projects/some-id');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should return 404 for non-existent project', async () => {
      const { owner } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .get('/api/projects/non-existent-id')
        .set('Cookie', owner.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should return 404 when outsider requests a project (scoping protection)', async () => {
      const { workspaceId, owner, outsider } = await setupWorkspaceWithMembers();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Classified Project' });

      const projectId = createRes.body.project.id;

      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Cookie', outsider.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should allow MEMBER to fetch project details (200)', async () => {
      const { workspaceId, owner, member } = await setupWorkspaceWithMembers();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Team Roadmap', description: 'Q4 milestones' });

      const projectId = createRes.body.project.id;

      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Cookie', member.cookie);

      expect(res.status).toBe(200);
      expect(res.body.project.id).toBe(projectId);
      expect(res.body.project.name).toBe('Team Roadmap');
      expect(res.body.project.description).toBe('Q4 milestones');
    });
  });

  describe('PATCH /api/projects/:projectId', () => {
    it('should validate update payload (at least one field)', async () => {
      const { workspaceId, owner } = await setupWorkspaceWithMembers();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Project Before' });

      const projectId = createRes.body.project.id;

      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Cookie', owner.cookie)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for outsider attempting to update', async () => {
      const { workspaceId, owner, outsider } = await setupWorkspaceWithMembers();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Project Before' });

      const projectId = createRes.body.project.id;

      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Cookie', outsider.cookie)
        .send({ name: 'Hijacked Name' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should allow MEMBER to update project name and description', async () => {
      const { workspaceId, owner, member } = await setupWorkspaceWithMembers();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Initial Name', description: 'Old desc' });

      const projectId = createRes.body.project.id;

      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Cookie', member.cookie)
        .send({ name: 'Updated Name', description: 'New description' });

      expect(res.status).toBe(200);
      expect(res.body.project.name).toBe('Updated Name');
      expect(res.body.project.description).toBe('New description');

      const dbProject = await prisma.project.findUnique({
        where: { id: projectId },
      });
      expect(dbProject?.name).toBe('Updated Name');
    });
  });

  describe('DELETE /api/projects/:projectId', () => {
    it('should return 404 for outsider attempting to delete', async () => {
      const { workspaceId, owner, outsider } = await setupWorkspaceWithMembers();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Project to Delete' });

      const projectId = createRes.body.project.id;

      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Cookie', outsider.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should allow MEMBER to delete project and cascade tasks (204)', async () => {
      const { workspaceId, owner, member } = await setupWorkspaceWithMembers();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Project with Tasks' });

      const projectId = createRes.body.project.id;

      // Add a task to this project
      const task = await prisma.task.create({
        data: {
          projectId,
          title: 'Initial Task',
          createdById: owner.user.id,
        },
      });

      // Member deletes the project
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Cookie', member.cookie);

      expect(res.status).toBe(204);

      // Verify project is deleted
      const dbProject = await prisma.project.findUnique({
        where: { id: projectId },
      });
      expect(dbProject).toBeNull();

      // Verify cascading deletion of task
      const dbTask = await prisma.task.findUnique({
        where: { id: task.id },
      });
      expect(dbTask).toBeNull();
    });
  });
});
