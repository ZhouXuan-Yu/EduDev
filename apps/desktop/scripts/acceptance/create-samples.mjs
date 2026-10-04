import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {randomBytes} from 'node:crypto';import {chromium} from 'playwright';import {sha256} from './evidence.mjs';
export async function createSamples(output) {
  if(fs.existsSync(output)&&fs.readdirSync(output).length)throw new Error('Samples directory must be empty; keep previous failed samples');
  fs.mkdirSync(output,{recursive:true});
  const code='EDU-'+randomBytes(4).toString('hex').toUpperCase();
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1400,height:520},deviceScaleFactor:1});
    await page.setContent('<html lang="zh"><meta charset="utf-8"><body style="margin:0;background:white;color:black;font:48px Microsoft YaHei,Arial;padding:40px;line-height:1.8">教师资料<br>OFFICE 731928<br>课堂37分钟　练习8道</body></html>');
    await page.screenshot({path:path.join(output,'01-打印文字.png')});
    await page.setContent(`<html><body style="margin:0;background:white"><svg width="1400" height="520" xmlns="http://www.w3.org/2000/svg"><rect width="1400" height="520" fill="white"/><rect x="80" y="150" width="90" height="90" fill="#f00"/><rect x="230" y="150" width="90" height="90" fill="#f00"/><rect x="380" y="150" width="90" height="90" fill="#f00"/><circle cx="920" cy="195" r="48" fill="#00f"/><circle cx="1100" cy="195" r="48" fill="#00f"/><text x="70" y="430" font-size="48" font-family="Arial" fill="black">${code}</text></svg></body></html>`);
    await page.screenshot({path:path.join(output,'02-公开视觉.png')});
    fs.writeFileSync(path.join(output,'03-资料实读.txt'),`教师合成资料\n核验码：${code}\n课堂37分钟\n练习8道\n`, 'utf8');
    fs.writeFileSync(path.join(output,'04-损坏图片.png'),'This is deliberately not an image.');
    const answers={synthetic:true,studentData:false,ocr:{required:['教师资料','OFFICE','731928','37','8']},vision:{code,redSquares:3,blueCircles:2,redPosition:'left',bluePosition:'right'},file:{code,minutes:37,exercises:8}};
    answers.files=fs.readdirSync(output).filter(f=>f!=='答案.json').map(file=>({file,sha256:sha256(fs.readFileSync(path.join(output,file)))}));
    fs.writeFileSync(path.join(output,'答案.json'),JSON.stringify(answers,null,2));
    fs.writeFileSync(path.join(output,'说明.md'),'# 本地合成验收素材\n\n所有内容均为合成。01测试本地文字识别；02测试真实视觉，提示词不得泄露答案；03验证正文实读；04必须报格式错误。先记下答案，不把答案文件作为附件发送。\n');
    return output;
  } finally {await browser.close();}
}
if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)) {
  const base=path.resolve('test-results/acceptance');fs.mkdirSync(base,{recursive:true});const output=fs.mkdtempSync(path.join(base,'samples-'));await createSamples(output);console.log(JSON.stringify({success:true,output}));
}
