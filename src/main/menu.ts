import { app, BrowserWindow, Menu, shell } from 'electron'
import {
  APP_COPYRIGHT,
  APP_EDITOR_NAME,
  APP_NAME,
  APP_PLAYER_NAME,
  APP_TAGLINE,
  type Product
} from '@shared/appInfo'

export type AppProduct = Product

function sendToFocusedWindow(channel: string): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send(channel)
}

export function configureAboutPanel(product: AppProduct): void {
  const applicationName = product === 'editor' ? APP_EDITOR_NAME : APP_PLAYER_NAME
  app.setAboutPanelOptions({
    applicationName,
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: APP_COPYRIGHT,
    credits: APP_TAGLINE,
    authors: ['PixelForge'],
    website: 'https://pixelforge.app'
  })
}

export function setupAppMenu(product: AppProduct): void {
  configureAboutPanel(product)

  const productName = product === 'editor' ? APP_EDITOR_NAME : APP_PLAYER_NAME
  const isMac = process.platform === 'darwin'

  const helpSubmenu: Electron.MenuItemConstructorOptions[] = [
    {
      label: `About ${APP_NAME}`,
      click: () => sendToFocusedWindow('app:show-about')
    },
    { type: 'separator' },
    {
      label: 'Keyboard Shortcuts',
      accelerator: 'CmdOrCtrl+/',
      click: () => sendToFocusedWindow('app:show-shortcuts')
    },
    { type: 'separator' },
    {
      label: 'Learn more…',
      click: () => void shell.openExternal('https://pixelforge.app')
    }
  ]

  const editorFileItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'New',
      accelerator: 'CmdOrCtrl+N',
      click: () => sendToFocusedWindow('app:new-project')
    },
    {
      label: 'Open…',
      accelerator: 'CmdOrCtrl+O',
      click: () => sendToFocusedWindow('app:open-project')
    },
    { type: 'separator' },
    {
      label: 'Save',
      accelerator: 'CmdOrCtrl+S',
      click: () => sendToFocusedWindow('app:save-project')
    },
    {
      label: 'Save As…',
      accelerator: 'Shift+CmdOrCtrl+S',
      click: () => sendToFocusedWindow('app:save-project-as')
    }
  ]

  const playerFileItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Open Show…',
      accelerator: 'CmdOrCtrl+O',
      click: () => sendToFocusedWindow('player:open-show')
    },
    {
      label: 'Startup Show…',
      click: () => sendToFocusedWindow('player:show-startup-panel')
    }
  ]

  const editorEditSubmenu: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Undo',
      accelerator: 'CmdOrCtrl+Z',
      click: () => sendToFocusedWindow('app:edit-undo')
    },
    {
      label: 'Redo',
      accelerator: 'Shift+CmdOrCtrl+Z',
      click: () => sendToFocusedWindow('app:edit-redo')
    },
    { type: 'separator' },
    {
      label: 'Cut',
      accelerator: 'CmdOrCtrl+X',
      click: () => sendToFocusedWindow('app:edit-cut')
    },
    {
      label: 'Copy',
      accelerator: 'CmdOrCtrl+C',
      click: () => sendToFocusedWindow('app:edit-copy')
    },
    {
      label: 'Paste',
      accelerator: 'CmdOrCtrl+V',
      click: () => sendToFocusedWindow('app:edit-paste')
    },
    {
      label: 'Select All',
      accelerator: 'CmdOrCtrl+A',
      click: () => sendToFocusedWindow('app:edit-select-all')
    }
  ]

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: productName,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        ...(product === 'player' ? playerFileItems : editorFileItems),
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    {
      label: 'Edit',
      submenu: product === 'editor' ? editorEditSubmenu : [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Help',
      submenu: helpSubmenu
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
