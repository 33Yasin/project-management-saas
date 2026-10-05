import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/lib/db/prisma';
import { clearDatabase, teardown } from './setup';

describe('Comments Integration Tests', () => {
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

  async function setupWorkspaceProjectAndTask() {
    const owner = await createAuthenticatedUser('Owner', 'owner@example.com');
    const admin = await createAuthenticatedUser('Admin', 'admin@example.com');
    const member1 = await createAuthenticatedUser('Member 1', 'member1@example.com');
    const member2 = await createAuthenticatedUser('Member 2', 'member2@example.com');
    const outsider = await createAuthenticatedUser('Outsider', 'outsider@example.com');

    // Create workspace
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', owner.cookie)
      .send({ name: 'Acme Workspace' });

    const workspaceId = wsRes.body.workspace.id;

    // Add members
    await prisma.workspaceMember.createMany({
      data: [
        { userId: admin.user.id, workspaceId, role: 'ADMIN' },
        { userId: member1.user.id, workspaceId, role: 'MEMBER' },
        { userId: member2.user.id, workspaceId, role: 'MEMBER' },
      ],
    });

    // Create project
    const projRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Cookie', owner.cookie)
      .send({ name: 'Alpha Project' });

    const projectId = projRes.body.project.id;

    // Create task
    const taskRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Cookie', owner.cookie)
      .send({ title: 'Important Feature Task' });

    const taskId = taskRes.body.task.id;

    return {
      workspaceId,
      projectId,
      taskId,
      owner,
      admin,
      member1,
      member2,
      outsider,
    };
  }

  describe('POST /api/tasks/:taskId/comments', () => {
    it('should require authentication (401)', async () => {
      const res = await request(app)
        .post('/api/tasks/some-id/comments')
        .send({ content: 'Nice task!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should validate comment content (min 1 char)', async () => {
      const { taskId, owner } = await setupWorkspaceProjectAndTask();

      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Cookie', owner.cookie)
        .send({ content: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for outsider attempting to comment', async () => {
      const { taskId, outsider } = await setupWorkspaceProjectAndTask();

      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Cookie', outsider.cookie)
        .send({ content: 'Unauthorized comment' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    });

    it('should allow MEMBER to create comment on workspace task (201)', async () => {
      const { taskId, member1 } = await setupWorkspaceProjectAndTask();

      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Cookie', member1.cookie)
        .send({ content: 'Working on this task right now.' });

      expect(res.status).toBe(201);
      expect(res.body.comment.content).toBe('Working on this task right now.');
      expect(res.body.comment.author.id).toBe(member1.user.id);
      expect(res.body.comment.author.name).toBe('Member 1');

      // Verify in DB
      const dbComment = await prisma.comment.findUnique({
        where: { id: res.body.comment.id },
      });
      expect(dbComment).toBeDefined();
      expect(dbComment?.taskId).toBe(taskId);
      expect(dbComment?.authorId).toBe(member1.user.id);
    });
  });

  describe('GET /api/tasks/:taskId/comments', () => {
    it('should require authentication (401)', async () => {
      const res = await request(app).get('/api/tasks/some-id/comments');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should return 404 for outsider (not leaking existence)', async () => {
      const { taskId, outsider } = await setupWorkspaceProjectAndTask();

      const res = await request(app)
        .get(`/api/tasks/${taskId}/comments`)
        .set('Cookie', outsider.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    });

    it('should list comments in chronological order (createdAt: asc)', async () => {
      const { taskId, owner, member1 } = await setupWorkspaceProjectAndTask();

      await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Cookie', owner.cookie)
        .send({ content: 'First comment by Owner' });

      await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Cookie', member1.cookie)
        .send({ content: 'Second comment by Member' });

      const res = await request(app)
        .get(`/api/tasks/${taskId}/comments`)
        .set('Cookie', member1.cookie);

      expect(res.status).toBe(200);
      expect(res.body.comments).toHaveLength(2);
      expect(res.body.comments[0].content).toBe('First comment by Owner');
      expect(res.body.comments[1].content).toBe('Second comment by Member');
    });
  });

  describe('DELETE /api/comments/:commentId', () => {
    it('should require authentication (401)', async () => {
      const res = await request(app).delete('/api/comments/some-id');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should return 404 for non-existent comment', async () => {
      const { owner } = await setupWorkspaceProjectAndTask();

      const res = await request(app)
        .delete('/api/comments/non-existent-id')
        .set('Cookie', owner.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('COMMENT_NOT_FOUND');
    });

    it('should return 404 for outsider attempting to delete comment', async () => {
      const { taskId, member1, outsider } = await setupWorkspaceProjectAndTask();

      const createRes = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Cookie', member1.cookie)
        .send({ content: 'Comment to target' });

      const commentId = createRes.body.comment.id;

      const res = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('Cookie', outsider.cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('COMMENT_NOT_FOUND');
    });

    it('should allow author (MEMBER) to delete their own comment (204)', async () => {
      const { taskId, member1 } = await setupWorkspaceProjectAndTask();

      const createRes = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Cookie', member1.cookie)
        .send({ content: 'My own comment' });

      const commentId = createRes.body.comment.id;

      const res = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('Cookie', member1.cookie);

      expect(res.status).toBe(204);

      const dbComment = await prisma.comment.findUnique({
        where: { id: commentId },
      });
      expect(dbComment).toBeNull();
    });

    it('should prevent MEMBER from deleting someone else comment (403)', async () => {
      const { taskId, member1, member2 } = await setupWorkspaceProjectAndTask();

      const createRes = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Cookie', member1.cookie)
        .send({ content: 'Member 1 original thought' });

      const commentId = createRes.body.comment.id;

      // Member 2 attempts to delete Member 1's comment
      const res = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('Cookie', member2.cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WORKSPACE_ACCESS_DENIED');

      // Verify comment still exists
      const dbComment = await prisma.comment.findUnique({
        where: { id: commentId },
      });
      expect(dbComment).toBeDefined();
    });

    it('should allow ADMIN to delete others comment in workspace (204)', async () => {
      const { taskId, member1, admin } = await setupWorkspaceProjectAndTask();

      const createRes = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Cookie', member1.cookie)
        .send({ content: 'Inappropriate remark' });

      const commentId = createRes.body.comment.id;

      const res = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('Cookie', admin.cookie);

      expect(res.status).toBe(204);

      const dbComment = await prisma.comment.findUnique({
        where: { id: commentId },
      });
      expect(dbComment).toBeNull();
    });

    it('should allow OWNER to delete others comment in workspace (204)', async () => {
      const { taskId, admin, owner } = await setupWorkspaceProjectAndTask();

      const createRes = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Cookie', admin.cookie)
        .send({ content: 'Admin comment' });

      const commentId = createRes.body.comment.id;

      const res = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('Cookie', owner.cookie);

      expect(res.status).toBe(204);

      const dbComment = await prisma.comment.findUnique({
        where: { id: commentId },
      });
      expect(dbComment).toBeNull();
    });
  });
});
