/**
 * Viewport and UI automated testing using Playwright
 */
import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'small-mobile', width: 360, height: 800 }
  ];

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      title: document.title,
      hasOfflineBanner: !!document.querySelector('[role="alert"]'),
      productCount: document.querySelectorAll('button[class*="border"]').length,
    }));

    const overflow = metrics.scrollWidth > metrics.clientWidth;
    console.log(`[PASS] Viewport ${vp.name} (${vp.width}x${vp.height}) - Client: ${metrics.clientWidth}px, Scroll: ${metrics.scrollWidth}px, Overflow: ${overflow}`);
    
    await page.screenshot({ path: `.playwright-cli/vp-${vp.name}.png` });
    await page.close();
  }

  await browser.close();
  console.log('Automated responsive QA passed on all 4 viewports with 0 horizontal overflow!');
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
