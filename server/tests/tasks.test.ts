import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/lib/db/prisma';
import { clearDatabase, teardown } from './setup';

describe('Tasks Integration Tests', () => {
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

  async function setupWorkspaceAndProject() {
    const owner = await createAuthenticatedUser('Owner', 'owner@example.com');
    const member = await createAuthenticatedUser('Member', 'member@example.com');
    const outsider = await createAuthenticatedUser('Outsider', 'outsider@example.com');

    // Create workspace
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', owner.cookie)
      .send({ name: 'Acme Workspace' });

    const workspaceId = wsRes.body.workspace.id;

    // Add member
    await prisma.workspaceMember.create({
      data: {
        userId: member.user.id,
        workspaceId,
        role: 'MEMBER',
      },
    });

    // Create project
    const projRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Cookie', owner.cookie)
      .send({ name: 'Alpha Project', memberIds: [member.user.id] });

    const projectId = projRes.body.project.id;

    return {
      workspaceId,
      projectId,
      owner,
      member,
      outsider,
    };
  }

  describe('POST /api/projects/:projectId/tasks', () => {
    it('should require authentication (401)', async () => {
      const res = await request(app)
        .post('/api/projects/some-id/tasks')
        .send({ title: 'New Task' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should validate title is required (400)', async () => {
      const { projectId, owner } = await setupWorkspaceAndProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({ title: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for outsider attempting to create task', async () => {
      const { projectId, outsider } = await setupWorkspaceAndProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', outsider.cookie)
        .send({ title: 'Unauthorized Task' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should reject assignee if user is not in workspace (400 INVALID_ASSIGNEE)', async () => {
      const { projectId, owner, outsider } = await setupWorkspaceAndProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({
          title: 'Task with outsider assignee',
          assigneeId: outsider.user.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
    });

    it('should create task with defaults (TODO, MEDIUM) and valid assignee', async () => {
      const { projectId, member } = await setupWorkspaceAndProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', member.cookie)
        .send({
          title: 'Implement Authentication Tests',
          description: 'Write test suite using Vitest and Supertest',
          assigneeId: member.user.id,
          priority: 'HIGH',
        });

      expect(res.status).toBe(201);
      expect(res.body.task.title).toBe('Implement Authentication Tests');
      expect(res.body.task.status).toBe('TODO');
      expect(res.body.task.priority).toBe('HIGH');
      expect(res.body.task.assignee.id).toBe(member.user.id);
      expect(res.body.task.createdBy.id).toBe(member.user.id);
      expect(res.body.task._count.comments).toBe(0);
    });
  });

  describe('GET /api/projects/:projectId/tasks', () => {
    it('should require authentication (401)', async () => {
      const res = await request(app).get('/api/projects/some-id/tasks');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should return 404 for outsider (not leaking existence)', async () => {
      const { projectId, outsider } = await setupWorkspaceAndProject();

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .set('Cookie', outsider.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should list tasks with pagination metadata', async () => {
      const { projectId, owner } = await setupWorkspaceAndProject();

      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post(`/api/projects/${projectId}/tasks`)
          .set('Cookie', owner.cookie)
          .send({ title: `Task ${i}` });
      }

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?page=1&limit=2`)
        .set('Cookie', owner.cookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 2,
        totalItems: 3,
        totalPages: 2,
      });
    });

    it('should filter tasks by status and priority', async () => {
      const { projectId, owner } = await setupWorkspaceAndProject();

      await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({ title: 'Task Low', priority: 'LOW', status: 'TODO' });

      await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({ title: 'Task High Done', priority: 'HIGH', status: 'DONE' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?status=DONE&priority=HIGH`)
        .set('Cookie', owner.cookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('Task High Done');
    });

    it('should filter tasks by search term (case-insensitive in title or description)', async () => {
      const { projectId, owner } = await setupWorkspaceAndProject();

      await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({ title: 'Frontend UI Polish', description: 'Clean up spacing' });

      await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({ title: 'Backend Refactor', description: 'Optimize queries' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?search=ui`)
        .set('Cookie', owner.cookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('Frontend UI Polish');
    });
  });

  describe('GET /api/tasks/:taskId', () => {
    it('should require authentication (401)', async () => {
      const res = await request(app).get('/api/tasks/some-id');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should return 404 for non-existent task', async () => {
      const { owner } = await setupWorkspaceAndProject();

      const res = await request(app)
        .get('/api/tasks/non-existent-id')
        .set('Cookie', owner.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    });

    it('should return 404 when outsider requests a task (scoping protection)', async () => {
      const { projectId, owner, outsider } = await setupWorkspaceAndProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({ title: 'Secret Task' });

      const taskId = createRes.body.task.id;

      const res = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Cookie', outsider.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    });

    it('should allow MEMBER to fetch task details (200)', async () => {
      const { projectId, owner, member } = await setupWorkspaceAndProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({ title: 'Review PR', priority: 'HIGH' });

      const taskId = createRes.body.task.id;

      const res = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Cookie', member.cookie);

      expect(res.status).toBe(200);
      expect(res.body.task.id).toBe(taskId);
      expect(res.body.task.title).toBe('Review PR');
      expect(res.body.task.project).toHaveProperty('name', 'Alpha Project');
    });
  });

  describe('PATCH /api/tasks/:taskId', () => {
    it('should validate update payload (at least one field)', async () => {
      const { projectId, owner } = await setupWorkspaceAndProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({ title: 'Original Task' });

      const taskId = createRes.body.task.id;

      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', owner.cookie)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid assignee on update (400 INVALID_ASSIGNEE)', async () => {
      const { projectId, owner, outsider } = await setupWorkspaceAndProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({ title: 'Original Task' });

      const taskId = createRes.body.task.id;

      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', owner.cookie)
        .send({ assigneeId: outsider.user.id });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
    });

    it('should allow updating status, priority, and unassigning task', async () => {
      const { projectId, owner, member } = await setupWorkspaceAndProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({
          title: 'Original Task',
          assigneeId: member.user.id,
          status: 'TODO',
        });

      const taskId = createRes.body.task.id;

      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', member.cookie)
        .send({
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          assigneeId: null,
        });

      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe('IN_PROGRESS');
      expect(res.body.task.priority).toBe('HIGH');
      expect(res.body.task.assignee).toBeNull();
    });
  });

  describe('DELETE /api/tasks/:taskId', () => {
    it('should return 404 for outsider attempting to delete', async () => {
      const { projectId, owner, outsider } = await setupWorkspaceAndProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({ title: 'Task to Delete' });

      const taskId = createRes.body.task.id;

      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Cookie', outsider.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    });

    it('should allow MEMBER to delete task and cascade comments (204)', async () => {
      const { projectId, owner, member } = await setupWorkspaceAndProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({ title: 'Task with Comment' });

      const taskId = createRes.body.task.id;

      // Add a comment to this task
      const comment = await prisma.comment.create({
        data: {
          taskId,
          authorId: owner.user.id,
          content: 'Important observation',
        },
      });

      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Cookie', member.cookie);

      expect(res.status).toBe(204);

      // Verify task deleted
      const dbTask = await prisma.task.findUnique({
        where: { id: taskId },
      });
      expect(dbTask).toBeNull();

      // Verify comment cascaded
      const dbComment = await prisma.comment.findUnique({
        where: { id: comment.id },
      });
      expect(dbComment).toBeNull();
    });
  });

  describe('PATCH /api/tasks/:taskId/move', () => {
    it('should validate targetIndex and reject negative numbers (400)', async () => {
      const { projectId, owner } = await setupWorkspaceAndProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({ title: 'Task to Move' });

      const taskId = createRes.body.task.id;

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/move`)
        .set('Cookie', owner.cookie)
        .send({ targetIndex: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for outsider attempting to move task', async () => {
      const { projectId, owner, outsider } = await setupWorkspaceAndProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', owner.cookie)
        .send({ title: 'Task to Move' });

      const taskId = createRes.body.task.id;

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/move`)
        .set('Cookie', outsider.cookie)
        .send({ targetIndex: 0 });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    });

    it('should reorder tasks within the same column and update positions atomically', async () => {
      const { projectId, member } = await setupWorkspaceAndProject();

      // Create 3 tasks in TODO (should get positions 0, 1, 2)
      const t1 = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', member.cookie)
        .send({ title: 'Task 1', status: 'TODO' });

      const t2 = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', member.cookie)
        .send({ title: 'Task 2', status: 'TODO' });

      const t3 = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', member.cookie)
        .send({ title: 'Task 3', status: 'TODO' });

      const id1 = t1.body.task.id;
      const id2 = t2.body.task.id;
      const id3 = t3.body.task.id;

      // Move Task 3 to targetIndex 0
      const moveRes = await request(app)
        .patch(`/api/tasks/${id3}/move`)
        .set('Cookie', member.cookie)
        .send({ targetIndex: 0 });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.task.id).toBe(id3);

      // Verify positions in database
      const dbTasks = await prisma.task.findMany({
        where: { projectId, status: 'TODO' },
        orderBy: { position: 'asc' },
      });

      expect(dbTasks.map((t) => t.id)).toEqual([id3, id1, id2]);
      expect(dbTasks.map((t) => t.position)).toEqual([0, 1, 2]);
    });

    it('should move task across columns, update status, and normalize source and destination positions', async () => {
      const { projectId, member } = await setupWorkspaceAndProject();

      // Create 2 TODO tasks
      const todo1 = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', member.cookie)
        .send({ title: 'Todo 1', status: 'TODO' });

      const todo2 = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', member.cookie)
        .send({ title: 'Todo 2', status: 'TODO' });

      // Create 1 IN_PROGRESS task
      const inProg1 = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', member.cookie)
        .send({ title: 'In Progress 1', status: 'IN_PROGRESS' });

      const idTodo1 = todo1.body.task.id;
      const idTodo2 = todo2.body.task.id;
      const idInProg1 = inProg1.body.task.id;

      // Move Todo 1 to IN_PROGRESS at targetIndex 0
      const moveRes = await request(app)
        .patch(`/api/tasks/${idTodo1}/move`)
        .set('Cookie', member.cookie)
        .send({ status: 'IN_PROGRESS', targetIndex: 0 });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.task.status).toBe('IN_PROGRESS');

      // Check destination column (IN_PROGRESS)
      const destTasks = await prisma.task.findMany({
        where: { projectId, status: 'IN_PROGRESS' },
        orderBy: { position: 'asc' },
      });
      expect(destTasks.map((t) => t.id)).toEqual([idTodo1, idInProg1]);
      expect(destTasks.map((t) => t.position)).toEqual([0, 1]);

      // Check source column (TODO): Todo 2 normalized to position 0
      const sourceTasks = await prisma.task.findMany({
        where: { projectId, status: 'TODO' },
        orderBy: { position: 'asc' },
      });
      expect(sourceTasks.map((t) => t.id)).toEqual([idTodo2]);
      expect(sourceTasks[0].position).toBe(0);
    });

    it('should clamp targetIndex if greater than column length', async () => {
      const { projectId, member } = await setupWorkspaceAndProject();

      const t1 = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', member.cookie)
        .send({ title: 'Task A', status: 'TODO' });

      const t2 = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', member.cookie)
        .send({ title: 'Task B', status: 'TODO' });

      const id1 = t1.body.task.id;
      const id2 = t2.body.task.id;

      // Move Task A to large targetIndex 999
      const moveRes = await request(app)
        .patch(`/api/tasks/${id1}/move`)
        .set('Cookie', member.cookie)
        .send({ targetIndex: 999 });

      expect(moveRes.status).toBe(200);

      const dbTasks = await prisma.task.findMany({
        where: { projectId, status: 'TODO' },
        orderBy: { position: 'asc' },
      });
      expect(dbTasks.map((t) => t.id)).toEqual([id2, id1]);
      expect(dbTasks.map((t) => t.position)).toEqual([0, 1]);
    });
  });
});
