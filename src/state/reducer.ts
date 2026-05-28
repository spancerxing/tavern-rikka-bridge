import { v4 as uuid } from "uuid";
import type {
  Lorebook,
  LorebookEntry,
  PresetMessage,
  RegexEntry,
  SystemPromptBlock,
  WorkspaceState,
} from "../types/model";

export type WorkspaceAction =
  | { type: "REPLACE"; workspace: WorkspaceState }
  | { type: "PATCH_META"; patch: Partial<WorkspaceState> }
  | { type: "ADD_SYSTEM_BLOCK" }
  | { type: "UPDATE_SYSTEM_BLOCK"; id: string; patch: Partial<SystemPromptBlock> }
  | { type: "REMOVE_SYSTEM_BLOCK"; id: string }
  | { type: "MOVE_SYSTEM_BLOCK"; id: string; direction: -1 | 1 }
  | { type: "ADD_PRESET" }
  | { type: "UPDATE_PRESET"; id: string; patch: Partial<PresetMessage> }
  | { type: "REMOVE_PRESET"; id: string }
  | { type: "MOVE_PRESET"; id: string; direction: -1 | 1 }
  | { type: "PROMOTE_PRESET_TO_FIRST_MES"; id: string }
  | { type: "ADD_REGEX" }
  | { type: "UPDATE_REGEX"; id: string; patch: Partial<RegexEntry> }
  | { type: "REMOVE_REGEX"; id: string }
  | { type: "ADD_ALTERNATE_GREETING" }
  | { type: "UPDATE_ALTERNATE_GREETING"; index: number; content: string }
  | { type: "REMOVE_ALTERNATE_GREETING"; index: number }
  | { type: "PROMOTE_ALTERNATE_TO_FIRST_MES"; index: number }
  | { type: "ADD_LOREBOOK" }
  | { type: "UPDATE_LOREBOOK"; id: string; patch: Partial<Lorebook> }
  | { type: "REMOVE_LOREBOOK"; id: string }
  | { type: "ADD_LOREBOOK_ENTRY"; lorebookId: string }
  | { type: "UPDATE_LOREBOOK_ENTRY"; lorebookId: string; entryId: string; patch: Partial<LorebookEntry> }
  | { type: "REMOVE_LOREBOOK_ENTRY"; lorebookId: string; entryId: string };

function moveItem<T extends { id: string }>(arr: T[], id: string, direction: -1 | 1): T[] {
  const idx = arr.findIndex(x => x.id === id);
  if (idx < 0) return arr;
  const target = idx + direction;
  if (target < 0 || target >= arr.length) return arr;
  const copy = arr.slice();
  [copy[idx], copy[target]] = [copy[target], copy[idx]];
  return copy;
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "REPLACE":
      return action.workspace;
    case "PATCH_META":
      return { ...state, ...action.patch };

    case "ADD_SYSTEM_BLOCK":
      return {
        ...state,
        systemPromptBlocks: [
          ...state.systemPromptBlocks,
          { id: uuid(), key: "custom", label: "自定义块", content: "", enabled: true },
        ],
      };
    case "UPDATE_SYSTEM_BLOCK":
      return {
        ...state,
        systemPromptBlocks: state.systemPromptBlocks.map(b =>
          b.id === action.id ? { ...b, ...action.patch } : b,
        ),
      };
    case "REMOVE_SYSTEM_BLOCK":
      return {
        ...state,
        systemPromptBlocks: state.systemPromptBlocks.filter(b => b.id !== action.id),
      };
    case "MOVE_SYSTEM_BLOCK":
      return {
        ...state,
        systemPromptBlocks: moveItem(state.systemPromptBlocks, action.id, action.direction),
      };

    case "ADD_PRESET":
      return {
        ...state,
        presetMessages: [
          ...state.presetMessages,
          { id: uuid(), role: "assistant", content: "" },
        ],
      };
    case "UPDATE_PRESET":
      return {
        ...state,
        presetMessages: state.presetMessages.map(m =>
          m.id === action.id ? { ...m, ...action.patch } : m,
        ),
      };
    case "REMOVE_PRESET":
      return { ...state, presetMessages: state.presetMessages.filter(m => m.id !== action.id) };
    case "MOVE_PRESET":
      return { ...state, presetMessages: moveItem(state.presetMessages, action.id, action.direction) };
    case "PROMOTE_PRESET_TO_FIRST_MES": {
      const target = state.presetMessages.find(m => m.id === action.id);
      if (!target) return state;
      return { ...state, characterFirstMes: target.content };
    }

    case "ADD_REGEX":
      return {
        ...state,
        regexEntries: [
          ...state.regexEntries,
          {
            id: uuid(),
            name: "新正则",
            findRegex: "",
            replaceString: "",
            scope: "BOTH",
            disabled: false,
            trimStrings: [],
          },
        ],
      };
    case "UPDATE_REGEX":
      return {
        ...state,
        regexEntries: state.regexEntries.map(r =>
          r.id === action.id ? { ...r, ...action.patch } : r,
        ),
      };
    case "REMOVE_REGEX":
      return { ...state, regexEntries: state.regexEntries.filter(r => r.id !== action.id) };

    case "ADD_ALTERNATE_GREETING":
      return {
        ...state,
        characterAlternateGreetings: [...state.characterAlternateGreetings, ""],
      };
    case "UPDATE_ALTERNATE_GREETING": {
      const next = state.characterAlternateGreetings.slice();
      if (action.index >= 0 && action.index < next.length) {
        next[action.index] = action.content;
      }
      return { ...state, characterAlternateGreetings: next };
    }
    case "REMOVE_ALTERNATE_GREETING":
      return {
        ...state,
        characterAlternateGreetings: state.characterAlternateGreetings.filter(
          (_, i) => i !== action.index,
        ),
      };
    case "PROMOTE_ALTERNATE_TO_FIRST_MES": {
      // 把指定备选与 first_mes 互换：原 first_mes 进入备选列表（如果非空），
      // 备选列表中那条变成新的 first_mes
      const arr = state.characterAlternateGreetings;
      if (action.index < 0 || action.index >= arr.length) return state;
      const promoted = arr[action.index];
      const next = arr.slice();
      next.splice(action.index, 1);
      const oldFirstMes = state.characterFirstMes;
      if (oldFirstMes && oldFirstMes.trim()) {
        next.unshift(oldFirstMes);
      }
      return {
        ...state,
        characterFirstMes: promoted,
        characterAlternateGreetings: next,
      };
    }

    case "ADD_LOREBOOK":
      return {
        ...state,
        lorebooks: [
          ...state.lorebooks,
          { id: uuid(), name: "新世界书", description: "", enabled: true, entries: [] },
        ],
      };
    case "UPDATE_LOREBOOK":
      return {
        ...state,
        lorebooks: state.lorebooks.map(lb =>
          lb.id === action.id ? { ...lb, ...action.patch } : lb,
        ),
      };
    case "REMOVE_LOREBOOK":
      return { ...state, lorebooks: state.lorebooks.filter(lb => lb.id !== action.id) };
    case "ADD_LOREBOOK_ENTRY":
      return {
        ...state,
        lorebooks: state.lorebooks.map(lb =>
          lb.id === action.lorebookId
            ? {
                ...lb,
                entries: [
                  ...lb.entries,
                  {
                    id: uuid(),
                    name: "新条目",
                    keys: [],
                    secondaryKeys: [],
                    content: "",
                    enabled: true,
                    constant: false,
                    selective: false,
                    insertionOrder: 100,
                    position: "before_system_prompt",
                    role: "system",
                    insertionDepth: 0,
                    caseSensitive: false,
                    useRegex: false,
                    scanDepth: 0,
                  },
                ],
              }
            : lb,
        ),
      };
    case "UPDATE_LOREBOOK_ENTRY":
      return {
        ...state,
        lorebooks: state.lorebooks.map(lb =>
          lb.id === action.lorebookId
            ? {
                ...lb,
                entries: lb.entries.map(e =>
                  e.id === action.entryId ? { ...e, ...action.patch } : e,
                ),
              }
            : lb,
        ),
      };
    case "REMOVE_LOREBOOK_ENTRY":
      return {
        ...state,
        lorebooks: state.lorebooks.map(lb =>
          lb.id === action.lorebookId
            ? { ...lb, entries: lb.entries.filter(e => e.id !== action.entryId) }
            : lb,
        ),
      };
  }
}
