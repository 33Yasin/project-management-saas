import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/lib/db/prisma';
import { clearDatabase, teardown } from './setup';

describe('Attachments Integration Tests', () => {
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
        { userId: member1.user.id, workspaceId, role: 'MEMBER' },
        { userId: member2.user.id, workspaceId, role: 'MEMBER' },
      ],
    });

    // Create project
    const projRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Cookie', owner.cookie)
      .send({ name: 'Project Attachments' });

    const projectId = projRes.body.project.id;

    // Create task
    const taskRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Cookie', owner.cookie)
      .send({
        title: 'Task with attachments',
        description: 'Test task',
        status: 'TODO',
        priority: 'HIGH',
      });

    const taskId = taskRes.body.task.id;

    return { owner, member1, member2, outsider, workspaceId, projectId, taskId };
  }

  it('uploads an attachment successfully, saves binary, and records ATTACHMENT_ADDED activity', async () => {
    const { member1, taskId } = await setupWorkspaceProjectAndTask();

    const fileContent = Buffer.from('%PDF-1.4 sample pdf content');

    const res = await request(app)
      .post(`/api/tasks/${taskId}/attachments`)
      .set('Cookie', member1.cookie)
      .attach('file', fileContent, {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.attachment).toBeDefined();
    expect(res.body.attachment.originalName).toBe('report.pdf');
    expect(res.body.attachment.mimeType).toBe('application/pdf');
    expect(res.body.attachment.sizeBytes).toBe(fileContent.length);
    expect(res.body.attachment.uploadedBy.id).toBe(member1.user.id);

    // Verify activity history has ATTACHMENT_ADDED
    const actRes = await request(app)
      .get(`/api/tasks/${taskId}/activities`)
      .set('Cookie', member1.cookie);

    expect(actRes.status).toBe(200);
    expect(actRes.body.items[0].type).toBe('ATTACHMENT_ADDED');
    expect(actRes.body.items[0].actor.id).toBe(member1.user.id);
    expect(actRes.body.items[0].metadata.originalName).toBe('report.pdf');
  });

  it('rejects uploads with forbidden MIME types', async () => {
    const { member1, taskId } = await setupWorkspaceProjectAndTask();

    const fileContent = Buffer.from('binary-exe-content');

    const res = await request(app)
      .post(`/api/tasks/${taskId}/attachments`)
      .set('Cookie', member1.cookie)
      .attach('file', fileContent, {
        filename: 'malicious.exe',
        contentType: 'application/x-msdownload',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('not permitted');
  });

  it('rejects upload requests without any file attached', async () => {
    const { member1, taskId } = await setupWorkspaceProjectAndTask();

    const res = await request(app)
      .post(`/api/tasks/${taskId}/attachments`)
      .set('Cookie', member1.cookie);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('No file provided');
  });

  it('lists attachments for a task in descending order', async () => {
    const { member1, taskId } = await setupWorkspaceProjectAndTask();

    // Upload first attachment
    await request(app)
      .post(`/api/tasks/${taskId}/attachments`)
      .set('Cookie', member1.cookie)
      .attach('file', Buffer.from('image1'), {
        filename: 'first.png',
        contentType: 'image/png',
      });

    // Upload second attachment
    await request(app)
      .post(`/api/tasks/${taskId}/attachments`)
      .set('Cookie', member1.cookie)
      .attach('file', Buffer.from('image2'), {
        filename: 'second.png',
        contentType: 'image/png',
      });

    const res = await request(app)
      .get(`/api/tasks/${taskId}/attachments`)
      .set('Cookie', member1.cookie);

    expect(res.status).toBe(200);
    expect(res.body.attachments).toHaveLength(2);
    expect(res.body.attachments[0].originalName).toBe('second.png');
    expect(res.body.attachments[1].originalName).toBe('first.png');
  });

  it('downloads an attachment with correct headers and buffer payload', async () => {
    const { member1, taskId } = await setupWorkspaceProjectAndTask();

    const fileBuffer = Buffer.from('Hello attachment content!');

    const uploadRes = await request(app)
      .post(`/api/tasks/${taskId}/attachments`)
      .set('Cookie', member1.cookie)
      .attach('file', fileBuffer, {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    const attachmentId = uploadRes.body.attachment.id;

    const downloadRes = await request(app)
      .get(`/api/attachments/${attachmentId}/download`)
      .set('Cookie', member1.cookie);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toContain('text/plain');
    expect(downloadRes.headers['content-disposition']).toContain('attachment');
    expect(downloadRes.headers['content-disposition']).toContain('notes.txt');
    expect(downloadRes.text).toBe('Hello attachment content!');
  });

  it('denies outsider access to task attachments (returns 404)', async () => {
    const { outsider, taskId } = await setupWorkspaceProjectAndTask();

    const res = await request(app)
      .get(`/api/tasks/${taskId}/attachments`)
      .set('Cookie', outsider.cookie);

    expect(res.status).toBe(404);
  });

  it('handles attachment deletion: author can delete, non-author member is forbidden (403), admin/owner can delete', async () => {
    const { owner, member1, member2, taskId } = await setupWorkspaceProjectAndTask();

    // Member 1 uploads an attachment
    const uploadRes = await request(app)
      .post(`/api/tasks/${taskId}/attachments`)
      .set('Cookie', member1.cookie)
      .attach('file', Buffer.from('content'), {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      });

    const attachmentId = uploadRes.body.attachment.id;

    // Member 2 (not author, regular member) tries to delete -> 403
    const forbiddenRes = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set('Cookie', member2.cookie);

    expect(forbiddenRes.status).toBe(403);

    // Workspace Owner deletes -> 204 Success
    const deleteRes = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set('Cookie', owner.cookie);

    expect(deleteRes.status).toBe(204);

    // Check list is now empty
    const listRes = await request(app)
      .get(`/api/tasks/${taskId}/attachments`)
      .set('Cookie', member1.cookie);

    expect(listRes.body.attachments).toHaveLength(0);

    // Verify activity history has ATTACHMENT_DELETED
    const actRes = await request(app)
      .get(`/api/tasks/${taskId}/activities`)
      .set('Cookie', owner.cookie);

    expect(actRes.body.items[0].type).toBe('ATTACHMENT_DELETED');
    expect(actRes.body.items[0].actor.id).toBe(owner.user.id);
  });
});
