(() => {
  'use strict';

  const STORAGE_KEY = 'casa_app_data_v2';
  const THEME_KEY = 'casa_app_theme';

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MESES_ABR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

  const GASTO_CATEGORIAS = [
    { label: 'Gasolina/Transporte', icon: '⛽' },
    { label: 'Comida', icon: '🍔' },
    { label: 'Bebidas/Antojos', icon: '🥤' },
    { label: 'Renta/Servicios', icon: '🏠' },
    { label: 'Internet/Streaming', icon: '🌐' },
    { label: 'Salud', icon: '💊' },
    { label: 'Ropa/Personal', icon: '👕' },
    { label: 'Entretenimiento', icon: '🎬' },
    { label: 'Otro', icon: '✨' }
  ];
  const CAT_ICON = Object.fromEntries(GASTO_CATEGORIAS.map(c => [c.label, c.icon]));

  // Mapeo de categorías de artículos (Hoy/Después) -> categorías de gasto,
  // usado cuando un artículo comprado en "Hoy" se convierte en gasto automático.
  const ITEM_TO_GASTO_CAT = {
    '🛒 General': 'Otro',
    '🥦 Despensa': 'Comida',
    '🧴 Limpieza': 'Otro',
    '💊 Salud': 'Salud',
    '👕 Personal': 'Ropa/Personal',
    '🏠 Hogar': 'Renta/Servicios',
    '✨ Otro': 'Otro'
  };
  function mapItemCatToGastoCat(cat) { return ITEM_TO_GASTO_CAT[cat] || 'Otro'; }

  const today = new Date();

  let data = loadData();
  let doneOpen = { hoy: false, despues: false };
  let gv = { mode: 'mes', year: today.getFullYear(), month: today.getMonth() + 1 };

  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => root.querySelectorAll(sel);

  // ================= STORAGE =================
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          hoy: Array.isArray(p.hoy) ? p.hoy : [],
          despues: Array.isArray(p.despues) ? p.despues : [],
          gastos: Array.isArray(p.gastos) ? p.gastos : []
        };
      }
    } catch (e) { /* corrupt data, start fresh */ }
    return { hoy: [], despues: [], gastos: [] };
  }
  function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

  // ================= HELPERS =================
  function fmtMoney(n) {
    return 'MX$' + (n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
  function isoDate(year, month, day) { return `${year}-${pad(month)}-${pad(day)}`; }
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  function uid() { return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

  // ================= DATE HEADER =================
  function initDate() {
    const el = $('todayDate');
    if (el) el.textContent = `${DIAS[today.getDay()]}, ${today.getDate()} de ${MESES[today.getMonth()]}`;
  }

  // ================= THEME =================
  function initTheme() {
    setTheme(localStorage.getItem(THEME_KEY) || 'dark');
  }
  function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }
  function toggleTheme() {
    setTheme(document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  }

  // ================= NAV =================
  function switchSection(section) {
    $$('.panel').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== section));
    $$('.side-link').forEach(b => {
      const on = b.dataset.section === section;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.mobile-link').forEach(b => b.classList.toggle('active', b.dataset.section === section));
  }

  // ================= SHOPPING LISTS (hoy / despues) =================
  function openItemForm(tab) {
    const form = $(`itemForm-${tab}`);
    delete form.dataset.editingId;
    form.querySelector('.btn-primary').textContent = 'Guardar artículo';
    form.classList.remove('hidden');
  }
  function closeItemForm(tab) {
    const form = $(`itemForm-${tab}`);
    form.classList.add('hidden');
    form.querySelector('.f-nombre').value = '';
    form.querySelector('.f-cantidad').value = 1;
    form.querySelector('.f-precio').value = '';
    form.querySelector('.f-notas').value = '';
    form.querySelector('.f-categoria').selectedIndex = 0;
    delete form.dataset.editingId;
    form.querySelector('.btn-primary').textContent = 'Guardar artículo';
  }
  function openEditItem(tab, item) {
    const form = $(`itemForm-${tab}`);
    form.dataset.editingId = item.id;
    form.querySelector('.f-nombre').value = item.nombre;
    form.querySelector('.f-cantidad').value = item.cantidad;
    form.querySelector('.f-precio').value = item.precio != null ? item.precio : '';
    form.querySelector('.f-categoria').value = item.categoria;
    form.querySelector('.f-notas').value = item.notas || '';
    form.querySelector('.btn-primary').textContent = 'Guardar cambios';
    form.classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function addItem(tab) {
    const form = $(`itemForm-${tab}`);
    const nombre = form.querySelector('.f-nombre').value.trim();
    if (!nombre) return;

    const cantidad = parseInt(form.querySelector('.f-cantidad').value, 10) || 1;
    const precio = form.querySelector('.f-precio').value ? parseFloat(form.querySelector('.f-precio').value) : null;
    const categoria = form.querySelector('.f-categoria').value;
    const notas = form.querySelector('.f-notas').value.trim();

    const editingId = form.dataset.editingId;
    if (editingId) {
      const item = data[tab].find(i => i.id === editingId);
      if (item) {
        item.nombre = nombre;
        item.cantidad = cantidad;
        item.precio = precio;
        item.categoria = categoria;
        item.notas = notas;
        // si el artículo ya generó un gasto automático, mantenlo sincronizado
        if (item.gastoId) {
          const gasto = data.gastos.find(g => g.id === item.gastoId);
          if (gasto) {
            gasto.nombre = nombre;
            gasto.monto = precio ? precio * cantidad : gasto.monto;
            gasto.categoria = mapItemCatToGastoCat(categoria);
          }
        }
      }
    } else {
      data[tab].push({
        id: uid(),
        nombre,
        cantidad,
        precio,
        categoria,
        notas,
        comprado: false,
        gastoId: null,
        createdAt: Date.now()
      });
    }

    saveData();
    closeItemForm(tab);
    renderList(tab);
    if (editingId) renderGastos();
  }

  function deleteItem(tab, id) {
    const item = data[tab].find(i => i.id === id);
    if (item && item.gastoId) {
      data.gastos = data.gastos.filter(g => g.id !== item.gastoId);
    }
    data[tab] = data[tab].filter(i => i.id !== id);
    saveData();
    renderList(tab);
    renderGastos();
  }

  function markBought(tab, id) {
    const item = data[tab].find(i => i.id === id);
    if (!item || item.comprado) return;
    item.comprado = true;

    // Al comprar un artículo de HOY con precio, se registra como gasto automáticamente.
    if (tab === 'hoy' && item.precio) {
      const gasto = {
        id: uid(),
        categoria: mapItemCatToGastoCat(item.categoria),
        nombre: item.nombre,
        monto: item.precio * (item.cantidad || 1),
        fecha: isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate()),
        nota: item.notas || '',
        createdAt: Date.now(),
        fromItemId: item.id
      };
      data.gastos.push(gasto);
      item.gastoId = gasto.id;
    }

    saveData();
    renderList(tab);
    if (tab === 'hoy') renderGastos();
  }

  function unmarkBought(tab, id) {
    const item = data[tab].find(i => i.id === id);
    if (!item || !item.comprado) return;
    item.comprado = false;

    if (item.gastoId) {
      data.gastos = data.gastos.filter(g => g.id !== item.gastoId);
      item.gastoId = null;
    }

    saveData();
    renderList(tab);
    if (tab === 'hoy') renderGastos();
  }

  function renderList(tab) {
    const items = data[tab];
    const pending = items.filter(i => !i.comprado);
    const done = items.filter(i => i.comprado);

    if (tab === 'hoy') {
      const total = items.length;
      const doneCount = done.length;
      const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
      $('hoyPct').textContent = pct + '%';
      $('hoyDone').textContent = doneCount;
      $('hoyTotal').textContent = total;
      $('hoyProgressFill').style.width = pct + '%';
      const estimado = items.reduce((s, i) => s + (i.precio ? i.precio * i.cantidad : 0), 0);
      $('hoyEstimado').textContent = fmtMoney(estimado);
    }

    const grid = $(`pendingGrid-${tab}`);
    const empty = $(`emptyState-${tab}`);
    grid.innerHTML = '';
    if (items.length === 0) {
      empty.classList.remove('hidden');
      grid.classList.add('hidden');
    } else {
      empty.classList.add('hidden');
      grid.classList.remove('hidden');
      pending.sort((a, b) => b.createdAt - a.createdAt).forEach(item => grid.appendChild(buildItemCard(tab, item)));
      if (pending.length === 0) {
        grid.innerHTML = `<p style="color:var(--text-dim);font-size:13px;grid-column:1/-1;">Todo comprado por aquí ✅</p>`;
      }
    }

    const doneSection = $(`doneSection-${tab}`);
    const doneGrid = $(`doneGrid-${tab}`);
    if (done.length > 0) {
      doneSection.classList.remove('hidden');
      $(`doneToggleLabel-${tab}`).textContent = `Comprados (${done.length})`;
      doneGrid.innerHTML = '';
      done.sort((a, b) => b.createdAt - a.createdAt).forEach(item => doneGrid.appendChild(buildItemCard(tab, item)));
    } else {
      doneSection.classList.add('hidden');
    }
    doneGrid.classList.toggle('hidden', !doneOpen[tab]);
    const chevBtn = document.querySelector(`[data-done-toggle="${tab}"]`);
    if (chevBtn) chevBtn.classList.toggle('open', doneOpen[tab]);
  }

  function buildItemCard(tab, item) {
    const card = document.createElement('div');
    card.className = 'item-card' + (item.comprado ? ' bought' : '');
    card.style.position = 'relative';
    const metaParts = [`x${item.cantidad}`];
    if (item.precio) metaParts.push(`MX$${item.precio.toFixed(2)}`);
    card.innerHTML = `
      <button class="edit-btn" aria-label="Editar" style="position:absolute; top:8px; right:32px; background:transparent; border:none; cursor:pointer; color:var(--text-dim); padding:4px; display:flex; z-index:2;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="delete-btn" aria-label="Eliminar">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
      </button>
      <span class="item-cat">${escapeHtml(item.categoria)}</span>
      <p class="item-name">${escapeHtml(item.nombre)}</p>
      <div class="item-meta">${metaParts.map((m, idx) => idx === 0 ? m : `<span class="dot">·</span>${m}`).join(' ')}</div>
      ${item.notas ? `<p class="item-notes">"${escapeHtml(item.notas)}"</p>` : ''}
      ${tab === 'hoy' && item.gastoId ? `<p class="item-notes" style="opacity:.7;">💸 Registrado en gastos</p>` : ''}
      <div class="item-status">
        <span class="status-text">${item.comprado ? 'Comprado' : 'Pendiente'}</span>
        <span class="check-circle"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#06120b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </div>`;
    card.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); deleteItem(tab, item.id); });
    card.querySelector('.edit-btn').addEventListener('click', (e) => { e.stopPropagation(); openEditItem(tab, item); });
    card.addEventListener('click', () => markBought(tab, item.id));
    card.addEventListener('dblclick', () => unmarkBought(tab, item.id));
    return card;
  }

  function bindListEvents(tab) {
    $$(`[data-open-item-form="${tab}"]`).forEach(b => b.addEventListener('click', () => openItemForm(tab)));
    const cancelBtn = document.querySelector(`[data-cancel-item-form="${tab}"]`);
    if (cancelBtn) cancelBtn.addEventListener('click', () => closeItemForm(tab));
    $(`itemForm-${tab}`).addEventListener('submit', (e) => { e.preventDefault(); addItem(tab); });
    const doneBtn = document.querySelector(`[data-done-toggle="${tab}"]`);
    if (doneBtn) doneBtn.addEventListener('click', () => { doneOpen[tab] = !doneOpen[tab]; renderList(tab); });
  }

  // ================= GASTOS =================
  function filterByMonth(year, month) {
    const prefix = `${year}-${pad(month)}`;
    return data.gastos.filter(g => g.fecha.startsWith(prefix));
  }
  function filterByYear(year) {
    const prefix = `${year}-`;
    return data.gastos.filter(g => g.fecha.startsWith(prefix));
  }
  function sumGastos(list) { return list.reduce((s, g) => s + g.monto, 0); }
  function catTotals(list) {
    const map = {};
    list.forEach(g => { map[g.categoria] = (map[g.categoria] || 0) + g.monto; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  function switchGview(mode) {
    gv.mode = mode;
    $$('.pill').forEach(p => p.classList.toggle('active', p.dataset.gview === mode));
    $('gview-mes').classList.toggle('hidden', mode !== 'mes');
    $('gview-año').classList.toggle('hidden', mode !== 'año');
    renderGastos();
  }

  function renderGastos() {
    if (gv.mode === 'mes') {
      $('gastosTitle').textContent = `${MESES[gv.month - 1]} ${gv.year}`;
      renderMesView();
    } else {
      $('gastosTitle').textContent = `Año ${gv.year}`;
      renderAñoView();
    }
  }

  function renderMesView() {
    $('mesLabel').textContent = `${MESES[gv.month - 1]} ${gv.year}`;
    const list = filterByMonth(gv.year, gv.month);
    const total = sumGastos(list);
    const dim = daysInMonth(gv.year, gv.month);
    const isCurrentMonth = gv.year === today.getFullYear() && gv.month === today.getMonth() + 1;
    const elapsedDays = isCurrentMonth ? today.getDate() : dim;
    const promedio = total / (elapsedDays || 1);

    $('kpiMesTotal').textContent = fmtMoney(total);
    $('kpiMesPromedio').textContent = fmtMoney(promedio);

    const cats = catTotals(list);
    $('kpiMesTop').textContent = cats.length ? `${CAT_ICON[cats[0][0]] || '✨'} ${cats[0][0]}` : '—';

    // category breakdown
    const catEl = $('catBreakdown');
    const catEmpty = $('catBreakdownEmpty');
    catEl.innerHTML = '';
    if (cats.length === 0) {
      catEmpty.classList.remove('hidden');
    } else {
      catEmpty.classList.add('hidden');
      const max = cats[0][1];
      cats.forEach(([label, amt]) => {
        const row = document.createElement('div');
        row.className = 'cat-row';
        row.innerHTML = `
          <span class="cat-icon">${CAT_ICON[label] || '✨'}</span>
          <div class="cat-info">
            <div class="cat-top"><span class="cat-name">${escapeHtml(label)}</span><span class="cat-amt">${fmtMoney(amt)}</span></div>
            <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(amt / max * 100).toFixed(1)}%"></div></div>
          </div>`;
        catEl.appendChild(row);
      });
    }

    // day chart
    const dayEl = $('dayChart');
    dayEl.innerHTML = '';
    const dayTotals = Array.from({ length: dim }, (_, i) => {
      const d = i + 1;
      const dateStr = isoDate(gv.year, gv.month, d);
      return sumGastos(list.filter(g => g.fecha === dateStr));
    });
    const maxDay = Math.max(...dayTotals, 1);
    dayTotals.forEach((amt, i) => {
      const d = i + 1;
      const isToday = isCurrentMonth && d === today.getDate();
      const wrap = document.createElement('div');
      wrap.className = 'day-bar-wrap';
      wrap.title = `${d} ${MESES_ABR[gv.month - 1]}: ${fmtMoney(amt)}`;
      wrap.innerHTML = `<div class="day-bar${isToday ? ' today' : ''}" style="height:${amt > 0 ? Math.max(amt / maxDay * 100, 4) : 2}%"></div>`;
      dayEl.appendChild(wrap);
    });

    // movements
    const mvEl = $('movementsList');
    const mvEmpty = $('movementsEmpty');
    mvEl.innerHTML = '';
    if (list.length === 0) {
      mvEmpty.classList.remove('hidden');
    } else {
      mvEmpty.classList.add('hidden');
      list.slice().sort((a, b) => (b.fecha + b.createdAt).localeCompare(a.fecha + a.createdAt))
        .forEach(g => mvEl.appendChild(buildMovementRow(g)));
    }

    // default date for the add form
    const fechaInput = $('gFecha');
    if (fechaInput) fechaInput.value = isCurrentMonth ? isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate()) : isoDate(gv.year, gv.month, 1);
  }

  function buildMovementRow(g) {
    const row = document.createElement('div');
    row.className = 'mv-row';
    const d = new Date(g.fecha + 'T00:00:00');
    const fechaFmt = `${d.getDate()} ${MESES_ABR[d.getMonth()]}`;
    const titulo = g.nombre ? g.nombre : g.categoria;
    const subtitulo = [g.nombre ? g.categoria : null, fechaFmt, g.nota || null].filter(Boolean).join(' · ');
    row.innerHTML = `
      <span class="mv-icon">${CAT_ICON[g.categoria] || '✨'}</span>
      <div class="mv-info">
        <div class="mv-cat">${escapeHtml(titulo)}</div>
        <div class="mv-meta">${escapeHtml(subtitulo)}</div>
      </div>
      <span class="mv-amt">${fmtMoney(g.monto)}</span>
      <button class="mv-edit" aria-label="Editar" style="background:transparent; border:none; cursor:pointer; color:var(--text-dim); padding:4px; display:flex;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="mv-delete" aria-label="Eliminar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>`;
    row.querySelector('.mv-edit').addEventListener('click', () => openEditGasto(g));
    row.querySelector('.mv-delete').addEventListener('click', () => {
      // si este gasto vino de un artículo de "Hoy", desvincúlalo para no dejar referencias rotas
      if (g.fromItemId) {
        const item = data.hoy.find(i => i.id === g.fromItemId);
        if (item) item.gastoId = null;
      }
      data.gastos = data.gastos.filter(x => x.id !== g.id);
      saveData();
      renderGastos();
      if (g.fromItemId) renderList('hoy');
    });
    return row;
  }

  function renderAñoView() {
    $('añoLabel').textContent = String(gv.year);
    const listYear = filterByYear(gv.year);
    const listPrevYear = filterByYear(gv.year - 1);
    const totalYear = sumGastos(listYear);
    const totalPrevYear = sumGastos(listPrevYear);

    $('kpiAñoTotal').textContent = fmtMoney(totalYear);
    $('kpiAñoPromedio').textContent = fmtMoney(totalYear / 12);

    const cmpEl = $('kpiAñoComparado');
    cmpEl.classList.remove('positive', 'negative');
    if (totalPrevYear === 0) {
      cmpEl.textContent = `Sin datos ${gv.year - 1}`;
    } else {
      const pctChange = ((totalYear - totalPrevYear) / totalPrevYear) * 100;
      const sign = pctChange >= 0 ? '+' : '';
      cmpEl.textContent = `${sign}${pctChange.toFixed(1)}%`;
      cmpEl.classList.add(pctChange <= 0 ? 'positive' : 'negative');
    }

    // year bar chart: 12 months, current year vs previous year
    const curByMonth = Array.from({ length: 12 }, (_, i) => sumGastos(listYear.filter(g => parseInt(g.fecha.slice(5, 7), 10) === i + 1)));
    const prevByMonth = Array.from({ length: 12 }, (_, i) => sumGastos(listPrevYear.filter(g => parseInt(g.fecha.slice(5, 7), 10) === i + 1)));
    const maxVal = Math.max(...curByMonth, ...prevByMonth, 1);

    const chartEl = $('yearChart');
    chartEl.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
      const cur = curByMonth[m - 1];
      const prev = prevByMonth[m - 1];
      const isCurrent = gv.year === today.getFullYear() && m === today.getMonth() + 1;
      const group = document.createElement('div');
      group.className = 'year-bar-group' + (isCurrent ? ' current' : '');
      group.title = `${MESES[m - 1]} ${gv.year}: ${fmtMoney(cur)}${totalPrevYear ? ` · ${MESES[m - 1]} ${gv.year - 1}: ${fmtMoney(prev)}` : ''}`;
      group.innerHTML = `
        <div class="year-bar-stack">
          <div class="year-bar-prev" style="height:${prev > 0 ? Math.max(prev / maxVal * 100, 3) : 0}%"></div>
          <div class="year-bar-cur" style="height:${cur > 0 ? Math.max(cur / maxVal * 100, 3) : 0}%"></div>
        </div>
        <span class="year-bar-label">${MESES_ABR[m - 1]}</span>`;
      group.addEventListener('click', () => {
        gv.month = m;
        switchGview('mes');
      });
      chartEl.appendChild(group);
    }

    // category breakdown for full year
    const catEl = $('catBreakdownYear');
    const catEmpty = $('catBreakdownYearEmpty');
    const cats = catTotals(listYear);
    catEl.innerHTML = '';
    if (cats.length === 0) {
      catEmpty.classList.remove('hidden');
    } else {
      catEmpty.classList.add('hidden');
      const max = cats[0][1];
      cats.forEach(([label, amt]) => {
        const row = document.createElement('div');
        row.className = 'cat-row';
        row.innerHTML = `
          <span class="cat-icon">${CAT_ICON[label] || '✨'}</span>
          <div class="cat-info">
            <div class="cat-top"><span class="cat-name">${escapeHtml(label)}</span><span class="cat-amt">${fmtMoney(amt)}</span></div>
            <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(amt / max * 100).toFixed(1)}%"></div></div>
          </div>`;
        catEl.appendChild(row);
      });
    }
  }

  function addGasto() {
    const categoria = $('gCategoria').value;
    const nombre = $('gDescripcion').value.trim();
    const monto = parseFloat($('gMonto').value);
    const fecha = $('gFecha').value;
    const nota = $('gNota').value.trim();
    if (!categoria || !monto || !fecha) return;

    const form = $('gastoForm');
    const editingId = form.dataset.editingId;
    if (editingId) {
      const g = data.gastos.find(x => x.id === editingId);
      if (g) {
        g.categoria = categoria;
        g.nombre = nombre;
        g.monto = monto;
        g.fecha = fecha;
        g.nota = nota;
      }
    } else {
      data.gastos.push({
        id: uid(),
        categoria,
        nombre,
        monto,
        fecha,
        nota,
        createdAt: Date.now()
      });
    }

    saveData();
    closeGastoForm();
    renderGastos();
  }
  function openGastoForm() {
    const form = $('gastoForm');
    delete form.dataset.editingId;
    form.querySelector('.btn-primary').textContent = 'Guardar gasto';
    form.classList.remove('hidden');
  }
  function closeGastoForm() {
    const form = $('gastoForm');
    form.classList.add('hidden');
    $('gMonto').value = '';
    $('gDescripcion').value = '';
    $('gNota').value = '';
    $('gCategoria').selectedIndex = 0;
    delete form.dataset.editingId;
    form.querySelector('.btn-primary').textContent = 'Guardar gasto';
  }
  function openEditGasto(g) {
    const form = $('gastoForm');
    form.dataset.editingId = g.id;
    $('gCategoria').value = g.categoria;
    $('gDescripcion').value = g.nombre || '';
    $('gMonto').value = g.monto;
    $('gFecha').value = g.fecha;
    $('gNota').value = g.nota || '';
    form.querySelector('.btn-primary').textContent = 'Guardar cambios';
    form.classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function bindGastoEvents() {
    $('gCategoria').innerHTML = GASTO_CATEGORIAS.map(c => `<option value="${c.label}">${c.icon} ${c.label}</option>`).join('');

    $$('.pill').forEach(p => p.addEventListener('click', () => switchGview(p.dataset.gview)));

    $('mesPrev').addEventListener('click', () => { gv.month--; if (gv.month < 1) { gv.month = 12; gv.year--; } renderGastos(); });
    $('mesNext').addEventListener('click', () => { gv.month++; if (gv.month > 12) { gv.month = 1; gv.year++; } renderGastos(); });
    $('verAñoBtn').addEventListener('click', () => switchGview('año'));
    $('añoPrev').addEventListener('click', () => { gv.year--; renderGastos(); });
    $('añoNext').addEventListener('click', () => { gv.year++; renderGastos(); });

    $('openGastoForm').addEventListener('click', openGastoForm);
    $('cancelGastoForm').addEventListener('click', closeGastoForm);
    $('gastoForm').addEventListener('submit', (e) => { e.preventDefault(); addGasto(); });
  }

  // ================= INIT =================
  function bindNavEvents() {
    // Nuevos top links + móviles
    $$('.top-link, .side-link, .mobile-link').forEach(btn => {
      btn.addEventListener('click', () => switchSection(btn.dataset.section));
    });

    $('themeToggle').addEventListener('click', toggleTheme);
    const mobileToggle = $('themeToggleMobile');
    if (mobileToggle) mobileToggle.addEventListener('click', toggleTheme);
  }

  function init() {
    initDate();
    initTheme();
    bindNavEvents();
    bindListEvents('hoy');
    bindListEvents('despues');
    bindGastoEvents();
    renderList('hoy');
    renderList('despues');
    renderGastos();
  }

  init();
})();