/* APK용 연결부: Claude 앱 기능(window.claude)을 폰 안에서 대신해요.
   - db: 폰 저장소(localStorage). 객관식 해설은 미리 만든 mc_exp.json에서 찾아요.
   - sample(AI 글): Gemini (앱 설정에 넣은 키)
   - tts(읽어주기): 구글 클라우드 Achernar (앱 설정에 넣은 키), 같은 글은 폰에 저장해 다시 쓰기
   - OX 듣기 화면은 앱의 전용 듣기 화면으로 열어요. */
(function () {
  const N = window.NativeBridge;
  let seq = 0; const waits = {};
  window.__nb = (id, ok, text) => { const w = waits[id]; if (!w) return; delete waits[id]; ok ? w.res(text) : w.rej(Object.assign(new Error(text || 'error'), { code: 'error' })); };
  const call = (fn, ...a) => new Promise((res, rej) => { const id = 'r' + (++seq); waits[id] = { res, rej }; N[fn](id, ...a); });

  /* ---- db: 폰 저장소 ---- */
  let MC = null;
  const mc = () => { if (MC === null) { try { MC = JSON.parse(N.asset('mc_exp.json') || '{}'); } catch (e) { MC = {}; } } return MC; };
  window.__mcx = id => mc()[id] || null;
  // AI가 기출 보기를 뒤집어 만든 OX 문장(맞는 말↔틀린 말) — 매일 조금씩 늘어나요
  window.oxVarAdd = () => {
    try {
      const V = JSON.parse(N.asset('ox_var.json') || '{}');
      Object.entries(V).forEach(([k, v]) => {
        const m = /^(.+)_(\d)$/.exec(k); if (!m || !v || !v.s) return;
        const q = (typeof BYID !== 'undefined') && BYID[m[1]]; if (!q || q.ocr) return;
        const stem = q.x.split('①')[0].replace(/\s+/g, ' ').replace(/\(다툼이 있으면[^)]*\)/, '').trim().slice(0, 70);
        OXQ.push({ q, i: +m[2] - 1, s: v.s, o: !!v.o, ctx: stem, v: 1, w: v.w || '', bad: v.bad || '', fix: v.fix || '' });
      });
    } catch (e) {}
  };      // 앱에 미리 넣어 둔 객관식 해설 바로 꺼내기(인터넷·한도 필요 없음)
  const key = (c, d) => 'db:' + c + '/' + d;
  const db = {
    collection: (c) => ({
      doc: (d) => ({
        async get() {
          let v = null; try { v = JSON.parse(localStorage.getItem(key(c, d))); } catch (e) {}
          if (v == null && d[0] === 'x' && mc()[d.slice(1)]) v = { e: mc()[d.slice(1)] };
          return { exists: v != null, data: () => v, id: d };
        },
        async set(o) { localStorage.setItem(key(c, d), JSON.stringify(o)); },
        async update(o) { let v = {}; try { v = JSON.parse(localStorage.getItem(key(c, d))) || {}; } catch (e) {} localStorage.setItem(key(c, d), JSON.stringify(Object.assign(v, o))); },
        async delete() { localStorage.removeItem(key(c, d)); }
      })
    })
  };

  /* ---- sample: Gemini ----
     무료 등급은 모델마다 하루 한도가 따로 있어요. 앞 모델이 한도 초과(429)·없음(404)·과부하(503)면 다음 모델로.
     한도 초과한 모델은 그날 하루 건너뛰어요. */
  const CHAIN = {
    quick: ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'],
    default: ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash-lite']
  };
  const today = () => new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });   // 무료 한도는 미국 서부 자정(한국 오후 5시)에 다시 채워짐
  const skipKey = m => 'gem_skip_' + m;
  window.__gem = (p, o, j) => gemini(p, o, j);
  async function gemini(prompt, opts, asJson) {
    if (!N.key('gemini')) throw Object.assign(new Error('Gemini 키가 없어요 — 귀로 듣기 화면의 🔑 키 설정에서 넣어 주세요'), { code: 'no_key' });
    const body = { contents: [{ parts: [{ text: String(prompt) }] }], generationConfig: { temperature: 0.4 } };
    if (asJson) body.generationConfig.responseMimeType = 'application/json';
    const tier = (opts && opts.modelTier) === 'quick' ? 'quick' : 'default';
    let last = null; const t0 = Date.now();
    for (const m of CHAIN[tier]) {
      if (localStorage.getItem(skipKey(m)) === today()) continue;
      if (Date.now() - t0 > 100000) break;             // 전체로 너무 오래 걸리면 그만(무한 대기 방지)
      try {
        // 한 모델이 45초 넘게 답이 없으면 다음 모델로
        const raw = await Promise.race([call('gemini', m, JSON.stringify(body)), new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 45000))]);
        const r = JSON.parse(raw);
        return (((r.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || '').join('');
      } catch (e) {
        last = e; const msg = String(e.message || '');
        if (/HTTP 429/.test(msg)) { localStorage.setItem(skipKey(m), today()); continue; }
        if (/HTTP (404|500|503)|TIMEOUT/.test(msg)) continue;
        if (/resolve host|UnknownHost|Failed to connect|Network|ENOTFOUND|timeout|No address|connection/i.test(msg))
          throw Object.assign(new Error('📶 인터넷에 연결되어 있지 않아요. 와이파이나 데이터를 켜고 다시 눌러 주세요. (저장된 해설은 인터넷 없이도 보여요)'), { code: 'offline' });
        throw e;   // 키 오류 등은 바로 알려 주기
      }
    }
    if (last && /TIMEOUT/.test(String(last.message)) || Date.now() - t0 > 100000)
      throw Object.assign(new Error('지금 AI가 붐벼서 답이 늦어요. 조금 뒤 다시 눌러 주세요. (해설이 없는 문제는 매일 저녁 자동으로 채워져요)'), { code: 'quota', cause: last });
    throw Object.assign(new Error('오늘 무료 AI 사용량을 다 썼어요. 오후 5시 이후에 다시 쓸 수 있어요. (해설이 없는 문제는 매일 저녁 자동으로 채워져요)'), { code: 'quota', cause: last });
  }
  const sample = async (prompt, opts) => ({ text: await gemini(prompt, opts, false) });
  sample.json = async (prompt, opts) => { const t = await gemini(prompt, opts, true); const m = t.match(/[\[{][\s\S]*[\]}]/); return JSON.parse(m ? m[0] : t); };

  const toast = (m) => { const d = document.createElement('div'); d.textContent = m;
    d.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#111c;color:#fff;padding:10px 16px;border-radius:12px;z-index:200;font-size:14px;max-width:86%';
    document.body.appendChild(d); setTimeout(() => d.remove(), 3500); };
  window.__toast = toast;
  /* ---- tts: Achernar ---- */
  const lineCbs = [], stateCbs = [];
  let cur = null;
  window.__nbt = (id, ev) => { if (cur && cur.wait && cur.wait.id === id) { const w = cur.wait; cur.wait = null; w.res(ev); } };
  const tts = {
    onLine(f) { lineCbs.push(f); }, onState(f) { stateCbs.push(f); }, setRate(r) { if (cur) cur.rate = r; },
    async speak(lines, o) {
      if (!N.key('tts')) throw Object.assign(new Error('구글 클라우드 음성 키가 없어요'), { code: 'no_key' });
      if (cur) tts.stop();
      const me = cur = { rate: (o && o.rate) || 1, stopped: false, wait: null };
      stateCbs.forEach(f => { try { f('speaking'); } catch (e) {} });
      if (N.speakAll) {   // 앱이 끝까지 이어 읽기 (화면 꺼져도 안 멈춤)
        const id = 'a' + (++seq);
        const L = lines.map((l, i) => ({ i, t: String(l.text || '').trim() })).filter(x => x.t && !/^[.\s]*$/.test(x.t));
        window.__nbl = (sid, i) => { if (sid === id && cur === me) lineCbs.forEach(f => { try { f({ line: +i, id: lines[+i] && lines[+i].id }); } catch (e) {} }); };
        const ev = await new Promise(res => { me.wait = { id, res }; N.speakAll(id, JSON.stringify(L), me.rate); });
        if (ev === 'error') throw Object.assign(new Error('읽기 실패'), { code: 'error' });
        if (ev === 'stopped' || me.stopped) throw Object.assign(new Error('stopped'), { code: 'viewer_stopped' });
        if (cur === me) cur = null;
        stateCbs.forEach(f => { try { f('idle'); } catch (e) {} });
        return;
      }
      for (let i = 0; i < lines.length; i++) {
        if (me.stopped) throw Object.assign(new Error('stopped'), { code: 'viewer_stopped' });
        lineCbs.forEach(f => { try { f({ line: i, id: lines[i].id }); } catch (e) {} });
        const text = String(lines[i].text || '').trim(); if (!text || /^[.\s]*$/.test(text)) continue;
        const id = 's' + (++seq);
        const ev = await new Promise(res => { me.wait = { id, res }; N.speak(id, text, me.rate); });
        if (ev === 'error') throw Object.assign(new Error('읽기 실패'), { code: 'error' });
        if (ev === 'stopped' || me.stopped) throw Object.assign(new Error('stopped'), { code: 'viewer_stopped' });
      }
      if (cur === me) cur = null;
      stateCbs.forEach(f => { try { f('idle'); } catch (e) {} });
    },
    busy: () => !!cur,
    pause() { N.ttsPause(); }, resume() { N.ttsResume(); },
    stop() { if (cur) { cur.stopped = true; const w = cur.wait; cur.wait = null; if (w) w.res('stopped'); cur = null; } N.ttsStop(); }
  };

  window.__tts = tts;
  window.claude = {
    use: async (name) => name === 'db' ? db : name === 'user' ? { id: 'local', name: '나' } : name === 'sample' ? sample : name === 'tts' ? tts : null,
    declare: () => {}, ready: () => {}
  };

  /* ---- 앱 듣기 화면과 기록 주고받기 ---- */
  // 틀린 문제(마지막 풀이가 오답) 번호 → 듣기의 '틀린 문제'·'오늘 복습'
  let lastWrong = '';
  function pushWrong() {
    try { if (typeof P === 'undefined') return; const w = [...new Set([...Object.keys(P).filter(k => P[k] && P[k][1] === 0), ...(window.__unsureIds ? window.__unsureIds() : [])])].sort();   // 틀린 문제 + 헷갈렸던 문제
      const j = JSON.stringify(w); if (j !== lastWrong) { lastWrong = j; N.setWrong(j); } } catch (e) {}
  }
  // 듣기 화면에서 들은 시간·지문 수 → 학습 일지 (이미 더한 만큼은 빼고 차이만 더함)
  function pullListen() {
    try {
      if (!window.LJ) return; const st = JSON.parse(N.listenStats() || '{}');
      let ap = {}; try { ap = JSON.parse(localStorage.getItem('nat_applied') || '{}'); } catch (e) {}
      let ch = false;
      for (const k in st) {
        const n = st[k], a = ap[k] || { lsec: 0, ox: 0, oxs: {} };
        const x = LJ.d[k] || (LJ.d[k] = { sec: 0, lsec: 0, q: 0, ok: 0, s: {}, ox: 0, oxs: {}, ex: 0, ses: [], seq: [] });
        const dl = (n.lsec || 0) - (a.lsec || 0), dx = (n.ox || 0) - (a.ox || 0);
        if (dl > 0) { x.lsec = (x.lsec || 0) + dl; x.sec = (x.sec || 0) + dl; ch = true; }
        if (dx > 0) { x.ox = (x.ox || 0) + dx; ch = true; }
        x.oxs = x.oxs || {};
        for (const s in (n.oxs || {})) { const d = n.oxs[s] - ((a.oxs || {})[s] || 0); if (d > 0) { x.oxs[s] = (x.oxs[s] || 0) + d; ch = true; } }
        ap[k] = n;
      }
      if (ch) { localStorage.setItem('reb_journal', JSON.stringify({ v: 1, days: LJ.d })); localStorage.setItem('nat_applied', JSON.stringify(ap)); }
    } catch (e) {}
  }
  setInterval(pushWrong, 5000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { pullListen(); pushWrong(); } });

  /* ---- 마지막으로 풀던 문제 기억 → 다음에 앱을 켜면 거기서 이어서 ---- */
  const RK = 'reb_resume';
  function saveResume() {
    try {
      if (typeof S === 'undefined' || !S || S.exam) return;
      const last = S.list[S.list.length - 1];
      if (S.i >= S.list.length - 1 && S.ans[last.id]) { localStorage.removeItem(RK); return; }   // 끝까지 풀었으면 지움
      const o = {};
      for (const k in S) if (!['list', 'i', 'ans', 'ai', 'end', 'done'].includes(k) && typeof S[k] !== 'function') o[k] = S[k];
      localStorage.setItem(RK, JSON.stringify({ ids: S.list.map(q => q.id), i: S.i, ans: S.ans, o }));
    } catch (e) {}
  }
  function resume() {
    try {
      const r = JSON.parse(localStorage.getItem(RK) || 'null'); if (!r || typeof Q === 'undefined') return;
      const by = {}; Q.forEach(q => by[q.id] = q);
      const list = r.ids.map(id => by[id]).filter(Boolean); if (!list.length) return;
      startQuiz(list, r.o || {});
      S.i = Math.min(r.i || 0, list.length - 1); S.ans = r.ans || {}; quiz();
    } catch (e) {}
  }

  document.head.insertAdjacentHTML('beforeend', '<style>.spin{display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:sp .8s linear infinite;vertical-align:-2px}@keyframes sp{to{transform:rotate(360deg)}}</style>');
  /* ---- 화면 연결: OX 듣기는 앱 전용 화면, 문제 해설 아래 '더 자세히' ---- */
  window.addEventListener('load', () => {
    const _go = window.go; window.go = function (v) { if (v !== 'quiz' && tts.busy()) { try { tts.stop(); } catch (e) {} } return _go.apply(this, arguments); };   // 화면을 옮기면 읽기 멈춤
    setTimeout(() => { pushWrong(); pullListen(); if (document.querySelector('#tabs button.on')?.dataset.v === 'home') resume(); }, 1500);
    if (typeof go === 'function') {
      const _go = go;
      go = window.go = function (v, a) { if (v === 'ox' || v === 'listen') { N.openOx(); return; } return _go(v, a); };
    }
    if (typeof quiz === 'function') {
      const _q = quiz;
      quiz = window.quiz = function () {
        const qid = S && S.list && S.list[S.i] && S.list[S.i].id;
        if (qid !== window.__lastQ) { window.__lastQ = qid; if (tts.busy()) try { tts.stop(); } catch (e) {} }
        const r = _q.apply(this, arguments);
        saveResume();
        try {
          const q = S.list[S.i], box = document.getElementById('aibox');
          if (q && box && !document.getElementById('more')) {
            box.insertAdjacentHTML('afterend', '<button class="btn full" id="more" style="margin-top:8px">🤖 더 자세히 <span class="svd no">인터넷</span></button><div id="moreBox"></div>');
            const MK = 'reb_more_' + q.id;
            const show = (b, t) => {
              b.innerHTML = '<div class="fb" style="white-space:pre-wrap;font-weight:400;margin-top:8px">' + t.replace(/</g, '&lt;') + '</div><button class="btn full" id="moreSay">🔊 읽어 주기</button>';
              const sb = document.getElementById('moreSay');
              sb.onclick = () => {      // 누르면 읽기, 읽는 중에 누르면 멈춤
                if (sb.dataset.on) { tts.stop(); return; }
                sb.dataset.on = 1; sb.textContent = '⏹ 그만 읽기';
                tts.speak([{ text: t }], {}).catch(e => { if (e.code !== 'viewer_stopped') toast(e.message); })
                  .finally(() => { delete sb.dataset.on; sb.textContent = '🔊 읽어 주기'; });
              };
            };
            const saved = localStorage.getItem(MK);
            if (saved) { document.getElementById('more').innerHTML = '🤖 더 자세히 <span class="svd">✓ 저장됨</span>'; }
            document.getElementById('more').onclick = async () => {
              const btn = document.getElementById('more'), b = document.getElementById('moreBox');
              if (localStorage.getItem(MK)) return show(b, localStorage.getItem(MK));   // 한 번 받은 설명은 바로
              if (btn.disabled) return;
              btn.disabled = true; const t0 = Date.now();
              b.innerHTML = '<div class="fb na" style="font-weight:400;margin-top:8px"><span class="spin"></span> <b id="moreT">설명을 만드는 중이에요… 0초</b><div class="muted" style="font-size:13px;margin-top:4px">인터넷으로 Gemini에게 물어보는 중이라 보통 10~30초 걸려요. 다른 문제로 넘어가도 괜찮아요.</div></div>';
              const tick = setInterval(() => { const e = document.getElementById('moreT'); if (e) e.textContent = '설명을 만드는 중이에요… ' + Math.round((Date.now() - t0) / 1000) + '초'; else clearInterval(tick); }, 1000);
              btn.textContent = '⏳ 기다려 주세요…';
              try {
                const t = await gemini(`너는 공인중개사 시험 강사야. 아래 기출문제를 수험생이 완전히 이해하도록 더 자세히, 쉬운 말로 설명해 줘. 왜 그 보기가 정답인지, 헷갈리는 보기는 왜 아닌지, 관련 개념과 암기 요령까지. 해요체, 8문장 안팎. 소리 내어 읽기 좋게 괄호·한자·기호는 쓰지 마.\n[정답] ${q.a}번\n[문제]\n${q.x}`, { modelTier: 'default' }, false);
                try { localStorage.setItem(MK, t); } catch (e) {}
                const nb = document.getElementById('moreBox'); if (nb) show(nb, t);
              } catch (e) {
                const nb = document.getElementById('moreBox'); if (nb) nb.innerHTML = '<div class="fb no">' + (e.message || '실패') + '</div>';
              } finally {
                clearInterval(tick); const nbtn = document.getElementById('more'); if (nbtn) { nbtn.disabled = false; nbtn.innerHTML = localStorage.getItem(MK) ? '🤖 더 자세히 <span class="svd">✓ 저장됨</span>' : '🤖 더 자세히 <span class="svd no">인터넷</span>'; }
              }
            };
          }
        } catch (e) {}
        return r;
      };
    }
  });
})();
