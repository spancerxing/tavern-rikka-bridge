// PNG tEXt chunk 读取，用于从角色卡 PNG 中抽取 base64(JSON) 元数据。
// SillyTavern 写入时关键字为 "chara"（V3 同时还会写 "ccv3"），值就是 base64(JSON)。
// rikkahub 读取时实际用的是 metadata-extractor 库，解析后拼成 "chara: <base64>"，
// 它再用正则 [chara:\s*(.+?)] 匹配——这是它自家的独立做法。SillyTavern 文件本身的
// 标准格式始终是关键字 = chara/ccv3，值 = base64。我们按标准读即可。

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

interface PngTextChunk {
  keyword: string;
  text: string;
}

function readUint32BE(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function decodeLatin1(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

export function readPngTextChunks(buffer: ArrayBuffer): PngTextChunk[] {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 8) throw new Error("文件不是有效的 PNG（长度不足）");
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) throw new Error("文件不是有效的 PNG（签名错误）");
  }
  const view = new DataView(buffer);
  const chunks: PngTextChunk[] = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = readUint32BE(view, offset);
    offset += 4;
    const type = decodeLatin1(bytes.subarray(offset, offset + 4));
    offset += 4;
    const dataStart = offset;
    const dataEnd = dataStart + length;
    if (type === "tEXt") {
      const segment = bytes.subarray(dataStart, dataEnd);
      let nullIdx = -1;
      for (let i = 0; i < segment.length; i++) {
        if (segment[i] === 0) {
          nullIdx = i;
          break;
        }
      }
      if (nullIdx !== -1) {
        const keyword = decodeLatin1(segment.subarray(0, nullIdx));
        const text = decodeLatin1(segment.subarray(nullIdx + 1));
        chunks.push({ keyword, text });
      }
    } else if (type === "iTXt") {
      // iTXt: keyword\0 compFlag\0 compMethod\0 langTag\0 transKeyword\0 text
      const segment = bytes.subarray(dataStart, dataEnd);
      const parts: number[] = [];
      for (let i = 0; i < segment.length && parts.length < 5; i++) {
        if (segment[i] === 0) parts.push(i);
      }
      if (parts.length >= 5) {
        const keyword = decodeLatin1(segment.subarray(0, parts[0]));
        const text = decodeUtf8(segment.subarray(parts[4] + 1));
        chunks.push({ keyword, text });
      }
    }
    offset = dataEnd + 4; // 跳过 CRC
    if (type === "IEND") break;
  }
  return chunks;
}

// 从 PNG 中抽取 SillyTavern 角色卡 JSON 字符串
export function extractCharacterJsonFromPng(buffer: ArrayBuffer): string {
  const chunks = readPngTextChunks(buffer);
  // V3 优先
  const ccv3 = chunks.find(c => c.keyword === "ccv3");
  const chara = chunks.find(c => c.keyword === "chara");
  const target = ccv3 ?? chara;
  if (!target) {
    throw new Error("PNG 中未找到 chara/ccv3 元数据块（不是 SillyTavern 角色卡）");
  }
  let raw = target.text;
  // 兼容 rikkahub 风格的 "[chara: base64]" 包裹（极少见但保险起见）
  const bracketMatch = raw.match(/^\[(?:chara|ccv3):\s*(.+)]$/s);
  if (bracketMatch) raw = bracketMatch[1];
  // base64 解码 → 字节 → UTF-8
  const binStr = atob(raw.trim());
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

export function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

export function fileToText(file: File): Promise<string> {
  return file.text();
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
