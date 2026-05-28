import { parseCharacterJson } from "../parsers/normalize";
import {
  buildAllCharacterCardVariants,
  buildCharacterCardJson,
  buildLorebookExport,
} from "../exporters/rikkahub";
import {
  ALL_SCOPE,
  makeReplacer,
  makeXmlToMarkdownTransform,
  mapWorkspaceStrings,
  xmlToMarkdown,
} from "../utils/transform";

const sampleV2 = {
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: {
    name: "测试妮妮",
    description: "一个活泼的猫娘助手",
    personality: "好奇、温柔、爱撒娇",
    scenario: "魔法图书馆深夜",
    first_mes: "*抱着书本走过来* 主人，今晚要看哪一本？",
    mes_example: "<START>\n{{user}}: 你好\n{{char}}: 喵~",
    creator_notes: "测试用",
    system_prompt: "请扮演一只猫娘",
    post_history_instructions: "保持中文回复",
    alternate_greetings: ["*打哈欠* 好困……"],
    tags: ["猫娘", "测试"],
    creator: "tester",
    character_version: "1.0",
    character_book: {
      name: "图书馆世界设定",
      description: "",
      entries: [
        {
          keys: ["图书馆"],
          content: "图书馆有 5 层楼，每层主题不同",
          enabled: true,
          insertion_order: 100,
          name: "图书馆结构",
          position: "before_char",
        },
      ],
    },
    extensions: {
      depth_prompt: { prompt: "深度提示测试", depth: 4, role: "system" },
      regex_scripts: [
        {
          scriptName: "隐藏思考",
          findRegex: "<thought>(.*?)</thought>",
          replaceString: "",
          placement: [2],
          disabled: false,
          trimStrings: [],
        },
      ],
    },
  },
};

const standaloneLorebook = {
  name: "独立世界书",
  description: "测试",
  entries: {
    "0": {
      uid: 0,
      key: ["魔法"],
      keysecondary: [],
      content: "这个世界存在五种魔法元素",
      constant: false,
      selective: false,
      order: 100,
      position: 0,
      disable: false,
      depth: 0,
    },
    "1": {
      uid: 1,
      key: ["龙"],
      content: "龙是这个世界的统治者",
      order: 50,
      position: 4,
      depth: 4,
      disable: false,
    },
  },
};

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`断言失败：${msg}`);
}

function runV2Test() {
  const { workspace, warnings } = parseCharacterJson(JSON.stringify(sampleV2));
  assert(workspace.characterName === "测试妮妮", "name");
  assert(workspace.sourceSpec === "v2", "sourceSpec=v2");
  assert(workspace.characterFirstMes.startsWith("*抱着书本"), "first_mes");
  assert(workspace.systemPromptBlocks.length >= 6, `系统提示块数量(${workspace.systemPromptBlocks.length})`);
  assert(workspace.systemPromptBlocks.some(b => b.key === "system_prompt"), "存在 system_prompt 块");
  assert(workspace.systemPromptBlocks.some(b => b.key === "depth_prompt"), "存在 depth_prompt 块");
  assert(workspace.systemPromptBlocks.some(b => b.key === "mes_example"), "存在 mes_example 块");
  assert(workspace.regexEntries.length === 1, "正则数");
  assert(workspace.regexEntries[0].scope === "ASSISTANT", "正则 scope");
  assert(workspace.lorebooks.length === 1, "内嵌世界书");
  assert(workspace.lorebooks[0].entries.length === 1, "条目数");
  assert(workspace.presetMessages.length === 1, `预设消息只有 first_mes 一条（实际${workspace.presetMessages.length}）`);
  assert(workspace.characterAlternateGreetings.length === 1, "备选开场白存在 characterAlternateGreetings 中");

  const card = buildCharacterCardJson(workspace);
  assert(card.spec === "chara_card_v2", "导出 spec");
  assert(card.data.name === "测试妮妮", "导出 name");
  assert(card.data.first_mes.length > 0, "导出 first_mes 非空");
  assert(card.data.system_prompt.includes("请扮演一只猫娘"), "导出 system_prompt 含原系统提示");
  assert(card.data.system_prompt.includes("Example Dialogue"), "导出 system_prompt 含对话示例标题");
  assert(card.data.system_prompt.includes("猫娘"), "对话示例文本");
  assert(card.data.system_prompt.includes("Depth Prompt"), "导出含深度提示标题");
  assert(!card.data.system_prompt.includes("Alternate Greetings"), "导出不再合并备选开场白进 system_prompt");
  assert(!card.data.system_prompt.includes("Preset Messages"), "导出不再产生 ## Preset Messages 段");
  assert(!card.data.system_prompt.includes("打哈欠"), "system_prompt 不含备选开场白原文");
  assert(card.data.alternate_greetings.length === 1, "导出仍写入 alternate_greetings 字段");
  assert(card.data.character_book?.entries?.length === 1, "导出 character_book");
  const ext = card.data.extensions as Record<string, unknown>;
  assert(Array.isArray(ext.regex_scripts), "导出 regex_scripts");

  console.log("[V2 测试] 通过");
  console.log("  -> 系统提示词总长度:", card.data.system_prompt.length);
  console.log("  -> warnings:", warnings);
}

function runLorebookTest() {
  const { workspace } = parseCharacterJson(JSON.stringify(standaloneLorebook));
  assert(workspace.sourceSpec === "lorebook", "独立世界书识别");
  assert(workspace.lorebooks.length === 1, "1 个世界书");
  assert(workspace.lorebooks[0].entries.length === 2, "2 条目");
  assert(workspace.lorebooks[0].entries[1].position === "at_depth", "position=4 -> at_depth");
  assert(workspace.lorebooks[0].entries[1].insertionDepth === 4, "depth=4");
  assert(workspace.lorebooks[0].entries[1].role === "system", "默认 role=system");

  const exp = buildLorebookExport(workspace.lorebooks[0]);
  assert(exp.type === "lorebook", "type=lorebook");
  assert(exp.version === 1, "version=1");
  assert(exp.data.entries.length === 2, "导出条目数");
  assert(exp.data.entries[0].type === "regex", "entries[0].type=regex 判别字段");
  assert(exp.data.entries[1].type === "regex", "entries[1].type=regex 判别字段");
  assert(exp.data.entries[0].keywords[0] === "魔法", "keywords");
  assert(exp.data.entries[1].position === "at_depth", "导出 position=at_depth");
  assert(exp.data.entries[1].role === "system", "AT_DEPTH role 默认 system");
  assert(exp.data.entries[1].injectDepth === 4, "injectDepth=4");

  console.log("[世界书测试] 通过");
}

function runVariantTest() {
  // 含 1 主 + 2 备选 共 3 条开场白
  const card = {
    spec: "chara_card_v2",
    data: {
      name: "多版本测试",
      first_mes: "（主）你好",
      alternate_greetings: ["（备1）早上好", "（备2）晚上好"],
      description: "desc",
    },
  };
  const { workspace } = parseCharacterJson(JSON.stringify(card));
  assert(workspace.characterFirstMes === "（主）你好", "导入 first_mes");
  assert(workspace.characterAlternateGreetings.length === 2, "2 条备选");

  const variants = buildAllCharacterCardVariants(workspace);
  assert(variants.length === 3, `3 份变体（实际${variants.length}）`);
  assert(variants[0].card.data.first_mes === "（主）你好", "变体 0 first_mes");
  assert(variants[1].card.data.first_mes === "（备1）早上好", "变体 1 first_mes");
  assert(variants[2].card.data.first_mes === "（备2）晚上好", "变体 2 first_mes");
  // 每份的 alternate_greetings 包含其他两条
  assert(variants[1].card.data.alternate_greetings.includes("（主）你好"), "变体 1 备选含原主");
  assert(variants[1].card.data.alternate_greetings.includes("（备2）晚上好"), "变体 1 备选含另一条");
  assert(variants[1].card.data.alternate_greetings.length === 2, "变体 1 备选恰好 2 条");
  // 每份的 system_prompt 都不包含开场白合并段
  for (const v of variants) {
    assert(!v.card.data.system_prompt.includes("Alternate"), "变体 system_prompt 干净");
    assert(!v.card.data.system_prompt.includes("（主）"), "变体 system_prompt 不含开场白文本");
  }
  // 文件名含合理后缀
  assert(variants[0].filename.includes("main"), "首份文件名 main");
  assert(variants[1].filename.includes("alt1"), "次份文件名 alt1");
  console.log("[批量变体测试] 通过：", variants.map(v => v.filename));
}

function runReplaceTest() {
  const { workspace } = parseCharacterJson(JSON.stringify({
    spec: "chara_card_v2",
    data: {
      name: "{{user}} 的助手",
      first_mes: "你好 {{user}}！",
      description: "{{user}} 是这个故事的主角",
      alternate_greetings: ["再见 {{user}}"],
    },
  }));
  const fn = makeReplacer({ find: "{{user}}", replace: "小明", caseSensitive: false, isRegex: false });
  const { workspace: next, replacements } = mapWorkspaceStrings(workspace, fn, ALL_SCOPE);
  assert(replacements >= 4, `至少 4 处替换（实际 ${replacements}）`);
  assert(next.characterName === "小明 的助手", "name 替换");
  assert(next.characterFirstMes === "你好 小明！", "first_mes 替换");
  assert(next.characterAlternateGreetings[0] === "再见 小明", "备选替换");
  assert(next.systemPromptBlocks.find(b => b.key === "description")?.content.includes("小明"), "description 替换");
  console.log("[字符串替换测试] 通过");
}

function runRegexReplaceTest() {
  const { workspace } = parseCharacterJson(JSON.stringify({
    spec: "chara_card_v2",
    data: {
      name: "测试",
      first_mes: "hello WORLD, hello world",
      description: "",
    },
  }));
  // 正则 + 不区分大小写
  const fn = makeReplacer({
    find: "hello (\\w+)",
    replace: "你好-$1",
    caseSensitive: false,
    isRegex: true,
  });
  const { workspace: next } = mapWorkspaceStrings(workspace, fn, ALL_SCOPE);
  assert(next.characterFirstMes === "你好-WORLD, 你好-world", `正则替换错误：${next.characterFirstMes}`);
  console.log("[正则替换测试] 通过");
}

function runXmlToMarkdownTest() {
  const input = `<personality>外向</personality>\n<example>\n<user>你好</user>\n<char>嗨</char>\n</example>`;
  const out = xmlToMarkdown(input, { headerLevel: 2, lowercaseTagNames: true });
  assert(out.includes("## personality"), "## personality");
  assert(out.includes("## example"), "## example");
  assert(out.includes("## user"), "嵌套 user 标签也被转换");
  assert(out.includes("## char"), "嵌套 char 标签也被转换");
  assert(!out.includes("</"), "无残留闭合标签");

  // 通过 workspace 应用
  const { workspace } = parseCharacterJson(JSON.stringify({
    spec: "chara_card_v2",
    data: {
      name: "tag",
      first_mes: "<intro>欢迎来到这里</intro>",
      description: "",
    },
  }));
  const fn = makeXmlToMarkdownTransform({ headerLevel: 3, lowercaseTagNames: true });
  const { workspace: next, replacements } = mapWorkspaceStrings(workspace, fn, ALL_SCOPE);
  assert(replacements >= 1, "至少一处变化");
  assert(next.characterFirstMes.includes("### intro"), "first_mes 转换为 H3");
  assert(next.characterFirstMes.includes("欢迎来到这里"), "内容保留");
  console.log("[XML→Markdown 测试] 通过");
}

runV2Test();
runLorebookTest();
runVariantTest();
runReplaceTest();
runRegexReplaceTest();
runXmlToMarkdownTest();
console.log("全部测试通过");
