'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  login:              (email, password) => ipcRenderer.invoke('auth:login', email, password),
  logout:             ()                => ipcRenderer.invoke('auth:logout'),
  getStoredSession:   ()                => ipcRenderer.invoke('auth:getSession'),
  getAttendanceToday: ()                => ipcRenderer.invoke('attendance:today'),
  getBreaksToday:     ()                => ipcRenderer.invoke('breaks:today'),
  checkIn:            ()                => ipcRenderer.invoke('attendance:checkIn'),
  checkOut:           ()                => ipcRenderer.invoke('attendance:checkOut'),
  startBreak:         (type)            => ipcRenderer.invoke('breaks:start', type),
  endBreak:           ()                => ipcRenderer.invoke('breaks:end'),
  submitWfh:          (proofText)       => ipcRenderer.invoke('wfh:submit', proofText),
})
