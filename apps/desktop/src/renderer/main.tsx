import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DesktopFrame } from './components/desktop/DesktopFrame';
import { WorkbenchProvider } from './ui-system/WorkbenchState';
import './heroui-styles';
import './ui-system/base.css';
import './styles.css';

document.documentElement.setAttribute('data-edu-modern','');
document.documentElement.dataset.theme='light';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopFrame><WorkbenchProvider><App /></WorkbenchProvider></DesktopFrame>
  </React.StrictMode>,
);
