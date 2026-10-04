import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DesktopFrame } from './components/desktop/DesktopFrame';
import './heroui-pro/heroui-oss.min.css';
import './heroui-pro/heroui-pro.min.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopFrame><App /></DesktopFrame>
  </React.StrictMode>,
);
