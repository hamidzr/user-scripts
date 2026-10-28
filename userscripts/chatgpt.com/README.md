# ChatGPT Shortcuts

This userscript adds Ctrl+N and Ctrl+F shortcuts to ChatGPT.

## What it does

- Ctrl+N clicks the sidebar link whose text starts with "New chat"
- Ctrl+F clicks the "Search chats" control in the sidebar
- runs on `chatgpt.com` and `chat.openai.com`
- shortcuts are ignored when the key event was already handled or has Cmd, Alt, or Shift held

### Limitations

- finds the search control by its exact label text, including the "⌘K" hint, so Ctrl+F stops working if that label changes
