# Docketwise Smart Form Export

Adds an EXPORT menu to Docketwise smart form editor pages for saving answers as Markdown or PDF, and prompts to save unsaved changes.

## What it does

- adds an EXPORT button beside the form title bar; the panel opens on click and closes on an outside click
- Markdown: downloads a `.md` file of the answers
- PDF: opens the browser print dialog on a print-ready page; choose "Save as PDF" there
- scope: all sections, or only the current (active) section
- Include comments: on by default; adds comments with author and date
- Include SSN: off by default; when on, the SSN is written in full
- file name: `<form-title>_<section>_<date>` in lowercase, with `_with-SSN` added when SSN is included
- captures text, yes/no and radio answers, checked boxes, select values, text inputs, textareas, weights, and repeated entries
- shows unanswered questions as "No answer" and blank fields as "(blank)"
- autosave prompt: after 30 seconds of unsaved changes, shows a 10 second countdown and then clicks Save Form
- waits for typing to pause and for any page loader to finish before saving; "Save now" and "Cancel" are available
- runs on `app.docketwise.com` smart form edit pages

## Privacy

- Exports can contain sensitive answers. With Include SSN on, the full SSN is read from the form's raw hidden field and written to the file. With it off, SSN values are removed from all exported text.
- The script makes no network requests. Files are built in the page and downloaded from a local data URL.
- Treat exported files as confidential. Do not attach them to tickets or share them casually.

## Limitations

- Depends on Docketwise's current smart form markup: the `smartFormBuilder` page object and the class names and field names it reads. Markup changes can break the panel, extraction, or autosave.
- The autosave prompt clicks the page's own Save Form button, so it stops working if that button's text or position changes.
