import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { FileText, FolderOpen, Search, CircleCheck, Play, RotateCcw } from 'lucide-react';
import { ChainOfThought } from '../heroui-pro/components/chain-of-thought';
import { ChatMessage } from '../heroui-pro/components/chat-message';
import { PromptInput } from '../heroui-pro/components/prompt-input';
import { AgentTraceStreaming } from './OfficialTraceReference';
import { StreamingSample } from './StreamingSample';

const steps = [
 {text:'我先核对资料里的教学目标，再整理成一份课堂练习。'},
 {tool:'查看已发送附件',icon:FolderOpen},
 {text:'已找到你提供的教学资料，接下来核对题目条件与来源。'},
 {tool:'读取教学资料.txt',icon:FileText},
 {tool:'检索已确认题目',icon:Search},
 {text:'题目与教学目标已核对。我会保留答案和来源，供你最后确认。'}
] as const;
export function ProcessPreview() {
 const [tab,setTab]=useState<'flow'|'official'>('flow');
 const [count,setCount]=useState(0),[playing,setPlaying]=useState(false),[expanded,setExpanded]=useState(false);
 const [draft,setDraft]=useState('');
 const [answerStreaming,setAnswerStreaming]=useState(false);
 const finished=count>steps.length;
 useEffect(()=>{if(!playing)return;const timer=setTimeout(()=>setCount(n=>n+1),900);return()=>clearTimeout(timer);},[playing,count]);
 useEffect(()=>{if(finished){setPlaying(false);setExpanded(false);setAnswerStreaming(true);}},[finished]);
 function restart(){setCount(0);setExpanded(false);setAnswerStreaming(false);setPlaying(true);}
 const process=<div className="review-process-list" data-testid="review-process-content">
   {steps.slice(0,Math.min(count,steps.length)).map((step,i)=>'text' in step
    ? <ChatMessage.Assistant key={i}><ChatMessage.Body><ChatMessage.Content><p>{step.text}</p></ChatMessage.Content></ChatMessage.Body></ChatMessage.Assistant>
    : <div className="review-tool-row" key={i}><step.icon size={16}/><span>{step.tool}</span><CircleCheck size={14}/></div>)}
 </div>;
 return <section className="review-chat" aria-label="对话交互样张">
  <div className="review-compare-bar">
   <div><Button variant={tab==='flow'?'secondary':'ghost'} onPress={()=>setTab('flow')}>产品时序样张</Button><Button variant={tab==='official'?'secondary':'ghost'} onPress={()=>setTab('official')}>原厂 Agent Trace Streaming</Button></div>
   {tab==='flow'&&<Button onPress={restart}>{count?<RotateCcw size={16}/>:<Play size={16}/>}播放完整过程</Button>}
  </div>
  {tab==='official'?<div className="review-official"><p className="review-caption">官方示例原样：只移动 import 路径。固定420px、多块时间轴、默认展开与原厂动画均保留，尚未接入小智。</p><AgentTraceStreaming/></div>:
  <><div className="review-transcript">
    <ChatMessage.User><ChatMessage.Bubble>请根据这份资料，整理一份七年级一元一次方程课堂练习。</ChatMessage.Bubble></ChatMessage.User>
    {finished?<ChainOfThought isExpanded={expanded} onExpandedChange={setExpanded} data-testid="review-sealed-process">
      <ChainOfThought.Trigger>用时 6 秒</ChainOfThought.Trigger>
      <ChainOfThought.Content>{process}</ChainOfThought.Content>
     </ChainOfThought>:<div className="review-live-process" data-testid="review-live-process">
      <p className="review-caption">{count?'正在处理教学任务':'点击“播放完整过程”查看运行、收起和正文交接。'}</p>{process}
     </div>}
    {finished&&<ChatMessage.Assistant data-testid="review-final-answer"><ChatMessage.Body><ChatMessage.Content>
      <StreamingSample active={answerStreaming} onComplete={()=>setAnswerStreaming(false)} text={'这份练习从等式的基本性质入手，再过渡到去括号和移项。先请学生说出每一步保持等式成立的理由，然后独立完成三道题。\n\n建议把 3(2x - 1) = 15 作为课堂讨论题：既可以先去括号，也可以先将等式两边同时除以 3。比较两种写法，可以帮助学生理解运算步骤的依据。\n\n练习题与答案可以放在教学文件中继续编辑，核对后再交给学生。'}/>
    </ChatMessage.Content></ChatMessage.Body></ChatMessage.Assistant>}
  </div>
  <div className="review-composer">
   <PromptInput value={draft} onValueChange={setDraft} onSubmit={restart} status={playing||answerStreaming?'streaming':'ready'} onStop={()=>{setPlaying(false);setAnswerStreaming(false);}}>
    <PromptInput.Shell><PromptInput.Content><PromptInput.TextArea placeholder="给小智一个教学任务，或者直接提问…" /></PromptInput.Content>
      <PromptInput.Toolbar><PromptInput.ToolbarStart><PromptInput.Action aria-label="添加资料" tooltip="样张不上传资料"><FileText size={18}/></PromptInput.Action></PromptInput.ToolbarStart>
       <PromptInput.ToolbarEnd><span className="review-caption">DeepSeek</span><PromptInput.Send aria-label={playing?'停止演示':'播放演示'}/></PromptInput.ToolbarEnd>
      </PromptInput.Toolbar>
    </PromptInput.Shell>
   </PromptInput>
  </div></>}
 </section>;
}
