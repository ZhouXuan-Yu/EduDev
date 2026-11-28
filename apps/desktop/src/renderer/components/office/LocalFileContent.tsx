import {useState} from 'react';
import {Button} from '@heroui/react';
import {Minus,Plus} from 'lucide-react';
import {Markdown} from '../../heroui-pro/components/markdown';
import type {XiaozhiFilePreview} from '../../../shared/xiaozhi-files';
import {ScienceDemoFrame} from './ScienceDemoFrame';
import '../../ui-system/local-file-preview.css';

type Preview = Omit<XiaozhiFilePreview,'path'>;
function LocalImageViewer({source,name,testId}:{source:string;name:string;testId?:string}){
  const [zoom,setZoom]=useState<number>();
  const [failed,setFailed]=useState(false);
  if(failed)return <p role="alert">图片无法显示。请确认文件可以正常打开。</p>;
  return <div className="local-image-viewer">
    <div className="local-image-toolbar" role="group" aria-label="图片缩放">
      <Button variant="ghost" size="sm" isIconOnly aria-label="缩小图片" isDisabled={zoom===25} onPress={()=>setZoom(value=>Math.max(25,(value??100)-25))}><Minus size={15}/></Button>
      <Button variant="ghost" size="sm" aria-pressed={zoom===undefined} onPress={()=>setZoom(undefined)}>适合宽度</Button>
      <Button variant="ghost" size="sm" aria-label="查看图片原始大小" aria-pressed={zoom===100} onPress={()=>setZoom(100)}>{zoom===undefined?'原始大小':zoom+'%'}</Button>
      <Button variant="ghost" size="sm" isIconOnly aria-label="放大图片" isDisabled={zoom===400} onPress={()=>setZoom(value=>Math.min(400,(value??100)+25))}><Plus size={15}/></Button>
    </div>
    <div className="local-image-canvas" data-fit={zoom===undefined}>
      <img src={source} alt={name} data-testid={testId} onError={()=>setFailed(true)}
        style={zoom===undefined?undefined:{zoom:zoom/100}} />
    </div>
  </div>;
}

export function LocalFileContent({file,imageTestId,textTestId,documentTestId,documentInfoTestId}:{
  file:Preview;imageTestId?:string;textTestId?:string;documentTestId?:string;documentInfoTestId?:string;
}){
  if(file.image)return <LocalImageViewer key={file.version} name={file.name} source={file.image} testId={imageTestId}/>;
  if(file.html)return <ScienceDemoFrame html={file.html}/>;
  if(file.format==='office'||file.format==='markdown'){
    const document=file.document;
    const workbook=document?.format==='xlsx';
    return <div className="local-document-preview" data-workbook={workbook} data-testid={documentTestId}>
      {document&&<p role="status" className="local-document-note" data-testid={documentInfoTestId}>
        {workbook?'Excel · 本地表格预览':`${document.format.toUpperCase()} · 本地提取正文，版式以原文件为准`}
      </p>}
      {document?.warnings.map((warning,index)=><p role="status" key={index}>{warning}</p>)}
      <Markdown components={{
        img:({alt})=><span>［图片：{alt||'文档图片'}，未加载］</span>,
        a:({children})=><span>{children}</span>,
        table:({children})=><div className="local-preview-table" tabIndex={0} role="region" aria-label="表格预览"><table>{children}</table></div>,
      }}>{file.text||''}</Markdown>
    </div>;
  }
  if(file.format==='text')return <pre data-testid={textTestId}>{file.text}</pre>;
  return <div><h3>{file.name}</h3><p>{file.size} 字节</p><p>暂不支持此格式的内容预览。</p></div>;
}
