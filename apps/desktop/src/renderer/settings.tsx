import React from 'react';
import ReactDOM from 'react-dom/client';
import {PiSettingsWorkspace} from './components/office/PiSettingsWorkspace';
import {WorkbenchProvider} from './ui-system/WorkbenchState';
import {SettingsCloseGuards} from './components/desktop/SettingsCloseGuards';
import './heroui-styles';
import './ui-system/base.css';
import './styles.css';
import './ui-system/motion/motion.css';

document.documentElement.setAttribute('data-edu-modern','');
document.documentElement.dataset.theme='light';
async function mount(){
  const root=document.getElementById('root')!;
  try{
    if(!window.settingsWindow)throw Error('settings_preload_unavailable');
    await window.settingsWindow.bootstrap();
    ReactDOM.createRoot(root).render(<React.StrictMode><WorkbenchProvider><SettingsCloseGuards><PiSettingsWorkspace standalone onBack={()=>void window.settingsWindow?.close()}/></SettingsCloseGuards></WorkbenchProvider></React.StrictMode>);
  }catch{
    root.replaceChildren();const message=document.createElement('p');message.setAttribute('role','alert');message.textContent='设置未能打开，请关闭窗口后重试。';root.append(message);
  }
}
void mount();
