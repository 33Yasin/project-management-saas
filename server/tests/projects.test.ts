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

    it('should reject MEMBER from creating project in workspace (403)', async () => {
      const { workspaceId, member } = await setupWorkspaceWithMembers();

      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', member.cookie)
        .send({
          name: 'Mobile App Redesign',
          description: 'Revamping the user interface for iOS and Android',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WORKSPACE_ACCESS_DENIED');
    });

    it('should allow OWNER and ADMIN to create projects (201)', async () => {
      const { workspaceId, owner, admin } = await setupWorkspaceWithMembers();

      const ownerRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Owner Project' });
      expect(ownerRes.status).toBe(201);
      expect(ownerRes.body.project.name).toBe('Owner Project');

      const adminRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', admin.cookie)
        .send({ name: 'Admin Project' });
      expect(adminRes.status).toBe(201);
      expect(adminRes.body.project.name).toBe('Admin Project');
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

    it('should list only assigned projects for MEMBER, while OWNER and ADMIN see all projects', async () => {
      const { workspaceId, otherWorkspaceId, owner, admin, member, outsider } =
        await setupWorkspaceWithMembers();

      // Create Project 1 assigned to MEMBER
      await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Project 1 (Assigned)', memberIds: [member.user.id] });

      // Create Project 2 NOT assigned to MEMBER
      await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Project 2 (Unassigned)' });

      // Create 1 project in outsider's workspace
      await request(app)
        .post(`/api/workspaces/${otherWorkspaceId}/projects`)
        .set('Cookie', outsider.cookie)
        .send({ name: 'Secret Other Project' });

      // Member queries primary workspace: sees only Project 1
      const memberRes = await request(app)
        .get(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', member.cookie);

      expect(memberRes.status).toBe(200);
      expect(memberRes.body.projects).toHaveLength(1);
      expect(memberRes.body.projects[0].name).toBe('Project 1 (Assigned)');

      // Admin queries primary workspace: sees all projects
      const adminRes = await request(app)
        .get(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', admin.cookie);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.projects).toHaveLength(2);

      // Owner queries primary workspace: sees all projects
      const ownerRes = await request(app)
        .get(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie);

      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body.projects).toHaveLength(2);
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

    it('should return 404 when unassigned MEMBER requests project details', async () => {
      const { workspaceId, owner, member } = await setupWorkspaceWithMembers();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Private Admin Project' });

      const projectId = createRes.body.project.id;

      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Cookie', member.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should allow assigned MEMBER to fetch project details (200)', async () => {
      const { workspaceId, owner, member } = await setupWorkspaceWithMembers();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({
          name: 'Team Roadmap',
          description: 'Q4 milestones',
          memberIds: [member.user.id],
        });

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

    it('should reject MEMBER from updating project (403)', async () => {
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

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WORKSPACE_ACCESS_DENIED');
    });

    it('should allow ADMIN and OWNER to update project name and description (200)', async () => {
      const { workspaceId, owner, admin } = await setupWorkspaceWithMembers();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Initial Name', description: 'Old desc' });

      const projectId = createRes.body.project.id;

      const adminUpdateRes = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Cookie', admin.cookie)
        .send({ name: 'Admin Updated Name', description: 'Admin description' });

      expect(adminUpdateRes.status).toBe(200);
      expect(adminUpdateRes.body.project.name).toBe('Admin Updated Name');

      const ownerUpdateRes = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Owner Updated Name', description: 'Owner description' });

      expect(ownerUpdateRes.status).toBe(200);
      expect(ownerUpdateRes.body.project.name).toBe('Owner Updated Name');
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

    it('should reject MEMBER from deleting project (403)', async () => {
      const { workspaceId, owner, member } = await setupWorkspaceWithMembers();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Project with Tasks' });

      const projectId = createRes.body.project.id;

      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Cookie', member.cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WORKSPACE_ACCESS_DENIED');
    });

    it('should allow ADMIN and OWNER to delete project and cascade tasks (204)', async () => {
      const { workspaceId, owner, admin } = await setupWorkspaceWithMembers();

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

      // Admin deletes the project
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Cookie', admin.cookie);

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

  describe('Project Members Management (/api/projects/:projectId/members)', () => {
    it('should allow ADMIN to add and remove a MEMBER from a project', async () => {
      const { workspaceId, owner, admin, member } = await setupWorkspaceWithMembers();

      // Owner creates a project initially without member
      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Cross-functional Project' });

      const projectId = createRes.body.project.id;

      // Member cannot access project yet (404)
      const unassignedRes = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Cookie', member.cookie);
      expect(unassignedRes.status).toBe(404);

      // Admin adds member to project
      const addRes = await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Cookie', admin.cookie)
        .send({ userId: member.user.id });

      expect(addRes.status).toBe(201);
      expect(addRes.body.member.userId).toBe(member.user.id);

      // Member can now fetch project details (200)
      const assignedRes = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Cookie', member.cookie);
      expect(assignedRes.status).toBe(200);

      // List members includes the assigned member
      const listMembersRes = await request(app)
        .get(`/api/projects/${projectId}/members`)
        .set('Cookie', member.cookie);
      expect(listMembersRes.status).toBe(200);
      expect(listMembersRes.body.members.some((m: any) => m.userId === member.user.id)).toBe(true);

      // Admin removes member from project
      const removeRes = await request(app)
        .delete(`/api/projects/${projectId}/members/${member.user.id}`)
        .set('Cookie', admin.cookie);
      expect(removeRes.status).toBe(204);

      // Member immediately loses access (404)
      const afterRemoveRes = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Cookie', member.cookie);
      expect(afterRemoveRes.status).toBe(404);
    });

    it('should reject MEMBER from adding members to a project (403)', async () => {
      const { workspaceId, owner, member } = await setupWorkspaceWithMembers();

      const createRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Restricted Project', memberIds: [member.user.id] });

      const projectId = createRes.body.project.id;

      const addRes = await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Cookie', member.cookie)
        .send({ userId: owner.user.id });

      expect(addRes.status).toBe(403);
      expect(addRes.body.error.code).toBe('WORKSPACE_ACCESS_DENIED');
    });
  });
});
