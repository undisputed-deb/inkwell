/* Persistence: localStorage stands in for the SRS text files (R13.1: written on every change).
   A missing or damaged save never crashes the app (R13.2). */
(function (root) {
  'use strict';
  const NS = (root.Inkwell = root.Inkwell || {});
  const KEY = 'inkwell-v2';
  const VERSION = 2;
  const VIEW_LOG_MAX = 2000;
  const LISTS = ['users', 'books', 'purchases', 'views', 'reviews', 'fines', 'reopenings', 'taboo'];

  const isValid = s => s && s.version === VERSION && LISTS.every(k => Array.isArray(s[k]));

  /** Returns { state, notice }. notice is a plain sentence to show the user, or null. */
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); }
    catch { return { state: NS.Data.seed(), notice: 'Browser storage is blocked, so changes last only until you close this page.' }; }
    if (raw == null) return { state: NS.Data.seed(), notice: null };
    try {
      const parsed = JSON.parse(raw);
      if (!isValid(parsed)) throw new Error('shape');
      return { state: parsed, notice: null };
    } catch {
      return { state: NS.Data.seed(), notice: 'The saved data was damaged, so the sample data was restored.' };
    }
  }

  /** Returns true when the write succeeded. */
  function save(state) {
    const trimmed = state.views.length > VIEW_LOG_MAX ? { ...state, views: state.views.slice(-VIEW_LOG_MAX) } : state;
    try { localStorage.setItem(KEY, JSON.stringify(trimmed)); return true; }
    catch { return false; }
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch { /* storage blocked: nothing to clear */ }
    return NS.Data.seed();
  }

  NS.Store = { load, save, reset };
})(typeof self !== 'undefined' ? self : this);
