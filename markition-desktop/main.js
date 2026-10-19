'use strict'

// Electron bundles Node 20 which lacks native WebSocket; shim it for Supabase
if (!global.WebSocket) global.WebSocket = require('ws')

const { app, BrowserWindow, ipcMain } = require('electron')
const path  = require('path')
const fs    = require('fs')

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'))

let supabaseClient = null
let mainWindow     = null

// ── Supabase client (lazy) ────────────────────────────────────
function getSupabase() {
  if (!supabaseClient) {
    const { createClient } = require('@supabase/supabase-js')
    supabaseClient = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { persistSession: false },
    })
  }
  return supabaseClient
}

// ── Session persistence (userData/session.json) ───────────────
function sessionPath() {
  return path.join(app.getPath('userData'), 'markition-session.json')
}

function loadSession() {
  try { return JSON.parse(fs.readFileSync(sessionPath(), 'utf8')) }
  catch { return null }
}

function saveSession(data) {
  fs.writeFileSync(sessionPath(), JSON.stringify(data, null, 2), 'utf8')
}

function clearSession() {
  try { fs.unlinkSync(sessionPath()) } catch {}
}

// ── Token refresh ─────────────────────────────────────────────
async function getValidToken() {
  const session = loadSession()
  if (!session?.access_token) throw new Error('Not signed in. Please log in.')

  const nowSec = Math.floor(Date.now() / 1000)
  // Refresh when within 90 seconds of expiry
  if (session.expires_at && session.expires_at < nowSec + 90) {
    if (!session.refresh_token) { clearSession(); throw new Error('Session expired. Please log in again.') }
    const { data, error } = await getSupabase().auth.refreshSession({ refresh_token: session.refresh_token })
    if (error) { clearSession(); throw new Error('Session expired. Please log in again.') }
    const updated = {
      ...session,
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at:    data.session.expires_at,
    }
    saveSession(updated)
    return updated.access_token
  }
  return session.access_token
}

// ── Generic API call helper ───────────────────────────────────
async function apiCall(method, endpoint, body) {
  const token = await getValidToken()
  const res = await fetch(`${CONFIG.apiBase}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data
}

// ── Window ────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:     440,
    height:    580,
    resizable: false,
    maximizable: false,
    title:     'Markition Attendance',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })
  mainWindow.loadFile('index.html')
  mainWindow.setMenuBarVisibility(false)
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle('auth:login', async (_e, email, password) => {
  try {
    const sb = getSupabase()
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }

    // Fetch full name from profiles table
    const { data: profile } = await sb
      .from('profiles')
      .select('full_name')
      .eq('id', data.user.id)
      .maybeSingle()

    const sessionData = {
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at:    data.session.expires_at,
      user: {
        id:        data.user.id,
        email:     data.user.email,
        full_name: profile?.full_name ?? data.user.email.split('@')[0],
      },
    }
    saveSession(sessionData)
    return { user: sessionData.user }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('auth:logout', () => {
  clearSession()
  return { ok: true }
})

ipcMain.handle('auth:getSession', () => {
  const session = loadSession()
  return session ? { user: session.user } : null
})

ipcMain.handle('attendance:today', async () => {
  try { return await apiCall('GET', '/api/attendance/today') }
  catch (err) { return { error: err.message } }
})

ipcMain.handle('breaks:today', async () => {
  try { return await apiCall('GET', '/api/attendance/breaks/today') }
  catch (err) { return { error: err.message } }
})

ipcMain.handle('attendance:checkIn', async () => {
  try { return await apiCall('POST', '/api/attendance/check-in') }
  catch (err) { return { error: err.message } }
})

ipcMain.handle('attendance:checkOut', async () => {
  try { return await apiCall('POST', '/api/attendance/check-out') }
  catch (err) { return { error: err.message } }
})

ipcMain.handle('breaks:start', async (_e, breakType) => {
  try {
    const res = await apiCall('POST', '/api/attendance/breaks/start', { break_type: breakType })
    console.log('[breaks:start]', breakType, JSON.stringify(res))
    return res
  } catch (err) {
    console.error('[breaks:start] ERROR', err.message)
    return { error: err.message }
  }
})

ipcMain.handle('breaks:end', async () => {
  try {
    const res = await apiCall('POST', '/api/attendance/breaks/end')
    console.log('[breaks:end]', JSON.stringify(res))
    return res
  } catch (err) {
    console.error('[breaks:end] ERROR', err.message)
    return { error: err.message }
  }
})

ipcMain.handle('wfh:submit', async (_e, proofText) => {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const res = await apiCall('POST', '/api/attendance/wfh', { work_date: today, proof_text: proofText })
    console.log('[wfh:submit]', JSON.stringify(res))
    return res
  } catch (err) {
    console.error('[wfh:submit] ERROR', err.message)
    return { error: err.message }
  }
})
