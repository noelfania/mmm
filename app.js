const { supabaseUrl, supabaseKey, ownerEmail, passwordPrefix } = window.MEMO_CONFIG;
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

const $ = (id) => document.getElementById(id);
const SPLIT_KEY = 'memo.split';
// Keep the karaoke list in the existing notes table without showing it as a regular note.
const KARAOKE_PREFIX = '<!-- mmm:karaoke -->\n';

let tabs = []; // { key, noteId, content, saved, mode: 'edit' | 'view' }
let activeKey = null;
let karaokeActive = false;
let karaokeNoteId = null;
let karaokeContent = '';
let karaokeSaved = '';
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
  if (!line) return '新しいメモ';
  return line.replace(/^(#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)+/, '').replace(/[*_`~]/g, '').trim() || '新しいメモ';
}

function setStatus(message = '', isError = false) {
  $('status').textContent = message;
  $('status').classList.toggle('is-error', isError);
}

/* 画面 */
function renderTabs() {
  document.querySelectorAll('.note-tab').forEach((el) => el.remove());
  for (const tab of tabs) {
    const button = document.createElement('button');
    const title = tabTitle(tab.content);
    button.type = 'button';
    button.className = 'tab note-tab';
    button.classList.toggle('dirty', isDirty(tab));
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(tab.key === activeKey));
    button.textContent = title;
    button.title = title;
    button.addEventListener('click', () => selectTab(tab.key));
    $('tabs').insertBefore(button, $('add-tab'));
  }
  $('karaoke-tab').setAttribute('aria-selected', String(karaokeActive));
  $('karaoke-tab').classList.toggle('dirty', karaokeContent !== karaokeSaved);
}

function renderNote() {
  const tab = activeTab();
  $('note').hidden = karaokeActive || !tab;
  const editing = tab?.mode === 'edit';
  $('save').hidden = !tab || !editing;
  $('edit').hidden = !tab || editing;
  $('delete').hidden = !tab;
  if (!tab) return;

  $('editor').hidden = !editing;
  $('viewer').hidden = editing;

  if (editing) {
    if ($('source').value !== tab.content) $('source').value = tab.content;
    $('preview').innerHTML = renderMarkdown(tab.content);
    $('source').focus();
  } else {
    $('viewer').innerHTML = renderMarkdown(tab.content);
  }
}

function renderKaraoke() {
  $('karaoke').hidden = !karaokeActive;
  const editing = karaokeActive && $('karaoke-source').dataset.editing === 'true';
  $('karaoke-save').hidden = !editing;
  $('karaoke-edit').hidden = !karaokeActive || editing;
  if (!karaokeActive) return;

  $('karaoke-source').hidden = !editing;
  $('karaoke-links').hidden = editing;
  if ($('karaoke-source').value !== karaokeContent) $('karaoke-source').value = karaokeContent;

  if (!editing) {
    const links = $('karaoke-links');
    links.replaceChildren();
    for (const line of karaokeContent.split(/\r?\n/).map((text) => text.trim()).filter(Boolean)) {
      const link = document.createElement('a');
      link.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(`노래방 ${line}`)}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = line;
      links.append(link);
    }
  }
}

function render() {
  renderTabs();
  renderNote();
  renderKaraoke();
}

function selectTab(key) {
  karaokeActive = false;
  activeKey = key;
  setStatus();
  render();
}

function selectKaraoke() {
  karaokeActive = true;
  activeKey = null;
  setKaraokeStatus();
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
  const karaokeNote = data.find((note) => note.content.startsWith(KARAOKE_PREFIX));
  karaokeNoteId = karaokeNote ? karaokeNote.id : null;
  karaokeContent = karaokeNote ? karaokeNote.content.slice(KARAOKE_PREFIX.length) : '';
  karaokeSaved = karaokeContent;
  karaokeActive = false;
  $('karaoke-source').dataset.editing = 'false';
  tabs = data.filter((note) => !note.content.startsWith(KARAOKE_PREFIX)).map((note) => ({
    key: nextKey++,
    noteId: note.id,
    content: note.content,
    saved: note.content,
    mode: 'view',
  }));
  activeKey = tabs.length ? tabs[tabs.length - 1].key : null;
  render();
}

function setKaraokeStatus(message = '', isError = false) {
  $('karaoke-status').textContent = message;
  $('karaoke-status').classList.toggle('is-error', isError);
}

async function saveKaraoke() {
  if (!karaokeActive || saving) return;

  saving = true;
  $('karaoke-save').disabled = true;
  setKaraokeStatus('保存中...');
  const content = KARAOKE_PREFIX + karaokeContent;
  const query = karaokeNoteId
    ? db.from('notes').update({ content, updated_at: new Date().toISOString() }).eq('id', karaokeNoteId)
    : db.from('notes').insert({ content });
  const { data, error } = await query.select('id').maybeSingle();
  saving = false;
  $('karaoke-save').disabled = false;

  if (error || !data) {
    setKaraokeStatus(`保存できませんでした: ${error ? error.message : 'メモが見つかりません。'}`, true);
    return;
  }

  karaokeNoteId = data.id;
  karaokeSaved = karaokeContent;
  $('karaoke-source').dataset.editing = 'false';
  setKaraokeStatus('保存しました。');
  render();
}

async function saveTab() {
  const tab = activeTab();
  if (!tab || tab.mode !== 'edit' || saving) return;
  if (!tab.content.trim()) {
    setStatus('内容が空のため保存しませんでした。', true);
    return;
  }

  saving = true;
  $('save').disabled = true;
  setStatus('保存中...');
  const content = tab.content;
  const query = tab.noteId
    ? db.from('notes').update({ content, updated_at: new Date().toISOString() }).eq('id', tab.noteId)
    : db.from('notes').insert({ content });
  const { data, error } = await query.select('id').maybeSingle();
  saving = false;
  $('save').disabled = false;

  if (error || !data) {
    setStatus(`保存できませんでした: ${error ? error.message : 'メモが見つかりません。'}`, true);
    return;
  }

  tab.noteId = data.id;
  tab.saved = content;
  if (tab.content === content) tab.mode = 'view';
  if (tab.key === activeKey) setStatus('保存しました。');
  render();
}

async function deleteTab() {
  const tab = activeTab();
  if (!tab) return;

  const untouched = !tab.noteId && !tab.content.trim();
  if (!untouched && !confirm(`「${tabTitle(tab.content)}」を削除しますか？`)) return;

  if (tab.noteId) {
    const { error } = await db.from('notes').delete().eq('id', tab.noteId);
    if (error) {
      setStatus(`削除できませんでした: ${error.message}`, true);
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

/* 認証 */
function signIn(password) {
  return db.auth.signInWithPassword({ email: ownerEmail, password: passwordPrefix + password });
}

function showLogin() {
  tabs = [];
  activeKey = null;
  $('loading').hidden = true;
  $('app').hidden = true;
  $('login').hidden = false;
  $('login-password').value = '';
  $('login-password').focus();
}

async function showApp() {
  $('login').hidden = true;
  $('loading').hidden = false;
  $('app').hidden = true;
  try {
    await loadNotes();
  } catch (error) {
    $('app').hidden = false;
    $('note').hidden = false;
    $('editor').hidden = true;
    $('viewer').hidden = true;
    setStatus(`メモを読み込めませんでした: ${error.message}`, true);
  }
  $('loading').hidden = true;
  $('app').hidden = false;
}

$('login').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('login-error').textContent = '';
  const { error } = await signIn($('login-password').value);
  if (error) {
    $('login-error').textContent = error.status === 400 ? 'パスワードが違います。' : `ログインできませんでした: ${error.message}`;
    return;
  }
  await showApp();
});

$('logout').addEventListener('click', async () => {
  if ((tabs.some(isDirty) || karaokeContent !== karaokeSaved) && !confirm('保存していない内容は失われます。ログアウトしますか？')) return;
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
    $('password-error').textContent = '新しいパスワードが一致しません。';
    return;
  }

  const verified = await signIn($('current-password').value);
  if (verified.error) {
    $('password-error').textContent = '現在のパスワードが違います。';
    return;
  }

  const { error } = await db.auth.updateUser({ password: passwordPrefix + next });
  if (error) {
    $('password-error').textContent = `変更できませんでした: ${error.message}`;
    return;
  }
  $('password-dialog').close();
  setStatus('パスワードを変更しました。');
});

/* エディタ */
$('add-tab').addEventListener('click', addTab);
$('karaoke-tab').addEventListener('click', selectKaraoke);
$('save').addEventListener('click', saveTab);
$('delete').addEventListener('click', deleteTab);
$('karaoke-save').addEventListener('click', saveKaraoke);
$('karaoke-edit').addEventListener('click', () => {
  $('karaoke-source').dataset.editing = 'true';
  setKaraokeStatus();
  renderKaraoke();
  $('karaoke-source').focus();
});

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

$('karaoke-source').addEventListener('input', () => {
  karaokeContent = $('karaoke-source').value;
  renderTabs();
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (karaokeActive) saveKaraoke();
    else saveTab();
  }
});

window.addEventListener('beforeunload', (event) => {
  if (tabs.some(isDirty) || karaokeContent !== karaokeSaved) event.preventDefault();
});

/* 分割線 */
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

/* 起動 */
async function start() {
  try {
    const saved = parseFloat(localStorage.getItem(SPLIT_KEY));
    if (saved) setSplit(saved, false);
  } catch {}

  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (data.session) await showApp();
    else showLogin();
  } catch (error) {
    $('loading').hidden = true;
    $('login').hidden = false;
    $('login-error').textContent = `ログイン状態を確認できませんでした: ${error.message}`;
  }
}

start();
