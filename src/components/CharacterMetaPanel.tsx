import type { PanelProps } from "./types";

export function CharacterMetaPanel({ workspace, dispatch }: PanelProps) {
  const patch = (p: Partial<typeof workspace>) => dispatch({ type: "PATCH_META", patch: p });

  const tagsText = workspace.characterTags.join(", ");
  const altCount = workspace.characterAlternateGreetings.length;

  return (
    <div className="panel">
      <div className="row">
        {workspace.avatarDataUrl && (
          <div className="avatar-box">
            <img src={workspace.avatarDataUrl} alt="头像" className="avatar-img" />
            <div className="src-tag">来源：{workspace.sourceSpec ?? "manual"}</div>
          </div>
        )}
        <div className="grow stack">
          <Field label="角色名称">
            <input
              value={workspace.characterName}
              onChange={e => patch({ characterName: e.target.value })}
              placeholder="角色名"
            />
          </Field>
          <div className="row gap">
            <Field label="创作者">
              <input
                value={workspace.characterCreator}
                onChange={e => patch({ characterCreator: e.target.value })}
              />
            </Field>
            <Field label="角色版本">
              <input
                value={workspace.characterVersion}
                onChange={e => patch({ characterVersion: e.target.value })}
              />
            </Field>
          </div>
          <Field label="标签（逗号分隔）">
            <input
              value={tagsText}
              onChange={e =>
                patch({
                  characterTags: e.target.value
                    .split(",")
                    .map(s => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <strong>主开场白 (first_mes)</strong>
          <span className="tag green">导出时作为 rikkahub 的第一条 assistant 预设</span>
        </div>
        <textarea
          rows={6}
          value={workspace.characterFirstMes}
          onChange={e => patch({ characterFirstMes: e.target.value })}
          placeholder="角色登场的第一句话..."
        />
      </div>

      <div className="card">
        <div className="card-head">
          <strong>备选开场白（{altCount}）</strong>
          <span className="grow" />
          <span className="hint warn-inline" style={{ flex: "0 1 auto", padding: "4px 8px" }}>
            rikkahub 单次只能使用一个 first_mes。点击"设为主开场白"可与当前主开场白互换。
            如果想同时保留多个版本供切换，使用顶栏的"批量导出所有开场白版本"——会为每个备选生成一份独立角色卡。
          </span>
          <button className="btn small" onClick={() => dispatch({ type: "ADD_ALTERNATE_GREETING" })}>
            + 新增备选
          </button>
        </div>
        {altCount === 0 && <div className="empty">暂无备选开场白。</div>}
        {workspace.characterAlternateGreetings.map((g, i) => (
          <div key={i} className="card" style={{ background: "var(--panel-2)" }}>
            <div className="card-head">
              <span className="tag">备选 #{i + 1}</span>
              <span className="grow" />
              <button
                className="btn small"
                onClick={() => dispatch({ type: "PROMOTE_ALTERNATE_TO_FIRST_MES", index: i })}
              >
                ⇅ 设为主开场白
              </button>
              <button
                className="btn small danger"
                onClick={() => dispatch({ type: "REMOVE_ALTERNATE_GREETING", index: i })}
              >
                删除
              </button>
            </div>
            <textarea
              rows={5}
              value={g}
              onChange={e =>
                dispatch({
                  type: "UPDATE_ALTERNATE_GREETING",
                  index: i,
                  content: e.target.value,
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
