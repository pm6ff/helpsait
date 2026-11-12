// app.js
const API = 'api.php';
let currentUser = null;

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

function layout(page, content){
  const tabs = NAV.map(n => `<a href="${n.href}" class="${n.page===page?'on':''}">${n.label}</a>`).join('');
  const who = currentUser ? `<div class="who"><b>${esc(currentUser.name)}</b><button class="ghost" id="logout">Выйти</button></div>` : `<div class="who"><a class="ghost" href="index.html">Войти</a></div>`;

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

// --- ЛОГИН И РЕГИСТРАЦИЯ ---
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
  const urlParams = new URLSearchParams(window.location.search);
  const query = new URLSearchParams({ q: urlParams.get('q')||'', type: urlParams.get('type')||'', category: urlParams.get('category')||'', sort: urlParams.get('sort')||'created_at_desc' }).toString();
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

  layout('homework', `
    <h1>Каталог публикаций</h1>
    <form class="toolbar" method="GET" action="homework.html" style="margin-bottom: 20px; padding: 15px; background: #fff; border-radius: 10px; border: 1px solid #ddd;">
      <input type="text" name="q" placeholder="Поиск..." value="${esc(urlParams.get('q')||'')}" style="flex:1;">
      <select name="type"><option value="">Все типы</option><option value="exam" ${urlParams.get('type')==='exam'?'selected':''}>Экзамены</option><option value="help" ${urlParams.get('type')==='help'?'selected':''}>Помощь</option></select>
      <select name="sort"><option value="created_at_desc" ${urlParams.get('sort')==='created_at_desc'?'selected':''}>Сначала новые</option><option value="created_at_asc" ${urlParams.get('sort')==='created_at_asc'?'selected':''}>Сначала старые</option></select>
      <button class="primary" type="submit">Найти</button>
      <a href="homework.html" class="btn" style="text-decoration:none;">Сброс</a>
    </form>
    <button class="primary" onclick="showNewForm()" style="margin-bottom:20px;">+ Создать</button>
    <div id="newWrap"></div><div id="editWrap"></div>
    <div class="list">${cards || '<div class="empty">Ничего не найдено</div>'}</div>
  `);
}

// --- ЛИЧНЫЙ КАБИНЕТ (ВХОДЯЩИЕ / ИСХОДЯЩИЕ) ---
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
          <span>${statusChip}</span>
        </div>
        <p>${esc(r.message)}</p>
        ${isIncoming && r.sender_telegram && r.status==='accepted' ? `<p><b>Telegram:</b> ${esc(r.sender_telegram)}</p>` : ''}
        ${actions}
      </div>
    </article>`;
  };

  layout('cabinet', `
    <h1>Личный кабинет</h1>
    <h2>Входящие заявки</h2>
    <div class="list">${data.incoming.length ? data.incoming.map(r => renderReq(r, true)).join('') : '<div class="empty">Нет входящих</div>'}</div>
    
    <h2 style="margin-top:40px;">Исходящие заявки</h2>
    <div class="list">${data.outgoing.length ? data.outgoing.map(r => renderReq(r, false)).join('') : '<div class="empty">Нет исходящих</div>'}</div>
  `);
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

// --- CRUD ПУБЛИКАЦИЙ ---
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
    <div class="meta" style="margin-bottom:20px"><span>ID: ${user.id}</span><span>На сайте с: ${esc(user.created_at)}</span></div>
    <form class="form" id="profileForm">
      <div class="row"><label>Имя<input name="name" value="${esc(user.name)}" required></label><label>Email<input value="${esc(user.email)}" disabled></label></div>
      <label>О себе<textarea name="bio" rows="3">${esc(user.bio||'')}</textarea></label>
      <label>Навыки<input name="skills" value="${esc(user.skills||'')}"></label>
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

const page = document.body.dataset.page;
if(page === 'login') renderLogin();
else if(page === 'homework') renderHomework();
else if(page === 'cabinet') renderCabinet();
else if(page === 'profile') renderProfile();
