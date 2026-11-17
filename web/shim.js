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

  /* ---- sample: Gemini ---- */
  const MODELS = { quick: 'gemini-3.5-flash-lite', default: 'gemini-3.8-flash', complex: 'gemini-3.8-flash' };
  async function gemini(prompt, opts, asJson) {
    if (!N.key('gemini')) throw Object.assign(new Error('Gemini 키가 없어요 — OX 듣기 화면의 🔑 키 설정에서 넣어 주세요'), { code: 'no_key' });
    const body = { contents: [{ parts: [{ text: String(prompt) }] }], generationConfig: { temperature: 0.4 } };
    if (asJson) body.generationConfig.responseMimeType = 'application/json';
    const m = MODELS[(opts && opts.modelTier) || 'default'] || MODELS.default;
    const t = await call('gemini', m, JSON.stringify(body));
    const r = JSON.parse(t);
    return (((r.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || '').join('');
  }
  const sample = async (prompt, opts) => ({ text: await gemini(prompt, opts, false) });
  sample.json = async (prompt, opts) => { const t = await gemini(prompt, opts, true); const m = t.match(/[\[{][\s\S]*[\]}]/); return JSON.parse(m ? m[0] : t); };

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
    pause() { N.ttsPause(); }, resume() { N.ttsResume(); },
    stop() { if (cur) { cur.stopped = true; const w = cur.wait; cur.wait = null; if (w) w.res('stopped'); cur = null; } N.ttsStop(); }
  };

  window.claude = {
    use: async (name) => name === 'db' ? db : name === 'user' ? { id: 'local', name: '나' } : name === 'sample' ? sample : name === 'tts' ? tts : null,
    declare: () => {}, ready: () => {}
  };

  /* ---- 앱 듣기 화면과 기록 주고받기 ---- */
  // 틀린 문제(마지막 풀이가 오답) 번호 → 듣기의 '틀린 문제'·'오늘 복습'
  let lastWrong = '';
  function pushWrong() {
    try { if (typeof P === 'undefined') return; const w = Object.keys(P).filter(k => P[k] && P[k][1] === 0).sort();
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

  /* ---- 화면 연결: OX 듣기는 앱 전용 화면, 문제 해설 아래 '더 자세히' ---- */
  window.addEventListener('load', () => {
    setTimeout(() => { pushWrong(); pullListen(); }, 1500);
    if (typeof go === 'function') {
      const _go = go;
      go = window.go = function (v, a) { if (v === 'ox' || v === 'listen') { N.openOx(); return; } return _go(v, a); };
    }
    if (typeof quiz === 'function') {
      const _q = quiz;
      quiz = window.quiz = function () {
        const r = _q.apply(this, arguments);
        try {
          const q = S.list[S.i], box = document.getElementById('aibox');
          if (q && box && !document.getElementById('more')) {
            box.insertAdjacentHTML('afterend', '<button class="btn full" id="more" style="margin-top:8px">🤖 더 자세히 (Gemini)</button><div id="moreBox"></div>');
            document.getElementById('more').onclick = async () => {
              const b = document.getElementById('moreBox'); b.innerHTML = '<div class="muted">Gemini가 설명을 쓰는 중…</div>';
              try {
                const t = await gemini(`너는 공인중개사 시험 강사야. 아래 기출문제를 수험생이 완전히 이해하도록 더 자세히, 쉬운 말로 설명해 줘. 왜 그 보기가 정답인지, 헷갈리는 보기는 왜 아닌지, 관련 개념과 암기 요령까지. 해요체, 8문장 안팎. 소리 내어 읽기 좋게 괄호·한자·기호는 쓰지 마.\n[정답] ${q.a}번\n[문제]\n${q.x}`, { modelTier: 'default' }, false);
                b.innerHTML = '<div class="fb" style="white-space:pre-wrap;font-weight:400;margin-top:8px">' + t.replace(/</g, '&lt;') + '</div><button class="btn full" id="moreSay">🔊 읽어 주기</button>';
                document.getElementById('moreSay').onclick = () => tts.speak([{ text: t }], {}).catch(e => alert(e.message));
              } catch (e) { b.innerHTML = '<div class="fb no">' + (e.message || '실패') + '</div>'; }
            };
          }
        } catch (e) {}
        return r;
      };
    }
  });
})();
