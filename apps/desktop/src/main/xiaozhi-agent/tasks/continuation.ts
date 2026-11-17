/** A new teacher message may continue an unfinished task, never grant an old approval. */
export function isTaskContinuation(text:string):boolean {
  const value = text.trim();
  return /^(可以|继续|好的|好|行|没问题|接着做|继续完成|继续吧|就这样)[！!。\s]*$/u.test(value)
    || /^(?:请)?(?:继续)?(?:向|给|在)?(?:刚才|上一个|之前|先前|原来)的?终端(?:中|里)?(?:输入|发送|执行|运行|继续|停止|结束|关闭|调整)/u.test(value);
}
/** Explicit revision language retains source context; latest message owns criteria. */
export function isTaskAmendment(text:string):boolean {
  return !/新任务|换个话题|另外一件/u.test(text)
    &&/^(?:请)?(?:改成|改为|修改|调整|只改|仅改|只修改|只把|其他.*照旧|保持其他)|把.+改(?:成|为)/u.test(text.trim());
}
