import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { OmniEduStore } from './db';

let store: OmniEduStore;

app.setName('OmniEduAgent');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: 'Omni-Edu Agent',
    backgroundColor: '#eef1f3',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  store = new OmniEduStore(join(app.getPath('userData'), 'OmniEduData'));
  await store.init();

  ipcMain.handle('app:bootstrap', () => store.init());
  ipcMain.handle('app:getDataRoot', () => store.getDataRoot());
  ipcMain.handle('students:list', (_event, query: string) => store.listStudents(query));
  ipcMain.handle('students:create', (_event, input) => store.createStudent(input));
  ipcMain.handle('students:update', (_event, id: string, input) => store.updateStudent(id, input));
  ipcMain.handle('students:archive', (_event, id: string) => store.archiveStudent(id));
  ipcMain.handle('students:openFolder', (_event, id: string) => shell.openPath(join(store.getDataRoot(), 'students', id)));
  ipcMain.handle('students:export', async (_event, id: string) => {
    const result = await dialog.showOpenDialog({
      title: '选择学生档案导出位置',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return store.exportStudentArchive(id, result.filePaths[0]);
  });
  ipcMain.handle('records:list', (_event, studentId: string, filters) => store.listRecords(studentId, filters));
  ipcMain.handle('records:create', (_event, input) => store.createRecord(input));
  ipcMain.handle('records:update', (_event, recordId: string, input) => store.updateRecord(recordId, input));
  ipcMain.handle('attachments:import', async (_event, studentId: string, recordId: string) => {
    const result = await dialog.showOpenDialog({
      title: '选择要复制到学生档案的附件',
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled) return { status: 'canceled', records: store.listRecords(studentId), items: [] };
    return store.importAttachments(studentId, recordId, result.filePaths);
  });
  ipcMain.handle('attachments:show', (_event, filePath: string) => shell.showItemInFolder(filePath));
  ipcMain.handle('reports:generate', (_event, input) => store.generateReview(input));
  ipcMain.handle('reports:update', (_event, id: string, contentMd: string, parentSummary?: string) => store.updateReport(id, contentMd, parentSummary));
  ipcMain.handle('reports:list', (_event, studentId: string) => store.listReports(studentId));
  ipcMain.handle('search:all', (_event, keyword: string) => store.search(keyword));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
