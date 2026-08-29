import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', msg => {
  if (msg.type() === 'error') {
    errors.push(`console: ${msg.text().slice(0, 200)}`);
  }
});

await page.goto('http://localhost:3000/app.html');
await page.waitForSelector('#syllabus-overview-content', { state: 'visible', timeout: 30000 });

// Wait for question bank
for (let i = 0; i < 40; i++) {
  const practiceCount = await page
    .locator('#syllabus-categories button:has-text("Practice")')
    .count();
  if (practiceCount > 0) {
    break;
  }
  await page.waitForTimeout(500);
}

// 1. Zen button and container fully removed
const zenGone = await page.evaluate(() => ({
  btn: !!document.getElementById('btn-view-zen'),
  container: !!document.getElementById('practice-zen-view'),
  flash: !!document.getElementById('zen-flashcard-container'),
  zenModeText:
    !!document.querySelector('button:has-text("Zen")') ||
    document.body.innerText.includes('Zen Mode'),
}));
const zenVerdict =
  JSON.stringify(zenGone) === '{"btn":false,"container":false,"flash":false,"zenModeText":false}'
    ? 'PASS'
    : 'CHECK';
console.log('1. ZEN REMOVED FROM DOM:', JSON.stringify(zenGone), zenVerdict);

// 2. Click Practice -> questions render in list view
await page.locator('#syllabus-categories button:has-text("Practice")').first().click();
await page.waitForSelector('#mcq-container > *', { timeout: 15000 });

const listState = await page.evaluate(() => ({
  listVisible:
    !!document.querySelector('#practice-list-view') &&
    document.querySelector('#practice-list-view').offsetParent !== null,
  renderer: document.getElementById('mcq-container').children.length,
}));
console.log('2. LIST VIEW VISIBLE:', JSON.stringify(listState));

// 3. Answer a question
const answers = page.locator('[onclick*="selectAndEvaluatePracticeAnswer"]');
console.log('3. ANSWER BUTTONS:', await answers.count());
if ((await answers.count()) > 0) {
  await answers.first().click();
  await page.waitForTimeout(600);
  const xp = await page.evaluate(() => document.getElementById('xp-text').textContent.trim());
  console.log('   XP AFTER ANSWER:', xp);
}

// 4. Page navigation arrows still work (list view)
const before = await page.evaluate(() => document.getElementById('stat-total').textContent);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(400);
const totalAfter = await page.evaluate(() => document.getElementById('stat-total').textContent);
console.log('4. STAT-TOTAL before/after ArrowRight:', before, '/', totalAfter);

// 5. Pagination nav
const pageNavBtns = page.locator('#page-nav button');
console.log('5. PAGE NAV BUTTONS:', await pageNavBtns.count());

console.log('PAGE ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
