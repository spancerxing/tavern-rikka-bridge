import { useState } from "react";
import type { PanelProps } from "./types";
import type { Lorebook, LorebookEntry, LorebookPosition, LorebookRole } from "../types/model";

const POSITIONS: { value: LorebookPosition; label: string }[] = [
  { value: "before_system_prompt", label: "before_system_prompt（系统提示前）" },
  { value: "after_system_prompt", label: "after_system_prompt（系统提示后）" },
  { value: "top_of_chat", label: "top_of_chat（对话顶部）" },
  { value: "bottom_of_chat", label: "bottom_of_chat（对话底部）" },
  { value: "at_depth", label: "at_depth（按深度注入）" },
];

const ROLES: { value: LorebookRole; label: string }[] = [
  { value: "system", label: "system" },
  { value: "user", label: "user" },
  { value: "assistant", label: "assistant" },
];

interface Props extends PanelProps {
  onExport: (idx: number) => void;
}

export function LorebookPanel({ workspace, dispatch, onExport }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    workspace.lorebooks[0]?.id ?? null,
  );
  const selected = workspace.lorebooks.find(l => l.id === selectedId)
    ?? workspace.lorebooks[0]
    ?? null;

  return (
    <div className="panel lorebook-panel">
      {workspace.lorebooks.length > 0 && (
        <div className="banner warn" style={{ borderRadius: 8, marginBottom: 12 }}>
          <strong>⚠️ 关于 rikkahub 的世界书加载方式</strong>
          <div style={{ marginTop: 4, fontWeight: "normal" }}>
            rikkahub 角色卡导入器<strong>不会</strong>自动加载卡片内嵌的 <code>character_book</code>。<br />
            ✅ 顶栏的两个导出按钮已会<strong>同时下载</strong>所有挂载的世界书 JSON。<br />
            导出后请在 rikkahub 内：① "世界书 - 导入"逐个导入；② 进入助手详情页，把世界书挂到该助手下。
          </div>
        </div>
      )}
      <div className="panel-head">
        <p className="hint">
          每份世界书可单独导出（rikkahub 原生 <code>{`{version,type:"lorebook",data:{...}}`}</code> 格式，已写入 <code>type:"regex"</code> 判别字段），也可用顶栏按钮一次性批量导出。
        </p>
        <button className="btn small" onClick={() => dispatch({ type: "ADD_LOREBOOK" })}>
          + 新增世界书
        </button>
      </div>

      {workspace.lorebooks.length === 0 && (
        <div className="empty">尚无世界书。导入角色卡内嵌世界书会自动加入这里，或点上方"新增世界书"。</div>
      )}

      {workspace.lorebooks.length > 0 && (
        <div className="row stack-md">
          <aside className="lorebook-list">
            {workspace.lorebooks.map((lb, idx) => (
              <button
                key={lb.id}
                className={`lorebook-item ${selected?.id === lb.id ? "active" : ""}`}
                onClick={() => setSelectedId(lb.id)}
              >
                <div className="title-row">
                  <strong>{lb.name || "(未命名)"}</strong>
                  <span className="count">{lb.entries.length} 条</span>
                </div>
                <div className="actions" onClick={e => e.stopPropagation()}>
                  <button className="btn small" onClick={() => onExport(idx)}>导出</button>
                  <button
                    className="btn small danger"
                    onClick={() => {
                      if (confirm(`删除世界书 "${lb.name}"？`)) {
                        dispatch({ type: "REMOVE_LOREBOOK", id: lb.id });
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              </button>
            ))}
          </aside>

          <section className="grow">
            {selected && (
              <LorebookDetail
                book={selected}
                onMeta={(patch) =>
                  dispatch({ type: "UPDATE_LOREBOOK", id: selected.id, patch })
                }
                onAddEntry={() =>
                  dispatch({ type: "ADD_LOREBOOK_ENTRY", lorebookId: selected.id })
                }
                onUpdateEntry={(entryId, patch) =>
                  dispatch({
                    type: "UPDATE_LOREBOOK_ENTRY",
                    lorebookId: selected.id,
                    entryId,
                    patch,
                  })
                }
                onRemoveEntry={(entryId) =>
                  dispatch({
                    type: "REMOVE_LOREBOOK_ENTRY",
                    lorebookId: selected.id,
                    entryId,
                  })
                }
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function LorebookDetail({
  book,
  onMeta,
  onAddEntry,
  onUpdateEntry,
  onRemoveEntry,
}: {
  book: Lorebook;
  onMeta: (patch: Partial<Lorebook>) => void;
  onAddEntry: () => void;
  onUpdateEntry: (entryId: string, patch: Partial<LorebookEntry>) => void;
  onRemoveEntry: (entryId: string) => void;
}) {
  return (
    <div className="lorebook-detail">
      <div className="row gap">
        <label className="field grow">
          <span className="field-label">世界书名称</span>
          <input value={book.name} onChange={e => onMeta({ name: e.target.value })} />
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={book.enabled}
            onChange={e => onMeta({ enabled: e.target.checked })}
          />
          启用
        </label>
      </div>
      <label className="field">
        <span className="field-label">描述</span>
        <textarea
          rows={2}
          value={book.description}
          onChange={e => onMeta({ description: e.target.value })}
        />
      </label>

      <div className="panel-head">
        <strong>条目（{book.entries.length}）</strong>
        <button className="btn small" onClick={onAddEntry}>+ 新增条目</button>
      </div>

      {book.entries.map(e => (
        <EntryEditor
          key={e.id}
          entry={e}
          onChange={(patch) => onUpdateEntry(e.id, patch)}
          onRemove={() => onRemoveEntry(e.id)}
        />
      ))}
    </div>
  );
}

function EntryEditor({
  entry,
  onChange,
  onRemove,
}: {
  entry: LorebookEntry;
  onChange: (patch: Partial<LorebookEntry>) => void;
  onRemove: () => void;
}) {
  const showDepth = entry.position === "at_depth";
  return (
    <div className={`card ${entry.enabled ? "" : "muted"}`}>
      <div className="card-head">
        <input
          className="grow"
          value={entry.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="条目名 / comment"
        />
        <label className="toggle">
          <input
            type="checkbox"
            checked={entry.enabled}
            onChange={e => onChange({ enabled: e.target.checked })}
          />
          启用
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={entry.constant}
            onChange={e => onChange({ constant: e.target.checked })}
          />
          常驻
        </label>
        <button className="btn small danger" onClick={onRemove}>删除</button>
      </div>

      <div className="row gap">
        <label className="field grow">
          <span className="field-label">关键词（逗号分隔）</span>
          <input
            value={entry.keys.join(", ")}
            onChange={e =>
              onChange({
                keys: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
              })
            }
          />
        </label>
        <label className="field grow">
          <span className="field-label">次关键词（逗号分隔）</span>
          <input
            value={entry.secondaryKeys.join(", ")}
            onChange={e =>
              onChange({
                secondaryKeys: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
              })
            }
          />
        </label>
      </div>

      <div className="row gap">
        <label className="field">
          <span className="field-label">插入位置</span>
          <select
            value={entry.position}
            onChange={e => onChange({ position: e.target.value as LorebookPosition })}
          >
            {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        {showDepth && (
          <>
            <label className="field">
              <span className="field-label">注入深度</span>
              <input
                type="number"
                value={entry.insertionDepth}
                onChange={e => onChange({ insertionDepth: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="field">
              <span className="field-label">注入角色</span>
              <select
                value={entry.role}
                onChange={e => onChange({ role: e.target.value as LorebookRole })}
              >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
          </>
        )}
        <label className="field">
          <span className="field-label">优先级 (priority)</span>
          <input
            type="number"
            value={entry.insertionOrder}
            onChange={e => onChange({ insertionOrder: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="field">
          <span className="field-label">扫描深度</span>
          <input
            type="number"
            value={entry.scanDepth}
            onChange={e => onChange({ scanDepth: Number(e.target.value) || 0 })}
          />
        </label>
      </div>

      <div className="row gap">
        <label className="toggle">
          <input
            type="checkbox"
            checked={entry.useRegex}
            onChange={e => onChange({ useRegex: e.target.checked })}
          />
          关键词为正则
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={entry.caseSensitive}
            onChange={e => onChange({ caseSensitive: e.target.checked })}
          />
          区分大小写
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={entry.selective}
            onChange={e => onChange({ selective: e.target.checked })}
          />
          需要次关键词同时命中
        </label>
      </div>

      <label className="field">
        <span className="field-label">内容</span>
        <textarea
          rows={5}
          value={entry.content}
          onChange={e => onChange({ content: e.target.value })}
        />
      </label>
    </div>
  );
}
