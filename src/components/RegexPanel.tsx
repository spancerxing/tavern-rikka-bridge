import type { PanelProps } from "./types";
import type { RegexEntry, RegexScope } from "../types/model";

const SCOPES: { value: RegexScope; label: string }[] = [
  { value: "USER", label: "USER（用户消息）" },
  { value: "ASSISTANT", label: "ASSISTANT（助手回复）" },
  { value: "BOTH", label: "BOTH（双向）" },
];

export function RegexPanel({ workspace, dispatch }: PanelProps) {
  return (
    <div className="panel">
      <div className="panel-head">
        <p className="hint">
          rikkahub 不直接接收正则脚本（它的 AssistantRegex 在 Assistant 内部），导出时会随角色卡 extensions.regex_scripts
          一起写入；rikkahub 不读，但其它酒馆兼容工具能读到。这里的字段映射 SillyTavern Regex 扩展。
        </p>
        <button className="btn small" onClick={() => dispatch({ type: "ADD_REGEX" })}>
          + 新增正则
        </button>
      </div>

      {workspace.regexEntries.length === 0 && (
        <div className="empty">无正则条目。</div>
      )}

      {workspace.regexEntries.map(r => (
        <RegexEditor
          key={r.id}
          entry={r}
          onChange={(patch) => dispatch({ type: "UPDATE_REGEX", id: r.id, patch })}
          onRemove={() => dispatch({ type: "REMOVE_REGEX", id: r.id })}
        />
      ))}
    </div>
  );
}

function RegexEditor({
  entry,
  onChange,
  onRemove,
}: {
  entry: RegexEntry;
  onChange: (patch: Partial<RegexEntry>) => void;
  onRemove: () => void;
}) {
  let regexValid = true;
  if (entry.findRegex) {
    try {
      new RegExp(entry.findRegex);
    } catch {
      regexValid = false;
    }
  }
  return (
    <div className={`card ${entry.disabled ? "muted" : ""}`}>
      <div className="card-head">
        <input
          className="grow"
          value={entry.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="脚本名称"
        />
        <select value={entry.scope} onChange={e => onChange({ scope: e.target.value as RegexScope })}>
          {SCOPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="toggle">
          <input
            type="checkbox"
            checked={!entry.disabled}
            onChange={e => onChange({ disabled: !e.target.checked })}
          />
          启用
        </label>
        <button className="btn small danger" onClick={onRemove}>删除</button>
      </div>
      <div className="row gap stack-md">
        <label className="field grow">
          <span className="field-label">正则表达式（不含 //）{regexValid ? "" : "  ⚠ 语法错误"}</span>
          <textarea
            rows={3}
            className={regexValid ? "" : "error-input"}
            value={entry.findRegex}
            onChange={e => onChange({ findRegex: e.target.value })}
            placeholder="例如：<thought>(.*?)</thought>"
          />
        </label>
        <label className="field grow">
          <span className="field-label">替换字符串</span>
          <textarea
            rows={3}
            value={entry.replaceString}
            onChange={e => onChange({ replaceString: e.target.value })}
            placeholder="例如：（思考已隐藏）"
          />
        </label>
      </div>
    </div>
  );
}
