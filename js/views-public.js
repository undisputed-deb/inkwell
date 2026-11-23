/* Views anyone can see: home, browse, book detail, chat, mood matcher. Each returns an HTML string. */
(function (root) {
  'use strict';
  const NS = (root.Inkwell = root.Inkwell || {});
  const R = NS.Rules;
  const { esc, icon, cover, stars, fmtDate } = NS.UI;

  const priceHtml = (user, b) => {
    const paid = R.priceFor(user, b);
    return paid === b.price
      ? `<span class="price">${R.money(b.price)}</span>`
      : `<span class="price"><s class="price__was">${R.money(b.price)}</s> ${R.money(paid)}</span>`;
  };

  function bookCard({ state, user }, b) {
    const r = R.ratingOf(state, b.id);
    return `<a class="book-card" href="#/book/${b.id}">${cover(b)}
      <span class="book-card__body"><span class="book-card__title">${esc(b.title)}</span>
      <span class="book-card__author">${esc(b.author)}</span>
      <span class="book-card__foot">${priceHtml(user, b)}${stars(r.average, r.count)}</span></span></a>`;
  }

  const sectionHead = (id, title, sub) =>
    `<div class="section-head"><h2 id="${id}">${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>`;

  // ---- Home (UC-01) ----------------------------------------------------
  function home(ctx) {
    const { state, user } = ctx;
    const top = R.topBooks(state, user);
    const personal = top.mode === 'personal';
    const categories = [...new Set(state.books.map(b => b.category))].sort();
    const customerNoHistory = R.isCustomer(user) && !personal;
    const sub = personal
      ? 'Chosen from the books you have opened and bought.'
      : customerNoHistory ? 'You have no history yet, so these are the books readers open and buy most.'
        : 'The books readers open and buy most.';
    return `
    <section class="hero" aria-labelledby="page-title">
      <div class="hero__copy">
        <p class="eyebrow">Public-domain classics &middot; local AI assistant</p>
        <h1 id="page-title" tabindex="-1">Find your next <em>chapter.</em></h1>
        <p class="lede">Search by author, shelf, year or even a picture. Or just tell us the mood you are in.</p>
        <form class="hero-search" role="search" data-form="hero-search">
          <label class="sr-only" for="hero-q">Search the catalog</label>
          <input id="hero-q" name="q" type="search" placeholder="Title, author or topic" autocomplete="off">
          <button class="btn btn--primary" type="submit">${icon('search')}<span>Search</span></button>
        </form>
        <ul class="chips" aria-label="Browse by shelf">
          ${categories.slice(0, 6).map(c => `<li><a class="chip" href="#/browse?category=${encodeURIComponent(c)}">${esc(c)}</a></li>`).join('')}
        </ul>
      </div>
      <div class="hero__stack" aria-hidden="true">
        ${top.books.map((b, i) => `<div class="hero__book hero__book--${i + 1}">${cover(b, 'lg')}</div>`).join('')}
      </div>
    </section>

    <section class="section" aria-labelledby="top-h">
      ${sectionHead('top-h', personal ? 'Picked from your reading' : 'Most read at Inkwell', sub)}
      <ol class="top-list">
        ${top.books.map((b, i) => `
        <li class="top-item">
          <span class="top-item__num" aria-hidden="true">0${i + 1}</span>
          <a class="top-item__link" href="#/book/${b.id}">${cover(b, 'lg')}</a>
          <div class="top-item__body">
            <h3><a href="#/book/${b.id}">${esc(b.title)}</a></h3>
            <p class="muted">${esc(b.author)} &middot; ${esc(b.category)} &middot; ${b.year}</p>
            <p class="top-item__desc">${esc(b.description)}</p>
            <div class="top-item__foot">${priceHtml(user, b)}<a class="btn btn--ghost" href="#/book/${b.id}">View book ${icon('arrow')}</a></div>
          </div>
        </li>`).join('')}
      </ol>
    </section>

    <section class="section duo" aria-label="Smart features">
      <a class="feature feature--ink" href="#/mood">${icon('sparkles')}<h3>Mood matcher</h3>
        <p>Describe what you feel like reading and get three catalog picks, each with a reason.</p><span class="feature__cta">Try it ${icon('arrow')}</span></a>
      <a class="feature feature--paper" href="#/chat">${icon('message')}<h3>Ask Inkwell</h3>
        <p>Store questions are answered from our own files first, then by a free local AI model.</p><span class="feature__cta">Start chatting ${icon('arrow')}</span></a>
    </section>`;
  }

  // ---- Browse (UC-02) --------------------------------------------------
  const options = (items, current, all) =>
    `<option value="">${all}</option>` + items.map(v => `<option value="${esc(v)}"${String(v) === String(current) ? ' selected' : ''}>${esc(v)}</option>`).join('');

  function browseResults(ctx) {
    const { state, ui } = ctx;
    const found = R.searchBooks(state.books, { ...ui.query, imageIds: ui.picture ? ui.picture.ids : null });
    const html = found.length
      ? `<div class="book-grid">${found.map(b => bookCard(ctx, b)).join('')}</div>`
      : `<div class="empty"><h3>No books found</h3><p>Try fewer words, or clear a filter. Your search stays in the box so you can edit it.</p></div>`;
    return { html, count: found.length };
  }

  function browse(ctx) {
    const { state, ui } = ctx;
    const q = ui.query;
    const books = state.books;
    const res = browseResults(ctx);
    return `
    <header class="page-head"><h1 id="page-title" tabindex="-1">Browse the catalog</h1>
      <p class="lede">Combine a keyword, a shelf, an author, a year or a picture. Results update as you type.</p></header>
    <div class="browse">
      <form class="filters panel" data-form="browse" role="search" aria-label="Search filters">
        <div class="field"><label for="f-q">Keyword</label>
          <input id="f-q" name="q" type="search" value="${esc(q.q)}" placeholder="Title, author, category, description" autocomplete="off"></div>
        <div class="field"><label for="f-cat">Category</label>
          <select id="f-cat" name="category">${options([...new Set(books.map(b => b.category))].sort(), q.category, 'All categories')}</select></div>
        <div class="field"><label for="f-author">Author</label>
          <select id="f-author" name="author">${options([...new Set(books.map(b => b.author))].sort(), q.author, 'All authors')}</select></div>
        <div class="field"><label for="f-year">Publication year</label>
          <select id="f-year" name="year">${options([...new Set(books.map(b => b.year))].sort((a, b) => a - b), q.year, 'Any year')}</select></div>
        <div class="field"><span class="label">Search by picture</span>
          <input id="f-pic" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" data-change="picture">
          <label for="f-pic" class="btn btn--ghost btn--block" tabindex="0" data-key-activate="f-pic">${icon('image')}<span>Choose a cover or figure</span></label>
          <div id="picture-slot">${pictureChip(ui.picture)}</div></div>
        <button type="button" class="link" data-action="clear-search">Clear all filters</button>
      </form>
      <section aria-labelledby="results-h">
        <div class="results-head"><h2 id="results-h">Results</h2><p id="results-count" class="muted" role="status">${res.count} ${res.count === 1 ? 'book' : 'books'} found</p></div>
        <div id="results">${res.html}</div>
      </section>
    </div>`;
  }

  function pictureChip(pic) {
    return pic
      ? `<div class="picture-chip"><img src="${esc(pic.url)}" alt="Your chosen picture" width="44" height="44"><span>Showing the ${pic.ids.length} closest covers</span><button type="button" class="icon-btn" data-action="clear-picture" aria-label="Remove picture">${icon('x')}</button></div>`
      : '<p class="hint">Matches the picture to the closest cover colours. Works with a cover page or a figure.</p>';
  }

  // ---- Book detail (UC-02, UC-05, UC-06) --------------------------------
  function reviewForm(ctx, b) {
    const { user } = ctx;
    const who = user ? `as ${esc(user.name)}` : 'as a visitor';
    const radios = [5, 4, 3, 2, 1].map(n =>
      `<input type="radio" id="star-${n}" name="stars" value="${n}" required><label for="star-${n}" title="${n} star${n > 1 ? 's' : ''}"><span class="sr-only">${n} star${n > 1 ? 's' : ''}</span>${icon('star')}</label>`).join('');
    return `<form class="review-form" data-form="review" data-id="${b.id}" novalidate>
      <fieldset class="star-input"><legend>Your rating</legend><div class="star-input__row">${radios}</div></fieldset>
      <div class="field"><label for="comment">Your comment <span class="muted">(optional)</span></label>
        <textarea id="comment" name="comment" rows="3" maxlength="${R.CONFIG.COMMENT_MAX}" placeholder="What did you think?"></textarea></div>
      <div class="row"><button class="btn btn--primary" type="submit">Post review ${who}</button></div>
      <div id="review-feedback" role="alert"></div></form>`;
  }

  function buyBlock({ user }, b) {
    if (!user) return `<p class="note">${icon('lock')} <a href="#/login">Sign in</a> as a customer to buy this book.</p>`;
    if (user.type === 'SU') return `<p class="note">${icon('info')} Super-user accounts manage the store and cannot buy.</p>`;
    return `<button class="btn btn--primary btn--lg" data-action="buy" data-id="${b.id}">${icon('cart')}<span>Buy for ${R.money(R.priceFor(user, b))}</span></button>
      ${user.type === 'VC' ? '<p class="hint">VIP: 10% off applied.</p>' : ''}`;
  }

  function detail(ctx, id) {
    const { state, user } = ctx;
    const b = state.books.find(x => x.id === id);
    if (!b) return `<div class="empty"><h1 id="page-title" tabindex="-1">Book not found</h1><p><a href="#/browse">Back to the catalog</a></p></div>`;
    const r = R.ratingOf(state, b.id);
    const status = R.listStatus(state, b.id);
    const reviews = state.reviews.filter(x => x.bookId === b.id).slice().reverse();
    return `
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#/browse">Catalog</a> <span aria-hidden="true">/</span> <span>${esc(b.category)}</span></nav>
    <article class="detail">
      <div class="detail__cover">${cover(b, 'xl')}</div>
      <div class="detail__main">
        <h1 id="page-title" tabindex="-1">${esc(b.title)}</h1>
        <p class="detail__by">by ${esc(b.author)}</p>
        <p class="meta"><span>${esc(b.category)}</span><span>${b.year}</span>
          ${user && user.type === 'SU' && status ? `<span class="badge badge--${status}">${status === 'to-order' ? 'To-order list' : 'No-order list'}</span>` : ''}</p>
        <p class="detail__desc">${esc(b.description)}</p>
        <div class="detail__rating">${stars(r.average, r.count)}<span>${r.count ? `${r.average.toFixed(1)} from ${r.count} ${r.count === 1 ? 'rating' : 'ratings'}` : 'No ratings yet'}</span></div>
        <p class="hint">Ratings from people who bought the book count double.</p>
        <div class="buy">${priceHtml(user, b)}${buyBlock(ctx, b)}</div>
      </div>
    </article>
    <section class="section reviews" aria-labelledby="rev-h">
      ${sectionHead('rev-h', 'Readers say')}
      <div class="reviews__grid">
        <div>${reviewForm(ctx, b)}</div>
        <ul class="review-list">${reviews.length ? reviews.map(x => `
          <li class="review"><div class="review__top"><strong>${esc(x.authorName)}</strong>${stars(x.stars, 1)}
            ${x.purchaser ? '<span class="badge">Bought this book</span>' : ''}${x.authorType === 'VC' ? `<span class="badge badge--vip">${icon('crown')} VIP</span>` : ''}
            <time class="muted" datetime="${esc(x.date)}">${fmtDate(x.date)}</time></div>
            ${x.text ? `<p>${esc(x.text)}</p>` : ''}</li>`).join('') : '<li class="empty empty--small">No reviews yet. Be the first.</li>'}</ul>
      </div>
    </section>`;
  }

  // ---- Chat (UC-10) ----------------------------------------------------
  const SOURCE_LABEL = { rag: 'From store files (RAG)', llm: 'From the AI assistant (LLM)', restricted: 'Access restricted', offline: 'Assistant offline' };
  const SUGGEST = {
    1: ['What are your opening hours?', 'Who wrote Frankenstein?', 'How do ratings and comments work?', 'Recommend a novel about the sea'],
    2: ['What is my balance?', 'What happens if I overspend?'],
    3: ['What does VIP include?'],
    4: ['Show the finance report'],
  };

  function chatMessage(m) {
    const who = m.who === 'user' ? 'You' : 'Inkwell';
    return `<div class="msg msg--${m.who}"><span class="msg__who">${who}</span>
      <div class="msg__bubble"${m.pending ? ' aria-busy="true"' : ''}>${m.pending && !m.text ? '<span class="typing" aria-label="Thinking"><i></i><i></i><i></i></span>' : esc(m.text)}</div>
      ${m.source ? `<span class="msg__source msg__source--${m.source}">${SOURCE_LABEL[m.source]}</span>` : ''}</div>`;
  }

  function chat({ user, ui }) {
    const level = R.levelOf(user && user.type);
    const chips = [1, 2, 3, 4].filter(l => l <= level).flatMap(l => SUGGEST[l]);
    const welcome = [{ who: 'bot', text: 'Hello. Ask about the store, a book, or your account. I look in our own files first and use the AI model only when they have nothing.', source: null }];
    const msgs = ui.chat.length ? ui.chat : welcome;
    return `
    <header class="page-head"><h1 id="page-title" tabindex="-1">Ask Inkwell</h1>
      <p class="lede">Access level ${level} of 4 &middot; ${esc(NS.UI.typeLabel(user ? user.type : 'VS'))}. Answers only use files your level may read.</p></header>
    <div class="chat panel">
      <div class="chat__log" id="chat-log" role="log" aria-live="polite" aria-label="Conversation">${msgs.map(chatMessage).join('')}</div>
      <form class="chat__form" data-form="chat">
        <label class="sr-only" for="chat-input">Your question</label>
        <input id="chat-input" name="q" maxlength="500" autocomplete="off" placeholder="Type a question" required>
        <button class="btn btn--primary" type="submit"${ui.chatBusy ? ' disabled' : ''}>${icon('send')}<span>Send</span></button>
      </form>
    </div>
    <ul class="chips chips--wrap" aria-label="Suggested questions">${chips.map(c => `<li><button type="button" class="chip" data-action="ask" data-text="${esc(c)}">${esc(c)}</button></li>`).join('')}
      <li><button type="button" class="link" data-action="clear-chat">Clear chat</button></li></ul>
    <p class="hint">${icon('info')} The AI model runs on your own computer through Ollama. If it is not running, store answers still work.</p>`;
  }

  // ---- Mood matcher (UC-11) --------------------------------------------
  function moodResults(ctx) {
    const m = ctx.ui.mood;
    if (m.status === 'loading') return `<div class="skeleton-list" aria-busy="true" aria-label="Finding books">${'<div class="skeleton"></div>'.repeat(3)}</div>`;
    if (m.status !== 'done') return '';
    const note = m.offline
      ? `<p class="notice notice--warn" role="status">${icon('alert')}<span>${esc(m.offline)} Showing keyword matches instead.</span></p>` : '';
    const body = m.picks.length
      ? `<ol class="mood-list">${m.picks.map(p => `<li class="mood-item">${cover(p.book)}<div><h3><a href="#/book/${p.book.id}">${esc(p.book.title)}</a></h3>
          <p class="muted">${esc(p.book.author)} &middot; ${esc(p.book.category)}</p><p class="mood-item__why">${esc(p.reason || 'A good fit for what you described.')}</p></div>
          <a class="btn btn--ghost" href="#/book/${p.book.id}">Open</a></li>`).join('')}</ol>`
      : `<div class="empty"><h3>Nothing came close</h3><p>Try other words, or <a href="#/browse">browse by category</a>.</p></div>`;
    return `${note}<h2 class="results-title">Matches for &ldquo;${esc(m.text)}&rdquo;</h2>${body}`;
  }

  function mood(ctx) {
    const chips = ['Something short and funny for the train', 'A comforting, hopeful story', 'A dark mystery for a rainy night', 'An epic sea adventure'];
    return `
    <header class="page-head"><h1 id="page-title" tabindex="-1">Find a book for your mood</h1>
      <p class="lede">Say what you feel like reading. We suggest up to three books from our catalog and say why.</p></header>
    <form class="panel mood-form" data-form="mood">
      <div class="field"><label for="mood-q">Your reading wish</label>
        <input id="mood-q" name="q" maxlength="300" required value="${esc(ctx.ui.mood.text)}" placeholder="e.g. something short and funny for the train"></div>
      <ul class="chips chips--wrap" aria-label="Examples">${chips.map(c => `<li><button type="button" class="chip" data-action="mood-chip" data-text="${esc(c)}">${esc(c)}</button></li>`).join('')}</ul>
      <button class="btn btn--primary" type="submit"${ctx.ui.mood.status === 'loading' ? ' disabled' : ''}>${icon('sparkles')}<span>Find books</span></button>
    </form>
    <div id="mood-out" class="mood-out" aria-live="polite">${moodResults(ctx)}</div>`;
  }

  NS.ViewsPublic = { home, browse, browseResults, pictureChip, detail, chat, chatMessage, mood, moodResults, priceHtml };
})(typeof self !== 'undefined' ? self : this);
