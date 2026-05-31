# Tavern → rikkahub 角色卡桥接工具

**简体中文** · [English](./README.md)

> 一个纯前端工具:导入 SillyTavern 角色卡 / 世界书,分类展示与编辑,再导出为 [rikkahub](https://github.com/rikkahub/rikkahub) 可识别的 JSON。

License: **[MIT](LICENSE)**.

---

## 解决的问题

`rikkahub` 自带的"导入酒馆角色卡(JSON)"解析器**只读 6 个字段**(`name` / `first_mes` / `system_prompt` / `description` / `personality` / `scenario`),导致 `mes_example` / `alternate_greetings` / `creator_notes` / `post_history_instructions` / `depth_prompt` / `extensions.regex_scripts` / `character_book` 等内容**全部丢失**。

本工具:

1. 完整解析 SillyTavern V1/V2/V3 角色卡(PNG/JSON)和独立世界书。
2. 按 rikkahub 的分类(系统提示词 / 预设消息 / 消息正则 / 世界书)展示与编辑。
3. 导出时把 rikkahub 不读的字段**自动并入 `system_prompt`**(带分节标题),保证内容不丢失。
4. 世界书走 rikkahub 的**原生 ExportData 格式** `{version, type:"lorebook", data:{...}}`,带 sealed class 判别字段 `type:"regex"`,可被"世界书 - 导入"直接识别。

## 本地启动

```bash
npm install
npm run dev      # 本地开发,访问 http://localhost:5173
npm run build    # 产出 dist/,可作为静态站点托管
```

> Node 版本:建议 ≥ 20.19 或 ≥ 22.12(Vite 7 推荐;20.12 也能跑只是有 EBADENGINE 警告)。

## Docker 部署

### 使用预构建镜像

```bash
docker run -p 3000:3000 ghcr.io/spancerxing/tavern-rikka-bridge:latest
```

访问 `http://localhost:3000`

### 部署到自定义路径

设置 `BASE_PATH` 环境变量以部署到自定义路径：

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
      - BASE_PATH=/  # 可选：设置自定义基础路径
    restart: unless-stopped
```

### 从源码构建

```bash
docker build -t tavern-rikka-bridge .
docker run -p 3000:3000 -e BASE_PATH=/custom-path/ tavern-rikka-bridge
```

## 工作流

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

## 导出策略

### 角色卡(V2,`{spec, spec_version, data:{...}}`)

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

### 世界书(rikkahub 原生 ExportData)

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

## 项目结构

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

## 跑测试

```bash
./node_modules/.bin/tsx src/__tests__/smoke.ts
```

## 开源协议

本项目以 **[MIT](LICENSE)** 协议开源:

- ✅ 允许个人 / 商业使用、修改、再分发
- ✅ 允许学习、研究、教学
- 📝 再分发请保留原版权声明与许可证文本
