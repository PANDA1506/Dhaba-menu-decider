/* ---------- Default menu (used until you save changes from Admin) ---------- */
const DEFAULT_MENU = [
  { id:'d1',  name:'Tandori Soya Chaap Masala', price:419, category:'Main',    veg:true  },
  { id:'d2',  name:'Dhaba da Chilli Chicken',   price:479, category:'Starter', veg:false },
  { id:'d3',  name:'Highway Chicken Tikka',     price:499, category:'Starter', veg:false },
  { id:'d4',  name:'Paneer Tikka Lababdar',     price:529, category:'Main',    veg:true  },
  { id:'d5',  name:'Paneer Tikka Masala',       price:519, category:'Main',    veg:true  },
  { id:'d6',  name:'Chicken Kebab Platter',     price:949, category:'Starter', veg:false },
  { id:'d7',  name:'Tandoori Roti',             price:59,  category:'Breads',  veg:true  },
  { id:'d8',  name:'Roomali Roti',              price:59,  category:'Breads',  veg:true  },
  { id:'d9',  name:'Butter Roti',               price:69,  category:'Breads',  veg:true  },
  { id:'d10', name:'Butter Chicken 1986',       price:649, category:'Main',    veg:false },
  { id:'d11', name:'Kadhai Chicken',            price:549, category:'Main',    veg:false },
  { id:'d12', name:'Raita',                     price:119, category:'Sides',   veg:true  },
  { id:'d13', name:'Malai Soya Chaap',          price:429, category:'Main',    veg:true  }
];

/* ---------- Helpers ---------- */
const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const state = {
  menu: [],
  cart: load('cart', {}),            // { dishId: qty }
  people: load('people', 3),
  gst: load('gst', { on: true, rate: 5 }),
  cat: 'All', q: '', sort: 'default',
  pw: sessionStorage.getItem('pw') || '',
  admin: false,
  local: false, localReason: ''
};

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- Menu load / save ---------- */
async function loadMenu() {
  try {
    const r = await fetch('/api/menu', { cache: 'no-store' });
    if (!r.ok) throw new Error('api');
    const d = await r.json();
    if (d.configured === false) {
      state.local = true;
      state.localReason = 'Database not connected yet — changes are saved on THIS device only. Follow the setup step to connect Upstash Redis so your friends see updates too.';
      state.menu = load('menu', null) || structuredClone(DEFAULT_MENU);
    } else {
      state.menu = Array.isArray(d.items) && d.items.length ? d.items : structuredClone(DEFAULT_MENU);
    }
  } catch {
    state.local = true;
    state.localReason = 'Running without the server (local mode) — changes are saved on this device only.';
    state.menu = load('menu', null) || structuredClone(DEFAULT_MENU);
  }
}

async function saveMenu() {
  if (state.local) { store('menu', state.menu); toast('Saved (this device only)'); return true; }
  try {
    const r = await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': state.pw },
      body: JSON.stringify({ items: state.menu })
    });
    if (r.status === 401) { lock(); toast('Wrong password'); return false; }
    if (!r.ok) { toast('Save failed ✗'); return false; }
    toast('Saved ✓ everyone will see it'); return true;
  } catch { toast('Save failed ✗'); return false; }
}

/* ---------- Navigation ---------- */
function show(view) {
  $$('.view').forEach(v => v.classList.add('hidden'));
  $('#' + view + 'View').classList.remove('hidden');
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  $('#stickyBar').classList.toggle('hidden', view !== 'menu' || cartCount() === 0);
  $('#fab').classList.toggle('hidden', view === 'admin');
  if (view === 'list') renderList();
  if (view === 'admin') renderAdmin();
  window.scrollTo({ top: 0 });
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-view],[data-goto]');
  if (t) show(t.dataset.view || t.dataset.goto);
});

/* ---------- Cart ---------- */
const cartCount = () => Object.values(state.cart).reduce((a, b) => a + b, 0);
const byId = id => state.menu.find(m => m.id === id);
function cartItems() {
  return Object.entries(state.cart).map(([id, qty]) => ({ item: byId(id), qty })).filter(x => x.item && x.qty > 0);
}
const subtotal = () => cartItems().reduce((s, { item, qty }) => s + item.price * qty, 0);

function setQty(id, qty) {
  if (qty <= 0) delete state.cart[id]; else state.cart[id] = Math.min(qty, 99);
  store('cart', state.cart);
  renderMenu(); updateBadges();
  if (!$('#listView').classList.contains('hidden')) renderList();
}
function updateBadges() {
  const n = cartCount();
  const b = $('#badge'); b.textContent = n; b.classList.toggle('hidden', n === 0);
  $('#stickyCount').textContent = n + (n === 1 ? ' item' : ' items');
  $('#stickyTotal').textContent = inr(subtotal());
  const onMenu = !$('#menuView').classList.contains('hidden');
  $('#stickyBar').classList.toggle('hidden', !(onMenu && n > 0));
}

/* ---------- Menu view ---------- */
function renderChips() {
  const cats = ['All', ...new Set(state.menu.map(m => m.category).filter(Boolean))];
  if (!cats.includes(state.cat)) state.cat = 'All';
  $('#chips').innerHTML = cats.map(c => `<button class="chip ${c === state.cat ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
}
function renderMenu() {
  let items = state.menu.filter(m =>
    (state.cat === 'All' || m.category === state.cat) &&
    m.name.toLowerCase().includes(state.q.toLowerCase()));
  if (state.sort === 'low')  items = [...items].sort((a, b) => a.price - b.price);
  if (state.sort === 'high') items = [...items].sort((a, b) => b.price - a.price);

  $('#grid').innerHTML = items.length ? items.map(m => {
    const q = state.cart[m.id] || 0;
    return `<div class="dish ${q ? 'in' : ''}">
      <div class="dish-top"><span class="vdot ${m.veg ? '' : 'nv'}"></span>
        <div><h3>${esc(m.name)}</h3><span class="cat">${esc(m.category || '')}</span></div></div>
      <div class="dish-bot">
        <span class="price">${inr(m.price)}</span>
        ${q ? `<div class="qty"><button data-dec="${m.id}">−</button><b>${q}</b><button data-inc="${m.id}">+</button></div>`
            : `<button class="btn" data-inc="${m.id}">Add +</button>`}
      </div></div>`;
  }).join('') : `<div class="empty" style="grid-column:1/-1"><p>No dishes found.</p>
      <button class="btn addnew" data-addnew="1">＋ Add ${state.q ? '“' + esc(state.q) + '”' : 'a dish'} to the menu</button></div>`;
}
$('#grid').addEventListener('click', e => {
  const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
  if (inc) setQty(inc.dataset.inc, (state.cart[inc.dataset.inc] || 0) + 1);
  if (dec) setQty(dec.dataset.dec, (state.cart[dec.dataset.dec] || 0) - 1);
});
$('#chips').addEventListener('click', e => {
  const c = e.target.closest('[data-cat]'); if (!c) return;
  state.cat = c.dataset.cat; renderChips(); renderMenu();
});
$('#search').addEventListener('input', e => { state.q = e.target.value; renderMenu(); });
$('#sort').addEventListener('change', e => { state.sort = e.target.value; renderMenu(); });

/* ---------- List / bill view ---------- */
function totals() {
  const sub = subtotal();
  const gst = state.gst.on ? sub * (state.gst.rate / 100) : 0;
  const total = sub + gst;
  return { sub, gst, total, each: total / state.people };
}
function renderList() {
  const items = cartItems();
  $('#listEmpty').classList.toggle('hidden', items.length > 0);
  $('#listWrap').classList.toggle('hidden', items.length === 0);
  $('#listRows').innerHTML = items.map(({ item, qty }) => `
    <div class="row">
      <span class="vdot ${item.veg ? '' : 'nv'}"></span>
      <div class="nm"><b>${esc(item.name)}</b><small>${inr(item.price)} each</small></div>
      <div class="qty"><button data-dec="${item.id}">−</button><b>${qty}</b><button data-inc="${item.id}">+</button></div>
      <div class="lt">${inr(item.price * qty)}</div>
      <button class="x" data-rm="${item.id}" title="Remove">✕</button>
    </div>`).join('');
  $('#gstToggle').checked = state.gst.on;
  $('#gstRate').value = state.gst.rate;
  $('#people').textContent = state.people;
  const t = totals();
  $('#subtotal').textContent = inr(t.sub);
  $('#gstAmt').textContent = inr(t.gst);
  $('#total').textContent = inr(t.total);
  $('#each').textContent = inr(t.each);
}
$('#listRows').addEventListener('click', e => {
  const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]'), rm = e.target.closest('[data-rm]');
  if (inc) setQty(inc.dataset.inc, (state.cart[inc.dataset.inc] || 0) + 1);
  if (dec) setQty(dec.dataset.dec, (state.cart[dec.dataset.dec] || 0) - 1);
  if (rm) setQty(rm.dataset.rm, 0);
});
$('#gstToggle').addEventListener('change', e => { state.gst.on = e.target.checked; store('gst', state.gst); renderList(); });
$('#gstRate').addEventListener('input', e => { state.gst.rate = Math.max(0, +e.target.value || 0); store('gst', state.gst); renderList(); $('#gstRate').focus(); });
$('#pMinus').addEventListener('click', () => { state.people = Math.max(1, state.people - 1); store('people', state.people); renderList(); });
$('#pPlus').addEventListener('click',  () => { state.people = Math.min(20, state.people + 1); store('people', state.people); renderList(); });
$('#clearList').addEventListener('click', () => { if (confirm('Clear the whole list?')) { state.cart = {}; store('cart', {}); renderMenu(); updateBadges(); renderList(); } });

function listText() {
  const t = totals();
  const lines = cartItems().map(({ item, qty }) => `• ${item.name} × ${qty} = ${inr(item.price * qty)}`);
  return `🍽️ Dinner order\n${lines.join('\n')}\n\nSubtotal: ${inr(t.sub)}` +
    (state.gst.on ? `\nGST ${state.gst.rate}%: ${inr(t.gst)}` : '') +
    `\nTotal: ${inr(t.total)}\nSplit ${state.people} ways: ${inr(t.each)} each`;
}
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { prompt('Copy this:', text); }
}
$('#copyText').addEventListener('click', () => copy(listText(), 'Copied! Paste it in WhatsApp'));
$('#copyLink').addEventListener('click', () => {
  const s = Object.entries(state.cart).map(([id, q]) => id + ':' + q).join(',');
  copy(location.origin + location.pathname + '#list=' + encodeURIComponent(s), 'Share link copied');
});
function loadFromHash() {
  const m = location.hash.match(/^#list=(.*)$/); if (!m) return false;
  const cart = {};
  decodeURIComponent(m[1]).split(',').forEach(p => { const [id, q] = p.split(':'); if (byId(id) && +q > 0) cart[id] = +q; });
  if (Object.keys(cart).length) { state.cart = cart; store('cart', cart); return true; }
  return false;
}

/* ---------- Admin ---------- */
function lock() { state.admin = false; state.pw = ''; sessionStorage.removeItem('pw'); renderAdmin(); }
async function tryLogin(pw) {
  if (state.local) { state.admin = true; return true; }
  try {
    const r = await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
      body: JSON.stringify({ check: true })
    });
    if (r.ok) { state.pw = pw; sessionStorage.setItem('pw', pw); state.admin = true; return true; }
    $('#loginErr').textContent = r.status === 401 ? 'Wrong password' : 'Server error — is ADMIN_PASSWORD set on Vercel?';
  } catch { $('#loginErr').textContent = 'Could not reach server'; }
  return false;
}
$('#loginBtn').addEventListener('click', async () => { $('#loginErr').textContent = ''; if (await tryLogin($('#pw').value)) { $('#pw').value = ''; renderAdmin(); } });
$('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') $('#loginBtn').click(); });
$('#logoutBtn').addEventListener('click', lock);

function renderAdmin() {
  const nb = $('#localBanner');
  nb.classList.toggle('hidden', !state.local); nb.textContent = state.localReason;
  $('#login').classList.toggle('hidden', state.admin);
  $('#panel').classList.toggle('hidden', !state.admin);
  if (!state.admin) return;
  $('#cats').innerHTML = [...new Set(state.menu.map(m => m.category).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('');
  $('#count').textContent = `(${state.menu.length} dishes)`;
  $('#editRows').innerHTML = state.menu.map(m => `
    <div class="erow" data-id="${m.id}">
      <input class="e-name" value="${esc(m.name)}">
      <input class="e-price" type="number" min="0" value="${m.price}">
      <input class="e-cat" value="${esc(m.category || '')}" list="cats">
      <label class="veg-check"><input class="e-veg" type="checkbox" ${m.veg ? 'checked' : ''}> Veg</label>
      <button class="del" title="Delete">🗑</button>
    </div>`).join('');
}
function refreshAll() { renderChips(); renderMenu(); updateBadges(); }

$('#addBtn').addEventListener('click', async () => {
  const name = $('#nName').value.trim(), price = +$('#nPrice').value;
  if (!name || !(price >= 0) || $('#nPrice').value === '') return toast('Enter name and price');
  state.menu.push({ id: uid(), name, price, category: $('#nCat').value.trim() || 'Main', veg: $('#nVeg').checked });
  $('#nName').value = ''; $('#nPrice').value = '';
  renderAdmin(); refreshAll(); await saveMenu();
});
let saveTimer;
$('#editRows').addEventListener('input', e => {
  const row = e.target.closest('.erow'); if (!row) return;
  const m = byId(row.dataset.id); if (!m) return;
  m.name = $('.e-name', row).value.trim() || m.name;
  m.price = Math.max(0, +$('.e-price', row).value || 0);
  m.category = $('.e-cat', row).value.trim();
  m.veg = $('.e-veg', row).checked;
  clearTimeout(saveTimer); saveTimer = setTimeout(async () => { await saveMenu(); refreshAll(); }, 700);
});
$('#editRows').addEventListener('click', async e => {
  if (!e.target.closest('.del')) return;
  const id = e.target.closest('.erow').dataset.id, m = byId(id);
  if (!confirm(`Delete "${m.name}"?`)) return;
  state.menu = state.menu.filter(x => x.id !== id); delete state.cart[id]; store('cart', state.cart);
  renderAdmin(); refreshAll(); await saveMenu();
});
$('#resetBtn').addEventListener('click', async () => {
  if (!confirm('Replace the whole menu with the original 13 dishes?')) return;
  state.menu = structuredClone(DEFAULT_MENU); renderAdmin(); refreshAll(); await saveMenu();
});


/* ---------- Quick add (popup) ---------- */
const NONVEG = /chicken|mutton|fish|egg|prawn|kebab|kabab|lamb|keema|murgh|gosht|seekh|tangdi|tandoori platter/i;
function guessCategory(n) {
  if (/roti|naan|kulcha|paratha|phulka|bread/i.test(n)) return 'Breads';
  if (/raita|salad|papad|pickle|achar|chutney/i.test(n)) return 'Sides';
  if (/lassi|soda|juice|cola|water|mocktail|shake|chaas|tea|coffee/i.test(n)) return 'Drinks';
  if (/jamun|kheer|halwa|ice ?cream|kulfi|rasmalai|brownie|dessert|jalebi/i.test(n)) return 'Dessert';
  if (/tikka|kebab|kabab|chilli|manchurian|65|starter|platter|tandoori|seekh/i.test(n) && !/masala|lababdar|curry/i.test(n)) return 'Starter';
  return 'Main';
}
function parseBulk(text) {
  const out = [];
  text.split('\n').forEach(line => {
    const m = line.trim().match(/^(.*?)[\s,\-–—:=|₹]*?(\d+(?:\.\d+)?)\s*(?:rs\.?|₹|\/-)?$/i);
    if (!m) return;
    const name = m[1].replace(/[\s,\-–—:=|₹•*]+$/, '').replace(/^[\s•*\-\d.)]+(?=[A-Za-z])/, '').trim();
    if (name.length < 2) return;
    out.push({ id: uid(), name, price: +m[2], category: guessCategory(name), veg: !NONVEG.test(name) });
  });
  return out;
}

const modal = { mode: 'one', veg: true };
function setMode(m) {
  modal.mode = m;
  $$('.segbtn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  $('#mOne').classList.toggle('hidden', m !== 'one');
  $('#mBulk').classList.toggle('hidden', m !== 'bulk');
}
function setVeg(v) { modal.veg = v; $('#vegY').classList.toggle('on', v); $('#vegN').classList.toggle('on', !v); }
function openModal(prefill = '') {
  $('#cats').innerHTML = [...new Set(state.menu.map(m => m.category).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('');
  $('#mName').value = prefill; $('#mPrice').value = ''; $('#mCat').value = ''; $('#mText').value = ''; $('#mErr').textContent = '';
  setMode('one'); setVeg(true);
  $('#mAuth').classList.toggle('hidden', state.admin || state.local);
  $('#modal').classList.remove('hidden');
  setTimeout(() => $(prefill ? '#mPrice' : '#mName').focus(), 50);
}
function closeModal() { $('#modal').classList.add('hidden'); }

$('#fab').addEventListener('click', () => openModal());
document.addEventListener('click', e => { if (e.target.closest('[data-addnew]')) openModal(state.q); });
$('#mClose').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
$$('.segbtn').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('#vegY').addEventListener('click', () => setVeg(true));
$('#vegN').addEventListener('click', () => setVeg(false));
$('#mName').addEventListener('input', e => { if (NONVEG.test(e.target.value)) setVeg(false); });
['mName', 'mPrice', 'mCat', 'mPw'].forEach(id => $('#' + id).addEventListener('keydown', e => { if (e.key === 'Enter') $('#mSave').click(); }));

$('#mSave').addEventListener('click', async () => {
  const err = $('#mErr'); err.textContent = '';
  let items;
  if (modal.mode === 'one') {
    const name = $('#mName').value.trim(), p = $('#mPrice').value;
    if (!name) return err.textContent = 'Enter the dish name';
    if (p === '' || +p < 0) return err.textContent = 'Enter the price';
    items = [{ id: uid(), name, price: +p, category: $('#mCat').value.trim() || guessCategory(name), veg: modal.veg }];
  } else {
    items = parseBulk($('#mText').value);
    if (!items.length) return err.textContent = 'No dishes found. Use "Dish name 250" on each line.';
  }
  // password (only asked until unlocked)
  if (!state.admin && !state.local) {
    const pw = $('#mPw').value;
    if (!pw) return err.textContent = 'Enter the admin password';
    if (!(await tryLogin(pw))) return err.textContent = $('#loginErr').textContent || 'Wrong password';
    $('#mAuth').classList.add('hidden');
  }
  state.menu.push(...items);
  const ok = await saveMenu();
  if (!ok) {
    state.menu = state.menu.filter(m => !items.includes(m));
    $('#mAuth').classList.toggle('hidden', state.admin || state.local);
    return err.textContent = 'Could not save. Check the password and try again.';
  }
  if ($('#mAddList').checked) items.forEach(i => { state.cart[i.id] = (state.cart[i.id] || 0) + 1; });
  store('cart', state.cart);
  refreshAll(); renderAdmin();
  if (!$('#listView').classList.contains('hidden')) renderList();
  state.q = ''; $('#search').value = ''; renderMenu();
  closeModal();
  toast(items.length === 1 ? `Added “${items[0].name}” ✓` : `Added ${items.length} dishes ✓`);
});

/* ---------- Init ---------- */
(async function init() {
  await loadMenu();
  const fromLink = loadFromHash();
  if (state.pw && !state.local) state.admin = true; // restore session (server re-checks on every save)
  refreshAll();
  show(fromLink ? 'list' : 'menu');
})();
