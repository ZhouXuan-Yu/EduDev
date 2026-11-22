import {useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {TASK_API_ERRORS,type TaskView} from '../../../shared/xiaozhi-task';
import type {TaskControlAction,TaskControlInput} from '../../../shared/xiaozhi-task-control';
import {useOfficeSynchronization} from './OfficeSynchronization';

export function PiTaskControls({task,running,showInactive,onRefresh}:{task:TaskView;running:boolean;showInactive:boolean;onRefresh:()=>Promise<void>}) {
    const sync=useOfficeSynchronization(),pending=useRef(false);
    const [busy,setBusy]=useState(false),[confirmationFor,setConfirmationFor]=useState(''),[notice,setNotice]=useState('');
    const owner=running&&task.state==='active'?task.binding:null;
    const canCancel=Boolean(owner)||!running&&showInactive&&['paused','interrupted','review_required'].includes(task.state);
    const scope=owner?`${task.requirementsVersion}:${owner.runId}:${owner.generation}`:`${task.requirementsVersion}:${task.revision}`;
    const confirm=confirmationFor===scope;
    const disabled=busy||sync.blocked;
    async function control(action:TaskControlAction) {
        if(pending.current||sync.isBlocked()||!canCancel||(action==='pause'?!owner:!confirm))return;
        const target={schema:task.schema,sessionId:task.sessionId,taskId:task.id,requirementsVersion:task.requirementsVersion};
        const input:TaskControlInput=owner?{...target,action,owner}:{...target,action:'cancel',revision:task.revision};
        pending.current=true;setBusy(true);setNotice('');
        try {
            const result=await window.omniEdu?.controlXiaozhiTask(input);
            if(!result?.ok)setNotice(result?TASK_API_ERRORS[result.error]:'没能确认操作结果，请重新读取任务。');
            else {setConfirmationFor('');setNotice(action==='pause'?'任务已暂停，可以从这里继续。':'任务已取消，已保存的成果和记录仍可查看。');}
            await onRefresh();
        } catch {setNotice('没能刷新任务状态，请重新读取。');}
        finally {pending.current=false;setBusy(false);}
    }
    if(task.goal)return null;
    return <>
        {canCancel&&<div className="pi-task-review-actions">
            {confirm?<>
                <span>取消后此任务不能继续，已保存的成果会保留。</span>
                <Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>setConfirmationFor('')}>返回</Button>
                <Button size="sm" variant="secondary" isDisabled={disabled} data-testid="pi-task-confirm-cancel" onPress={()=>void control('cancel')}>确认取消</Button>
            </>:<>
                {owner&&<Button size="sm" variant="secondary" isDisabled={disabled} data-testid="pi-task-pause" onPress={()=>void control('pause')}>暂停任务</Button>}
                <Button size="sm" variant="ghost" isDisabled={disabled} data-testid="pi-task-cancel" onPress={()=>setConfirmationFor(scope)}>取消任务</Button>
            </>}
        </div>}
        {busy&&<p role="status">正在保存任务状态…</p>}
        {notice&&<p role="status" className="pi-task-review-notice" data-testid="pi-task-control-notice">{notice}</p>}
    </>;
}
