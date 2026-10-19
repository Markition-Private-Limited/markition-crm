'use strict'

// ── State ─────────────────────────────────────────────────────
let user         = null
let todayState   = 'not_checked_in' // from /attendance/today: not_checked_in | checked_in | checked_out
let attRecord    = null
let shift        = null
let openBreak    = null
let breakUsage   = { long_break: { used: 0, limit: 1, can_start: false }, short_break: { used: 0, limit: 2, can_start: false } }
let breakTimer   = null  // interval for elapsed break time display
let errorTimer   = null
let workLocation = 'office'  // 'office' | 'wfh'
let wfhSubmitted = false      // true once WFH submitted today

// ── Derived display state ─────────────────────────────────────
function displayState() {
  if (openBreak)                          return 'on_break'
  if (todayState === 'checked_in')        return 'checked_in'
  if (todayState === 'checked_out')       return 'checked_out'
  return 'not_checked_in'
}

// ── Helpers ───────────────────────────────────────────────────
function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function elapsedMin(startIso) {
  return Math.floor((Date.now() - new Date(startIso).getTime()) / 60000)
}

function fmtBreakType(type) {
  return type === 'long_break' ? 'Long break' : 'Short break'
}

function todayFmt() {
  return new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Views ─────────────────────────────────────────────────────
function showView(name) {
  document.getElementById('loading-overlay').classList.add('hidden')
  document.getElementById('login-view').classList.toggle('hidden', name !== 'login')
  document.getElementById('home-view').classList.toggle('hidden',  name !== 'home')
}

// ── Error display ─────────────────────────────────────────────
function showError(msg, where = 'home') {
  console.error('[markition error]', where, msg)
  const el = document.getElementById(where === 'login' ? 'login-error' : 'home-error')
  el.textContent = msg
  el.classList.remove('hidden')
  // No auto-dismiss — stays until clearError() or next successful action
  if (errorTimer) { clearTimeout(errorTimer); errorTimer = null }
}

function clearError() {
  document.getElementById('home-error').classList.add('hidden')
  document.getElementById('login-error').classList.add('hidden')
}

// ── Render home screen ────────────────────────────────────────
function renderHome() {
  const state = displayState()

  // User / date
  document.getElementById('user-name').textContent = user?.full_name ?? '—'
  document.getElementById('today-date').textContent = todayFmt()

  // Status dot + label + detail
  const dot   = document.getElementById('status-dot')
  const label = document.getElementById('status-label')
  const detail = document.getElementById('status-detail')

  dot.className = 'status-dot'

  if (state === 'not_checked_in') {
    dot.classList.add('dot-gray')
    label.textContent = 'Not checked in'
    detail.textContent = shift
      ? `Shift: ${fmt(shift.start_time ? `2000-01-01T${shift.start_time}` : null)} – ${fmt(shift.end_time ? `2000-01-01T${shift.end_time}` : null)}`
      : 'No shift assigned'
  } else if (state === 'checked_in') {
    dot.classList.add('dot-green')
    label.textContent = 'Checked in'
    const punc = attRecord?.punctuality
    const punctLabel = punc === 'late' ? 'Late' : punc === 'early' ? 'Early' : 'On time'
    detail.textContent = `${fmt(attRecord?.check_in_at)} · ${punctLabel}`
  } else if (state === 'on_break') {
    dot.classList.add('dot-amber')
    const elapsed = openBreak ? elapsedMin(openBreak.started_at) : 0
    const limit = openBreak?.break_type === 'long_break' ? 40 : 10
    label.textContent = `On break · ${elapsed} min`
    detail.textContent = `${fmtBreakType(openBreak?.break_type ?? '')} · started ${fmt(openBreak?.started_at)} · limit ${limit} min`
  } else if (state === 'checked_out') {
    dot.classList.add('dot-blue')
    label.textContent = 'Checked out'
    detail.textContent = `${fmt(attRecord?.check_out_at)} · ${attRecord?.shift_completed ? 'Full shift completed' : 'Early departure'}`
  }

  // Primary action button
  const primaryBtn = document.getElementById('primary-btn')
  primaryBtn.className = 'btn-primary'
  primaryBtn.disabled = false

  if (state === 'not_checked_in') {
    primaryBtn.textContent = 'Check In'
    primaryBtn.classList.add('success')
  } else if (state === 'checked_in') {
    primaryBtn.textContent = 'Check Out'
    primaryBtn.classList.add('danger')
  } else if (state === 'on_break') {
    primaryBtn.textContent = 'End Break'
    primaryBtn.classList.add('warning')
  } else {
    primaryBtn.textContent = 'Checked out'
    primaryBtn.classList.add('muted')
    primaryBtn.disabled = true
  }

  // Break buttons
  const lu = breakUsage.long_break
  const su = breakUsage.short_break

  const longBtn  = document.getElementById('long-break-btn')
  const shortBtn = document.getElementById('short-break-btn')

  document.getElementById('long-break-usage').textContent  = `${lu.used} of ${lu.limit} used`
  document.getElementById('short-break-usage').textContent = `${su.used} of ${su.limit} used`

  longBtn.disabled  = !(state === 'checked_in' && lu.can_start)
  shortBtn.disabled = !(state === 'checked_in' && su.can_start)

  // Highlight the active break type button
  longBtn.classList.toggle('break-active',  state === 'on_break' && openBreak?.break_type === 'long_break')
  shortBtn.classList.toggle('break-active', state === 'on_break' && openBreak?.break_type === 'short_break')

  // Location toggle — hide once checked out; lock once WFH submitted
  const locRow   = document.getElementById('location-row')
  const wfhSt    = document.getElementById('wfh-status')
  const locOffice = document.getElementById('loc-office')
  const locWfh    = document.getElementById('loc-wfh')

  locRow.classList.toggle('hidden', state === 'checked_out')

  locOffice.className = 'loc-btn' + (workLocation === 'office' ? ' active' : '')
  locWfh.className    = 'loc-btn' + (workLocation === 'wfh' ? ' wfh-active' : '')

  if (wfhSubmitted) {
    locOffice.disabled = true
    locWfh.disabled    = true
    wfhSt.textContent  = 'WFH request submitted — pending admin approval'
    wfhSt.classList.remove('hidden')
  } else {
    locOffice.disabled = false
    locWfh.disabled    = false
    wfhSt.classList.add('hidden')
  }

  // Shift info
  const shiftEl = document.getElementById('shift-info')
  if (shift) {
    shiftEl.textContent = `Shift: ${shift.start_time?.slice(0, 5)} – ${shift.end_time?.slice(0, 5)}`
    shiftEl.classList.remove('hidden')
  } else {
    shiftEl.classList.add('hidden')
  }

  // Reset break elapsed timer
  if (breakTimer) clearInterval(breakTimer)
  if (state === 'on_break' && openBreak) {
    breakTimer = setInterval(() => {
      const elapsed = elapsedMin(openBreak.started_at)
      document.getElementById('status-label').textContent = `On break · ${elapsed} min`
    }, 30_000)
  }
}

// ── Refresh state from API ────────────────────────────────────
async function refreshState() {
  const [todayRes, breaksRes] = await Promise.all([
    window.api.getAttendanceToday(),
    window.api.getBreaksToday(),
  ])

  if (todayRes?.error) {
    if (todayRes.error.includes('Not signed') || todayRes.error.includes('Session expired')) {
      showView('login')
      return
    }
    showError(todayRes.error)
    return
  }

  if (breaksRes?.error) { showError(breaksRes.error); return }

  attRecord  = todayRes.record  ?? null
  shift      = todayRes.shift   ?? null
  todayState = todayRes.state   ?? 'not_checked_in'
  openBreak  = breaksRes.open_break  ?? null
  breakUsage = breaksRes.usage ?? breakUsage

  clearError()
  renderHome()
}

// ── Actions ───────────────────────────────────────────────────
async function handlePrimaryAction() {
  const state = displayState()
  document.getElementById('primary-btn').disabled = true

  let res
  if (state === 'not_checked_in') res = await window.api.checkIn()
  else if (state === 'checked_in') res = await window.api.checkOut()
  else if (state === 'on_break')   res = await window.api.endBreak()
  else return

  console.log('[primary-action]', state, JSON.stringify(res))
  if (res?.error) { showError(res.error); document.getElementById('primary-btn').disabled = false; return }
  await refreshState()
}

async function handleBreakStart(breakType) {
  document.getElementById('long-break-btn').disabled  = true
  document.getElementById('short-break-btn').disabled = true

  console.log('[break:start] requesting', breakType)
  const res = await window.api.startBreak(breakType)
  console.log('[break:start] response', JSON.stringify(res))
  if (res?.error) { showError(res.error); document.getElementById('long-break-btn').disabled = false; document.getElementById('short-break-btn').disabled = false; return }
  await refreshState()
}

// ── Login ─────────────────────────────────────────────────────
async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value

  if (!email || !password) { showError('Enter your email and password.', 'login'); return }

  const btn = document.getElementById('login-btn')
  btn.disabled = true
  btn.textContent = 'Signing in…'

  const res = await window.api.login(email, password)

  btn.disabled = false
  btn.textContent = 'Sign In'

  if (res?.error) { showError(res.error, 'login'); return }

  user = res.user
  showView('home')
  renderHome()
  await refreshState()
}

// ── Logout ────────────────────────────────────────────────────
async function handleLogout() {
  if (breakTimer) clearInterval(breakTimer)
  await window.api.logout()
  user = null
  workLocation = 'office'
  wfhSubmitted = false
  showView('login')
}

// ── Location toggle ───────────────────────────────────────────
async function handleLocationToggle(newLoc) {
  if (wfhSubmitted) return
  workLocation = newLoc
  renderHome()

  if (newLoc === 'wfh') {
    const res = await window.api.submitWfh('Working from home today')
    console.log('[wfh:submit] response', JSON.stringify(res))
    if (res?.error) {
      // 409 = already submitted, treat as already done
      if (res.error.includes('already') || res.error.includes('409')) {
        wfhSubmitted = true
      } else {
        showError(res.error)
        workLocation = 'office'
      }
    } else {
      wfhSubmitted = true
    }
    renderHome()
  }
}

// ── Event listeners ───────────────────────────────────────────
document.getElementById('login-btn').addEventListener('click', handleLogin)
document.getElementById('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin()
})

document.getElementById('logout-btn').addEventListener('click', handleLogout)
document.getElementById('primary-btn').addEventListener('click', handlePrimaryAction)
document.getElementById('long-break-btn').addEventListener('click',  () => handleBreakStart('long_break'))
document.getElementById('short-break-btn').addEventListener('click', () => handleBreakStart('short_break'))
document.getElementById('loc-office').addEventListener('click', () => handleLocationToggle('office'))
document.getElementById('loc-wfh').addEventListener('click',    () => handleLocationToggle('wfh'))

// ── Init ──────────────────────────────────────────────────────
;(async function init() {
  const session = await window.api.getStoredSession()
  if (!session) { showView('login'); return }

  user = session.user
  showView('home')
  renderHome()
  await refreshState()

  // Refresh state every 5 minutes to stay accurate
  setInterval(refreshState, 5 * 60_000)
})()
