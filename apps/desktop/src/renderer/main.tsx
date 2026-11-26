import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DesktopFrame } from './components/desktop/DesktopFrame';
import { WorkbenchProvider } from './ui-system/WorkbenchState';
import {SettingsWindowBridge} from './ui-system/SettingsWindowBridge';
import './heroui-styles';
import './ui-system/base.css';
import './styles.css';
import './ui-system/motion/motion.css';

document.documentElement.setAttribute('data-edu-modern','');
document.documentElement.dataset.theme='light';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopFrame><WorkbenchProvider><App /><SettingsWindowBridge/></WorkbenchProvider></DesktopFrame>
  </React.StrictMode>,
);
