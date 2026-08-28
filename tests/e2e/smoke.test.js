// Smoke Tests - Quick validation of critical functionality
import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Build Verification', () => {
  test('homepage loads without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    // NOTE: do not use waitForLoadState('networkidle') - the app keeps a
    // persistent Firestore connection once initialized. Wait for the
    // syllabus overview to auto-open instead (signals full init).
    await page.waitForSelector('#syllabus-overview-content', { state: 'visible', timeout: 30000 });

    expect(errors).toHaveLength(0);
    await expect(page.locator('body')).toBeVisible();
  });

  test('all main tabs are accessible', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#nav-practice');

    const tabs = ['#nav-practice', '#nav-exam', '#nav-battle', '#nav-manage', '#nav-spaced'];

    for (const tab of tabs) {
      await page.locator(tab).click();
      await page.waitForTimeout(300);
      // Tab should be active
      await expect(page.locator(tab)).toHaveClass(/bg-indigo-50/);
    }
  });

  test('syllabus overview renders', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#syllabus-overview-content', { timeout: 30000 });

    await expect(page.locator('#syllabus-categories')).not.toBeEmpty();
  });

  test('question data loads', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mcq-container', { state: 'attached', timeout: 30000 });

    // Click practice to load questions
    await page.locator('button:has-text("Practice")').first().click();
    await page.waitForSelector('#mcq-container > *', { timeout: 10000 });

    // Should have at least one question card
    await expect(page.locator('.glass-card').first()).toBeVisible();
  });

  test('no console errors on load', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    // See note above: networkidle never fires due to the Firestore connection.
    await page.waitForSelector('#syllabus-overview-content', { state: 'visible', timeout: 30000 });

    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(
      e => !e.includes('favicon') && !e.includes('sw.js') && !e.includes('Extension')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('key UI elements present', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    // See note above: networkidle never fires due to the Firestore connection.
    await page.waitForSelector('#syllabus-overview-content', { state: 'visible', timeout: 30000 });

    // Header elements
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('#dark-icon')).toBeVisible();
    await expect(page.locator('#audio-icon')).toBeVisible();

    // Navigation
    await expect(page.locator('#nav-practice')).toBeVisible();
    await expect(page.locator('#nav-exam')).toBeVisible();
    await expect(page.locator('#nav-battle')).toBeVisible();
  });
});
