#!/usr/bin/env python3
"""
Simple NotebookLM Question Interface
Based on MCP server implementation - simplified without sessions

Implements hybrid auth approach:
- Persistent browser profile (user_data_dir) for fingerprint consistency
- Manual cookie injection from state.json for session cookies (Playwright bug workaround)
See: https://github.com/microsoft/playwright/issues/36139
"""

import argparse
import sys
import time
import re
from pathlib import Path

from patchright.sync_api import sync_playwright

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from auth_manager import AuthManager
from notebook_manager import NotebookLibrary
from config import QUERY_INPUT_SELECTORS, RESPONSE_SELECTORS
from browser_utils import BrowserFactory, StealthUtils


def _try_copy_button(response_element, page) -> str:
    """
    Try to click the copy button associated with a specific response element.

    Args:
        response_element: The Playwright element handle for the response
        page: The Playwright page object

    Returns:
        Clipboard text if successful, None otherwise
    """
    try:
        # Search for the copy button within the same container as the response
        # This ensures we get the copy button for THIS response, not an old one
        result = page.evaluate("""(element) => {
            // Find the container of this response
            let container = element;

            // Try different container levels
            const possibleContainers = [
                element,
                element.parentElement,  // Parent
                element.parentElement?.parentElement,  // Grandparent
                element.closest('.to-user-container'),  // Closest message container
                element.closest('[data-message-author="bot"]'),  // Bot message container
                element.closest('[data-message-author="assistant"]'),  // Assistant container
            ];

            let copyButton = null;

            // Search for copy button in each container level
            for (const cont of possibleContainers) {
                if (!cont) continue;

                // Try multiple selectors for copy button
                const selectors = [
                    'button[aria-label="Copy model response to clipboard"]',
                    'button[aria-label*="copy" i]',
                    'button[class*="copy" i]',
                    'button[title*="copy" i]',
                    '.copy-button',
                    'button[aria-label*="Copy"]',
                ];

                for (const selector of selectors) {
                    const buttons = cont.querySelectorAll(selector);
                    if (buttons.length > 0) {
                        // Get the first copy button in this container
                        copyButton = buttons[0];
                        break;
                    }
                }

                if (copyButton) break;
            }

            if (!copyButton) {
                return { found: false, error: 'No copy button found in response container' };
            }

            // Click the button
            copyButton.click();

            return { found: true, buttonHTML: copyButton.outerHTML };
        }""", response_element)

        if not result or not result.get('found'):
            print(f"  ! Copy button not found: {result.get('error', 'Unknown error')}")
            return None

        print("  ✓ Clicked copy button")

        # Wait for clipboard to be populated
        StealthUtils.random_delay(500, 1000)

        # Read clipboard
        clipboard_text = page.evaluate("() => navigator.clipboard.readText()")

        if not clipboard_text:
            print("  ! Clipboard is empty")
            return None

        print(f"  📋 Got clipboard content ({len(clipboard_text)} chars)")

        # Validate clipboard content matches response roughly
        # The clipboard might have markdown formatting, so it could be longer
        # But it shouldn't be drastically different
        response_text = response_element.inner_text().strip()
        clipboard_ratio = len(clipboard_text) / len(response_text) if len(response_text) > 0 else 0

        # Accept clipboard if ratio is reasonable (0.3 to 5.0)
        # Markdown formatting can make it significantly longer or shorter
        if 0.3 <= clipboard_ratio <= 5.0:
            print(f"  ✓ Clipboard content validated (ratio: {clipboard_ratio:.2f})")
            return clipboard_text
        else:
            print(f"  ! Clipboard content seems off (ratio: {clipboard_ratio:.2f}), ignoring")
            return None

    except Exception as e:
        print(f"  ! Copy button error: {e}")
        return None


def ask_notebooklm(question: str, notebook_url: str, headless: bool = True) -> str:
    """
    Ask a question to NotebookLM

    Args:
        question: Question to ask
        notebook_url: NotebookLM notebook URL
        headless: Run browser in headless mode

    Returns:
        Answer text from NotebookLM
    """
    auth = AuthManager()

    if not auth.is_authenticated():
        print("⚠️ Not authenticated. Run: python auth_manager.py setup")
        return None

    print(f"💬 Asking: {question}")
    print(f"📚 Notebook: {notebook_url}")

    playwright = None
    context = None

    try:
        # Start playwright
        playwright = sync_playwright().start()

        # Launch persistent browser context using factory
        context = BrowserFactory.launch_persistent_context(
            playwright,
            headless=headless
        )

        # Navigate to notebook
        page = context.new_page()
        print("  🌐 Opening notebook...")
        page.goto(notebook_url, wait_until="domcontentloaded")

        # Wait for NotebookLM
        page.wait_for_url(re.compile(r"^https://notebooklm\.google\.com/"), timeout=10000)

        # Wait for query input (MCP approach)
        print("  ⏳ Waiting for query input...")
        query_element = None

        for selector in QUERY_INPUT_SELECTORS:
            try:
                query_element = page.wait_for_selector(
                    selector,
                    timeout=10000,
                    state="visible"  # Only check visibility, not disabled!
                )
                if query_element:
                    print(f"  ✓ Found input: {selector}")
                    break
            except:
                continue

        if not query_element:
            print("  ❌ Could not find query input")
            return None

        # Type question (human-like, fast) - ORIGINAL SKILL APPROACH: No clearing
        print("  ⏳ Typing question...")
        input_selector = QUERY_INPUT_SELECTORS[0]
        StealthUtils.human_type(page, input_selector, question)

        # Submit
        print("  📤 Submitting...")
        page.keyboard.press("Enter")

        # Small pause
        StealthUtils.random_delay(500, 1500)

        # Wait for response (MCP approach: poll for stable text)
        print("  ⏳ Waiting for answer...")

        answer = None
        stable_count = 0
        last_text = None
        deadline = time.time() + 120  # 2 minutes timeout

        # Rate limit detection patterns
        RATE_LIMIT_PATTERNS = [
            "The system was unable to answer",
            "Unable to answer",
            "Daily limit reached",
            "Rate limit exceeded",
        ]

        while time.time() < deadline:
            # Check if NotebookLM is still thinking (most reliable indicator)
            try:
                thinking_element = page.query_selector('div.thinking-message')
                if thinking_element and thinking_element.is_visible():
                    time.sleep(1)
                    continue  # Still thinking, wait
            except:
                pass

            # Get the current response text
            current_text = None
            current_element = None  # Store the element for copy button search

            for selector in RESPONSE_SELECTORS:
                try:
                    elements = page.query_selector_all(selector)
                    if elements:
                        # Get last (newest) response
                        current_element = elements[-1]
                        text = current_element.inner_text().strip()

                        if text:
                            current_text = text
                            break
                except:
                    continue

            # Check if we have a response
            if current_text:
                # Check for rate limit messages
                is_rate_limit = any(pattern.lower() in current_text.lower() for pattern in RATE_LIMIT_PATTERNS)
                if is_rate_limit:
                    print(f"  ⚠️ Rate limit detected: {current_text}")
                    answer = current_text
                    break

                # Check stability
                if current_text == last_text:
                    stable_count += 1
                    if stable_count >= 3:  # Stable for 3 consecutive polls
                        print(f"  ✓ Response stable (length: {len(current_text)} chars)")

                        # Determine if we should try copy button or use direct text
                        # For short responses (single line), use direct text
                        # For longer responses, try copy button for clean markdown
                        if len(current_text) < 100 or '\n' not in current_text:
                            # Short response - use direct text
                            print("  ✓ Using direct text (short response)")
                            answer = current_text
                            break
                        else:
                            # Longer response - try copy button first
                            print("  📋 Trying copy button for clean markdown...")
                            markdown = _try_copy_button(current_element, page)
                            if markdown:
                                answer = markdown
                                break
                            else:
                                # Fallback to direct text
                                print("  ! Copy button failed, using direct text")
                                answer = current_text
                                break
                else:
                    stable_count = 0
                    last_text = current_text
                    print(f"  ⏳ Response changing... (length: {len(current_text)} chars)")

            time.sleep(1)

        if not answer:
            print("  ❌ Timeout waiting for answer")
            return None

        print("  ✅ Got answer!")

        # DEBUG: Save HTML for copy button analysis (only in development mode)
        # Enable by setting DEBUG=1 environment variable
        import os
        if os.environ.get('DEBUG', '0') == '1':
            try:
                from pathlib import Path
                from config import DATA_DIR
                html_debug_dir = DATA_DIR / "html_debug"
                html_debug_dir.mkdir(parents=True, exist_ok=True)

                # Save full page HTML
                timestamp = time.strftime("%Y%m%d_%H%M%S")
                html_file = html_debug_dir / f"response_{timestamp}.html"
                html_file.write_text(page.content(), encoding='utf-8')
                print(f"  💾 Saved HTML to: {html_file}")

                # Try to get copy button HTML specifically
                try:
                    copy_btn_html = page.evaluate("""() => {
                        const btn = document.querySelector('button[class*="copy"]');
                        return btn ? btn.outerHTML : null;
                    }""")
                    if copy_btn_html:
                        copy_btn_file = html_debug_dir / f"copy_button_{timestamp}.html"
                        copy_btn_file.write_text(copy_btn_html, encoding='utf-8')
                        print(f"  💾 Saved copy button HTML to: {copy_btn_file}")
                except Exception as e:
                    print(f"  ! Could not save copy button HTML: {e}")

                    # Get all buttons with aria-label containing "copy"
                    try:
                        all_copy_buttons = page.evaluate("""() => {
                            const buttons = document.querySelectorAll('button[aria-label*="copy" i], button[class*="copy" i]');
                        return Array.from(buttons).map(b => ({
                            outerHTML: b.outerHTML,
                            ariaLabel: b.getAttribute('aria-label'),
                            className: b.className,
                            textContent: b.textContent?.trim()
                        }));
                    }""")
                        if all_copy_buttons:
                            import json
                            buttons_file = html_debug_dir / f"copy_buttons_{timestamp}.json"
                            buttons_file.write_text(json.dumps(all_copy_buttons, indent=2), encoding='utf-8')
                            print(f"  💾 Found {len(all_copy_buttons)} copy-related buttons, saved to: {buttons_file}")
                    except Exception as e:
                        print(f"  ! Could not enumerate copy buttons: {e}")

            except Exception as e:
                print(f"  ! HTML debug save failed: {e}")

        return answer

    except Exception as e:
        print(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None

    finally:
        # Always clean up
        if context:
            try:
                context.close()
            except:
                pass

        if playwright:
            try:
                playwright.stop()
            except:
                pass


def main():
    parser = argparse.ArgumentParser(description='Ask NotebookLM a question')

    parser.add_argument('--question', required=True, help='Question to ask')
    parser.add_argument('--notebook-url', help='NotebookLM notebook URL')
    parser.add_argument('--notebook-id', help='Notebook ID from library')
    parser.add_argument('--show-browser', action='store_true', help='Show browser')

    args = parser.parse_args()

    # Resolve notebook URL
    notebook_url = args.notebook_url

    if not notebook_url and args.notebook_id:
        library = NotebookLibrary()
        notebook = library.get_notebook(args.notebook_id)
        if notebook:
            notebook_url = notebook['url']
        else:
            print(f"❌ Notebook '{args.notebook_id}' not found")
            return 1

    if not notebook_url:
        # Check for active notebook first
        library = NotebookLibrary()
        active = library.get_active_notebook()
        if active:
            notebook_url = active['url']
            print(f"📚 Using active notebook: {active['name']}")
        else:
            # Show available notebooks
            notebooks = library.list_notebooks()
            if notebooks:
                print("\n📚 Available notebooks:")
                for nb in notebooks:
                    mark = " [ACTIVE]" if nb.get('id') == library.active_notebook_id else ""
                    print(f"  {nb['id']}: {nb['name']}{mark}")
                print("\nSpecify with --notebook-id or set active:")
                print("python scripts/run.py notebook_manager.py activate --id ID")
            else:
                print("❌ No notebooks in library. Add one first:")
                print("python scripts/run.py notebook_manager.py add --url URL --name NAME --description DESC --topics TOPICS")
            return 1

    # Ask the question
    answer = ask_notebooklm(
        question=args.question,
        notebook_url=notebook_url,
        headless=not args.show_browser
    )

    if answer:
        print("\n" + "=" * 60)
        print(f"Question: {args.question}")
        print("=" * 60)
        print()
        print(answer)
        print()
        print("=" * 60)
        return 0
    else:
        print("\n❌ Failed to get answer")
        return 1


if __name__ == "__main__":
    sys.exit(main())
