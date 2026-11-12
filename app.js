// app.js
const API = 'api.php';
let currentUser = null;

const $ = (sel, root=document) => root.querySelector(sel);
const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function api(endpoint, opts={}) {
  const res = await fetch(`${API}?action=${endpoint}`, {
    headers: {'Content-Type': 'application/json'},
    ...opts
  });
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
  { page:'homework', href:'homework.html', label:'Экзамены' },
  { page:'cabinet',  href:'cabinet.html',  label:'Кабинет' },
  { page:'profile',  href:'profile.html',  label:'Профиль' },
];

function layout(page, content){
  const tabs = NAV.map(n => `<a href="${n.href}" class="${n.page===page?'on':''}">${n.label}</a>`).join('');
  const who = currentUser
    ? `<div class="who"><b>${esc(currentUser.name)}</b><button class="ghost" id="logout">Выйти</button></div>`
    : `<div class="who"><a class="ghost" href="index.html">Войти</a></div>`;

  $('#app').innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand">Помогатор<small>экзамены</small></div>
        <nav class="tabs">${tabs}</nav>
        ${who}
      </div>
    </header>
    <main>${content}</main>`;

  const out = $('#logout');
  if(out) out.onclick = async () => {
    await api('logout', { method:'POST' });
    currentUser = null;
    location.href = 'index.html';
  };
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
        <p>Войдите, чтобы найти помощь с экзаменами.</p>
        <label>Email<input name="email" type="email" required value="anna@mail.ru"></label>
        <label>Пароль<input name="pass" type="password" required value="1234"></label>
        <button class="primary" type="submit">Войти</button>
        <p style="text-align:center; margin-top:15px; font-size: 14px;">
          Нет аккаунта? <a href="#" id="showRegister" style="color: var(--accent); text-decoration: none; font-weight: 700;">Зарегистрироваться</a>
        </p>
      </form>

      <form class="form" id="registerForm" style="display: none;">
        <h1>Регистрация</h1>
        <div class="row">
          <label>Имя<input name="name" required maxlength="60"></label>
          <label>Email<input name="email" type="email" required maxlength="100"></label>
        </div>
        <div class="row">
          <label>Пароль<input name="pass" type="password" required minlength="4"></label>
          <label>Telegram<input name="telegram" placeholder="@username" maxlength="32"></label>
        </div>
        <label>О себе<textarea name="bio" rows="2" maxlength="300"></textarea></label>
        <label>Навыки<input name="skills" maxlength="200"></label>
        <button class="primary" type="submit">Создать аккаунт</button>
        <p style="text-align:center; margin-top:15px; font-size: 14px;">
          Уже есть аккаунт? <a href="#" id="showLogin" style="color: var(--accent); text-decoration: none; font-weight: 700;">Войти</a>
        </p>
      </form>
    </div>`;

  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const { email, pass } = Object.fromEntries(new FormData(e.target));
    const res = await api('login', { method:'POST', body: JSON.stringify({ email, pass }) });
    if (res.ok) location.href = 'homework.html';
    else toast((await res.json()).error || 'Ошибка входа');
  };

  $('#registerForm').onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const res = await api('register', { method:'POST', body: JSON.stringify(data) });
    if (res.ok) location.href = 'homework.html';
    else toast((await res.json()).error || 'Ошибка регистрации');
  };

  $('#showRegister').onclick = (e) => { e.preventDefault(); $('#loginForm').style.display = 'none'; $('#registerForm').style.display = 'grid'; };
  $('#showLogin').onclick = (e) => { e.preventDefault(); $('#registerForm').style.display = 'none'; $('#loginForm').style.display = 'grid'; };
}

// --- CRUD + ПОИСК + ОТКЛИКИ ---
async function renderHomework(){
  await loadMe();
  if (!currentUser) { location.href = 'index.html'; return; }

  // Получаем параметры фильтрации из URL
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get('q') || '';
  const type = urlParams.get('type') || '';
  const category = urlParams.get('category') || '';
  const sort = urlParams.get('sort') || 'created_at_desc';

  // Отправляем их на сервер
  const query = new URLSearchParams({ q, type, category, sort }).toString();
  const res = await api(`exams&${query}`);
  const exams = await res.json();

  const cards = exams.map(r => {
    const mine = r.user_id == currentUser.id;
    const chips = r.status==='closed' ? '<span class="chip muted">закрыта</span>' : '<span class="chip">открыта</span>';

    const offers = (r.offers||[]).map(o => {
      const stat = o.status==='accepted' ? '<span class="chip accepted">принят</span>' : o.status==='declined' ? '<span class="chip declined">отклонён</span>' : '<span class="chip muted">ожидает</span>';
      const contactBtn = mine && o.status === 'pending' && o.telegram ? `<a href="https://t.me/${esc(o.telegram).replace('@','')}" target="_blank" class="btn" style="text-decoration:none">Написать в TG</a>` : '';
      const acts = mine && o.status==='pending' && r.status==='open' ? `<div class="actions">${contactBtn}<button onclick="acceptOffer(${r.id}, ${o.id})">Принять</button><button onclick="declineOffer(${o.id})">Отклонить</button></div>` : '';
      return `<div class="offer"><b>${esc(o.user_name)}</b> ${stat}<p>${esc(o.text)}</p>${acts}</div>`;
    }).join('');

    const offerForm = !mine && r.status==='open' ? `<details><summary class="btn">Откликнуться</summary><form class="form" onsubmit="submitOffer(event, ${r.id})"><label>Чем поможете?<textarea name="text" rows="2" required></textarea></label><label>Telegram<input name="telegram" value="${esc(currentUser.telegram||'')}"></label><button class="primary" type="submit">Отправить</button></form></details>` : '';

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
        ${r.offers && r.offers.length ? `<div class="offers">${offers}</div>` : ''}
      </div>
    </article>`;
  }).join('');

  layout('homework', `
    <h1>Каталог публикаций</h1>
    
    <form class="toolbar" method="GET" action="homework.html" style="margin-bottom: 20px; padding: 15px; background: #fff; border-radius: 10px; border: 1px solid #ddd; display:flex; gap:10px; flex-wrap:wrap;">
      <input type="text" name="q" placeholder="Поиск по названию и описанию..." value="${esc(q)}" style="flex: 1; min-width: 200px;">
      
      <select name="type">
        <option value="">Все типы</option>
        <option value="exam" ${type==='exam'?'selected':''}>Экзамены</option>
        <option value="help" ${type==='help'?'selected':''}>Помощь</option>
      </select>

      <select name="category">
        <option value="">Все категории</option>
        <option value="Математика" ${category==='Математика'?'selected':''}>Математика</option>
        <option value="Английский" ${category==='Английский'?'selected':''}>Английский</option>
        <option value="Программирование" ${category==='Программирование'?'selected':''}>Программирование</option>
        <option value="Физика" ${category==='Физика'?'selected':''}>Физика</option>
      </select>

      <select name="sort">
        <option value="created_at_desc" ${sort==='created_at_desc'?'selected':''}>Сначала новые</option>
        <option value="created_at_asc" ${sort==='created_at_asc'?'selected':''}>Сначала старые</option>
        <option value="title_asc" ${sort==='title_asc'?'selected':''}>По алфавиту (А-Я)</option>
        <option value="title_desc" ${sort==='title_desc'?'selected':''}>По алфавиту (Я-А)</option>
      </select>

      <button class="primary" type="submit">Найти</button>
      <a href="homework.html" class="btn" style="text-decoration:none; padding: 10px 15px;">Сброс</a>
    </form>

    <div class="toolbar" style="margin-bottom: 20px;">
      <button class="primary" onclick="showNewForm()">+ Создать публикацию</button>
    </div>
    
    <div id="newWrap"></div>
    <div id="editWrap"></div>
    <div class="list">${cards || '<div class="empty">Ничего не найдено</div>'}</div>
  `);
}

// --- CREATE ---
window.showNewForm = () => {
  $('#newWrap').innerHTML = `
    <form class="form" onsubmit="createExam(event)">
      <div class="row">
        <label>Заголовок<input name="title" required maxlength="100"></label>
        <label>Категория<input name="category" required maxlength="60" value="Математика"></label>
      </div>
      <div class="row">
        <label>Тип
          <select name="type">
            <option value="exam">Экзамен</option>
            <option value="help">Помощь</option>
          </select>
        </label>
      </div>
      <label>Описание<textarea name="description" rows="4" required maxlength="1000"></textarea></label>
      <button class="primary" type="submit">Сохранить</button>
    </form>`;
};

window.createExam = async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const res = await api('create_exam', { method:'POST', body: JSON.stringify(data) });
  if (res.ok) location.reload();
  else toast('Ошибка при создании');
};

// --- UPDATE ---
window.editExam = async (id) => {
  const res = await api(`get_exam&id=${id}`);
  if (!res.ok) return toast('Не удалось загрузить');
  const r = await res.json();

  $('#editWrap').innerHTML = `
    <form class="form" onsubmit="updateExam(event, ${id})">
      <h2>Редактирование</h2>
      <div class="row">
        <label>Заголовок<input name="title" value="${esc(r.title)}" required maxlength="100"></label>
        <label>Категория<input name="category" value="${esc(r.category)}" required maxlength="60"></label>
      </div>
      <label>Описание<textarea name="description" rows="4" required maxlength="1000">${esc(r.description)}</textarea></label>
      <label>Статус
        <select name="status">
          <option value="open" ${r.status==='open'?'selected':''}>Открыта</option>
          <option value="closed" ${r.status==='closed'?'selected':''}>Закрыта</option>
          <option value="archived" ${r.status==='archived'?'selected':''}>В архиве</option>
        </select>
      </label>
      <button class="primary" type="submit">Обновить</button>
      <button type="button" onclick="$('#editWrap').innerHTML=''">Отмена</button>
    </form>`;
  window.scrollTo(0,0);
};

window.updateExam = async (e, id) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  data.id = id;
  const res = await api('update_exam', { method:'POST', body: JSON.stringify(data) });
  if (res.ok) { toast('Обновлено'); location.reload(); }
  else toast((await res.json()).error || 'Ошибка');
};

// --- DELETE ---
window.deleteExam = async (id) => {
  if (!confirm('Вы уверены, что хотите удалить эту публикацию? Это действие необратимо.')) return;
  const res = await api('delete_exam', { method:'POST', body: JSON.stringify({ id }) });
  if (res.ok) { toast('Удалено'); location.reload(); }
  else toast((await res.json()).error || 'Ошибка удаления');
};

// --- ОТКЛИКИ ---
window.submitOffer = async (e, examId) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const res = await api('create_offer', {
    method:'POST',
    body: JSON.stringify({ exam_id: examId, text: fd.get('text'), telegram: fd.get('telegram') })
  });
  if (res.ok) location.reload();
  else toast('Ошибка отправки');
};

window.acceptOffer = async (examId, offerId) => {
  await api('update_offer', { method:'POST', body: JSON.stringify({ offer_id: offerId, status: 'accepted' }) });
  await api('close_exam', { method:'POST', body: JSON.stringify({ exam_id: examId }) });
  location.reload();
};

window.declineOffer = async (offerId) => {
  await api('update_offer', { method:'POST', body: JSON.stringify({ offer_id: offerId, status: 'declined' }) });
  location.reload();
};

// --- ПРОФИЛЬ ---
async function renderCabinet(){
  await loadMe();
  if (!currentUser) { location.href = 'index.html'; return; }
  layout('cabinet', `<h1>Личный кабинет</h1><div class="empty">В разработке 🚧</div>`);
}

async function renderProfile(){
  await loadMe();
  if (!currentUser) { location.href = 'index.html'; return; }
  const res = await api('me');
  const user = await res.json();

  layout('profile', `
    <h1>Профиль</h1>
    <div class="meta" style="margin-bottom:20px"><span>ID: ${user.id}</span><span>На сайте с: ${esc(user.created_at)}</span></div>
    <form class="form" id="profileForm">
      <div class="row">
        <label>Имя<input name="name" value="${esc(user.name)}" required maxlength="60"></label>
        <label>Email<input value="${esc(user.email)}" disabled></label>
      </div>
      <label>О себе<textarea name="bio" rows="3" maxlength="300">${esc(user.bio||'')}</textarea></label>
      <label>Навыки<input name="skills" value="${esc(user.skills||'')}" maxlength="200"></label>
      <label>Telegram<input name="telegram" value="${esc(user.telegram||'')}" maxlength="32"></label>
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
