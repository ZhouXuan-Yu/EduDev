import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '@heroui/react';
import { SettingsPage, SettingsStack } from './components/office/hana-settings/SettingsPrimitives';
import { PiConfigHistory } from './components/office/PiConfigHistory';
import { PiConfigDraftRow } from './components/office/PiConfigDraftRow';
import { THINKING_LABELS, type ThinkingChoice } from '../shared/xiaozhi-thinking';
import { XIAOZHI_SETTINGS_ERRORS } from '../shared/xiaozhi-settings';
import type { ConfigWindowView } from '../shared/xiaozhi-config-window';
import type { OrdinaryQuery, OrdinaryUndo } from '../shared/xiaozhi-ordinary-config';
import './heroui-styles';
import './ui-system/base.css';
import styles from './ui-system/config-window.module.css';

function ConfigWindow() {
  const [view, setView] = useState<ConfigWindowView>();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const stamp = useRef(0);

  async function reload(refresh = false, background = false) {
    const request = ++stamp.current;
    if (!background) setLoading(true);
    try {
      const api = window.xiaozhiConfigWindow;
      const result = await (refresh ? api?.refreshModels() : api?.read());
      if (stamp.current !== request) return;
      if (result?.ok) {
        setView(result.value);
        const error = result.value.catalogueError;
        if (!background) setNotice(error ? XIAOZHI_SETTINGS_ERRORS[error] : refresh ? '模型目录已刷新。' : '');
      } else {
        if (result?.error === 'permission_denied') setView(undefined);
        setNotice(result ? XIAOZHI_SETTINGS_ERRORS[result.error] : '普通设置暂时无法读取。');
      }
    } catch {
      if (stamp.current === request) setNotice('普通设置暂时无法读取。');
    } finally {
      if (stamp.current === request) setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    const unsubscribe = window.xiaozhiConfigWindow?.onChange(() => void reload(false, true));
    const onFocus = () => void reload(false, true);
    window.addEventListener('focus', onFocus);
    return () => { stamp.current++; unsubscribe?.(); window.removeEventListener('focus', onFocus); };
  }, []);

  const history = ({ field, cursor }: OrdinaryQuery) => window.xiaozhiConfigWindow!.history(field, cursor);
  const undo = ({ field, operationId, changeId, changeVersion }: OrdinaryUndo) =>
    window.xiaozhiConfigWindow!.undo({ field, operationId, changeId, changeVersion });
  const refreshSaved = () => reload(false, true);
  const thinkingOptions = (choices: ThinkingChoice[]) => choices.map(id => ({ id, label: THINKING_LABELS[id] }));
  return (
    <main data-testid="pi-config-window" data-edu-domain="" className={styles.main} aria-label="小智普通设置">
      <SettingsPage tab="models">
        <SettingsStack>
          <header className={styles.header}><h1>普通设置</h1><p>普通设置从下一次适用的小智运行生效。</p></header>
          {loading&&<p role="status">正在读取设置…</p>}
          {notice&&<p role="status">{notice}</p>}
          {view&&<>
            <PiConfigDraftRow field="default_model" label="默认模型" value={view.defaultModelOverride} version={view.modelVersion}
              options={[{ id: '', label: '跟随当前来源 · ' + view.defaultModel }, ...view.models.map(({ id }) => ({ id, label: id }))]}
              disabled={view.locked} onReload={refreshSaved}/>
            <PiConfigDraftRow field="global_thinking" label="默认思考强度" value={view.globalThinking.choice ?? 'auto'}
              version={view.globalThinking.version} options={thinkingOptions(view.globalThinkingChoices)}
              disabled={view.locked} onReload={refreshSaved}/>
            {view.sessionThinking&&<PiConfigDraftRow field="session_thinking" label="会话思考强度"
              value={view.sessionThinking.choice} version={view.sessionThinking.version}
              options={[{ id: '', label: '跟随全局默认' }, ...thinkingOptions(view.sessionThinkingChoices ?? [])]}
              disabled={view.locked} onReload={refreshSaved}/>}
            <div className={styles.actions}>
              <Button type="button" variant="secondary" isDisabled={loading}
                data-testid="pi-config-window-refresh" onPress={() => void reload(true)}>刷新模型目录</Button>
              <Button type="button" variant="ghost" aria-expanded={historyOpen}
                onPress={() => setHistoryOpen(open => !open)}>最近配置修改</Button>
            </div>
            <PiConfigHistory field="default_model" open={historyOpen} version={view.modelVersion}
              readHistory={history} undoConfig={undo} disabled={view.locked} onUndone={() => void refreshSaved()}/>
            <PiConfigHistory field="global_thinking" open={historyOpen} version={view.globalThinking.version}
              readHistory={history} undoConfig={undo} disabled={view.locked} onUndone={() => void refreshSaved()}/>
            {view.sessionThinking&&<PiConfigHistory field="session_thinking" open={historyOpen}
              version={view.sessionThinking.version} readHistory={history} undoConfig={undo}
              disabled={view.locked} onUndone={() => void refreshSaved()}/>}
          </>}
          {!view&&!loading&&<Button type="button" variant="secondary" onPress={() => void reload()}>重新读取</Button>}
        </SettingsStack>
      </SettingsPage>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><ConfigWindow/></StrictMode>);
