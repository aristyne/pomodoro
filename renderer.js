// Pomodoro logic + UI glue
(() => {
  const { getConfig, saveConfig, closeWindow } = window.electronAPI
  const startBtn = document.getElementById('startBtn')
  const resetBtn = document.getElementById('resetBtn')
  const timerText = document.getElementById('timerText')
  const sessionCounterLabel = document.getElementById('sessionCounter')
  const progressCircle = document.querySelector('.progress')
  const ctx = {
    workLen: 25 * 60,
    breakLen: 5 * 60,
    longBreakLen: 15 * 60,
  }
  let config = {
    theme: 'softLavender',
    sessionMin: 25,
    breakMin: 5,
    longBreakMin: 15,
    sessionsPerCycle: 4,
    sound: true,
    notifications: true,
    autoStartNext: true
  }
  let state = {
    phase: 'work', // work, shortBreak, longBreak
    remaining: 25 * 60,
    workIndex: 1, // 1..4
    timer: null,
    running: false,
  }

  let dotsTotal = 339.292 // approximate circumference for r=54
  let progressOffset = dotsTotal

  function applyBrightness(theme) {
    // apply CSS theme by data-theme on body
    document.body.setAttribute('data-theme', theme)
  }

  function format(n){ const m=Math.floor(n/60); const s=n%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` }

  function updateUI(){
    timerText.textContent = format(state.remaining)
    // update session counter on work phase
    if (state.phase === 'work') {
      sessionCounterLabel.textContent = `Session ${state.workIndex} / ${config.sessionsPerCycle}`
    } else {
      sessionCounterLabel.textContent = ''
    }
    // update ring progress
    const perimeter = 2 * Math.PI * 54
    const total = (state.phase === 'work') ? (config.sessionMin * 60) : (state.phase === 'shortBreak' ? (config.breakMin * 60) : (config.longBreakMin * 60))
    const remainingRatio = state.remaining / total
    const offset = perimeter * (1 - remainingRatio)
    progressCircle.style.strokeDashoffset = offset
  }

  function beep(duration=0.15, freq=440){ try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = freq
      o.type = 'sine'
      const now = ctx.currentTime
      o.start(now)
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(0.5, now + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      o.stop(now + duration + 0.05)
    } catch (e) { /* ignore */ } }

  function notify(title, body){ if (config.notifications && 'Notification' in window){ if (Notification.permission === 'granted') new Notification(title, { body }) ; else if (Notification.permission !== 'denied') Notification.requestPermission(); }} }

  function playEndSound(){ if (config.sound) { beep(0.3, 520); setTimeout(()=>beep(0.5, 660), 120); } }

  function tick(){
    state.remaining--
    updateUI()
    if (state.remaining <= 0){ endPhase() }
    // persist progress
    try {
      localStorage.setItem('pomodoro_progress', JSON.stringify({ phase: state.phase, remaining: state.remaining, workIndex: state.workIndex }))
    } catch (e) { /* ignore */ }
  }

  function endPhase(){
    clearInterval(state.timer)
    state.running = false
    if (state.phase === 'work'){
      // finished a work session
      if (state.workIndex < config.sessionsPerCycle){
        state.phase = 'shortBreak'
        state.remaining = config.breakMin * 60
      } else {
        state.phase = 'longBreak'
        state.remaining = config.longBreakMin * 60
      }
      if (state.workIndex < config.sessionsPerCycle) state.workIndex++
    } else {
      // finished a break
      // After a long break, reset cycle
      state.phase = 'work'
      state.remaining = config.sessionMin * 60
      // reset work index for new cycle
      state.workIndex = 1
    }
    // notify on phase change if we finished a work cycle or a break cycle
    updateUI()
    // auto start next if enabled and next phase is work
    if (config.autoStartNext && state.phase === 'work') {
      startTimer()
    }
  }

  function startTimer(){
    if (state.running) return
    state.running = true
    state.timer = setInterval(tick, 1000)
  }

  function pauseTimer(){ if (state.running){ clearInterval(state.timer); state.running=false } }

  function resetTimer(){
    clearInterval(state.timer)
    state.running = false
    state.phase = 'work'
    state.workIndex = 1
    state.remaining = config.sessionMin * 60
    updateUI()
  }

  // Settings modal toggle
  const settingsBtn = document.getElementById('settingsBtn')
  const settingsPanel = document.getElementById('settingsPanel')
  const closeSettingsBtn = document.getElementById('closeSettings')
  const saveSettingsBtn = document.getElementById('saveSettings')
  const themeSelect = document.getElementById('themeSelect')
  const sessionLenInput = document.getElementById('sessionLen')
  const breakLenInput = document.getElementById('breakLen')
  const longBreakLenInput = document.getElementById('longBreakLen')
  const soundToggle = document.getElementById('soundToggle')
  const notifyToggle = document.getElementById('notifyToggle')
  const autoStartToggle = document.getElementById('autoStartToggle')
  let intentToClose = false

  let confirmVisible = false
  const confirmModal = document.getElementById('confirmModal')
  const confirmYes = document.getElementById('confirmYes')
  const confirmNo = document.getElementById('confirmNo')

  function showConfirm(){ confirmModal.hidden = false; confirmVisible = true }
  function hideConfirm(){ confirmModal.hidden = true; confirmVisible = false }

  // initial
  loadConfig().then(()=>{
    applyTheme(config.theme)
  })

  settingsBtn.addEventListener('click', () => {
    settingsPanel.hidden = false
  })
  closeSettingsBtn.addEventListener('click', ()=>{ settingsPanel.hidden = true })
  saveSettingsBtn.addEventListener('click', async ()=>{
    config.theme = themeSelect.value
    config.sessionMin = parseInt(sessionLenInput.value) || 25
    config.breakMin = parseInt(breakLenInput.value) || 5
    config.longBreakMin = parseInt(longBreakLenInput.value) || 15
    config.sound = !!soundToggle.checked
    config.notifications = !!notifyToggle.checked
    config.autoStartNext = !!autoStartToggle.checked
    updateUI()
    applyTheme(config.theme)
    await saveConfig(config)
    settingsPanel.hidden = true
  })

  themeSelect.addEventListener('change', (e)=>{ applyTheme(e.target.value); config.theme = e.target.value })

  // initial UI wiring
  startBtn.addEventListener('click', ()=>{
    if (!state.running) {
      startTimer()
    }
  })
  resetBtn.addEventListener('click', ()=>{ resetTimer() })

  // close without confirmation by default; show confirm when timer running
  const closeBtn = document.getElementById('closeBtn')
  closeBtn.addEventListener('click', ()=>{
    if (state.running && !intentToClose) { intentToClose = true; showConfirm() } else { closeWindow(); intentToClose = false }
  })

  confirmYes.addEventListener('click', ()=>{ intentToClose = false; hideConfirm(); closeWindow() })
  confirmNo.addEventListener('click', ()=>{ hideConfirm() })

  // initial hide
  settingsPanel.hidden = true
  confirmModal.hidden = true

  // permission request on first load
  if ('Notification' in window) {
    if ( Notification.permission === 'default' ) {
      Notification.requestPermission()
    }
  }

  function applyTheme(name){
    document.body.setAttribute('data-theme', name)
    // update which option is selected
    if (name === 'softLavender') themeSelect?.setAttribute('value','softLavender')
  }
  async function loadConfig(){
    const cfg = await getConfig()
    config = {
      ...config,
      ...cfg
    }
    // reflect in UI
    sessionLenInput.value = String(config.sessionMin || 25)
    breakLenInput.value = String(config.breakMin || 5)
    longBreakLenInput.value = String(config.longBreakMin || 15)
    soundToggle.checked = !!config.sound
    notifyToggle.checked = !!config.notifications
    autoStartToggle.checked = !!config.autoStartNext
    themeSelect.value = config.theme || 'softLavender'
    // initial remaining
    if (config.theme) applyTheme(config.theme)
    if (config.sessionMin) { state.remaining = config.sessionMin * 60 }
    // restore progress if saved
    try {
      const raw = localStorage.getItem('pomodoro_progress')
      if (raw) {
        const p = JSON.parse(raw)
        if (typeof p.phase === 'string') state.phase = p.phase
        if (typeof p.remaining === 'number') state.remaining = p.remaining
        if (typeof p.workIndex === 'number') state.workIndex = p.workIndex
      }
    } catch (e) { /* ignore */ }
  }

  // initialize ring stroke length
  progressCircle.style.strokeDasharray = '339.292'
  progressCircle.style.strokeDashoffset = '339.292'
  updateUI()
})()
