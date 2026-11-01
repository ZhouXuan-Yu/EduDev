import {Button} from '@heroui/react';
import {RefreshCw} from 'lucide-react';
import type {TeacherResource} from '../../../shared/contracts';
import {materialFailureText} from '../../../shared/materials';
import type {MaterialTaskStatus} from '../../../shared/material-parse-task';
import {LibraryEmpty} from './LibraryEmpty';

/** Shared empty/failure contract for overview and the full reader. */
export function MaterialBodyAvailability({resource,taskStatus,busy,retry}:{
  resource:TeacherResource;taskStatus?:MaterialTaskStatus;busy:boolean;retry:()=>void;
}) {
  const active=taskStatus==='pending'||taskStatus==='running';
  const description=resource.parseStatus==='ready'
    ?'页面已处理，空白或无文字页面仍可查看原页。'
    :taskStatus==='running'?'正在本机后台收录，完成后可以查找正文。'
    :taskStatus==='pending'?'等待本机后台收录，可以继续浏览或选择优先处理。'
    :taskStatus==='cancelled'?'已停止收录，原文件仍保存在本机。'
    :materialFailureText(resource.parseEngine);
  return <><LibraryEmpty title={resource.parseStatus==='ready'?'没有可检索文字':'正文尚未收录'} description={description}/>
    {!active&&<Button variant="secondary" onPress={retry} isDisabled={busy} data-testid="materials-retry"><RefreshCw size={16}/>重新收录</Button>}
  </>;
}
