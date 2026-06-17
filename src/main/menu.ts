import { app, BrowserWindow, Menu, shell } from 'electron'
import {
  APP_COPYRIGHT,
  APP_EDITOR_NAME,
  APP_NAME,
  APP_PLAYER_NAME,
  APP_TAGLINE
} from '@shared/appInfo'
import { formatLicenseMenuSummary } from '@shared/licensing/formatMenuLabel'
import type { LicenseStatus } from '@shared/licensing/types'

export type AppProduct = 'editor' | 'player'

type GetLicenseStatus = () => Promise<LicenseStatus>

const APP_LICENSE_STATUS_ID = 'license-status-app'
const HELP_LICENSE_STATUS_ID = 'license-status-help'

let currentProduct: AppProduct | null = null
let getLicenseStatus: GetLicenseStatus | null = null

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

async function refreshLicenseMenuLabels(): Promise<void> {
  if (currentProduct === null || getLicenseStatus === null) return
  const status = await getLicenseStatus()
  const label = formatLicenseMenuSummary(status, currentProduct)
  const menu = Menu.getApplicationMenu()
  const appItem = menu?.getMenuItemById(APP_LICENSE_STATUS_ID)
  const helpItem = menu?.getMenuItemById(HELP_LICENSE_STATUS_ID)
  if (appItem) appItem.label = label
  if (helpItem) helpItem.label = label
}

export function setupAppMenu(product: AppProduct, getStatus: GetLicenseStatus): void {
  currentProduct = product
  getLicenseStatus = getStatus
  configureAboutPanel(product)

  const productName = product === 'editor' ? APP_EDITOR_NAME : APP_PLAYER_NAME
  const isMac = process.platform === 'darwin'

  const licenseStatusItem = {
    id: APP_LICENSE_STATUS_ID,
    label: 'License: …',
    enabled: false
  }

  const manageLicenseItem = {
    label: 'Manage License…',
    click: () => sendToFocusedWindow('app:show-license')
  }

  const helpSubmenu: Electron.MenuItemConstructorOptions[] = [
    {
      id: HELP_LICENSE_STATUS_ID,
      label: 'License: …',
      enabled: false
    },
    manageLicenseItem,
    { type: 'separator' },
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
              licenseStatusItem,
              manageLicenseItem,
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
  menu.on('menu-will-show', () => {
    void refreshLicenseMenuLabels()
  })
  Menu.setApplicationMenu(menu)
  void refreshLicenseMenuLabels()
}

export function refreshAppMenu(): void {
  void refreshLicenseMenuLabels()
}
