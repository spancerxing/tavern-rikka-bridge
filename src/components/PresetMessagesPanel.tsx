import type { PanelProps } from "./types";
import type { PresetMessage, PresetRole } from "../types/model";

const ROLES: PresetRole[] = ["system", "user", "assistant"];

export function PresetMessagesPanel({ workspace, dispatch }: PanelProps) {
  return (
    <div className="panel">
      <div className="panel-head">
        <p className="hint">
          rikkahub 把第一条 assistant 预设消息当作开场白展示。
          其它 role（system/user）或多余 assistant 消息在导出时会被并入 system_prompt 以避免丢失。
          也可以点击"设为 first_mes"把某条消息提升为正式开场白字段。
        </p>
        <button className="btn small" onClick={() => dispatch({ type: "ADD_PRESET" })}>
          + 新增消息
        </button>
      </div>

      {workspace.presetMessages.length === 0 && (
        <div className="empty">无预设消息。</div>
      )}

      {workspace.presetMessages.map((m, i) => (
        <PresetEditor
          key={m.id}
          msg={m}
          isFirst={i === 0}
          isLast={i === workspace.presetMessages.length - 1}
          firstMesPreview={i === 0 ? workspace.characterFirstMes : undefined}
          onChange={(patch) => dispatch({ type: "UPDATE_PRESET", id: m.id, patch })}
          onRemove={() => dispatch({ type: "REMOVE_PRESET", id: m.id })}
          onMove={(dir) => dispatch({ type: "MOVE_PRESET", id: m.id, direction: dir })}
          onPromote={() => dispatch({ type: "PROMOTE_PRESET_TO_FIRST_MES", id: m.id })}
        />
      ))}
    </div>
  );
}

function PresetEditor({
  msg,
  isFirst,
  isLast,
  firstMesPreview,
  onChange,
  onRemove,
  onMove,
  onPromote,
}: {
  msg: PresetMessage;
  isFirst: boolean;
  isLast: boolean;
  firstMesPreview?: string;
  onChange: (patch: Partial<PresetMessage>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onPromote: () => void;
}) {
  const isLikelyFirstMes = isFirst && msg.role === "assistant";
  return (
    <div className="card">
      <div className="card-head">
        <select value={msg.role} onChange={e => onChange({ role: e.target.value as PresetRole })}>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {isLikelyFirstMes && (
          <span className="tag green">将作为 first_mes 导出</span>
        )}
        <span className="grow" />
        <button className="btn small ghost" onClick={onPromote}>设为 first_mes</button>
        <button className="btn small ghost" disabled={isFirst} onClick={() => onMove(-1)}>↑</button>
        <button className="btn small ghost" disabled={isLast} onClick={() => onMove(1)}>↓</button>
        <button className="btn small danger" onClick={onRemove}>删除</button>
      </div>
      <textarea
        rows={6}
        value={msg.content}
        onChange={e => onChange({ content: e.target.value })}
        placeholder="消息内容..."
      />
      {firstMesPreview !== undefined && firstMesPreview !== msg.content && msg.role === "assistant" && (
        <div className="hint warn-inline">
          注意：当前 first_mes 字段与第一条 assistant 消息内容不一致。导出会以"角色元信息"页的 first_mes 为准。
        </div>
      )}
    </div>
  );
}
