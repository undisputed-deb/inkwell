/* App core: state, hash router with role guards, page chrome. Event handling lives in handlers.js. */
(function (root) {
  'use strict';
  const NS = (root.Inkwell = root.Inkwell || {});
  const R = NS.Rules;
  const { $, esc, icon, typeLabel, toast } = NS.UI;

  const loaded = NS.Store.load();
  const app = {
    state: loaded.state,
    notice: loaded.notice,
    storageWarned: false,
    stream: null,
    lastViewKey: '',
    ui: {
      query: { q: '', category: '', author: '', year: '' }, picture: null,
      chat: [], chatBusy: false,
      mood: { status: 'idle', text: '', picks: [], offline: null },
      adminTab: 'overview', editBookId: null, pendingSample: null, pendingBook: null,
    },
  };

  const currentUser = () => (app.state.session ? R.findUser(app.state, app.state.session) : null);
  const ctx = () => ({ state: app.state, user: currentUser(), ui: app.ui });

  /** Replace state, save, and (by default) repaint the page. */
  function commit(next, { paint = true } = {}) {
    app.state = next;
    if (!NS.Store.save(next) && !app.storageWarned) {
      app.storageWarned = true;
      toast('Browser storage is full or blocked, so recent changes may be lost when you close this page.', 'warn');
    }
    if (paint) renderPage();
  }

  // ---- routing ---------------------------------------------------------
  function route() {
    const [path, qs = ''] = (location.hash.replace(/^#/, '') || '/').split('?');
    const parts = path.split('/').filter(Boolean);
    return { name: parts[0] || 'home', id: Number(parts[1]) || null, params: new URLSearchParams(qs) };
  }

  const GUARDS = {
    account: { ok: u => R.isCustomer(u), to: u => (u ? '#/' : '#/login'), msg: u => (u ? 'Accounts belong to customers.' : 'Sign in to see your account.') },
    admin: { ok: u => !!u && u.type === 'SU', to: () => '#/', msg: () => 'That area is for super-users only.' },
    login: { ok: u => !u, to: () => '#/', msg: () => 'You are already signed in.' },
    register: { ok: u => !u, to: () => '#/', msg: () => 'You are already signed in.' },
  };

  function go(hash) {
    if (location.hash === hash) renderPage({ moveFocus: true });
    else location.hash = hash;
  }

  function stopCamera() {
    if (app.stream) app.stream.getTracks().forEach(t => t.stop());
    app.stream = null;
  }

  const NAV = [
    ['#/', 'home', 'Home', 'home'], ['#/browse', 'browse', 'Browse', 'search'],
    ['#/chat', 'chat', 'Ask Inkwell', 'message'], ['#/mood', 'mood', 'Mood matcher', 'sparkles'],
  ];

  function renderChrome(name, user) {
    const items = [...NAV];
    if (R.isCustomer(user)) items.push(['#/account', 'account', 'Account', 'wallet']);
    if (user && user.type === 'SU') items.push(['#/admin', 'admin', 'Admin', 'shield']);
    const current = name === 'book' ? 'browse' : name;
    $('#nav').innerHTML = items.map(([href, id, label, ic]) =>
      `<a href="${href}"${id === current ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('');
    $('#session').innerHTML = user
      ? `<span class="who"><span class="avatar" aria-hidden="true">${esc(user.name[0])}</span><span class="who__text"><strong>${esc(user.name)}</strong>
          <span class="badge${user.type === 'VC' ? ' badge--vip' : ''}">${user.type === 'VC' ? icon('crown') : ''}${typeLabel(user.type)}</span></span></span>
         <button class="btn btn--ghost btn--sm" data-action="logout">${icon('logout')}<span>Sign out</span></button>`
      : `<a class="btn btn--ghost btn--sm session__register" href="#/register">Register</a><a class="btn btn--primary btn--sm" href="#/login">${icon('user')}<span>Sign in</span></a>`;
  }

  const TITLES = { home: 'Home', browse: 'Browse', chat: 'Ask Inkwell', mood: 'Mood matcher', account: 'Your account', admin: 'Admin', login: 'Sign in', register: 'Register', book: 'Book' };

  function renderPage({ moveFocus = false } = {}) {
    stopCamera();
    const r = route();
    const user = currentUser();
    const guard = GUARDS[r.name];
    if (guard && !guard.ok(user)) {
      toast(guard.msg(user), 'warn');
      location.replace(guard.to(user));
      return;
    }
    const c = ctx();
    const V = { ...NS.ViewsPublic, ...NS.ViewsAccount, ...NS.ViewsAdmin };
    const pages = {
      home: () => V.home(c), browse: () => V.browse(c), book: () => V.detail(c, r.id), chat: () => V.chat(c),
      mood: () => V.mood(c), account: () => V.account(c), admin: () => V.admin(c), login: () => V.login(c), register: () => V.register(c),
    };
    const activeId = document.activeElement && document.activeElement.id;
    $('#app').innerHTML = (pages[r.name] || pages.home)();
    renderChrome(pages[r.name] ? r.name : 'home', user);
    const book = r.name === 'book' ? app.state.books.find(b => b.id === r.id) : null;
    document.title = `${book ? book.title : TITLES[r.name] || 'Home'} · Inkwell Smart Bookstore`;

    if (moveFocus) {
      const h = $('#page-title');
      if (h) h.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    } else if (activeId) {
      const same = document.getElementById(activeId);
      if (same) same.focus({ preventScroll: true });
    }
    if (r.name === 'chat') paintChatScroll();
    if (app.notice) { toast(app.notice, 'warn'); app.notice = null; }
  }

  function paintChatScroll() {
    const log = $('#chat-log');
    if (log) log.scrollTop = log.scrollHeight;
  }

  /** Runs when the URL changes: sync URL-driven state, log one view per book page opened (R2.6). */
  function onRouteChange() {
    const r = route();
    if (r.name === 'browse') {
      app.ui.query = { q: r.params.get('q') || '', category: r.params.get('category') || '', author: r.params.get('author') || '', year: r.params.get('year') || '' };
      if (app.ui.picture) URL.revokeObjectURL(app.ui.picture.url);
      app.ui.picture = null;
    }
    const key = location.hash;
    if (r.name === 'book' && key !== app.lastViewKey && app.state.books.some(b => b.id === r.id)) {
      app.lastViewKey = key;
      const user = currentUser();
      commit({ ...app.state, views: [...app.state.views, { userId: user ? user.id : null, bookId: r.id, date: new Date().toISOString() }] }, { paint: false });
    } else if (r.name !== 'book') app.lastViewKey = '';
    renderPage({ moveFocus: true });
  }

  function start() {
    window.addEventListener('hashchange', onRouteChange);
    onRouteChange();
  }

  NS.App = { app, ctx, currentUser, commit, go, route, renderPage, renderChrome, stopCamera, paintChatScroll, start };
})(typeof self !== 'undefined' ? self : this);
