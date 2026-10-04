export type DesktopMenu = 'file' | 'edit' | 'view' | 'help';
export type DesktopCommand = 'back' | 'forward' | 'new-chat' | 'settings' | 'sidebar' | 'files';
export type DesktopChromeState = { enabled: boolean; platform: string; zoomFactor: number; maximized: boolean; height: number };
export const DESKTOP_COMMANDS: readonly DesktopCommand[] = ['back','forward','new-chat','settings','sidebar','files'];
