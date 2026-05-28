import type { PanelProps } from "./types";
import type { SystemPromptBlock } from "../types/model";

const KEY_OPTIONS: { value: string; label: string }[] = [
  { value: "system_prompt", label: "system_prompt（系统提示词）" },
  { value: "description", label: "description（角色描述）" },
  { value: "personality", label: "personality（性格）" },
  { value: "scenario", label: "scenario（场景）" },
  { value: "mes_example", label: "mes_example（对话示例）" },
  { value: "creator_notes", label: "creator_notes（创作者备注）" },
  { value: "post_history_instructions", label: "post_history_instructions（历史后指令）" },
  { value: "depth_prompt", label: "depth_prompt（深度提示）" },
  { value: "custom", label: "custom（自定义）" },
];

export function SystemPromptPanel({ workspace, dispatch }: PanelProps) {
  return (
    <div className="panel">
      <div className="panel-head">
        <p className="hint">
          rikkahub 角色卡导入器只读 description / personality / scenario / system_prompt 这 4 个文本字段。
          其他类别（如 mes_example / depth_prompt / 自定义块）在导出时会自动并入 system_prompt 以避免内容丢失。
          关闭"启用"开关可在导出时排除该块。
        </p>
        <button className="btn small" onClick={() => dispatch({ type: "ADD_SYSTEM_BLOCK" })}>
          + 新增块
        </button>
      </div>

      {workspace.systemPromptBlocks.length === 0 && (
        <div className="empty">无系统提示词块。点击右上角"新增块"。</div>
      )}

      {workspace.systemPromptBlocks.map((b, i) => (
        <BlockEditor
          key={b.id}
          block={b}
          isFirst={i === 0}
          isLast={i === workspace.systemPromptBlocks.length - 1}
          onChange={(patch) => dispatch({ type: "UPDATE_SYSTEM_BLOCK", id: b.id, patch })}
          onRemove={() => dispatch({ type: "REMOVE_SYSTEM_BLOCK", id: b.id })}
          onMove={(dir) => dispatch({ type: "MOVE_SYSTEM_BLOCK", id: b.id, direction: dir })}
        />
      ))}
    </div>
  );
}

function BlockEditor({
  block,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMove,
}: {
  block: SystemPromptBlock;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<SystemPromptBlock>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className={`card ${block.enabled ? "" : "muted"}`}>
      <div className="card-head">
        <select value={block.key} onChange={e => onChange({ key: e.target.value })}>
          {KEY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          className="grow"
          value={block.label}
          onChange={e => onChange({ label: e.target.value })}
          placeholder="块标签（仅 UI 显示）"
        />
        <label className="toggle">
          <input
            type="checkbox"
            checked={block.enabled}
            onChange={e => onChange({ enabled: e.target.checked })}
          />
          启用
        </label>
        <button className="btn small ghost" disabled={isFirst} onClick={() => onMove(-1)}>↑</button>
        <button className="btn small ghost" disabled={isLast} onClick={() => onMove(1)}>↓</button>
        <button className="btn small danger" onClick={onRemove}>删除</button>
      </div>
      <textarea
        rows={8}
        value={block.content}
        onChange={e => onChange({ content: e.target.value })}
        placeholder="内容..."
      />
    </div>
  );
}
