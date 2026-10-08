import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/lib/db/prisma';
import { clearDatabase, teardown } from './setup';

describe('Notifications Integration Tests', () => {
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
    const member1 = await createAuthenticatedUser('Member 1', 'member1@example.com');
    const member2 = await createAuthenticatedUser('Member 2', 'member2@example.com');

    // Create workspace
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', owner.cookie)
      .send({ name: 'Acme Workspace' });

    const workspaceId = wsRes.body.workspace.id;

    // Add members
    await prisma.workspaceMember.createMany({
      data: [
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
      .send({
        title: 'Alpha Task',
        description: 'Test task',
        status: 'TODO',
        priority: 'HIGH',
      });

    const taskId = taskRes.body.task.id;

    return { owner, member1, member2, workspaceId, projectId, taskId };
  }

  it('creates TASK_ASSIGNED notification when task is assigned to a member', async () => {
    const { owner, member1, taskId } = await setupWorkspaceProjectAndTask();

    // Owner assigns task to Member 1
    await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Cookie', owner.cookie)
      .send({ assigneeId: member1.user.id });

    // Check Member 1's notifications
    const res = await request(app)
      .get('/api/notifications')
      .set('Cookie', member1.cookie);

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].type).toBe('TASK_ASSIGNED');
    expect(res.body.items[0].userId).toBe(member1.user.id);
    expect(res.body.items[0].readAt).toBeNull();
  });

  it('does not send notification if user assigns task to themselves', async () => {
    const { owner, taskId } = await setupWorkspaceProjectAndTask();

    // Owner assigns task to themselves
    await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Cookie', owner.cookie)
      .send({ assigneeId: owner.user.id });

    // Owner should have 0 notifications
    const res = await request(app)
      .get('/api/notifications')
      .set('Cookie', owner.cookie);

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(0);
    expect(res.body.items).toHaveLength(0);
  });

  it('creates COMMENT_ADDED notification for task creator and assignee', async () => {
    const { owner, member1, member2, taskId } = await setupWorkspaceProjectAndTask();

    // Owner assigns task to Member 1
    await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Cookie', owner.cookie)
      .send({ assigneeId: member1.user.id });

    // Member 2 posts a comment
    await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Cookie', member2.cookie)
      .send({ content: 'I can help with this!' });

    // Owner (creator) should receive COMMENT_ADDED notification
    const ownerRes = await request(app)
      .get('/api/notifications')
      .set('Cookie', owner.cookie);

    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.items.some((n: any) => n.type === 'COMMENT_ADDED')).toBe(true);

    // Member 1 (assignee) should also receive COMMENT_ADDED notification
    const m1Res = await request(app)
      .get('/api/notifications')
      .set('Cookie', member1.cookie);

    expect(m1Res.status).toBe(200);
    expect(m1Res.body.items.some((n: any) => n.type === 'COMMENT_ADDED')).toBe(true);
  });

  it('marks a single notification as read', async () => {
    const { owner, member1, taskId } = await setupWorkspaceProjectAndTask();

    // Trigger notification
    await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Cookie', owner.cookie)
      .send({ assigneeId: member1.user.id });

    const listRes = await request(app)
      .get('/api/notifications')
      .set('Cookie', member1.cookie);

    const notificationId = listRes.body.items[0].id;

    // Mark as read
    const readRes = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Cookie', member1.cookie);

    expect(readRes.status).toBe(200);
    expect(readRes.body.notification.readAt).not.toBeNull();

    // Verify unreadCount is now 0
    const updatedList = await request(app)
      .get('/api/notifications')
      .set('Cookie', member1.cookie);

    expect(updatedList.body.unreadCount).toBe(0);
  });

  it('prevents user from marking another users notification as read (404)', async () => {
    const { owner, member1, member2, taskId } = await setupWorkspaceProjectAndTask();

    await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Cookie', owner.cookie)
      .send({ assigneeId: member1.user.id });

    const listRes = await request(app)
      .get('/api/notifications')
      .set('Cookie', member1.cookie);

    const notificationId = listRes.body.items[0].id;

    // Member 2 tries to mark Member 1's notification as read -> 404
    const res = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Cookie', member2.cookie);

    expect(res.status).toBe(404);
  });

  it('marks all notifications as read', async () => {
    const { owner, member1, member2, workspaceId, projectId } = await setupWorkspaceProjectAndTask();

    // Create 2 tasks assigned to Member 1
    await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Cookie', owner.cookie)
      .send({ title: 'Task 1', assigneeId: member1.user.id });

    await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Cookie', owner.cookie)
      .send({ title: 'Task 2', assigneeId: member1.user.id });

    let listRes = await request(app)
      .get('/api/notifications')
      .set('Cookie', member1.cookie);

    expect(listRes.body.unreadCount).toBe(2);

    // Mark all as read
    const markAllRes = await request(app)
      .post('/api/notifications/read-all')
      .set('Cookie', member1.cookie);

    expect(markAllRes.status).toBe(200);
    expect(markAllRes.body.count).toBe(2);

    listRes = await request(app)
      .get('/api/notifications')
      .set('Cookie', member1.cookie);

    expect(listRes.body.unreadCount).toBe(0);
  });
});
