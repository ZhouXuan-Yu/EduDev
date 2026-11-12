import fs from 'node:fs';
import path from 'node:path';
import {ocrRuntimeRoot} from '../ocr-host';
import ocrManifest from '../ocr-runtime-manifest.json' with {type: 'json'};
import type {EnvironmentView} from '../../../shared/xiaozhi-environment';
import {filesystemScope, checkedFile, digest} from '../permissions/resources';

/** Read only built-in manifest locations. Full OCR resource verification still runs before work. */
export async function inspectLocalRuntimes(): Promise<EnvironmentView['checks']> {
  const checks: EnvironmentView['checks'] = [];
  try {
    const root = ocrRuntimeRoot();
    const entry = ocrManifest.files.find(file => file.path === 'omni-edu-ocr.exe');
    const executable = checkedFile(filesystemScope(root, ['read']), path.join(root, 'omni-edu-ocr.exe'), 'read');
    const matches = entry && fs.statSync(executable).size === entry.size && digest(fs.readFileSync(executable)) === entry.sha256;
    checks.push({id: 'ocr_runtime', label: '本地OCR', status: matches ? 'ready' : 'unavailable',
      detail: matches ? ocrManifest.engine + '，入口hash匹配；完整资源在实际读取前校验' : '运行时入口与内置manifest不匹配'});
  } catch {
    checks.push({id: 'ocr_runtime', label: '本地OCR', status: 'unavailable', detail: '本机受管OCR资源未就绪，原文件与教师文字输入可继续使用'});
  }
  checks.push({id: 'runtime_ports', label: '本地Worker端口', status: 'ready',
    detail: 'OCR与受控终端使用进程管道，无固定监听端口；外部MCP连接按已配目标与网络授权核对'});
  return checks;
}
