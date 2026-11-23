/* Small UI helpers shared by every view: escaping, icons, covers, stars, toast, dialog. */
(function (root) {
  'use strict';
  const NS = (root.Inkwell = root.Inkwell || {});
  const $ = (s, el = document) => el.querySelector(s);

  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 24x24 stroke icons (Lucide style). Decorative unless a label is passed.
  const PATHS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h14v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2"/><circle cx="16.5" cy="14.5" r="1"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="m19 15 .7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>',
    shield: '<path d="m12 3 8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    camera: '<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.01"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/>',
    download: '<path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 20h16"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 11.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 7H6"/>',
    crown: '<path d="m3 8 4 4 5-7 5 7 4-4-2 11H5z"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
  };
  const icon = (name, label) =>
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true" focusable="false"'}>${PATHS[name] || ''}</svg>`;

  const TYPE_LABEL = { VS: 'Visitor', RC: 'Registered customer', VC: 'VIP customer', SU: 'Super-user' };
  const typeLabel = t => TYPE_LABEL[t] || 'Visitor';

  const safeColor = c => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#3b4f45');
  function readableOn(hex) {
    const { r, g, b } = NS.Rules.hexToRgb(safeColor(hex));
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1e1a16' : '#fffdf8';
  }

  /** Generated cover: a typographic jacket, or the admin's uploaded image. */
  function cover(book, size = 'md') {
    if (book.image) {
      return `<div class="cover cover--${size}"><img src="${esc(book.image)}" alt="Cover of ${esc(book.title)}" loading="lazy" width="200" height="300"></div>`;
    }
    const c = safeColor(book.color);
    return `<div class="cover cover--${size}" role="img" aria-label="Cover of ${esc(book.title)} by ${esc(book.author)}" style="--cover:${c};--cover-ink:${readableOn(c)}">` +
      `<span class="cover__band" aria-hidden="true"></span><span class="cover__title" aria-hidden="true">${esc(book.title)}</span>` +
      `<span class="cover__rule" aria-hidden="true"></span><span class="cover__author" aria-hidden="true">${esc(book.author)}</span></div>`;
  }

  function stars(average, count) {
    const filled = Math.round(average);
    const label = count ? `Rated ${average.toFixed(1)} out of 5 from ${count} ${count === 1 ? 'rating' : 'ratings'}` : 'Not rated yet';
    const icons = [1, 2, 3, 4, 5].map(i => `<span class="${i <= filled && count ? 'is-on' : ''}">${icon('star')}</span>`).join('');
    return `<span class="stars" role="img" aria-label="${label}">${icons}</span>`;
  }

  const fmtDate = iso => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  let toastTimer = 0;
  function toast(message, kind = 'info') {
    const el = $('#toast');
    el.textContent = message;
    el.dataset.kind = kind;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 5000);
  }

  let returnFocus = null;
  function openDialog(title, html) {
    const d = $('#dialog');
    returnFocus = document.activeElement;
    $('#dialog-title').textContent = title;
    $('#dialog-body').innerHTML = html;
    if (!d.open) d.showModal();
  }
  function closeDialog() {
    const d = $('#dialog');
    if (d.open) d.close();
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  }

  /** Average colour of an image file, used by picture search. Resolves { r, g, b, url }. */
  function imageInfo(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 16;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 16, 16);
        const d = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0;
        const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        resolve({ r: r / n, g: g / n, b: b / n, url });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      img.src = url;
    });
  }

  /** Read an uploaded cover, shrink it to keep storage small, return a JPEG data URL. */
  function coverDataUrl(file, maxWidth = 360) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      img.src = url;
    });
  }

  NS.UI = { $, esc, icon, cover, stars, typeLabel, safeColor, readableOn, fmtDate, toast, openDialog, closeDialog, imageInfo, coverDataUrl };
})(typeof self !== 'undefined' ? self : this);
