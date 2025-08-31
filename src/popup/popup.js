// DEBUG GUARD AT TOP
(function(){
  const st = m => { const el=document.getElementById('status'); if(el) el.textContent=m; };
  st('js-start');
  window.addEventListener('error',e=>{console.error('[popup] error',e.error||e.message); st('err');});
  console.log('[popup] file path check');
})();

console.log('[popup] script loaded');
const setStatus = msg => { const el = document.getElementById('status'); if (el) el.textContent = msg; };

function escapeHtml(s=''){
  return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function switchTab(tab) {
  const searchTab = document.getElementById('search-tab');
  const recentTab = document.getElementById('recent-tab');
  const btnSearch = document.getElementById('tab-search');
  const btnRecent = document.getElementById('tab-recent');
  if (!searchTab || !recentTab) return;
  const toRecent = tab === 'recent';
  searchTab.classList.toggle('hidden', toRecent);
  recentTab.classList.toggle('hidden', !toRecent);
  btnSearch?.classList.toggle('active', !toRecent);
  btnRecent?.classList.toggle('active', toRecent);
  if (toRecent) loadRecent();
  console.log('[popup] tab ->', tab);
}

async function loadRecent() {
  setStatus('recent...');
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'GET_RECENT_ENTRIES', limit: 50 });
    const entries = Array.isArray(resp) ? resp : (resp?.data || []);
    renderRecent(entries);
  } catch (e) {
    console.error('[popup] loadRecent error', e);
    renderRecent([]);
  } finally {
    setStatus('ready');
  }
}

function renderRecent(entries) {
  const c = document.getElementById('recent-list');
  if (!c) return;
  c.innerHTML = '';
  if (!entries.length) {
    c.innerHTML = '<div style="padding:10px;color:#666;">No entries yet.</div>';
    return;
  }
  entries.forEach(e => {
    const text = e.content || e.text || '';
    const div = document.createElement('div');
    div.className = 'kb-entry';
    div.innerHTML = `
      <div class="kb-entry-title">${escapeHtml(e.title || '(Untitled)')}</div>
      <div class="kb-entry-snippet">${escapeHtml(text).slice(0,160)}</div>
      <div class="kb-entry-meta">${new Date(e.timestamp).toLocaleString()}</div>
    `;
    c.appendChild(div);
  });
}

async function runSearch() {
  const qEl = document.getElementById('search-input');
  const out = document.getElementById('search-results');
  if (!qEl || !out) return;
  const q = qEl.value.trim();
  if (!q) {
    out.innerHTML = '<div style="padding:10px;color:#666;">Enter a query.</div>';
    return;
  }
  setStatus('search...');
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'SEARCH_KNOWLEDGE_BASE', query: q });
    const results = Array.isArray(resp) ? resp : (resp?.data || []);
    renderSearch(results);
  } catch (e) {
    console.error('[popup] search error', e);
    out.innerHTML = '<div style="padding:10px;color:#a00;">Search failed.</div>';
  } finally {
    setStatus('ready');
  }
}

function renderSearch(results) {
  const c = document.getElementById('search-results');
  if (!c) return;
  c.innerHTML = results.length
    ? results.map(r => {
        const md = r.metadata || {};
        const snippet = (md.content || md.contextSnippet || '').slice(0,160);
        return `<div class="kb-result">
          <div class="kb-result-title">${escapeHtml(md.title || '(Untitled)')}</div>
          <div class="kb-result-snippet">${escapeHtml(snippet)}</div>
          <div class="kb-result-score">Score: ${r.score != null ? r.score.toFixed(3) : ''}</div>
        </div>`;
      }).join('')
    : '<div style="padding:10px;color:#666;">No results found</div>';
}

function bind() {
  document.getElementById('tab-search')?.addEventListener('click', () => switchTab('search'));
  document.getElementById('tab-recent')?.addEventListener('click', () => switchTab('recent'));
  document.getElementById('search-btn')?.addEventListener('click', runSearch);
  document.getElementById('search-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
  document.getElementById('refresh-btn')?.addEventListener('click', loadRecent);
  console.log('[popup] listeners attached');
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('[popup] DOMContentLoaded');
  bind();
  switchTab('search');
  loadRecent();
  setStatus('ready');
});