(() => {
  const STORAGE_KEY = 'jiko-kanri-data-v1';

  const EXPENSE_CATEGORIES = [
    { id: 'food', label: '食費', icon: '🍙' },
    { id: 'daily', label: '日用品', icon: '🧻' },
    { id: 'transport', label: '交通', icon: '🚃' },
    { id: 'fun', label: '娯楽', icon: '🎮' },
    { id: 'beauty', label: '美容', icon: '💄' },
    { id: 'medical', label: '医療', icon: '🏥' },
    { id: 'housing', label: '住居', icon: '🏠' },
    { id: 'comm', label: '通信', icon: '📱' },
    { id: 'other', label: 'その他', icon: '📦' },
  ];
  const INCOME_CATEGORIES = [
    { id: 'salary', label: '給与', icon: '💼' },
    { id: 'allowance', label: 'お小遣い', icon: '👛' },
    { id: 'side', label: '副収入', icon: '💡' },
    { id: 'other', label: 'その他', icon: '📦' },
  ];

  function normalizeState(parsed) {
    parsed = parsed && typeof parsed === 'object' ? parsed : {};
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      shopping: Array.isArray(parsed.shopping) ? parsed.shopping : [],
      shoppingFreq: parsed.shoppingFreq && typeof parsed.shoppingFreq === 'object' ? parsed.shoppingFreq : {},
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      habits: Array.isArray(parsed.habits) ? parsed.habits : [],
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return normalizeState(null);
      return normalizeState(JSON.parse(raw));
    } catch (e) {
      console.error('failed to load state', e);
      return normalizeState(null);
    }
  }

  const state = loadState();

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function nowTimeStr() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function dateStrOffset(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function addDaysToDateStr(dateStr, offsetDays) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatYen(n) {
    return '¥' + Math.round(n).toLocaleString('ja-JP');
  }

  function formatDateLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const today = todayStr();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    if (dateStr === today) return '今日';
    if (dateStr === yStr) return '昨日';
    const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return `${d.getMonth() + 1}月${d.getDate()}日(${wd})`;
  }

  function truncate(s, n) {
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const NOTE_COLORS = ['note-yellow', 'note-pink', 'note-blue', 'note-green', 'note-orange', 'note-purple'];
  const NOTE_ROTATIONS = [-3, -2, -1.5, 1.5, 2, 3];
  function noteStyle(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return {
      colorClass: NOTE_COLORS[hash % NOTE_COLORS.length],
      rot: NOTE_ROTATIONS[Math.floor(hash / NOTE_COLORS.length) % NOTE_ROTATIONS.length],
    };
  }

  // ---------- View switching ----------
  const VIEWS = ['home', 'log', 'habit', 'todo', 'money', 'shopping'];
  const PAGE_TITLES = { home: 'ホーム', log: '記録', habit: '習慣', todo: 'やることリスト', money: 'お金', shopping: '買い物リスト' };

  function switchView(name) {
    VIEWS.forEach((v) => {
      document.getElementById(`view-${v}`).classList.toggle('active', v === name);
    });
    document.querySelectorAll('.tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === name);
    });
    document.getElementById('page-title').textContent = PAGE_TITLES[name];
    document.getElementById('views').scrollTop = 0;
    if (name === 'home') renderHome();
    if (name === 'log') { renderCalendar(); renderLog(); }
    if (name === 'habit') renderHabit();
    if (name === 'todo') renderTodo();
    if (name === 'money') renderMoney();
    if (name === 'shopping') renderShopping();
  }

  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.goto));
  });

  // ---------- Home ----------
  function greetingByHour() {
    const h = new Date().getHours();
    if (h < 5) return '夜遅くまでお疲れさまです。無理せず休んでくださいね。';
    if (h < 11) return 'おはようございます。今日も一日、できることから始めましょう。';
    if (h < 17) return 'お疲れさまです。今日の調子はいかがですか？';
    if (h < 22) return 'お疲れさまでした。今日の記録をつけてみましょう。';
    return '今日も一日お疲れさまでした。ゆっくり休んでくださいね。';
  }

  function renderHome() {
    const today = todayStr();
    const todayRecords = state.records.filter((r) => r.date === today);
    document.getElementById('stat-records').innerHTML = `${todayRecords.length}<small>件</small>`;

    const todayExpense = state.transactions
      .filter((t) => t.date === today && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    document.getElementById('stat-expense-today').textContent = formatYen(todayExpense);

    const monthPrefix = today.slice(0, 7);
    const monthTx = state.transactions.filter((t) => t.date.startsWith(monthPrefix));
    const monthIncome = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const monthExpense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    document.getElementById('stat-balance-month').textContent = formatYen(monthIncome - monthExpense);

    const shoppingLeft = state.shopping.filter((i) => !i.checked).length;
    document.getElementById('stat-shopping-left').innerHTML = `${shoppingLeft}<small>個</small>`;

    const todoLeft = state.todos.filter((t) => !t.checked).length;
    document.getElementById('stat-todo-left').innerHTML = `${todoLeft}<small>件</small>`;

    const habitDoneToday = state.habits.filter((h) => h.checkins.includes(today)).length;
    document.getElementById('stat-habit-today').innerHTML = `${habitDoneToday}<small>/${state.habits.length}</small>`;

    document.getElementById('greeting-text').textContent = greetingByHour();

    const recentRecords = [...state.records].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 3);
    const recEl = document.getElementById('home-recent-records');
    recEl.innerHTML = '';
    if (recentRecords.length === 0) {
      recEl.innerHTML = '<li class="empty-hint">まだ記録がありません</li>';
    } else {
      recentRecords.forEach((r) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${escapeHtml(truncate(r.text, 28))}</span><span class="muted">${formatDateLabel(r.date)}</span>`;
        recEl.appendChild(li);
      });
    }

    const habitEl = document.getElementById('home-recent-habit');
    habitEl.innerHTML = '';
    if (state.habits.length === 0) {
      habitEl.innerHTML = '<li class="empty-hint">習慣が登録されていません</li>';
    } else {
      state.habits.slice(0, 5).forEach((h) => {
        const done = h.checkins.includes(today);
        const li = document.createElement('li');
        li.innerHTML = `<span>${escapeHtml(h.name)}</span><span class="muted">${done ? '✓ 達成' : '未達成'}</span>`;
        habitEl.appendChild(li);
      });
    }

    const todoEl = document.getElementById('home-recent-todo');
    todoEl.innerHTML = '';
    const pendingTodos = [...state.todos]
      .filter((t) => !t.checked)
      .sort((a, b) => {
        if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return b.createdAt - a.createdAt;
      })
      .slice(0, 5);
    if (pendingTodos.length === 0) {
      todoEl.innerHTML = '<li class="empty-hint">タスクはありません</li>';
    } else {
      pendingTodos.forEach((t) => {
        const li = document.createElement('li');
        const dueLabel = t.dueDate ? formatDateLabel(t.dueDate) : '';
        li.innerHTML = `<span>${escapeHtml(truncate(t.text, 28))}</span>${dueLabel ? `<span class="muted">${dueLabel}</span>` : ''}`;
        todoEl.appendChild(li);
      });
    }

    const shopEl = document.getElementById('home-recent-shopping');
    shopEl.innerHTML = '';
    const unchecked = state.shopping.filter((i) => !i.checked).slice(0, 5);
    if (unchecked.length === 0) {
      shopEl.innerHTML = '<li class="empty-hint">リストは空です</li>';
    } else {
      unchecked.forEach((i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${escapeHtml(i.name)}</span>`;
        shopEl.appendChild(li);
      });
    }
  }

  // ---------- Log (記録) ----------
  const logForm = document.getElementById('log-form');
  const logDateInput = document.getElementById('log-date');
  const logTextInput = document.getElementById('log-text');

  const calendarMonth = new Date();
  calendarMonth.setDate(1);
  let selectedLogDate = null;

  function renderCalendar() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    document.getElementById('cal-month-label').textContent = `${year}年${month + 1}月`;

    const recordDates = new Set(state.records.map((r) => r.date));
    const today = todayStr();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    ['日', '月', '火', '水', '木', '金', '土'].forEach((wd) => {
      const cell = document.createElement('div');
      cell.className = 'cal-weekday';
      cell.textContent = wd;
      grid.appendChild(cell);
    });
    for (let i = 0; i < firstWeekday; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day empty';
      grid.appendChild(empty);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-day';
      if (dateStr === today) cell.classList.add('is-today');
      if (dateStr === selectedLogDate) cell.classList.add('is-selected');
      if (recordDates.has(dateStr)) cell.classList.add('has-record');
      cell.textContent = String(d);
      cell.dataset.date = dateStr;
      grid.appendChild(cell);
    }
  }

  document.getElementById('cal-prev').addEventListener('click', () => {
    calendarMonth.setMonth(calendarMonth.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calendarMonth.setMonth(calendarMonth.getMonth() + 1);
    renderCalendar();
  });
  document.getElementById('calendar-grid').addEventListener('click', (e) => {
    const cell = e.target.closest('.cal-day:not(.empty)');
    if (!cell) return;
    selectedLogDate = selectedLogDate === cell.dataset.date ? null : cell.dataset.date;
    renderCalendar();
    renderLog();
  });
  document.getElementById('log-clear-filter-btn').addEventListener('click', () => {
    selectedLogDate = null;
    renderCalendar();
    renderLog();
  });

  logForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = logTextInput.value.trim();
    if (!text) return;
    state.records.push({
      id: uid(),
      date: logDateInput.value || todayStr(),
      time: nowTimeStr(),
      text,
      createdAt: Date.now(),
    });
    save();
    logTextInput.value = '';
    renderLog();
  });

  function renderLog() {
    logDateInput.value = logDateInput.value || todayStr();

    const titleEl = document.getElementById('log-list-title');
    const clearFilterBtn = document.getElementById('log-clear-filter-btn');
    if (selectedLogDate) {
      titleEl.textContent = `${formatDateLabel(selectedLogDate)}の記録`;
      clearFilterBtn.style.display = '';
    } else {
      titleEl.textContent = '記録一覧';
      clearFilterBtn.style.display = 'none';
    }

    const listEl = document.getElementById('log-list');
    listEl.innerHTML = '';
    const records = selectedLogDate ? state.records.filter((r) => r.date === selectedLogDate) : state.records;
    if (records.length === 0) {
      listEl.innerHTML = selectedLogDate
        ? '<p class="empty-hint">この日の記録はありません。</p>'
        : '<p class="empty-hint">まだ記録がありません。今日できたことを書いてみましょう。</p>';
      return;
    }
    const sorted = [...records].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const groups = new Map();
    sorted.forEach((r) => {
      if (!groups.has(r.date)) groups.set(r.date, []);
      groups.get(r.date).push(r);
    });
    for (const [date, items] of groups) {
      const group = document.createElement('div');
      group.className = 'log-day-group';
      const heading = document.createElement('div');
      heading.className = 'log-day-heading';
      heading.textContent = formatDateLabel(date);
      group.appendChild(heading);
      items.forEach((r) => {
        const { colorClass, rot } = noteStyle(r.id);
        const entry = document.createElement('div');
        entry.className = `sticky-note log-note ${colorClass}`;
        entry.style.setProperty('--rot', `${rot}deg`);
        entry.innerHTML = `
          <button class="note-del" data-del-record="${r.id}">✕</button>
          <p class="note-text">${escapeHtml(r.text)}</p>
          <span class="note-time">${r.time}</span>
        `;
        group.appendChild(entry);
      });
      listEl.appendChild(group);
    }
  }

  document.getElementById('log-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del-record]');
    if (!btn) return;
    if (!confirm('この記録を削除しますか？')) return;
    const id = btn.dataset.delRecord;
    const idx = state.records.findIndex((r) => r.id === id);
    if (idx !== -1) state.records.splice(idx, 1);
    save();
    renderLog();
  });

  // ---------- Habit (習慣) ----------
  const habitForm = document.getElementById('habit-form');
  const habitNameInput = document.getElementById('habit-name');
  const habitPurposeInput = document.getElementById('habit-purpose');
  const habitTimeInput = document.getElementById('habit-time');
  const HABIT_MASTERY_DAYS = 21;
  const TIME_OF_DAY_META = {
    anytime: { icon: '🕐', label: 'いつでも', heading: '🕐 いつでもの習慣' },
    morning: { icon: '☀️', label: '午前', heading: '☀️ 午前の習慣' },
    afternoon: { icon: '🌇', label: '午後', heading: '🌇 午後の習慣' },
  };
  const TIME_OF_DAY_ORDER = ['morning', 'afternoon', 'anytime'];

  document.querySelectorAll('#habit-time-toggle .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#habit-time-toggle .seg-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      habitTimeInput.value = btn.dataset.time;
    });
  });

  habitForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = habitNameInput.value.trim();
    if (!name) return;
    state.habits.push({
      id: uid(),
      name,
      purpose: habitPurposeInput.value.trim(),
      timeOfDay: habitTimeInput.value,
      checkins: [],
      notes: [],
      mastered: false,
      masteredAt: null,
      createdAt: Date.now(),
    });
    save();
    habitNameInput.value = '';
    habitPurposeInput.value = '';
    habitTimeInput.value = 'anytime';
    document.querySelectorAll('#habit-time-toggle .seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.time === 'anytime');
    });
    renderHabit();
  });

  function computeStreak(checkinSet) {
    let streak = 0;
    let offset = checkinSet.has(dateStrOffset(0)) ? 0 : -1;
    while (checkinSet.has(dateStrOffset(offset))) {
      streak++;
      offset--;
    }
    return streak;
  }

  function computeLongestStreak(checkins) {
    if (checkins.length === 0) return 0;
    const sorted = [...checkins].sort();
    let longest = 1;
    let current = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === addDaysToDateStr(sorted[i - 1], 1)) {
        current++;
      } else if (sorted[i] !== sorted[i - 1]) {
        current = 1;
      }
      if (current > longest) longest = current;
    }
    return longest;
  }

  document.getElementById('habit-list').addEventListener('click', (e) => {
    const delBtn = e.target.closest('[data-del-habit]');
    if (delBtn) {
      if (!confirm('この習慣を削除しますか？記録した達成履歴やメモも削除されます。')) return;
      const idx = state.habits.findIndex((h) => h.id === delBtn.dataset.delHabit);
      if (idx !== -1) state.habits.splice(idx, 1);
      save();
      renderHabit();
      return;
    }
    const editPurposeBtn = e.target.closest('[data-edit-purpose]');
    if (editPurposeBtn) {
      const habit = state.habits.find((h) => h.id === editPurposeBtn.dataset.editPurpose);
      if (habit) {
        const next = prompt('なぜこの習慣を身につけたいですか？', habit.purpose || '');
        if (next !== null) {
          habit.purpose = next.trim();
          save();
          renderHabit();
        }
      }
      return;
    }
    const delNoteBtn = e.target.closest('[data-del-note]');
    if (delNoteBtn) {
      const habit = state.habits.find((h) => h.id === delNoteBtn.dataset.habitId);
      if (habit) {
        habit.notes = (habit.notes || []).filter((n) => n.id !== delNoteBtn.dataset.delNote);
        save();
        renderHabit();
      }
      return;
    }
    const cycleTimeBtn = e.target.closest('[data-cycle-time]');
    if (cycleTimeBtn) {
      const habit = state.habits.find((h) => h.id === cycleTimeBtn.dataset.cycleTime);
      if (habit) {
        const current = habit.timeOfDay || 'anytime';
        const next = TIME_OF_DAY_ORDER[(TIME_OF_DAY_ORDER.indexOf(current) + 1) % TIME_OF_DAY_ORDER.length];
        habit.timeOfDay = next;
        save();
        renderHabit();
      }
      return;
    }
    const checkBtn = e.target.closest('[data-toggle-habit]');
    if (checkBtn) {
      const habit = state.habits.find((h) => h.id === checkBtn.dataset.toggleHabit);
      if (habit) {
        const today = dateStrOffset(0);
        const idx = habit.checkins.indexOf(today);
        if (idx === -1) {
          habit.checkins.push(today);
          const streak = computeStreak(new Set(habit.checkins));
          if (streak >= HABIT_MASTERY_DAYS && !habit.mastered) {
            habit.mastered = true;
            habit.masteredAt = today;
            state.records.push({
              id: uid(),
              date: today,
              time: nowTimeStr(),
              text: `🏆「${habit.name}」が${HABIT_MASTERY_DAYS}日間続き、習慣になりました！`,
              createdAt: Date.now(),
            });
          }
        } else {
          habit.checkins.splice(idx, 1);
        }
      }
      save();
      renderHabit();
    }
  });

  document.getElementById('habit-list').addEventListener('submit', (e) => {
    const form = e.target.closest('.habit-note-form');
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector('.habit-note-input');
    const text = input.value.trim();
    if (!text) return;
    const habit = state.habits.find((h) => h.id === form.dataset.habitId);
    if (habit) {
      if (!habit.notes) habit.notes = [];
      habit.notes.push({ id: uid(), text, date: dateStrOffset(0), createdAt: Date.now() });
      save();
    }
    renderHabit();
  });

  function buildHabitCalendarHtml(checkinSet) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = dateStrOffset(0);
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = ['日', '月', '火', '水', '木', '金', '土']
      .map((wd) => `<div class="habit-cal-weekday">${wd}</div>`)
      .join('');
    for (let i = 0; i < firstWeekday; i++) html += '<div class="habit-cal-day empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      let cls = 'habit-cal-day';
      if (checkinSet.has(dateStr)) cls += ' filled';
      if (dateStr === today) cls += ' is-today';
      html += `<div class="${cls}">${d}</div>`;
    }
    return html;
  }

  function buildHabitCardHtml(habit) {
    const today = dateStrOffset(0);
    const checkinSet = new Set(habit.checkins);
    const streak = computeStreak(checkinSet);
    const longest = computeLongestStreak(habit.checkins);
    const checkedToday = checkinSet.has(today);
    const timeMeta = TIME_OF_DAY_META[habit.timeOfDay || 'anytime'];

    const purposeHtml = habit.purpose
      ? `<p class="habit-purpose">🎯 ${escapeHtml(habit.purpose)} <button type="button" class="habit-edit-link" data-edit-purpose="${habit.id}">編集</button></p>`
      : `<button type="button" class="habit-edit-link habit-add-purpose" data-edit-purpose="${habit.id}">+ 目的を追加</button>`;

    const masteredHtml = habit.mastered
      ? `<p class="habit-mastered-badge">🏅 習慣化達成（${formatDateLabel(habit.masteredAt)}）</p>`
      : '';

    const notes = [...(habit.notes || [])].sort((a, b) => b.createdAt - a.createdAt);
    const notesHtml = notes.length
      ? notes
          .map(
            (n) => `
      <li class="habit-note-item">
        <span class="habit-note-text">${escapeHtml(n.text)}</span>
        <span class="habit-note-date">${formatDateLabel(n.date)}</span>
        <button class="icon-btn" data-del-note="${n.id}" data-habit-id="${habit.id}">✕</button>
      </li>`
          )
          .join('')
      : '<li class="empty-hint">まだメモがありません</li>';

    return `
      <div class="habit-card-header">
        <span class="habit-name">${escapeHtml(habit.name)}</span>
        <button type="button" class="habit-time-badge" data-cycle-time="${habit.id}">${timeMeta.icon} ${timeMeta.label}</button>
        <button class="icon-btn" data-del-habit="${habit.id}">✕</button>
      </div>
      ${purposeHtml}
      ${masteredHtml}
      <div class="habit-streak-row">
        <span class="habit-streak">🔥 <strong>${streak}</strong>日連続</span>
        <span class="habit-best">最長 ${longest}日</span>
      </div>
      <div class="habit-calendar">${buildHabitCalendarHtml(checkinSet)}</div>
      <button type="button" class="habit-check-btn${checkedToday ? ' checked' : ''}" data-toggle-habit="${habit.id}">
        ${checkedToday ? '✓ 今日達成' : '今日やった'}
      </button>

      <div class="habit-notes-section">
        <div class="habit-notes-header">💡 工夫・気づき（トライ&エラー）</div>
        <form class="habit-note-form" data-habit-id="${habit.id}">
          <input type="text" class="habit-note-input" placeholder="例）朝やってみたら続いた" autocomplete="off" />
          <button type="submit" class="habit-note-submit">追加</button>
        </form>
        <ul class="habit-notes-list">${notesHtml}</ul>
      </div>
    `;
  }

  function renderHabit() {
    const listEl = document.getElementById('habit-list');
    listEl.innerHTML = '';
    if (state.habits.length === 0) {
      listEl.innerHTML = '<p class="empty-hint">まだ習慣が登録されていません。身につけたいことを追加してみましょう。</p>';
      return;
    }
    TIME_OF_DAY_ORDER.forEach((groupKey) => {
      const habitsInGroup = state.habits.filter((h) => (h.timeOfDay || 'anytime') === groupKey);
      if (habitsInGroup.length === 0) return;
      const heading = document.createElement('div');
      heading.className = 'habit-group-heading';
      heading.textContent = TIME_OF_DAY_META[groupKey].heading;
      listEl.appendChild(heading);
      habitsInGroup.forEach((habit) => {
        const card = document.createElement('div');
        card.className = 'card habit-card';
        card.innerHTML = buildHabitCardHtml(habit);
        listEl.appendChild(card);
      });
    });
  }

  // ---------- Todo (やることリスト) ----------
  const todoForm = document.getElementById('todo-form');
  const todoTextInput = document.getElementById('todo-text');
  const todoDueInput = document.getElementById('todo-due');

  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = todoTextInput.value.trim();
    if (!text) return;
    state.todos.push({
      id: uid(),
      text,
      dueDate: todoDueInput.value || null,
      checked: false,
      createdAt: Date.now(),
    });
    save();
    todoTextInput.value = '';
    todoDueInput.value = '';
    renderTodo();
  });

  document.getElementById('todo-list').addEventListener('click', (e) => {
    const delBtn = e.target.closest('[data-del-todo]');
    if (delBtn) {
      const idx = state.todos.findIndex((t) => t.id === delBtn.dataset.delTodo);
      if (idx !== -1) state.todos.splice(idx, 1);
      save();
      renderTodo();
      return;
    }
    const checkBtn = e.target.closest('[data-toggle-todo]');
    if (checkBtn) {
      const item = state.todos.find((t) => t.id === checkBtn.dataset.toggleTodo);
      if (item) item.checked = !item.checked;
      save();
      renderTodo();
    }
  });

  document.getElementById('clear-done-todo-btn').addEventListener('click', () => {
    const doneTodos = state.todos.filter((t) => t.checked);
    if (doneTodos.length === 0) return;
    const today = todayStr();
    const time = nowTimeStr();
    doneTodos.forEach((t) => {
      state.records.push({
        id: uid(),
        date: today,
        time,
        text: `✅ ${t.text}`,
        createdAt: Date.now(),
      });
    });
    state.todos = state.todos.filter((t) => !t.checked);
    save();
    renderTodo();
  });

  function renderTodo() {
    const listEl = document.getElementById('todo-list');
    listEl.innerHTML = '';
    if (state.todos.length === 0) {
      listEl.innerHTML = '<li class="empty-hint">タスクはありません</li>';
      return;
    }
    const today = todayStr();
    const sorted = [...state.todos].sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return b.createdAt - a.createdAt;
    });
    sorted.forEach((t) => {
      const { colorClass, rot } = noteStyle(t.id);
      const li = document.createElement('li');
      li.className = `sticky-note todo-note ${colorClass}` + (t.checked ? ' checked' : '');
      li.style.setProperty('--rot', `${rot}deg`);
      li.dataset.toggleTodo = t.id;
      let dueHtml = '';
      if (t.dueDate) {
        let dueClass = 'todo-due';
        if (!t.checked) {
          if (t.dueDate < today) dueClass += ' overdue';
          else if (t.dueDate === today) dueClass += ' today';
        }
        dueHtml = `<span class="${dueClass}">${formatDateLabel(t.dueDate)}</span>`;
      }
      li.innerHTML = `
        <button class="note-del" data-del-todo="${t.id}">✕</button>
        <p class="note-text">${escapeHtml(t.text)}</p>
        ${dueHtml}
      `;
      listEl.appendChild(li);
    });
  }

  // ---------- Money (お金) ----------
  const moneyForm = document.getElementById('money-form');
  const moneyTypeInput = document.getElementById('money-type');
  const moneyCategorySelect = document.getElementById('money-category');
  const moneyDateInput = document.getElementById('money-date');
  const moneyAmountInput = document.getElementById('money-amount');
  const moneyNoteInput = document.getElementById('money-note');

  function categoriesFor(type) {
    return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  }

  function populateCategorySelect(type) {
    moneyCategorySelect.innerHTML = '';
    categoriesFor(type).forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.icon} ${c.label}`;
      moneyCategorySelect.appendChild(opt);
    });
  }

  document.querySelectorAll('#money-type-toggle .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#money-type-toggle .seg-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      moneyTypeInput.value = btn.dataset.type;
      populateCategorySelect(btn.dataset.type);
    });
  });

  moneyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(moneyAmountInput.value);
    if (!amount || amount <= 0) return;
    state.transactions.push({
      id: uid(),
      type: moneyTypeInput.value,
      amount,
      category: moneyCategorySelect.value,
      date: moneyDateInput.value || todayStr(),
      note: moneyNoteInput.value.trim(),
      createdAt: Date.now(),
    });
    save();
    moneyAmountInput.value = '';
    moneyNoteInput.value = '';
    renderMoney();
  });

  function categoryInfo(type, id) {
    return categoriesFor(type).find((c) => c.id === id) || { label: 'その他', icon: '📦' };
  }

  function renderMoney() {
    moneyDateInput.value = moneyDateInput.value || todayStr();

    const today = todayStr();
    const monthPrefix = today.slice(0, 7);
    const monthTx = state.transactions.filter((t) => t.date.startsWith(monthPrefix));
    const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    document.getElementById('summary-income').textContent = formatYen(income);
    document.getElementById('summary-expense').textContent = formatYen(expense);
    document.getElementById('summary-balance').textContent = formatYen(income - expense);

    const breakdownEl = document.getElementById('category-breakdown');
    breakdownEl.innerHTML = '';
    const byCat = {};
    monthTx.filter((t) => t.type === 'expense').forEach((t) => {
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    });
    const sortedCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    if (sortedCats.length === 0) {
      breakdownEl.innerHTML = '<li class="empty-hint">今月の支出はまだありません</li>';
    } else {
      sortedCats.forEach(([catId, amt]) => {
        const info = categoryInfo('expense', catId);
        const li = document.createElement('li');
        li.innerHTML = `<span>${info.icon} ${info.label}</span><span>${formatYen(amt)}</span>`;
        breakdownEl.appendChild(li);
      });
    }

    const listEl = document.getElementById('money-list');
    listEl.innerHTML = '';
    if (state.transactions.length === 0) {
      listEl.innerHTML = '<p class="empty-hint">まだ記録がありません</p>';
      return;
    }
    const sorted = [...state.transactions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
    sorted.forEach((t) => {
      const info = categoryInfo(t.type, t.category);
      const entry = document.createElement('div');
      entry.className = 'money-entry';
      entry.innerHTML = `
        <div class="money-cat-icon">${info.icon}</div>
        <div class="money-info">
          <div class="money-cat">${info.label}</div>
          <div class="money-note">${escapeHtml(t.note || formatDateLabel(t.date))}</div>
        </div>
        <div class="money-amount ${t.type}">${t.type === 'expense' ? '-' : '+'}${formatYen(t.amount)}</div>
        <button class="icon-btn" data-del-tx="${t.id}">✕</button>
      `;
      listEl.appendChild(entry);
    });
  }

  document.getElementById('money-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del-tx]');
    if (!btn) return;
    if (!confirm('この記録を削除しますか？')) return;
    const idx = state.transactions.findIndex((t) => t.id === btn.dataset.delTx);
    if (idx !== -1) state.transactions.splice(idx, 1);
    save();
    renderMoney();
  });

  // ---------- Shopping (買い物) ----------
  const shoppingForm = document.getElementById('shopping-form');
  const shoppingItemInput = document.getElementById('shopping-item');

  shoppingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addShoppingItem(shoppingItemInput.value);
    shoppingItemInput.value = '';
  });

  function addShoppingItem(rawName) {
    const name = rawName.trim();
    if (!name) return;
    const existing = state.shopping.find((i) => i.name === name && !i.checked);
    if (existing) {
      renderShopping();
      return;
    }
    state.shopping.push({ id: uid(), name, checked: false, createdAt: Date.now() });
    state.shoppingFreq[name] = (state.shoppingFreq[name] || 0) + 1;
    save();
    renderShopping();
  }

  document.getElementById('shopping-list').addEventListener('click', (e) => {
    const delBtn = e.target.closest('[data-del-item]');
    if (delBtn) {
      const idx = state.shopping.findIndex((i) => i.id === delBtn.dataset.delItem);
      if (idx !== -1) state.shopping.splice(idx, 1);
      save();
      renderShopping();
      return;
    }
    const checkBtn = e.target.closest('[data-toggle-item]');
    if (checkBtn) {
      const item = state.shopping.find((i) => i.id === checkBtn.dataset.toggleItem);
      if (item) item.checked = !item.checked;
      save();
      renderShopping();
    }
  });

  document.getElementById('clear-checked-btn').addEventListener('click', () => {
    const doneItems = state.shopping.filter((i) => i.checked);
    if (doneItems.length === 0) return;
    state.records.push({
      id: uid(),
      date: todayStr(),
      time: nowTimeStr(),
      text: `🛒 買い物: ${doneItems.map((i) => i.name).join('、')}`,
      createdAt: Date.now(),
    });
    state.shopping = state.shopping.filter((i) => !i.checked);
    save();
    renderShopping();
  });

  document.getElementById('quick-add-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip]');
    if (!chip) return;
    addShoppingItem(chip.dataset.chip);
  });

  function renderShopping() {
    const currentNames = new Set(state.shopping.filter((i) => !i.checked).map((i) => i.name));
    const freqEntries = Object.entries(state.shoppingFreq)
      .filter(([name]) => !currentNames.has(name))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const chipCard = document.getElementById('quick-add-card');
    const chipRow = document.getElementById('quick-add-chips');
    if (freqEntries.length === 0) {
      chipCard.style.display = 'none';
    } else {
      chipCard.style.display = '';
      chipRow.innerHTML = '';
      freqEntries.forEach(([name]) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.dataset.chip = name;
        chip.textContent = name;
        chipRow.appendChild(chip);
      });
    }

    const listEl = document.getElementById('shopping-list');
    listEl.innerHTML = '';
    if (state.shopping.length === 0) {
      listEl.innerHTML = '<li class="empty-hint">リストは空です</li>';
      return;
    }
    const sorted = [...state.shopping].sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return b.createdAt - a.createdAt;
    });
    sorted.forEach((item) => {
      const { colorClass, rot } = noteStyle(item.id);
      const li = document.createElement('li');
      li.className = `sticky-note shopping-note ${colorClass}` + (item.checked ? ' checked' : '');
      li.style.setProperty('--rot', `${rot}deg`);
      li.dataset.toggleItem = item.id;
      li.innerHTML = `
        <button class="note-del" data-del-item="${item.id}">✕</button>
        <p class="note-text">${escapeHtml(item.name)}</p>
      `;
      listEl.appendChild(li);
    });
  }

  // ---------- Backup (エクスポート/インポート) ----------
  function exportState() {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jiko-kanri-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importStateFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        alert('ファイルの読み込みに失敗しました。正しいバックアップファイル（.json）か確認してください。');
        return;
      }
      if (!confirm('現在のデータを上書きしてバックアップを復元します。よろしいですか？')) return;
      const normalized = normalizeState(parsed);
      state.records = normalized.records;
      state.transactions = normalized.transactions;
      state.shopping = normalized.shopping;
      state.shoppingFreq = normalized.shoppingFreq;
      state.todos = normalized.todos;
      save();
      renderHome();
      renderLog();
      renderTodo();
      renderMoney();
      renderShopping();
      alert('データを復元しました。');
    };
    reader.readAsText(file);
  }

  document.getElementById('export-btn').addEventListener('click', exportState);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importStateFromFile(file);
    e.target.value = '';
  });

  // ---------- Init ----------
  function updateTodayBadge() {
    const d = new Date();
    const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    document.getElementById('today-badge').textContent = `${d.getMonth() + 1}/${d.getDate()}(${wd})`;
  }

  function init() {
    updateTodayBadge();
    logDateInput.value = todayStr();
    moneyDateInput.value = todayStr();
    populateCategorySelect('expense');
    renderHome();
    renderCalendar();
    renderLog();
    renderHabit();
    renderTodo();
    renderMoney();
    renderShopping();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  init();
})();
