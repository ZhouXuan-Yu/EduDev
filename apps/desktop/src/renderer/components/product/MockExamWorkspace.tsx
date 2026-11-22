import {useEffect,useState} from 'react';
import {Button,SearchField} from '@heroui/react';
import {MOCK_EXAM_SCHEMA,type MockExamCatalog,type MockExamCatalogRef} from '../../../shared/mock-exam-compilation';
import {MockExamExportActions} from './MockExamExportActions';
import {ResourceTable} from '../../ui-system/ResourceTable';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import {PiMockExamCatalog} from '../office/PiMockExamCatalog';
import {TaskArtifactRelations} from '../office/workbench/TaskArtifactRelations';
import {useWorkbenchSummary} from '../office/workbench/useWorkbenchSummary';
import {LibraryEmpty} from './LibraryEmpty';
import {libraryDate} from './material-library';
import styles from '../../ui-system/teaching-catalogue-alignment.module.css';

export function MockExamWorkspace({reference}:{reference?:MockExamCatalogRef}) {
  const navigation=useDesktopNavigation();
  const [search,setSearch]=useState(''),[cursor,setCursor]=useState<string>(),[previous,setPrevious]=useState<(string|undefined)[]>([]);
  const [selection,setSelection]=useState<MockExamCatalogRef|undefined>(reference),[refresh,setRefresh]=useState(0);
  const {value,loading,error,reload}=useWorkbenchSummary({schemaVersion:1,kind:'mock_exam_catalogs',query:search,cursor},refresh);
  const page=value?.kind==='mock_exam_catalogs'?value:undefined;
  useEffect(()=>{if(reference)setSelection(reference);},[reference]);

  function changeSearch(value:string){setSearch(value);setCursor(undefined);setPrevious([]);}
  function open(id:string){
    const row=page?.items.find(item=>item.id===id);
    if(row)navigation.navigate({view:'artifacts',mockExam:{id:row.id,sessionId:row.sessionId}});
  }
  function reset(){if(navigation.navigate({view:'artifacts'},{replace:true}))setSelection(undefined);}
  const rows=(page?.items||[]).map(row=>({id:row.id,title:row.title,
    description:`${row.count} 份 · ${libraryDate(row.updatedAt)}`,type:`第 ${row.revision} 版`,
    state:row.state==='confirmed'?'目录已确认':'待核对'}));

  return <section className={styles.workspace} data-edu-domain="" data-testid="mock-exam-workspace" aria-label="模考汇编">
    <header className={styles.heading}><div><h2>模考汇编</h2><p>查看年度目录、原件与核对版本。</p></div></header>
    <div className={styles.toolbar}>
      <SearchField className={styles.search} variant="secondary" aria-label="查找模考汇编" value={search} onChange={changeSearch}>
        <SearchField.Group><SearchField.SearchIcon/><SearchField.Input placeholder="查找年份、学科或年级" maxLength={200}
          data-testid="mock-exam-workspace-search"/><SearchField.ClearButton aria-label="清除查找"/></SearchField.Group>
      </SearchField>
    </div>
    {error&&<p role="alert" className={styles.error}>{error} <Button variant="ghost" size="sm" onPress={reload}>重新读取</Button></p>}
    <div className={styles.columns} data-detail-open={Boolean(selection)}>
      <div>
        <ResourceTable label="年度汇编列表" typeLabel="版本" className={styles.catalogue} rows={rows} selected={selection?.id}
          onSelect={open} testPrefix="mock-exam-result" empty={loading?<p role="status">正在读取年度目录…</p>:error?null:
            <LibraryEmpty title={search?'没有匹配的汇编':'还没有模考汇编'}
              description={search?'请修改查找条件。':'在「问小智」说明需要整理的年份、年级和学科。'}/>}/>
        <div className={styles.actions}>
          {previous.length>0&&<Button variant="ghost" size="sm" isDisabled={loading} onPress={()=>{
            setCursor(previous.at(-1));setPrevious(old=>old.slice(0,-1));
          }}>上一页</Button>}
          {page?.nextCursor&&<Button variant="ghost" size="sm" onPress={()=>{
            setPrevious(old=>[...old,cursor]);setCursor(page.nextCursor!);
          }}>下一页</Button>}
        </div>
      </div>
      {selection&&<div className={styles.detail}>
        <Button variant="ghost" size="sm" onPress={reset}>收起目录</Button>
        <MockExamDetail key={selection.sessionId+':'+selection.id} reference={selection} onRefresh={()=>setRefresh(value=>value+1)}/>
      </div>}
    </div>
  </section>;
}

function MockExamDetail({reference,onRefresh}:{reference:MockExamCatalogRef;onRefresh:()=>void}) {
  const navigation=useDesktopNavigation();
  const [catalog,setCatalog]=useState<MockExamCatalog>(),[problem,setProblem]=useState(''),[revision,reload]=useState(0);
  useEffect(()=>{
    let alive=true;
    setProblem('');
    void (async()=>{
      try {
        const response=await window.omniEdu?.reviewMockExamCatalog({schemaVersion:MOCK_EXAM_SCHEMA,...reference});
        if(!alive)return;
        if(response?.ok)setCatalog(response.value);
        else setProblem(response?.message||'目录暂时无法读取。');
      }catch{if(alive)setProblem('目录暂时无法读取。');}
    })();
    return()=>{alive=false;};
  },[reference.id,reference.sessionId,revision]);
  if(problem)return <p role="alert">{problem} <Button variant="ghost" size="sm" onPress={()=>reload(value=>value+1)}>重试</Button></p>;
  if(!catalog)return <p role="status">正在打开目录…</p>;
  return <section data-testid="mock-exam-detail" data-catalog-id={reference.id} aria-label="年度目录详情">
    <div className={styles.actions}>
      <Button variant="secondary" size="sm" data-testid="mock-exam-origin-conversation" onPress={()=>navigation.navigate({view:'ai',
        sessionId:reference.sessionId,mockExam:reference})}>查看来源对话</Button>
      {catalog.summary.state==='confirmed'&&<MockExamExportActions catalog={catalog.summary} sessionId={reference.sessionId}/> }
    </div>
    <TaskArtifactRelations query={{schemaVersion:1,kind:'artifact_tasks',sessionId:reference.sessionId,artifactId:reference.id}}/>
    <PiMockExamCatalog summary={catalog.summary} sessionId={reference.sessionId} disabled={false} initialCatalog={catalog}
      startOpen showHistory onRefresh={async()=>{onRefresh();reload(value=>value+1);}}/>
  </section>;
}
