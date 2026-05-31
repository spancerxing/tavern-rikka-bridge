import type {
  Lorebook,
  LorebookEntry,
  LorebookPosition,
  RegexEntry,
  RegexScope,
  SystemPromptBlock,
  WorkspaceState,
} from "../types/model";

// =====================================================================
// 1. 角色卡导出（rikkahub 通过"导入酒馆角色卡 JSON"读取）
// rikkahub 的 AssistantImporter 只读 6 个字段：name, first_mes,
// system_prompt, description, personality, scenario。
// 为避免内容丢失：把对话示例 / 备选开场白 / 创作者备注 / 历史后指令 / 深度提示
// 等内容**合并**进 system_prompt（或 description），同时保留标准 V2 字段
// 以便其它工具仍能识别。
// =====================================================================

const SECTION_LABELS: Record<string, string> = {
  system_prompt: "System Prompt",
  description: "Description",
  personality: "Personality",
  scenario: "Scenario",
  mes_example: "Example Dialogue",
  creator_notes: "Creator Notes",
  post_history_instructions: "Post History Instructions",
  depth_prompt: "Depth Prompt",
  custom: "Custom",
};

function blockSection(b: SystemPromptBlock): string {
  const label = SECTION_LABELS[b.key] ?? b.label ?? b.key;
  return `## ${label}\n${b.content.trim()}`;
}

function pickBlockContent(blocks: SystemPromptBlock[], key: string): string {
  return blocks
    .filter(b => b.enabled && b.key === key)
    .map(b => b.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

function buildMergedSystemPrompt(ws: WorkspaceState): string {
  // 把 description/personality/scenario/mes_example/creator_notes/post_history_instructions/depth_prompt
  // 一并塞进 system_prompt，因为 rikkahub 角色卡导入器只会把这 6 字段拼成 systemPrompt。
  // 我们这里尽量按 rikkahub 内部拼接顺序来，避免重复。
  // rikkahub 内部拼接顺序（来自 AssistantImporter.kt 调研）：
  //   "You are roleplaying as {name}." → system_prompt → Description → Personality → Scenario
  // 因此 description/personality/scenario 不再写进 system_prompt（rikkahub 自己会加）。
  // mes_example / creator_notes / post_history_instructions / depth_prompt / 备选开场白 / 预设消息中的额外
  // user/system 消息 / 正则条目摘要——这些 rikkahub 不识别，要并入 system_prompt 才不丢失。

  const parts: string[] = [];

  // 用户已启用的 system_prompt 内容
  const sp = pickBlockContent(ws.systemPromptBlocks, "system_prompt");
  if (sp) parts.push(sp);

  // mes_example：rikkahub 会丢，必须并入
  const mesEx = pickBlockContent(ws.systemPromptBlocks, "mes_example");
  if (mesEx) parts.push(`## ${SECTION_LABELS.mes_example}\n${mesEx}`);

  const postHist = pickBlockContent(ws.systemPromptBlocks, "post_history_instructions");
  if (postHist) parts.push(`## ${SECTION_LABELS.post_history_instructions}\n${postHist}`);

  const depth = pickBlockContent(ws.systemPromptBlocks, "depth_prompt");
  if (depth) parts.push(`## ${SECTION_LABELS.depth_prompt}\n${depth}`);

  const notes = pickBlockContent(ws.systemPromptBlocks, "creator_notes");
  if (notes) parts.push(`## ${SECTION_LABELS.creator_notes}\n${notes}`);

  // 自定义块
  for (const b of ws.systemPromptBlocks) {
    if (!b.enabled) continue;
    if (["system_prompt", "description", "personality", "scenario", "mes_example",
         "creator_notes", "post_history_instructions", "depth_prompt"].includes(b.key)) continue;
    parts.push(blockSection(b));
  }

  // 备选开场白：**不再合并**进 system_prompt（避免污染上下文）。
  // 用户应使用 buildAllCharacterCardVariants 做批量导出，每个备选生成一份独立卡片。
  // 备选内容仍写入标准 alternate_greetings 字段供其它酒馆兼容工具读取。

  // 预设消息中的非 first_mes 内容（first_mes 已是单独 assistant 消息）：
  // 第一条 assistant 已映射到 first_mes，其余 assistant/user/system 消息也并入
  if (ws.presetMessages.length > 1) {
    const rest = ws.presetMessages.slice(1);
    if (rest.length > 0) {
      const lines = rest.map(m => `### ${m.role}\n${m.content}`).join("\n\n");
      parts.push(`## Preset Messages\n${lines}`);
    }
  }

  return parts.join("\n\n");
}

function placementFromScope(scope: RegexScope): number[] {
  const placement: number[] = [];
  if (scope.user) placement.push(1);
  if (scope.assistant) placement.push(2);
  return placement.length > 0 ? placement : [1, 2];
}

function buildRegexScripts(entries: RegexEntry[]) {
  return entries.map(e => ({
    id: e.id,
    scriptName: e.name,
    findRegex: e.findRegex,
    replaceString: e.replaceString,
    trimStrings: e.trimStrings,
    placement: placementFromScope(e.scope),
    disabled: e.disabled,
    markdownOnly: e.scope.display,
    promptOnly: false,
    runOnEdit: false,
    substituteRegex: 0,
  }));
}

function characterBookEntry(e: LorebookEntry, idx: number) {
  // SillyTavern character_book 仅支持 before_char / after_char
  // 把 rikkahub 的更细粒度位置降维：top_of_chat/at_depth → before_char；其余落在
  // after_system_prompt/bottom_of_chat → after_char。
  const stPosition = e.position === "after_system_prompt" || e.position === "bottom_of_chat"
    ? "after_char"
    : "before_char";
  return {
    keys: e.keys,
    secondary_keys: e.secondaryKeys,
    content: e.content,
    extensions: {},
    enabled: e.enabled,
    insertion_order: e.insertionOrder,
    case_sensitive: e.caseSensitive,
    name: e.name,
    comment: e.name,
    selective: e.selective,
    constant: e.constant,
    position: stPosition,
    id: idx,
  };
}

function characterBookFromLorebook(lb: Lorebook) {
  return {
    name: lb.name,
    description: lb.description,
    scan_depth: 100,
    token_budget: 2048,
    recursive_scanning: false,
    extensions: {},
    entries: lb.entries.map((e, i) => characterBookEntry(e, i)),
  };
}

export interface CharacterCardExport {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
    character_book?: ReturnType<typeof characterBookFromLorebook>;
    tags: string[];
    creator: string;
    character_version: string;
    extensions: Record<string, unknown>;
  };
}

export function buildCharacterCardJson(ws: WorkspaceState): CharacterCardExport {
  const description = pickBlockContent(ws.systemPromptBlocks, "description");
  const personality = pickBlockContent(ws.systemPromptBlocks, "personality");
  const scenario = pickBlockContent(ws.systemPromptBlocks, "scenario");
  const mes_example = pickBlockContent(ws.systemPromptBlocks, "mes_example");
  const creator_notes = pickBlockContent(ws.systemPromptBlocks, "creator_notes");
  const post_history_instructions = pickBlockContent(ws.systemPromptBlocks, "post_history_instructions");

  const merged = buildMergedSystemPrompt(ws);

  const extensions: Record<string, unknown> = {
    ...(ws.rawExtensions ?? {}),
    regex_scripts: buildRegexScripts(ws.regexEntries),
  };

  // 选择第一个世界书作为 character_book 内嵌（rikkahub 不读，但保留信息给其它工具）
  const innerBook = ws.lorebooks[0]
    ? characterBookFromLorebook(ws.lorebooks[0])
    : undefined;

  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: ws.characterName,
      description,
      personality,
      scenario,
      first_mes: ws.characterFirstMes,
      mes_example,
      creator_notes,
      system_prompt: merged,
      post_history_instructions,
      alternate_greetings: ws.characterAlternateGreetings,
      character_book: innerBook,
      tags: ws.characterTags,
      creator: ws.characterCreator,
      character_version: ws.characterVersion,
      extensions,
    },
  };
}

// =====================================================================
// 2. 世界书导出（rikkahub 原生 ExportData 包装格式）
// 来源：rikkahub `data/export/ExportSerializer.kt`（1.7.5 起）
// 外层：{version:1, type:"lorebook", data:{...Lorebook...}}
// data 内是扁平 Lorebook：id, name, description, enabled, entries:[RegexInjection]。
// 每个 entry 必须带 sealed class 判别字段 "type":"regex"，否则
// kotlinx.serialization 的 PromptInjection 反序列化会失败。
// position 用 rikkahub `InjectionPosition` 的 @SerialName（小写蛇形）。
// role 是独立的 MessageRole 字段（仅 at_depth 时有意义）。
// =====================================================================

interface RikkaRegexInjection {
  type: "regex";
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  position: LorebookPosition;
  content: string;
  injectDepth: number;
  role: "system" | "user" | "assistant";
  keywords: string[];
  useRegex: boolean;
  caseSensitive: boolean;
  scanDepth: number;
  constantActive: boolean;
}

interface RikkaLorebook {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  entries: RikkaRegexInjection[];
}

interface RikkaExportData<T> {
  version: number;
  type: string;
  data: T;
}

function entryToRikka(e: LorebookEntry): RikkaRegexInjection {
  // rikkahub 的 keywords 是统一一组关键词；secondaryKeys 在 rikkahub 没有对应字段，
  // 合并到 keywords 末尾以避免丢失。
  const allKeys = [...e.keys, ...e.secondaryKeys];
  return {
    type: "regex",
    id: e.id,
    name: e.name,
    enabled: e.enabled,
    priority: e.insertionOrder,
    position: e.position,
    content: e.content,
    injectDepth: e.insertionDepth,
    role: e.role,
    keywords: allKeys,
    useRegex: e.useRegex,
    caseSensitive: e.caseSensitive,
    scanDepth: e.scanDepth,
    constantActive: e.constant,
  };
}

export function buildLorebookExport(lb: Lorebook): RikkaExportData<RikkaLorebook> {
  return {
    version: 1,
    type: "lorebook",
    data: {
      id: lb.id,
      name: lb.name,
      description: lb.description,
      enabled: lb.enabled,
      entries: lb.entries.map(entryToRikka),
    },
  };
}

// =====================================================================
// 3. 工具：把对象写成下载文件
// =====================================================================

export function downloadJson(filename: string, data: unknown) {
  const text = JSON.stringify(data, null, 2);
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// =====================================================================
// 4. 批量导出：每个开场白（主 + 备选）各生成一份独立角色卡
// =====================================================================

function safeFilenamePart(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 40)
    .trim() || "character";
}

export interface CardVariant {
  filename: string;
  card: CharacterCardExport;
  greetingPreview: string;
}

// 把每个开场白依次提升到 first_mes 位置生成一份卡片。其余开场白仍保留在 alternate_greetings
// 字段中（rikkahub 不读，但其它工具仍能恢复完整集合）。
export function buildAllCharacterCardVariants(ws: WorkspaceState): CardVariant[] {
  const greetings: string[] = [];
  if (ws.characterFirstMes && ws.characterFirstMes.trim()) greetings.push(ws.characterFirstMes);
  for (const g of ws.characterAlternateGreetings) {
    if (g && g.trim()) greetings.push(g);
  }
  if (greetings.length === 0) {
    return [{
      filename: `${safeFilenamePart(ws.characterName)}.card.json`,
      card: buildCharacterCardJson(ws),
      greetingPreview: "(无开场白)",
    }];
  }
  const baseName = safeFilenamePart(ws.characterName);
  return greetings.map((primary, idx) => {
    const others = greetings.filter((_, i) => i !== idx);
    const variantWs: WorkspaceState = {
      ...ws,
      characterFirstMes: primary,
      characterAlternateGreetings: others,
    };
    const card = buildCharacterCardJson(variantWs);
    const suffix = idx === 0 ? "main" : `alt${idx}`;
    return {
      filename: `${baseName}-${suffix}.card.json`,
      card,
      greetingPreview: primary.slice(0, 60).replace(/\s+/g, " "),
    };
  });
}
