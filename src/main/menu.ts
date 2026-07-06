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
        ...(product === 'player'
          ? [
              {
                label: 'Startup Show…',
                click: () => sendToFocusedWindow('player:show-startup-panel')
              },
              { type: 'separator' as const }
            ]
          : []),
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    {
      label: 'Edit',
      submenu: [
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
