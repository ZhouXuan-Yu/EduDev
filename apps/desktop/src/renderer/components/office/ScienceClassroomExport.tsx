import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import type {XiaozhiFilePreview} from '../../../shared/xiaozhi-files';
import {XIAOZHI_FILES_SCHEMA,XIAOZHI_FILE_ERRORS} from '../../../shared/xiaozhi-files';
import type {ScienceExportFormat,ScienceExportOutput} from '../../../shared/science-export';
import {useOfficeSynchronization} from './OfficeSynchronization';
export function ScienceClassroomExport({sessionId,workspaceVersion,preview}:{sessionId:string;workspaceVersion:string;preview:XiaozhiFilePreview}) {
 const request=useRef(''),alive=useRef(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[output,setOutput]=useState<ScienceExportOutput>();
 const sync=useOfficeSynchronization();
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(request.current)void window.omniEdu?.cancelScienceExport({sessionId,requestId:request.current});};},[sessionId,preview.path,preview.version]);
 async function run(format:ScienceExportFormat){
  if(sync.isBlocked()||request.current)return;const requestId=`xifile_${crypto.randomUUID()}`;request.current=requestId;setBusy(true);setError('');setOutput(undefined);
  try{const result=await window.omniEdu?.exportScienceClassroom({schemaVersion:XIAOZHI_FILES_SCHEMA,sessionId,requestId,path:preview.path,version:preview.version,workspaceVersion,format});
   if(!alive.current||request.current!==requestId)return;if(!result){setError('课件导出暂不可用，请重试。');return;}if(result.ok)setOutput(result.data);else setError(result.error==='cancelled'?(format==='pptx_merge'?'已取消合并，原课件未修改。':'已取消导出，未写入文件。'):result.error==='read_failed'?'课件制作失败，请重试。':XIAOZHI_FILE_ERRORS[result.error]);
  }catch{if(alive.current)setError('课件导出失败，请重试。');}
  finally{if(request.current===requestId){request.current='';if(alive.current)setBusy(false);}}
 }
 return <div data-testid="science-classroom-export" style={{padding:'12px 0'}}>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Button size="sm" isDisabled={busy||sync.blocked} onPress={()=>void run('pptx')} data-testid="science-export-pptx">导出课件PPT</Button><Button size="sm" variant="ghost" isDisabled={busy||sync.blocked} onPress={()=>void run('pptx_merge')} data-testid="science-export-merge">合并到已有课件副本</Button><Button size="sm" variant="ghost" isDisabled={busy||sync.blocked} onPress={()=>void run('gif')} data-testid="science-export-gif">导出动图</Button>
   {busy&&<Button size="sm" variant="ghost" onPress={()=>void window.omniEdu?.cancelScienceExport({sessionId,requestId:request.current})} data-testid="science-export-cancel">取消导出</Button>}</div>
  <p style={{fontSize:12}}>课件含循环动图和逐步讲解页。可导出新课件，或选择已有PPT并只修改它的新副本；原件不会覆盖。</p>
  {busy&&<p role="status">正在制作课堂演示，请稍候…</p>}{error&&<p role="alert" data-testid="science-export-error">{error}</p>}
  {output&&<div><p role="status" data-testid="science-export-success">{output.merged
    ?`已生成课件副本：${output.path}（原 ${output.merged.targetSlides} 页＋新增 ${output.merged.generatedSlides} 页，共 ${output.merged.totalSlides} 页；原课件未修改）`
    :`已保存到同一教学目录：${output.path}${output.slides?`（${output.slides}页，含动图和逐步讲解）`:''}`}</p><Button size="sm" variant="ghost" data-testid="science-export-reveal" onPress={()=>{void window.omniEdu?.revealScienceExport({sessionId,requestId:output.requestId}).then(result=>{if(!result?.ok&&alive.current)setError('文件或目录已变化，请刷新后检查。');});}}>在文件夹中显示</Button></div>}
 </div>;
}
