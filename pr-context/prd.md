Objective

Create a userscript (Tampermonkey/Greasemonkey) that runs only on GitHub Pull Request pages and allows the user to select and copy specific PR context (title, description, comments, diffs, metadata) into the clipboard. The output should be usable as input for a Large Language Model (LLM).

⸻

Environment
	•	Platform: Chrome / Firefox with Tampermonkey (v4+).
	•	Match URLs: https://github.com/*/*/pull/*.
	•	Dependencies: None (vanilla JS).

⸻

Features

1. Context Detection

Extract the following from the DOM:
	•	PR Title
Selector: [data-test-selector="pr-title-text"]
	•	PR Description (initial comment)
Selector: .edit-comment-hide .comment-body (first in PR timeline)
	•	Review Comments (timeline)
Selector: .js-timeline-item .comment-body (exclude the first description block)
	•	Inline File Comments
Selector: .inline-comments .comment-body
	•	Commits (messages only, no diffs)
Selector: .TimelineItem-body .commit-title
	•	Code Diffs (optional, large content)
Selector: .file blocks inside .diff-view
	•	Metadata (stretch goal)
	•	Author: .author (from PR header)
	•	Labels: .js-issue-labels .IssueLabel
	•	Reviewers: #reviewers-select-menu

2. Selection Controls
	•	UI checkboxes for each content type:
	•	Title
	•	Description
	•	Review Comments
	•	Inline Comments
	•	Commits
	•	Code Diffs
	•	Metadata
	•	Author filter: dropdown or input list to include/exclude comments by username.
	•	Bulk controls:
	•	Select All
	•	Deselect All
	•	Only PR Author
	•	Only Reviewers

3. Copy to Clipboard
	•	Button: “Copy Selected to Clipboard”.
	•	Output formats:
	1.	Plain text (default).
	2.	Markdown (preserve code blocks and links).
	3.	JSON (optional; key = content type).
	•	Show confirmation toast: “Copied N items to clipboard.”

4. UI/UX
	•	Inject a floating sidebar panel on the right side of the PR page.
	•	Minimal CSS styling; must respect GitHub dark/light themes.
	•	Collapsible sections for advanced filters (authors, metadata).
	•	Keyboard shortcut: Ctrl+Shift+C triggers “Copy with last used settings.”

5. Configuration
	•	Persist user preferences (selected checkboxes, filters, format) in localStorage.
	•	On load, restore last configuration.

⸻

Non-Goals
	•	No API calls to GitHub.
	•	No authentication handling.
	•	No external storage.
	•	Not a browser extension; only a userscript.

⸻

Deliverables
	1.	github-pr-export.user.js (userscript file).
	2.	Inline comments in code explaining major functions.
	3.	README (install steps + usage instructions).
	4.	Sample run (show output examples in text, markdown, JSON).

⸻

Example Output

Plain Text (Title + Description + Comments):

[Title] Fix race condition in scheduler
[Description] This PR addresses a bug where…
[Comment by @reviewer1] Please refactor this method.
[Comment by @author] Updated with requested changes.

Markdown:

# Fix race condition in scheduler
This PR addresses a bug where…

---

**@reviewer1:** Please refactor this method.
**@author:** Updated with requested changes.

JSON:

{
  "title": "Fix race condition in scheduler",
  "description": "This PR addresses a bug where…",
  "comments": [
    {"author": "reviewer1", "body": "Please refactor this method."},
    {"author": "author", "body": "Updated with requested changes."}
  ]
}


⸻

Testing
	•	Test against public PRs on github.com (no login needed).
	•	Verify selectors work on at least one small PR (few comments) and one large PR (many diffs + multiple reviewers).
	•	If DOM changes break selectors, fallback: document.querySelectorAll("[role=…]") with stable roles/attributes.
