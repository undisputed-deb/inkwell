/* Sign in, registration and the customer account page (UC-03, UC-04). */
(function (root) {
  'use strict';
  const NS = (root.Inkwell = root.Inkwell || {});
  const R = NS.Rules;
  const { esc, icon, typeLabel, fmtDate } = NS.UI;

  const cameraPanel = (primary) => `
    <div class="camera" id="cam-box">
      <video id="cam-video" autoplay playsinline muted aria-label="Camera preview"></video>
      <div class="camera__off" id="cam-off">${icon('camera')}<p>Camera is off</p></div>
    </div>
    <div class="row">
      <button type="button" class="btn btn--ghost" data-action="cam-start">${icon('camera')}<span>Turn on camera</span></button>
      ${primary}
    </div>
    <p id="cam-status" class="hint" role="status">Face data stays on this computer.</p>`;

  function login({ state }) {
    return `
    <header class="page-head"><h1 id="page-title" tabindex="-1">Sign in</h1>
      <p class="lede">There are no passwords. Look at the camera and we match your face to an account.</p></header>
    <div class="auth">
      <section class="panel" aria-labelledby="face-h"><h2 id="face-h">Sign in with your face</h2>
        ${cameraPanel(`<button type="button" class="btn btn--primary" data-action="face-login" id="scan-btn" disabled>${icon('user')}<span>Scan my face</span></button>`)}
        <p class="auth__alt">New here? <a href="#/register">Register an account</a></p></section>
      <section class="panel" aria-labelledby="demo-h"><h2 id="demo-h">Demo accounts</h2>
        <p class="hint">The sample accounts below have no face on file, so use a shortcut. Accounts you register yourself sign in by face.</p>
        <ul class="demo-list">${state.users.map(u => `
          <li><button type="button" class="demo-user" data-action="demo-login" data-id="${esc(u.id)}">
            <span class="avatar" aria-hidden="true">${esc(u.name[0])}</span>
            <span class="demo-user__text"><strong>${esc(u.name)}</strong><span class="muted">${typeLabel(u.type)}${u.status === 'suspended' ? ' &middot; suspended' : ''}</span></span>
            ${icon('arrow')}</button></li>`).join('')}</ul></section>
    </div>`;
  }

  function register(ctx) {
    const sampled = !!ctx.ui.pendingSample;
    return `
    <header class="page-head"><h1 id="page-title" tabindex="-1">Create an account</h1>
      <p class="lede">Enter your name, record a face sample, and make a first deposit. You start as a registered customer.</p></header>
    <form class="auth" data-form="register" novalidate>
      <section class="panel" aria-labelledby="who-h"><h2 id="who-h">1. About you</h2>
        <div class="field"><label for="reg-name">Name</label><input id="reg-name" name="name" required maxlength="40" autocomplete="name"></div>
        <div class="field"><label for="reg-deposit">First deposit (USD)</label>
          <input id="reg-deposit" name="deposit" type="number" inputmode="decimal" min="0.01" step="0.01" required placeholder="25.00"></div>
        <ul class="chips" aria-label="Quick amounts">${[10, 25, 50].map(n => `<li><button type="button" class="chip" data-action="fill-deposit" data-amount="${n}">$${n}</button></li>`).join('')}</ul>
        <p class="hint">Demo funds only. No card details are asked for.</p></section>
      <section class="panel" aria-labelledby="face2-h"><h2 id="face2-h">2. Face sample</h2>
        ${cameraPanel(`<button type="button" class="btn btn--primary" data-action="face-capture" id="scan-btn" disabled>${icon('check')}<span>Capture sample</span></button>`)}
        <p id="sample-state" class="${sampled ? 'ok' : 'hint'}">${sampled ? 'Sample captured.' : 'No sample yet.'}</p></section>
      <div class="auth__submit"><button class="btn btn--primary btn--lg" type="submit">Create account</button><div id="register-feedback" role="alert"></div></div>
    </form>`;
  }

  // ---- account (UC-04, R5.6) ------------------------------------------
  function account({ state, user }) {
    const st = R.statsOf(state, user.id);
    const history = state.purchases.filter(p => p.userId === user.id).slice().reverse();
    const isVip = user.type === 'VC';
    const needBuys = Math.max(0, R.CONFIG.PROMOTE_AFTER_PURCHASES + 1 - st.count);
    const needSpend = Math.max(0, R.CONFIG.PROMOTE_AFTER_SPENT + 1 - st.spent);
    return `
    <header class="page-head"><h1 id="page-title" tabindex="-1">Your account</h1>
      <p class="lede">${esc(user.name)} &middot; ${typeLabel(user.type)}</p></header>
    <div class="account">
      <section class="balance panel" aria-labelledby="bal-h">
        <h2 id="bal-h">Balance</h2><p class="balance__amount" aria-live="polite">${R.money(user.balance)}</p>
        <form data-form="deposit" class="deposit" novalidate>
          <div class="field"><label for="dep">Add funds (USD)</label>
            <input id="dep" name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required placeholder="20.00"></div>
          <ul class="chips" aria-label="Quick amounts">${[10, 25, 50].map(n => `<li><button type="button" class="chip" data-action="fill-amount" data-amount="${n}">$${n}</button></li>`).join('')}</ul>
          <button class="btn btn--primary btn--block" type="submit">${icon('plus')}<span>Deposit</span></button>
          <div id="deposit-feedback" role="alert"></div></form>
        <p class="hint">Demo funds only.</p>
      </section>
      <div class="account__side">
        <section class="panel" aria-labelledby="prog-h"><h2 id="prog-h">${isVip ? 'VIP status' : 'Progress to VIP'}</h2>
          <dl class="stats"><div><dt>Purchases</dt><dd>${st.count}</dd></div><div><dt>Total paid</dt><dd>${R.money(st.spent)}</dd></div><div><dt>Warnings</dt><dd>${user.warnings}</dd></div></dl>
          ${isVip ? `<p class="badge badge--vip">${icon('crown')} VIP &middot; 10% off every purchase</p>`
            : `<label class="meter-label" for="vip-meter">${needBuys ? `${needBuys} more ${needBuys === 1 ? 'purchase' : 'purchases'}` : 'Purchase target met'}, or ${R.money(needSpend)} more spent, makes you VIP.</label>
               <progress id="vip-meter" max="${R.CONFIG.PROMOTE_AFTER_PURCHASES + 1}" value="${Math.min(st.count, R.CONFIG.PROMOTE_AFTER_PURCHASES + 1)}"></progress>`}
        </section>
        <section class="panel" aria-labelledby="hist-h"><h2 id="hist-h">Purchase history</h2>
          ${history.length ? `<div class="table-wrap"><table><thead><tr><th scope="col">Book</th><th scope="col">Paid</th><th scope="col">Date</th></tr></thead><tbody>
            ${history.map(p => { const b = state.books.find(x => x.id === p.bookId); return `<tr><td><a href="#/book/${p.bookId}">${esc(b ? b.title : 'Removed book')}</a></td><td>${R.money(p.paid)}</td><td>${fmtDate(p.date)}</td></tr>`; }).join('')}</tbody></table></div>`
            : `<div class="empty empty--small"><p>No purchases yet.</p><a class="btn btn--ghost" href="#/browse">Browse books</a></div>`}
        </section>
      </div>
    </div>`;
  }

  NS.ViewsAccount = { login, register, account };
})(typeof self !== 'undefined' ? self : this);
