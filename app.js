// app.js
const API = 'api.php';
let currentUser = null;

// --- 1. БИБЛИОТЕКИ (Chart.js + Particles) ---
const chartScript = document.createElement('script');
chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
document.head.appendChild(chartScript);

const particlesScript = document.createElement('script');
particlesScript.src = 'https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js';
particlesScript.onload = () => {
  const bgDiv = document.createElement('div');
  bgDiv.id = 'particles-js';
  document.body.prepend(bgDiv);
  
  particlesJS('particles-js', {
    particles: {
      number: { value: 45, density: { enable: true, value_area: 800 } },
      color: { value: ['#8b5cf6', '#3b82f6', '#10b981'] }, // Неоновые цвета
      shape: { type: 'circle' },
      opacity: { value: 0.5, random: true },
      size: { value: 3, random: true },
      line_linked: { enable: true, distance: 150, color: '#8b5cf6', opacity: 0.2, width: 1 },
      move: { enable: true, speed: 1.2, direction: 'none', random: true, out_mode: 'out' }
    },
    interactivity: {
      events: { onhover: { enable: true, mode: 'grab' } },
      modes: { grab: { distance: 140, line_linked: { opacity: 0.5 } } }
    }
  });
};
document.head.appendChild(particlesScript);

const $ = (sel, root=document) => root.querySelector(sel);
const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function api(endpoint, opts={}) {
  const res = await fetch(`${API}?action=${endpoint}`, { headers: {'Content-Type': 'application/json'}, ...opts });
  return res;
}

function toast(msg){
  const t = $('#toast'); if(!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function dateTile(dateStr){
  if(!dateStr) return '<div class="tile"><span>—</span><b>-</b></div>';
  const d = new Date(dateStr);
  const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  return `<div class="tile"><span>${months[d.getMonth()]}</span><b>${d.getDate()}</b></div>`;
}

const NAV = [
  { page:'homework', href:'homework.html', label:'Каталог' },
  { page:'cabinet',  href:'cabinet.html',  label:'Кабинет' },
  { page:'profile',  href:'profile.html',  label:'Профиль' },
];

// --- ТЕМА ---
if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
window.toggleTheme = () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
};

function layout(page, content){
  const tabs = NAV.map(n => `<a href="${n.href}" class="${n.page===page?'on':''}">${n.label}</a>`).join('');
  const who = currentUser 
    ? `<div class="who"><button class="ghost" onclick="toggleTheme()" style="padding: 6px 10px; font-size: 16px;" title="Сменить тему">🌓</button><b>${esc(currentUser.name)}</b><button class="ghost" id="logout">Выйти</button></div>` 
    : `<div class="who"><a class="ghost" href="index.html">Войти</a></div>`;

  $('#app').innerHTML = `
    <header class="topbar"><div class="topbar-inner"><div class="brand">Помогатор<small>колледж.банк</small></div><nav class="tabs">${tabs}</nav>${who}</div></header>
    <main>${content}</main>`;

  const out = $('#logout');
  if(out) out.onclick = async () => { await api('logout', { method:'POST' }); currentUser = null; location.href = 'index.html'; };
}

async function loadMe(){
  const res = await api('me');
  if (res.ok) { currentUser = await res.json(); return currentUser; }
  return null;
}

// --- ЛОГИН / РЕГИСТРАЦИЯ ---
async function renderLogin(){
  await loadMe();
  if (currentUser) { location.href = 'homework.html'; return; }

  $('#app').innerHTML = `
    <div class="login">
      <form class="form" id="loginForm">
        <h1>Вход</h1>
        <label>Email<input name="email" type="email" required value="anna@mail.ru"></label>
        <label>Пароль<input name="pass" type="password" required value="1234"></label>
        <button class="primary" type="submit">Войти</button>
        <p style="text-align:center; margin-top:15px; font-size: 14px;">Нет аккаунта? <a href="#" id="showRegister" style="color: var(--accent); font-weight: 700;">Зарегистрироваться</a></p>
      </form>
      <form class="form" id="registerForm" style="display: none;">
        <h1>Регистрация</h1>
        <label>Имя<input name="name" required></label>
        <label>Email<input name="email" type="email" required></label>
        <label>Пароль<input name="pass" type="password" required></label>
        <label>Telegram<input name="telegram" placeholder="@username"></label>
        <button class="primary" type="submit">Создать</button>
        <p style="text-align:center; margin-top:15px; font-size: 14px;">Есть аккаунт? <a href="#" id="showLogin" style="color: var(--accent); font-weight: 700;">Войти</a></p>
      </form>
    </div>`;

  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const res = await api('login', { method:'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    if (res.ok) location.href = 'homework.html'; else toast('Ошибка входа');
  };
  $('#registerForm').onsubmit = async (e) => {
    e.preventDefault();
    const res = await api('register', { method:'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    if (res.ok) location.href = 'homework.html'; else toast('Ошибка');
  };
  $('#showRegister').onclick = (e) => { e.preventDefault(); $('#loginForm').style.display = 'none'; $('#registerForm').style.display = 'grid'; };
  $('#showLogin').onclick = (e) => { e.preventDefault(); $('#registerForm').style.display = 'none'; $('#loginForm').style.display = 'grid'; };
}

// --- КАТАЛОГ ---
async function renderHomework(){
  await loadMe(); if (!currentUser) return location.href = 'index.html';
  
  layout('homework', `
    <h1>Каталог публикаций</h1>
    
    <form class="toolbar" method="GET" action="homework.html" style="margin-bottom: 20px;">
      <input type="text" name="q" placeholder="Поиск..." value="">
      <select name="type"><option value="">Все типы</option><option value="exam">Экзамены</option><option value="help">Помощь</option></select>
      <select name="sort"><option value="created_at_desc">Сначала новые</option><option value="created_at_asc">Сначала старые</option></select>
      <button class="primary" type="submit">Найти</button>
      <a href="homework.html" class="btn" style="text-decoration:none;">Сброс</a>
    </form>

    <div class="toolbar" style="margin-bottom: 24px; gap: 12px; background:transparent; padding:0; box-shadow:none; border:none;">
      <button class="primary" onclick="showNewForm()">+ Создать</button>
      <button class="btn" style="background: linear-gradient(135deg, #a855f7, #6366f1); color: white; border: none; box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);" onclick="findSmartMatch()">✨ Найти идеальную заявку</button>
    </div>

    <div id="newWrap"></div><div id="editWrap"></div>
    
    <div class="list" id="examsList">
      <div class="card"><div class="tile skeleton"></div><div class="body"><div class="skeleton" style="width:40%; height:20px; margin-bottom:10px;"></div><div class="skeleton" style="width:80%; height:14px; margin-bottom:5px;"></div><div class="skeleton" style="width:60%; height:14px;"></div></div></div>
      <div class="card"><div class="tile skeleton"></div><div class="body"><div class="skeleton" style="width:50%; height:20px; margin-bottom:10px;"></div><div class="skeleton" style="width:90%; height:14px; margin-bottom:5px;"></div><div class="skeleton" style="width:70%; height:14px;"></div></div></div>
    </div>
  `);

  const urlParams = new URLSearchParams(window.location.search);
  const query = new URLSearchParams({ q: urlParams.get('q')||'', type: urlParams.get('type')||'', sort: urlParams.get('sort')||'created_at_desc' }).toString();
  const res = await api(`exams&${query}`);
  const exams = await res.json();

  const cards = exams.map(r => {
    const mine = r.user_id == currentUser.id;
    const chips = r.status==='closed' ? '<span class="chip muted">закрыта</span>' : '<span class="chip">открыта</span>';
    const offerForm = !mine && r.status==='open' ? `
      <details><summary class="btn">Отправить заявку</summary>
        <form class="form" onsubmit="submitRequest(event, ${r.id})">
          <label>Сообщение<textarea name="message" rows="2" required placeholder="Здравствуйте, готов помочь..."></textarea></label>
          <button class="primary" type="submit">Отправить</button>
        </form>
      </details>` : '';

    return `<article class="card">
      ${dateTile(r.created_at)}
      <div class="body">
        <h3>${esc(r.title)}</h3>
        <div class="meta">
          <span><b>Автор:</b> ${esc(r.author_name)}</span>
          <span><b>Категория:</b> ${esc(r.category)}</span>
          <span><b>Дата:</b> ${new Date(r.created_at).toLocaleDateString('ru-RU')}</span>
          ${chips}
        </div>
        <p>${esc(r.description)}</p>
        <div class="actions">
          ${mine ? `<button onclick="editExam(${r.id})">Редактировать</button><button class="danger" onclick="deleteExam(${r.id})">Удалить</button>` : ''}
          ${offerForm}
        </div>
      </div>
    </article>`;
  }).join('');

  document.getElementById('examsList').innerHTML = cards || '<div class="empty">Ничего не найдено</div>';
}

// --- УМНЫЙ ПОДБОР ---
window.findSmartMatch = async () => {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(8px);';
  modal.innerHTML = `
    <div class="glass" style="padding:40px;border-radius:24px;text-align:center;max-width:400px;width:90%;">
      <div style="font-size:50px;margin-bottom:20px;animation: pulse 1.5s infinite;">🧠</div>
      <h2 style="margin:0 0 10px;">Анализируем навыки...</h2>
      <p style="color:var(--muted);margin-bottom:20px;font-size:14px;">Ищем лучшую заявку</p>
      <div style="width:100%;height:6px;background:var(--line);border-radius:3px;overflow:hidden;">
        <div id="smartBar" style="width:0%;height:100%;background:linear-gradient(90deg, #a855f7, #6366f1);transition:width 1.5s ease-in-out;"></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => { document.getElementById('smartBar').style.width = '100%'; }, 100);

  setTimeout(async () => {
    const res = await api('smart_match');
    const data = await res.json();
    
    if (!res.ok) {
      modal.innerHTML = `<div class="glass" style="padding:40px;border-radius:24px;text-align:center;max-width:400px;width:90%;">
          <div style="font-size:50px;margin-bottom:20px;">😔</div>
          <h2 style="margin:0 0 10px;">Увы!</h2>
          <p style="color:var(--muted);margin-bottom:20px;">${data.error}</p>
          <button class="primary" onclick="this.closest('div[style*=fixed]').remove()">Закрыть</button>
        </div>`;
      return;
    }

    modal.innerHTML = `
      <div class="glass" style="padding:30px;border-radius:24px;max-width:500px;width:90%;">
        <h2 style="margin:0 0 15px;color:#a855f7;">✨ Идеальное совпадение!</h2>
        <div class="card" style="margin:0;box-shadow:none;border:2px solid var(--accent);padding:15px;background:transparent;">
          <div class="body">
            <h3 style="margin-bottom:10px;">${esc(data.title)}</h3>
            <div class="meta" style="margin-bottom:10px;">
              <span><b>Автор:</b> ${esc(data.author_name)}</span>
              <span><b>Категория:</b> ${esc(data.category)}</span>
            </div>
            <p style="font-size:14px;color:var(--muted);">${esc(data.description)}</p>
          </div>
        </div>
        <div class="actions" style="margin-top:20px;justify-content:flex-end;gap:10px;">
          <button onclick="this.closest('div[style*=fixed]').remove()">Закрыть</button>
          <button class="primary" onclick="this.closest('div[style*=fixed]').remove(); submitRequest(event, ${data.id})">Откликнуться!</button>
        </div>
      </div>`;
  }, 1500);
};

// --- ЛИЧНЫЙ КАБИНЕТ ---
async function renderCabinet(){
  await loadMe(); if (!currentUser) return location.href = 'index.html';
  const res = await api('my_requests');
  const data = await res.json();

  const renderReq = (r, isIncoming) => {
    let actions = '';
    if (r.status === 'pending') {
      if (isIncoming) {
        actions = `<div class="actions" style="margin-top:10px;">
          <button class="primary" onclick="updateReqStatus(${r.id}, 'accepted')">Принять</button>
          <button class="danger" onclick="updateReqStatus(${r.id}, 'rejected')">Отклонить</button>
        </div>`;
      } else {
        actions = `<div class="actions" style="margin-top:10px;">
          <button onclick="updateReqStatus(${r.id}, 'cancelled')">Отменить</button>
        </div>`;
      }
    }

    const statusChip = {
      'pending': '<span class="chip muted">Ожидает</span>',
      'accepted': '<span class="chip accepted">Принята</span>',
      'rejected': '<span class="chip declined">Отклонена</span>',
      'cancelled': '<span class="chip">Отменена</span>'
    }[r.status];

    return `<article class="card" style="margin-bottom:10px;">
      <div class="body">
        <h3>${esc(r.title)}</h3>
        <div class="meta">
          <span>${isIncoming ? 'От: ' + esc(r.sender_name) : 'Кому: ' + esc(r.receiver_name)}</span>
          ${statusChip}
        </div>
        <p>${esc(r.message)}</p>
        ${isIncoming && r.sender_telegram && r.status==='accepted' ? `<p><b>Telegram:</b> ${esc(r.sender_telegram)}</p>` : ''}
        ${actions}
      </div>
    </article>`;
  };

  const pendingCount = data.incoming.filter(r => r.status === 'pending').length;
  const acceptedCount = data.incoming.filter(r => r.status === 'accepted').length;

  layout('cabinet', `
    <h1>Личный кабинет</h1>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px;" class="stats-grid">
      <div class="card" style="padding:20px; flex-direction:column; align-items:center;">
        <h3 style="margin-top:0; align-self:flex-start;">Статус входящих</h3>
        <div style="width: 200px; height: 200px;">
          <canvas id="chartStatus"></canvas>
        </div>
      </div>
      <div class="card" style="padding:20px; flex-direction:column; justify-content:center;">
        <h3 style="margin-top:0;">Ваша активность</h3>
        <p style="font-size:40px;font-weight:800;margin:10px 0;color:var(--accent);">${data.incoming.length + data.outgoing.length}</p>
        <p style="color:var(--muted);">всего заявок создано</p>
      </div>
    </div>

    <h2>Входящие заявки</h2>
    <div class="list">${data.incoming.length ? data.incoming.map(r => renderReq(r, true)).join('') : '<div class="empty">Нет входящих</div>'}</div>
    
    <h2 style="margin-top:40px;">Исходящие заявки</h2>
    <div class="list">${data.outgoing.length ? data.outgoing.map(r => renderReq(r, false)).join('') : '<div class="empty">Нет исходящих</div>'}</div>
  `);

  setTimeout(() => {
    const ctx = document.getElementById('chartStatus');
    if (ctx && window.Chart) {
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Ожидают', 'Приняты'],
          datasets: [{ data: [pendingCount, acceptedCount], backgroundColor: ['#f59e0b', '#10b981'], borderWidth: 0, hoverOffset: 4 }]
        },
        options: { cutout: '75%', plugins: { legend: { position: 'bottom', labels: { color: getComputedStyle(document.body).getPropertyValue('--muted') } } } }
      });
    }
  }, 100);
}

window.updateReqStatus = async (id, status) => {
  const res = await api('update_request_status', { method:'POST', body: JSON.stringify({ request_id: id, status }) });
  if (res.ok) { toast('Статус обновлён'); renderCabinet(); } else toast('Ошибка');
};

window.submitRequest = async (e, offerId) => {
  e.preventDefault();
  const msg = new FormData(e.target).get('message');
  const res = await api('create_request', { method:'POST', body: JSON.stringify({ offer_id: offerId, message: msg }) });
  const data = await res.json();
  if (res.ok) { toast('Заявка отправлена!'); location.reload(); } 
  else toast(data.error || 'Ошибка');
};

// --- CRUD ---
window.showNewForm = () => {
  $('#newWrap').innerHTML = `<form class="form" onsubmit="createExam(event)"><h2>Новая публикация</h2>
    <div class="row"><label>Заголовок<input name="title" required></label><label>Категория<input name="category" required value="Разное"></label></div>
    <label>Тип<select name="type"><option value="exam">Экзамен</option><option value="help">Помощь</option></select></label>
    <label>Описание<textarea name="description" rows="4" required></textarea></label>
    <button class="primary" type="submit">Создать</button></form>`;
};

window.createExam = async (e) => {
  e.preventDefault();
  await api('create_exam', { method:'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
  location.reload();
};

window.editExam = async (id) => {
  const r = await (await api(`get_exam&id=${id}`)).json();
  $('#editWrap').innerHTML = `<form class="form" onsubmit="updateExam(event, ${id})"><h2>Редактирование</h2>
    <div class="row"><label>Заголовок<input name="title" value="${esc(r.title)}" required></label><label>Категория<input name="category" value="${esc(r.category)}" required></label></div>
    <label>Описание<textarea name="description" rows="4" required>${esc(r.description)}</textarea></label>
    <label>Статус<select name="status"><option value="open" ${r.status==='open'?'selected':''}>Открыта</option><option value="closed" ${r.status==='closed'?'selected':''}>Закрыта</option></select></label>
    <button class="primary" type="submit">Обновить</button></form>`;
  window.scrollTo(0,0);
};

window.updateExam = async (e, id) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target)); data.id = id;
  await api('update_exam', { method:'POST', body: JSON.stringify(data) });
  location.reload();
};

window.deleteExam = async (id) => {
  if (!confirm('Удалить публикацию?')) return;
  await api('delete_exam', { method:'POST', body: JSON.stringify({ id }) });
  location.reload();
};

// --- ПРОФИЛЬ ---
async function renderProfile(){
  await loadMe(); if (!currentUser) return location.href = 'index.html';
  const user = await (await api('me')).json();

  layout('profile', `
    <h1>Профиль</h1>
    <div class="meta" style="margin-bottom:20px;"><span>ID: ${user.id}</span><span>На сайте с: ${esc(user.created_at)}</span></div>
    <form class="form" id="profileForm">
      <div class="row"><label>Имя<input name="name" value="${esc(user.name)}" required></label><label>Email<input value="${esc(user.email)}" disabled></label></div>
      <label>О себе<textarea name="bio" rows="3">${esc(user.bio||'')}</textarea></label>
      <label>Навыки (для умного подбора)<input name="skills" value="${esc(user.skills||'')}" placeholder="математика, программирование"></label>
      <label>Telegram<input name="telegram" value="${esc(user.telegram||'')}"></label>
      <button class="primary" type="submit">Сохранить</button>
    </form>
    <h2>Смена пароля</h2>
    <form class="form" id="passForm">
      <label>Текущий пароль<input type="password" name="oldPass" required></label>
      <label>Новый пароль<input type="password" name="newPass" required minlength="4"></label>
      <button class="primary" type="submit">Сменить пароль</button>
    </form>
  `);

  $('#profileForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const r = await api('update_profile', { method:'POST', body: JSON.stringify({ id: user.id, ...f }) });
    if (r.ok) { toast('Сохранено'); renderProfile(); } else toast('Ошибка');
  };

  $('#passForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const r = await api('change_password', { method:'POST', body: JSON.stringify(f) });
    if (r.ok) { toast('Пароль изменён'); e.target.reset(); } else toast('Ошибка');
  };
}

// --- ОБЩИЙ ЧАТ ---
function initGlobalChat() {
  if (!currentUser || document.getElementById('globalChatWidget')) return;

  const chat = document.createElement('div');
  chat.id = 'globalChatWidget';
  chat.innerHTML = `
    <button id="chatToggle" style="position:fixed; bottom:24px; right:24px; width:60px; height:60px; border-radius:50%; background:linear-gradient(135deg, #6366f1, #a855f7); color:white; font-size:24px; border:none; box-shadow:0 8px 32px rgba(99,102,241,0.4); cursor:pointer; z-index:9998; transition:transform 0.2s;">💬</button>
    
    <div id="chatWindow" class="glass" style="display:none; position:fixed; bottom:100px; right:24px; width:340px; height:480px; border-radius:24px; z-index:9998; flex-direction:column; overflow:hidden; animation: slideUp 0.3s ease-out;">
      <div style="padding:16px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center;">
        <h3 style="margin:0; font-size:16px;">💬 Общий чат</h3>
        <button onclick="document.getElementById('chatWindow').style.display='none'" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--muted);">&times;</button>
      </div>
      <div id="chatMessages" style="flex:1; padding:16px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;"></div>
      <form id="chatForm" style="padding:12px; border-top:1px solid var(--line); display:flex; gap:8px;">
        <input type="text" id="chatInput" placeholder="Написать..." style="flex:1; padding:10px; border:1px solid var(--line); border-radius:10px; outline:none;">
        <button type="submit" class="primary" style="padding:0 16px;">➤</button>
      </form>
    </div>
    <style>@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }</style>
  `;
  document.body.appendChild(chat);

  const chatWindow = document.getElementById('chatWindow');
  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');

  document.getElementById('chatToggle').onclick = () => {
    chatWindow.style.display = chatWindow.style.display === 'none' ? 'flex' : 'none';
    if (chatWindow.style.display === 'flex') loadGlobalMsgs();
  };

  const loadGlobalMsgs = async () => {
    const res = await api('get_global_msgs');
    if (!res.ok) return;
    const msgs = await res.json();
    
    chatMessages.innerHTML = msgs.map(m => {
      const isMe = m.author_id == currentUser.id;
      return `<div style="max-width:80%; padding:10px 14px; border-radius:16px; font-size:13px; display:flex; flex-direction:column;
        ${isMe ? 'background:var(--accent); color:#fff; align-self:flex-end; border-bottom-right-radius:4px;' 
               : 'background:var(--soft); color:var(--ink); align-self:flex-start; border-bottom-left-radius:4px;'}">
        ${!isMe ? `<span style="font-size:10px; color:var(--muted); margin-bottom:4px; font-weight:700;">${esc(m.author)}</span>` : ''}
        ${esc(m.text)}
      </div>`;
    }).join('');
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  chatForm.onsubmit = async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    await api('send_global_msg', { method:'POST', body: JSON.stringify({ text }) });
    loadGlobalMsgs();
  };

  setInterval(() => { if (chatWindow.style.display === 'flex') loadGlobalMsgs(); }, 3000);
}

// --- БОТ-АССИСТЕНТ ---
function initAIBot() {
  if (!currentUser || document.getElementById('aiToggle')) return;

  const botHTML = `
    <button id="aiToggle" title="Бот-помощник" style="position:fixed; bottom:100px; right:24px; width:60px; height:60px; border-radius:50%; background:linear-gradient(135deg, #10b981, #3b82f6); color:white; font-size:26px; border:none; box-shadow:0 8px 32px rgba(16,185,129,0.4); cursor:pointer; z-index:9998; transition:transform 0.2s;">🤖</button>
    <div id="aiWindow" style="display:none; position:fixed; bottom:176px; right:24px; width:360px; height:520px; background:var(--glass-bg); backdrop-filter:blur(24px) saturate(180%); border-radius:24px; border:1px solid var(--glass-border); box-shadow:var(--glass-shadow); z-index:9998; flex-direction:column; overflow:hidden; animation: slideUp 0.3s ease-out;">
      <div style="padding:16px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; background:linear-gradient(90deg, rgba(16,185,129,0.1), rgba(59,130,246,0.1));">
        <h3 style="margin:0; font-size:16px; display:flex; align-items:center; gap:8px;">🤖 Умный Бот</h3>
        <button onclick="document.getElementById('aiWindow').style.display='none'" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--muted);">&times;</button>
      </div>
      <div id="aiMessages" style="flex:1; padding:16px; overflow-y:auto; display:flex; flex-direction:column; gap:12px;">
        <div class="ai-msg bot" style="background:var(--soft); color:var(--ink); padding:12px 16px; border-radius:16px; border-bottom-left-radius:4px; align-self:flex-start; max-width:85%;">Привет! Я твой умный помощник. Я могу найти заявки или даже создать новую. Напиши "Помощь", чтобы узнать, что я умею.</div>
      </div>
      <form id="aiForm" style="padding:12px; border-top:1px solid var(--line); display:flex; gap:8px;">
        <input type="text" id="aiInput" placeholder="Спроси меня..." required autocomplete="off" style="flex:1; padding:10px; border:1px solid var(--line); border-radius:10px;">
        <button type="submit" class="primary" style="padding:0 16px;">➤</button>
      </form>
    </div>
  `;
  const wrap = document.createElement('div');
  wrap.innerHTML = botHTML;
  document.body.appendChild(wrap);

  const aiToggle = document.getElementById('aiToggle');
  const aiWindow = document.getElementById('aiWindow');
  const aiForm = document.getElementById('aiForm');
  const aiInput = document.getElementById('aiInput');
  const aiMessages = document.getElementById('aiMessages');

  aiToggle.onclick = () => {
    aiWindow.style.display = aiWindow.style.display === 'none' ? 'flex' : 'none';
    if (aiWindow.style.display === 'flex') aiInput.focus();
  };

  function addMessage(text, sender) {
    const msg = document.createElement('div');
    msg.style.cssText = `max-width:85%; padding:12px 16px; border-radius:16px; font-size:14px; line-height:1.4; animation: fadeInUp 0.3s ease-out; ${sender==='bot' ? 'background:var(--soft); color:var(--ink); align-self:flex-start; border-bottom-left-radius:4px;' : 'background:var(--accent); color:#fff; align-self:flex-end; border-bottom-right-radius:4px;'}`;
    msg.innerHTML = text;
    aiMessages.appendChild(msg);
    aiMessages.scrollTop = aiMessages.scrollHeight;
  }

  aiForm.onsubmit = async (e) => {
    e.preventDefault();
    const text = aiInput.value.trim();
    if (!text) return;
    
    aiInput.value = '';
    addMessage(esc(text), 'user');

    const lowerText = text.toLowerCase();
    let botReply = '';

    if (lowerText.match(/привет|здравствуй|хай|ку/)) {
      botReply = `Привет, <b>${esc(currentUser.name)}</b>! Чем могу помочь сегодня?`;
    } 
    else if (lowerText.match(/помощь|команды|что умеешь/)) {
      botReply = `Вот что я умею:<br>🔍 <b>"найди [слово]"</b> — поищу заявки.<br>📝 <b>"создай"</b> — помогу создать новую.<br>📊 <b>"статистика"</b> — покажу инфо.<br>📂 <b>"кабинет"</b> или <b>"каталог"</b> — перекину на страницу.`;
    }
    else if (lowerText.match(/создай|добавь|новая заявка/)) {
      botReply = `Отлично! Давай создадим заявку. Что нужно сделать? (Напиши заголовок)`;
      window.botCreatingState = 'title';
    }
    else if (lowerText.match(/кабинет/)) {
      botReply = `Переходим в личный кабинет...`;
      setTimeout(() => location.href = 'cabinet.html', 1000);
    }
    else if (lowerText.match(/каталог|заявки/)) {
      botReply = `Открываю каталог...`;
      setTimeout(() => location.href = 'homework.html', 1000);
    }
    else if (lowerText.startsWith('найди ') || lowerText.startsWith('поиск ')) {
      const query = text.replace(/найди |поиск /gi, '').trim();
      botReply = `Ищу по запросу: <b>"${esc(query)}"</b>...`;
      const res = await api(`exams&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.length === 0) botReply += `<br><br>😔 Увы, ничего не нашёл.`;
      else {
        botReply += `<br><br>Нашёл ${data.length} шт.:`;
        data.slice(0, 3).forEach(item => { botReply += `<br><br>📌 <b>${esc(item.title)}</b><br><span style="font-size:12px;color:var(--muted);">Автор: ${esc(item.author_name)}</span>`; });
        if(data.length > 3) botReply += `<br><br><a href="homework.html?q=${encodeURIComponent(query)}" style="color:var(--accent);">...посмотреть все</a>`;
      }
    }
    else if (lowerText.match(/статистика|сколько/)) {
      const res = await api(`exams`);
      const data = await res.json();
      botReply = `📊 Сейчас на сайте открыто <b>${data.length}</b> заявок. Не сиди без дела, помоги кому-нибудь!`;
    }
    else if (window.botCreatingState === 'title') {
      window.botTempTitle = text;
      window.botCreatingState = 'desc';
      botReply = `Заголовок: "${esc(text)}". Отлично. Теперь напиши описание (детали задачи).`;
    }
    else if (window.botCreatingState === 'desc') {
      const title = window.botTempTitle;
      const desc = text;
      addMessage(`Создаю заявку "${esc(title)}"...`, 'bot');
      await api('create_exam', { method: 'POST', body: JSON.stringify({ title, description: desc, category: 'Разное', type: 'help' }) });
      window.botCreatingState = null;
      window.botTempTitle = null;
      addMessage(`✅ Готово! Заявка создана и опубликована в каталоге!`, 'bot');
      setTimeout(() => location.href = 'homework.html', 1500);
      return;
    }
    else {
      botReply = `Я пока не понимаю эту команду. Напиши <b>"Помощь"</b>, чтобы увидеть список моих возможностей.`;
    }

    setTimeout(() => { addMessage(botReply, 'bot'); }, 600);
  };
}

// --- МАГНИТНЫЕ КНОПКИ ---
document.addEventListener('mousemove', (e) => {
  document.querySelectorAll('.primary, .btn').forEach(btn => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const dist = Math.sqrt(x*x + y*y);
    if (dist < 50) btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    else btn.style.transform = ``;
  });
});

const page = document.body.dataset.page;
if(page === 'login') renderLogin();
else if(page === 'homework') renderHomework();
else if(page === 'cabinet') renderCabinet();
else if(page === 'profile') renderProfile();

// Запускаем виджеты
setTimeout(() => { 
  if(currentUser) {
    initGlobalChat();
    initAIBot();
  }
}, 500);
