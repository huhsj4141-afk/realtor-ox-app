/* 앱 전용 학습 기능 (APK에서만 불러옴)
   - 확신도 체크: 맞혀도 헷갈렸으면 복습 목록으로
   - 회독 관리: 과목별 1·2·3회독 진도
   - 빈출 표시 + 핵심 카드: 테마별 출제 횟수, 개념 요약 + OX 암기 카드
   - 주간 목표: 이번 주 공부한 날·문제 수
   - 앱에서 쓸 수 없는 Claude 전용 메뉴 숨기기
   화면 함수(home·setup·wrong·quiz)를 감싸서 그린 뒤에 덧붙이는 방식 → 원래 화면 코드는 그대로 둠 */
(() => {
  const N = window.NativeBridge;
  const $ = s => document.querySelector(s);
  const h = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const st = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  document.head.insertAdjacentHTML('beforeend', `<style>
    .chip.hot{background:#fff1e6;color:#c2410c}
    @media (prefers-color-scheme:dark){.chip.hot{background:#3a2414;color:#fdba74}}
    .conf{display:flex;gap:6px;align-items:center;margin-top:10px;flex-wrap:wrap}
    .conf .lb{font-size:13px;color:var(--mut,#888);flex:1 1 100%}
    .conf button{flex:1;padding:9px 4px;border-radius:10px;border:1px solid var(--line,#ddd);background:transparent;color:inherit;font-size:14px}
    .conf button.on{background:var(--pri,#2f6fed);color:#fff;border-color:transparent}
    .wk{display:flex;gap:6px;margin-top:10px}
    .wk div{flex:1;text-align:center;font-size:11px;opacity:.9}
    .wk i{display:block;height:26px;border-radius:8px;margin-bottom:3px;background:rgba(255,255,255,.18)}
    .wk i.d{background:#fff} .wk i.p{background:rgba(255,255,255,.55)} .wk div.t{font-weight:700}
    .rd{display:grid;grid-template-columns:62px 1fr 44px;gap:6px 8px;align-items:center;font-size:13px}
    .rd .b{height:8px;border-radius:5px;background:var(--line,#e5e7eb);overflow:hidden;display:flex}
    .rd .b i{display:block;height:100%}
    .kc{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99;display:flex;align-items:flex-end}
    .kc>div{background:var(--card,#fff);color:inherit;width:100%;max-height:86vh;overflow:auto;border-radius:18px 18px 0 0;padding:18px 18px 28px}
    .kc h3{margin:0 0 4px} .kc li{margin:6px 0;line-height:1.5}
    .fc{border:1px solid var(--line,#ddd);border-radius:12px;padding:12px;margin:8px 0}
    .fc .a{display:none;margin-top:8px;font-size:14px;line-height:1.55} .fc.open .a{display:block}
    .fc .o{font-weight:700;margin-right:6px}
    .chx{border:1.5px solid var(--line,#e5e7eb);border-radius:12px;padding:8px 10px;margin:6px 0;white-space:pre-wrap;word-break:keep-all}
    .chx.ans{border-color:#16a34a;background:rgba(22,163,74,.08)} .chx.mine{border-color:#dc2626;background:rgba(220,38,38,.07)}
    .chx .bd{display:inline-block;font-size:12px;font-weight:700;border-radius:6px;padding:1px 6px;margin-left:6px;vertical-align:1px}
    .bd.o{background:#dcfce7;color:#15803d} .bd.x{background:#fee2e2;color:#b91c1c} .bd.a{background:#16a34a;color:#fff} .bd.m{background:#dc2626;color:#fff}
    .chx .why{font-size:13.5px;line-height:1.6;margin-top:6px;padding-top:6px;border-top:1px dashed var(--line,#e5e7eb)}
    .bad{text-decoration:underline wavy #dc2626;text-underline-offset:3px;color:#dc2626;font-weight:700}
    .good{color:#15803d;font-weight:700}
    .em-x{color:#dc2626;font-weight:700} .em-o{color:#15803d;font-weight:700} .em-n{font-weight:700;text-decoration:underline;text-underline-offset:3px}
    .em-q{font-weight:700;background:linear-gradient(transparent 60%,rgba(250,204,21,.45) 60%)}
    #aibox .exs{font-size:16px;font-weight:600;line-height:1.6;padding:10px 12px;border-left:4px solid #f59e0b;background:rgba(245,158,11,.1);border-radius:8px}
    #aibox .exh{font-size:15px;font-weight:800;margin-top:14px;padding-bottom:4px;border-bottom:2px solid var(--pri,#2f6fed);display:inline-block}
    #aibox .st li{margin:8px 0} #aibox .st .muted{color:inherit!important;opacity:.85;font-size:14px!important;line-height:1.6}
    .gl{text-decoration:underline dotted #8b5cf699;text-underline-offset:4px;text-decoration-thickness:1.5px;cursor:help}
    .elh{font-size:12.5px;color:var(--mut,#94a3b8);margin:8px 0 2px}.elc{padding:3px 4px;margin:0 -4px;border-radius:8px;cursor:pointer;white-space:pre-wrap;transition:opacity .15s}.elc:active{background:rgba(148,163,184,.12)}.elc.x{text-decoration:line-through;text-decoration-color:#ef4444;text-decoration-thickness:3px;opacity:.4}.choices button.elx{opacity:.35;text-decoration:line-through;text-decoration-color:#ef4444}
    #ver{font-size:12.5px;font-weight:600;color:var(--pri,#6f9bff);margin-left:8px;vertical-align:middle;border:1px solid currentColor;border-radius:999px;padding:2px 9px;cursor:pointer}#updb{display:block;width:100%;margin:0 0 12px;padding:14px 16px;border:0;border-radius:14px;background:#2563eb;color:#fff;font:inherit;font-size:17px;font-weight:700;text-align:left;cursor:pointer;box-shadow:0 4px 14px rgba(37,99,235,.35)}#updb small{display:block;font-size:12.5px;font-weight:500;opacity:.85;margin-top:2px}
    .qno{font-size:12.5px;opacity:.55;align-self:center;margin-left:auto}
    .fb.top small,.fb.top span{font-size:13px;font-weight:600} .fb.top{font-size:18px;font-weight:800;padding:12px 14px;margin:0 0 12px;border-radius:12px}
    .chx:not(.ans):not(.mine){opacity:.82} .chx.ans{border-width:2px} .chx .bd{font-size:11px}
    .conf{display:flex;gap:6px;align-items:center;flex-wrap:nowrap} .conf .lb{flex:none!important;margin-right:4px}
    .glb{position:fixed;left:12px;right:12px;bottom:84px;z-index:150;background:#1e1b4b;color:#fff;border-radius:14px;padding:12px 14px;font-size:15px;line-height:1.55;box-shadow:0 8px 24px rgba(0,0,0,.3)}
    .glb b{color:#c4b5fd;margin-right:6px}
    .slog{font-size:14px;display:block} .slog .d{font-weight:700;margin:14px 0 4px;display:flex;justify-content:space-between}
    .slog .it{display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--line,#eee);align-items:center}
    .slog .it span:first-child{opacity:.6;width:40px;flex:none} .slog .it .g{flex:1} .slog .it .sm{font-size:12px;opacity:.65}
    /* 문제 화면 정리: 큰 주요 버튼 + 작은 도구 줄 */
    .qtb{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}
    .qtb>*{display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:8px 2px!important;font-size:12px!important;min-height:52px;border-radius:12px!important;text-decoration:none;text-align:center;line-height:1.2}
    .qtb .ic{font-size:19px}
    .bigai{display:block;width:100%;margin-top:12px;padding:15px!important;font-size:17px!important;font-weight:700;border-radius:14px!important}
    .qmeta{font-size:12.5px;opacity:.65;margin:-2px 0 8px}
    .conf{margin-top:12px} .conf .lb{font-size:12.5px}
    .conf button{padding:7px 4px;font-size:13.5px}
    #more{margin-top:10px}
    .sit{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .sit button{text-align:left;padding:12px;border-radius:12px;border:1px solid var(--line,#e5e7eb);background:transparent;color:inherit}
    .sit b{display:block;font-size:15px} .sit span{font-size:12px;opacity:.7}
  </style>`);

  /* ---------- 빈출: 테마별로 10년 동안 몇 번 나왔나 ---------- */
  let FQ = null;
  const freq = () => {
    if (FQ) return FQ;
    FQ = {}; for (const q of Q) FQ[q.t] = (FQ[q.t] || 0) + 1;
    const v = Object.values(FQ).sort((a, b) => b - a);
    FQ._a = v[Math.floor(v.length * .2)] || 99; FQ._b = v[Math.floor(v.length * .5)] || 99;
    return FQ;
  };
  const hotStars = t => { const f = freq(), n = f[t] || 0; return n >= f._a ? '★★★' : n >= f._b ? '★★' : '★'; };

  /* ---------- 확신도 ---------- */
  const CK = 'reb_conf';
  const conf = () => st(CK, {});
  function setConf(q, v) {
    const c = conf(); c[q.id] = v; put(CK, c);
    // 맞혔어도 헷갈리거나 찍었으면 틀린 것처럼 복습 일정에 넣기 (점수 계산에는 영향 없음)
    try { if (v !== 'sure' && P[q.id] && typeof srsUpdate === 'function') { srsUpdate(P[q.id], false); touch(q.id); } } catch (e) {}
  }
  const unsureIds = () => { const c = conf(); return Object.keys(c).filter(k => c[k] !== 'sure' && typeof BYID !== 'undefined' && BYID[k]); };

  /* ---------- 핵심 카드 ---------- */
  let OXD = null, OXE = null, MCX = null;
  const asset = n => { try { return JSON.parse(N.asset(n) || 'null'); } catch (e) { return null; } };
  function card(theme) {
    OXD = OXD || asset('ox.json') || []; OXE = OXE || asset('exp.json') || {}; MCX = MCX || asset('mc_exp.json') || {};
    const qs = Q.filter(q => q.t === theme);
    const concepts = [...new Set(qs.map(q => MCX[q.id] && MCX[q.id].concept).filter(Boolean))].slice(0, 6);
    const ox = [];
    const MKS = window.__oxmk = window.__oxmk || asset('ox_mark.json') || {};
    OXD.forEach((tr, ti) => tr.items.forEach((it, i) => { if (it.t === theme) ox.push({ s: it.s, o: it.o, e: OXE[`${ti}_${i}`] || '', m: MKS[`${ti}_${i}`] }); }));
    const el = document.createElement('div'); el.className = 'kc';
    el.innerHTML = `<div><div class="row"><h3 class="grow">📇 ${h(theme)}</h3><button class="btn sm" id="kcx">닫기</button></div>
      <div class="muted">${qs.length ? `기출 ${qs.length}회 출제 · 빈출 ${hotStars(theme)}` : ''}</div>
      ${concepts.length ? `<h4 style="margin:14px 0 4px">핵심 정리</h4><ul style="padding-left:18px;margin:0">${concepts.map(c => `<li>${h(c)}</li>`).join('')}</ul>` : ''}
      ${ox.length ? `<h4 style="margin:16px 0 4px">OX 암기 카드 <span class="muted" style="font-weight:400;font-size:13px">눌러서 정답 보기</span></h4>${ox.slice(0, 12).map(x => `<div class="fc"><div>${h(x.s)}</div><div class="a">${x.m ? `<div style="margin-bottom:4px">${h(x.s).split(h(x.m.bad)).join(`<span class="bad">${h(x.m.bad)}</span>`)}<div class="good">→ 바르게: ${h(x.m.fix)}</div></div>` : ''}<span class="o" style="color:${x.o ? '#16a34a' : '#dc2626'}">${x.o ? 'O' : 'X'}</span>${emph(x.e)}</div></div>`).join('')}` : ''}
      ${!concepts.length && !ox.length ? '<div class="muted" style="margin-top:12px">이 테마는 아직 정리된 내용이 없어요. 문제 해설이 만들어지면 채워져요.</div>' : ''}</div>`;
    el.onclick = e => { if (e.target === el || e.target.id === 'kcx') el.remove(); const f = e.target.closest('.fc'); if (f) f.classList.toggle('open'); };
    document.body.appendChild(el);
  }
  window.openCard = card;

  /* ---------- 문제 화면: 빈출 표시, 확신도, 핵심 카드 ---------- */
  function decorateQuiz() {
    if (typeof S === 'undefined' || !S || !S.list) return;
    const q = S.list[S.i]; if (!q) return;
    const chips = document.querySelector('#view .chips');
    if (chips && !chips.querySelector('.hot')) {
      chips.querySelectorAll('.chip').forEach(c => { if (c.textContent === '문자인식') c.remove(); });
      chips.insertAdjacentHTML('beforeend', `<span class="chip hot">빈출 ${hotStars(q.t)} · ${freq()[q.t] || 1}회</span>`);
    }
    const row = document.getElementById('qb')?.parentElement;
    if (chips && !document.querySelector('.qmeta')) {
      // 과목·빈출만 칩으로, 나머지(회차·단원·난이도)는 작은 글씨 한 줄로
      const keep = [...chips.querySelectorAll('.chip')], meta = [];
      keep.forEach((c, i) => { if (i > 0 && !c.classList.contains('hot')) { meta.push(c.textContent); c.remove(); } });
      const pk = S.ans[q.id] && !(S.exam && !S.done);
      chips.insertAdjacentHTML('beforeend', `<span class="qno">${q.n}회 ${q.no}번</span>`);

    }
    if (row && !row.classList.contains("qtb")) {
      const pickd = S.ans[q.id] && !(S.exam && !S.done);
      const ai = document.getElementById('qa'), calc = document.getElementById('qv');
      const pdfA = row.querySelector('a');
      const mk = (el, ic, t) => { if (!el) return; el.className = 'btn'; el.innerHTML = `<span class="ic">${ic}</span>${t}`; };
      mk(document.getElementById('qb'), BM[q.id] ? '★' : '☆', BM[q.id] ? '북마크됨' : '북마크');
      mk(pdfA, '📄', '원본');
      row.insertAdjacentHTML('beforeend', '<button id="qk"></button><button id="qr"></button>');
      mk(document.getElementById('qk'), '📇', '핵심 카드'); mk(document.getElementById('qr'), '🚩', '신고');
      document.getElementById('qk').onclick = () => card(q.t);
      document.getElementById('qr').onclick = () => report(q);
      if (ai) { ai.className = 'btn pri bigai'; row.parentElement.insertBefore(ai, row); if (!pickd) ai.style.display = 'none'; }
      if (calc) { calc.className = 'btn full'; calc.style.marginTop = '8px'; row.parentElement.insertBefore(calc, row); if (!pickd) calc.style.display = 'none'; }
      row.className = "qtb"; row.removeAttribute('style');
    }
    const mo = document.getElementById('more'), ab = document.getElementById('aibox');
    if (mo) mo.style.display = S.ans[q.id] && ab && ab.textContent.trim().length > 20 ? '' : 'none';
    const ex = S.exam && !S.done, pick = S.ans[q.id];
    const fb = document.querySelector('#view .fb');
    if (pick && !ex && fb && !fb.classList.contains('top')) {
      const cardEl = fb.closest('.card'); if (cardEl) { fb.classList.add('top'); cardEl.insertBefore(fb, cardEl.firstChild); }
    }
    if (pick && !ex && fb && !document.querySelector('.conf')) {
      const cur = conf()[q.id];
      (document.querySelector('#view .choices') || fb).insertAdjacentHTML('afterend', `<div class="conf"><span class="lb">확신도</span>
        ${[['sure', '😎 확실'], ['unsure', '🤔 헷갈림'], ['guess', '🎲 찍음']].map(([v, t]) => `<button data-v="${v}" class="${cur === v ? 'on' : ''}">${t}</button>`).join('')}</div>`);
      document.querySelector('.conf').onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        setConf(q, b.dataset.v);
        document.querySelectorAll('.conf button').forEach(x => x.classList.toggle('on', x === b));
      };
    }
  }

  /* ---------- 홈: 주간 목표 + 회독 진도, Claude 전용 카드 숨김 ---------- */
  const DAY = 864e5;
  function weekStrip() {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const mon = new Date(t0); mon.setDate(t0.getDate() - ((t0.getDay() + 6) % 7));
    const cnt = {}; for (const k in P) { const r = P[k]; if (!r[4]) continue; const d = new Date(r[4]); d.setHours(0, 0, 0, 0); cnt[d.getTime()] = (cnt[d.getTime()] || 0) + 1; }
    let days = 0, sum = 0;
    const cells = '월화수목금토일'.split('').map((n, i) => {
      const d = mon.getTime() + i * DAY, c = cnt[d] || 0; if (c) { days++; sum += c; }
      return `<div class="${d === t0.getTime() ? 't' : ''}"><i class="${c >= 15 ? 'd' : c ? 'p' : ''}"></i>${n}</div>`;
    }).join('');
    return `<div style="margin-top:14px;font-size:13px;opacity:.95">이번 주 <b>${days}일</b> 공부 · <b>${sum}</b>문제 <span style="opacity:.8">(목표 주 6일)</span></div><div class="wk">${cells}</div>`;
  }
  function roundCard() {
    const sub = typeof SUBS !== 'undefined' ? SUBS : ['학개론', '민법', '중개사법', '공법', '공시법', '세법'];
    const rows = sub.map((n, s) => {
      const qs = Q.filter(q => q.s === s), T = qs.length || 1;
      const k = m => qs.filter(q => P[q.id] && P[q.id][2] >= m).length;
      const r1 = k(1), r2 = k(2), r3 = k(3);
      return `<b>${n}</b><div class="b"><i style="width:${r3 / T * 100}%;background:#16a34a"></i><i style="width:${(r2 - r3) / T * 100}%;background:#60a5fa"></i><i style="width:${(r1 - r2) / T * 100}%;background:#cbd5e1"></i></div><span class="muted">${Math.round(r1 / T * 100)}%</span>`;
    }).join('');
    const un = unsureIds().length;
    return `<div class="card" id="rdcard"><h2>📚 회독 진도</h2>
      <div class="muted" style="font-size:12px;margin-bottom:8px">막대: <span style="color:#16a34a">■</span>3회독 <span style="color:#60a5fa">■</span>2회독 <span style="color:#94a3b8">■</span>1회독 · 숫자는 1회독 비율</div>
      <div class="rd">${rows}</div>
      ${un ? `<button class="btn full" id="rdun" style="margin-top:12px">🤔 헷갈렸던 문제 ${un}개 다시 풀기</button>` : ''}</div>`;
  }
  function cleanCards(texts) {
    document.querySelectorAll('#view .card, #view details').forEach(c => {
      const t = (c.querySelector('h2,summary,b')?.textContent || '') + ' ' + c.textContent.slice(0, 60);
      if (texts.some(x => t.includes(x))) c.remove();
    });
    document.querySelectorAll('#view .muted, #view div').forEach(e => { if (/claude\.ai에서 열면/.test(e.textContent) && e.children.length === 0) e.remove(); });
  }
  function decorateHome() {
    showVer(); updBanner();
    cleanCards(['해설 미리 받기', '오늘의 처방']);
    // '오늘의 한 문제·귀로 듣기' 두 칸은 학습 매니저의 상황별 버튼과 겹쳐서 숨김
    const dup = [...document.querySelectorAll('#view *')].filter(e => e.textContent.includes('오늘의 한 문제') && e.textContent.includes('귀로 듣기') && e.textContent.length < 220).pop();
    if (dup) dup.remove();
    const hero = document.querySelector('#view .card');
    if (hero && !document.querySelector('.wk')) hero.insertAdjacentHTML('beforeend', weekStrip());
    if (hero && !$('#mgr')) {
      hero.insertAdjacentHTML('afterend', managerCard());
      $('#mgr .sit').onclick = e => { const b = e.target.closest('[data-s]'); if (b) runSitu(b.dataset.s); };
    }
    if (!$('#rdcard')) {
      ($('#mgr') || hero)?.insertAdjacentHTML('afterend', roundCard());
      const b = $('#rdun'); if (b) b.onclick = () => startQuiz(shuffle(unsureIds().map(k => BYID[k])), { from: 'home', title: '헷갈렸던 문제' });
    }
  }
  function decorateSetup() {
    cleanCards([]);
    document.querySelectorAll('#view [data-a="photo"]').forEach(b => b.remove());
    const box = document.querySelector('#view [data-a]')?.parentElement;
    if (box && !$('#kcl')) {
      box.insertAdjacentHTML('beforeend', `<button id="kcl"><b>📇</b><div>핵심 카드<span>빈출 테마 순으로 개념 정리·OX 암기</span></div></button>`);
      $('#kcl').className = box.querySelector('[data-a]').className;
      $('#kcl').onclick = e => { e.stopPropagation(); themeList(); };
    }
  }
  function themeList() {
    const f = freq();
    const ts = Object.keys(f).filter(k => !k.startsWith('_')).sort((a, b) => f[b] - f[a]);
    const el = document.createElement('div'); el.className = 'kc';
    el.innerHTML = `<div><div class="row"><h3 class="grow">📇 핵심 카드 · 빈출 순</h3><button class="btn sm" id="kcx">닫기</button></div>
      ${ts.map(t => `<div class="fc" data-t="${h(t)}"><b>${h(t)}</b> <span class="muted">${hotStars(t)} · ${f[t]}회</span></div>`).join('')}</div>`;
    el.onclick = e => { if (e.target === el || e.target.id === 'kcx') return el.remove(); const c = e.target.closest('[data-t]'); if (c) { el.remove(); card(c.dataset.t); } };
    document.body.appendChild(el);
  }
  function decorateWrong() {
    cleanCards([]);
    document.querySelectorAll('#view .card').forEach(c => { if (/claude\.ai에서 열면/.test(c.textContent) && c.textContent.length < 160) c.remove(); });
    if (!$('#logc')) drawLog(null);
    const first = document.querySelector('#view .card:not(#logc)');
    const un = unsureIds().length;
    if (first && un && !$('#wun')) {
      first.insertAdjacentHTML('beforeend', `<button class="btn full" id="wun" style="margin-top:10px">🤔 헷갈렸던 문제 ${un}개 다시 풀기</button>`);
      $('#wun').onclick = () => startQuiz(shuffle(unsureIds().map(k => BYID[k])), { from: 'wrong', title: '헷갈렸던 문제' });
    }
  }


  /* ---------- 고르게 뽑기: 시험 비중대로 과목 나누고, 과목 안에서는 단원을 번갈아 ----------
     최근 7일에 덜 한 과목·정답률 낮은 과목에 조금 더, 사흘 안에 푼 문제는 빼고, 안 푼 문제 → 오래전에 푼 문제 순 */
  const WEIGHT = [40, 40, 40, 40, 24, 16];
  function recentBySub(days) {
    const t = Date.now() - days * DAY, c = [0, 0, 0, 0, 0, 0];
    for (const k in P) { const r = P[k], q = BYID[k]; if (q && r[4] >= t) c[q.s]++; }
    return c;
  }
  function rateBySub() {
    return [0, 1, 2, 3, 4, 5].map(s => { let n = 0, ok = 0; for (const k in P) { const q = BYID[k]; if (q && q.s === s && P[k][1] >= 0) { n++; ok += P[k][1]; } } return n ? ok / n : null; });
  }
  function balanced(n, opt = {}) {
    const rec = recentBySub(7), tot = rec.reduce((a, b) => a + b, 0) || 1, rate = rateBySub(), W = WEIGHT.reduce((a, b) => a + b, 0);
    const need = WEIGHT.map((w, s) => Math.max(.2, w / W * 1.0 + (w / W - rec[s] / tot) * .8 + (rate[s] == null ? .05 : (0.7 - rate[s]) * .3)));
    const subs = opt.subs || [0, 1, 2, 3, 4, 5];
    const nt = subs.reduce((a, s) => a + need[s], 0);
    const cut = Date.now() - 3 * DAY, out = [];
    for (const s of subs) {
      const k = Math.max(1, Math.round(n * need[s] / nt));
      const pool = Q.filter(q => q.s === s && graded(q) && !(P[q.id] && P[q.id][4] > cut) && (!opt.only || opt.only(q)));
      const byU = {}; pool.forEach(q => (byU[q.u] = byU[q.u] || []).push(q));
      Object.values(byU).forEach(l => l.sort((a, b) => ((P[a.id] || [0, 0, 0, 0, 0])[4] - (P[b.id] || [0, 0, 0, 0, 0])[4]) || Math.random() - .5));
      const us = shuffle(Object.keys(byU)); let i = 0, got = 0;
      while (got < k && us.some(u => byU[u].length)) { const l = byU[us[i++ % us.length]]; if (l.length) { out.push(l.shift()); got++; } }
    }
    if (out.length < n) {   // 반올림으로 모자라면 아직 안 고른 문제 중 오래전에 푼 것부터 채움
      const have = new Set(out.map(q => q.id));
      Q.filter(q => subs.includes(q.s) && graded(q) && !have.has(q.id) && !(P[q.id] && P[q.id][4] > cut) && (!opt.only || opt.only(q)))
        .sort((a, b) => ((P[a.id] || [0, 0, 0, 0, 0])[4] - (P[b.id] || [0, 0, 0, 0, 0])[4]) || Math.random() - .5)
        .slice(0, n - out.length).forEach(q => out.push(q));
    }
    return shuffle(out).slice(0, n);
  }
  window.balancedSet = balanced;

  /* ---------- 학습 매니저: 지금 잘하고 있는지, 빠진 곳은 어딘지 ---------- */
  function diagnose() {
    const rec = recentBySub(7), rate = rateBySub(), W = WEIGHT.reduce((a, b) => a + b, 0), tot = rec.reduce((a, b) => a + b, 0);
    const sub = SUBS, notes = [];
    const t14 = recentBySub(14);
    const ever = recentBySub(3650);
    sub.forEach((n, s) => { if (!t14[s]) notes.push(ever[s] ? `<b>${n}</b> 2주째 안 풀었어요` : `<b>${n}</b> 아직 시작 안 했어요`); });
    if (tot >= 20) sub.forEach((n, s) => { const share = rec[s] / tot, want = WEIGHT[s] / W; if (t14[s] && share < want * .5) notes.push(`<b>${n}</b> 이번 주 비중이 적어요 (${Math.round(share * 100)}% · 권장 ${Math.round(want * 100)}%)`); });
    rate.forEach((r, s) => { if (r != null && r < .4) notes.push(`<b>${sub[s]}</b> 정답률 ${Math.round(r * 100)}% · 과락 위험`); });
    const un = unsureIds().length; if (un) notes.push(`헷갈렸던 문제 <b>${un}개</b>가 복습을 기다려요`);
    let due = 0; try { due = dueList().length; } catch (e) {}
    if (due) notes.push(`오늘 복습할 문제 <b>${due}개</b>`);
    let lsec = 0; try { const d = LJ.d; const t = Date.now(); for (const k in d) if (t - new Date(k) < 7 * DAY) lsec += d[k].lsec || 0; } catch (e) {}
    if (lsec < 600) notes.push('이번 주 듣기가 10분도 안 돼요 — 이동할 때 🎧 귀로 듣기를 써 보세요');
    const days = (() => { const s7 = new Set(); for (const k in P) { const r = P[k]; if (Date.now() - r[4] < 7 * DAY) s7.add(new Date(r[4]).toDateString()); } return s7.size; })();
    const grade = notes.length === 0 && days >= 5 ? ['😊 잘하고 있어요', '#16a34a'] : notes.length <= 2 && days >= 3 ? ['🙂 괜찮아요, 빈 곳만 채워요', '#2563eb'] : ['💪 다시 리듬을 잡아요', '#ea580c'];
    const bars = sub.map((n, s) => { const share = tot ? rec[s] / tot : 0, want = WEIGHT[s] / W;
      return `<span>${n}</span><div class="b" style="position:relative"><i style="width:${Math.min(100, share * 100 * 2.5)}%;background:${share < want * .5 ? '#f59e0b' : '#3b82f6'}"></i><em style="position:absolute;left:${want * 250}%;top:-2px;bottom:-2px;width:2px;background:#111;opacity:.35"></em></div><span class="muted">${Math.round(share * 100)}%</span>`; }).join('');
    return { grade, notes, bars, days, tot };
  }

  const SITU = [
    ['wake', '🌅', '잠에서 깼을 때', '5분 · 어제 헷갈린 것 떠올리기'],
    ['bus', '🚌', '버스·이동 중', '듣기 · 과목 골고루 + 하차 알림'],
    ['short', '☕', '자투리 5분', '골고루 5문제'],
    ['lib', '📚', '도서관·책상', '60분 · 골고루 30문제'],
    ['night', '🌙', '잠들기 전', '핵심 카드 + 20분 듣고 꺼짐'],
    ['exam', '📝', '실전 연습', '모의고사 시간 재고 풀기']
  ];
  function runSitu(k) {
    if (k === 'wake') { const l = shuffle([...new Set([...unsureIds(), ...(typeof dueList === 'function' ? dueList().map(q => q.id || q) : [])])]).map(x => BYID[x] || x).filter(q => q && q.id).slice(0, 5);
      startQuiz(l.length >= 3 ? l : balanced(5), { from: 'home', title: '🌅 아침 5분 떠올리기' }); }
    else if (k === 'short') startQuiz(balanced(5), { from: 'home', title: '☕ 자투리 5문제' });
    else if (k === 'lib') startQuiz(balanced(30), { from: 'home', title: '📚 집중 30문제 (과목 골고루)' });
    else if (k === 'exam') go('exam');
    else if (k === 'bus') pickBus();
    else if (k === 'night') nightMode();
  }
  function pickBus() {
    const el = document.createElement('div'); el.className = 'kc';
    el.innerHTML = `<div><div class="row"><h3 class="grow">🚌 몇 분 뒤에 내려요?</h3><button class="btn sm" id="kcx">닫기</button></div>
      <div class="muted">과목을 번갈아 덜 들은 지문부터 들려주고, 내리기 2분 전과 도착 때 진동으로 알려줘요.</div>
      <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:12px">${[0, 10, 15, 20, 30, 40, 60].map(m => `<button class="btn grow" data-m="${m}">${m ? m + '분' : '알림 없이'}</button>`).join('')}</div></div>`;
    el.onclick = e => { if (e.target === el || e.target.id === 'kcx') return el.remove(); const b = e.target.closest('[data-m]'); if (b) { el.remove(); openListen('mix', 0, +b.dataset.m); } };
    document.body.appendChild(el);
  }
  function nightMode() {
    const recentT = [...new Set(Object.keys(P).filter(k => Date.now() - P[k][4] < DAY && BYID[k]).map(k => BYID[k].t))];
    const el = document.createElement('div'); el.className = 'kc';
    el.innerHTML = `<div><div class="row"><h3 class="grow">🌙 잠들기 전</h3><button class="btn sm" id="kcx">닫기</button></div>
      <div class="muted">자기 직전에 본 내용이 가장 오래 남아요. 오늘 푼 테마를 카드로 훑고, 듣기를 켜 두면 20분 뒤 소리가 작아지다 꺼져요.</div>
      ${recentT.length ? `<h4 style="margin:12px 0 4px">오늘 푼 테마</h4>${recentT.slice(0, 8).map(t => `<div class="fc" data-t="${h(t)}">📇 ${h(t)}</div>`).join('')}` : '<div class="muted" style="margin-top:10px">오늘 푼 문제가 없어요. 오늘 복습 지문을 들어 보세요.</div>'}
      <button class="btn pri full" id="nl" style="margin-top:12px">🎧 오늘 복습 듣고 20분 뒤 끄기</button></div>`;
    el.onclick = e => { if (e.target === el || e.target.id === 'kcx') return el.remove(); if (e.target.id === 'nl') { el.remove(); return openListen('review', 20, 0); } const c = e.target.closest('[data-t]'); if (c) { el.remove(); card(c.dataset.t); } };
    document.body.appendChild(el);
  }
  function openListen(mode, sleep, bus) {
    if (N && N.openOxWith) N.openOxWith(mode, sleep, bus); else go('ox');
  }

  function managerCard() {
    const d = diagnose();
    return `<div class="card" id="mgr"><div class="row"><h2 class="grow">🧭 학습 매니저</h2><b style="color:${d.grade[1]}">${d.grade[0]}</b></div>
      <div class="muted" style="font-size:13px">최근 7일 ${d.days}일 · ${d.tot}문제</div>
      ${d.notes.length ? `<div style="margin:10px 0 4px;font-weight:600">채울 곳</div><ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6">${d.notes.slice(0, 4).map(n => `<li>${n}</li>`).join('')}</ul>` : '<div style="margin-top:8px">빠진 곳 없이 골고루 하고 있어요 👍</div>'}
      <details style="margin-top:8px"><summary class="muted" style="font-size:13px">과목 균형 보기 (막대=이번 주 비중, 선=시험 비중)</summary><div class="rd" style="margin-top:8px">${d.bars}</div></details>
      <div style="margin:14px 0 6px;font-weight:600">지금 어디서 공부해요?</div>
      <div class="sit">${SITU.map(([k, i, t, sub]) => `<button data-s="${k}"><b>${i} ${t}</b><span>${sub}</span></button>`).join('')}</div>
      <div class="muted" style="font-size:12px;margin-top:8px">어떤 상황이든 과목·단원을 번갈아 고르고, 최근에 푼 문제는 빼요.</div></div>`;
  }


  /* ---------- 해설 보기 좋게: 보기별 O·X, 틀린 부분 밑줄, 해설 강조 ---------- */
  const MK5 = '①②③④⑤';
  const NEG = /(옳지\s*않은|틀린|아닌\s*것|않는\s*것|해당하지\s*않는|부적절한|잘못된)/;
  function expOf(q) {
    try { if (EXC[q.id]) return EXC[q.id]; } catch (e) {}
    MCX = MCX || asset('mc_exp.json') || {}; return MCX[q.id] || null;
  }
  // "A가 아니라 B" → A 는 틀린 말, B 는 맞는 말
  function wrongBits(why) {
    const out = [];
    String(why || '').replace(/['‘“"]?([가-힣A-Za-z0-9·]{2,15})['’”"]?\s*(?:이|가|은|는)?\s*아니(?:라|고)\s*['‘“"]?([가-힣A-Za-z0-9·]{2,15})/g, (m, a, b) => { out.push([a, b]); return m; });
    return out;
  }
  function emph(t) {
    return h(t)
      .replace(/([‘“'"][^‘“'"’”<>]{1,20}[’”'"])/g, '<span class="em-q">$1</span>')
      .replace(/(틀립니다|틀린 설명|옳지 않습니다|아닙니다|틀렸|오답)/g, '<span class="em-x">$1</span>')
      .replace(/(맞습니다|옳습니다|정답입니다|올바릅니다|정답)/g, '<span class="em-o">$1</span>')
      .replace(/(\d+(?:\.\d+)?\s*(?:년|개월|일|%|퍼센트|만원|억원|원|배|㎡|제곱미터|분의|명|회|세))/g, '<span class="em-n">$1</span>');
  }
  function decorateChoices() {
    if (typeof S === 'undefined' || !S || !S.list) return;
    const q = S.list[S.i], pick = q && S.ans[q.id], ex = S.exam && !S.done;
    const qt = document.querySelector('#view .qtext'); if (!q || !qt || !pick || ex) return;
    const e = expOf(q);
    const sig = q.id + (e ? '+e' : '');
    if (qt.dataset.dec === sig) return;
    const lines = q.x.split('\n'); const idx = lines.findIndex(l => /^\s*①/.test(l));
    if (idx < 0) return;
    // 보기 묶기 (보기 하나가 여러 줄일 수 있음)
    const stem = lines.slice(0, idx).join('\n'), ch = [];
    lines.slice(idx).forEach(l => { const m = /^\s*([①②③④⑤])/.exec(l); if (m) ch.push({ n: MK5.indexOf(m[1]) + 1, t: l.trim() }); else if (ch.length) ch[ch.length - 1].t += '\n' + l; });
    if (ch.length !== 5) return;
    const ans = String(q.a).split(',').map(Number);
    const info = {}; (e && Array.isArray(e.choices) ? e.choices : []).forEach(c => { info[+c.no] = { ox: String(c.ox).includes('O') ? 'o' : 'x', why: c.why || '', bad: c.bad || '', fix: c.fix || '' }; });
    if (e && Array.isArray(e.steps)) e.steps.forEach(st => { const m = /([①②③④⑤])/.exec(st.title || ''); if (m) { const n = MK5.indexOf(m[1]) + 1; info[n] = info[n] || {}; if (!info[n].why) info[n].why = st.say || ''; } });
    const stmt = /①\s*[가-힣]/.test(q.x) && !/ㄱ\s*[,·]/.test(lines.slice(idx).join(' '));   // 문장형 보기일 때만 O·X 추정
    const neg = NEG.test(stem);
    qt.innerHTML = h(stem) + ch.map(c => {
      const isAns = ans.includes(c.n), mine = c.n === pick && !isAns;
      let ox = info[c.n] && info[c.n].ox; if (!ox && stmt) ox = (isAns === neg) ? 'x' : 'o';
      let text = h(c.t);
      const why = info[c.n] && info[c.n].why;
      const I = info[c.n] || {};
      if (ox === 'x' && I.bad && c.t.includes(I.bad)) text = text.split(h(I.bad)).join(`<span class="bad">${h(I.bad)}</span>`);
      else if (ox === 'x' && why) wrongBits(why).forEach(([a]) => { text = text.split(h(a)).join(`<span class="bad">${h(a)}</span>`); });
      return `<div class="chx ${isAns ? 'ans' : ''} ${mine ? 'mine' : ''}">${text}${isAns ? '<span class="bd a">정답</span>' : ''}${mine ? '<span class="bd m">내 선택</span>' : ''}${ox ? `<span class="bd ${ox}">${ox === 'o' ? 'O 맞는 말' : 'X 틀린 말'}</span>` : ''}${ox === 'x' && I.fix ? `<div class="good" style="font-size:13.5px;margin-top:4px">→ 바르게: ${h(I.fix)}</div>` : ''}${why ? `<div class="why">${emph(why).replace(/([가-힣A-Za-z0-9·]{2,15})\s*(?:이|가|은|는)?\s*아니(라|고)/g, '<span class="bad">$1</span> 아니$2')}</div>` : ''}</div>`;
    }).join('');
    qt.style.whiteSpace = 'normal'; qt.dataset.dec = sig;
    // 해설 글도 강조
    document.querySelectorAll('#aibox .exs, #aibox .ex > div:not([class]), #aibox .st .muted, #aibox .ch span:last-child, #aibox .exm div, #aibox .ext').forEach(el => {
      if (el.dataset.em || el.querySelector('svg,.tx,table')) return; el.dataset.em = 1; el.innerHTML = emph(el.textContent);
    });
  }
  setInterval(decorateChoices, 700);


  /* ---------- 버전 표시 + 새 버전 배너(첫 화면 맨 위) ---------- */
  const NB = window.NativeBridge;
  const appVer = () => { try { return NB && NB.appVersion ? +NB.appVersion() : 0; } catch (e) { return 0; } };
  let LATEST = 0;
  try { const lv = NB && NB.latestVersion ? +NB.latestVersion() : 0; if (lv > appVer()) LATEST = lv; } catch (e) {}
  function showVer() {
    const v = appVer(); if (!v) return;
    const top = document.querySelector('header.top'); if (!top) return;
    let el = document.getElementById('ver');
    if (!el) { el = document.createElement('span'); el.id = 'ver'; top.querySelector('h1').appendChild(el); }
    el.textContent = 'v' + v + ' 🔄'; el.title = '업데이트 확인';
    el.onclick = () => { try { if (window.__toast) window.__toast('새 버전 확인 중…'); NB.checkUpdate(); } catch (e) {} };
    try { const pv = +localStorage.getItem('reb_ver') || 0; if (pv && pv < v && window.__toast) window.__toast('✅ v' + v + '로 업데이트됐어요'); localStorage.setItem('reb_ver', v); } catch (e) {}
  }
  function updBanner() {
    const old = document.getElementById('updb');
    const onHome = (document.querySelector('#tabs button.on') || {}).dataset?.v === 'home';
    if (!LATEST || !onHome) { if (old) old.remove(); return; }
    if (old) return;
    const view = document.getElementById('view'); if (!view) return;
    view.insertAdjacentHTML('afterbegin', `<button id="updb">🔄 새 버전 v${LATEST} 나왔어요 · 눌러서 업데이트<small>지금 v${appVer()} · 공부 기록은 그대로 남아요</small></button>`);
    document.getElementById('updb').onclick = () => { try { NB.update(); } catch (e) {} };
  }
  window.__upd = v => { LATEST = +v || 0; updBanner(); };
  /* ---------- 보기 지우기: 답 고르기 전, 아닌 보기를 눌러(또는 옆으로 밀어) 줄 긋기 ---------- */
  const ELIM = {};
  const elHint = () => { try { const n = +localStorage.getItem('reb_elh') || 0; localStorage.setItem('reb_elh', n + 1); return n < 6; } catch (e) { return false; } };
  function decorateElim() {
    if (typeof S === 'undefined' || !S || !S.list) return;
    const q = S.list[S.i], pick = q && S.ans[q.id], ex = S.exam && !S.done;
    const qt = document.querySelector('#view .qtext'); if (!q || !qt || (pick && !ex)) return;
    if (qt.dataset.el === q.id) return;
    const lines = q.x.split('\n'); const idx = lines.findIndex(l => /^\s*①/.test(l)); if (idx < 0) return;
    const ch = [];
    lines.slice(idx).forEach(l => { const m = /^\s*([①②③④⑤])/.exec(l); if (m) ch.push({ n: MK5.indexOf(m[1]) + 1, t: l.trim() }); else if (ch.length) ch[ch.length - 1].t += '\n' + l; });
    if (ch.length !== 5) return;
    const set = ELIM[q.id] = ELIM[q.id] || new Set();
    qt.innerHTML = h(lines.slice(0, idx).join('\n')) + (elHint() ? '<div class="elh">💡 아닌 보기는 눌러서 줄 긋기</div>' : '') +
      ch.map(c => `<div class="elc ${set.has(c.n) ? 'x' : ''}" data-n="${c.n}">${h(c.t)}</div>`).join('');
    qt.dataset.el = q.id;
    const sync = () => document.querySelectorAll('#view .choices button').forEach(b => b.classList.toggle('elx', set.has(+b.dataset.c)));
    const tog = el => { const n = +el.dataset.n; set.has(n) ? set.delete(n) : set.add(n); el.classList.toggle('x', set.has(n)); sync(); };
    qt.querySelectorAll('.elc').forEach(el => {
      let x0 = 0, swiped = false;
      el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; swiped = false; }, { passive: true });
      el.addEventListener('touchend', e => { if (Math.abs(e.changedTouches[0].clientX - x0) > 40) { swiped = true; tog(el); } }, { passive: true });
      el.addEventListener('click', () => { if (swiped) { swiped = false; return; } tog(el); });
    });
    sync();
  }
  setInterval(decorateElim, 400);


  /* ---------- 낯선 용어 풍선말: 앱 어디서든 용어에 점선 밑줄, 누르면 쉬운 설명 ---------- */
  const GL = asset('glossary.json') || {};
  const GK = Object.keys(GL).sort((a, b) => b.length - a.length);
  const GRE = GK.length ? new RegExp('(' + GK.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g') : null;
  const SKIP = new Set(['BUTTON', 'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'svg', 'SUMMARY']);
  function gloss(root) {
    if (!GRE || !root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => {
      for (let e = n.parentElement; e && e !== root.parentElement; e = e.parentElement) { if (SKIP.has(e.tagName) || e.classList.contains('gl') || e.classList.contains('glb') || e.closest('#tabs')) return NodeFilter.FILTER_REJECT; }
      GRE.lastIndex = 0; return GRE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; } });
    const list = []; while (w.nextNode()) list.push(w.currentNode);
    const seen = new Set([...root.querySelectorAll('.gl')].map(e => e.dataset.k));
    list.forEach(n => {
      const f = document.createDocumentFragment(); let last = 0, t = n.nodeValue; GRE.lastIndex = 0; let m;
      while ((m = GRE.exec(t))) {
        if (seen.has(m[1])) continue;
        seen.add(m[1]);
        if (m.index > last) f.appendChild(document.createTextNode(t.slice(last, m.index)));
        const sp = document.createElement('span'); sp.className = 'gl'; sp.dataset.k = m[1]; sp.textContent = m[1]; f.appendChild(sp); last = m.index + m[1].length;
      }
      if (last < t.length) f.appendChild(document.createTextNode(t.slice(last)));
      n.parentNode.replaceChild(f, n);
    });
  }
  let glT = 0;
  new MutationObserver(() => { clearTimeout(glT); glT = setTimeout(() => { gloss(document.getElementById('view')); document.querySelectorAll('.kc').forEach(gloss); }, 120); })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', e => {
    const old = document.querySelector('.glb');
    const g = e.target.closest && e.target.closest('.gl');
    if (old) old.remove();
    if (!g) return;
    e.preventDefault(); e.stopPropagation();
    const b = document.createElement('div'); b.className = 'glb';
    b.innerHTML = `<b>${h(g.dataset.k)}</b>${h(GL[g.dataset.k] || '')}`;
    document.body.appendChild(b); setTimeout(() => b.remove(), 9000);
  }, true);

  /* ---------- 공부 기록: 언제, 어디서(어떤 학습), 어느 과목·문제를 풀었나 ---------- */
  const LOGK = 'reb_log';
  function logAnswer(q, c) {
    try {
      const l = st(LOGK, []); l.push({ t: Date.now(), id: q.id, c, ok: isRight(q, c), w: (S && S.title) || '', f: (S && S.from) || '' });
      if (l.length > 5000) l.splice(0, l.length - 5000); put(LOGK, l);
    } catch (e) {}
  }
  function logCard(sub) {
    const l = st(LOGK, []).slice().reverse(); const by = {};
    l.filter(x => BYID[x.id] && (sub == null || BYID[x.id].s === sub)).forEach(x => { const d = new Date(x.t); const k = `${d.getMonth() + 1}/${d.getDate()} (${'일월화수목금토'[d.getDay()]})`; (by[k] = by[k] || []).push(x); });
    const cf = conf(); let lj = {}; try { lj = LJ.d || {}; } catch (e) {}
    const days = Object.keys(by).slice(0, 14);
    return `<div class="card" id="logc"><h2>🗂 공부 기록</h2>
      <div class="chips" id="logf" style="margin:6px 0"><span class="chip ${sub == null ? '' : 'g'}" data-s="">전체</span>${SUBS.map((n, i) => `<span class="chip ${sub === i ? '' : 'g'}" data-s="${i}">${n}</span>`).join('')}</div>
      <div class="slog">${days.length ? days.map(k => { const xs = by[k], ok = xs.filter(x => x.ok).length;
        const d0 = new Date(xs[0].t); const dk = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`; const L = lj[dk];
        return `<div class="d"><span>${k}</span><span class="muted">${xs.length}문제 · 정답 ${ok}${L && L.lsec ? ` · 🎧 ${Math.round(L.lsec / 60)}분` : ''}</span></div>` +
          xs.slice(0, 40).map(x => { const q = BYID[x.id], d = new Date(x.t);
            return `<div class="it" data-id="${x.id}"><span>${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</span><div class="g">${x.ok === true ? '✅' : x.ok === false ? '❌' : '·'} ${SUBS[q.s]} · 제${q.n}회 ${CT[q.ct]} ${q.no}번 ${cf[x.id] === 'unsure' ? '🤔' : cf[x.id] === 'guess' ? '🎲' : ''}<div class="sm">${h(x.w || '')} · ${h(q.t)}</div></div></div>`; }).join(''); }).join('')
        : '<div class="muted" style="margin-top:8px">아직 기록이 없어요. 문제를 풀면 여기에 쌓여요.</div>'}</div></div>`;
  }
  function drawLog(sub) {
    const old = $('#logc'); const html = logCard(sub);
    if (old) old.outerHTML = html; else { const first = document.querySelector('#view .card'); if (first) first.insertAdjacentHTML('beforebegin', html); else return; }
    $('#logf').onclick = e => { const c = e.target.closest('[data-s]'); if (c) drawLog(c.dataset.s === '' ? null : +c.dataset.s); };
    $("#logc .slog").onclick = e => { const it = e.target.closest('[data-id]'); if (it && !e.target.closest('.gl')) startQuiz([BYID[it.dataset.id]], { from: 'wrong', title: '기록에서 다시 보기' }); };
  }


  /* ---------- 🚩 신고: 문제 글이 깨졌거나 정답·해설이 이상할 때 → GitHub 이슈로 보내면 자동으로 고쳐 새 버전 ---------- */
  const REASONS = ['문제 글이 깨지거나 잘렸어요', '보기(①~⑤)가 빠졌거나 틀려요', '정답이 틀린 것 같아요', '해설이 이상하거나 부족해요', '기타'];
  function report(q) {
    const el = document.createElement('div'); el.className = 'kc';
    el.innerHTML = `<div><div class="row"><h3 class="grow">🚩 문제 신고</h3><button class="btn sm" id="kcx">닫기</button></div>
      <div class="muted">제${q.n}회 ${CT[q.ct]} ${q.no}번 · ${SUBS[q.s]}. 보내면 시험지 원본으로 문제를 다시 옮겨 적고 해설을 새로 만들어 새 버전에 넣어요.</div>
      ${REASONS.map((r, i) => `<label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input type="checkbox" data-r="${i}" ${i === 0 ? 'checked' : ''}> ${r}</label>`).join('')}
      <textarea id="rpm" rows="3" style="width:100%;box-sizing:border-box;border-radius:10px;padding:8px;border:1px solid var(--line,#ddd);background:transparent;color:inherit" placeholder="어디가 이상한지 적어 주면 더 정확히 고쳐요 (선택)"></textarea>
      <button class="btn pri full" id="rps" style="margin-top:10px">보내기 (GitHub에서 '제출' 한 번)</button></div>`;
    el.onclick = e => {
      if (e.target === el || e.target.id === 'kcx') return el.remove();
      if (e.target.id !== 'rps') return;
      const rs = [...el.querySelectorAll('[data-r]')].map(c => `- [${c.checked ? 'x' : ' '}] ${REASONS[+c.dataset.r]}`).join('\n');
      const body = `문항: ${q.id}\n제${q.n}회(${q.y}) ${CT[q.ct]} ${q.no}번 · ${SUBS[q.s]} · ${q.t}\n\n${rs}\n\n메모: ${$('#rpm').value || '(없음)'}\n\n--- 지금 앱에 보이는 문제 ---\n${q.x.slice(0, 1200)}`;
      const url = 'https://github.com/huhsj4141-afk/realtor-ox-app/issues/new?title=' + encodeURIComponent(`[신고] ${q.id} ${SUBS[q.s]} ${q.no}번`) + '&body=' + encodeURIComponent(body);
      const l = st('reb_reports', []); l.push({ t: Date.now(), id: q.id }); put('reb_reports', l);
      el.remove(); window.open(url, '_blank');
      if (window.__toast) window.__toast('GitHub 화면에서 초록색 Submit(제출)을 눌러 주세요');
    };
    document.body.appendChild(el);
  }

  /* ---------- 감싸기 ---------- */
  const wrap = (name, after) => {
    const f = window[name]; if (typeof f !== 'function' || f.__app) return;
    const g = function () { const r = f.apply(this, arguments); try { after(); } catch (e) { console.log('app.js', name, e); } return r; };
    g.__app = 1; window[name] = g;
    try { eval(name + ' = window.' + name); } catch (e) {}
  };
  window.__unsureIds = unsureIds;
  // AI 해설을 만드는 동안 몇 초째인지 보여 주기 (멈춘 게 아니라는 걸 알 수 있게)
  let aiT0 = 0;
  setInterval(() => {
    const el = document.getElementById('aitxt');
    if (!el) { aiT0 = 0; return; }
    if (!aiT0) aiT0 = Date.now();
    let w = el.querySelector('.aiw'); if (!w) { el.insertAdjacentHTML('beforeend', '<div class="aiw muted" style="font-size:13px;margin-top:4px"></div>'); w = el.querySelector('.aiw'); }
    w.textContent = `⏳ ${Math.round((Date.now() - aiT0) / 1000)}초째 · 인터넷으로 만드는 중이라 보통 10~40초 걸려요`;
  }, 1000);
  window.addEventListener('load', () => setTimeout(() => {
    wrap('quiz', () => { decorateQuiz(); decorateChoices(); decorateElim(); });
    const _rec = window.record; window.record = function (q, c) { const r = _rec.apply(this, arguments); logAnswer(q, c); return r; }; wrap('home', decorateHome); wrap('setup', decorateSetup); wrap('wrong', decorateWrong);
    const v = document.querySelector('#tabs button.on')?.dataset.v;
    if (v === 'home') decorateHome();
  }, 50));
})();
