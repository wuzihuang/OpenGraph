import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('review, approval, live run, and reconnect replay', async ({ page, request }) => {
  const token = readFileSync(resolve('.graph-engineer-e2e/session-token'), 'utf8').trim();
  const headers = { authorization: `Bearer ${token}` };
  const created = await request.post('/api/graphs/demo', { headers });
  expect(created.ok()).toBeTruthy();
  const draft = await created.json();

  await page.goto(`/?token=${encodeURIComponent(token)}&graph=${draft.graphId}`);
  await expect(
    page.getByRole('heading', {
      name: 'Build and verify a resilient feature in the sample repository',
    }),
  ).toBeVisible();
  await expect(page.getByText('Execution locked until human approval')).toBeVisible();

  await page.getByText('Runtime & recovery').first().click();
  const objective = page.locator('textarea');
  await objective.fill('x');
  await expect(page.getByText(/1 errors/)).toBeVisible();
  await objective.fill('Implement durable runtime scheduling and checkpoint recovery.');
  await expect(page.getByText(/0 errors/)).toBeVisible();
  await page.getByRole('button', { name: 'Approve graph' }).click();
  await expect(page.getByText('running').first()).toBeVisible();
  await expect(page.getByText('completed').first()).toBeVisible({ timeout: 8_000 });

  await page.locator('.tabs').getByRole('button', { name: 'Activity' }).click();
  await expect(page.getByText('node.status').first()).toBeVisible();
  await page.reload();
  await page.getByText('Runtime & recovery').first().click();
  await page.locator('.tabs').getByRole('button', { name: 'Activity' }).click();
  await expect(page.getByText('node.status').first()).toBeVisible();
  await page.locator('.tabs').getByRole('button', { name: 'Evidence' }).click();
  await expect(page.getByText('Tool calls')).toBeVisible();
});
