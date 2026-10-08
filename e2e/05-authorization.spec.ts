import { test, expect } from '@playwright/test';

test.describe('Journey 5: Role-based Authorization Enforcement (UI & API)', () => {
  test('restricts MEMBER from owner-only actions in UI and rejects direct unauthorized API calls with 403', async ({
    page,
    browser,
  }) => {
    const timestamp = Date.now();
    const ownerEmail = `auth_owner_${timestamp}@example.com`;
    const memberEmail = `auth_member_${timestamp}@example.com`;
    const workspaceName = `Security WS ${timestamp}`;

    // 1. Owner registers and sets up workspace
    await page.goto('/register');
    await page.getByLabel(/^full name$/i).fill('Security Owner');
    await page.getByLabel(/^email$/i).fill(ownerEmail);
    await page.getByLabel(/^password$/i).fill('Password123!');
    await page.getByRole('button', { name: /^create account$/i }).click();

    await page.waitForURL('**/workspaces');
    await page.getByRole('button', { name: /create workspace/i }).first().click();
    await page.getByLabel(/workspace name/i).fill(workspaceName);
    await page.getByRole('button', { name: /create workspace/i }).last().click();
    await page.waitForURL(/\/workspaces\/[^/]+\/projects/);

    const currentUrl = page.url();
    const match = currentUrl.match(/\/workspaces\/([^/]+)/);
    const workspaceId = match ? match[1] : '';
    expect(workspaceId).toBeTruthy();

    // 2. Owner invites second user as MEMBER
    await page.getByRole('link', { name: /^members$/i }).click();
    await page.waitForURL(/\/workspaces\/[^/]+\/members/);
    await page.getByRole('button', { name: /invite member/i }).first().click();
    await page.getByLabel(/email address/i).fill(memberEmail);
    // Role is MEMBER by default in the dialog
    await page.getByRole('button', { name: /^create invitation$/i }).click();

    const inviteInput = page.locator('input[readonly]');
    await expect(inviteInput).toBeVisible();
    const inviteUrl = await inviteInput.inputValue();

    // 3. Second user registers and accepts invitation in a clean context
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();

    await memberPage.goto('/register');
    await memberPage.getByLabel(/^full name$/i).fill('Regular Member');
    await memberPage.getByLabel(/^email$/i).fill(memberEmail);
    await memberPage.getByLabel(/^password$/i).fill('Password123!');
    await memberPage.getByRole('button', { name: /^create account$/i }).click();
    await memberPage.waitForURL('**/workspaces');

    await memberPage.goto(inviteUrl);
    await memberPage.getByRole('button', { name: /accept & join workspace/i }).click();
    await memberPage.waitForURL(/\/workspaces\/[^/]+\/projects/);

    // 4. Verify UI restrictions for MEMBER
    // MEMBER should NOT have access to Workspace Settings link in sidebar
    await expect(memberPage.getByRole('link', { name: /^settings$/i })).toHaveCount(0);

    // MEMBER navigates to Members page
    await memberPage.getByRole('link', { name: /^members$/i }).click();
    await memberPage.waitForURL(/\/workspaces\/[^/]+\/members/);

    // MEMBER should NOT see the "Invite Member" button
    await expect(memberPage.getByRole('button', { name: /invite member/i })).toHaveCount(0);

    // 5. Test direct API authorization: MEMBER attempts to DELETE workspace directly
    const apiResult = await memberPage.evaluate(async (wsId) => {
      const res = await fetch(`/api/workspaces/${wsId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    }, workspaceId);

    // Verify server rejects with 403 Forbidden and OWNER_REQUIRED
    expect(apiResult.status).toBe(403);
    expect(apiResult.data.error.code).toBe('OWNER_REQUIRED');

    await memberContext.close();
  });
});
