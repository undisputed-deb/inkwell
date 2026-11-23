/* Super-user workspace (UC-07, UC-08, UC-09 and the finance report). Only rendered for SU. */
(function (root) {
  'use strict';
  const NS = (root.Inkwell = root.Inkwell || {});
  const R = NS.Rules;
  const { esc, icon, typeLabel, fmtDate } = NS.UI;

  const TABS = [['overview', 'Finance'], ['books', 'Books'], ['accounts', 'Accounts'], ['taboo', 'Taboo words'], ['lists', 'Order lists']];

  const stat = (label, value) => `<div class="stat"><dt>${label}</dt><dd>${value}</dd></div>`;

  function overview({ state }) {
    const f = R.financeReport(state);
    const rows = state.purchases.slice().reverse().slice(0, 8);
    return `<section class="panel"><div class="panel__head"><h2>Finance report</h2>
      <button class="btn btn--ghost" data-action="download-report">${icon('download')}<span>Download CSV</span></button></div>
      <dl class="stat-grid">${stat('Book sales', R.money(f.sales))}${stat('Fines collected', R.money(f.fines))}${stat('Total revenue', R.money(f.revenue))}
        ${stat('Purchases', f.count)}${stat('Customer balances held', R.money(f.balances))}${stat('Best seller', f.top ? `${esc(f.top.title)} (${f.top.count})` : 'None yet')}</dl>
      <h3>Latest purchases</h3>
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th scope="col">Customer</th><th scope="col">Book</th><th scope="col">Paid</th><th scope="col">Date</th></tr></thead><tbody>
        ${rows.map(p => { const u = R.findUser(state, p.userId), b = state.books.find(x => x.id === p.bookId);
          return `<tr><td>${esc(u ? u.name : 'Unknown')}</td><td>${esc(b ? b.title : 'Removed')}</td><td>${R.money(p.paid)}</td><td>${fmtDate(p.date)}</td></tr>`; }).join('')}</tbody></table></div>`
        : '<div class="empty empty--small"><p>No purchases yet.</p></div>'}</section>`;
  }

  function bookForm({ state, ui }) {
    const b = ui.editBookId ? state.books.find(x => x.id === ui.editBookId) : null;
    const field = (name, label, attrs = '', value = '') => `<div class="field"><label for="bk-${name}">${label}</label>
      <input id="bk-${name}" name="${name}" ${attrs} value="${esc(value)}"></div>`;
    return `<form data-form="book" data-id="${b ? b.id : ''}" novalidate>
      <h2>${b ? 'Edit book' : 'Add a book'}</h2>
      <div class="form-grid">
        ${field('title', 'Title *', 'required maxlength="120"', b ? b.title : '')}
        ${field('author', 'Author *', 'required maxlength="80"', b ? b.author : '')}
        ${field('category', 'Category *', 'required maxlength="40" list="category-list"', b ? b.category : '')}
        ${field('year', 'Publication year', 'type="number" min="1" max="2100"', b ? b.year : '')}
        ${field('price', 'Price (USD) *', 'type="number" min="0" step="0.01" inputmode="decimal"', b ? (b.price / 100).toFixed(2) : '')}
        <div class="field"><label for="bk-color">Cover colour</label><input id="bk-color" name="color" type="color" value="${esc(NS.UI.safeColor(b && b.color))}"></div>
        <div class="field field--wide"><label for="bk-description">Description</label><textarea id="bk-description" name="description" rows="3" maxlength="600">${esc(b ? b.description : '')}</textarea></div>
        <div class="field field--wide"><label for="bk-cover">Cover image <span class="muted">(optional, PNG/JPEG/WebP)</span></label>
          <input id="bk-cover" name="cover" type="file" accept="image/png,image/jpeg,image/webp"></div>
      </div>
      <datalist id="category-list">${[...new Set(state.books.map(x => x.category))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="row"><button class="btn btn--primary" type="submit">${b ? 'Save changes' : 'Add to catalog'}</button>
        ${b ? '<button type="button" class="btn btn--ghost" data-action="cancel-edit">Cancel</button>' : ''}</div></form>`;
  }

  function books(ctx) {
    return `<div class="two-col"><section class="panel">${bookForm(ctx)}</section>
      <section class="panel"><h2>Catalog <span class="muted">(${ctx.state.books.length})</span></h2><div class="table-wrap table-wrap--tall"><table>
        <thead><tr><th scope="col">Book</th><th scope="col">Price</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>
        ${ctx.state.books.map(b => `<tr><td>${esc(b.title)}<br><span class="muted">${esc(b.author)}</span></td><td>${R.money(b.price)}</td>
          <td><button class="link" data-action="edit-book" data-id="${b.id}">Edit<span class="sr-only"> ${esc(b.title)}</span></button></td></tr>`).join('')}</tbody></table></div></section></div>`;
  }

  function accounts({ state }) {
    const customers = state.users.filter(u => R.isCustomer(u) || u.status === 'suspended');
    return `<section class="panel"><h2>Customer accounts</h2><div class="table-wrap"><table>
      <thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Balance</th><th scope="col">Warnings</th><th scope="col">Reopen</th></tr></thead><tbody>
      ${customers.map(u => `<tr><td>${esc(u.name)}</td><td>${typeLabel(u.type)}</td>
        <td><span class="badge badge--${u.status}">${u.status}</span></td><td>${R.money(u.balance)}</td><td>${u.warnings}</td>
        <td>${u.status === 'suspended' ? `<form class="inline-form" data-form="reopen" data-id="${esc(u.id)}"><label class="sr-only" for="ro-${esc(u.id)}">Deposit for ${esc(u.name)}</label>
          <input id="ro-${esc(u.id)}" name="amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Deposit $" required><button class="btn btn--primary btn--sm">Reopen</button></form>` : '<span class="muted">Active</span>'}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">A suspended account reopens only when its balance ends above $0.00. Reopening clears its warnings.</p></section>
      <section class="panel"><h2>Reopening log</h2>${state.reopenings.length ? `<div class="table-wrap"><table><thead><tr><th scope="col">Account</th><th scope="col">Deposit</th><th scope="col">Date</th></tr></thead><tbody>
        ${state.reopenings.slice().reverse().map(r => { const u = R.findUser(state, r.userId); return `<tr><td>${esc(u ? u.name : r.userId)}</td><td>${R.money(r.amount)}</td><td>${fmtDate(r.date)}</td></tr>`; }).join('')}</tbody></table></div>`
        : '<div class="empty empty--small"><p>No accounts reopened yet.</p></div>'}</section>`;
  }

  const taboo = ({ state }) => `<section class="panel"><h2>Taboo words</h2>
    <form class="row row--end" data-form="taboo" novalidate><div class="field field--grow"><label for="tw">Add a word</label><input id="tw" name="word" maxlength="30" required autocomplete="off"></div>
    <button class="btn btn--primary" type="submit">${icon('plus')}<span>Add</span></button></form>
    <ul class="chips chips--wrap tag-list" aria-label="Current taboo words">${state.taboo.map(w => `<li class="tag">${esc(w)}<button type="button" data-action="remove-taboo" data-word="${esc(w)}" aria-label="Remove ${esc(w)}">${icon('x')}</button></li>`).join('')}</ul>
    <p class="hint">Whole words only, any capitalisation. Up to ${R.CONFIG.TABOO_MASK_MAX} per comment are replaced with *. More than that blocks the comment, drops its rating and warns the author.</p></section>`;

  function lists({ state }) {
    const col = (type, title, rule) => {
      const items = state.books.filter(b => R.listStatus(state, b.id) === type);
      return `<section class="panel"><h2>${title}</h2><p class="hint">${rule}</p>${items.length ? `<ul class="list-plain">${items.map(b => { const r = R.ratingOf(state, b.id);
        return `<li><a href="#/book/${b.id}">${esc(b.title)}</a><span class="muted">${r.average.toFixed(2)} from ${r.count} ratings</span></li>`; }).join('')}</ul>`
        : '<div class="empty empty--small"><p>No books qualify right now.</p></div>'}</section>`;
    };
    return `<div class="two-col">${col('to-order', 'To-order list', `More than ${R.CONFIG.LIST_MIN_RATINGS} ratings and an average above ${R.CONFIG.TO_ORDER_ABOVE}.`)}
      ${col('no-order', 'No-order list', `More than ${R.CONFIG.LIST_MIN_RATINGS} ratings and an average below ${R.CONFIG.NO_ORDER_BELOW}.`)}</div>`;
  }

  function admin(ctx) {
    const tab = ctx.ui.adminTab;
    const body = { overview, books, accounts, taboo, lists }[tab](ctx);
    return `<header class="page-head"><h1 id="page-title" tabindex="-1">Super-user workspace</h1><p class="lede">Moderation, accounts, catalog and finance.</p></header>
      <nav class="tabs" aria-label="Admin sections">${TABS.map(([id, label]) => `<button class="tab" data-action="admin-tab" data-tab="${id}"${tab === id ? ' aria-current="page"' : ''}>${label}</button>`).join('')}</nav>
      <div class="admin-body">${body}</div>`;
  }

  NS.ViewsAdmin = { admin };
})(typeof self !== 'undefined' ? self : this);
