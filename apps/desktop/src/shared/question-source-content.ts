/** Lossless source partition. Ranges are UTF16 offsets in the saved literal text;
 * page boxes locate the owning crop, not an invented pixel box for a substring. */
export const QUESTION_SOURCE_CONTENT='xiaozhi.question-source-content.v1' as const;
export type SourcePart={role:'marker'|'body'|'figure'|'publication';text:string};
export type SourceContentReading={text:string;parts:SourcePart[]};
export type QuestionSourceContent={schemaVersion:typeof QUESTION_SOURCE_CONTENT;crops:{blockId:string;sha256:string;ocrSha256:string;readings:[SourceContentReading,SourceContentReading]}[]};
const plain=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value'in d;});
function sourcePartList(parts: unknown): parts is SourcePart[] {
  return (
    Array.isArray(parts) &&
    Object.getPrototypeOf(parts) === Array.prototype &&
    parts.length <= 32 &&
    Reflect.ownKeys(parts).length === parts.length + 1 &&
    parts.every(
      (p) =>
        plain(p, ["role", "text"]) &&
        ["marker", "body", "figure", "publication"].includes(String(p.role)) &&
        typeof p.text === "string" &&
        p.text.length > 0 &&
        !/[\u0000]/.test(p.text),
    )
  );
}
export function validSourceParts(
  parts: unknown,
  text: string,
): parts is SourcePart[] {
  return (
    sourcePartList(parts) &&
    (parts.length > 0 || text === "") &&
    parts.map((p) => p.text).join("") === text
  );
}
/** v1 transport adapter. Preserve the literal crop and roles, assigning only
 * whitespace omitted/duplicated at part boundaries to its original text slice.
 * Exact partitions retain their original representation. */
export function alignSourcePartWhitespace(
  parts: unknown,
  text: string,
): SourcePart[] | undefined {
  if (typeof text !== "string" || text.length > 8192 || !sourcePartList(parts))
    return;
  if (parts.map((part) => part.text).join("") === text) return parts;
  const aligned: SourcePart[] = [];
  let cursor = 0;
  for (const part of parts) {
    const start = cursor;
    const characters = Array.from(part.text).filter(
      (character) => !/\s/u.test(character),
    );
    if (!characters.length) return;
    for (const character of characters) {
      while (cursor < text.length && /\s/u.test(text[cursor])) cursor++;
      if (!text.startsWith(character, cursor)) return;
      cursor += character.length;
    }
    while (cursor < text.length && /\s/u.test(text[cursor])) cursor++;
    aligned.push({ role: part.role, text: text.slice(start, cursor) });
  }
  return cursor === text.length && validSourceParts(aligned, text)
    ? aligned
    : undefined;
}
/** Closed citation syntax only. Free-form badges and inline conditions stay body.
 * This validates an explicit retained partition; it never deletes a text prefix. */
export function publicationPrefix(text:string){
 const s=text.trim();return /^[「【[(（](?:19|20)\d{2}[\u3400-\u9fff\d\s,，、·.：:★☆*\/\-—]{1,96}[」】\])）]$/u.test(s)&&/中考|高考|期中|期末|月考|联考|模拟|检测|竞赛|真题|教材|练习|训练|调研|适应性/u.test(s);
}
export function sourcePartRanges(reading:SourceContentReading){let start=0;return reading.parts.map(p=>{const result={...p,start,end:start+p.text.length};start=result.end;return result;});}
export function validQuestionSourceContent(value:unknown,images:{id:string;sha256:string}[]):value is QuestionSourceContent{
 if(!plain(value,['schemaVersion','crops'])||value.schemaVersion!==QUESTION_SOURCE_CONTENT||!Array.isArray(value.crops)||!value.crops.length||value.crops.length>8||new Set(value.crops.map(c=>c?.blockId)).size!==value.crops.length)return false;
 return value.crops.every(c=>plain(c,['blockId','sha256','ocrSha256','readings'])&&images.some(i=>i.id===c.blockId&&i.sha256===c.sha256)&&typeof c.ocrSha256==='string'&&/^[a-f0-9]{64}$/.test(c.ocrSha256)&&Array.isArray(c.readings)&&c.readings.length===2&&c.readings.every(r=>plain(r,['text','parts'])&&typeof r.text==='string'&&r.text.length<=8192&&validSourceParts(r.parts,r.text)));
}
