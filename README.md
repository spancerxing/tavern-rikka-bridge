# Tavern → rikkahub 角色卡桥接工具

[English](#english) · [简体中文](#简体中文)

> 一个纯前端工具:导入 SillyTavern 角色卡 / 世界书,分类展示与编辑,再导出为 [rikkahub](https://github.com/rikkahub/rikkahub) 可识别的 JSON。
>
> A pure-frontend bridge tool that imports SillyTavern character cards / lorebooks, edits them by category, and exports JSON consumable by [rikkahub](https://github.com/rikkahub/rikkahub).

License: **[CC BY-NC 4.0](LICENSE)** — 仅限非商业使用 / Non-commercial use only.

---

## 简体中文

### 解决的问题

`rikkahub` 自带的"导入酒馆角色卡(JSON)"解析器**只读 6 个字段**(`name` / `first_mes` / `system_prompt` / `description` / `personality` / `scenario`),导致 `mes_example` / `alternate_greetings` / `creator_notes` / `post_history_instructions` / `depth_prompt` / `extensions.regex_scripts` / `character_book` 等内容**全部丢失**。

本工具:

1. 完整解析 SillyTavern V1/V2/V3 角色卡(PNG/JSON)和独立世界书。
2. 按 rikkahub 的分类(系统提示词 / 预设消息 / 消息正则 / 世界书)展示与编辑。
3. 导出时把 rikkahub 不读的字段**自动并入 `system_prompt`**(带分节标题),保证内容不丢失。
4. 世界书走 rikkahub 的**原生 ExportData 格式** `{version, type:"lorebook", data:{...}}`,带 sealed class 判别字段 `type:"regex"`,可被"世界书 - 导入"直接识别。

### 本地启动

```bash
npm install
npm run dev      # 本地开发,访问 http://localhost:5173
npm run build    # 产出 dist/,可作为静态站点托管
```

> Node 版本:建议 ≥ 20.19 或 ≥ 22.12(Vite 7 推荐;20.12 也能跑只是有 EBADENGINE 警告)。

### Docker 部署

```bash
# 直接 build & run
docker build -t tavern-rikka-bridge .
docker run -d --name tavern-rikka-bridge -p 17823:3000 tavern-rikka-bridge

# 或用 compose
docker compose up -d
```

访问 `http://localhost:17823` 即可使用。镜像基于 `node:22-alpine`,通过 `serve` 提供 SPA 静态服务。

### 工作流

1. 顶栏点击 **"导入角色卡 (PNG/JSON)"**,选择文件。
   - PNG 角色卡:自动从 tEXt chunk 抽取 base64 数据并解码(同时支持 `chara` 和 `ccv3` 关键字)。
   - JSON:自动判别 V1 / V2 / V3 / 独立世界书。
2. 切换分类标签编辑:
   - **角色元信息**:名称、创作者、标签、头像、first_mes、备选开场白
   - **系统提示词**:以"块"组织 description / personality / scenario / mes_example / depth_prompt / 自定义;可调顺序、单独启停
   - **预设消息**:role + content
   - **消息正则**:name + findRegex + replaceString + scope (USER/ASSISTANT/BOTH)
   - **世界书**:可挂多份;每份内每条目可改 keys / position / depth / role / priority / 内容
   - **工具箱**:按作用域批量字符串替换、XML → Markdown 转换
3. **追加导入世界书 (JSON)**:在已有角色卡基础上追加一份独立世界书。
4. 导出:
   - 顶栏 **"导出角色卡 (JSON)"** → 一份 V2 卡片 + 同包内所有挂载的世界书 JSON,自动打包为 `.zip`(单文件除外)。
   - 顶栏 **"批量导出所有开场白版本"** → 主开场白 + 各备选开场白各成一份独立卡片,加同一组世界书,打包 `.zip`。
   - 世界书页每张卡片右侧 **"导出"** → 单独导出该世界书。

### 导出策略

#### 角色卡(V2,`{spec, spec_version, data:{...}}`)

- `name` / `first_mes` / `description` / `personality` / `scenario`:直接对应。
- `system_prompt`:拼接以下内容(每段带 `## Section` 标题):
  - 用户启用的 system_prompt 块原文
  - 对话示例 (`mes_example`)
  - 历史后指令 (`post_history_instructions`)
  - 深度提示 (`depth_prompt`)
  - 创作者备注 (`creator_notes`)
  - 自定义块
  - 预设消息中除"首条 assistant"外的多余消息
- 同时也保留 `mes_example` / `creator_notes` / `post_history_instructions` / `alternate_greetings` / `character_book` / `extensions.regex_scripts` 等标准字段(rikkahub 不读,其它酒馆兼容工具可读)。

#### 世界书(rikkahub 原生 ExportData)

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

字段名与 rikkahub 的 `Lorebook` / `PromptInjection.RegexInjection` 数据类完全一致(rikkahub 源码:`app/src/main/java/me/rerere/rikkahub/data/model/Assistant.kt`、`app/src/main/java/me/rerere/rikkahub/data/export/ExportSerializer.kt`)。

> ⚠️ **关于 rikkahub 内嵌世界书**:rikkahub 角色卡导入器**不会**自动加载卡片内嵌的 `character_book`。所以本工具在导出角色卡时会**同时导出所有挂载的世界书 JSON**,导出后请在 rikkahub 内:① "世界书 - 导入"逐个导入;② 进入助手详情页,把世界书挂到该助手下。

### 项目结构

```
src/
├── App.tsx / App.css / index.css / main.tsx
├── types/
│   ├── model.ts          # 工具内部统一中间数据模型 (WorkspaceState)
│   └── sillytavern.ts    # SillyTavern V1/V2/V3 + 独立世界书的 JSON 类型
├── parsers/
│   ├── png.ts            # PNG tEXt chunk 解析 + base64 → JSON
│   └── normalize.ts      # SillyTavern JSON → WorkspaceState
├── exporters/
│   └── rikkahub.ts       # WorkspaceState → rikkahub 兼容 JSON
├── state/
│   └── reducer.ts        # WorkspaceState 的所有编辑动作
├── components/
│   ├── CharacterMetaPanel.tsx
│   ├── SystemPromptPanel.tsx
│   ├── PresetMessagesPanel.tsx
│   ├── RegexPanel.tsx
│   ├── LorebookPanel.tsx
│   └── ToolboxPanel.tsx
├── utils/transform.ts    # 批量替换 / XML → Markdown
└── __tests__/smoke.ts    # 端到端 smoke 测试
```

### 跑测试

```bash
./node_modules/.bin/tsx src/__tests__/smoke.ts
```

### 开源协议

本项目以 **[CC BY-NC 4.0](LICENSE)** 协议开源:

- ✅ 允许个人使用、修改、再分发
- ✅ 允许学习、研究、教学
- ❌ **禁止任何形式的商业使用**(包括但不限于:商业产品集成、付费服务、商业内容生产工作流)
- 📝 再分发请保留原作者署名与本协议

如需商业授权,请通过 issue 联系作者。

---

## English

### What problem does this solve?

`rikkahub`'s built-in *"Import SillyTavern character card (JSON)"* parser only reads **6 fields** (`name` / `first_mes` / `system_prompt` / `description` / `personality` / `scenario`). Anything else — `mes_example`, `alternate_greetings`, `creator_notes`, `post_history_instructions`, `depth_prompt`, `extensions.regex_scripts`, `character_book` — is **silently dropped**.

This tool:

1. Fully parses SillyTavern V1/V2/V3 character cards (PNG/JSON) and standalone lorebooks.
2. Edits them under rikkahub's categorisation (system prompt / preset messages / message regex / lorebook).
3. On export, **merges fields rikkahub ignores into `system_prompt`** with section headings, so nothing is lost.
4. Lorebooks are emitted in rikkahub's **native `ExportData` envelope** `{version, type:"lorebook", data:{...}}`, with the required sealed-class discriminator `type:"regex"` on each entry — directly importable via *"Lorebook → Import"*.

### Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/, deployable as a static site
```

> Node ≥ 20.19 or ≥ 22.12 recommended (Vite 7).

### Docker deployment

```bash
docker build -t tavern-rikka-bridge .
docker run -d --name tavern-rikka-bridge -p 17823:3000 tavern-rikka-bridge

# or
docker compose up -d
```

Then open `http://localhost:17823`. The image is based on `node:22-alpine` and serves the SPA via `serve`.

### Workflow

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

### Export strategy

#### Character card (V2)

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

#### Lorebook (rikkahub native `ExportData`)

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

### Tests

```bash
./node_modules/.bin/tsx src/__tests__/smoke.ts
```

### License

Released under **[CC BY-NC 4.0](LICENSE)**:

- ✅ Personal use, modification, redistribution allowed
- ✅ Study / research / teaching allowed
- ❌ **Commercial use prohibited** (including but not limited to: commercial product integration, paid services, commercial content-production workflows)
- 📝 When redistributing, retain attribution and the license

For commercial licensing, please contact the author via an issue.
