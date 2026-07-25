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

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { records: [], transactions: [], shopping: [], shoppingFreq: {}, todos: [] };
      const parsed = JSON.parse(raw);
      return {
        records: parsed.records || [],
        transactions: parsed.transactions || [],
        shopping: parsed.shopping || [],
        shoppingFreq: parsed.shoppingFreq || {},
        todos: parsed.todos || [],
      };
    } catch (e) {
      console.error('failed to load state', e);
      return { records: [], transactions: [], shopping: [], shoppingFreq: {}, todos: [] };
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

  // ---------- View switching ----------
  const VIEWS = ['home', 'log', 'todo', 'money', 'shopping'];
  const PAGE_TITLES = { home: 'ホーム', log: '記録', todo: 'やることリスト', money: 'お金', shopping: '買い物リスト' };

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
    if (name === 'log') renderLog();
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
    const listEl = document.getElementById('log-list');
    listEl.innerHTML = '';
    if (state.records.length === 0) {
      listEl.innerHTML = '<p class="empty-hint">まだ記録がありません。今日できたことを書いてみましょう。</p>';
      return;
    }
    const sorted = [...state.records].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
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
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `
          <span class="log-time">${r.time}</span>
          <span class="log-text">${escapeHtml(r.text)}</span>
          <button class="icon-btn" data-del-record="${r.id}">✕</button>
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
    const checkBtn = e.target.closest('[data-toggle-todo]');
    if (checkBtn) {
      const item = state.todos.find((t) => t.id === checkBtn.dataset.toggleTodo);
      if (item) item.checked = !item.checked;
      save();
      renderTodo();
      return;
    }
    const delBtn = e.target.closest('[data-del-todo]');
    if (delBtn) {
      const idx = state.todos.findIndex((t) => t.id === delBtn.dataset.delTodo);
      if (idx !== -1) state.todos.splice(idx, 1);
      save();
      renderTodo();
    }
  });

  document.getElementById('clear-done-todo-btn').addEventListener('click', () => {
    const hasChecked = state.todos.some((t) => t.checked);
    if (!hasChecked) return;
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
      const li = document.createElement('li');
      li.className = 'check-item' + (t.checked ? ' checked' : '');
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
        <div class="check-box" data-toggle-todo="${t.id}">${t.checked ? '✓' : ''}</div>
        <div class="check-name">${escapeHtml(t.text)}</div>
        ${dueHtml}
        <button class="icon-btn" data-del-todo="${t.id}">✕</button>
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
    const checkBtn = e.target.closest('[data-toggle-item]');
    if (checkBtn) {
      const item = state.shopping.find((i) => i.id === checkBtn.dataset.toggleItem);
      if (item) item.checked = !item.checked;
      save();
      renderShopping();
      return;
    }
    const delBtn = e.target.closest('[data-del-item]');
    if (delBtn) {
      const idx = state.shopping.findIndex((i) => i.id === delBtn.dataset.delItem);
      if (idx !== -1) state.shopping.splice(idx, 1);
      save();
      renderShopping();
    }
  });

  document.getElementById('clear-checked-btn').addEventListener('click', () => {
    const hasChecked = state.shopping.some((i) => i.checked);
    if (!hasChecked) return;
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
      const li = document.createElement('li');
      li.className = 'check-item' + (item.checked ? ' checked' : '');
      li.innerHTML = `
        <div class="check-box" data-toggle-item="${item.id}">${item.checked ? '✓' : ''}</div>
        <div class="check-name">${escapeHtml(item.name)}</div>
        <button class="icon-btn" data-del-item="${item.id}">✕</button>
      `;
      listEl.appendChild(li);
    });
  }

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
    renderLog();
    renderTodo();
    renderMoney();
    renderShopping();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  init();
})();
