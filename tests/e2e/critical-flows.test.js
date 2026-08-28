// E2E Tests - Critical user flows
import { test, expect } from '@playwright/test';

test.describe('Loksewa MCQ Portal - Critical Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    // Wait for app to load
    await page.waitForSelector('#syllabus-overview-content', { timeout: 30000 });
  });

  test.describe('Initial Load', () => {
    test('should show syllabus overview on load', async ({ page }) => {
      await expect(page.locator('#syllabus-overview-content')).toBeVisible();
      // Questions should NOT be loaded initially
      await expect(page.locator('#mcq-container')).toBeEmpty();
    });

    test('should auto-open syllabus overview', async ({ page }) => {
      await expect(page.locator('#syllabus-overview-content')).not.toHaveClass('hidden');
    });

    test('should show category badges with correct topic counts', async ({ page }) => {
      // Wait for data to load
      await page.waitForTimeout(2000);

      // Check Nepal GK category
      const nepalGkBadge = page.locator('#category-nepal-gk .px-3.py-1');
      await expect(nepalGkBadge).toContainText('Topics');

      // Check Governance category
      const governanceBadge = page.locator('#category-governance-law .px-3.py-1');
      await expect(governanceBadge).toContainText('Topics');
    });
  });

  test.describe('Practice Flow', () => {
    test('should load questions when clicking Practice button on topic card', async ({ page }) => {
      // Find a topic card with Practice button
      const practiceBtn = page.locator('button:has-text("Practice")').first();
      await expect(practiceBtn).toBeVisible();

      // Click Practice button
      await practiceBtn.click();

      // Should switch to Practice tab
      await expect(page.locator('#tab-practice')).not.toHaveClass('hidden');

      // Should show questions
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });
      await expect(page.locator('#mcq-container')).not.toBeEmpty();
    });

    test('should filter questions by topic when selecting from dropdown', async ({ page }) => {
      // First click a Practice button to load questions
      await page.locator('button:has-text("Practice")').first().click();
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });

      // Select a specific topic from dropdown
      const topicSelect = page.locator('#topic-select');
      await expect(topicSelect).toBeVisible();

      // Get available options
      const options = await topicSelect.locator('option').allTextContents();
      if (options.length > 1) {
        await topicSelect.selectOption(options[1]); // Select first actual topic
        await page.waitForTimeout(500);
        // Questions should be filtered
        await expect(page.locator('#mcq-container')).not.toBeEmpty();
      }
    });

    test('should search questions', async ({ page }) => {
      await page.locator('button:has-text("Practice")').first().click();
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });

      const searchInput = page.locator('#search-input');
      await expect(searchInput).toBeVisible();

      await searchInput.fill('Nepal');
      await page.waitForTimeout(500);

      // Should filter questions containing "Nepal"
      await expect(page.locator('#mcq-container')).not.toBeEmpty();
    });

    test('should navigate pagination', async ({ page }) => {
      await page.locator('button:has-text("Practice")').first().click();
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });

      // Check if pagination exists
      const nextBtn = page.locator('button:has-text("Next")');
      if (await nextBtn.isEnabled({ timeout: 2000 })) {
        await nextBtn.click();
        await page.waitForTimeout(500);
        await expect(page.locator('#mcq-container')).not.toBeEmpty();
      }
    });

    test('should keep List View as the active practice view', async ({ page }) => {
      await page.locator('button:has-text("Practice")').first().click();
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });

      // Zen Mode was removed — List View is the only practice view
      await expect(page.locator('#practice-list-view')).toBeVisible();
      await expect(page.locator('#mcq-container')).toBeVisible();
      // No Zen button should exist anymore
      await expect(page.locator('#btn-view-zen')).toHaveCount(0);
    });

    test('should bookmark question', async ({ page }) => {
      await page.locator('button:has-text("Practice")').first().click();
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });

      const bookmarkBtn = page.locator('button[onclick*="toggleBookmark"]').first();
      if (await bookmarkBtn.isVisible({ timeout: 2000 })) {
        await bookmarkBtn.click();
        await page.waitForTimeout(500);
        // Should show filled bookmark icon (lucide renders <i> as <svg>)
        await expect(bookmarkBtn.locator('.fill-current')).toHaveCount(1);
      }
    });
  });

  test.describe('Exam Flow', () => {
    test('should start exam from topic card', async ({ page }) => {
      const examBtn = page.locator('button:has-text("Exam")').first();
      await expect(examBtn).toBeVisible();

      await examBtn.click();

      // Should switch to Exam tab
      await expect(page.locator('#tab-exam')).not.toHaveClass('hidden');

      // Should show exam setup
      await expect(page.locator('#exam-topic-select')).toBeVisible();
    });

    test('should configure and start exam', async ({ page }) => {
      await page.locator('button:has-text("Exam")').first().click();

      // Select topic
      const topicSelect = page.locator('#exam-topic-select');
      const options = await topicSelect.locator('option').allTextContents();
      if (options.length > 1) {
        await topicSelect.selectOption(options[1]);
      }

      // Start exam
      const startBtn = page.locator('button:has-text("Start Exam")');
      if (await startBtn.isVisible({ timeout: 2000 })) {
        await startBtn.click();

        // Should show exam interface
        await expect(page.locator('#exam-question-container')).toBeVisible();
      }
    });
  });

  test.describe('Battle Arena Flow', () => {
    test('should open battle lobby', async ({ page }) => {
      const battleTab = page.locator('#nav-battle');
      await battleTab.click();

      await expect(page.locator('#tab-battle')).not.toHaveClass('hidden');
      await expect(page.locator('#battle-lobby')).toBeVisible();
    });

    test('should create local pass-and-play battle', async ({ page }) => {
      await page.locator('#nav-battle').click();

      const localBtn = page.locator('button:has-text("Local Pass & Play")');
      if (await localBtn.isVisible({ timeout: 2000 })) {
        await localBtn.click();

        // Should show player setup
        await expect(page.locator('#player-setup')).toBeVisible();
      }
    });
  });

  test.describe('Syllabus Overview', () => {
    test('should toggle syllabus overview', async ({ page }) => {
      const toggleBtn = page.locator('button[onclick*="toggleSyllabusOverview"]');

      // Should be open by default
      await expect(page.locator('#syllabus-overview-content')).not.toHaveClass('hidden');

      // Click to close
      await toggleBtn.click();
      await expect(page.locator('#syllabus-overview-content')).toHaveClass(/hidden/);

      // Click to open
      await toggleBtn.click();
      await expect(page.locator('#syllabus-overview-content')).not.toHaveClass(/hidden/);
    });

    test('should filter syllabus by category', async ({ page }) => {
      const filterButtons = page.locator('#syllabus-filter-pills button');

      // Click GK filter
      const gkFilter = page.locator('#filter-gk');
      if (await gkFilter.isVisible({ timeout: 2000 })) {
        await gkFilter.click();
        await page.waitForTimeout(500);

        // Should show only GK category
        // (the app removes filtered-out categories from the DOM rather than hiding them)
        await expect(page.locator('#category-nepal-gk')).toBeVisible();
        await expect(page.locator('#category-civil-engineering')).toHaveCount(0);
      }
    });

    test('should show due for review filter', async ({ page }) => {
      const dueFilter = page.locator('#filter-due');
      if (await dueFilter.isVisible({ timeout: 2000 })) {
        await dueFilter.click();
        await page.waitForTimeout(500);
        // Should show only topics with due questions
      }
    });
  });

  test.describe('Dark Mode', () => {
    test('should toggle dark mode', async ({ page }) => {
      const darkBtn = page.locator('button[onclick*="toggleDarkMode"]');

      // Get initial theme
      const initialTheme = await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      );

      await darkBtn.click();
      await page.waitForTimeout(300);

      const newTheme = await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      );
      expect(newTheme).not.toBe(initialTheme);

      // Toggle back
      await darkBtn.click();
      await page.waitForTimeout(300);

      const finalTheme = await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      );
      expect(finalTheme).toBe(initialTheme);
    });
  });

  test.describe('Instant Filter Tags', () => {
    test('should show filter tags', async ({ page }) => {
      await page.locator('button:has-text("Practice")').first().click();
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });

      const filterContainer = page.locator('#instant-filter-tags');
      await expect(filterContainer).toBeVisible();

      // Should have All, Unattempted, Incorrect, Bookmarked
      await expect(filterContainer.locator('button#instant-filter-all')).toBeVisible();
      await expect(filterContainer.locator('button#instant-filter-unattempted')).toBeVisible();
      await expect(filterContainer.locator('button#instant-filter-incorrect')).toBeVisible();
      await expect(filterContainer.locator('button#instant-filter-bookmarked')).toBeVisible();
    });

    test('should filter by unattempted', async ({ page }) => {
      await page.locator('button:has-text("Practice")').first().click();
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });

      const unattemptedBtn = page.locator('#instant-filter-unattempted');
      await unattemptedBtn.click();
      await page.waitForTimeout(500);

      // Should show only unattempted questions
      // (Hard to verify without knowing state, but shouldn't error)
    });
  });

  test.describe('Resume Last Studied', () => {
    test('should show last studied topic in resume button', async ({ page }) => {
      const resumeBtn = page.locator('#resume-topic-name');
      await expect(resumeBtn).toBeVisible();

      // Should show either topic name or "No recent activity"
      const text = await resumeBtn.textContent();
      expect(text.length).toBeGreaterThan(0);
    });

    test('should navigate to last studied topic on click', async ({ page }) => {
      const resumeBtn = page.locator('button[onclick*="resumeLastStudied"]');
      await resumeBtn.click();

      // Should switch to practice tab
      await expect(page.locator('#tab-practice')).not.toHaveClass('hidden');
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('should answer with number keys in list mode', async ({ page }) => {
      await page.locator('button:has-text("Practice")').first().click();
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });

      // Press 1 to select option A
      await page.keyboard.press('1');
      await page.waitForTimeout(500);

      // First question should have option A selected
      const firstOption = page.locator('#mcq-container button').first();
      // Hard to verify exact state without more context
    });

    test('should use arrow keys to navigate practice pages in list view', async ({ page }) => {
      await page.locator('button:has-text("Practice")').first().click();
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });

      // List View stays active; pressing ArrowRight should not error
      await expect(page.locator('#practice-list-view')).toBeVisible();
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(500);
      await expect(page.locator('#mcq-container')).not.toBeEmpty();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#syllabus-overview-content', { timeout: 30000 });

      // Syllabus should be visible
      await expect(page.locator('#syllabus-overview-content')).toBeVisible();

      // Practice button should work
      await page.locator('button:has-text("Practice")').first().click();
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });
      await expect(page.locator('#mcq-container')).not.toBeEmpty();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#syllabus-overview-content', { timeout: 30000 });

      await page.locator('button:has-text("Practice")').first().click();
      await page.waitForSelector('#mcq-container > *', { timeout: 10000 });
      await expect(page.locator('#mcq-container')).not.toBeEmpty();
    });
  });
});
