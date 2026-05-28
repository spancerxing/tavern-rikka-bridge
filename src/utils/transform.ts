import type { WorkspaceState } from "../types/model";

// 作用域：勾选哪些类别参与变换
export interface TransformScope {
  meta: boolean;            // 角色名 / 创作者 / 标签 / first_mes / 备选开场白
  systemPrompt: boolean;    // 系统提示词块内容
  preset: boolean;          // 预设消息内容
  regex: boolean;           // 正则名 / find / replace
  lorebook: boolean;        // 世界书名/描述/条目名/关键词/内容
}

export const ALL_SCOPE: TransformScope = {
  meta: true,
  systemPrompt: true,
  preset: true,
  regex: true,
  lorebook: true,
};

// 对 workspace 中所有"文本字段"应用 fn(str)→str 变换；scope 控制范围
export function mapWorkspaceStrings(
  ws: WorkspaceState,
  fn: (s: string) => string,
  scope: TransformScope,
): { workspace: WorkspaceState; replacements: number } {
  let count = 0;
  // 包装 fn，统计实际发生变化的字符串个数
  const apply = (s: string): string => {
    if (!s) return s;
    const next = fn(s);
    if (next !== s) count++;
    return next;
  };
  const applyArr = (arr: string[]): string[] => arr.map(apply);

  const next: WorkspaceState = { ...ws };

  if (scope.meta) {
    next.characterName = apply(ws.characterName);
    next.characterFirstMes = apply(ws.characterFirstMes);
    next.characterAlternateGreetings = applyArr(ws.characterAlternateGreetings);
    next.characterCreator = apply(ws.characterCreator);
    next.characterVersion = apply(ws.characterVersion);
    next.characterTags = applyArr(ws.characterTags);
  }

  if (scope.systemPrompt) {
    next.systemPromptBlocks = ws.systemPromptBlocks.map(b => ({
      ...b,
      content: apply(b.content),
    }));
  }

  if (scope.preset) {
    next.presetMessages = ws.presetMessages.map(m => ({
      ...m,
      content: apply(m.content),
    }));
  }

  if (scope.regex) {
    next.regexEntries = ws.regexEntries.map(r => ({
      ...r,
      name: apply(r.name),
      findRegex: apply(r.findRegex),
      replaceString: apply(r.replaceString),
    }));
  }

  if (scope.lorebook) {
    next.lorebooks = ws.lorebooks.map(lb => ({
      ...lb,
      name: apply(lb.name),
      description: apply(lb.description),
      entries: lb.entries.map(e => ({
        ...e,
        name: apply(e.name),
        keys: applyArr(e.keys),
        secondaryKeys: applyArr(e.secondaryKeys),
        content: apply(e.content),
      })),
    }));
  }

  return { workspace: next, replacements: count };
}

// ---------- 字符串替换 ----------

export interface ReplaceOptions {
  find: string;
  replace: string;
  caseSensitive: boolean;
  isRegex: boolean;
}

export function makeReplacer(opts: ReplaceOptions): (s: string) => string {
  if (!opts.find) return (s) => s;
  if (opts.isRegex) {
    let re: RegExp;
    try {
      re = new RegExp(opts.find, opts.caseSensitive ? "g" : "gi");
    } catch {
      throw new Error(`正则语法错误：${opts.find}`);
    }
    return (s) => s.replace(re, opts.replace);
  }
  // 字面量替换：转义 find，构造全局 RegExp
  const escaped = opts.find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, opts.caseSensitive ? "g" : "gi");
  return (s) => s.replace(re, opts.replace);
}

// ---------- XML → Markdown ----------

export interface XmlToMarkdownOptions {
  headerLevel: number;       // 2 ⇒ "## tag"
  lowercaseTagNames: boolean;
}

// 把所有 <tag>content</tag> 替换为 ## tag\n\ncontent。
// 用迭代而非递归，每轮非贪婪匹配只能匹配最近的 </tag>，因此最内层会先转换，
// 转换后外层在下一轮可以匹配（因为内层 close tag 已不存在）。
// 限制最大 30 轮以防病态输入。
export function xmlToMarkdown(text: string, opts: XmlToMarkdownOptions): string {
  if (!text) return text;
  const re = /<([a-zA-Z][\w:-]*)\s*>([\s\S]*?)<\/\1\s*>/;
  let cur = text;
  for (let i = 0; i < 30; i++) {
    let changed = false;
    cur = cur.replace(re, (_m, tag: string, content: string) => {
      changed = true;
      const tagName = opts.lowercaseTagNames ? tag.toLowerCase() : tag;
      const heading = "#".repeat(Math.min(Math.max(opts.headerLevel, 1), 6));
      return `\n${heading} ${tagName}\n\n${content.trim()}\n`;
    });
    if (!changed) break;
  }
  // 整理多余空行
  return cur.replace(/\n{3,}/g, "\n\n").trim();
}

export function makeXmlToMarkdownTransform(opts: XmlToMarkdownOptions): (s: string) => string {
  return (s) => xmlToMarkdown(s, opts);
}

// 预览：在不修改 workspace 的前提下计算"会发生变化的字符串数"
export function previewTransform(
  ws: WorkspaceState,
  fn: (s: string) => string,
  scope: TransformScope,
): number {
  const { replacements } = mapWorkspaceStrings(ws, fn, scope);
  return replacements;
}
