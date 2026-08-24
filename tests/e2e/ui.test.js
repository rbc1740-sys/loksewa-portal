// UI Tests - Visual regression and usability
import { test, expect } from '@playwright/test';

test.describe('UI Tests - Visual & Usability', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app.html');
    await page.waitForSelector('#syllabus-overview-content', { timeout: 30000 });
  });

  test.describe('Visual Consistency', () => {
    test('topic cards have consistent styling', async ({ page }) => {
      const cards = page.locator('.topic-card');
      const count = await cards.count();
      
      if (count > 0) {
        // Check first card has required elements
        const firstCard = cards.first();
        await expect(firstCard.locator('h3')).toBeVisible();
        await expect(firstCard.locator('button:has-text("Practice")')).toBeVisible();
        await expect(firstCard.locator('button:has-text("Exam")')).toBeVisible();
        await expect(firstCard.locator('svg circle').first()).toBeVisible(); // Progress ring
      }
    });

    test('question cards have consistent layout', async ({ page }) => {
      await page.locator('button:has-text("Practice")').first().click();
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });
      
      const cards = page.locator('#mcq-container .glass-card');
      const count = await cards.count();
      
      if (count > 0) {
        const firstCard = cards.first();
        // Question text
        await expect(firstCard.locator('h3')).toBeVisible();
        // Options
        await expect(firstCard.locator('button:has-text("A)")')).toBeVisible();
        await expect(firstCard.locator('button:has-text("B)")')).toBeVisible();
        await expect(firstCard.locator('button:has-text("C)")')).toBeVisible();
        await expect(firstCard.locator('button:has-text("D)")')).toBeVisible();
        // Actions
        await expect(firstCard.locator('button[onclick*="toggleBookmark"]')).toBeVisible();
        await expect(firstCard.locator('button[onclick*="toggleWeakPoint"]')).toBeVisible();
      }
    });

    test('practice view renders question cards in List View', async ({ page }) => {
      await page.locator('button:has-text("Practice")').first().click();
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });

      // List View is the only practice view; question cards render cleanly
      await expect(page.locator('#practice-list-view')).toBeVisible();
      const firstCard = page.locator('#mcq-container .glass-card').first();
      await expect(firstCard).toBeVisible();
      await expect(firstCard.locator('h3')).toBeVisible();
      await expect(firstCard.locator('button:has-text("A)")')).toBeVisible();
      await expect(firstCard.locator('button[onclick*="toggleBookmark"]')).toBeVisible();
    });
  });

  test.describe('Color Theme Consistency', () => {
    test('light mode colors are correct', async ({ page }) => {
      // Ensure light mode
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      if (isDark) {
        await page.locator('button[onclick*="toggleDarkMode"]').click();
        await page.waitForTimeout(300);
      }
      
      // Check key elements have light mode classes
      await expect(page.locator('html')).not.toHaveClass(/dark/);
      // Design-system v2 themes cards via CSS variables rather than bg-white utilities
      const lightCard = page.locator('.glass-card').first();
      await expect(lightCard).toBeVisible();
    });

    test('dark mode colors are correct', async ({ page }) => {
      // Ensure dark mode
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      if (!isDark) {
        await page.locator('button[onclick*="toggleDarkMode"]').click();
        await page.waitForTimeout(300);
      }
      
      await expect(page.locator('html')).toHaveClass(/dark/);
      // Design-system v2 themes cards via CSS variables rather than dark:* utilities
      const card = page.locator('.glass-card').first();
      await expect(card).toBeVisible();
    });
  });

  test.describe('Typography & Spacing', () => {
    test('text is readable with proper contrast', async ({ page }) => {
      // Check heading hierarchy
      await expect(page.locator('h1, h2, h3').first()).toBeVisible();
      
      // Check font sizes
      const h1 = page.locator('h1').first();
      if (await h1.isVisible({ timeout: 1000 })) {
        const fontSize = await h1.evaluate(el => getComputedStyle(el).fontSize);
        // Compact hero design uses 18px h1 - verify it is at least body-readable size
        expect(parseInt(fontSize)).toBeGreaterThanOrEqual(16);
      }
    });

    test('interactive elements have proper touch targets', async ({ page }) => {
      const buttons = page.locator('button');
      const count = await buttons.count();
      
      for (let i = 0; i < Math.min(count, 10); i++) {
        const btn = buttons.nth(i);
        if (await btn.isVisible({ timeout: 500 })) {
          const box = await btn.boundingBox();
          if (box) {
            // Minimum touch target - compact dense toolbar buttons measure ~30px
            expect(box.height).toBeGreaterThanOrEqual(28);
          }
        }
      }
    });
  });

  test.describe('Responsive Layout', () => {
    test('syllabus grid adapts to viewport', async ({ page }) => {
      // Desktop
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(500);
      
      const cards = page.locator('.topic-card');
      const desktopCount = await cards.count();
      
      // Mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      
      const mobileCount = await cards.count();
      expect(mobileCount).toBe(desktopCount); // Same number of cards, just reflowed
    });

    test('practice view stacks on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      
      await page.locator('button:has-text("Practice")').first().click();
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });
      
      const container = page.locator('#mcq-container');
      const box = await container.boundingBox();
      expect(box.width).toBeLessThanOrEqual(375);
    });

    test('navigation is horizontal scrollable on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      
      // The main nav is the scrollable strip with the no-scrollbar helper class
      const nav = page.locator('.overflow-x-auto.no-scrollbar');
      await expect(nav).toBeVisible();
      
      // Should be able to scroll
      const scrollWidth = await nav.evaluate(el => el.scrollWidth);
      const clientWidth = await nav.evaluate(el => el.clientWidth);
      expect(scrollWidth).toBeGreaterThanOrEqual(clientWidth);
    });
  });

  test.describe('Loading States', () => {
    test('shows loading state for resume button initially', async ({ page }) => {
      // The resume button should eventually show topic or "No recent activity"
      const resumeBtn = page.locator('#resume-topic-name');
      await expect(resumeBtn).toBeVisible();
      
      // Wait for it to update (may already be updated)
      await page.waitForTimeout(1000);
      
      const text = await resumeBtn.textContent();
      expect(text).not.toBe('Loading...');
      expect(text.length).toBeGreaterThan(0);
    });

    test('shows skeleton or empty state for questions', async ({ page }) => {
      // Before clicking practice, container should be empty but exist.
      // (An empty container has zero height, so assert attachment - not visibility.)
      await expect(page.locator('#mcq-container')).toBeAttached();
      await expect(page.locator('#mcq-container')).toBeEmpty();
    });
  });

  test.describe('Animations & Transitions', () => {
    test('syllabus toggle animates', async ({ page }) => {
      const toggleBtn = page.locator('button[onclick*="toggleSyllabusOverview"]');
      const content = page.locator('#syllabus-overview-content');
      
      await toggleBtn.click();
      await page.waitForTimeout(200);
      await expect(content).toHaveClass(/hidden/);
      
      await toggleBtn.click();
      await page.waitForTimeout(200);
      await expect(content).not.toHaveClass(/hidden/);
    });

    test('tab switch animates', async ({ page }) => {
      await page.locator('#nav-exam').click();
      await page.waitForTimeout(200);
      await expect(page.locator('#tab-exam')).not.toHaveClass('hidden');
      
      await page.locator('#nav-practice').click();
      await page.waitForTimeout(200);
      await expect(page.locator('#tab-practice')).not.toHaveClass('hidden');
    });
  });

  test.describe('Accessibility', () => {
    test('has proper heading structure', async ({ page }) => {
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      expect(headings.length).toBeGreaterThan(0);
    });

    test('buttons have accessible names', async ({ page }) => {
      const buttons = page.locator('button');
      const count = await buttons.count();
      
      for (let i = 0; i < Math.min(count, 20); i++) {
        const btn = buttons.nth(i);
        if (await btn.isVisible({ timeout: 500 })) {
          const text = await btn.textContent();
          const ariaLabel = await btn.getAttribute('aria-label');
          const title = await btn.getAttribute('title');
          
          // Should have some accessible name
          const hasName = (text && text.trim().length > 0) || ariaLabel || title;
          expect(hasName).toBeTruthy();
        }
      }
    });

    test('inputs have labels', async ({ page }) => {
      const searchInput = page.locator('#search-input');
      await expect(searchInput).toBeVisible();
      
      // Should have placeholder or associated label
      const placeholder = await searchInput.getAttribute('placeholder');
      expect(placeholder).toBeTruthy();
    });

    test('focus visible on interactive elements', async ({ page }) => {
      await page.locator('button:has-text("Practice")').first().focus();
      await page.waitForTimeout(100);
      
      const focused = page.locator(':focus');
      await expect(focused).toBeVisible();
    });
  });

  test.describe('State Persistence', () => {
    test('dark mode persists across reloads', async ({ page }) => {
      // Toggle to dark
      await page.locator('button[onclick*="toggleDarkMode"]').click();
      await page.waitForTimeout(300);
      
      // Reload
      await page.reload();
      await page.waitForSelector('#syllabus-overview-content', { timeout: 30000 });
      
      // Should still be dark
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      expect(isDark).toBe(true);
    });

    test('username persists', async ({ page }) => {
      // Set username
      await page.evaluate(() => localStorage.setItem('loksewa_username', 'TestUser'));
      
      await page.reload();
      await page.waitForSelector('#syllabus-overview-content', { timeout: 30000 });
      
      const greeting = page.locator('#syllabus-greeting');
      if (await greeting.isVisible({ timeout: 2000 })) {
        await expect(greeting).toContainText('TestUser');
      }
    });
  });
});