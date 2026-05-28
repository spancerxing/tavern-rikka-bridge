import { useCallback, useReducer, useState } from "react";
import JSZip from "jszip";
import "./App.css";
import { extractCharacterJsonFromPng, fileToArrayBuffer, fileToDataUrl, fileToText } from "./parsers/png";
import { mergeLorebookJson, parseCharacterJson } from "./parsers/normalize";
import {
  buildAllCharacterCardVariants,
  buildCharacterCardJson,
  buildLorebookExport,
  downloadJson,
} from "./exporters/rikkahub";
import { emptyWorkspace, type WorkspaceState } from "./types/model";
import { workspaceReducer } from "./state/reducer";
import { CharacterMetaPanel } from "./components/CharacterMetaPanel";
import { SystemPromptPanel } from "./components/SystemPromptPanel";
import { PresetMessagesPanel } from "./components/PresetMessagesPanel";
import { RegexPanel } from "./components/RegexPanel";
import { LorebookPanel } from "./components/LorebookPanel";
import { ToolboxPanel } from "./components/ToolboxPanel";

type TabId = "meta" | "system" | "preset" | "regex" | "lorebook" | "toolbox";

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: "meta", label: "角色元信息", hint: "名称 / 创作者 / 标签 / 头像 / 开场白" },
  { id: "system", label: "系统提示词", hint: "角色设定 / 描述 / 性格 / 场景 / 对话示例" },
  { id: "preset", label: "预设消息", hint: "first_mes 与开场白" },
  { id: "regex", label: "消息正则", hint: "脚本 / 影响范围" },
  { id: "lorebook", label: "世界书", hint: "条目 / 关键词 / 内容" },
  { id: "toolbox", label: "工具箱", hint: "批量替换 / XML→Markdown" },
];

export default function App() {
  const [workspace, dispatch] = useReducer(workspaceReducer, undefined, emptyWorkspace);
  const [tab, setTab] = useState<TabId>("meta");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const replaceWorkspace = useCallback((ws: WorkspaceState, warns: string[]) => {
    dispatch({ type: "REPLACE", workspace: ws });
    setWarnings(warns);
    setError(null);
  }, []);

  const handleImportFile = async (file: File, mode: "character" | "lorebook-merge") => {
    try {
      setError(null);
      if (file.name.toLowerCase().endsWith(".png")) {
        if (mode === "lorebook-merge") {
          throw new Error("世界书必须是 JSON 文件");
        }
        const buf = await fileToArrayBuffer(file);
        const jsonText = extractCharacterJsonFromPng(buf);
        const dataUrl = await fileToDataUrl(file);
        const { workspace: ws, warnings: warns } = parseCharacterJson(jsonText);
        ws.avatarDataUrl = dataUrl;
        replaceWorkspace(ws, warns);
      } else {
        const text = await fileToText(file);
        if (mode === "lorebook-merge") {
          const { workspace: ws } = mergeLorebookJson(text, workspace);
          replaceWorkspace(ws, ["已追加导入世界书"]);
        } else {
          const { workspace: ws, warnings: warns } = parseCharacterJson(text);
          replaceWorkspace(ws, warns);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onPickCharacter = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleImportFile(f, "character");
    e.target.value = "";
  };
  const onPickLorebook = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleImportFile(f, "lorebook-merge");
    e.target.value = "";
  };

  const safeFilename = (s: string) =>
    (s || "lorebook").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 60);

  // 把多个 JSON 文件打包成一个 zip 下载。
  // 单文件场景仍走原 downloadJson，避免无谓的 zip 开销。
  const downloadBundle = async (
    bundleName: string,
    files: { name: string; content: unknown }[],
  ) => {
    if (files.length === 1) {
      downloadJson(files[0].name, files[0].content);
      return;
    }
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.name, JSON.stringify(f.content, null, 2));
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bundleName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const collectLorebookFiles = (prefix: string) =>
    workspace.lorebooks.map(lb => ({
      name: `${prefix}__${safeFilename(lb.name)}.lorebook.json`,
      content: buildLorebookExport(lb),
    }));

  const exportCharacterCard = async () => {
    const card = buildCharacterCardJson(workspace);
    const baseName = safeFilename(workspace.characterName || "character");
    const files = [
      { name: `${baseName}.card.json`, content: card },
      ...collectLorebookFiles(baseName),
    ];
    await downloadBundle(baseName, files);
  };

  const exportAllVariants = async () => {
    const variants = buildAllCharacterCardVariants(workspace);
    const baseName = safeFilename(workspace.characterName || "character");
    // 多个变体共享同一组世界书，只放一份进 zip
    const files = [
      ...variants.map(v => ({ name: v.filename, content: v.card })),
      ...collectLorebookFiles(baseName),
    ];
    await downloadBundle(`${baseName}-variants`, files);
  };

  const exportLorebook = (idx: number) => {
    const lb = workspace.lorebooks[idx];
    if (!lb) return;
    const exported = buildLorebookExport(lb);
    const filename = `${lb.name || "lorebook"}.lorebook.json`;
    downloadJson(filename, exported);
  };

  const resetAll = () => {
    if (!confirm("确认清空当前所有内容？")) return;
    replaceWorkspace(emptyWorkspace(), []);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">
          <strong>Tavern → rikkahub 角色卡桥接工具</strong>
          <span className="src-tag">{workspaceTag(workspace)}</span>
        </div>
        <div className="topbar-actions">
          <label className="btn">
            导入角色卡 (PNG/JSON)
            <input type="file" accept=".png,.json,application/json,image/png" hidden onChange={onPickCharacter} />
          </label>
          <label className="btn">
            导入世界书 (JSON)
            <input type="file" accept=".json,application/json" hidden onChange={onPickLorebook} />
          </label>
          <button className="btn primary" onClick={exportCharacterCard}>
            导出角色卡 (JSON)
          </button>
          <button
            className="btn"
            onClick={exportAllVariants}
            disabled={
              workspace.characterAlternateGreetings.length === 0 &&
              !workspace.characterFirstMes
            }
            title={
              workspace.characterAlternateGreetings.length === 0
                ? "无备选开场白；点击会与上方按钮等价"
                : `将生成 ${1 + workspace.characterAlternateGreetings.length} 份角色卡`
            }
          >
            批量导出所有开场白版本
            {workspace.characterAlternateGreetings.length > 0 &&
              `（×${1 + workspace.characterAlternateGreetings.length}）`}
          </button>
          <button className="btn ghost" onClick={resetAll}>清空</button>
        </div>
      </header>

      {error && <div className="banner error">导入失败：{error}</div>}
      {warnings.length > 0 && (
        <div className="banner warn">
          {warnings.map((w, i) => <div key={i}>· {w}</div>)}
        </div>
      )}

      <nav className="tabbar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <div className="tab-label">{t.label}</div>
            <div className="tab-hint">{t.hint}</div>
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === "meta" && <CharacterMetaPanel workspace={workspace} dispatch={dispatch} />}
        {tab === "system" && <SystemPromptPanel workspace={workspace} dispatch={dispatch} />}
        {tab === "preset" && <PresetMessagesPanel workspace={workspace} dispatch={dispatch} />}
        {tab === "regex" && <RegexPanel workspace={workspace} dispatch={dispatch} />}
        {tab === "lorebook" && (
          <LorebookPanel workspace={workspace} dispatch={dispatch} onExport={exportLorebook} />
        )}
        {tab === "toolbox" && <ToolboxPanel workspace={workspace} dispatch={dispatch} />}
      </main>

      <footer className="footer">
        <span>条目数：</span>
        <span>系统提示 {workspace.systemPromptBlocks.length}</span>
        <span>预设 {workspace.presetMessages.length}</span>
        <span>正则 {workspace.regexEntries.length}</span>
        <span>世界书 {workspace.lorebooks.length}（共 {workspace.lorebooks.reduce((n, l) => n + l.entries.length, 0)} 条）</span>
      </footer>
    </div>
  );
}

function workspaceTag(ws: WorkspaceState): string {
  switch (ws.sourceSpec) {
    case "v1": return "来源：V1 角色卡";
    case "v2": return "来源：V2 角色卡 (chara_card_v2)";
    case "v3": return "来源：V3 角色卡 (chara_card_v3)";
    case "lorebook": return "来源：独立世界书";
    case "manual":
    default: return "空白工作区";
  }
}
