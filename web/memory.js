/* 필수 암기 샘플: 원문 연결 → 회상 연습 → 개인별 복습. 외부 API 없이 동작. */
(function (root) {
  'use strict';
  const DAY = 86400000, KEY = 'reb_memory_v1';
  // 간단한 개인별 간격 조정. FSRS 구현이라고 표시하지 않아요.
  function schedule(previous, rating, now) {
    const p = previous || {}, failures = p.failures || 0;
    if (!['again', 'hard', 'good'].includes(rating)) throw Error('잘못된 평가');
    const old = p.interval || 1;
    const interval = rating === 'again' ? 0 : rating === 'hard' ? Math.max(.25, old * .6) : Math.min(180, p.reviews ? old * (failures ? 1.7 : 2.3) : 1);
    const next = rating === 'again' ? now + 10 * 60000 : now + interval * DAY;
    // 예정일 전 미리보기로 같은 날 간격이 계속 늘어나는 것을 막아요.
    if (rating === 'good' && p.due > now) return { ...p, last: now };
    return { ...p, due: next, interval, last: now, reviews: (p.reviews || 0) + 1,
      failures: failures + (rating === 'again' ? 1 : 0), level: rating === 'good' ? Math.min(2, (p.level || 0) + 1) : 0 };
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { schedule }; return; }
  const cards = root.MEMORY_SAMPLES || [];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function state() { try { const v=JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v==='object' && !Array.isArray(v) ? v : {}; } catch (_) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (_) { root.__toast?.('암기 기록을 저장하지 못했어요.'); return false; } }
  function dueCards(now = Date.now()) { const s = state(); return cards.filter(c => !s[c.id] || s[c.id].due <= now); }
  let overlay = null, session = null;
  function stopAudio() { try { root.__tts?.stop(); } catch (_) {} }
  function close() { stopAudio(); overlay?.remove(); overlay = null; session = null; }
  function finish() {
    const done = session?.onDone; close(); if (done) done();
  }
  function next() {
    if (!session) return;
    session.i++;
    if (session.i >= session.list.length) {
      overlay.innerHTML = '<section class="mm-panel"><p class="mm-label">오늘의 암기</p><h2>이번 암기를 마쳤어요</h2><p>몰랐던 카드는 10분 뒤 다시 복습해요.</p><button class="mm-primary" data-a="finish">돌아가기</button></section>';
      return;
    }
    show();
  }
  function dateLabel(ts) {
    if (!ts) return '처음 연습하는 카드예요';
    if (ts <= Date.now()) return '지금 복습할 때예요';
    return new Date(ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function sourceView(card) {
    const source = card.source;
    const panel = overlay.querySelector('.mm-source');
    panel.hidden = !panel.hidden;
    if (!panel.hidden) panel.innerHTML = '<b>' + esc(source.label) + '</b><p class="mm-pre">' + esc(source.question) + '</p><p><b>암기사항을 뽑은 근거</b></p><blockquote>' + esc(source.quote) + '</blockquote><p>앱에 저장된 해설에서 골라 만든 샘플입니다.</p>';
  }
  function show() {
    stopAudio(); const card = session.list[session.i], p = state()[card.id] || {}, mode = session.mode || (p.level === 2 ? 'apply' : p.level === 1 ? 'write' : 'cloze');
    session.mode = mode; session.revealed = false; session.rated = false;
    overlay.innerHTML = '<section class="mm-panel"><div class="mm-top"><span class="mm-label">필수 암기 · 샘플 ' + (session.i + 1) + '/' + session.list.length + '</span><button class="mm-quiet" data-a="close">닫기</button></div>' +
      '<h2>' + esc(card.title) + '</h2><p class="mm-sub">' + esc(card.source.label) + ' · ' + esc(card.kind) + '</p>' +
      '<div class="mm-modes">' + [['cloze','빈칸'],['write','직접 답하기'],['apply','기출 적용']].map(([k,v]) => '<button class="' + (mode === k ? 'selected' : '') + '" data-mode="' + k + '">' + v + '</button>').join('') + '</div>' +
      '<p class="mm-prompt">' + esc(mode === 'cloze' ? card.cloze : mode === 'write' ? card.prompt : card.application) + '</p>' +
      (mode === 'write' ? '<label>답을 떠올려 적어보세요<input id="mm-input" autocomplete="off" placeholder="말로 답한 뒤 정답을 확인해도 돼요"></label>' : '') +
      (mode === 'apply' ? '<button class="mm-quiet" data-a="quiz">원래 기출 풀기</button>' : '') +
      '<button class="mm-primary" data-a="reveal">정답 확인</button><div class="mm-answer" hidden></div>' +
      '<div class="mm-ratings" hidden><p>답을 보기 전에 얼마나 기억했나요?</p><div><button data-rating="again">몰랐음</button><button data-rating="hard">헷갈림</button><button data-rating="good">기억남</button></div><p class="mm-sub">기출을 맞혔어도 암기 완료로 처리하지 않아요.</p></div>' +
      '<p class="mm-feedback" role="status"></p><button class="mm-primary" data-a="next" hidden>다음 카드</button>' +
      '<div class="mm-footer"><button class="mm-quiet" data-a="source">출처 문제·해설</button><button class="mm-quiet" data-a="audio">질문 듣기</button></div><div class="mm-source" hidden></div>' +
      '<p class="mm-sub">다음 복습: ' + esc(dateLabel(p.due)) + '</p></section>';
  }
  function open(options = {}) {
    close(); const list = options.all ? cards.slice() : dueCards();
    session = { list, i: 0, onDone: options.onDone };
    overlay = document.createElement('div'); overlay.className = 'mm-overlay'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal','true'); overlay.setAttribute('aria-label','필수 암기');
    overlay.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      const card = session.list[session.i];
      if (b.dataset.mode) { session.mode = b.dataset.mode; show(); return; }
      if (b.dataset.rating) {
        if (!session.revealed || session.rated) return;
        const s = state(), result = schedule(s[card.id], b.dataset.rating, Date.now()); s[card.id] = result;
        if (!save(s)) { overlay.querySelector('.mm-feedback').textContent = '기록을 저장하지 못했어요. 저장 공간을 확인해 주세요.'; return; }
        session.rated = true; overlay.querySelectorAll('[data-rating]').forEach(x => x.disabled = true);
        overlay.querySelector('.mm-feedback').textContent = '다음 복습: ' + dateLabel(result.due) + ' · 현재 연습 단계: ' + ['빈칸','직접 답하기','기출 적용'][result.level || 0];
        overlay.querySelector('[data-a="next"]').hidden = false; return;
      }
      switch (b.dataset.a) {
        case 'close': close(); break;
        case 'finish': finish(); break;
        case 'next': delete session.mode; next(); break;
        case 'source': sourceView(card); break;
        case 'reveal': {
          session.revealed = true; const a = overlay.querySelector('.mm-answer'); a.hidden = false;
          a.innerHTML = '<b>' + esc(session.mode === 'apply' ? card.applicationAnswer : card.answer) + '</b><p>' + esc(card.why) + '</p><p class="mm-trap">함정: ' + esc(card.trap) + '</p>' +
            (session.mode === 'write' && overlay.querySelector('#mm-input')?.value ? '<p>내 답: ' + esc(overlay.querySelector('#mm-input').value) + '</p>' : '');
          overlay.querySelector('.mm-ratings').hidden = false; b.hidden = true; break;
        }
        case 'quiz': {
          const q = typeof BYID !== 'undefined' && BYID[card.source.id];
          if (q && typeof startQuiz === 'function') { close(); if (root.COURSE) root.COURSE.active = false; startQuiz([q], { from:'home', title:'필수 암기 · 기출 적용' }); }
          else { const p=overlay.querySelector('.mm-source'); p.hidden=false; p.textContent=card.source.question + '\n정답: ' + card.source.correct; }
          break;
        }
        case 'audio': {
          if (!root.__tts) { overlay.querySelector('.mm-feedback').textContent='앱에서 설정한 음성으로 들을 수 있어요.'; return; }
          b.disabled=true;
          try { await root.__tts.speak([{text:card.prompt}], {}); } catch (err) { overlay?.querySelector('.mm-feedback') && (overlay.querySelector('.mm-feedback').textContent = err.code === 'viewer_stopped' ? '' : '음성 설정을 확인해 주세요.'); } finally { b.disabled=false; }
          break;
        }
      }
    };
    document.body.appendChild(overlay);
    if (list.length) show(); else overlay.innerHTML='<section class="mm-panel"><h2>지금 복습할 카드가 없어요</h2><p>예정 시간이 되면 다시 나타나요.</p><button class="mm-primary" data-a="finish">돌아가기</button></section>';
  }
  function wrong(questionId, correct) {
    if (correct !== false) return;
    const related = cards.filter(c=>c.source.id === questionId); if (!related.length) return;
    const s = state(); related.forEach(c=>{s[c.id]=schedule(s[c.id], 'again', Date.now()); s[c.id].due=Date.now();}); save(s);
  }
  root.Memory = { open, dueCount:()=>dueCards().length, wrong, cards };
  const style=document.createElement('style');style.textContent=`
  .mm-overlay{position:fixed;inset:0;z-index:300;background:#1118;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;box-sizing:border-box;color:var(--ink,#182434);font-family:system-ui,sans-serif}
  .mm-panel{background:var(--card,#fff);border-radius:22px;padding:24px;width:100%;max-width:540px;box-sizing:border-box;box-shadow:0 15px 60px #0003}.mm-panel h2{font-size:24px;line-height:1.4;margin:18px 0 6px}.mm-top,.mm-footer{display:flex;justify-content:space-between;gap:12px;align-items:center}.mm-label{font-size:13px;color:var(--pri,#2457c5);font-weight:700}.mm-sub{font-size:13px;color:var(--sub2,#6b7385);line-height:1.6}.mm-panel button{font:inherit;cursor:pointer;border:1px solid #b9c8dd;border-radius:12px;padding:12px;background:var(--card,#fff);color:inherit;min-height:44px}.mm-panel button:disabled{opacity:.5;cursor:default}.mm-panel .mm-primary{display:block;width:100%;background:var(--pri,#2457c5);color:white;border:0;font-weight:700;margin:16px 0}.mm-panel .mm-quiet{background:transparent;border:0;font-size:13px;padding:8px}.mm-modes{display:flex;gap:6px;margin-top:22px}.mm-modes button{flex:1;font-size:13px}.mm-modes .selected{border-color:var(--pri,#2457c5);color:var(--pri,#2457c5);font-weight:700}.mm-prompt{font-size:21px;line-height:1.7;padding:16px 0;white-space:pre-wrap}.mm-panel input{display:block;box-sizing:border-box;width:100%;margin:10px 0 20px;padding:14px;border:1px solid #aabbd0;border-radius:10px;font:inherit;background:transparent;color:inherit}.mm-answer{background:#16804a12;border-left:3px solid #16804a;padding:16px;line-height:1.7}.mm-trap{font-size:14px}.mm-ratings>div{display:flex;gap:6px}.mm-ratings button{flex:1}.mm-feedback{font-size:14px;color:var(--pri,#2457c5);line-height:1.7}.mm-source{margin-top:16px;font-size:14px;line-height:1.7}.mm-pre{white-space:pre-wrap}.mm-source blockquote{margin:8px 0;padding:12px;background:#16804a12}.mm-panel [hidden]{display:none!important}
  `;document.head.appendChild(style);
})(typeof window !== 'undefined' ? window : globalThis);
