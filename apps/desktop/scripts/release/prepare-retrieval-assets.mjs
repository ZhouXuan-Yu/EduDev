import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),root=path.join(desktop,'.local-retrieval');
const manifest=JSON.parse(await fs.readFile(path.join(desktop,'src/main/retrieval/runtime-manifest.json'),'utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
async function asset(relative,url,expected){const file=path.join(root,relative);await fs.mkdir(path.dirname(file),{recursive:true});try{if(digest(await fs.readFile(file))===expected)return;}catch{}
  const response=await fetch(url);if(!response.ok)throw Error('Asset unavailable: '+relative);const bytes=Buffer.from(await response.arrayBuffer());if(digest(bytes)!==expected)throw Error('Asset integrity: '+relative);await fs.writeFile(file,bytes);
}
for(const file of manifest.model.files){const url=file.path==='LICENSE'?'https://raw.githubusercontent.com/FlagOpen/FlagEmbedding/refs/heads/master/LICENSE':`https://huggingface.co/${manifest.model.repository}/resolve/${manifest.model.revision}/${file.path.endsWith('.onnx')?'onnx/':''}${file.path}`;await asset('model/'+file.path,url,file.sha256);}
await asset('wheels/tokenizers-0.21.4-cp39-abi3-win_amd64.whl','https://files.pythonhosted.org/packages/41/f2/fd673d979185f5dcbac4be7d09461cbb99751554ffb6718d0013af8604cb/tokenizers-0.21.4-cp39-abi3-win_amd64.whl','475d807a5c3eb72c59ad9b5fcdb254f6e17f53dfcbb9903233b0dfa9c943b597');
const response=await fetch('https://raw.githubusercontent.com/huggingface/tokenizers/v0.21.4/LICENSE');if(!response.ok)throw Error('Tokenizer license unavailable');const license=Buffer.from(await response.arrayBuffer());
const metadata=manifest.files.find(f=>f.path.endsWith('licenses/tokenizers.LICENSE'));if(!metadata||digest(license)!==metadata.sha256)throw Error('Tokenizer license integrity');await fs.mkdir(path.join(root,'licenses'),{recursive:true});await fs.writeFile(path.join(root,'licenses/tokenizers.LICENSE'),license);
await fs.writeFile(path.join(root,'model-lock.json'),JSON.stringify(manifest.model,null,2)+'\n');
console.log(JSON.stringify({prepared:true,model:manifest.model.repository,revision:manifest.model.revision,modelBytes:manifest.model.files.reduce((n,f)=>n+f.size,0)}));
