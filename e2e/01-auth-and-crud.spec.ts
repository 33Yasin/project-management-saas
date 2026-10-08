import { test, expect } from '@playwright/test';

test.describe('Journey 1: Register/Login -> Workspace -> Project -> Task', () => {
  test('creates a complete hierarchy from registration to task creation', async ({ page }) => {
    const timestamp = Date.now();
    const userEmail = `founder_${timestamp}@example.com`;
    const workspaceName = `Workspace ${timestamp}`;
    const projectName = `Project Alpha ${timestamp}`;
    const taskTitle = `Ship core v2 features ${timestamp}`;

    // 1. Register new user
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();

    await page.getByLabel(/^full name$/i).fill('Test Founder');
    await page.getByLabel(/^email$/i).fill(userEmail);
    await page.getByLabel(/^password$/i).fill('Password123!');
    await page.getByRole('button', { name: /^create account$/i }).click();

    // 2. Redirect to workspaces list
    await page.waitForURL('**/workspaces');
    await expect(page.getByRole('heading', { name: /^workspaces$/i })).toBeVisible();

    // 3. Create a new workspace
    await page.getByRole('button', { name: /create workspace/i }).first().click();
    await page.getByLabel(/workspace name/i).fill(workspaceName);
    await page.getByRole('button', { name: /create workspace/i }).last().click();

    // 4. Redirects to project listing in newly created workspace
    await page.waitForURL(/\/workspaces\/[^/]+\/projects/);
    await expect(page.getByRole('heading', { name: /^projects$/i })).toBeVisible();

    // 5. Create a new project
    await page.getByRole('button', { name: /new project|create first project/i }).first().click();
    await page.getByLabel(/^project name$/i).fill(projectName);
    await page.getByLabel(/^description/i).fill('Main product initiative for V2');
    await page.getByRole('button', { name: /^create project$/i }).click();

    // 6. Navigate into project tasks
    await page.getByRole('link', { name: /view tasks/i }).first().click();
    await page.waitForURL(/\/projects\/[^/]+\/tasks/);

    // 7. Create a new task
    await page.getByRole('button', { name: /new task|create first task/i }).first().click();
    await page.getByLabel(/^title$/i).fill(taskTitle);
    await page.getByRole('button', { name: /^create task$/i }).click();

    // 8. Verify task appears on the board / list
    await expect(page.getByText(taskTitle)).toBeVisible();
  });
});
