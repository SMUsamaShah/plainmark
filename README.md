# Plainmark

Chrome extension to save URLs (with title and a note) to various plain text targets (local makdown file, Workflowy, Dynalist).

## Usage

- Click the extension icon or right-click → save the current page, a link, or selected text
- A small popup appears for adding a note before/after saving
- Bookmarks are saved to the target endpoint that is active in settings

## Endpoints

| Endpoint | Storage | Notes |
|---|---|---|
| Dynalist | Dynalist server | Requires API token and node IDs |
| Workflowy | Workflowy server | Requires API token (beta) |
| Local Markdown File | Local `.md` file | File System Access API — must re-grant permission each browser restart |
| Downloads Folder File | `~/Downloads/<filename>` | No permission needed; overwrites on each change |
| Browser Storage | `chrome.storage.local` | No setup; lost if extension is reinstalled |

## Install

1. Clone or download this repo
2. Go to `chrome://extensions` → enable Developer mode → Load unpacked → select this folder
3. Open the extension options, pick an endpoint, fill in any required settings

## Bookmark format

Markdown list entries with an optional blockquote for notes:

```
- [Page title](https://url.com) <!-- bm:uuid -->
  > optional note
```

Dynalist and Workflowy use their native node format instead.
