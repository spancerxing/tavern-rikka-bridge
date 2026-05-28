import { useMemo, useState } from "react";
import type { PanelProps } from "./types";
import {
  ALL_SCOPE,
  type TransformScope,
  makeReplacer,
  makeXmlToMarkdownTransform,
  mapWorkspaceStrings,
  previewTransform,
  xmlToMarkdown,
} from "../utils/transform";

const SCOPE_LABELS: { key: keyof TransformScope; label: string; hint: string }[] = [
  { key: "meta", label: "角色元信息", hint: "名称 / 创作者 / 标签 / first_mes / 备选开场白" },
  { key: "systemPrompt", label: "系统提示词", hint: "所有块的内容" },
  { key: "preset", label: "预设消息", hint: "全部预设消息内容" },
  { key: "regex", label: "正则", hint: "脚本名 / find / replace" },
  { key: "lorebook", label: "世界书", hint: "所有书名 / 描述 / 条目名 / 关键词 / 内容" },
];

export function ToolboxPanel({ workspace, dispatch }: PanelProps) {
  const [scope, setScope] = useState<TransformScope>(ALL_SCOPE);

  return (
    <div className="panel">
      <div className="hint">
        工具箱里的批量操作会**直接修改当前工作区的内容**。点击"应用"前可以先看预览数。
      </div>

      <ScopeSelector scope={scope} onChange={setScope} />

      <ReplaceTool workspace={workspace} dispatch={dispatch} scope={scope} />
      <XmlToMarkdownTool workspace={workspace} dispatch={dispatch} scope={scope} />
    </div>
  );
}

function ScopeSelector({
  scope,
  onChange,
}: {
  scope: TransformScope;
  onChange: (s: TransformScope) => void;
}) {
  const allOn = SCOPE_LABELS.every(s => scope[s.key]);
  return (
    <div className="card">
      <div className="card-head">
        <strong>作用域</strong>
        <span className="grow" />
        <button
          className="btn small ghost"
          onClick={() => {
            const v = !allOn;
            const next: TransformScope = {
              meta: v, systemPrompt: v, preset: v, regex: v, lorebook: v,
            };
            onChange(next);
          }}
        >
          {allOn ? "全部取消" : "全部勾选"}
        </button>
      </div>
      <div className="row gap" style={{ flexWrap: "wrap" }}>
        {SCOPE_LABELS.map(s => (
          <label key={s.key} className="toggle" style={{ minWidth: 200 }}>
            <input
              type="checkbox"
              checked={scope[s.key]}
              onChange={e => onChange({ ...scope, [s.key]: e.target.checked })}
            />
            <span>
              <strong style={{ color: "var(--text)" }}>{s.label}</strong>
              <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>{s.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ReplaceTool({ workspace, dispatch, scope }: PanelProps & { scope: TransformScope }) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const previewCount = useMemo(() => {
    if (!find) return 0;
    try {
      const fn = makeReplacer({ find, replace, caseSensitive, isRegex });
      return previewTransform(workspace, fn, scope);
    } catch {
      return 0;
    }
  }, [find, replace, caseSensitive, isRegex, workspace, scope]);

  const apply = () => {
    setError(null);
    setLastResult(null);
    try {
      const fn = makeReplacer({ find, replace, caseSensitive, isRegex });
      const { workspace: next, replacements } = mapWorkspaceStrings(workspace, fn, scope);
      dispatch({ type: "REPLACE", workspace: next });
      setLastResult(`已应用：影响 ${replacements} 处字符串`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <strong>① 字符串替换</strong>
        <span className="tag">{previewCount > 0 ? `预计影响 ${previewCount} 处字符串` : "未匹配"}</span>
      </div>
      <div className="row gap" style={{ alignItems: "flex-start" }}>
        <label className="field grow">
          <span className="field-label">查找</span>
          <textarea
            rows={3}
            value={find}
            onChange={e => setFind(e.target.value)}
            placeholder={isRegex ? "正则表达式，例如：\\{\\{user\\}\\}" : "字面字符串，例如：{{user}}"}
          />
        </label>
        <label className="field grow">
          <span className="field-label">替换为</span>
          <textarea
            rows={3}
            value={replace}
            onChange={e => setReplace(e.target.value)}
            placeholder="替换文本（正则模式下支持 $1 反向引用）"
          />
        </label>
      </div>
      <div className="row gap" style={{ flexWrap: "wrap" }}>
        <label className="toggle">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={e => setCaseSensitive(e.target.checked)}
          />
          区分大小写
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={isRegex}
            onChange={e => setIsRegex(e.target.checked)}
          />
          正则模式
        </label>
        <span className="grow" />
        <button className="btn primary" onClick={apply} disabled={!find}>
          应用替换
        </button>
      </div>
      {error && <div className="banner error" style={{ borderRadius: 6 }}>{error}</div>}
      {lastResult && <div className="hint" style={{ color: "var(--green)" }}>{lastResult}</div>}
    </div>
  );
}

function XmlToMarkdownTool({ workspace, dispatch, scope }: PanelProps & { scope: TransformScope }) {
  const [headerLevel, setHeaderLevel] = useState(2);
  const [lowercaseTagNames, setLowercaseTagNames] = useState(true);
  const [demoIn, setDemoIn] = useState(`<personality>\n  外向、爱笑、对甜食毫无抵抗力\n</personality>\n<example>\n<user>你好</user>\n<char>嗨~</char>\n</example>`);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const previewCount = useMemo(() => {
    const fn = makeXmlToMarkdownTransform({ headerLevel, lowercaseTagNames });
    return previewTransform(workspace, fn, scope);
  }, [headerLevel, lowercaseTagNames, workspace, scope]);

  const demoOut = useMemo(
    () => xmlToMarkdown(demoIn, { headerLevel, lowercaseTagNames }),
    [demoIn, headerLevel, lowercaseTagNames],
  );

  const apply = () => {
    setLastResult(null);
    const fn = makeXmlToMarkdownTransform({ headerLevel, lowercaseTagNames });
    const { workspace: next, replacements } = mapWorkspaceStrings(workspace, fn, scope);
    dispatch({ type: "REPLACE", workspace: next });
    setLastResult(`已应用：影响 ${replacements} 处字符串`);
  };

  return (
    <div className="card">
      <div className="card-head">
        <strong>② XML 标签 → Markdown</strong>
        <span className="tag">
          {previewCount > 0 ? `预计影响 ${previewCount} 处字符串` : "无匹配 XML"}
        </span>
      </div>
      <div className="hint" style={{ marginBottom: 8 }}>
        把 <code>{"<tag>内容</tag>"}</code> 转成 <code>## tag\n\n内容</code>，递归处理嵌套。
        常见角色卡用 <code>{"<personality>...</personality>"}</code> 等 XML 风格组织内容，
        转成 Markdown 后多数 LLM 解读更准确，token 也更省。
      </div>
      <div className="row gap" style={{ flexWrap: "wrap" }}>
        <label className="field" style={{ maxWidth: 160 }}>
          <span className="field-label">标题级别</span>
          <select value={headerLevel} onChange={e => setHeaderLevel(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <option key={n} value={n}>{`H${n} (${"#".repeat(n)})`}</option>
            ))}
          </select>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={lowercaseTagNames}
            onChange={e => setLowercaseTagNames(e.target.checked)}
          />
          标签名小写化
        </label>
        <span className="grow" />
        <button className="btn primary" onClick={apply} disabled={previewCount === 0}>
          应用到工作区
        </button>
      </div>

      <div className="row gap" style={{ alignItems: "stretch" }}>
        <label className="field grow">
          <span className="field-label">演示输入（仅用于查看效果，不影响工作区）</span>
          <textarea rows={6} value={demoIn} onChange={e => setDemoIn(e.target.value)} />
        </label>
        <label className="field grow">
          <span className="field-label">演示输出</span>
          <textarea rows={6} value={demoOut} readOnly />
        </label>
      </div>

      {lastResult && <div className="hint" style={{ color: "var(--green)" }}>{lastResult}</div>}
    </div>
  );
}
