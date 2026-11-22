import {useEffect, useRef, useState} from 'react';
import type {WorkbenchQuery, WorkbenchSummary} from '../../../../shared/xiaozhi-workbench';

export async function readWorkbenchSummary(query: WorkbenchQuery) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([window.omniEdu?.getXiaozhiWorkbenchSummary(query),
      new Promise<never>((_resolve, reject) => {timer=setTimeout(()=>reject(Error('summary_timeout')),10000);})]);
  } finally {clearTimeout(timer);}
}

/** Metadata only. Selection changes fence both fulfilled and rejected old reads. */
export function useWorkbenchSummary(query: WorkbenchQuery, refreshKey?: number) {
  const key = JSON.stringify(query), epoch = useRef(0);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<{key: string; value?: WorkbenchSummary; error?: string; loading: boolean}>({key, loading: true});
  useEffect(() => {
    const ticket = ++epoch.current;
    setState({key, loading: true});
    void (async () => {
      try {
        const result = await readWorkbenchSummary(JSON.parse(key) as WorkbenchQuery);
        if (ticket !== epoch.current) return;
        if (!result?.ok) {setState({key, loading: false, error: result?.error === 'changed' ? '记录已变化，请重新读取。' : '本地索引暂不可用，请重试。'}); return;}
        if (result.value.kind !== query.kind) throw Error('unexpected_summary');
        setState({key, loading: false, value: result.value});
      } catch {if (ticket === epoch.current) setState({key, loading: false, error: '本地索引未读取，请重试。'});}
    })();
    return () => {epoch.current++;};
  }, [key, refresh, refreshKey]);
  return {loading: state.key !== key || state.loading, value: state.key === key ? state.value : undefined,
    error: state.key === key ? state.error : undefined, reload: () => setRefresh(value => value + 1)};
}
