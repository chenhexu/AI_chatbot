/**
 * Detailed UI Test Suite for Chat Application
 * Tests various markdown rendering scenarios with proper response waiting
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3086';
const SCREENSHOT_DIR = './ui-test-screenshots';

// Test cases with prompts
const testCases = [
  {
    name: 'table',
    prompt: 'show me a table',
    description: 'Tests table rendering with borders, headers, and cell content'
  },
  {
    name: 'list',
    prompt: 'show me a list',
    description: 'Tests ordered and unordered list rendering'
  },
  {
    name: 'formatted-text',
    prompt: 'show me formatted text',
    description: 'Tests bold, italic, inline code, and strikethrough'
  },
  {
    name: 'code-block',
    prompt: 'show me code',
    description: 'Tests code block rendering with syntax highlighting'
  },
  {
    name: 'quote',
    prompt: 'show me a quote',
    description: 'Tests blockquote rendering with nested quotes'
  },
  {
    name: 'headers',
    prompt: 'show me headers',
    description: 'Tests heading levels h1-h6'
  }
];

async function runTests() {
  console.log('🚀 Starting Detailed UI Tests...\n');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => {
    console.log(`   Browser Console: ${msg.text()}`);
  });

  // Enable network logging
  page.on('response', response => {
    if (response.url().includes('/api/chat')) {
      console.log(`   API Response: ${response.status()} - ${response.url()}`);
    }
  });

  try {
    // Navigate to the application
    console.log('📱 Navigating to application...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Take initial screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-initial-state.png`, fullPage: true });
    console.log('✅ Initial screenshot saved\n');

    // Run each test case
    for (const testCase of testCases) {
      console.log(`🧪 Testing: ${testCase.name}`);
      console.log(`   Prompt: "${testCase.prompt}"`);
      console.log(`   Description: ${testCase.description}`);

      // Find the textarea and type the message
      const textarea = page.locator('textarea[aria-label="Message input field"]');
      await textarea.waitFor({ state: 'visible', timeout: 5000 });
      await textarea.clear();
      await textarea.fill(testCase.prompt);

      // Submit the message
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Wait for the user message to appear
      await page.waitForSelector('text=show me', { timeout: 5000 });
      console.log('   ✓ User message sent');

      // Wait for assistant response (look for new message bubble)
      try {
        // Wait for either a loading indicator to disappear or a new message to appear
        await page.waitForTimeout(2000);

        // Check if there's a response by looking for content after the user message
        const messageBubbles = await page.locator('.bg-white.text-gray-800').count();
        console.log(`   Found ${messageBubbles} assistant message bubbles`);

        // Wait a bit more for content to render
        await page.waitForTimeout(2000);

      } catch (error) {
        console.log(`   ⚠ Warning: ${error.message}`);
      }

      // Take screenshot
      await page.screenshot({ path: `${SCREENSHOT_DIR}/02-${testCase.name}.png`, fullPage: true });
      console.log(`   ✅ Screenshot saved: ${testCase.name}\n`);

      // Get page HTML for debugging
      const content = await page.content();
      const hasTable = content.includes('<table');
      const hasList = content.includes('<ul') || content.includes('<ol');
      const hasCode = content.includes('<pre') || content.includes('<code');
      const hasQuote = content.includes('<blockquote');
      const hasHeader = content.includes('<h1') || content.includes('<h2') || content.includes('<h3');

      console.log(`   Content analysis:`);
      console.log(`   - Table: ${hasTable ? '✓' : '✗'}`);
      console.log(`   - List: ${hasList ? '✓' : '✗'}`);
      console.log(`   - Code: ${hasCode ? '✓' : '✗'}`);
      console.log(`   - Quote: ${hasQuote ? '✓' : '✗'}`);
      console.log(`   - Headers: ${hasHeader ? '✓' : '✗'}`);
      console.log('');

      // Clear chat for next test (refresh page)
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
    }

    console.log('🎉 All tests completed!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the tests
runTests().catch(console.error);
