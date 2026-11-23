/* Chat (UC-10) and mood matcher (UC-11) flows.
   Order matters: access level -> local files (RAG) -> only then the LLM. Files above the user's level
   are never read, so they can never reach the model (R10.7). */
(function (root) {
  'use strict';
  const NS = (root.Inkwell = root.Inkwell || {});
  const R = NS.Rules;
  const { $ } = NS.UI;

  const CHAT_SYSTEM = 'You are Inkwell, the assistant of a small online bookstore that sells public-domain books. ' +
    'Answer in at most four short sentences. If you are not sure, say so. Never invent store policies, prices or account details.';
  const MOOD_SYSTEM = 'You recommend books ONLY from the catalog the user supplies. Reply with a JSON array of at most 3 objects ' +
    '[{"title": "<exact catalog title>", "reason": "<one short sentence>"}] and nothing else.';

  const OFFLINE_TEXT = {
    offline: 'The assistant is offline. Start Ollama (run "ollama serve") and try again. Questions about the store still work.',
    'no-model': 'No AI model is installed yet. Run "ollama pull llama3.2" in a terminal, then try again.',
    timeout: 'The assistant took too long to answer. Try a shorter question.',
    http: 'The assistant hit an error. Check that Ollama is running, then try again.',
  };
  const llmMessage = e => OFFLINE_TEXT[e && e.code] || OFFLINE_TEXT.offline;

  const ui = () => NS.App.app.ui;

  function paintChat() {
    const log = $('#chat-log');
    if (!log) return;
    log.innerHTML = ui().chat.map(NS.ViewsPublic.chatMessage).join('');
    log.scrollTop = log.scrollHeight;
    const btn = $('.chat__form button');
    if (btn) btn.disabled = ui().chatBusy;
  }

  const addMessage = m => { ui().chat = [...ui().chat, m]; };
  const replaceLast = patch => { const c = ui().chat; ui().chat = [...c.slice(0, -1), { ...c[c.length - 1], ...patch }]; };

  async function sendChat(raw) {
    const text = String(raw || '').trim();
    if (!text || ui().chatBusy) return;
    const { app, currentUser } = NS.App;
    const user = currentUser();
    const level = R.levelOf(user && user.type);
    addMessage({ who: 'user', text });

    if (R.isFinanceQuestion(text) && level < 4) { // R10.3: others get nothing meaningful, nothing reaches the model
      addMessage({ who: 'bot', text: 'Sorry, I have no information I can share about that.', source: 'restricted' });
      return paintChat();
    }
    const hit = R.retrieve(NS.Data.chatDocs(app.state, user), text, level);
    if (hit) {
      addMessage({ who: 'bot', text: hit.doc.text, source: 'rag' });
      return paintChat();
    }

    // Only the user's questions and earlier LLM answers are sent as context, never RAG text.
    const history = ui().chat.filter(m => m.who === 'user' || m.source === 'llm')
      .slice(-6).map(m => ({ role: m.who === 'user' ? 'user' : 'assistant', content: m.text }));
    ui().chatBusy = true;
    addMessage({ who: 'bot', text: '', pending: true });
    paintChat();
    let acc = '';
    try {
      const full = await NS.Llm.chat([{ role: 'system', content: CHAT_SYSTEM }, ...history], {
        onToken: piece => {
          acc += piece;
          const bubble = $('#chat-log .msg:last-child .msg__bubble');
          if (bubble) { bubble.textContent = acc; $('#chat-log').scrollTop = $('#chat-log').scrollHeight; }
        },
      });
      replaceLast({ text: full || 'I have no answer for that.', source: 'llm', pending: false });
    } catch (e) {
      replaceLast({ text: llmMessage(e), source: 'offline', pending: false });
    } finally {
      ui().chatBusy = false;
      paintChat();
    }
  }

  function paintMood() {
    const out = $('#mood-out');
    if (out) out.innerHTML = NS.ViewsPublic.moodResults(NS.App.ctx());
    const btn = $('.mood-form button[type=submit]');
    if (btn) btn.disabled = ui().mood.status === 'loading';
  }

  async function runMood(raw) {
    const text = String(raw || '').trim();
    if (!text || ui().mood.status === 'loading') return;
    const { app } = NS.App;
    ui().mood = { status: 'loading', text, picks: [], offline: null };
    paintMood();
    const books = app.state.books;
    try {
      const catalog = books.slice(0, 80).map(b => `${b.title} | ${b.author} | ${b.category} | ${b.description}`).join('\n');
      const out = await NS.Llm.chat([{ role: 'system', content: MOOD_SYSTEM }, { role: 'user', content: `Catalog:\n${catalog}\n\nReader wish: ${text}` }]);
      const picks = R.parseMood(out, books);
      const bad = p => R.listStatus(app.state, p.book.id) === 'no-order'; // R11.4: no-order books rank lower
      ui().mood = { status: 'done', text, picks: [...picks.filter(p => !bad(p)), ...picks.filter(bad)], offline: null };
    } catch (e) {
      ui().mood = { status: 'done', text, picks: R.moodFallback(app.state, text), offline: llmMessage(e) };
    }
    paintMood();
  }

  NS.Chat = { sendChat, runMood, paintChat, paintMood };
})(typeof self !== 'undefined' ? self : this);
