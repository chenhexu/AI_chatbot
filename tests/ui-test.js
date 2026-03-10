/**
 * UI Test Suite for Chat Application
 * Tests various markdown rendering scenarios
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3086';
const SCREENSHOT_DIR = './ui-test-screenshots';

// Test cases with expected mock responses
const testCases = [
  {
    name: 'table',
    prompt: 'show me a table',
    expectedResponse: `Here's a table for you:

| Subject | Teacher | Room | Schedule |
|---------|---------|------|----------|
| Mathematics | M. Dupont | Room 101 | Monday 9:00 |
| French | Mme. Martin | Room 102 | Monday 10:00 |
| History | M. Bernard | Room 103 | Tuesday 9:00 |
| English | Mme. Smith | Room 104 | Tuesday 10:00 |
| Science | M. Leroy | Room 105 | Wednesday 9:00 |`
  },
  {
    name: 'list',
    prompt: 'show me a list',
    expectedResponse: `Here's a list of important information:

**School Supplies:**
- Notebooks
- Pens and pencils
- Erasers
- Rulers
- Calculators

**Required Documents:**
1. Birth certificate
2. Proof of residence
3. School reports from previous year
4. Health records

**Important Dates to Remember:**
- September 1st: School starts
- October 15th: Fall break begins
- November 2nd: Classes resume`
  },
  {
    name: 'formatted-text',
    prompt: 'show me formatted text',
    expectedResponse: `Here's various text formatting:

**Bold text** is used for emphasis
*Italic text* is used for subtle emphasis
***Bold and italic*** for strong emphasis

This is \`inline code\` for technical terms.

You can also use ~~strikethrough~~ for deleted text.

Combining **bold and *italic* within** the same sentence works too!`
  },
  {
    name: 'code-block',
    prompt: 'show me code',
    expectedResponse: `Here's an example of code formatting:

\`\`\`javascript
// This is a JavaScript function
function greetStudent(name) {
  const messages = [
    'Welcome to school!',
    'Have a great day!',
    'Learning is fun!'
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

console.log(greetStudent('Marie'));
\`\`\`

And here's some Python:

\`\`\`python
# Python example
class Student:
    def __init__(self, name, grade):
        self.name = name
        self.grade = grade

    def get_info(self):
        return f"{self.name} is in {self.grade}th grade"
\`\`\``
  },
  {
    name: 'quote',
    prompt: 'show me a quote',
    expectedResponse: `Here's an inspirational quote:

> Education is the most powerful weapon which you can use to change the world.
> — Nelson Mandela

And another:

> The more that you read, the more things you will know. The more that you learn, the more places you'll go.
> — Dr. Seuss`
  },
  {
    name: 'headers',
    prompt: 'show me headers',
    expectedResponse: `Here are different heading levels:

# Heading Level 1

This is the main heading, used for the most important titles.

## Heading Level 2

Used for major sections.

### Heading Level 3

Used for subsections.

#### Heading Level 4

For sub-subsections.

##### Heading Level 5

For detailed organization.

###### Heading Level 6

The smallest heading level.

Regular text continues after the headings.`
  }
];

async function runTests() {
  console.log('🚀 Starting UI Tests...\n');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // Navigate to the application
    console.log('📱 Navigating to application...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take initial screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-initial-state.png`, fullPage: true });
    console.log('✅ Initial screenshot saved\n');

    // Run each test case
    for (const testCase of testCases) {
      console.log(`🧪 Testing: ${testCase.name}`);
      console.log(`   Prompt: "${testCase.prompt}"`);

      // Find the textarea and type the message
      const textarea = page.locator('textarea[aria-label="Message input field"]');
      await textarea.waitFor({ state: 'visible' });
      await textarea.clear();
      await textarea.fill(testCase.prompt);

      // Submit the message
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Wait for response
      await page.waitForTimeout(3000);

      // Take screenshot
      await page.screenshot({ path: `${SCREENSHOT_DIR}/02-${testCase.name}.png`, fullPage: true });
      console.log(`   ✅ Screenshot saved: ${testCase.name}\n`);

      // Clear chat for next test (refresh page)
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    console.log('🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the tests
runTests().catch(console.error);
