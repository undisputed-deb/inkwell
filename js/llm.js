/* Free local LLM through Ollama (R10.6). Nothing leaves the machine, no paid service.
   Needs: `ollama serve` running, a pulled model, and a page served over http://localhost
   (a file:// page is blocked by Ollama's CORS unless OLLAMA_ORIGINS=*). */
(function (root) {
  'use strict';
  const NS = (root.Inkwell = root.Inkwell || {});

  const BASE = 'http://localhost:11434';
  const PREFERRED = 'llama3.2';
  const FIRST_TOKEN_MS = 30000; // R14.3

  class LlmError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }

  let model = null;

  async function pickModel(signal) {
    if (model) return model;
    let res;
    try { res = await fetch(`${BASE}/api/tags`, { signal }); }
    catch (e) { throw e.name === 'AbortError' ? e : new LlmError('offline', 'The assistant is offline.'); }
    if (!res.ok) throw new LlmError('offline', 'The assistant is offline.');
    const { models = [] } = await res.json();
    const names = models.map(m => m.name);
    model = names.find(n => n.startsWith(PREFERRED)) || names[0] || null;
    if (!model) throw new LlmError('no-model', `No model is installed. Run: ollama pull ${PREFERRED}`);
    return model;
  }

  /** Streams a reply. onToken(text) is called with each piece. Resolves with the full text. */
  async function chat(messages, { onToken = () => {}, signal } = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(new LlmError('timeout', 'The assistant took too long to answer.')), FIRST_TOKEN_MS);
    const abort = () => ctl.abort();
    if (signal) signal.addEventListener('abort', abort, { once: true });
    try {
      const name = await pickModel(ctl.signal);
      const res = await fetch(`${BASE}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ model: name, messages, stream: true }),
      });
      if (!res.ok) throw new LlmError('http', `The assistant returned an error (${res.status}).`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', full = '', first = true;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (first) { clearTimeout(timer); first = false; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          const piece = (JSON.parse(line).message || {}).content || '';
          if (piece) { full += piece; onToken(piece); }
        }
      }
      return full.trim();
    } catch (e) {
      if (e instanceof LlmError) throw e;
      if (ctl.signal.reason instanceof LlmError) throw ctl.signal.reason;
      if (e.name === 'AbortError') throw e;
      throw new LlmError('offline', 'The assistant is offline.');
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', abort);
    }
  }

  NS.Llm = { chat, LlmError };
})(typeof self !== 'undefined' ? self : this);
