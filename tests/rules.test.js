'use strict';
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');

const book = (id, over = {}) => ({
  id, title: `Book ${id}`, author: `Author ${id}`, category: 'Literature', year: 1900 + id,
  price: 1000, description: 'A story', tags: 'classic', color: '#335544', baseViews: 0, ...over,
});
const user = (id, type, over = {}) => ({
  id, name: `User ${id}`, type, balance: 5000, warnings: 0, status: 'active', sample: null, ...over,
});
const make = (over = {}) => ({
  users: [user('rc', 'RC'), user('vc', 'VC'), user('su', 'SU')],
  books: [book(1), book(2, { category: 'Mystery', price: 2000 }), book(3), book(4)],
  purchases: [], reviews: [], views: [], fines: [], reopenings: [],
  taboo: ['spam', 'scam', 'idiot', 'fool'], ...over,
});
const u = (s, id) => s.users.find(x => x.id === id);

// ---- money -------------------------------------------------------------
test('money shows dollars with 2 decimals (R4.1, R12.4)', () => {
  assert.equal(R.money(1999), '$19.99');
  assert.equal(R.money(0), '$0.00');
  assert.equal(R.money(-50), '-$0.50');
});

test('toCents rejects zero-less junk and negatives', () => {
  assert.equal(R.toCents('12.34'), 1234);
  assert.equal(R.toCents(''), null);
  assert.equal(R.toCents('abc'), null);
  assert.equal(R.toCents('-1'), null);
});

// ---- deposit (UC-04) ---------------------------------------------------
test('valid deposit raises balance by exactly that amount (R4.3)', () => {
  const r = R.deposit(make(), 'rc', 1050);
  assert.equal(r.ok, true);
  assert.equal(u(r.state, 'rc').balance, 6050);
});

test('zero, negative or NaN deposit is rejected and balance unchanged (UC-04 alt)', () => {
  for (const bad of [0, -5, NaN, null]) {
    const s = make();
    const r = R.deposit(s, 'rc', bad);
    assert.equal(r.ok, false);
    assert.equal(u(r.state, 'rc').balance, 5000);
  }
});

test('deposit does not mutate the input state', () => {
  const s = make();
  R.deposit(s, 'rc', 100);
  assert.equal(u(s, 'rc').balance, 5000);
});

// ---- purchase (UC-05) --------------------------------------------------
test('RC pays full price, purchase is saved (R5.3, R5.8)', () => {
  const r = R.purchase(make(), 'rc', 1, '2026-11-22');
  assert.equal(r.outcome.ok, true);
  assert.equal(u(r.state, 'rc').balance, 4000);
  assert.equal(r.state.purchases.length, 1);
  assert.deepEqual(
    [r.state.purchases[0].userId, r.state.purchases[0].bookId, r.state.purchases[0].paid],
    ['rc', 1, 1000],
  );
});

test('VC gets 10% off (R5.2)', () => {
  const r = R.purchase(make(), 'vc', 2, 'd');
  assert.equal(r.outcome.paid, 1800);
  assert.equal(u(r.state, 'vc').balance, 3200);
});

test('VS and SU cannot buy (R5.1)', () => {
  assert.equal(R.purchase(make(), 'su', 1, 'd').outcome.ok, false);
  assert.equal(R.purchase(make(), null, 1, 'd').outcome.ok, false);
});

test('price above balance: refused, $1 fine, nothing saved (R5.4)', () => {
  const s = make({ users: [user('rc', 'RC', { balance: 500 })] });
  const r = R.purchase(s, 'rc', 1, 'd');
  assert.equal(r.outcome.ok, false);
  assert.equal(r.outcome.reason, 'insufficient');
  assert.equal(u(r.state, 'rc').balance, 400);
  assert.equal(r.state.purchases.length, 0);
  assert.equal(r.state.fines.length, 1);
  assert.equal(u(r.state, 'rc').status, 'active');
});

test('fine that drives balance below zero suspends at once (R5.5)', () => {
  const s = make({ users: [user('rc', 'RC', { balance: 50 })] });
  const r = R.purchase(s, 'rc', 1, 'd');
  assert.equal(u(r.state, 'rc').balance, -50);
  assert.equal(u(r.state, 'rc').status, 'suspended');
  assert.equal(r.outcome.suspended, true);
});

test('balance of exactly zero after fine is not suspended', () => {
  const s = make({ users: [user('rc', 'RC', { balance: 100 })] });
  const r = R.purchase(s, 'rc', 2, 'd');
  assert.equal(u(r.state, 'rc').balance, 0);
  assert.equal(u(r.state, 'rc').status, 'active');
});

test('suspended account cannot buy', () => {
  const s = make({ users: [user('rc', 'RC', { status: 'suspended' })] });
  assert.equal(R.purchase(s, 'rc', 1, 'd').outcome.ok, false);
});

test('RC is promoted on the 4th purchase (more than 3) (R5.7)', () => {
  let s = make();
  for (let i = 0; i < 3; i++) s = R.purchase(s, 'rc', 1, 'd').state;
  assert.equal(u(s, 'rc').type, 'RC');
  const r = R.purchase(s, 'rc', 1, 'd');
  assert.equal(r.outcome.promoted, true);
  assert.equal(u(r.state, 'rc').type, 'VC');
});

test('RC is promoted when total paid exceeds $200 (R5.7)', () => {
  let s = make({ users: [user('rc', 'RC', { balance: 99999 })], books: [book(1, { price: 20001 })] });
  const r = R.purchase(s, 'rc', 1, 'd');
  assert.equal(r.outcome.promoted, true);
});

test('exactly $200 and exactly 3 purchases does not promote', () => {
  let s = make({ users: [user('rc', 'RC', { balance: 99999 })], books: [book(1, { price: 20000 })] });
  assert.equal(R.purchase(s, 'rc', 1, 'd').outcome.promoted, false);
});

test('statsOf counts purchases and total paid (R5.6)', () => {
  let s = make();
  s = R.purchase(s, 'rc', 1, 'd').state;
  s = R.purchase(s, 'rc', 2, 'd').state;
  assert.deepEqual(R.statsOf(s, 'rc'), { count: 2, spent: 3000 });
});

// ---- taboo + reviews (UC-06/07) ---------------------------------------
test('taboo matching is whole-word and case-insensitive (R7.3)', () => {
  const r = R.tabooCheck('This SPAM is not Spammer talk', ['spam']);
  assert.equal(r.count, 1);
  assert.equal(r.masked, 'This * is not Spammer talk');
});

test('more than 3 taboo words blocks the comment (R6.4)', () => {
  assert.equal(R.tabooCheck('spam scam idiot fool', ['spam', 'scam', 'idiot', 'fool']).blocked, true);
  assert.equal(R.tabooCheck('spam scam idiot', ['spam', 'scam', 'idiot', 'fool']).blocked, false);
});

test('review with <=3 taboo words is saved with * masks (R6.3)', () => {
  const r = R.addReview(make(), { userId: 'rc', bookId: 1, stars: 4, text: 'what a scam and spam', now: 'd' });
  assert.equal(r.outcome.blocked, false);
  assert.equal(r.state.reviews[0].text, 'what a * and *');
});

test('blocked review is not saved, rating not counted, author warned (R6.4, R6.5)', () => {
  const r = R.addReview(make(), { userId: 'rc', bookId: 1, stars: 1, text: 'spam scam idiot fool', now: 'd' });
  assert.equal(r.outcome.blocked, true);
  assert.equal(r.state.reviews.length, 0);
  assert.equal(u(r.state, 'rc').warnings, 1);
});

test('RC with more than 2 warnings is suspended (R6.6)', () => {
  let s = make({ users: [user('rc', 'RC', { warnings: 2 })] });
  const r = R.addReview(s, { userId: 'rc', bookId: 1, stars: 1, text: 'spam scam idiot fool', now: 'd' });
  assert.equal(u(r.state, 'rc').status, 'suspended');
  assert.equal(r.outcome.suspended, true);
});

test('VC with more than 2 warnings is demoted to RC, warnings reset (R6.6)', () => {
  let s = make({ users: [user('vc', 'VC', { warnings: 2 })] });
  const r = R.addReview(s, { userId: 'vc', bookId: 1, stars: 1, text: 'spam scam idiot fool', now: 'd' });
  assert.equal(u(r.state, 'vc').type, 'RC');
  assert.equal(u(r.state, 'vc').warnings, 0);
  assert.equal(r.outcome.demoted, true);
});

test('visitor can review but gets no warnings (warnings apply to RC/VC only)', () => {
  const r = R.addReview(make(), { userId: null, bookId: 1, stars: 5, text: 'spam scam idiot fool', now: 'd' });
  assert.equal(r.outcome.blocked, true);
  assert.equal(r.state.users.every(x => x.warnings === 0), true);
});

test('a second review by the same author replaces the first (no rating spam)', () => {
  let s = make();
  s = R.addReview(s, { userId: 'rc', bookId: 1, stars: 5, text: 'a', now: 'd' }).state;
  s = R.addReview(s, { userId: 'rc', bookId: 1, stars: 1, text: 'b', now: 'd' }).state;
  assert.equal(s.reviews.length, 1);
  assert.equal(s.reviews[0].stars, 1);
});

test('purchaser reviews count double (R6.2)', () => {
  let s = make();
  s = R.purchase(s, 'rc', 1, 'd').state;
  s = R.addReview(s, { userId: 'rc', bookId: 1, stars: 5, text: '', now: 'd' }).state;
  s = R.addReview(s, { userId: null, bookId: 1, stars: 2, text: '', now: 'd' }).state;
  // (5*2 + 2*1) / 3 = 4
  assert.equal(R.ratingOf(s, 1).average, 4);
  assert.equal(R.ratingOf(s, 1).count, 2);
});

test('VIP ratings carry higher weight (actor definition)', () => {
  assert.ok(R.reviewWeight('VC', false) > R.reviewWeight('RC', false));
});

test('stars outside 1..5 are rejected', () => {
  const r = R.addReview(make(), { userId: 'rc', bookId: 1, stars: 6, text: '', now: 'd' });
  assert.equal(r.outcome.ok, false);
  assert.equal(r.state.reviews.length, 0);
});

// ---- order lists (R6.7-R6.9) -------------------------------------------
const rated = (stars, n) => Array.from({ length: n }, (_, i) =>
  ({ id: i + 1, bookId: 1, authorKey: `a${i}`, authorName: 'x', authorType: 'RC', stars, text: '', weight: 1, purchaser: false, date: 'd' }));

test('more than 3 ratings and avg below 2 -> no-order (R6.7)', () => {
  assert.equal(R.listStatus(make({ reviews: rated(1, 4) }), 1), 'no-order');
});
test('more than 3 ratings and avg above 4 -> to-order (R6.8)', () => {
  assert.equal(R.listStatus(make({ reviews: rated(5, 4) }), 1), 'to-order');
});
test('exactly 3 ratings never lists a book', () => {
  assert.equal(R.listStatus(make({ reviews: rated(5, 3) }), 1), '');
});
test('average of exactly 4 or 2 is not listed', () => {
  assert.equal(R.listStatus(make({ reviews: rated(4, 5) }), 1), '');
  assert.equal(R.listStatus(make({ reviews: rated(2, 5) }), 1), '');
});
test('lists recalculate: a book drops off when it no longer qualifies (R6.9)', () => {
  let s = make({ reviews: rated(5, 4) });
  assert.equal(R.listStatus(s, 1), 'to-order');
  s = R.addReview(s, { userId: 'rc', bookId: 1, stars: 1, text: '', now: 'd' }).state;
  s = R.addReview(s, { userId: 'vc', bookId: 1, stars: 1, text: '', now: 'd' }).state;
  s = R.addReview(s, { userId: null, bookId: 1, stars: 1, text: '', now: 'd' }).state;
  assert.equal(R.listStatus(s, 1), '');
});

// ---- reopen (UC-08) ----------------------------------------------------
test('reopen needs resulting balance above zero (R8.2)', () => {
  const s = make({ users: [user('rc', 'RC', { balance: -50, status: 'suspended' })] });
  const bad = R.reopen(s, 'rc', 50, 'd');
  assert.equal(bad.ok, false);
  assert.equal(bad.needed, 1);
  assert.equal(u(bad.state, 'rc').status, 'suspended');
});
test('reopen succeeds, clears warnings and records date+amount (R8.3)', () => {
  const s = make({ users: [user('rc', 'RC', { balance: -50, warnings: 3, status: 'suspended' })] });
  const r = R.reopen(s, 'rc', 1000, '2026-11-22');
  assert.equal(r.ok, true);
  assert.equal(u(r.state, 'rc').status, 'active');
  assert.equal(u(r.state, 'rc').balance, 950);
  assert.equal(u(r.state, 'rc').warnings, 0);
  assert.deepEqual(r.state.reopenings[0], { userId: 'rc', amount: 1000, date: '2026-11-22' });
});
test('warning-suspended account with positive balance reopens with a 0 deposit', () => {
  const s = make({ users: [user('rc', 'RC', { balance: 500, warnings: 3, status: 'suspended' })] });
  assert.equal(R.reopen(s, 'rc', 0, 'd').ok, true);
});

// ---- top page (UC-01) --------------------------------------------------
test('top page is exactly 3 books (R1.1)', () => {
  assert.equal(R.topBooks(make(), null).books.length, 3);
});
test('VS/SU get most purchased + viewed overall (R1.3)', () => {
  const s = make({
    books: [book(1, { baseViews: 1 }), book(2, { baseViews: 1 }), book(3, { baseViews: 1 }), book(4, { baseViews: 1 })],
    views: [{ userId: 'x', bookId: 4, date: 'd' }],
    purchases: [{ id: 1, userId: 'x', bookId: 3, paid: 1, date: 'd' }, { id: 2, userId: 'x', bookId: 3, paid: 1, date: 'd' }],
  });
  const t = R.topBooks(s, null);
  assert.equal(t.mode, 'popular');
  assert.deepEqual(t.books.map(b => b.id).slice(0, 2), [3, 4]);
});
test('RC/VC with no history get the popular list (R1.4)', () => {
  assert.equal(R.topBooks(make(), u(make(), 'rc')).mode, 'popular');
});
test('RC/VC history drives their own list, other users ignored (R1.2)', () => {
  const s = make({
    views: [{ userId: 'rc', bookId: 4, date: 'd' }, { userId: 'vc', bookId: 1, date: 'd' }],
    purchases: [{ id: 1, userId: 'rc', bookId: 2, paid: 1, date: 'd' }],
  });
  const t = R.topBooks(s, u(s, 'rc'));
  assert.equal(t.mode, 'personal');
  const ids = t.books.map(b => b.id);
  assert.ok(ids.includes(4) && ids.includes(2));
  assert.equal(t.books.length, 3);
});

// ---- search (UC-02) ----------------------------------------------------
test('keyword search looks at title, author, category, description (R2.2)', () => {
  const books = [book(1, { title: 'Moby Dick', description: 'whale hunt' }), book(2, { author: 'Jules Verne' })];
  assert.equal(R.searchBooks(books, { q: 'whale' }).length, 1);
  assert.equal(R.searchBooks(books, { q: 'jules' }).length, 1);
  assert.equal(R.searchBooks(books, { q: 'literature' }).length, 2);
});
test('multi-word keyword must match every word', () => {
  const books = [book(1, { title: 'Moby Dick', description: 'whale' }), book(2, { description: 'whale' })];
  assert.equal(R.searchBooks(books, { q: 'moby whale' }).length, 1);
});
test('category, author and year filters combine (R2.1)', () => {
  const books = [book(1), book(2, { category: 'Mystery' }), book(3, { category: 'Mystery', year: 1892 })];
  assert.equal(R.searchBooks(books, { category: 'Mystery' }).length, 2);
  assert.equal(R.searchBooks(books, { category: 'Mystery', year: '1892' }).length, 1);
});
test('keyword and picture must both match (R2.4)', () => {
  const books = [book(1, { color: '#ff0000' }), book(2, { color: '#0000ff' }), book(3, { color: '#fe0101' })];
  const ids = R.rankByColor(books, { r: 255, g: 0, b: 0 }, 2).map(b => b.id);
  assert.deepEqual(ids.sort(), [1, 3]);
  assert.equal(R.searchBooks(books, { q: 'book 2', imageIds: ids }).length, 0);
  assert.equal(R.searchBooks(books, { q: 'book 3', imageIds: ids }).length, 1);
});

// ---- add book (UC-09) --------------------------------------------------
const form = (o = {}) => ({ title: 'T', author: 'A', category: 'C', price: '5.00', year: '1900', description: '', ...o });
test('title, author, category and price are required (R9.3)', () => {
  const v = R.validateBook({ title: '', author: '', category: '', price: '' }, make().books);
  assert.equal(v.ok, false);
  assert.deepEqual(Object.keys(v.errors).sort(), ['author', 'category', 'price', 'title']);
});
test('price may be zero but not negative or text (R9.3)', () => {
  assert.equal(R.validateBook(form({ price: '0' }), []).ok, true);
  assert.equal(R.validateBook(form({ price: '-1' }), []).ok, false);
  assert.equal(R.validateBook(form({ price: 'abc' }), []).ok, false);
});
test('duplicate title+author asks for confirmation (UC-09 alt)', () => {
  const books = [book(1, { title: 'T', author: 'A' })];
  const v = R.validateBook(form(), books);
  assert.equal(v.ok, false);
  assert.equal(v.duplicate, true);
  assert.equal(R.validateBook(form(), books, { allowDuplicate: true }).ok, true);
});
test('valid book is added and visible to search immediately (R9.4)', () => {
  const s = R.addBook(make(), R.validateBook(form({ title: 'Brand New' }), make().books).book);
  assert.equal(R.searchBooks(s.books, { q: 'brand new' }).length, 1);
  assert.equal(new Set(s.books.map(b => b.id)).size, s.books.length);
});

// ---- RAG chat (UC-10) --------------------------------------------------
const docs = [
  { id: 'hours', level: 1, keywords: ['hours', 'open', 'closing'], text: 'Open 10-7.' },
  { id: 'vip', level: 3, keywords: ['vip', 'discount'], text: 'VIP gets 10% off.' },
  { id: 'fin', level: 4, keywords: ['finance', 'revenue', 'sales'], text: 'Revenue is $1.' },
];
test('levels map VS<RC<VC<SU (3.2.1)', () => {
  assert.deepEqual(['VS', 'RC', 'VC', 'SU'].map(R.levelOf), [1, 2, 3, 4]);
  assert.equal(R.levelOf(null), 1);
});
test('RAG answers from permitted docs only (R10.2, R10.7)', () => {
  assert.equal(R.retrieve(docs, 'what are your opening hours', 1).doc.id, 'hours');
  assert.equal(R.retrieve(docs, 'is there a vip discount', 1), null);
  assert.equal(R.retrieve(docs, 'is there a vip discount', 3).doc.id, 'vip');
  assert.equal(R.retrieve(docs, 'show revenue', 3), null);
  assert.equal(R.retrieve(docs, 'show revenue', 4).doc.id, 'fin');
});
test('no relevant doc returns null so the LLM path is used (R10.4)', () => {
  assert.equal(R.retrieve(docs, 'tell me a joke about whales', 4), null);
});
test('finance intent is detected', () => {
  assert.equal(R.isFinanceQuestion('Show me the finance report'), true);
  assert.equal(R.isFinanceQuestion('what are your hours'), false);
});

// ---- mood matcher (UC-11) ----------------------------------------------
test('LLM picks not in catalog are dropped (R11.2)', () => {
  const books = [book(1, { title: 'The Time Machine' }), book(2, { title: 'Dracula' })];
  const out = R.parseMood('[{"title":"The Time Machine","reason":"short"},{"title":"Made Up Book","reason":"x"}]', books);
  assert.deepEqual(out.map(x => x.book.id), [1]);
});
test('at most 3 picks, reasons trimmed to one line (R11.3)', () => {
  const books = [1, 2, 3, 4].map(i => book(i, { title: `T${i}` }));
  const txt = JSON.stringify(books.map(b => ({ title: b.title, reason: 'line one\nline two' })));
  const out = R.parseMood(txt, books);
  assert.equal(out.length, 3);
  assert.equal(out[0].reason.includes('\n'), false);
});
test('parseMood survives prose around the JSON and garbage', () => {
  const books = [book(1, { title: 'Dracula' })];
  assert.equal(R.parseMood('Sure! ```json\n[{"title":"dracula","reason":"spooky"}]\n```', books).length, 1);
  assert.deepEqual(R.parseMood('no json here', books), []);
});
test('no-order books rank lower in the matcher (R11.4)', () => {
  const books = [book(1, { tags: 'funny short' }), book(2, { tags: 'funny short' })];
  const s = make({ books, reviews: rated(1, 4).map(r => ({ ...r, bookId: 1 })) });
  const out = R.moodFallback(s, 'something funny and short');
  assert.equal(out[0].book.id, 2);
});
test('moodFallback matches whole words, not substrings', () => {
  const books = [book(1, { tags: 'reason', description: 'x', category: 'y' })];
  assert.equal(R.moodFallback(make({ books }), 'on it').length, 0);
});

// ---- finance (SU) ------------------------------------------------------
test('finance report totals sales and fines', () => {
  let s = make({ users: [user('rc', 'RC', { balance: 500 })] });
  s = R.purchase(s, 'rc', 1, 'd').state;  // buys 1000? balance 500 -> fine
  s = { ...s, users: s.users.map(x => ({ ...x, balance: 5000 })) };
  s = R.purchase(s, 'rc', 1, 'd').state;
  const f = R.financeReport(s);
  assert.equal(f.sales, 1000);
  assert.equal(f.fines, 100);
  assert.equal(f.count, 1);
});
