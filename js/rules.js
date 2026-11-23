/* Inkwell business rules. Pure functions: (state, input) -> new state. No DOM, no storage.
   Every rule maps to a requirement id in the SRS (R5.4 etc). Tested in tests/rules.test.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.Inkwell = root.Inkwell || {}).Rules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Business constants from SRS 3.2.2. Money is integer cents everywhere. */
  const CONFIG = Object.freeze({
    TOP_COUNT: 3, FINE: 100, VIP_DISCOUNT: 0.1,
    PROMOTE_AFTER_PURCHASES: 3, PROMOTE_AFTER_SPENT: 20000,
    PURCHASER_WEIGHT: 2, VIP_WEIGHT_BONUS: 1,
    TABOO_MASK_MAX: 3, WARNING_LIMIT: 2,
    LIST_MIN_RATINGS: 3, NO_ORDER_BELOW: 2, TO_ORDER_ABOVE: 4,
    MOOD_MAX: 3, COMMENT_MAX: 2000,
  });

  const LEVEL = { VS: 1, RC: 2, VC: 3, SU: 4 };
  const CUSTOMER = ['RC', 'VC'];
  const STOP = new Set(['the', 'and', 'for', 'with', 'what', 'are', 'your', 'you', 'about', 'tell', 'show',
    'who', 'how', 'can', 'this', 'that', 'there', 'have', 'does', 'any', 'some', 'something', 'book',
    'books', 'read', 'want', 'like', 'need', 'give', 'find', 'please', 'from', 'was', 'when', 'where',
    'which', 'would', 'could', 'into', 'out', 'has', 'its', 'our', 'but', 'not', 'all']);

  const levelOf = type => LEVEL[type] || 1;
  const words = s => String(s == null ? '' : s).toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [];
  const meaningful = s => words(s).filter(w => w.length > 2 && !STOP.has(w));
  const money = c => (c < 0 ? '-' : '') + '$' + (Math.abs(c) / 100).toFixed(2);
  const nextId = list => list.reduce((m, x) => Math.max(m, x.id), 0) + 1;
  const findUser = (s, id) => s.users.find(u => u.id === id) || null;
  const replaceUser = (s, u) => ({ ...s, users: s.users.map(x => (x.id === u.id ? u : x)) });
  const isCustomer = u => !!u && CUSTOMER.includes(u.type);

  function toCents(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  }

  // ---- account balance (UC-04) -----------------------------------------
  function deposit(state, userId, cents) {
    const user = findUser(state, userId);
    if (!isCustomer(user)) return { state, ok: false, error: 'Only customers have an account balance.' };
    if (!Number.isInteger(cents) || cents <= 0) return { state, ok: false, error: 'Enter an amount greater than $0.00.' };
    return { state: replaceUser(state, { ...user, balance: user.balance + cents }), ok: true };
  }

  // ---- purchase (UC-05) ------------------------------------------------
  const priceFor = (user, book) =>
    user && user.type === 'VC' ? Math.round(book.price * (1 - CONFIG.VIP_DISCOUNT)) : book.price;

  function statsOf(state, userId) {
    const mine = state.purchases.filter(p => p.userId === userId);
    return { count: mine.length, spent: mine.reduce((n, p) => n + p.paid, 0) };
  }

  function purchase(state, userId, bookId, now) {
    const user = findUser(state, userId);
    const book = state.books.find(b => b.id === bookId);
    const refuse = reason => ({ state, outcome: { ok: false, reason } });
    if (!book) return refuse('unknown-book');
    if (!isCustomer(user)) return refuse('not-allowed');
    if (user.status !== 'active') return refuse('suspended');

    const price = priceFor(user, book);
    if (user.balance < price) { // R5.4 refuse + $1 fine, R5.5 suspend when below zero
      const balance = user.balance - CONFIG.FINE;
      const suspended = balance < 0;
      const next = { ...user, balance, status: suspended ? 'suspended' : 'active' };
      const fines = [...state.fines, { userId, amount: CONFIG.FINE, date: now }];
      return {
        state: replaceUser({ ...state, fines }, next),
        outcome: { ok: false, reason: 'insufficient', price, fine: CONFIG.FINE, balance, suspended },
      };
    }
    const purchases = [...state.purchases, { id: nextId(state.purchases), userId, bookId, paid: price, date: now }];
    const paidState = replaceUser({ ...state, purchases }, { ...user, balance: user.balance - price });
    const { count, spent } = statsOf(paidState, userId);
    const promoted = user.type === 'RC' &&
      (count > CONFIG.PROMOTE_AFTER_PURCHASES || spent > CONFIG.PROMOTE_AFTER_SPENT);
    const final = promoted ? replaceUser(paidState, { ...findUser(paidState, userId), type: 'VC' }) : paidState;
    return { state: final, outcome: { ok: true, paid: price, balance: user.balance - price, promoted } };
  }

  // ---- ratings, taboo words, reviews (UC-06, UC-07) -------------------
  const reviewWeight = (type, purchaser) =>
    (purchaser ? CONFIG.PURCHASER_WEIGHT : 1) + (type === 'VC' ? CONFIG.VIP_WEIGHT_BONUS : 0);

  function ratingOf(state, bookId) {
    const rs = state.reviews.filter(r => r.bookId === bookId);
    const total = rs.reduce((n, r) => n + r.weight, 0);
    const sum = rs.reduce((n, r) => n + r.stars * r.weight, 0);
    return { count: rs.length, average: total ? sum / total : 0 };
  }

  function listStatus(state, bookId) {
    const { count, average } = ratingOf(state, bookId);
    if (count <= CONFIG.LIST_MIN_RATINGS) return '';
    if (average < CONFIG.NO_ORDER_BELOW) return 'no-order';
    if (average > CONFIG.TO_ORDER_ABOVE) return 'to-order';
    return '';
  }

  function tabooCheck(text, list) {
    const set = new Set(list.map(w => w.toLowerCase()));
    let count = 0;
    const masked = String(text).replace(/[\p{L}\p{N}_]+/gu, w => {
      if (!set.has(w.toLowerCase())) return w;
      count += 1;
      return '*';
    });
    return { count, masked, blocked: count > CONFIG.TABOO_MASK_MAX };
  }

  function addReview(state, { userId, bookId, stars, text, now }) {
    const user = userId ? findUser(state, userId) : null;
    const st = Number(stars);
    if (!Number.isInteger(st) || st < 1 || st > 5 || !state.books.some(b => b.id === bookId)) {
      return { state, outcome: { ok: false, reason: 'invalid' } };
    }
    const check = tabooCheck(String(text || '').trim().slice(0, CONFIG.COMMENT_MAX), state.taboo);

    if (check.blocked) { // R6.4 blocked in full; R6.5 warning for RC/VC only
      if (!isCustomer(user)) return { state, outcome: { ok: false, blocked: true, warnings: 0 } };
      const warnings = user.warnings + 1;
      let next = { ...user, warnings };
      const outcome = { ok: false, blocked: true, warnings, suspended: false, demoted: false };
      if (warnings > CONFIG.WARNING_LIMIT) { // R6.6
        if (user.type === 'RC') { next = { ...next, status: 'suspended' }; outcome.suspended = true; }
        else { next = { ...next, type: 'RC', warnings: 0 }; outcome.demoted = true; }
      }
      return { state: replaceUser(state, next), outcome };
    }

    const authorKey = user ? user.id : 'visitor';
    const purchaser = !!user && state.purchases.some(p => p.userId === user.id && p.bookId === bookId);
    const authorType = user ? user.type : 'VS';
    const kept = state.reviews.filter(r => !(r.authorKey === authorKey && r.bookId === bookId));
    const review = {
      id: nextId(state.reviews), bookId, authorKey, authorName: user ? user.name : 'Visitor', authorType,
      stars: st, text: check.masked, weight: reviewWeight(authorType, purchaser), purchaser, date: now,
    };
    return { state: { ...state, reviews: [...kept, review] }, outcome: { ok: true, blocked: false, masked: check.count } };
  }

  // ---- reopen suspended account (UC-08) -------------------------------
  function reopen(state, userId, cents, now) {
    const user = findUser(state, userId);
    if (!user || user.status !== 'suspended') return { state, ok: false, error: 'That account is not suspended.' };
    if (!Number.isInteger(cents) || cents < 0) return { state, ok: false, error: 'Enter a deposit of $0.00 or more.' };
    const balance = user.balance + cents;
    if (balance <= 0) return { state, ok: false, needed: 1 - balance, error: 'Balance must end above $0.00.' };
    const next = { ...user, balance, status: 'active', warnings: 0 };
    return {
      state: { ...replaceUser(state, next), reopenings: [...state.reopenings, { userId, amount: cents, date: now }] },
      ok: true,
    };
  }

  // ---- top page (UC-01) -----------------------------------------------
  function popularity(state, book) {
    return (book.baseViews || 0) +
      state.views.filter(v => v.bookId === book.id).length +
      state.purchases.filter(p => p.bookId === book.id).length;
  }

  function topBooks(state, user) {
    const byPopularity = [...state.books].sort((a, b) => popularity(state, b) - popularity(state, a) || a.title.localeCompare(b.title));
    const popular = { books: byPopularity.slice(0, CONFIG.TOP_COUNT), mode: 'popular' };
    if (!isCustomer(user)) return popular;

    const touched = new Map(); // bookId -> interactions (a purchase counts double)
    state.views.filter(v => v.userId === user.id).forEach(v => touched.set(v.bookId, (touched.get(v.bookId) || 0) + 1));
    state.purchases.filter(p => p.userId === user.id).forEach(p => touched.set(p.bookId, (touched.get(p.bookId) || 0) + 2));
    if (!touched.size) return popular; // R1.4

    const own = state.books.filter(b => touched.has(b.id))
      .sort((a, b) => ratingOf(state, b.id).average - ratingOf(state, a.id).average || touched.get(b.id) - touched.get(a.id));
    const cats = new Set(own.map(b => b.category));
    const similar = byPopularity.filter(b => !touched.has(b.id) && cats.has(b.category));
    const rest = byPopularity.filter(b => !touched.has(b.id) && !cats.has(b.category));
    return { books: [...own, ...similar, ...rest].slice(0, CONFIG.TOP_COUNT), mode: 'personal' };
  }

  // ---- search (UC-02) -------------------------------------------------
  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    const n = m ? parseInt(m[1], 16) : 0;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  /** Picture search: nearest cover colour to the picture's average colour. */
  function rankByColor(books, rgb, n = 3) {
    const dist = b => { const c = hexToRgb(b.color); return (c.r - rgb.r) ** 2 + (c.g - rgb.g) ** 2 + (c.b - rgb.b) ** 2; };
    return [...books].sort((a, b) => dist(a) - dist(b)).slice(0, n);
  }

  function searchBooks(books, { q = '', category = '', author = '', year = '', imageIds = null } = {}) {
    const terms = words(q);
    const ids = imageIds ? new Set(imageIds) : null;
    return books.filter(b => {
      const hay = `${b.title} ${b.author} ${b.category} ${b.description}`.toLowerCase();
      return terms.every(t => hay.includes(t)) &&
        (!category || b.category === category) &&
        (!author || b.author === author) &&
        (!year || b.year === Number(year)) &&
        (!ids || ids.has(b.id));
    });
  }

  // ---- add / edit book (UC-09) ----------------------------------------
  function validateBook(input, books, { allowDuplicate = false, editId = null } = {}) {
    const errors = {};
    const title = String(input.title || '').trim();
    const author = String(input.author || '').trim();
    const category = String(input.category || '').trim();
    const price = toCents(input.price);
    const yearText = String(input.year == null ? '' : input.year).trim();
    const year = yearText === '' ? null : Number(yearText);
    if (!title) errors.title = 'Title is required.';
    if (!author) errors.author = 'Author is required.';
    if (!category) errors.category = 'Category is required.';
    if (price === null) errors.price = 'Enter a price of $0.00 or more.';
    if (year !== null && (!Number.isInteger(year) || year < 1 || year > 2100)) errors.year = 'Enter a year from 1 to 2100.';
    if (Object.keys(errors).length) return { ok: false, errors, duplicate: false };

    const same = b => b.id !== editId && b.title.toLowerCase() === title.toLowerCase() && b.author.toLowerCase() === author.toLowerCase();
    if (!allowDuplicate && books.some(same)) return { ok: false, errors: {}, duplicate: true };
    const description = String(input.description || '').trim();
    return {
      ok: true, errors: {}, duplicate: false,
      book: {
        title, author, category, price, description, year: year === null ? new Date().getFullYear() : year,
        color: input.color || '#3b4f45', image: input.image || null, tags: `${category} ${description}`,
      },
    };
  }

  const addBook = (state, book) => ({ ...state, books: [...state.books, { baseViews: 0, ...book, id: nextId(state.books) }] });
  const updateBook = (state, id, patch) => ({ ...state, books: state.books.map(b => (b.id === id ? { ...b, ...patch } : b)) });

  // ---- chat: access levels + local retrieval (UC-10) ------------------
  const isFinanceQuestion = q => /\b(financ\w*|revenue|profit|earnings|sales report)\b/i.test(q);

  /** Access is applied BEFORE searching (R10.7): a doc above the user's level is never read. */
  function retrieve(docs, question, level) {
    const qw = meaningful(question);
    if (!qw.length) return null;
    let best = null;
    for (const doc of docs) {
      if (doc.level > level) continue;
      const score = doc.keywords.filter(k => qw.some(w => w === k || (k.length >= 4 && w.startsWith(k)))).length;
      if (score > 0 && (!best || score > best.score)) best = { doc, score };
    }
    return best;
  }

  // ---- mood matcher (UC-11) -------------------------------------------
  function moodFallback(state, text) {
    const wanted = [...new Set(meaningful(text))];
    return state.books
      .map(book => {
        const bag = new Set(words(`${book.tags} ${book.description} ${book.category} ${book.title}`));
        const hits = wanted.filter(w => bag.has(w));
        return { book, hits, noOrder: listStatus(state, book.id) === 'no-order' };
      })
      .filter(x => x.hits.length)
      .sort((a, b) => Number(a.noOrder) - Number(b.noOrder) || b.hits.length - a.hits.length)
      .slice(0, CONFIG.MOOD_MAX)
      .map(x => ({ book: x.book, reason: `Matches: ${x.hits.join(', ')}` }));
  }

  /** Accept only picks that exist in the catalog (R11.2); never trust the model's titles. */
  function parseMood(text, books) {
    const m = /\[[\s\S]*\]/.exec(String(text || ''));
    if (!m) return [];
    let items;
    try { items = JSON.parse(m[0]); } catch { return []; }
    if (!Array.isArray(items)) return [];
    const seen = new Set();
    const out = [];
    for (const it of items) {
      const title = it && typeof it.title === 'string' ? it.title.trim().toLowerCase() : '';
      const book = books.find(b => b.title.toLowerCase() === title);
      if (!book || seen.has(book.id)) continue;
      seen.add(book.id);
      out.push({ book, reason: String(it.reason || '').replace(/\s+/g, ' ').trim().slice(0, 160) });
      if (out.length === CONFIG.MOOD_MAX) break;
    }
    return out;
  }

  // ---- finance report (SU only) ---------------------------------------
  function financeReport(state) {
    const sales = state.purchases.reduce((n, p) => n + p.paid, 0);
    const fines = state.fines.reduce((n, f) => n + f.amount, 0);
    const tally = new Map();
    state.purchases.forEach(p => tally.set(p.bookId, (tally.get(p.bookId) || 0) + 1));
    const [topId, topCount] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
    const top = topId ? { title: (state.books.find(b => b.id === topId) || {}).title || 'Unknown', count: topCount } : null;
    return {
      sales, fines, revenue: sales + fines, count: state.purchases.length, top,
      balances: state.users.filter(isCustomer).reduce((n, u) => n + u.balance, 0),
    };
  }

  return {
    CONFIG, levelOf, words, money, toCents, nextId, findUser, replaceUser, isCustomer,
    deposit, priceFor, statsOf, purchase, reviewWeight, ratingOf, listStatus, tabooCheck, addReview,
    reopen, topBooks, popularity, hexToRgb, rankByColor, searchBooks, validateBook, addBook, updateBook,
    isFinanceQuestion, retrieve, moodFallback, parseMood, financeReport,
  };
});
