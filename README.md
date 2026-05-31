# Tavern → rikkahub Bridge

**English** · [简体中文](./README.zh-CN.md)

> A pure-frontend tool that imports SillyTavern character cards / lorebooks, edits them by category, and exports JSON consumable by [rikkahub](https://github.com/rikkahub/rikkahub).

License: **[MIT](LICENSE)**.

---

## What problem does this solve?

`rikkahub`'s built-in *"Import SillyTavern character card (JSON)"* parser only reads **6 fields** (`name` / `first_mes` / `system_prompt` / `description` / `personality` / `scenario`). Anything else — `mes_example`, `alternate_greetings`, `creator_notes`, `post_history_instructions`, `depth_prompt`, `extensions.regex_scripts`, `character_book` — is **silently dropped**.

This tool:

1. Fully parses SillyTavern V1/V2/V3 character cards (PNG/JSON) and standalone lorebooks.
2. Edits them under rikkahub's categorisation (system prompt / preset messages / message regex / lorebook).
3. On export, **merges fields rikkahub ignores into `system_prompt`** with section headings, so nothing is lost.
4. Lorebooks are emitted in rikkahub's **native `ExportData` envelope** `{version, type:"lorebook", data:{...}}`, with the required sealed-class discriminator `type:"regex"` on each entry — directly importable via *"Lorebook → Import"*.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/, deployable as a static site
```

> Node ≥ 20.19 or ≥ 22.12 recommended (Vite 7).

## Docker deployment

### Using pre-built image

```bash
docker run -p 3000:3000 ghcr.io/spancerxing/tavern-rikka-bridge:latest
```

Access at `http://localhost:3000`

### Deploy under a custom path

Set the `BASE_PATH` environment variable to deploy under a custom path:

```bash
docker run -p 3000:3000 -e BASE_PATH=/custom-path/ ghcr.io/spancerxing/tavern-rikka-bridge:latest
```

### Docker Compose

```yaml
services:
  tavern-rikka-bridge:
    image: ghcr.io/spancerxing/tavern-rikka-bridge:latest
    ports:
      - "3000:3000"
    environment:
      - BASE_PATH=/  # Optional: set custom base path
    restart: unless-stopped
```

### Build from source

```bash
docker build -t tavern-rikka-bridge .
docker run -p 3000:3000 -e BASE_PATH=/custom-path/ tavern-rikka-bridge
```

## Workflow

1. Click **"Import character card (PNG/JSON)"** in the top bar.
   - PNG: extracts and decodes the base64 payload from the tEXt chunk (`chara` / `ccv3`).
   - JSON: auto-detects V1 / V2 / V3 / standalone lorebook.
2. Switch tabs to edit:
   - **Character meta**: name, creator, tags, avatar, first_mes, alternate greetings
   - **System prompt**: as ordered, individually toggleable blocks
   - **Preset messages**: role + content
   - **Regex scripts**: name + findRegex + replaceString + scope
   - **Lorebooks**: multiple books; per-entry keys / position / depth / role / priority / content
   - **Toolbox**: scoped batch string replace, XML-to-Markdown
3. **"Import lorebook (JSON)"** appends a standalone lorebook to the current workspace.
4. Export:
   - **"Export character card (JSON)"** → V2 card + all attached lorebook JSONs, bundled as `.zip` (single-file exports skip the zip).
   - **"Export all greeting variants"** → one card per greeting (main + each alternate), sharing one lorebook set, bundled as `.zip`.
   - Per-lorebook **Export** button on the Lorebooks tab → single lorebook file.

## Export strategy

### Character card (V2)

- `name` / `first_mes` / `description` / `personality` / `scenario` map directly.
- `system_prompt` is the concatenation, each prefixed with `## Section`:
  - the user-enabled system_prompt blocks
  - `mes_example`
  - `post_history_instructions`
  - `depth_prompt`
  - `creator_notes`
  - custom blocks
  - extra preset messages beyond the first assistant message
- Standard fields (`mes_example`, `creator_notes`, `alternate_greetings`, `character_book`, `extensions.regex_scripts`, …) are still preserved for tooling compatibility.

### Lorebook (rikkahub native `ExportData`)

```json
{
  "version": 1,
  "type": "lorebook",
  "data": {
    "id": "...",
    "name": "...",
    "description": "...",
    "enabled": true,
    "entries": [
      {
        "type": "regex",
        "id": "...",
        "name": "...",
        "enabled": true,
        "priority": 100,
        "position": "before_system_prompt",
        "content": "...",
        "injectDepth": 0,
        "role": "system",
        "keywords": ["..."],
        "useRegex": false,
        "caseSensitive": false,
        "scanDepth": 0,
        "constantActive": false
      }
    ]
  }
}
```

Field names match rikkahub's `Lorebook` / `PromptInjection.RegexInjection` data classes (see `app/src/main/java/me/rerere/rikkahub/data/model/Assistant.kt` and `data/export/ExportSerializer.kt`).

> ⚠️ **About rikkahub's embedded lorebooks**: rikkahub's character card importer does **not** auto-load `character_book` embedded in the card. This tool therefore exports all attached lorebooks alongside the card. After import, in rikkahub: ① import each lorebook via *Lorebook → Import*; ② open the assistant detail page and attach the lorebooks to that assistant.

## Project layout

```
src/
├── App.tsx / App.css / index.css / main.tsx
├── types/
│   ├── model.ts          # shared workspace state
│   └── sillytavern.ts    # SillyTavern V1/V2/V3 + standalone lorebook types
├── parsers/
│   ├── png.ts            # PNG tEXt chunk → base64 → JSON
│   └── normalize.ts      # SillyTavern JSON → WorkspaceState
├── exporters/
│   └── rikkahub.ts       # WorkspaceState → rikkahub-compatible JSON
├── state/
│   └── reducer.ts        # all WorkspaceState edit actions
├── components/
│   ├── CharacterMetaPanel.tsx
│   ├── SystemPromptPanel.tsx
│   ├── PresetMessagesPanel.tsx
│   ├── RegexPanel.tsx
│   ├── LorebookPanel.tsx
│   └── ToolboxPanel.tsx
├── utils/transform.ts    # batch replace / XML → Markdown
└── __tests__/smoke.ts    # end-to-end smoke tests
```

## Tests

```bash
./node_modules/.bin/tsx src/__tests__/smoke.ts
```

## License

Released under the **[MIT License](LICENSE)**:

- ✅ Personal / commercial use, modification, redistribution allowed
- ✅ Study / research / teaching allowed
- 📝 When redistributing, retain the copyright notice and license text
