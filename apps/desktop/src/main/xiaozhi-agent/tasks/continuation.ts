import {lessonRevisionRequest} from '../../education/lesson-revision-request';

/** Explicit resumption points to the current Task without adding another action. */
export function isExplicitTaskContinuation(text:string):boolean {
  const request=text.normalize('NFKC').trim().replace(/[。!]+$/u,'').trimEnd();
  const match=/^(?:请(?:帮我)?\s*)?(?:继续(?:完成)?|接着做|接续|恢复)\s*(?:原(?:来|先)?的?|当前的?|这个|这项|本次的?)\s*任务(.*)$/u.exec(request);
  if(!match)return false;
  const remaining=match[1].trim();
  return !remaining||/^(?:中|里)?\s*(?:的\s*)?(?:(?:还|尚)?(?:未完成|没完成|没有完成|没做完)|(?:剩下|剩余|余下))\s*(?:的\s*)?(?:工作|内容|步骤|部分)?$/u.test(remaining);
}

/** A new teacher message may continue an unfinished task, never grant an old approval. */
export function isTaskContinuation(text:string):boolean {
  const value = text.trim();
  return isExplicitTaskContinuation(value)
    || /^(可以|继续|好的|好|行|没问题|接着做|继续完成|继续吧|就这样)[！!。\s]*$/u.test(value)
    || /^(?:请)?(?:继续)?(?:向|给|在)?(?:刚才|上一个|之前|先前|原来)的?终端(?:中|里)?(?:输入|发送|执行|运行|继续|停止|结束|关闭|调整)/u.test(value);
}
/** Explicit revision language retains source context; latest message owns criteria. */
export function isTaskAmendment(text:string):boolean {
  return !/新任务|换个话题|另外一件/u.test(text)
    &&/^(?:请)?(?:改成|改为|修改|调整|只改|仅改|只修改|只把|其他.*照旧|保持其他)|把.+改(?:成|为)/u.test(text.trim());
}

/** Revisions that point at the current work can keep its task identity. */
export function isBoundTaskAmendment(text:string):boolean {
  const value=text.trim();
  if(/新任务|另起|新建|换个话题|另外一件/u.test(value)||/^(?:请问[，,]?\s*)?(?:为什么|为何|怎么回事|什么|是否|有没有)/u.test(value))return false;
  const currentChange=value.match(/^(?:请)?(?:继续|接着|接续)(?:当前|这个|本次)的?任务[，,。]\s*(.+)$/su)?.[1];
  if(currentChange&&/^(?:请)?(?:只|仅)?(?:把|将|改为|改成|修改|调整|修订|替换|删去|增加)/u.test(currentChange))return true;
  // Production admission separately verifies that the exact lesson belongs to the current task.
  if(value.includes('《')&&lessonRevisionRequest(value)?.title)return true;
  const target=/(?:刚才|之前|原来|这份|原版|目前的|当前的|在此基础上|其他.{0,12}照旧)/u.test(value);
  if(isTaskAmendment(value)&&(target||/^(?:请)?(?:改成|改为|只改|仅改|只把|只修改)/u.test(value)))return true;
  return target&&/^(?:请)?(?:把|将|对|在|给|帮我|继续)/u.test(value)&&/(?:补充|加上|增加|删去|去掉|替换|改成|改为)/u.test(value);
}

export function isTaskFollowUp(text:string):boolean {
  return isTaskContinuation(text)||isBoundTaskAmendment(text);
}
