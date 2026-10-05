import { Button, Spinner } from '@heroui/react';
import { AppLayout } from '../../heroui-pro/components/app-layout';
import './pi-education-workspace.css';
import './pi-workspace-glass.css';

/** Startup never mounts the retired Console, including a failed IPC lookup. */
export function PiRuntimeStartup({ failed, onRetry, onLeave }: {
  failed: boolean; onRetry: () => void; onLeave: () => void;
}) {
  return <div className="ai-console-v2 ai-console-v3 xiaozhi-pi-workspace" data-testid="pi-runtime-startup">
    <AppLayout className="pi-shell" navbar={<div className="ai-chat-header"><strong>小智</strong></div>}>
      <section className="ai-conversation-column">
        <div className="pi-history-note" role={failed ? 'alert' : 'status'} data-testid="pi-runtime-status">
          {!failed && <Spinner size="sm" aria-label="正在准备小智"/>}
          <p>{failed ? '小智暂时无法启动，请重试。你的本地资料和对话已保留。' : '正在准备小智…'}</p>
          {failed && <Button onPress={onRetry} data-testid="pi-runtime-retry">重试</Button>}
          <Button variant="ghost" onPress={onLeave} data-testid="pi-runtime-leave">返回教师工作台</Button>
        </div>
      </section>
    </AppLayout>
  </div>;
}
