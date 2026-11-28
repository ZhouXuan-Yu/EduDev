import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Spinner} from '@heroui/react';
import {Globe,TriangleAlert} from 'lucide-react';
import {EmptyState} from './heroui-pro/components/empty-state';
import './heroui-styles';
import {BROWSER_CHROME_ERRORS} from '../shared/xiaozhi-browser';

import './ui-system/browser.css';
document.documentElement.dataset.theme='light';

const messages:Record<string,[string,string]>={
 blank:['新标签页','在上方输入网址。'],
 loading:['正在打开网页','正在连接公开网站，请稍候。'],
 dns_blocked:['网页解析受阻',BROWSER_CHROME_ERRORS.dns_blocked],
 permission_denied:['当前操作受限',BROWSER_CHROME_ERRORS.permission_denied],
 local_address:['本机或局域网地址',BROWSER_CHROME_ERRORS.local_address],
 unsupported_address:['无法在浏览器打开',BROWSER_CHROME_ERRORS.unsupported_address],
 unsupported_port:['网页端口不可用',BROWSER_CHROME_ERRORS.unsupported_port],
 protected_url:['请在站点内登录',BROWSER_CHROME_ERRORS.protected_url],
 scope_denied:['当前任务限制访问',BROWSER_CHROME_ERRORS.scope_denied],
 site_scope:['此标签保存了本站登录',BROWSER_CHROME_ERRORS.site_scope],
 invalid_input:['网址格式有误',BROWSER_CHROME_ERRORS.invalid_input],
 timeout:['连接超时','网站未在规定时间内响应。请稍后重试或选择其他来源。'],
 cancelled:['已停止打开网页','本次网页加载已停止。可以发送新的任务继续。'],
 network:['网页未能打开','连接失败，网站可能暂时不可用。请检查网络后重试或选择其他来源。'],
};
function Status(){const[state,setState]=useState(()=>location.hash.slice(1)||'loading');useEffect(()=>{const change=()=>setState(location.hash.slice(1));addEventListener('hashchange',change);return()=>removeEventListener('hashchange',change);},[]);const[title,description]=messages[state]||messages.network;
 return <main className="edu-browser-state" data-heroui-native="" data-theme="light" data-testid="browser-load-state" data-state={state} aria-live="polite"><EmptyState><EmptyState.Header><EmptyState.Media variant="icon">{state==='loading'?<Spinner aria-label="正在加载网页"/>:state==='cancelled'?<Globe size={28}/>:<TriangleAlert size={28}/>}</EmptyState.Media><EmptyState.Title>{title}</EmptyState.Title><EmptyState.Description>{description}</EmptyState.Description></EmptyState.Header>{state!=='loading'&&state!=='blank'&&<p className="browser-recovery-note">可修改上方网址，或刷新当前页重试。</p>}</EmptyState></main>;
}
createRoot(document.getElementById('root')!).render(<Status/>);
