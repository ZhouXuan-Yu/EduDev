import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DesktopFrame } from './components/desktop/DesktopFrame';
import './heroui-styles';
import './styles.css';
import './components/office/native-component-boundary.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopFrame><App /></DesktopFrame>
  </React.StrictMode>,
);
