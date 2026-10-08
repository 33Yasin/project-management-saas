import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/lib/db/prisma';
import { clearDatabase, teardown } from './setup';

describe('Activity History Integration Tests', () => {
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
      data: { userId: member.user.id, workspaceId, role: 'MEMBER' },
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
      .send({
        title: 'Initial Task',
        description: 'Testing activity log',
        status: 'TODO',
        priority: 'MEDIUM',
      });

    const taskId = taskRes.body.task.id;

    return { owner, member, outsider, workspaceId, projectId, taskId };
  }

  it('records TASK_CREATED activity when a task is created', async () => {
    const { owner, taskId } = await setupWorkspaceProjectAndTask();

    const res = await request(app)
      .get(`/api/tasks/${taskId}/activities`)
      .set('Cookie', owner.cookie);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].type).toBe('TASK_CREATED');
    expect(res.body.items[0].actor.id).toBe(owner.user.id);
    expect(res.body.items[0].metadata.title).toBe('Initial Task');
  });

  it('records TASK_STATUS_CHANGED when status is updated', async () => {
    const { owner, member, taskId } = await setupWorkspaceProjectAndTask();

    await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Cookie', member.cookie)
      .send({ status: 'IN_PROGRESS' });

    const res = await request(app)
      .get(`/api/tasks/${taskId}/activities`)
      .set('Cookie', owner.cookie);

    expect(res.status).toBe(200);
    // Activities ordered desc: newest first
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].type).toBe('TASK_STATUS_CHANGED');
    expect(res.body.items[0].actor.id).toBe(member.user.id);
    expect(res.body.items[0].metadata).toEqual({
      from: 'TODO',
      to: 'IN_PROGRESS',
    });
  });

  it('records TASK_ASSIGNEE_CHANGED when assignee is updated', async () => {
    const { owner, member, taskId } = await setupWorkspaceProjectAndTask();

    await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Cookie', owner.cookie)
      .send({ assigneeId: member.user.id });

    const res = await request(app)
      .get(`/api/tasks/${taskId}/activities`)
      .set('Cookie', owner.cookie);

    expect(res.status).toBe(200);
    expect(res.body.items[0].type).toBe('TASK_ASSIGNEE_CHANGED');
    expect(res.body.items[0].metadata.to).toBe(member.user.id);
    expect(res.body.items[0].metadata.assigneeName).toBe('Member');
  });

  it('records TASK_STATUS_CHANGED when task is moved to another status column', async () => {
    const { owner, taskId } = await setupWorkspaceProjectAndTask();

    await request(app)
      .patch(`/api/tasks/${taskId}/move`)
      .set('Cookie', owner.cookie)
      .send({ status: 'DONE', targetIndex: 0 });

    const res = await request(app)
      .get(`/api/tasks/${taskId}/activities`)
      .set('Cookie', owner.cookie);

    expect(res.status).toBe(200);
    expect(res.body.items[0].type).toBe('TASK_STATUS_CHANGED');
    expect(res.body.items[0].metadata.from).toBe('TODO');
    expect(res.body.items[0].metadata.to).toBe('DONE');
  });

  it('records COMMENT_ADDED and COMMENT_DELETED activities', async () => {
    const { owner, member, taskId } = await setupWorkspaceProjectAndTask();

    // Member adds a comment
    const commentRes = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Cookie', member.cookie)
      .send({ content: 'Looks great!' });

    const commentId = commentRes.body.comment.id;

    let res = await request(app)
      .get(`/api/tasks/${taskId}/activities`)
      .set('Cookie', owner.cookie);

    expect(res.status).toBe(200);
    expect(res.body.items[0].type).toBe('COMMENT_ADDED');
    expect(res.body.items[0].actor.id).toBe(member.user.id);
    expect(res.body.items[0].metadata.commentId).toBe(commentId);

    // Member deletes comment
    await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Cookie', member.cookie);

    res = await request(app)
      .get(`/api/tasks/${taskId}/activities`)
      .set('Cookie', owner.cookie);

    expect(res.status).toBe(200);
    expect(res.body.items[0].type).toBe('COMMENT_DELETED');
    expect(res.body.items[0].actor.id).toBe(member.user.id);
  });

  it('denies access to activities for non-members (returns 404)', async () => {
    const { outsider, taskId } = await setupWorkspaceProjectAndTask();

    const res = await request(app)
      .get(`/api/tasks/${taskId}/activities`)
      .set('Cookie', outsider.cookie);

    expect(res.status).toBe(404);
  });

  it('supports pagination on activities list', async () => {
    const { owner, taskId } = await setupWorkspaceProjectAndTask();

    // Generate multiple status updates
    await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Cookie', owner.cookie)
      .send({ status: 'IN_PROGRESS' });

    await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Cookie', owner.cookie)
      .send({ status: 'DONE' });

    await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Cookie', owner.cookie)
      .send({ status: 'TODO' });

    // Total activities: 1 (create) + 3 (status updates) = 4
    const resPage1 = await request(app)
      .get(`/api/tasks/${taskId}/activities?page=1&limit=2`)
      .set('Cookie', owner.cookie);

    expect(resPage1.status).toBe(200);
    expect(resPage1.body.items).toHaveLength(2);
    expect(resPage1.body.pagination).toEqual({
      page: 1,
      limit: 2,
      totalItems: 4,
      totalPages: 2,
    });

    const resPage2 = await request(app)
      .get(`/api/tasks/${taskId}/activities?page=2&limit=2`)
      .set('Cookie', owner.cookie);

    expect(resPage2.status).toBe(200);
    expect(resPage2.body.items).toHaveLength(2);
  });
});
