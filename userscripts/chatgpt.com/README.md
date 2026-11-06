# ChatGPT Shortcuts

Adds two keyboard shortcuts to ChatGPT: Ctrl+N starts a new chat and Ctrl+F opens chat search, on both chatgpt.com and chat.openai.com.

## What it does

- Ctrl+N clicks the sidebar link whose text starts with "New chat"
- Ctrl+F clicks the "Search chats" control in the sidebar
- runs on `chatgpt.com` and `chat.openai.com`
- shortcuts are ignored when the key event was already handled or has Cmd, Alt, or Shift held

### Limitations

- finds the search control by its exact label text, including the "⌘K" hint, so Ctrl+F stops working if that label changes
