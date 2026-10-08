import { test, expect } from '@playwright/test';

test.describe('Journey 3: Workspace Invitation & Multi-User Acceptance', () => {
  test('creates invitation, accepts in second session, and verifies membership', async ({ page, browser }) => {
    const timestamp = Date.now();
    const ownerEmail = `owner_${timestamp}@example.com`;
    const inviteeEmail = `invitee_${timestamp}@example.com`;
    const workspaceName = `Invites HQ ${timestamp}`;

    // 1. Register Owner
    await page.goto('/register');
    await page.getByLabel(/^full name$/i).fill('Workspace Owner');
    await page.getByLabel(/^email$/i).fill(ownerEmail);
    await page.getByLabel(/^password$/i).fill('Password123!');
    await page.getByRole('button', { name: /^create account$/i }).click();

    // 2. Create Workspace
    await page.waitForURL('**/workspaces');
    await page.getByRole('button', { name: /create workspace/i }).first().click();
    await page.getByLabel(/workspace name/i).fill(workspaceName);
    await page.getByRole('button', { name: /create workspace/i }).last().click();
    await page.waitForURL(/\/workspaces\/[^/]+\/projects/);

    // 3. Navigate to Workspace Members page
    await page.getByRole('link', { name: /^members$/i }).click();
    await page.waitForURL(/\/workspaces\/[^/]+\/members/);
    await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible();

    // 4. Invite second user
    await page.getByRole('button', { name: /invite member/i }).first().click();
    await page.getByLabel(/email address/i).fill(inviteeEmail);
    await page.getByRole('button', { name: /^create invitation$/i }).click();

    // 5. Extract the generated invitation link
    const inviteLinkInput = page.locator('input[readonly]');
    await expect(inviteLinkInput).toBeVisible();
    const inviteUrl = await inviteLinkInput.inputValue();
    expect(inviteUrl).toContain('/invitations/');

    // 6. In a new isolated browser context (second user)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    // Register second user with matching email
    await page2.goto('/register');
    await page2.getByLabel(/^full name$/i).fill('Invited Colleague');
    await page2.getByLabel(/^email$/i).fill(inviteeEmail);
    await page2.getByLabel(/^password$/i).fill('Password123!');
    await page2.getByRole('button', { name: /^create account$/i }).click();
    await page2.waitForURL('**/workspaces');

    // 7. Visit the invitation URL
    await page2.goto(inviteUrl);
    await expect(page2.getByRole('heading', { name: /you've been invited!/i })).toBeVisible();
    await expect(page2.getByText(workspaceName)).toBeVisible();
    await expect(page2.getByText(inviteeEmail)).toBeVisible();

    // 8. Accept invitation
    await page2.getByRole('button', { name: /accept & join workspace/i }).click();

    // 9. Verify second user is redirected to workspace and has membership
    await page2.waitForURL(/\/workspaces\/[^/]+\/projects/);
    await expect(page2.getByText(workspaceName).first()).toBeVisible();

    await context2.close();
  });
});
