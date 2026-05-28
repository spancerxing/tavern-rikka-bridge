// 工具内部统一数据模型
// 导入时：SillyTavern V1/V2/V3 角色卡、独立世界书 → 归一为 WorkspaceState
// 编辑时：UI 直接修改 WorkspaceState
// 导出时：WorkspaceState → rikkahub 兼容 JSON

export type RegexScope = "USER" | "ASSISTANT" | "BOTH";

// 与 rikkahub `InjectionPosition` 枚举的 @SerialName 对齐（小写下划线）
export type LorebookPosition =
  | "before_system_prompt"
  | "after_system_prompt"
  | "top_of_chat"
  | "bottom_of_chat"
  | "at_depth";

// rikkahub `MessageRole`：仅 at_depth 位置时影响实际注入角色
export type LorebookRole = "user" | "assistant" | "system";

export type PresetRole = "system" | "user" | "assistant";

// 系统提示词分块（角色设定 / 描述 / 性格 / 场景 / 对话示例 / 创作者备注 / 历史后指令）
// 编辑时分开展示，导出时按顺序合并
export interface SystemPromptBlock {
  id: string;
  label: string;       // UI 标签：角色设定 / 描述 / 性格 ...
  key: string;         // 来源字段名：system_prompt / description / personality / scenario / mes_example / alternate_greeting_N / creator_notes / post_history_instructions / depth_prompt / custom
  content: string;
  enabled: boolean;    // 是否纳入导出的 system_prompt 拼接
}

export interface PresetMessage {
  id: string;
  role: PresetRole;
  content: string;
}

export interface RegexEntry {
  id: string;
  name: string;
  findRegex: string;       // 正则字符串（不带 // 包裹）
  replaceString: string;
  scope: RegexScope;       // 影响范围
  disabled: boolean;
  trimStrings: string[];
}

export interface LorebookEntry {
  id: string;
  name: string;            // comment / name
  keys: string[];          // 主关键词
  secondaryKeys: string[]; // 次关键词（selective 时使用）
  content: string;
  enabled: boolean;
  constant: boolean;       // 始终激活
  selective: boolean;
  insertionOrder: number;  // priority
  position: LorebookPosition;
  role: LorebookRole;      // 仅 position=at_depth 时使用
  insertionDepth: number;  // 仅 position=at_depth 时有意义
  caseSensitive: boolean;
  useRegex: boolean;
  scanDepth: number;
}

export interface Lorebook {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  entries: LorebookEntry[];
}

// 工具的根状态：一份角色卡 + 一份/多份世界书
export interface WorkspaceState {
  // 角色卡核心元信息
  characterName: string;
  characterFirstMes: string;          // 开场白（导出时作为 first_mes）
  characterAlternateGreetings: string[]; // 备选开场白
  characterCreator: string;
  characterVersion: string;
  characterTags: string[];
  // 系统提示词（编辑时分块；导出时拼成一段或写到对应字段）
  systemPromptBlocks: SystemPromptBlock[];
  // 预设消息（rikkahub 的 presetMessages 概念）
  presetMessages: PresetMessage[];
  // 正则
  regexEntries: RegexEntry[];
  // 世界书（角色卡内嵌的 character_book 也归一到此处）
  lorebooks: Lorebook[];
  // 背景图（PNG 卡导入时保留原图 base64，便于 UI 展示）
  avatarDataUrl?: string;
  // 来源元数据，仅供 UI 展示
  sourceSpec?: "v1" | "v2" | "v3" | "lorebook" | "manual";
  rawExtensions?: Record<string, unknown>; // 保留 V2/V3 的 extensions 原始内容
}

export const emptyWorkspace = (): WorkspaceState => ({
  characterName: "",
  characterFirstMes: "",
  characterAlternateGreetings: [],
  characterCreator: "",
  characterVersion: "",
  characterTags: [],
  systemPromptBlocks: [],
  presetMessages: [],
  regexEntries: [],
  lorebooks: [],
  sourceSpec: "manual",
});
