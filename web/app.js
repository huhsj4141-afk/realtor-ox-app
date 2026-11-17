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
    OXD.forEach((tr, ti) => tr.items.forEach((it, i) => { if (it.t === theme) ox.push({ s: it.s, o: it.o, e: OXE[`${ti}_${i}`] || '' }); }));
    const el = document.createElement('div'); el.className = 'kc';
    el.innerHTML = `<div><div class="row"><h3 class="grow">📇 ${h(theme)}</h3><button class="btn sm" id="kcx">닫기</button></div>
      <div class="muted">${qs.length ? `기출 ${qs.length}회 출제 · 빈출 ${hotStars(theme)}` : ''}</div>
      ${concepts.length ? `<h4 style="margin:14px 0 4px">핵심 정리</h4><ul style="padding-left:18px;margin:0">${concepts.map(c => `<li>${h(c)}</li>`).join('')}</ul>` : ''}
      ${ox.length ? `<h4 style="margin:16px 0 4px">OX 암기 카드 <span class="muted" style="font-weight:400;font-size:13px">눌러서 정답 보기</span></h4>${ox.slice(0, 12).map(x => `<div class="fc"><div>${h(x.s)}</div><div class="a"><span class="o" style="color:${x.o ? '#16a34a' : '#dc2626'}">${x.o ? 'O' : 'X'}</span>${h(x.e)}</div></div>`).join('')}` : ''}
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
    if (row && !document.getElementById('qk')) {
      row.insertAdjacentHTML('beforeend', '<button class="btn sm" id="qk">📇 핵심 카드</button>');
      document.getElementById('qk').onclick = () => card(q.t);
    }
    const ex = S.exam && !S.done, pick = S.ans[q.id];
    const fb = document.querySelector('#view .fb');
    if (pick && !ex && fb && !document.querySelector('.conf')) {
      const cur = conf()[q.id];
      fb.insertAdjacentHTML('afterend', `<div class="conf"><span class="lb">이 문제, 얼마나 확신했나요? (헷갈림·찍음은 복습에 다시 나와요)</span>
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
    cleanCards(['해설 미리 받기']);
    const hero = document.querySelector('#view .card');
    if (hero && !document.querySelector('.wk')) hero.insertAdjacentHTML('beforeend', weekStrip());
    if (!$('#rdcard')) {
      const lv = [...document.querySelectorAll('#view .card')].find(c => c.textContent.includes('과목별 수준'));
      (lv || hero)?.insertAdjacentHTML('afterend', roundCard());
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
    const first = document.querySelector('#view .card');
    const un = unsureIds().length;
    if (first && un && !$('#wun')) {
      first.insertAdjacentHTML('beforeend', `<button class="btn full" id="wun" style="margin-top:10px">🤔 헷갈렸던 문제 ${un}개 다시 풀기</button>`);
      $('#wun').onclick = () => startQuiz(shuffle(unsureIds().map(k => BYID[k])), { from: 'wrong', title: '헷갈렸던 문제' });
    }
  }

  /* ---------- 감싸기 ---------- */
  const wrap = (name, after) => {
    const f = window[name]; if (typeof f !== 'function' || f.__app) return;
    const g = function () { const r = f.apply(this, arguments); try { after(); } catch (e) { console.log('app.js', name, e); } return r; };
    g.__app = 1; window[name] = g;
    try { eval(name + ' = window.' + name); } catch (e) {}
  };
  window.__unsureIds = unsureIds;
  window.addEventListener('load', () => setTimeout(() => {
    wrap('quiz', decorateQuiz); wrap('home', decorateHome); wrap('setup', decorateSetup); wrap('wrong', decorateWrong);
    const v = document.querySelector('#tabs button.on')?.dataset.v;
    if (v === 'home') decorateHome();
  }, 50));
})();
