import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

export function readMockExamZip(filename) {
 const code=[
  'import json,sys,zipfile,hashlib',
  'with zipfile.ZipFile(sys.argv[1]) as z:',
  ' assert z.testzip() is None',
  ' names=z.namelist()',
  ' assert len(names)==len(set(names))',
  " items={n:hashlib.sha256(z.read(n)).hexdigest() for n in names}",
  " print(json.dumps({'files':items,'manifest':json.loads(z.read('清单.json'))},ensure_ascii=True))",
 ].join('\n');
 const result=spawnSync('python',['-c',code,filename],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 return JSON.parse(result.stdout);
}
