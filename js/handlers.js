/* Event handlers: clicks, form submits, camera, purchase and admin flows. Loaded last; starts the app. */
(function (root) {
  'use strict';
  const NS = (root.Inkwell = root.Inkwell || {});
  const R = NS.Rules;
  const { $, esc, icon, cover, toast, openDialog, closeDialog } = NS.UI;
  const A = NS.App;
  const { app } = A;
  const nowIso = () => new Date().toISOString();
  const say = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };
  const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

  // ---- sign in / out ---------------------------------------------------
  function signIn(id) {
    A.commit({ ...app.state, session: id }, { paint: false });
    const u = A.currentUser();
    toast(`Welcome back, ${u.name}.`, 'ok');
    A.go(u.type === 'SU' ? '#/admin' : '#/');
  }
  function signOut() {
    A.commit({ ...app.state, session: null }, { paint: false });
    toast('You have signed out.');
    A.go('#/');
  }
  function suspendedDialog(reason) {
    openDialog('Account suspended', `<p class="notice notice--error">${icon('alert')}<span>${esc(reason)}</span></p>
      <p>You have been signed out. Please contact a super-user to reinstate your account.</p>
      <div class="row"><button class="btn btn--primary" data-action="close">Understood</button></div>`);
  }

  function demoLogin(id) {
    const u = R.findUser(app.state, id);
    if (!u) return;
    if (u.status === 'suspended') return toast('This account is suspended. Please contact a super-user.', 'error');
    signIn(id);
  }

  // ---- camera + face (UC-03) -------------------------------------------
  const CAMERA_ERRORS = {
    NotFoundError: 'No camera was found. Connect one, or use a demo account.',
    NotAllowedError: 'Camera access was blocked. Allow it in the address bar, then try again.',
    NotReadableError: 'The camera is busy in another app. Close that app and try again.',
  };
  async function startCamera() {
    const video = $('#cam-video');
    if (!video) return;
    A.stopCamera();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return say('#cam-status', 'This browser cannot open a camera here. Serve the page from http://localhost, or use a demo account.');
    }
    say('#cam-status', 'Starting camera...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (!$('#cam-video')) { stream.getTracks().forEach(t => t.stop()); return; }
      app.stream = stream;
      video.srcObject = stream;
      $('#cam-off').hidden = true;
      $('#scan-btn').disabled = false;
      say('#cam-status', 'Camera ready. Centre your face in good light.');
    } catch (e) {
      say('#cam-status', CAMERA_ERRORS[e.name] || 'The camera could not be started. Check it is connected and try again.');
    }
  }

  function faceLogin() {
    const video = $('#cam-video');
    if (!app.stream || !video.videoWidth) return say('#cam-status', 'Turn on the camera first.');
    const hit = NS.Biometric.nearest(NS.Biometric.frameSignature(video), app.state.users);
    if (!hit) return say('#cam-status', 'We did not recognise that face. Centre it in good light and try again.'); // R3.6: no account hints
    const u = R.findUser(app.state, hit.id);
    if (u.status === 'suspended') return say('#cam-status', 'This account is suspended. Please contact a super-user.'); // R3.4
    signIn(u.id);
  }

  function faceCapture() {
    const video = $('#cam-video');
    if (!app.stream || !video.videoWidth) return say('#cam-status', 'Turn on the camera first.');
    const sig = NS.Biometric.frameSignature(video);
    if (NS.Biometric.nearest(sig, app.state.users)) return say('#sample-state', 'That face is already registered. Sign in instead.');
    app.ui.pendingSample = sig;
    $('#sample-state').className = 'ok';
    say('#sample-state', 'Sample captured.');
  }

  // ---- purchase (UC-05) ------------------------------------------------
  function confirmBuy(id) {
    const { state, user } = A.ctx();
    const b = state.books.find(x => x.id === id);
    if (!user) { toast('Sign in as a customer to buy.', 'warn'); return A.go('#/login'); }
    if (!b || !R.isCustomer(user)) return;
    const price = R.priceFor(user, b);
    openDialog('Confirm purchase', `<div class="dlg-book">${cover(b, 'sm')}<div><strong>${esc(b.title)}</strong><span class="muted">${esc(b.author)}</span></div></div>
      <dl class="sum"><div><dt>List price</dt><dd>${R.money(b.price)}</dd></div>
        ${price !== b.price ? `<div><dt>VIP discount (10%)</dt><dd>-${R.money(b.price - price)}</dd></div>` : ''}
        <div class="sum__total"><dt>You pay</dt><dd>${R.money(price)}</dd></div><div><dt>Your balance</dt><dd>${R.money(user.balance)}</dd></div></dl>
      ${user.balance < price ? `<p class="notice notice--warn">${icon('alert')}<span>Your balance is lower than the price. The sale will be refused and a ${R.money(R.CONFIG.FINE)} fine charged.</span></p>` : ''}
      <div class="row"><button class="btn btn--primary" data-action="confirm-buy" data-id="${id}">Confirm purchase</button><button class="btn btn--ghost" data-action="close">Cancel</button></div>`);
  }

  function buy(id) {
    const { state, user } = A.ctx();
    const b = state.books.find(x => x.id === id);
    if (!user || !b) return;
    const { state: next, outcome } = R.purchase(state, user.id, id, nowIso());
    if (outcome.ok) {
      A.commit(next);
      return openDialog('Purchase complete', `<p>You bought <strong>${esc(b.title)}</strong> for ${R.money(outcome.paid)}. New balance: <strong>${R.money(outcome.balance)}</strong>.</p>
        ${outcome.promoted ? `<p class="notice notice--ok">${icon('crown')}<span>You are now a VIP customer. Every purchase is 10% off.</span></p>` : ''}
        <div class="row"><a class="btn btn--primary" href="#/account" data-action="close">View account</a><button class="btn btn--ghost" data-action="close">Keep browsing</button></div>`);
    }
    if (outcome.reason !== 'insufficient') return toast('That purchase is not possible right now.', 'error');
    if (outcome.suspended) { // R5.5: suspended at once, so end the session and show the popup
      A.commit({ ...next, session: null });
      return suspendedDialog(`Your balance is ${R.money(outcome.balance)} after a ${R.money(outcome.fine)} fine, so your account is suspended.`);
    }
    A.commit(next);
    openDialog('Purchase refused', `<p class="notice notice--error">${icon('alert')}<span>The price is more than your balance. A ${R.money(outcome.fine)} fine was charged and the book was not bought.</span></p>
      <p>New balance: <strong>${R.money(outcome.balance)}</strong>.</p><div class="row"><button class="btn btn--primary" data-action="close">Understood</button></div>`);
  }

  // ---- forms -----------------------------------------------------------
  function submitReview(f, d) {
    const { user } = A.ctx();
    const stars = Number(d.get('stars'));
    const feedback = $('#review-feedback');
    if (!stars) { feedback.innerHTML = '<p class="notice notice--error">Choose a star rating first.</p>'; return; }
    const text = String(d.get('comment') || '');
    const { state, outcome } = R.addReview(app.state, { userId: user ? user.id : null, bookId: Number(f.dataset.id), stars, text, now: nowIso() });
    if (outcome.blocked) {
      let msg = `Comment blocked: more than ${R.CONFIG.TABOO_MASK_MAX} banned words. Your rating was not counted.`;
      if (user && R.isCustomer(user)) msg += ` Warning ${outcome.warnings} of ${R.CONFIG.WARNING_LIMIT + 1}.`;
      if (outcome.demoted) msg += ' You have been moved from VIP to registered customer.';
      if (outcome.suspended) { A.commit({ ...state, session: null }); return suspendedDialog('Your account was suspended after repeated blocked comments.'); }
      A.commit(state);
      const box = $('#comment');
      if (box) box.value = text; // let them edit and retry
      return say('#review-feedback', `<p class="notice notice--error">${esc(msg)}</p>`);
    }
    A.commit(state);
    toast(outcome.masked ? `Review posted. ${outcome.masked} banned ${outcome.masked === 1 ? 'word was' : 'words were'} replaced with *.` : 'Review posted.', 'ok');
  }

  function submitDeposit(d) {
    const { user } = A.ctx();
    const res = R.deposit(app.state, user.id, R.toCents(d.get('amount')));
    if (!res.ok) return say('#deposit-feedback', `<p class="notice notice--error">${esc(res.error)}</p>`);
    A.commit(res.state);
    toast('Deposit added.', 'ok');
  }

  function submitRegister(d) {
    const name = String(d.get('name') || '').trim();
    const cents = R.toCents(d.get('deposit'));
    const fail = msg => say('#register-feedback', `<p class="notice notice--error">${esc(msg)}</p>`);
    if (!name) return fail('Enter your name.');
    if (!app.ui.pendingSample) return fail('Record a face sample first.');
    if (!cents) return fail('Enter a first deposit greater than $0.00.');
    const user = { id: `u${Date.now().toString(36)}`, name, type: 'RC', balance: cents, warnings: 0, status: 'active', sample: app.ui.pendingSample };
    app.ui.pendingSample = null;
    A.commit({ ...app.state, users: [...app.state.users, user], session: user.id }, { paint: false });
    toast(`Welcome, ${name}. Your account is ready.`, 'ok');
    A.go('#/account');
  }

  function showFieldErrors(form, errors) {
    form.querySelectorAll('.field__error').forEach(n => n.remove());
    form.querySelectorAll('.has-error').forEach(n => n.classList.remove('has-error'));
    let first = null;
    for (const [name, msg] of Object.entries(errors)) {
      const input = form.elements[name];
      if (!input) continue;
      const wrap = input.closest('.field');
      const span = document.createElement('span');
      span.className = 'field__error';
      span.id = `${input.id}-err`;
      span.textContent = msg;
      wrap.classList.add('has-error');
      wrap.appendChild(span);
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', span.id);
      first = first || input;
    }
    if (first) first.focus();
  }

  function saveBook(input, editId, allowDuplicate) {
    const v = R.validateBook(input, app.state.books, { allowDuplicate, editId });
    if (v.duplicate) {
      app.ui.pendingBook = { input, editId };
      return openDialog('Possible duplicate', `<p>A book with this title and author is already in the catalog. Add another copy anyway?</p>
        <div class="row"><button class="btn btn--primary" data-action="confirm-duplicate">Add anyway</button><button class="btn btn--ghost" data-action="close">Cancel</button></div>`);
    }
    if (!v.ok) return showFieldErrors($('form[data-form=book]'), v.errors);
    const patch = { title: v.book.title, author: v.book.author, category: v.book.category, price: v.book.price, year: v.book.year, description: v.book.description, color: v.book.color };
    if (input.image) patch.image = input.image;
    if (editId) A.commit(R.updateBook(app.state, editId, patch));
    else A.commit(R.addBook(app.state, { ...v.book, ...(input.image ? { image: input.image } : {}) }));
    app.ui.editBookId = null;
    A.renderPage();
    toast(editId ? 'Book updated.' : 'Book added. It is in the catalog now.', 'ok');
  }

  async function submitBook(f, d) {
    const file = d.get('cover');
    const input = Object.fromEntries(['title', 'author', 'category', 'year', 'price', 'description', 'color'].map(k => [k, d.get(k)]));
    if (file && file.size) {
      if (!IMAGE_TYPES.includes(file.type) || file.size > IMAGE_MAX_BYTES) return showFieldErrors(f, { cover: 'Choose a PNG, JPEG or WebP image under 8 MB.' });
      try { input.image = await NS.UI.coverDataUrl(file); }
      catch { return showFieldErrors(f, { cover: 'That image could not be read. Try another file.' }); }
    }
    saveBook(input, Number(f.dataset.id) || null, false);
  }

  function submitReopen(f, d) {
    const cents = R.toCents(d.get('amount'));
    if (cents === null) return toast('Enter a deposit of $0.00 or more.', 'error');
    const res = R.reopen(app.state, f.dataset.id, cents, nowIso());
    if (!res.ok) return toast(res.needed ? `Still suspended. Deposit at least ${R.money(res.needed)} more so the balance is above $0.00.` : res.error, 'error');
    A.commit(res.state);
    toast('Account reopened and recorded in the log.', 'ok');
  }

  function submitTaboo(d) {
    const word = String(d.get('word') || '').trim().toLowerCase();
    if (!word) return toast('Type a word to add.', 'error');
    if (!/^[\p{L}\p{N}_]+$/u.test(word)) return toast('Use one word with letters or numbers only.', 'error');
    if (app.state.taboo.includes(word)) return toast(`"${word}" is already on the list.`, 'error');
    A.commit({ ...app.state, taboo: [...app.state.taboo, word] });
    toast(`Added "${word}".`, 'ok');
    const box = $('#tw'); if (box) box.focus();
  }

  // ---- browse (live filtering, URL as state) ---------------------------
  function paintResults() {
    const res = NS.ViewsPublic.browseResults(A.ctx());
    say('#results', res.html);
    say('#results-count', `${res.count} ${res.count === 1 ? 'book' : 'books'} found`);
    const qs = new URLSearchParams(Object.entries(app.ui.query).filter(([, v]) => v));
    history.replaceState(null, '', `#/browse${qs.toString() ? `?${qs}` : ''}`);
  }

  async function choosePicture(input) {
    const file = input.files[0];
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) || file.size > IMAGE_MAX_BYTES) return toast('Choose a PNG, JPEG or WebP picture under 8 MB.', 'error');
    try {
      const { r, g, b, url } = await NS.UI.imageInfo(file);
      if (app.ui.picture) URL.revokeObjectURL(app.ui.picture.url);
      app.ui.picture = { url, ids: R.rankByColor(app.state.books, { r, g, b }, 3).map(x => x.id) };
      say('#picture-slot', NS.ViewsPublic.pictureChip(app.ui.picture));
      paintResults();
    } catch { toast('That picture could not be read. Try another file.', 'error'); }
  }

  // ---- finance CSV -----------------------------------------------------
  const csvCell = v => { const s = String(v); return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`; };
  function downloadReport() {
    const { state } = A.ctx();
    const name = id => (R.findUser(state, id) || {}).name || id;
    const rows = [
      ['Type', 'Customer', 'Item', 'Amount USD', 'Date'],
      ...state.purchases.map(p => ['Sale', name(p.userId), (state.books.find(b => b.id === p.bookId) || {}).title || 'Removed book', (p.paid / 100).toFixed(2), p.date]),
      ...state.fines.map(f => ['Fine', name(f.userId), 'Over-balance purchase', (f.amount / 100).toFixed(2), f.date]),
    ];
    const url = URL.createObjectURL(new Blob([rows.map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'inkwell-finance.csv' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Finance report downloaded.', 'ok');
  }

  // ---- delegated events ------------------------------------------------
  const ACTIONS = {
    close: () => closeDialog(),
    buy: id => confirmBuy(id),
    'confirm-buy': id => { closeDialog(); buy(id); },
    logout: signOut,
    'demo-login': (id, el) => demoLogin(el.dataset.id),
    'cam-start': startCamera, 'face-login': faceLogin, 'face-capture': faceCapture,
    'fill-deposit': (id, el) => { $('#reg-deposit').value = el.dataset.amount; },
    'fill-amount': (id, el) => { $('#dep').value = el.dataset.amount; },
    ask: (id, el) => NS.Chat.sendChat(el.dataset.text),
    'clear-chat': () => { app.ui.chat = []; A.renderPage(); },
    'mood-chip': (id, el) => { const i = $('#mood-q'); i.value = el.dataset.text; i.focus(); },
    'clear-search': () => { app.ui.query = { q: '', category: '', author: '', year: '' }; if (app.ui.picture) URL.revokeObjectURL(app.ui.picture.url); app.ui.picture = null; history.replaceState(null, '', '#/browse'); A.renderPage(); },
    'clear-picture': () => { URL.revokeObjectURL(app.ui.picture.url); app.ui.picture = null; say('#picture-slot', NS.ViewsPublic.pictureChip(null)); paintResults(); },
    'admin-tab': (id, el) => { app.ui.adminTab = el.dataset.tab; app.ui.editBookId = null; A.renderPage(); },
    'edit-book': id => { app.ui.editBookId = id; A.renderPage(); const t = $('#bk-title'); if (t) { t.scrollIntoView({ block: 'center' }); t.focus(); } },
    'cancel-edit': () => { app.ui.editBookId = null; A.renderPage(); },
    'confirm-duplicate': () => { closeDialog(); const p = app.ui.pendingBook; if (p) saveBook(p.input, p.editId, true); },
    'remove-taboo': (id, el) => { A.commit({ ...app.state, taboo: app.state.taboo.filter(w => w !== el.dataset.word) }); toast(`Removed "${el.dataset.word}".`); },
    'download-report': downloadReport,
    'reset-demo': () => openDialog('Reset demo data?', `<p>This restores the sample books, accounts and reviews and signs you out. Accounts you registered are removed.</p>
      <div class="row"><button class="btn btn--primary" data-action="confirm-reset">Reset everything</button><button class="btn btn--ghost" data-action="close">Cancel</button></div>`),
    'confirm-reset': () => { closeDialog(); app.ui.chat = []; app.ui.picture = null; A.commit(NS.Store.reset()); A.go('#/'); toast('Demo data restored.', 'ok'); },
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.action];
    if (!fn) return;
    if (el.tagName === 'A' && el.dataset.action === 'close') closeDialog(); // let the link navigate
    else e.preventDefault();
    fn(Number(el.dataset.id) || el.dataset.id, el);
  });

  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const d = new FormData(f);
    const forms = {
      'hero-search': () => A.go(`#/browse${d.get('q').trim() ? `?q=${encodeURIComponent(d.get('q').trim())}` : ''}`),
      browse: () => {},
      review: () => submitReview(f, d), deposit: () => submitDeposit(d), register: () => submitRegister(d),
      chat: () => { const i = $('#chat-input'); if (app.ui.chatBusy) return; const q = i.value; i.value = ''; NS.Chat.sendChat(q); i.focus(); },
      mood: () => NS.Chat.runMood(d.get('q')), book: () => submitBook(f, d),
      reopen: () => submitReopen(f, d), taboo: () => submitTaboo(d),
    };
    (forms[f.dataset.form] || (() => {}))();
  });

  document.addEventListener('input', e => {
    const f = e.target.closest('form[data-form=browse]');
    if (!f) return;
    const d = new FormData(f);
    app.ui.query = { q: d.get('q').trim(), category: d.get('category'), author: d.get('author'), year: d.get('year') };
    paintResults();
  });

  document.addEventListener('change', e => {
    if (e.target.dataset && e.target.dataset.change === 'picture') choosePicture(e.target);
  });

  document.addEventListener('keydown', e => {
    const el = e.target.closest && e.target.closest('[data-key-activate]');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); document.getElementById(el.dataset.keyActivate).click(); }
  });

  $('#dialog').addEventListener('click', e => { if (e.target === $('#dialog')) closeDialog(); });
  $('#dialog-close').addEventListener('click', closeDialog);

  A.start();
})(typeof self !== 'undefined' ? self : this);
