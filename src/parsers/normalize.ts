import { v4 as uuid } from "uuid";
import type {
  Lorebook,
  LorebookEntry,
  LorebookPosition,
  PresetMessage,
  RegexEntry,
  RegexScope,
  SystemPromptBlock,
  WorkspaceState,
} from "../types/model";
import type {
  STCharacterBook,
  STCharacterBookEntry,
  STCharacterCard,
  STCharacterCardV2,
  STCharacterCardV3,
  STCharacterDataV2,
  STCharacterV1,
  STRegexScript,
  STStandaloneLorebook,
  STStandaloneLorebookEntry,
} from "../types/sillytavern";
import { emptyWorkspace } from "../types/model";

// ---------- 系统提示词分块 ----------

function pushBlock(
  blocks: SystemPromptBlock[],
  key: string,
  label: string,
  content: string | undefined,
) {
  if (!content || !content.trim()) return;
  blocks.push({
    id: uuid(),
    key,
    label,
    content,
    enabled: true,
  });
}

function buildSystemBlocksFromV2(data: STCharacterDataV2): SystemPromptBlock[] {
  const blocks: SystemPromptBlock[] = [];
  pushBlock(blocks, "system_prompt", "系统提示词 (system_prompt)", data.system_prompt);
  pushBlock(blocks, "description", "角色描述 (description)", data.description);
  pushBlock(blocks, "personality", "性格 (personality)", data.personality);
  pushBlock(blocks, "scenario", "场景 (scenario)", data.scenario);
  pushBlock(blocks, "mes_example", "对话示例 (mes_example)", data.mes_example);
  pushBlock(blocks, "creator_notes", "创作者备注 (creator_notes)", data.creator_notes);
  pushBlock(
    blocks,
    "post_history_instructions",
    "历史后指令 (post_history_instructions)",
    data.post_history_instructions,
  );
  const depth = data.extensions?.depth_prompt;
  if (depth?.prompt) {
    pushBlock(
      blocks,
      "depth_prompt",
      `深度提示 depth=${depth.depth ?? 0} role=${depth.role ?? "system"}`,
      depth.prompt,
    );
  }
  return blocks;
}

function buildSystemBlocksFromV1(card: STCharacterV1): SystemPromptBlock[] {
  const blocks: SystemPromptBlock[] = [];
  pushBlock(blocks, "description", "角色描述 (description)", card.description);
  pushBlock(blocks, "personality", "性格 (personality)", card.personality);
  pushBlock(blocks, "scenario", "场景 (scenario)", card.scenario);
  pushBlock(blocks, "mes_example", "对话示例 (mes_example)", card.mes_example);
  pushBlock(blocks, "creator_notes", "创作者备注 (creatorcomment)", card.creatorcomment);
  return blocks;
}

// ---------- 预设消息 ----------

function buildPresetMessages(firstMes: string | undefined): PresetMessage[] {
  // 只用 first_mes 当唯一的 assistant 预设。备选开场白保留在
  // workspace.characterAlternateGreetings 里，单独管理（批量导出时各自成卡）。
  // 之前把 alternates 也塞进 presetMessages，会导致导出阶段
  // 经由 "## Preset Messages" 段重新流入 system_prompt——这就是污染来源。
  const out: PresetMessage[] = [];
  if (firstMes && firstMes.trim()) {
    out.push({ id: uuid(), role: "assistant", content: firstMes });
  }
  return out;
}

// ---------- 正则 ----------

function regexScopeFromPlacement(placement: number[] | undefined, markdownOnly?: boolean): RegexScope {
  if (!placement || placement.length === 0) {
    return { user: true, assistant: true, display: false };
  }
  return {
    user: placement.includes(1),
    assistant: placement.includes(2),
    display: markdownOnly ?? false,
  };
}

function buildRegexEntries(scripts: STRegexScript[] | undefined): RegexEntry[] {
  if (!scripts) return [];
  return scripts.map(s => ({
    id: uuid(),
    name: s.scriptName ?? "未命名正则",
    findRegex: s.findRegex ?? "",
    replaceString: s.replaceString ?? "",
    scope: regexScopeFromPlacement(s.placement, s.markdownOnly),
    disabled: s.disabled ?? false,
    trimStrings: s.trimStrings ?? [],
  }));
}

// ---------- 世界书 ----------

function positionFromCharacterBook(p: STCharacterBookEntry["position"]): LorebookPosition {
  if (p === "after_char") return "after_system_prompt";
  if (p === "before_char") return "before_system_prompt";
  return "before_system_prompt";
}

function positionFromStandalone(p: number | undefined): LorebookPosition {
  // SillyTavern 数字位置：0=before_char 1=after_char 2=ANTop 3=ANBottom 4=at_depth
  switch (p) {
    case 0: return "before_system_prompt";
    case 1: return "after_system_prompt";
    case 2: return "top_of_chat";
    case 3: return "bottom_of_chat";
    case 4: return "at_depth";
    default: return "before_system_prompt";
  }
}

function entryFromCharacterBookEntry(e: STCharacterBookEntry): LorebookEntry {
  return {
    id: uuid(),
    name: e.name ?? e.comment ?? "未命名条目",
    keys: e.keys ?? [],
    secondaryKeys: e.secondary_keys ?? [],
    content: e.content ?? "",
    enabled: e.enabled ?? true,
    constant: e.constant ?? false,
    selective: e.selective ?? false,
    insertionOrder: e.insertion_order ?? e.priority ?? 100,
    position: positionFromCharacterBook(e.position),
    role: "system",
    insertionDepth: 0,
    caseSensitive: e.case_sensitive ?? false,
    useRegex: false,
    scanDepth: 0,
  };
}

function entryFromStandalone(e: STStandaloneLorebookEntry): LorebookEntry {
  return {
    id: uuid(),
    name: e.comment ?? "未命名条目",
    keys: e.key ?? [],
    secondaryKeys: e.keysecondary ?? [],
    content: e.content ?? "",
    enabled: !(e.disable ?? false),
    constant: e.constant ?? false,
    selective: e.selective ?? false,
    insertionOrder: e.order ?? 100,
    position: positionFromStandalone(e.position),
    role: "system",
    insertionDepth: e.depth ?? 0,
    caseSensitive: e.caseSensitive ?? false,
    useRegex: false,
    scanDepth: e.scanDepth ?? 0,
  };
}

function lorebookFromCharacterBook(book: STCharacterBook | undefined): Lorebook | null {
  if (!book?.entries?.length) return null;
  return {
    id: uuid(),
    name: book.name ?? "内嵌世界书",
    description: book.description ?? "",
    enabled: true,
    entries: book.entries.map(entryFromCharacterBookEntry),
  };
}

export function lorebookFromStandalone(json: STStandaloneLorebook): Lorebook {
  const entries: LorebookEntry[] = [];
  // entries 既可能是 Map 也可能是数组（字段名约定 entries:[ ... ] 并不常见，但作兜底）
  if (Array.isArray(json.entries)) {
    for (const e of json.entries as unknown as STStandaloneLorebookEntry[]) {
      entries.push(entryFromStandalone(e));
    }
  } else if (json.entries && typeof json.entries === "object") {
    for (const key of Object.keys(json.entries)) {
      entries.push(entryFromStandalone(json.entries[key]));
    }
  }
  return {
    id: uuid(),
    name: json.name ?? "导入的世界书",
    description: json.description ?? "",
    enabled: true,
    entries,
  };
}

// ---------- 顶层判别 ----------

function isV2(card: STCharacterCard): card is STCharacterCardV2 {
  return (card as STCharacterCardV2).spec === "chara_card_v2";
}
function isV3(card: STCharacterCard): card is STCharacterCardV3 {
  return (card as STCharacterCardV3).spec === "chara_card_v3";
}

function isStandaloneLorebook(json: unknown): json is STStandaloneLorebook {
  if (!json || typeof json !== "object") return false;
  const obj = json as Record<string, unknown>;
  if (!("entries" in obj)) return false;
  // 有 spec=chara_card_* 视为角色卡而非世界书
  if (obj.spec === "chara_card_v2" || obj.spec === "chara_card_v3") return false;
  return true;
}

function workspaceFromV2OrV3(card: STCharacterCardV2 | STCharacterCardV3): WorkspaceState {
  const data = card.data;
  const ws = emptyWorkspace();
  ws.sourceSpec = isV3(card) ? "v3" : "v2";
  ws.characterName = data.name ?? "";
  ws.characterFirstMes = data.first_mes ?? "";
  ws.characterAlternateGreetings = data.alternate_greetings ?? [];
  ws.characterCreator = data.creator ?? "";
  ws.characterVersion = data.character_version ?? "";
  ws.characterTags = data.tags ?? [];
  ws.systemPromptBlocks = buildSystemBlocksFromV2(data);
  ws.presetMessages = buildPresetMessages(data.first_mes);
  ws.regexEntries = buildRegexEntries(data.extensions?.regex_scripts);
  const inner = lorebookFromCharacterBook(data.character_book);
  if (inner) ws.lorebooks.push(inner);
  ws.rawExtensions = data.extensions;
  return ws;
}

function workspaceFromV1(card: STCharacterV1): WorkspaceState {
  const ws = emptyWorkspace();
  ws.sourceSpec = "v1";
  ws.characterName = card.name ?? "";
  ws.characterFirstMes = card.first_mes ?? "";
  ws.characterTags = card.tags ?? [];
  ws.systemPromptBlocks = buildSystemBlocksFromV1(card);
  ws.presetMessages = buildPresetMessages(card.first_mes);
  return ws;
}

// ---------- 入口 ----------

export interface ParseResult {
  workspace: WorkspaceState;
  warnings: string[];
}

export function parseCharacterJson(jsonText: string): ParseResult {
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`JSON 解析失败：${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("JSON 顶层不是对象");
  }
  const obj = parsed as STCharacterCard;
  if (isV3(obj) || isV2(obj)) {
    return { workspace: workspaceFromV2OrV3(obj), warnings };
  }
  // 没有 spec：可能是 V1 角色卡，或独立世界书
  if (isStandaloneLorebook(parsed)) {
    const ws = emptyWorkspace();
    ws.sourceSpec = "lorebook";
    ws.lorebooks.push(lorebookFromStandalone(parsed as STStandaloneLorebook));
    return { workspace: ws, warnings };
  }
  // 兜底当 V1
  warnings.push("未检测到 spec 字段，按 SillyTavern V1 角色卡解析");
  return { workspace: workspaceFromV1(obj as STCharacterV1), warnings };
}

// 把额外的世界书合并进现有 workspace（用于在已有角色卡基础上再导入一个独立世界书）
export function mergeLorebookJson(jsonText: string, current: WorkspaceState): { workspace: WorkspaceState; warnings: string[] } {
  const json = JSON.parse(jsonText);
  if (!isStandaloneLorebook(json)) {
    throw new Error("该 JSON 不是 SillyTavern 独立世界书（缺少 entries 字段）");
  }
  const book = lorebookFromStandalone(json as STStandaloneLorebook);
  return {
    workspace: { ...current, lorebooks: [...current.lorebooks, book] },
    warnings: [],
  };
}
