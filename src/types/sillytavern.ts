// SillyTavern 角色卡 / 世界书 / 正则的 JSON 形状（用于解析输入）
// 仅声明导入时关心的字段，未声明字段以 unknown 保留

export interface STCharacterV1 {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  // 运行时常见扩展
  creatorcomment?: string;
  tags?: string[];
  avatar?: string;
  [k: string]: unknown;
}

export interface STDepthPrompt {
  prompt?: string;
  depth?: number;
  role?: "system" | "user" | "assistant";
}

export interface STRegexScript {
  id?: string;
  scriptName?: string;
  findRegex?: string;
  replaceString?: string;
  trimStrings?: string[];
  placement?: number[];   // 1=user input 2=ai output 3=slash command 4=world info ...
  disabled?: boolean;
  markdownOnly?: boolean;
  promptOnly?: boolean;
  runOnEdit?: boolean;
  substituteRegex?: number;
  minDepth?: number | null;
  maxDepth?: number | null;
}

// character_book 内嵌格式（V2/V3 数据.character_book）
export interface STCharacterBookEntry {
  keys?: string[];
  content?: string;
  extensions?: Record<string, unknown>;
  enabled?: boolean;
  insertion_order?: number;
  case_sensitive?: boolean;
  name?: string;
  comment?: string;
  priority?: number;
  id?: number | string;
  selective?: boolean;
  secondary_keys?: string[];
  constant?: boolean;
  position?: "before_char" | "after_char" | string;
}

export interface STCharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions?: Record<string, unknown>;
  entries?: STCharacterBookEntry[];
}

export interface STCharacterDataV2 {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  character_book?: STCharacterBook;
  tags?: string[];
  creator?: string;
  character_version?: string;
  extensions?: Record<string, unknown> & {
    depth_prompt?: STDepthPrompt;
    regex_scripts?: STRegexScript[];
    talkativeness?: number;
    fav?: boolean;
  };
}

export interface STCharacterCardV2 {
  spec: "chara_card_v2";
  spec_version?: string;
  data: STCharacterDataV2;
}

export interface STCharacterDataV3 extends STCharacterDataV2 {
  nickname?: string;
  creator_notes_multilingual?: Record<string, string>;
  source?: string[];
  group_only_greetings?: string[];
  creation_date?: number;
  modification_date?: number;
  assets?: Array<{ type: string; uri: string; name: string; ext: string }>;
}

export interface STCharacterCardV3 {
  spec: "chara_card_v3";
  spec_version?: string;
  data: STCharacterDataV3;
}

export type STCharacterCard = STCharacterCardV2 | STCharacterCardV3 | STCharacterV1;

// 独立世界书（SillyTavern 原生 JSON）：entries 是 Map（key 为字符串数字）
export interface STStandaloneLorebookEntry {
  uid?: number;
  key?: string[];
  keysecondary?: string[];
  comment?: string;
  content?: string;
  constant?: boolean;
  selective?: boolean;
  selectiveLogic?: number;
  order?: number;
  position?: number;       // 0..4 整数
  disable?: boolean;
  excludeRecursion?: boolean;
  probability?: number;
  useProbability?: boolean;
  depth?: number;
  group?: string;
  caseSensitive?: boolean | null;
  matchWholeWords?: boolean | null;
  useGroupScoring?: boolean | null;
  automationId?: string;
  role?: number | null;
  vectorized?: boolean;
  // SillyTavern 1.12+ 字段
  scanDepth?: number | null;
  [k: string]: unknown;
}

export interface STStandaloneLorebook {
  name?: string;
  description?: string;
  entries: Record<string, STStandaloneLorebookEntry>;
}
