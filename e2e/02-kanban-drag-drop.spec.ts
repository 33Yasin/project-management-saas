import { test, expect } from '@playwright/test';

test.describe('Journey 2: Kanban Drag & Drop and Persistence', () => {
  test('moves task from TODO to IN_PROGRESS and persists position after reload', async ({ page }) => {
    const timestamp = Date.now();
    const userEmail = `kanban_${timestamp}@example.com`;
    const workspaceName = `Kanban WS ${timestamp}`;
    const projectName = `Kanban Proj ${timestamp}`;
    const taskTitle = `Draggable Task ${timestamp}`;

    // 1. Register user
    await page.goto('/register');
    await page.getByLabel(/^full name$/i).fill('Kanban Lead');
    await page.getByLabel(/^email$/i).fill(userEmail);
    await page.getByLabel(/^password$/i).fill('Password123!');
    await page.getByRole('button', { name: /^create account$/i }).click();

    // 2. Create workspace
    await page.waitForURL('**/workspaces');
    await page.getByRole('button', { name: /create workspace/i }).first().click();
    await page.getByLabel(/workspace name/i).fill(workspaceName);
    await page.getByRole('button', { name: /create workspace/i }).last().click();

    // 3. Create project
    await page.waitForURL(/\/workspaces\/[^/]+\/projects/);
    await page.getByRole('button', { name: /new project|create first project/i }).first().click();
    await page.getByLabel(/^project name$/i).fill(projectName);
    await page.getByRole('button', { name: /^create project$/i }).click();

    // 4. Navigate into project tasks
    await page.getByRole('link', { name: /view tasks/i }).first().click();
    await page.waitForURL(/\/projects\/[^/]+\/tasks/);

    // 5. Create a task in TODO status
    await page.getByRole('button', { name: /new task|create first task/i }).first().click();
    await page.getByLabel(/^title$/i).fill(taskTitle);
    await page.getByRole('button', { name: /^create task$/i }).click();
    await expect(page.getByText(taskTitle)).toBeVisible();

    // 6. Switch to Board (Kanban) view
    await page.getByRole('button', { name: /^board$/i }).click();
    await expect(page).toHaveURL(/view=board/);

    // 7. Verify task card is in the 'To Do' column
    const todoColumn = page.getByTestId('kanban-column-todo');
    const inProgressColumn = page.getByTestId('kanban-column-in_progress');

    await expect(todoColumn.getByText(taskTitle)).toBeVisible();

    // 8. Drag card using its designated drag handle button to In Progress column
    const dragHandle = todoColumn.getByRole('button', { name: `Drag task ${taskTitle}` });
    const handleBox = await dragHandle.boundingBox();
    const targetBox = await inProgressColumn.boundingBox();

    if (handleBox && targetBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      // Move 10px to trigger activation constraint (distance: 5px)
      await page.mouse.move(handleBox.x + handleBox.width / 2 + 10, handleBox.y + handleBox.height / 2 + 10, { steps: 5 });
      // Drag smoothly to target column
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 120, { steps: 20 });
      await page.mouse.up();
    }

    // 9. Verify task card moved to 'In Progress' column
    await expect(inProgressColumn.getByText(taskTitle)).toBeVisible({ timeout: 7000 });

    // 10. Reload the page to test persistence across page loads
    await page.reload();
    await expect(page).toHaveURL(/view=board/);

    const reloadedInProgressColumn = page.getByTestId('kanban-column-in_progress');
    await expect(reloadedInProgressColumn.getByText(taskTitle)).toBeVisible({ timeout: 5000 });
  });
});
