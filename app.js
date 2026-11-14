/* ==========================================================================
   HabitFlow v2 — трекер привычек
   Локальное приложение: привычки, календарь, статистика, награды, блокировка
   ========================================================================== */
(function () {
  'use strict';

  /* ───────────────────────── Константы ───────────────────────── */
  const STORE = 'habitflow_v2';
  const DAY_MS = 86400000;
  const CATEGORIES = {
    health:  { name: 'Здоровье',    icon: '❤' },
    sport:   { name: 'Спорт',       icon: '⚡' },
    study:   { name: 'Учёба',       icon: '📚' },
    work:    { name: 'Работа',      icon: '💼' },
    mind:    { name: 'Осознанность',icon: '🧘' },
    social:  { name: 'Общение',     icon: '💬' },
    creative:{ name: 'Творчество',  icon: '🎨' },
    finance: { name: 'Финансы',     icon: '💰' },
    other:   { name: 'Другое',      icon: '•'  }
  };
  const PRIORITIES = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
  const PERIODS = { daily: 'Ежедневно', weekly: 'Еженедельно', monthly: 'Ежемесячно', custom: 'По дням' };

  /* ───────────────────────── Состояние ───────────────────────── */
  let state = loadState();
  let view = 'today';
  let calCursor = new Date();
  let editingId = null;
  let selectedDays = new Set([1,2,3,4,5]);
  let selectedColor = '#111111';
  let lockTimer = null;
  let lockLeftSec = 0;

  /* ───────────────────────── Утилиты ───────────────────────── */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad = n => String(n).padStart(2, '0');
  const dstr = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const todayStr = () => dstr(new Date());
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const parseTime = v => {
    if (!v) return 0;
    const m = String(v).match(/^(\d{1,2})/);
    return m ? clamp(parseInt(m[1], 10), 0, 23) : 0;
  };
  const toTimeInput = h => (h || h === 0) && h ? pad(h) + ':00' : '';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const s = JSON.parse(raw);
        return {
          habits: s.habits || [],
          settings: Object.assign({ theme:'mono', notify:false, lockDefault:30, lockHour:20 }, s.settings),
          stats: s.stats || { locks: 0, totalDone: 0, xp: 0 },
          awards: s.awards || {}
        };
      }
    } catch (e) { console.warn('loadState', e); }
    return { habits: [], settings: { theme:'mono', notify:false, lockDefault:30, lockHour:20 }, stats: { locks: 0, totalDone: 0, xp: 0 }, awards: {} };
  }
  function saveState() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { console.warn('saveState', e); }
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('is-show'), 2200);
  }

  /* ───────────────────────── Даты ───────────────────────── */
  function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function monthLabel(y, m) {
    const names = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    return names[m];
  }

  /* ───────────────────────── Привычки ───────────────────────── */
  function habitById(id) { return state.habits.find(h => h.id === id); }
  function isDoneOn(h, dateStr) { return (h.done || []).includes(dateStr); }
  function isDoneToday(h) { return isDoneOn(h, todayStr()); }

  function isScheduledOn(h, date) {
    if (h.period === 'daily') return true;
    if (h.period === 'weekly') return date.getDay() === 1;
    if (h.period === 'monthly') return date.getDate() === 1;
    if (h.period === 'custom') return (h.days || [1,2,3,4,5]).includes(date.getDay());
    return true;
  }

  function habitStreak(h) {
    let streak = 0;
    let cursor = startOfDay(new Date());
    if (!isDoneOn(h, dstr(cursor))) cursor = addDays(cursor, -1);
    while (isDoneOn(h, dstr(cursor))) { streak++; cursor = addDays(cursor, -1); }
    return streak;
  }

  function habitCompletionRate(h, days = 30) {
    const today = startOfDay(new Date());
    let scheduled = 0, done = 0;
    for (let i = 0; i < days; i++) {
      const d = addDays(today, -i);
      if (isScheduledOn(h, d)) { scheduled++; if (isDoneOn(h, dstr(d))) done++; }
    }
    return scheduled ? Math.round((done / scheduled) * 100) : 0;
  }

  function toggleHabit(id, dateStr = todayStr()) {
    const h = habitById(id);
    if (!h) return;
    if (!h.done) h.done = [];
    const i = h.done.indexOf(dateStr);
    if (i >= 0) {
      h.done.splice(i, 1);
      toast('Отметка снята');
    } else {
      h.done.push(dateStr);
      state.stats.totalDone++;
      addXP(habitXP(h));
      toast('Выполнено! +' + habitXP(h) + ' XP');
      checkAwards();
    }
    saveState();
    render();
  }

  function habitXP(h) { return { high: 20, medium: 12, low: 6 }[h.priority || 'medium'] || 12; }

  function deleteHabit(id) {
    if (!confirm('Удалить эту привычку и всю её историю?')) return;
    state.habits = state.habits.filter(h => h.id !== id);
    saveState();
    render();
    toast('Привычка удалена');
  }

  function addHabit(data) {
    state.habits.push(Object.assign({ id: uid(), created: todayStr(), done: [] }, data));
    saveState();
    render();
    toast('Привычка добавлена');
  }

  function updateHabit(id, data) {
    const h = habitById(id);
    if (!h) return;
    Object.assign(h, data);
    saveState();
    render();
    toast('Привычка обновлена');
  }

  /* ───────────────────────── XP / Уровни ───────────────────────── */
  function levelFromXP(xp) {
    let level = 1, need = 100, rest = xp;
    while (rest >= need) { rest -= need; level++; need = 100 * level; }
    return { level, cur: rest, need };
  }
  const LEVEL_NAMES = ['Новичок','Ученик','Практик','Мастер','Эксперт','Гуру','Легенда'];
  function levelName(lvl) { return LEVEL_NAMES[Math.min(lvl - 1, LEVEL_NAMES.length - 1)]; }
  function addXP(n) {
    state.stats.xp += n;
    const before = levelFromXP(state.stats.xp - n).level;
    const after = levelFromXP(state.stats.xp).level;
    if (after > before) toast('Новый уровень: ' + levelName(after) + '!');
  }

  /* ───────────────────────── Награды ───────────────────────── */
  const AWARDS = [
    { id:'first',     name:'Первый шаг',     desc:'Выполните первую привычку',   icon:'i-check',   test: s => s.stats.totalDone >= 1 },
    { id:'streak3',   name:'Три подряд',     desc:'Стрик 3 дня',                  icon:'i-fire',    test: s => bestStreak() >= 3 },
    { id:'streak7',   name:'Неделя силы',    desc:'Стрик 7 дней',                 icon:'i-fire',    test: s => bestStreak() >= 7 },
    { id:'streak30',  name:'Месяц воли',     desc:'Стрик 30 дней',                icon:'i-fire',    test: s => bestStreak() >= 30 },
    { id:'habits3',   name:'Коллекционер',   desc:'3 привычки в списке',          icon:'i-plus',    test: s => s.habits.length >= 3 },
    { id:'habits5',   name:'Организатор',    desc:'5 привычек в списке',          icon:'i-plus',    test: s => s.habits.length >= 5 },
    { id:'done50',    name:'Полсотни',       desc:'50 выполнений',                icon:'i-trophy',  test: s => s.stats.totalDone >= 50 },
    { id:'done100',   name:'Сотня',          desc:'100 выполнений',               icon:'i-trophy',  test: s => s.stats.totalDone >= 100 },
    { id:'level5',    name:'Пятый уровень',  desc:'Достигните 5 уровня',          icon:'i-chart',   test: s => levelFromXP(s.stats.xp).level >= 5 },
    { id:'disciplined',name:'Дисциплина',    desc:'7 дней без пропуска',          icon:'i-target',  test: s => fullDays() >= 7 },
    { id:'perfect',   name:'Идеальный день', desc:'Все привычки за день',         icon:'i-check',   test: () => todayPerfect() },
    { id:'lock1',     name:'Сила привычки',  desc:'Потерпите блокировку',         icon:'i-lock',    test: s => s.stats.locks >= 1 }
  ];

  function bestStreak() { let best = 0; state.habits.forEach(h => { best = Math.max(best, habitStreak(h)); }); return best; }
  function fullDays() {
    const today = startOfDay(new Date());
    let count = 0;
    for (let i = 0; i < 60; i++) {
      const d = addDays(today, -i);
      const scheduled = state.habits.filter(h => isScheduledOn(h, d));
      if (scheduled.length && scheduled.every(h => isDoneOn(h, dstr(d)))) count++;
    }
    return count;
  }
  function todayPerfect() {
    const scheduled = state.habits.filter(h => isScheduledOn(h, new Date()));
    return scheduled.length > 0 && scheduled.every(h => isDoneToday(h));
  }
  function checkAwards() {
    AWARDS.forEach(a => {
      if (!state.awards[a.id] && a.test(state)) {
        state.awards[a.id] = dstr(new Date());
        toast('Достижение: ' + a.name);
      }
    });
    saveState();
  }

  /* ───────────────────────── Рендер: общий ───────────────────────── */
  function render() {
    renderTopbar();
    renderToday();
    renderCalendar();
    renderStats();
    renderAwards();
    renderSettings();
    checkLockConditions();
  }

  function renderTopbar() {
    $('#currentMonthLabel').textContent = monthLabel(calCursor.getFullYear(), calCursor.getMonth());
    $('#currentYearLabel').textContent = calCursor.getFullYear();
  }

  /* ───────────────────────── Рендер: Сегодня ───────────────────────── */
  function renderToday() {
    const best = bestStreak();
    const scheduledToday = state.habits.filter(h => isScheduledOn(h, new Date()));
    const doneToday = scheduledToday.filter(h => isDoneToday(h)).length;
    $('#sumStreak').textContent = best;
    $('#sumToday').textContent = doneToday + '/' + scheduledToday.length;
    $('#sumLock').textContent = state.stats.locks;

    renderWeekChart();

    const c = $('#habitsContainer');
    c.innerHTML = '';
    $('#emptyHabits').style.display = state.habits.length ? 'none' : 'block';
    $('#habitsCount').textContent = state.habits.length;

    const sorted = [...state.habits].sort((a, b) => {
      const aS = isScheduledOn(a, new Date()) ? 0 : 1;
      const bS = isScheduledOn(b, new Date()) ? 0 : 1;
      if (aS !== bS) return aS - bS;
      const pr = { high: 0, medium: 1, low: 2 };
      return (pr[a.priority] ?? 1) - (pr[b.priority] ?? 1);
    });

    sorted.forEach(h => {
      const done = isDoneToday(h);
      const scheduled = isScheduledOn(h, new Date());
      const streak = habitStreak(h);
      const cat = CATEGORIES[h.category] || CATEGORIES.other;
      const el = document.createElement('div');
      el.className = 'habit' + (done ? ' is-done' : '');
      el.innerHTML = `
        <button class="habit__check" data-action="toggle" data-id="${h.id}" aria-label="Отметить" aria-pressed="${done}">
          <svg><use href="#i-check"/></svg>
        </button>
        <div class="habit__main" data-action="open" data-id="${h.id}">
          <div class="habit__name" data-action="rename" data-id="${h.id}" title="Двойной клик — переименовать">${escapeHtml(h.name)}</div>
          <div class="habit__meta">
            <span class="habit__tag">${cat.icon} ${cat.name}</span>
            <span class="habit__streak"><svg><use href="#i-fire"/></svg>${streak}</span>
            <span class="habit__prio">${PRIORITIES[h.priority] || ''}</span>
          </div>
        </div>
        <span class="habit__dot" style="background:${h.color || '#111'}"></span>
        <button class="habit__edit" data-action="edit" data-id="${h.id}" aria-label="Редактировать привычку">
          <svg><use href="#i-edit"/></svg>
        </button>
        <button class="habit__del" data-action="delete" data-id="${h.id}" aria-label="Удалить">
          <svg><use href="#i-trash"/></svg>
        </button>
      `;
      if (!scheduled) el.style.opacity = '.55';
      c.appendChild(el);
    });
  }

  function renderWeekChart() {
    const chart = $('#weekChart');
    chart.innerHTML = '';
    const today = startOfDay(new Date());
    const dow = today.getDay();
    const monday = addDays(today, -((dow + 6) % 7));
    const labels = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    const rangeEnd = addDays(monday, 6);
    $('#weekRange').textContent = `${monday.getDate()} ${monthLabel(monday.getFullYear(), monday.getMonth()).slice(0,3)} — ${rangeEnd.getDate()} ${monthLabel(rangeEnd.getFullYear(), rangeEnd.getMonth()).slice(0,3)}`;

    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      const isToday = dstr(d) === todayStr();
      const scheduled = state.habits.filter(h => isScheduledOn(h, d));
      const done = scheduled.filter(h => isDoneOn(h, dstr(d))).length;
      const pct = scheduled.length ? done / scheduled.length : 0;

      const dayEl = document.createElement('div');
      dayEl.className = 'wc-day' + (isToday ? ' is-today' : '');
      dayEl.innerHTML = `
        <span class="wc-pct">${scheduled.length ? Math.round(pct*100)+'%' : '—'}</span>
        <div class="wc-bar"><div class="wc-fill" style="height:${Math.max(pct*100, 4)}%"></div></div>
        <span class="wc-label">${labels[i]}</span>
      `;
      chart.appendChild(dayEl);
    }
  }

  /* ───────────────────────── Рендер: Календарь ───────────────────────── */
  function renderCalendar() {
    const y = calCursor.getFullYear(), m = calCursor.getMonth();
    $('#calTitle').textContent = monthLabel(y, m) + ' ' + y;
    const grid = $('#calendarGrid');
    grid.innerHTML = '';

    const dows = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    dows.forEach(d => { const el = document.createElement('div'); el.className = 'cal__dow'; el.textContent = d; grid.appendChild(el); });

    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7;
    const total = daysInMonth(y, m);
    const prevTotal = daysInMonth(y, m - 1 < 0 ? 11 : m - 1);

    for (let i = 0; i < 42; i++) {
      const dayNum = i - offset + 1;
      const cell = document.createElement('button');
      cell.className = 'cal__day';
      if (dayNum < 1) {
        cell.classList.add('is-other');
        cell.textContent = prevTotal + dayNum;
        cell.disabled = true;
      } else if (dayNum > total) {
        cell.classList.add('is-other');
        cell.textContent = dayNum - total;
        cell.disabled = true;
      } else {
        const d = new Date(y, m, dayNum);
        const ds = dstr(d);
        cell.textContent = dayNum;
        if (ds === todayStr()) cell.classList.add('is-today');
        const scheduled = state.habits.filter(h => isScheduledOn(h, d));
        const done = scheduled.filter(h => isDoneOn(h, ds)).length;
        if (scheduled.length) {
          cell.classList.add('has-data');
          if (done === scheduled.length) cell.classList.add('is-full');
          const dots = document.createElement('div');
          dots.className = 'cal__dots';
          scheduled.slice(0, 4).forEach(h => {
            const s = document.createElement('span');
            if (isDoneOn(h, ds)) s.style.background = 'currentColor';
            dots.appendChild(s);
          });
          cell.appendChild(dots);
        }
        cell.addEventListener('click', () => openDayDetail(d));
      }
      grid.appendChild(cell);
    }
  }

  function openDayDetail(d) {
    const ds = dstr(d);
    $('#dayDetailTitle').textContent = d.getDate() + ' ' + monthLabel(d.getFullYear(), d.getMonth());
    const list = $('#dayDetailList');
    list.innerHTML = '';
    const scheduled = state.habits.filter(h => isScheduledOn(h, d));
    if (!scheduled.length) {
      list.innerHTML = '<p class="empty">В этот день ничего не запланировано</p>';
    } else {
      scheduled.forEach(h => {
        const done = isDoneOn(h, ds);
        const row = document.createElement('div');
        row.className = 'daydetail__row';
        row.innerHTML = `<svg><use href="#i-check"/></svg><strong>${escapeHtml(h.name)}</strong><span class="daydetail__state ${done ? 'is-done' : 'is-miss'}">${done ? 'выполнено' : 'пропуск'}</span>`;
        list.appendChild(row);
      });
    }
    $('#dayDetailCard').hidden = false;
  }

  /* ───────────────────────── Рендер: Статистика ───────────────────────── */
  function renderStats() {
    const avgRate = state.habits.length ? Math.round(state.habits.reduce((a,h) => a + habitCompletionRate(h, 30), 0) / state.habits.length) : 0;
    $('#stTotal').textContent = state.stats.totalDone;
    $('#stRate').textContent = avgRate + '%';
    $('#stBest').textContent = bestStreak();
    $('#stAvg').textContent = avgRate + '%';
    $('#stLocks').textContent = state.stats.locks;
    $('#stLevel').textContent = levelFromXP(state.stats.xp).level;

    const catStats = $('#catStats');
    catStats.innerHTML = '';
    const byCat = {};
    state.habits.forEach(h => {
      const c = h.category || 'other';
      if (!byCat[c]) byCat[c] = { count: 0, rate: 0 };
      byCat[c].count++;
      byCat[c].rate += habitCompletionRate(h, 30);
    });
    const catEntries = Object.entries(byCat);
    if (!catEntries.length) { catStats.innerHTML = '<p class="empty">Нет данных</p>'; }
    else {
      catEntries.sort((a,b) => b[1].rate - a[1].rate).forEach(([key, v]) => {
        const cat = CATEGORIES[key] || CATEGORIES.other;
        const rate = Math.round(v.rate / v.count);
        const row = document.createElement('div');
        row.className = 'catstat__row';
        row.innerHTML = `<span class="catstat__name">${cat.icon} ${cat.name}</span><div class="catstat__bar"><div class="catstat__fill" style="width:${rate}%"></div></div><span class="catstat__val">${rate}%</span>`;
        catStats.appendChild(row);
      });
    }

    const top = $('#topList');
    top.innerHTML = '';
    const sorted = [...state.habits].map(h => ({ h, done: (h.done||[]).length })).sort((a,b) => b.done - a.done).slice(0, 5);
    if (!sorted.length) { top.innerHTML = '<p class="empty">Нет данных</p>'; }
    else {
      sorted.forEach(({h, done}, i) => {
        const row = document.createElement('div');
        row.className = 'toplist__row';
        row.innerHTML = `<span class="toplist__rank">${i+1}</span><span class="toplist__name">${escapeHtml(h.name)}</span><span class="toplist__num">${done}</span>`;
        top.appendChild(row);
      });
    }

    const chart = $('#monthChart');
    chart.innerHTML = '';
    const today = startOfDay(new Date());
    for (let i = 29; i >= 0; i--) {
      const d = addDays(today, -i);
      const scheduled = state.habits.filter(h => isScheduledOn(h, d));
      const done = scheduled.filter(h => isDoneOn(h, dstr(d))).length;
      const pct = scheduled.length ? done / scheduled.length : 0;
      const bar = document.createElement('div');
      bar.className = 'mc-bar' + (dstr(d) === todayStr() ? ' is-today' : '') + (pct === 0 ? ' is-empty' : '');
      bar.style.height = Math.max(pct * 100, 2) + '%';
      chart.appendChild(bar);
    }
  }

  /* ───────────────────────── Рендер: Награды ───────────────────────── */
  function renderAwards() {
    const lvl = levelFromXP(state.stats.xp);
    $('#levelAvatar').textContent = lvl.level;
    $('#levelName').textContent = levelName(lvl.level);
    $('#levelXP').textContent = lvl.cur + ' / ' + lvl.need + ' XP';
    $('#levelFill').style.width = Math.round((lvl.cur / lvl.need) * 100) + '%';

    const grid = $('#awardsGrid');
    grid.innerHTML = '';
    AWARDS.forEach(a => {
      const unlocked = !!state.awards[a.id];
      const el = document.createElement('div');
      el.className = 'award' + (unlocked ? ' is-unlocked' : '');
      el.title = a.desc;
      el.innerHTML = `<svg><use href="#${a.icon}"/></svg><span>${a.name}</span>`;
      grid.appendChild(el);
    });
  }

  /* ───────────────────────── Настройки ───────────────────────── */
  function renderSettings() {
    const s = state.settings;
    $('#setTheme').value = s.theme;
    $('#setNotify').checked = !!s.notify;
    $('#setLockDefault').value = s.lockDefault;
    $('#setLockHour').value = toTimeInput(s.lockHour ?? 20);
    document.documentElement.setAttribute('data-theme', s.theme);
  }
  function applyTheme(theme) {
    state.settings.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    saveState();
    renderSettings();
  }

  /* ───────────────────────── Блокировка ───────────────────────── */
  function checkLockConditions() {
    const hour = new Date().getHours();
    const lockHour = state.settings.lockHour ?? 20;
    if (hour < lockHour) return;
    if (sessionStorage.getItem('hf_lock_today') === todayStr()) return;
    const missed = state.habits.find(h => isScheduledOn(h, new Date()) && !isDoneToday(h));
    if (!missed) return;
    openLockScreen(missed);
  }

  function openLockScreen(habit) {
    const mins = habit.lockTime ?? state.settings.lockDefault ?? 30;
    $('#lockHabitName').textContent = habit.name;
    $('#lockMinutes').textContent = mins;
    $('#lockScreen').classList.add('is-open');
    $('#lockScreen').setAttribute('aria-hidden', 'false');
    sessionStorage.setItem('hf_lock_today', todayStr());
    state.stats.locks++;
    saveState();
    checkAwards();
    lockLeftSec = mins * 60;
    updateLockTimer();
    clearInterval(lockTimer);
    lockTimer = setInterval(() => {
      lockLeftSec--;
      updateLockTimer();
      if (lockLeftSec <= 0) closeLockScreen();
    }, 1000);
  }
  function updateLockTimer() {
    const m = Math.floor(Math.max(lockLeftSec,0) / 60);
    const s = Math.max(lockLeftSec,0) % 60;
    $('#lockTimer').textContent = pad(m) + ':' + pad(s);
    $('#lockConfirm').disabled = lockLeftSec > 0;
  }
  function closeLockScreen() {
    clearInterval(lockTimer); lockTimer = null;
    $('#lockScreen').classList.remove('is-open');
    $('#lockScreen').setAttribute('aria-hidden', 'true');
  }

  /* ───────────────────────── Навигация ───────────────────────── */
  function switchView(name) {
    view = name;
    $$('.tab').forEach(t => { const active = t.dataset.view === name; t.classList.toggle('is-active', active); t.setAttribute('aria-selected', active); });
    $$('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + name));
    if (name === 'calendar') renderCalendar();
    if (name === 'stats') renderStats();
  }

  /* ───────────────────────── Модалки ───────────────────────── */
  function openOverlay(id) { const o = $('#' + id); o.classList.add('is-open'); o.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; }
  function closeOverlay(id) { const o = $('#' + id); o.classList.remove('is-open'); o.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
  function closeAllOverlays() { $$('.overlay').forEach(o => closeOverlay(o.id)); }

  /* ───────────────────────── Форма привычки ───────────────────────── */
  function resetForm() {
    $('#habitForm').reset();
    $('#habitId').value = '';
    $('#habitModalTitle').textContent = 'Новая привычка';
    editingId = null;
    selectedDays = new Set([1,2,3,4,5]);
    selectedColor = '#111111';
    syncWeekdays(); syncColors();
    $('#weekdaysField').hidden = true;
  }
  function syncWeekdays() { $$('#weekdaysPicker .wd').forEach(b => b.classList.toggle('is-active', selectedDays.has(parseInt(b.dataset.wd)))); }
  function syncColors() { $$('#colorPicker .color').forEach(b => b.classList.toggle('is-active', b.dataset.color === selectedColor)); }

  function fillForm(h) {
    editingId = h.id;
    $('#habitModalTitle').textContent = 'Редактировать привычку';
    $('#habitId').value = h.id;
    $('#fName').value = h.name;
    $('#fGoal').value = h.goal || '';
    $('#fPeriod').value = h.period || 'daily';
    $('#fCategory').value = h.category || 'other';
    $('#fPriority').value = h.priority || 'medium';
    $('#fLock').value = h.lockTime ?? state.settings.lockDefault ?? 30;
    $('#fReminder').value = toTimeInput(h.reminder);
    $('#fNote').value = h.note || '';
    selectedDays = new Set(h.days || [1,2,3,4,5]);
    selectedColor = h.color || '#111111';
    syncWeekdays(); syncColors();
    $('#weekdaysField').hidden = (h.period !== 'custom');
  }

  function readForm() {
    const period = $('#fPeriod').value;
    return {
      name: $('#fName').value.trim(),
      goal: $('#fGoal').value.trim(),
      period,
      days: period === 'custom' ? Array.from(selectedDays) : undefined,
      category: $('#fCategory').value,
      priority: $('#fPriority').value,
      color: selectedColor,
      lockTime: clamp(parseInt($('#fLock').value) || 0, 0, 1440),
      reminder: parseTime($('#fReminder').value),
      note: $('#fNote').value.trim()
    };
  }

  /* ───────────────────────── Переименование ───────────────────────── */
  function startRename(id) {
    const h = habitById(id);
    if (!h) return;
    const nameEl = document.querySelector(`.habit__name[data-id="${id}"]`);
    if (!nameEl) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'habit__rename';
    input.value = h.name;
    input.maxLength = 60;
    input.setAttribute('aria-label', 'Новое название привычки');
    nameEl.replaceWith(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (save && v && v !== h.name) { h.name = v; saveState(); toast('Название изменено'); }
      render();
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { finish(false); }
    });
  }

  /* ───────────────────────── Детальный просмотр ───────────────────────── */
  function openHabitDetail(id) {
    const h = habitById(id);
    if (!h) return;
    const cat = CATEGORIES[h.category] || CATEGORIES.other;
    const streak = habitStreak(h);
    const rate = habitCompletionRate(h, 30);
    const doneTotal = (h.done || []).length;

    $('#detailTitle').textContent = h.name;
    const body = $('#detailBody');
    body.innerHTML = `
      <div class="detail__header">
        <span class="detail__dot" style="background:${h.color || '#111'}"></span>
        <div class="detail__title">
          <strong>${escapeHtml(h.name)}</strong>
          <span>${cat.icon} ${cat.name} · ${PERIODS[h.period] || ''} · ${PRIORITIES[h.priority] || ''}</span>
        </div>
      </div>
      ${h.goal ? `<div class="detail__note"><strong>Цель</strong>${escapeHtml(h.goal)}</div>` : ''}
      ${h.note ? `<div class="detail__note"><strong>Заметка</strong>${escapeHtml(h.note)}</div>` : ''}
      <div class="detail__stats">
        <div class="detail__stat"><strong>${streak}</strong><span>стрик</span></div>
        <div class="detail__stat"><strong>${doneTotal}</strong><span>всего</span></div>
        <div class="detail__stat"><strong>${rate}%</strong><span>за 30 дн</span></div>
      </div>
      <div class="detail__cal" id="detailCal"></div>
      <div class="detail__actions">
        <button class="btn btn--outline" id="detailEdit"><svg><use href="#i-edit"/></svg> Изменить</button>
        <button class="btn btn--danger" id="detailDelete"><svg><use href="#i-trash"/></svg> Удалить</button>
      </div>
    `;
    renderDetailCal(h);
    $('#detailEdit').onclick = () => { closeOverlay('detailModal'); fillForm(h); openOverlay('habitModal'); };
    $('#detailDelete').onclick = () => { closeOverlay('detailModal'); deleteHabit(h.id); };
    openOverlay('detailModal');
  }

  function renderDetailCal(h) {
    const cal = $('#detailCal');
    if (!cal) return;
    cal.innerHTML = '';
    const today = startOfDay(new Date());
    for (let i = 27; i >= 0; i--) {
      const d = addDays(today, -i);
      const cell = document.createElement('div');
      cell.className = 'detail__cal-d';
      if (isDoneOn(h, dstr(d))) cell.classList.add('is-done');
      if (dstr(d) === todayStr()) cell.classList.add('is-today');
      cell.textContent = d.getDate();
      cal.appendChild(cell);
    }
  }

  /* ───────────────────────── Экспорт / импорт ───────────────────────── */
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'habitflow-backup-' + todayStr() + '.json'; a.click();
    URL.revokeObjectURL(url);
    toast('Данные экспортированы');
  }
  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.habits) throw new Error('bad format');
        state = {
          habits: data.habits || [],
          settings: Object.assign({ theme:'mono', notify:false, lockDefault:30, lockHour:20 }, data.settings),
          stats: data.stats || { locks: 0, totalDone: 0, xp: 0 },
          awards: data.awards || {}
        };
        saveState(); render(); toast('Данные импортированы');
      } catch (e) { toast('Ошибка импорта: неверный файл'); }
    };
    reader.readAsText(file);
  }

  /* ───────────────────────── Привязка событий ───────────────────────── */
  function bindEvents() {
    $$('.tab').forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));
    $('#prevPeriod').addEventListener('click', () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1); renderTopbar(); renderCalendar(); });
    $('#nextPeriod').addEventListener('click', () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1); renderTopbar(); renderCalendar(); });
    $('#openAddModal').addEventListener('click', () => { resetForm(); openOverlay('habitModal'); });
    $('#closeHabitModal').addEventListener('click', () => closeOverlay('habitModal'));
    $('#closeSettings').addEventListener('click', () => closeOverlay('settingsModal'));
    $('#closeDetail').addEventListener('click', () => closeOverlay('detailModal'));
    $('#closeDayDetail').addEventListener('click', () => { $('#dayDetailCard').hidden = true; });
    $$('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) closeOverlay(o.id); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllOverlays(); });
    $('#openSettings').addEventListener('click', () => { renderSettings(); openOverlay('settingsModal'); });

    $('#habitsContainer').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      e.stopPropagation();
      if (action === 'toggle') toggleHabit(id);
      else if (action === 'delete') deleteHabit(id);
      else if (action === 'edit') { const h = habitById(id); if (h) { fillForm(h); openOverlay('habitModal'); } }
      else if (action === 'open') openHabitDetail(id);
    });
    $('#habitsContainer').addEventListener('dblclick', e => {
      const nameEl = e.target.closest('.habit__name');
      if (!nameEl) return;
      e.stopPropagation();
      startRename(nameEl.dataset.id);
    });

    $('#habitForm').addEventListener('submit', e => {
      e.preventDefault();
      const data = readForm();
      if (!data.name) { toast('Введите название'); return; }
      if (editingId) updateHabit(editingId, data);
      else addHabit(data);
      closeOverlay('habitModal');
    });
    $('#fPeriod').addEventListener('change', () => { $('#weekdaysField').hidden = $('#fPeriod').value !== 'custom'; });
    $('#weekdaysPicker').addEventListener('click', e => {
      const b = e.target.closest('.wd'); if (!b) return;
      const wd = parseInt(b.dataset.wd);
      if (selectedDays.has(wd)) selectedDays.delete(wd); else selectedDays.add(wd);
      if (!selectedDays.size) selectedDays.add(wd);
      syncWeekdays();
    });
    $('#colorPicker').addEventListener('click', e => {
      const b = e.target.closest('.color'); if (!b) return;
      selectedColor = b.dataset.color; syncColors();
    });

    $('#setTheme').addEventListener('change', e => applyTheme(e.target.value));
    $('#setNotify').addEventListener('change', e => {
      state.settings.notify = e.target.checked; saveState();
      if (e.target.checked && 'Notification' in window) Notification.requestPermission();
    });
    $('#setLockDefault').addEventListener('change', e => { state.settings.lockDefault = clamp(parseInt(e.target.value) || 30, 0, 1440); saveState(); });
    $('#setLockHour').addEventListener('change', e => { state.settings.lockHour = parseTime(e.target.value) || 20; saveState(); });

    $('#exportBtn').addEventListener('click', exportData);
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });
    $('#resetBtn').addEventListener('click', () => {
      if (!confirm('Удалить ВСЕ данные? Это действие нельзя отменить.')) return;
      localStorage.removeItem(STORE);
      state = { habits: [], settings: { theme:'mono', notify:false, lockDefault:30, lockHour:20 }, stats: { locks:0, totalDone:0, xp:0 }, awards:{} };
      saveState(); closeAllOverlays(); render(); toast('Все данные удалены');
    });
    $('#lockConfirm').addEventListener('click', () => { if (lockLeftSec <= 0) closeLockScreen(); });
  }

  /* ───────────────────────── Инициализация ───────────────────────── */
  function init() {
    bindEvents();
    render();
    setTimeout(checkLockConditions, 60000);
  }
  document.addEventListener('DOMContentLoaded', init);
})();