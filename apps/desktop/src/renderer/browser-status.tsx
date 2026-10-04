import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Spinner} from '@heroui/react';
import {Globe,TriangleAlert} from 'lucide-react';
import {EmptyState} from './heroui-pro/components/empty-state';
import './heroui-pro/heroui-pro.min.css';
import './heroui-pro/heroui-oss.min.css';
import './browser-status.css';

const messages:Record<string,[string,string]>={
 loading:['正在打开网页','正在连接公开网站，请稍候。'],
 dns_blocked:['网页解析受阻','系统解析返回了代理虚拟地址。请在小智的联网设置中选择“自动”或“阿里公共 DNS”，然后重试。'],
 permission_denied:['无法打开这个地址','这个地址不属于允许访问的公开网页。请使用公开网站地址。'],
 timeout:['连接超时','网站未在规定时间内响应。请稍后重试或选择其他来源。'],
 cancelled:['已停止打开网页','本次网页加载已停止。可以发送新的任务继续。'],
 network:['网页未能打开','连接失败，网站可能暂时不可用。请检查网络后重试或选择其他来源。'],
};
function Status(){const[state,setState]=useState(()=>location.hash.slice(1)||'loading');useEffect(()=>{const change=()=>setState(location.hash.slice(1));addEventListener('hashchange',change);return()=>removeEventListener('hashchange',change);},[]);const[title,description]=messages[state]||messages.network;
 return <main data-testid="browser-load-state" data-state={state} aria-live="polite"><EmptyState><EmptyState.Header><EmptyState.Media variant="icon">{state==='loading'?<Spinner aria-label="正在加载网页"/>:state==='cancelled'?<Globe size={28}/>:<TriangleAlert size={28}/>}</EmptyState.Media><EmptyState.Title>{title}</EmptyState.Title><EmptyState.Description>{description}</EmptyState.Description></EmptyState.Header></EmptyState></main>;
}
createRoot(document.getElementById('root')!).render(<Status/>);
