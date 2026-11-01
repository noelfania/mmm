const { supabaseUrl, supabaseKey, ownerEmail, passwordPrefix } = window.MEMO_CONFIG;
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

const $ = (id) => document.getElementById(id);
const SPLIT_KEY = 'memo.split';

let tabs = []; // { key, noteId, content, saved, mode: 'edit' | 'view' }
let activeKey = null;
let nextKey = 1;
let saving = false;

marked.setOptions({ gfm: true, breaks: true });

function renderMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(text));
}

function activeTab() {
  return tabs.find((tab) => tab.key === activeKey) || null;
}

function isDirty(tab) {
  return tab.content !== tab.saved;
}

function tabTitle(content) {
  const line = content.split('\n').map((text) => text.trim()).find(Boolean);
  if (!line) return '새 메모';
  return line.replace(/^(#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)+/, '').replace(/[*_`~]/g, '').trim() || '새 메모';
}

function setStatus(message = '', isError = false) {
  $('status').textContent = message;
  $('status').classList.toggle('is-error', isError);
}

/* 화면 */
function renderTabs() {
  document.querySelectorAll('.tab').forEach((el) => el.remove());
  for (const tab of tabs) {
    const button = document.createElement('button');
    const title = tabTitle(tab.content);
    button.type = 'button';
    button.className = 'tab';
    button.classList.toggle('dirty', isDirty(tab));
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(tab.key === activeKey));
    button.textContent = title;
    button.title = title;
    button.addEventListener('click', () => selectTab(tab.key));
    $('tabs').insertBefore(button, $('add-tab'));
  }
}

function renderNote() {
  const tab = activeTab();
  $('note').hidden = !tab;
  if (!tab) return;

  const editing = tab.mode === 'edit';
  $('editor').hidden = !editing;
  $('viewer').hidden = editing;
  $('save').hidden = !editing;
  $('edit').hidden = editing;

  if (editing) {
    if ($('source').value !== tab.content) $('source').value = tab.content;
    $('preview').innerHTML = renderMarkdown(tab.content);
    $('source').focus();
  } else {
    $('viewer').innerHTML = renderMarkdown(tab.content);
  }
}

function render() {
  renderTabs();
  renderNote();
}

function selectTab(key) {
  activeKey = key;
  setStatus();
  render();
}

function addTab() {
  const empty = tabs.find((tab) => !tab.content.trim());
  if (empty) {
    selectTab(empty.key);
    return;
  }
  const tab = { key: nextKey++, noteId: null, content: '', saved: '', mode: 'edit' };
  tabs.push(tab);
  selectTab(tab.key);
}

/* CRUD */
async function loadNotes() {
  const { data, error } = await db
    .from('notes')
    .select('id, content')
    .order('created_at', { ascending: true });
  if (error) throw error;
  tabs = data.map((note) => ({
    key: nextKey++,
    noteId: note.id,
    content: note.content,
    saved: note.content,
    mode: 'view',
  }));
  activeKey = tabs.length ? tabs[tabs.length - 1].key : null;
  render();
}

async function saveTab() {
  const tab = activeTab();
  if (!tab || tab.mode !== 'edit' || saving) return;
  if (!tab.content.trim()) {
    setStatus('내용이 비어 있어 저장하지 않았습니다.', true);
    return;
  }

  saving = true;
  $('save').disabled = true;
  setStatus('저장 중...');
  const content = tab.content;
  const query = tab.noteId
    ? db.from('notes').update({ content, updated_at: new Date().toISOString() }).eq('id', tab.noteId)
    : db.from('notes').insert({ content });
  const { data, error } = await query.select('id').maybeSingle();
  saving = false;
  $('save').disabled = false;

  if (error || !data) {
    setStatus(`저장하지 못했습니다: ${error ? error.message : '메모를 찾을 수 없습니다.'}`, true);
    return;
  }

  tab.noteId = data.id;
  tab.saved = content;
  if (tab.content === content) tab.mode = 'view';
  if (tab.key === activeKey) setStatus('저장했습니다.');
  render();
}

async function deleteTab() {
  const tab = activeTab();
  if (!tab) return;

  const untouched = !tab.noteId && !tab.content.trim();
  if (!untouched && !confirm(`"${tabTitle(tab.content)}" 메모를 삭제할까요?`)) return;

  if (tab.noteId) {
    const { error } = await db.from('notes').delete().eq('id', tab.noteId);
    if (error) {
      setStatus(`삭제하지 못했습니다: ${error.message}`, true);
      return;
    }
  }

  const index = tabs.indexOf(tab);
  tabs.splice(index, 1);
  const neighbor = tabs[index] || tabs[index - 1];
  activeKey = neighbor ? neighbor.key : null;
  setStatus();
  render();
}

/* 인증 */
function signIn(password) {
  return db.auth.signInWithPassword({ email: ownerEmail, password: passwordPrefix + password });
}

function showLogin() {
  tabs = [];
  activeKey = null;
  $('app').hidden = true;
  $('login').hidden = false;
  $('login-password').value = '';
  $('login-password').focus();
}

async function showApp() {
  $('login').hidden = true;
  $('app').hidden = false;
  try {
    await loadNotes();
  } catch (error) {
    $('note').hidden = false;
    $('editor').hidden = true;
    $('viewer').hidden = true;
    setStatus(`메모를 불러오지 못했습니다: ${error.message}`, true);
  }
}

$('login').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('login-error').textContent = '';
  const { error } = await signIn($('login-password').value);
  if (error) {
    $('login-error').textContent = error.status === 400 ? '비밀번호가 틀렸습니다.' : `접속하지 못했습니다: ${error.message}`;
    return;
  }
  await showApp();
});

$('logout').addEventListener('click', async () => {
  if (tabs.some(isDirty) && !confirm('저장하지 않은 내용이 사라집니다. 로그아웃할까요?')) return;
  await db.auth.signOut();
  showLogin();
});

$('open-password').addEventListener('click', () => {
  $('password-form').reset();
  $('password-error').textContent = '';
  $('password-dialog').showModal();
});

$('password-cancel').addEventListener('click', () => $('password-dialog').close());

$('password-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const next = $('new-password').value;
  if (next !== $('confirm-password').value) {
    $('password-error').textContent = '새 비밀번호가 서로 다릅니다.';
    return;
  }

  const verified = await signIn($('current-password').value);
  if (verified.error) {
    $('password-error').textContent = '현재 비밀번호가 틀렸습니다.';
    return;
  }

  const { error } = await db.auth.updateUser({ password: passwordPrefix + next });
  if (error) {
    $('password-error').textContent = `변경하지 못했습니다: ${error.message}`;
    return;
  }
  $('password-dialog').close();
  setStatus('비밀번호를 변경했습니다.');
});

/* 에디터 */
$('add-tab').addEventListener('click', addTab);
$('save').addEventListener('click', saveTab);
$('delete').addEventListener('click', deleteTab);

$('edit').addEventListener('click', () => {
  const tab = activeTab();
  if (!tab) return;
  tab.mode = 'edit';
  setStatus();
  render();
});

$('source').addEventListener('input', () => {
  const tab = activeTab();
  if (!tab) return;
  tab.content = $('source').value;
  $('preview').innerHTML = renderMarkdown(tab.content);
  renderTabs();
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveTab();
  }
});

window.addEventListener('beforeunload', (event) => {
  if (tabs.some(isDirty)) event.preventDefault();
});

/* 기준선 */
function setSplit(percent, remember = true) {
  const value = Math.min(85, Math.max(15, percent));
  document.documentElement.style.setProperty('--split', `${value}%`);
  if (!remember) return;
  try {
    localStorage.setItem(SPLIT_KEY, String(value));
  } catch {}
}

function currentSplit() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--split'));
}

$('divider').addEventListener('pointerdown', (event) => {
  $('divider').setPointerCapture(event.pointerId);
  $('divider').classList.add('dragging');
  $('editor').classList.add('dragging');
});

$('divider').addEventListener('pointermove', (event) => {
  if (!$('divider').hasPointerCapture(event.pointerId)) return;
  const box = $('editor').getBoundingClientRect();
  setSplit(((event.clientX - box.left) / box.width) * 100);
});

$('divider').addEventListener('pointerup', () => {
  $('divider').classList.remove('dragging');
  $('editor').classList.remove('dragging');
});

$('divider').addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') setSplit(currentSplit() - 2);
  if (event.key === 'ArrowRight') setSplit(currentSplit() + 2);
});

/* 시작 */
async function start() {
  try {
    const saved = parseFloat(localStorage.getItem(SPLIT_KEY));
    if (saved) setSplit(saved, false);
  } catch {}

  const { data } = await db.auth.getSession();
  if (data.session) await showApp();
  else showLogin();
}

start();
