import { test, expect } from '@playwright/test';

test.describe('Journey 4: Task Attachments Upload & Download', () => {
  test('uploads an attachment to a task, verifies visibility, and confirms download access', async ({ page }) => {
    const timestamp = Date.now();
    const userEmail = `att_${timestamp}@example.com`;
    const workspaceName = `Media WS ${timestamp}`;
    const projectName = `Assets Proj ${timestamp}`;
    const taskTitle = `Design Review Task ${timestamp}`;
    const testFileName = `spec-doc-${timestamp}.txt`;

    // 1. Register User
    await page.goto('/register');
    await page.getByLabel(/^full name$/i).fill('Media Lead');
    await page.getByLabel(/^email$/i).fill(userEmail);
    await page.getByLabel(/^password$/i).fill('Password123!');
    await page.getByRole('button', { name: /^create account$/i }).click();

    // 2. Create Workspace
    await page.waitForURL('**/workspaces');
    await page.getByRole('button', { name: /create workspace/i }).first().click();
    await page.getByLabel(/workspace name/i).fill(workspaceName);
    await page.getByRole('button', { name: /create workspace/i }).last().click();

    // 3. Create Project
    await page.waitForURL(/\/workspaces\/[^/]+\/projects/);
    await page.getByRole('button', { name: /new project|create first project/i }).first().click();
    await page.getByLabel(/^project name$/i).fill(projectName);
    await page.getByRole('button', { name: /^create project$/i }).click();

    // 4. Navigate into project tasks
    await page.getByRole('link', { name: /view tasks/i }).first().click();
    await page.waitForURL(/\/projects\/[^/]+\/tasks/);

    // 5. Create a task
    await page.getByRole('button', { name: /new task|create first task/i }).first().click();
    await page.getByLabel(/^title$/i).fill(taskTitle);
    await page.getByRole('button', { name: /^create task$/i }).click();
    await expect(page.getByText(taskTitle)).toBeVisible();

    // 6. Click into task detail page
    await page.getByRole('link', { name: taskTitle }).click();
    await page.waitForURL(/\/tasks\/[^/]+/);
    await expect(page.getByRole('heading', { name: /attachments/i })).toBeVisible();

    // 7. Upload attachment file
    await page.setInputFiles('input[type="file"]', {
      name: testFileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('Specification document content for E2E testing'),
    });

    // 8. Verify attachment appears in the list
    await expect(page.getByText(testFileName)).toBeVisible({ timeout: 10000 });

    // 9. Verify download button is present and accessible
    const downloadButton = page.getByRole('button', { name: `Download ${testFileName}` });
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeEnabled();

    // 10. Verify activity timeline recorded attachment event
    await expect(page.getByText(/added an attachment/i)).toBeVisible();
  });
});
