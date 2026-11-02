/** Controlled INPUT files, never fabricated extraction receipts. No app/model/DB.
 * Generation uses installed docx/JSZip; the independent reader uses Python stdlib.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {Document,Packer,Paragraph,PageOrientation} from 'docx';
import JSZip from 'jszip';
import {sha256} from './evidence.mjs';

export const FIXTURE_SCHEMA='u4c2a.controlled-reference-inputs.v1';
const markerPattern=/^[A-Za-z0-9_-]{1,48}$/;
const fixedDate=new Date('2026-01-01T00:00:00.000Z');
export const layoutTruth=Object.freeze({paperSize:'A4',orientation:'landscape',columns:2,
  twips:{width:16838,height:11906,top:1134,bottom:850,left:1417,right:1134,columnGap:567}});

function inputText(marker) {
  assert.match(marker,markerPattern);
  // Genuine source paragraphs occupy more than one existing 1200-character chunk.
  // Each paragraph describes an actual arithmetic example; it is input, not an answer receipt.
  const reading=Array.from({length:28},(_,i)=>`材料${String.fromCharCode(65+i%26)}：班级第${i+1}天整理图书，上午收到${i+12}本，下午收到${i+7}本，借出${i+3}本。请先列出收到的总数，再扣除借出的数量；同一类数量使用相同单位，运算前核对加减顺序。`).join('\n');
  return `试卷名称：参考卷甲 ${marker}\n学科：数学\n年级：初二\n考试时间：45分钟\n满分：40分\n\n一、选择题（共2题，每题5分）\n1. 计算 2+3，选择正确答案。\nA. 4\nB. 5\nC. 6\nD. 7\n2. 若 x=2，求 3x 的值。\nA. 2\nB. 4\nC. 6\nD. 8\n\n阅读材料（供后面的计算题使用）\n${reading}\n\n二、计算题（共2题，每题15分）\n3. 计算材料A当天收到并扣除借出后的图书净增量，写出算式。\n4. 计算材料B和材料C两天收到图书的总数，分别列出上午与下午的数据。\n`;
}
function wordParagraphs(marker) {
  assert.match(marker,markerPattern);
  return [`试卷名称：参考卷乙 ${marker}`,'学科：数学','年级：初二','考试时间：60分钟','满分：55分',
    '一、填空题（共3题，每题5分）','1. 计算 7+8=____。','2. 若 a=4，则 2a=____。','3. 三角形内角和是____度。',
    '二、解答题（共2题，每题20分）','4. 解方程 2x+6=18，写出移项与验算过程。','5. 一件商品原价80元，降价四分之一，求现价并说明计算依据。'];
}
async function canonicalDocx(paragraphs) {
  const m=layoutTruth.twips;
  const document=new Document({creator:'Controlled reference QA',lastModifiedBy:'Controlled reference QA',title:paragraphs[0],revision:1,
    sections:[{properties:{page:{size:{width:11906,height:16838,orientation:PageOrientation.LANDSCAPE},
      margin:{top:m.top,bottom:m.bottom,left:m.left,right:m.right}},column:{count:2,space:m.columnGap,equalWidth:true}},
      children:paragraphs.map(text=>new Paragraph(text))}]});
  const generated=await JSZip.loadAsync(await Packer.toBuffer(document)),result=new JSZip();
  for(const name of Object.keys(generated.files).sort()) {
    const entry=generated.files[name];if(entry.dir)continue;
    let bytes=await entry.async('nodebuffer');
    if(name==='docProps/core.xml')bytes=Buffer.from(bytes.toString('utf8').replace(/(<dcterms:(?:created|modified)\b[^>]*>)[^<]*(<\/dcterms:(?:created|modified)>)/g,(_match,start,end)=>start+'2026-01-01T00:00:00Z'+end));
    result.file(name,bytes,{date:fixedDate,createFolders:false});
  }
  return result.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6},platform:'DOS'});
}
export async function makeReferenceFixtures(marker='C2A_CONTROL') {
  const text=inputText(marker),paragraphs=wordParagraphs(marker);
  return [
    {key:'A',format:'txt',fileName:'文件名误导-英语-120分-90分钟.txt',bytes:Buffer.from(text,'utf8'),
      expected:{title:`参考卷甲 ${marker}`,subject:'数学',grade:'初二',durationMinutes:45,totalPoints:40,
        sections:[{label:'选择题',count:2,points:5},{label:'计算题',count:2,points:15}],questionNumbers:[1,2,3,4],layout:null,difficulty:null,knowledgePoint:null}},
    {key:'B',format:'docx',fileName:'文件名误导-语文-10分-5分钟.docx',bytes:await canonicalDocx(paragraphs),
      expected:{title:`参考卷乙 ${marker}`,subject:'数学',grade:'初二',durationMinutes:60,totalPoints:55,
        sections:[{label:'填空题',count:3,points:5},{label:'解答题',count:2,points:20}],questionNumbers:[1,2,3,4,5],layout:layoutTruth,difficulty:null,knowledgePoint:null}},
  ];
}
/** Reserved .invalid address: no real person, network destination or private data.
 * Import must exercise the real local privacy classifier; QA never sets DB flags.
 */
export function privateReferenceProbe() {
  return {key:'PRIVATE',format:'txt',fileName:'C2a-私密来源拒绝对照.txt',
    bytes:Buffer.from('试卷名称：受控私密拒绝对照\n学科：数学\n年级：初二\n联系邮箱：c2-private@example.invalid\n本文件仅用于本地隐私标记拒绝，不包含真实个人信息。\n','utf8')};
}

// No production parser, extraction result, application DB or private path is used here.
const independentReader=String.raw`
import base64, hashlib, io, json, re, sys, zipfile
import xml.etree.ElementTree as ET
w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ns={'w':w}
sha=lambda b:hashlib.sha256(b).hexdigest()
def attr(node,key):
 assert node is not None, 'Missing native OOXML page property'
 return node.attrib['{'+w+'}'+key]
def read(item):
 data=base64.b64decode(item['base64'],validate=True)
 layout=None; document_sha=None; zip_parts=[]; native_sections=[]; structure_digest=None
 if item['format']=='txt':
  text=data.decode('utf-8',errors='strict')
  assert text.encode('utf-8')==data
  paragraphs=text.splitlines()
 else:
  assert item['format']=='docx'
  with zipfile.ZipFile(io.BytesIO(data)) as z:
   names=z.namelist(); assert len(names)==len(set(names)) and len(names)<100
   assert sum(i.file_size for i in z.infolist())<2*1024*1024
   assert z.testzip() is None
   assert '[Content_Types].xml' in names and '_rels/.rels' in names
   assert not any('vba' in n.lower() or n.startswith('/') or '..' in n.split('/') for n in names)
   for n in names:
    if n.endswith('.rels'): assert not any(r.attrib.get('TargetMode')=='External' for r in ET.fromstring(z.read(n)))
   raw=z.read('word/document.xml'); document_sha=sha(raw); root=ET.fromstring(raw)
   native_sections=re.findall(r'<w:sectPr\b[^>]*>.*?</w:sectPr>',raw.decode('utf-8'),re.S)
   structure_digest=sha(json.dumps({'part':'word/document.xml','xml':base64.b64encode(raw).decode('ascii')},separators=(',',':')).encode('utf-8'))
   paragraphs=[''.join(t.text or '' for t in p.findall('.//w:t',ns)) for p in root.findall('./w:body/w:p',ns)]
   sections=root.findall('./w:body/w:sectPr',ns); assert len(sections)==1
   section=sections[0]; size=section.find('w:pgSz',ns); margin=section.find('w:pgMar',ns); columns=section.find('w:cols',ns)
   twips={'width':int(attr(size,'w')),'height':int(attr(size,'h'))}
   twips.update({k:int(attr(margin,k)) for k in ['top','bottom','left','right']})
   twips['columnGap']=int(attr(columns,'space'))
   assert sorted([twips['width'],twips['height']])==[11906,16838]
   layout={'paperSize':'A4','orientation':attr(size,'orient'),'columns':int(attr(columns,'num')),'twips':twips}
   zip_parts=names
  text='\n'.join(paragraphs)
 def field(pattern):
  match=re.search(pattern,text,re.M); assert match, 'Missing controlled body field: '+pattern
  return match.group(1), {'start':match.start(1),'end':match.end(1),'quote':match.group(1)}
 title,title_e=field(r'^试卷名称：([^\n]+)$')
 subject,subject_e=field(r'^学科：([^\n]+)$'); grade,grade_e=field(r'^年级：([^\n]+)$')
 duration,duration_e=field(r'^考试时间：(\d+)分钟$'); total,total_e=field(r'^满分：(\d+)分$')
 sections=[]; evidence=[]
 for m in re.finditer(r'^[一二三四五六七八九十]+、([^（\n]+)（共(\d+)题，每题(\d+)分）$',text,re.M):
  sections.append({'label':m.group(1),'count':int(m.group(2)),'points':int(m.group(3))})
  evidence.append({'start':m.start(),'end':m.end(),'quote':m.group(0)})
 numbers=[int(m.group(1)) for m in re.finditer(r'^(\d+)\. ',text,re.M)]
 assert sections and sum(s['count'] for s in sections)==len(numbers)
 assert sum(s['count']*s['points'] for s in sections)==int(total)
 assert not re.search(r'^(?:难度|知识点)[:：]',text,re.M)
 facts={'title':title,'subject':subject,'grade':grade,'durationMinutes':int(duration),'totalPoints':int(total),
  'sections':sections,'questionNumbers':numbers,'layout':layout,'difficulty':None,'knowledgePoint':None}
 return {'key':item['key'],'format':item['format'],'inputSha256':sha(data),'body':text,'bodySha256':sha(text.encode('utf-8')),
  'facts':facts,'evidence':{'title':title_e,'subject':subject_e,'grade':grade_e,'durationMinutes':duration_e,'totalPoints':total_e,'sections':evidence},
  'documentXmlSha256':document_sha,'structureDigest':structure_digest,'nativeSections':native_sections,'zipParts':zip_parts,
  'reader':'python-stdlib.zipfile+ElementTree+independent-body-grammar.v1'}
print(json.dumps([read(i) for i in json.load(sys.stdin)],ensure_ascii=False))
`;
export function readReferenceTruth(fixtures,{python='python'}={}) {
  const input=JSON.stringify(fixtures.map(({key,format,bytes})=>({key,format,base64:bytes.toString('base64')})));
  const result=spawnSync(python,['-I','-B','-X','utf8','-c',independentReader],{input,encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:2*1024*1024});
  if(result.error)throw result.error;
  assert.equal(result.status,0,'Independent fixture reader failed: '+result.stderr);
  const truth=JSON.parse(result.stdout);assert.equal(truth.length,fixtures.length);
  for(let index=0;index<fixtures.length;index++) {
    assert.deepEqual(truth[index].facts,fixtures[index].expected,'Independent INPUT truth differs from declared fixture');
    assert.equal(truth[index].inputSha256,sha256(fixtures[index].bytes));
  }
  return truth;
}
export function writeReferenceFixtures(directory,fixtures,truth) {
  assert(!fs.existsSync(directory),'Never overwrite existing fixture evidence');
  fs.mkdirSync(directory,{recursive:false});
  const manifest={schemaVersion:FIXTURE_SCHEMA,scope:'Controlled actual input bytes; not a production extraction receipt',
    files:fixtures.map((fixture,index)=>{
      const file=path.join(directory,fixture.fileName);fs.writeFileSync(file,fixture.bytes,{flag:'wx'});
      return {key:fixture.key,format:fixture.format,path:file,bytes:fixture.bytes.length,sha256:sha256(fixture.bytes),expected:fixture.expected,independent:truth[index]};
    })};
  fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});return manifest;
}
