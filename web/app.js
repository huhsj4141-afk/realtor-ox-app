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
    #ver{flex:none;font:inherit;font-size:13px;font-weight:600;color:var(--pri);background:var(--pri2);border:0;border-radius:999px;padding:6px 12px;cursor:pointer}#updb{display:block;width:100%;margin:0 0 12px;padding:14px 16px;border:0;border-radius:14px;background:var(--pri);color:#fff;font:inherit;font-size:17px;font-weight:700;text-align:left;cursor:pointer;box-shadow:0 4px 14px rgba(37,99,235,.35)}#updb small{display:block;font-size:12.5px;font-weight:500;opacity:.85;margin-top:2px}
    .qno{font-size:12.5px;opacity:.55;align-self:center;margin-left:auto}
    .fb.top small,.fb.top span{font-size:13px;font-weight:600} .fb.top{font-size:18px;font-weight:800;padding:12px 14px;margin:12px 0 10px;border-radius:12px}
    .chx:not(.ans):not(.mine){opacity:.82} .chx.ans{border-width:2px} .chx .bd{font-size:11px}
    .conf{display:flex;gap:6px;align-items:center;flex-wrap:nowrap} .conf .lb{flex:none!important;margin-right:4px}
    .svd{display:inline-block;font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 7px;margin-left:6px;vertical-align:2px;background:rgba(22,163,74,.18);color:#16a34a} .svd.no{background:rgba(148,163,184,.2);color:#94a3b8} .bigai .svd{background:rgba(255,255,255,.25);color:#fff}
    nav.tabs button{position:relative} nav.tabs button b{width:56px;margin:0 auto;border-radius:14px} nav.tabs button.on b{background:var(--pri2)} nav.tabs button.on::before{content:'';position:absolute;top:0;left:28%;right:28%;height:3px;border-radius:0 0 3px 3px;background:var(--pri)}
    #hdrb{display:flex;gap:6px;margin-left:auto;margin-right:6px} #say,#padb,#nzb{position:relative;width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:17px;cursor:pointer;padding:0} header.top{position:sticky;top:0;z-index:50;background:var(--bg)} #say.on{background:#ef4444;color:#fff;border-color:#ef4444} @keyframes sayp{50%{box-shadow:0 0 0 10px rgba(239,68,68,.15)}} #moreSay{display:none}
        #padb.has::after{content:'';position:absolute;top:4px;right:4px;width:9px;height:9px;border-radius:50%;background:#facc15}
    #pad{position:fixed;left:0;right:0;bottom:0;height:56vh;z-index:80;background:var(--card);border-top:1px solid var(--line);border-radius:18px 18px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.4);display:flex;flex-direction:column;transform:translateY(105%);transition:transform .18s}
    #pad.show{transform:none}
    #pad .ph{display:flex;align-items:center;gap:6px;padding:8px 10px 4px} #pad .ph b{font-size:14px} #pad .sp{flex:1}
    #pad button{font:inherit;font-size:13.5px;border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:10px;padding:6px 10px;cursor:pointer}
    #pad button.on{background:var(--pri2);color:var(--pri);border-color:var(--pri)} #padx{font-size:16px!important}
    #pad .pdraw{flex:1;display:flex;flex-direction:column;min-height:0} #pad .pt{display:flex;gap:6px;padding:4px 10px 6px;align-items:center;flex-wrap:wrap}
    #pad .pk{min-width:38px;font-size:16px!important} #pad button:disabled{opacity:.35} #padw{flex:1 1 40px;min-width:40px;max-width:150px;accent-color:var(--pri)} #padwv{font-style:normal;font-size:12px;color:var(--sub2,#9aa3b5);min-width:14px}
    #pad .pc{width:26px;height:26px;flex:none;padding:0!important;border-radius:50%!important;background:var(--c)!important;border:2px solid transparent!important} #pad .pc.on{border-color:var(--pri)!important;box-shadow:0 0 0 2px var(--card) inset}
    #pad .pcw{flex:1;min-height:0;position:relative;margin:0 10px 10px} #pad .pzm{position:absolute;right:6px;bottom:6px;display:flex;gap:4px;opacity:.85} #pad .pzm button{padding:4px 9px;background:var(--card);font-size:13px} #padc{position:absolute;inset:0;width:100%;height:100%;display:block;margin:0;border-radius:12px;touch-action:none;background-color:var(--bg);}
    #padt{flex:1;margin:4px 10px 10px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:inherit;font-size:16px;line-height:1.6;padding:12px;resize:none}
    .rdg{background:rgba(250,204,21,.32)!important;box-shadow:0 0 0 3px #facc15,0 0 18px rgba(250,204,21,.45)!important;border-radius:8px;font-weight:700!important;color:var(--ink)!important;transition:background .2s,box-shadow .2s} .rdg *{color:inherit}
    .thg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px} .thm{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px;border:1.5px solid var(--line);border-radius:14px;background:transparent;color:var(--ink);font:inherit;cursor:pointer} .thm.on{border-color:var(--pri);box-shadow:0 0 0 2px var(--pri2)} .thm .sw{position:relative;width:46px;height:30px;border-radius:9px;overflow:hidden;border:1px solid rgba(128,128,128,.3)} .thm .sw i{position:absolute;left:6px;top:6px;width:22px;height:18px;border-radius:5px} .thm .sw b{position:absolute;right:6px;bottom:6px;width:12px;height:12px;border-radius:50%} .thm .nm{font-size:13.5px;font-weight:700} .thm small{font-size:11px;color:var(--sub)}
    #nzb.on{background:var(--pri2);border-color:var(--pri)} .nzp{position:fixed;top:64px;right:10px;left:10px;max-width:420px;margin-left:auto;z-index:90;background:var(--card);border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 30px rgba(0,0,0,.35);padding:12px} .nzp .nzh{display:flex;align-items:center;margin-bottom:8px} .nzp .nzh b{flex:1;font-size:15px} .nzp button{font:inherit;color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:12px;padding:10px 6px;cursor:pointer} .nzp .nzg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px} .nzp .nzg button{font-size:13px;white-space:nowrap;padding:11px 2px} header.top h1{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:clamp(15px,4.6vw,22px)} .nzp .nzg button.on{background:var(--pri2);border-color:var(--pri);color:var(--pri);font-weight:700} .nzp .nzv{display:flex;align-items:center;gap:10px;margin:12px 2px 10px;font-size:13px;color:var(--sub)} .nzp .nzv input{flex:1;accent-color:var(--pri)} .nzp .nzoff{width:100%;font-weight:700} #nzx{padding:4px 10px!important}
    #beg{margin-top:10px} #beg.begon{border:1.5px solid var(--warn);color:var(--warn);font-weight:700} .begc{margin-top:8px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--bg)} .begc .bgh{margin:14px 0 6px;font-size:15.5px;color:var(--pri)} .begc .bgh:first-child{margin-top:2px} .begc .bgp{margin:4px 0;line-height:1.7} .begc .bgl{margin:3px 0 3px 4px;line-height:1.65} .begc #begSay{margin-top:12px}
    .aiw::before{content:"";display:block;height:6px;margin:2px 0 8px;border-radius:3px;background:linear-gradient(90deg,var(--pri2) 0%,var(--pri) 40%,var(--pri2) 80%);background-size:250% 100%;animation:aiwbar 1.2s linear infinite} @keyframes aiwbar{from{background-position:100% 0}to{background-position:-150% 0}}
    .xhid{display:none!important} .xtabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin:12px 0 0;padding:4px;border-radius:14px;background:var(--bg);border:1px solid var(--line)}
    .xtabs button{font:inherit;font-size:14px;font-weight:700;padding:11px 2px;border:0;border-radius:10px;background:transparent;color:var(--sub);cursor:pointer;white-space:nowrap}
    .xtabs button.on{background:var(--pri);color:#fff} .xtabs button.warn:not(.on){color:var(--warn)} .xtabs .xs{font-style:normal;font-size:11px;opacity:.85}
    .xpanel{margin-top:6px} .xpanel #moreBox:empty,.xpanel #begBox:empty{display:none}
    .qtb.q5{grid-template-columns:repeat(5,1fr)} .qtb{margin-top:14px!important}
    details.fold{padding:0!important;overflow:hidden} details.fold>summary{list-style:none;cursor:pointer;padding:15px 16px;font-weight:800;font-size:16px;display:flex;align-items:center} details.fold>summary::-webkit-details-marker{display:none} details.fold>summary::after{content:'⌄';margin-left:auto;color:var(--sub);transition:transform .2s} details.fold[open]>summary::after{transform:rotate(180deg)} details.fold>.foldin{padding:0 16px 14px}
    #view .card h2,#view .card h3{font-size:16.5px;font-weight:800;letter-spacing:-.2px}
    .glb{position:fixed;left:12px;right:12px;bottom:84px;z-index:150;background:#1e1b4b;color:#fff;border-radius:14px;padding:12px 14px;font-size:15px;line-height:1.55;box-shadow:0 8px 24px rgba(0,0,0,.3)}
    .glb b{color:#c4b5fd;margin-right:6px}
    .slog{font-size:14px;display:block} .slog .d{font-weight:700;margin:14px 0 4px;display:flex;justify-content:space-between}
    .slog .it{display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--line,#eee);align-items:center}
    .slog .it span:first-child{opacity:.6;width:40px;flex:none} .slog .it .g{flex:1} .slog .it .sm{font-size:12px;opacity:.65}
    /* 문제 화면 정리: 큰 주요 버튼 + 작은 도구 줄 */
    .qtb{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px;opacity:.85}
    .qtb>*{display:flex!important;flex-direction:row;align-items:center;justify-content:center;gap:4px;padding:6px 2px!important;font-size:12.5px!important;min-height:36px;border-radius:12px!important;text-decoration:none;text-align:center;line-height:1.2}
    .qtb .ic{font-size:14px}
    .bigai{display:block;width:100%;margin-top:12px;padding:15px!important;font-size:17px!important;font-weight:700;border-radius:14px!important}
    .qmeta{font-size:12.5px;opacity:.65;margin:-2px 0 8px}
    .conf{margin-top:12px} .conf .lb{font-size:12.5px}
    .conf button{padding:7px 4px;font-size:13.5px}
    #more{margin-top:10px}
    .sit{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .hday{font-size:12.5px;font-weight:700;color:var(--sub2,#9aa3b5);margin:12px 0 4px} .hrow{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:9px 4px;border:0;border-bottom:1px solid var(--line);background:transparent;color:inherit;font:inherit} .hrow span{flex:1;min-width:0;display:flex;flex-direction:column} .hrow small{color:var(--sub2,#9aa3b5);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .hrow i{font-style:normal;font-size:12px;color:var(--sub2,#9aa3b5)} .hrow>b{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:13px;flex:none} .hok{background:#16a34a22;color:#16a34a} .hno{background:#ef444422;color:#ef4444} .hun{background:var(--line)}
    .lvb{display:flex;align-items:center;gap:10px;width:100%;margin-top:10px;padding:8px 10px;border-radius:12px;border:1px solid var(--line);background:transparent;color:inherit;text-align:left}
    .lvn{flex:none;font-weight:800;font-size:13px;padding:4px 8px;border-radius:999px;background:var(--pri);color:#fff}
    .lvt{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0} .lvt b{font-size:13px} .lvt small,.lvbig small{font-size:11.5px;color:var(--sub2,#9aa3b5)} .lvg{font-size:18px}
    .lvt i,.lvbig i{display:block;height:6px;border-radius:3px;background:var(--line);overflow:hidden} .lvt em,.lvbig em{display:block;height:100%;background:linear-gradient(90deg,var(--pri),#22c55e);border-radius:3px}
    .lvbig{display:flex;align-items:center;gap:12px;margin:6px 0 12px} .lvbig .lvn{font-size:16px;padding:8px 12px} .lvbig>div{flex:1;display:flex;flex-direction:column;gap:4px}
    .pred{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px} .pr{border:1px solid var(--line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:2px} .pr .hok,.pr .hno{font-weight:800;font-size:18px;background:none} .pr small{font-size:12px;color:var(--sub2,#9aa3b5)}
    .bdg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px} .bdg>div{border:1px solid var(--line);border-radius:12px;padding:8px 6px;text-align:center;opacity:.45} .bdg>div.on{opacity:1;border-color:var(--pri)} .bdg b{display:block;font-size:24px} .bdg span{display:block;font-size:12.5px;font-weight:700} .bdg small{display:block;font-size:10.5px;color:var(--sub2,#9aa3b5);line-height:1.3;margin-top:2px}
    .achpop{position:fixed;inset:0;z-index:9998;display:grid;place-items:center;background:rgba(0,0,0,.35);animation:apf .2s} .achpop>div{background:var(--card);color:var(--ink);border-radius:18px;padding:22px 24px;text-align:center;max-width:300px;display:flex;flex-direction:column;gap:8px;animation:app .35s cubic-bezier(.2,1.4,.4,1)} .achpop b{font-size:20px} .achpop span{color:var(--sub2,#9aa3b5);font-size:14px} .achpop button{margin-top:6px;padding:10px;border-radius:12px;border:0;background:var(--pri);color:#fff;font-weight:700}
    @keyframes apf{from{opacity:0}} @keyframes app{from{transform:scale(.6);opacity:0}}
    .qdock #qf,.qdock #qs{flex:1;font-size:17px}
    .lgue{font-size:12.5px;margin-top:8px} .hero .lgue .hok{color:#bbf7d0} .hero .lgue .hno{color:#fecaca} #ftc{padding:6px 10px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-weight:700;font-size:13px}
    #pscore{display:flex;flex-direction:column;align-items:flex-start;gap:0;padding:2px 10px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);min-width:0;line-height:1.25}
    #pscore small{font-size:10.5px;color:var(--sub2,#9aa3b5)} #pscore span{font-size:13.5px;white-space:nowrap} #pscore b{font-size:16px} #pscore b.ok{color:#16a34a} #pscore b.no{color:#ef4444}
    #pscore i{font-style:normal;font-size:10.5px;margin-left:2px} #pscore i.up{color:#16a34a} #pscore i.dn{color:#ef4444}
    #pscore.flash{animation:psf .9s} @keyframes psf{0%{transform:scale(1)}20%{transform:scale(1.08);box-shadow:0 0 0 4px rgba(34,197,94,.25)}100%{transform:scale(1)}}
    .qdock{display:flex;flex-direction:column-reverse;position:fixed;left:0;right:0;bottom:calc(64px + env(safe-area-inset-bottom,0px));z-index:30;padding:8px 10px;background:var(--bg);border-top:1px solid var(--line)}
    .qdock .qd{display:flex;gap:8px;width:100%;max-width:640px;margin:0 auto} .qdock .qd .btn{margin:0;height:48px} .qdock .qdi{flex:none;width:58px;padding:0;font-size:10.5px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;line-height:1.15;white-space:nowrap;overflow:hidden}
    .qdock .qdi .ic{margin:0;font-size:19px;line-height:1} .qdock #qn{flex:1;font-size:17px}
    .qdock .qmore{display:none;width:100%;max-width:640px;margin:0 auto 8px} .qdock.open .qmore{display:block} .qdock .qmore .qtb{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:0}
    body.qdocked #view{padding-bottom:84px}
    .fbk{display:block;width:100%;margin-top:8px;font-size:14px} .xmore small{font-weight:400;opacity:.7;font-size:12px}
    .hero .lvb{border-color:rgba(255,255,255,.3)} .hero .lvt small{color:rgba(255,255,255,.8)} .hero .lvt i{background:rgba(255,255,255,.25)} .hero .lvn{background:#fff;color:var(--pri)}
    #mgr.inhero{margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.25)} #mgr .mgh{font-weight:700;font-size:14px;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px} #mgr .mgh small{flex-basis:100%;font-weight:400;font-size:11.5px;opacity:.8}
    #mgr.inhero .fixl button{border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:inherit;font-size:13.5px;padding:8px 10px} #mgr.inhero .fixl button i{color:inherit}
    #mgr.inhero details summary{font-size:13px;opacity:.9} #mgr.inhero .sit button{background:rgba(255,255,255,.12);color:inherit;border-color:rgba(255,255,255,.3)}
    .csheet>div{max-height:88vh} .cso{display:flex;gap:12px;align-items:center;width:100%;text-align:left;padding:12px;margin-top:8px;border-radius:14px;border:1px solid var(--line);background:var(--card);color:inherit}
    .cso>b{font-size:26px} .cso span{display:flex;flex-direction:column;gap:2px} .cso small{font-size:12.5px;color:var(--sub2,#9aa3b5)} .cso.rec{border:2px solid var(--pri);background:color-mix(in srgb,var(--pri) 10%,var(--card))} .cso em{font-style:normal;font-size:11px;background:var(--pri);color:#fff;border-radius:999px;padding:1px 7px;margin-left:4px}
    .cdots{display:flex;gap:6px;margin-bottom:8px} .cdots i{font-style:normal;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--line);opacity:.5} .cdots i.on{opacity:1;background:color-mix(in srgb,var(--pri) 25%,transparent)}
    .fixl{display:flex;flex-direction:column;gap:6px;margin-top:8px} .fixl button{display:flex;align-items:center;gap:8px;text-align:left;padding:10px 12px;border-radius:12px;border:1px solid var(--line,#e5e7eb);background:transparent;color:inherit;font-size:14px;line-height:1.45} .fixl button i{margin-left:auto;font-style:normal;color:var(--pri,#2563eb);font-weight:700}
    .sit button{text-align:left;padding:12px;border-radius:12px;border:1px solid var(--line,#e5e7eb);background:transparent;color:inherit}
    .sit b{display:block;font-size:15px} .sit span{font-size:12px;opacity:.7}

    /* 홈은 정보 위계로 구분하고, 큰 색 면적을 줄여요. 다른 학습 화면에는 적용하지 않아요. */
    #view .hero.calm-hero{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:none}
    .calm-hero .home-label{font-size:12px;font-weight:600;letter-spacing:.04em;color:var(--sub2,var(--sub));margin-bottom:16px}
    #view .calm-hero .dd{font-size:28px;font-weight:650;letter-spacing:-.7px;line-height:1.25}
    #view .calm-hero .muted{color:var(--sub2,var(--sub));line-height:1.6}
    #view .calm-hero .home-streak>div:first-child{font-size:16px!important;font-weight:600!important}
    #view .calm-hero .go{background:#526780;color:#fff;box-shadow:none;border:0;border-radius:12px;padding:16px;font-size:18px;margin-top:22px;line-height:1.5}
    #view .calm-hero .go small{color:#e1e7ef;font-size:12px;font-weight:400;line-height:1.6;margin-top:4px}
    #view .calm-manager{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:18px;padding:18px;margin-top:14px}
    #view .calm-manager .mgh{display:block;font-size:16px;font-weight:650;line-height:1.5}
    #view .calm-manager .mgr-status{display:block;color:var(--sub2,var(--sub));font-weight:400;font-size:13px;margin:5px 0 12px}
    #view .calm-manager summary{cursor:pointer;font-size:14px;font-weight:500;line-height:1.6;padding:8px 0;color:var(--ink)}
    #view .calm-manager .fixl button{background:var(--bg);border:1px solid var(--line);color:var(--ink);font-size:13px;padding:12px;line-height:1.65;border-radius:10px}
    #view .calm-manager .fixl button b{white-space:nowrap;flex:none}
    #view .calm-manager .fixl button i{color:var(--sub2,var(--sub));font-size:12px}
    #view .calm-manager .sit button{background:var(--bg);color:var(--ink);border-color:var(--line)}
    #view .home-progress{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:0;margin-top:14px;overflow:hidden}
    #view .home-progress>summary{cursor:pointer;padding:18px;font-size:15px;font-weight:600;color:var(--ink);line-height:1.5}
    #view .home-progress>summary small{font-size:12px;font-weight:400;color:var(--sub2,var(--sub));margin-left:8px}
    .home-progress .progress-body{padding:0 18px 18px}
    .home-progress .lvb{margin:0;background:transparent;border:0;padding:10px 0;color:var(--ink)}
    .home-progress .lvn{background:var(--line);color:var(--ink);font-weight:600}
    .home-progress .lvt small{color:var(--sub2,var(--sub))}
    .home-progress .lvt i{background:var(--line)} .home-progress .lvt em{background:#91a69b}
    .home-progress .lvg{display:none}
    .home-progress .lgue{font-size:12px;color:var(--sub2,var(--sub));line-height:1.7;border-bottom:1px solid var(--line);padding-bottom:14px;margin:6px 0 0}
    .home-progress .home-week{font-size:12px;color:var(--sub2,var(--sub));line-height:1.6}
    .home-progress .wk{gap:7px;margin-top:10px}.home-progress .wk div{font-size:11px;color:var(--sub2,var(--sub));opacity:1}
    .home-progress .wk i{height:16px;background:var(--line);border-radius:5px}.home-progress .wk i.p{background:#91a69b80}.home-progress .wk i.d{background:#91a69b}
    body.home-calm #pscore{box-shadow:none;animation:none}body.home-calm #pscore b{font-weight:600;font-size:14px}
    body.home-calm #hdrb button,body.home-calm #setb{background:var(--card);border-color:var(--line)}
    body.home-calm nav.tabs button.on{color:var(--ink)}body.home-calm nav.tabs button.on b{background:var(--line)}
    @media(max-width:360px){.calm-manager .sit{grid-template-columns:1fr}.home-progress>summary small{display:block;margin-left:0}}
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
    el.innerHTML = `<div><div class="row"><h3 class="grow">📇 ${h(theme)}</h3><button class="btn sm" id="kcsay">🔊 읽기</button><button class="btn sm" id="kcx">닫기</button></div>
      <div class="muted">${qs.length ? `기출 ${qs.length}회 출제 · 빈출 ${hotStars(theme)}` : ''}</div>
      ${concepts.length ? `<h4 style="margin:14px 0 4px">핵심 정리</h4><ul style="padding-left:18px;margin:0">${concepts.map(c => `<li>${h(c)}</li>`).join('')}</ul>` : ''}
      ${ox.length ? `<h4 style="margin:16px 0 4px">OX 암기 카드 <span class="muted" style="font-weight:400;font-size:13px">눌러서 정답 보기</span></h4>${ox.slice(0, 12).map(x => `<div class="fc"><div>${h(x.s)}</div><div class="a">${x.m ? `<div style="margin-bottom:4px">${h(x.s).split(h(x.m.bad)).join(`<span class="bad">${h(x.m.bad)}</span>`)}<div class="good">→ 바르게: ${h(x.m.fix)}</div></div>` : ''}<span class="o" style="color:${x.o ? '#16a34a' : '#dc2626'}">${x.o ? 'O' : 'X'}</span>${emph(x.e)}</div></div>`).join('')}` : ''}
      ${!concepts.length && !ox.length ? '<div class="muted" style="margin-top:12px">이 테마는 아직 정리된 내용이 없어요. 문제 해설이 만들어지면 채워져요.</div>' : ''}</div>`;
    el.onclick = e => { if (e.target === el || e.target.id === 'kcx') { if (SAY.on) sayStop(); el.remove(); } const f = e.target.closest('.fc'); if (f) f.classList.toggle('open'); };
    document.body.appendChild(el);
    const kb = el.querySelector('#kcsay');
    kb.onclick = ev => {
      ev.stopPropagation();
      if (SAY.on) { sayStop(); kb.textContent = '🔊 읽기'; return; }
      const seg = [{ t: sayClean('핵심 카드. ' + theme), el: el.querySelector('h3') }];
      el.querySelectorAll('li').forEach(li => seg.push({ t: sayClean(li.textContent), el: li }));
      el.querySelectorAll('.fc').forEach((f, k) => {
        const q = f.firstElementChild, a = f.querySelector('.a');
        seg.push({ t: sayClean('오엑스 ' + (k + 1) + '번. ' + q.textContent), el: f });
        if (a) seg.push({ t: sayClean('정답. ' + a.textContent), el: f, open: () => f.classList.add('open') });
      });
      sayRun(seg, kb, '🔊 읽기');
    };
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
    const moSaved = (() => { try { return !!localStorage.getItem('reb_more_' + q.id); } catch (e) { return false; } })();
    if (mo && !mo.classList.contains('xhid')) mo.style.display = S.ans[q.id] && (moSaved || (ab && ab.textContent.trim().length > 20)) ? '' : 'none';
    const qa = document.getElementById('qa');
    if (qa && !qa.querySelector('.svd')) qa.insertAdjacentHTML('beforeend', expOf(q) ? ' <span class="svd">✓ 저장됨</span>' : ' <span class="svd no">인터넷</span>');
    const ex = S.exam && !S.done, pick = S.ans[q.id];
    const fb = document.querySelector('#view .fb');
    if (pick && !ex && fb) fb.classList.add('top');     // 결과는 제자리(번호 버튼 바로 아래)에 크게 — 문제→보기→결과→해설 순서
    if (pick && !ex && fb && !document.querySelector('.conf')) {
      const cur = conf()[q.id];
      fb.insertAdjacentHTML('afterend', `<div class="conf"><span class="lb">확신도</span>
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
    return `<div class="home-week"><div style="margin-top:14px;font-size:13px;opacity:.95">이번 주 <b>${days}일</b> 공부 · <b>${sum}</b>문제 <span style="opacity:.8">(목표 주 6일)</span></div><div class="wk">${cells}</div></div>`;
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
</div>`;
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
      hero.insertAdjacentHTML('beforeend', managerCard());   // 오늘 공부 시작 카드 안으로 합침
      const hg = document.getElementById('hgo');
      if (hg) {
        hg.onclick = () => courseSheet();
        const t = todayLog(), sm = hg.querySelector('small');
        if (sm && (t.ox || t.q)) sm.innerHTML += ` · 🎧 ${t.ox || 0}지문`;
      }
      $('#mgr .sit').onclick = e => { const b = e.target.closest('[data-s]'); if (b) runSitu(b.dataset.s); };
      const dg = diagnose();
      $('#mgr').querySelectorAll('[data-f]').forEach(b => b.onclick = () => runFix(dg.acts[+b.dataset.f]));
      const fa = $('#fixall'); if (fa) fa.onclick = () => runFix({ k: 'all' });
    }
    calmHome();
    // 진도·과목별 수준은 기록 → 점수 탭에 있으니 첫 화면에선 뺌
    [...document.querySelectorAll('#view .card')].forEach(c => { const h = c.querySelector('h2,h3'); if (h && /회독 진도|과목별 수준|내용 업데이트/.test(h.textContent)) c.remove(); });
  }
  function calmHome() {
    document.body.classList.toggle('home-calm', cur === 'home');
    if (cur !== 'home') return;
    const hero=document.querySelector('#view .hero');if(!hero)return;
    hero.classList.add('calm-hero');
    if(!hero.querySelector('.home-label'))hero.insertAdjacentHTML('afterbegin','<div class="home-label">오늘의 학습</div>');
    const streak=hero.querySelector('.row>div:last-child');if(streak){streak.classList.add('home-streak');const n=streak.firstElementChild;if(n)n.textContent=n.textContent.replace('🔥 ','');}
    const go=hero.querySelector('.go');if(go){const text=[...go.childNodes].find(n=>n.nodeType===3);if(text)text.textContent=text.textContent.replace(/^(?:▶|🎉)\s*/,'');}
    let progress=document.getElementById('home-progress');
    if(!progress){progress=document.createElement('details');progress.id='home-progress';progress.className='card home-progress';progress.innerHTML='<summary>학습 기록<small>이번 주 · 레벨 · 배지</small></summary><div class="progress-body"></div>';hero.after(progress);}
    const manager=document.getElementById('mgr');if(manager){manager.classList.remove('inhero');manager.classList.add('card','calm-manager');if(manager.nextElementSibling!==progress)progress.before(manager);}
    const body=progress.querySelector('.progress-body');
    ['#lvb','#lgh','.home-week'].forEach(sel=>{const node=document.querySelector('#view '+sel);if(node&&node.parentElement!==body)body.appendChild(node);});
  }
  function decorateSetup() {
    cleanCards([]);
  }
  // 빈출 테마 맨 위에 📇 핵심 카드 (테마별 개념 정리)
  function decorateThemes() {
    const sg = $('#pseg'); if (!sg || $('#kcl')) return;
    sg.insertAdjacentHTML('afterend', `<div class="bigl" style="margin-bottom:10px"><button id="kcl"><b>📇</b><div>핵심 카드<span>빈출 테마 순으로 개념 정리·OX 암기</span></div></button></div>`);
    $('#kcl').onclick = () => themeList();
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
    const first = document.querySelector('#view .card:not(#logc)');
    const un = unsureIds().length;
    // 오답노트: '틀린 문제 다시'와 '헷갈린 문제 다시'를 '🔁 복습하기' 하나로
    const rw = document.getElementById('wa');
    if (rw && !$('#wrev') && typeof window.revList === 'function') {
      const n = window.revList().length;
      rw.insertAdjacentHTML("beforebegin", `<button class="btn pri grow" id="wrev">🔁 복습하기 ${n}문제</button>`);
      rw.style.display = 'none';
      $('#wrev').onclick = () => { const l = window.revList(); if (l.length) startQuiz(l, { from: 'wrong', title: '🔁 복습하기' }); };
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
    const sub = SUBS, notes = [], acts = [];
    const push = (h, a) => { notes.push(h); acts.push(a); };
    const t14 = recentBySub(14);
    const ever = recentBySub(3650);
    sub.forEach((n, s) => { if (!t14[s]) push(ever[s] ? `<b>${n}</b> 2주째 안 풀었어요` : `<b>${n}</b> 아직 시작 안 했어요`, { k: 'sub', s }); });
    if (tot >= 20) sub.forEach((n, s) => { const share = rec[s] / tot, want = WEIGHT[s] / W; if (t14[s] && share < want * .5) push(`<b>${n}</b> 이번 주 비중이 적어요 (${Math.round(share * 100)}% · 권장 ${Math.round(want * 100)}%)`, { k: 'sub', s }); });
    rate.forEach((r, s) => { if (r != null && r < .4) push(`<b>${sub[s]}</b> 정답률 ${Math.round(r * 100)}% · 과락 위험`, { k: 'weak', s }); });
    const un = unsureIds().length; if (un) push(`헷갈렸던 문제 <b>${un}개</b>가 복습을 기다려요`, { k: 'unsure' });
    let due = 0; try { due = dueList().length; } catch (e) {}
    if (due) push(`오늘 복습할 문제 <b>${due}개</b>`, { k: 'due' });
    let lsec = 0; try { const d = LJ.d; const t = Date.now(); for (const k in d) if (t - new Date(k) < 7 * DAY) lsec += d[k].lsec || 0; } catch (e) {}
    if (lsec < 600) push('이번 주 듣기가 10분도 안 돼요 — 이동할 때 🎧 귀로 듣기를 써 보세요', { k: 'listen' });
    const days = (() => { const s7 = new Set(); for (const k in P) { const r = P[k]; if (Date.now() - r[4] < 7 * DAY) s7.add(new Date(r[4]).toDateString()); } return s7.size; })();
    const grade = notes.length === 0 && days >= 5 ? ['😊 잘하고 있어요', '#16a34a'] : notes.length <= 2 && days >= 3 ? ['🙂 괜찮아요, 빈 곳만 채워요', '#2563eb'] : ['💪 다시 리듬을 잡아요', '#ea580c'];
    const bars = sub.map((n, s) => { const share = tot ? rec[s] / tot : 0, want = WEIGHT[s] / W;
      return `<span>${n}</span><div class="b" style="position:relative"><i style="width:${Math.min(100, share * 100 * 2.5)}%;background:${share < want * .5 ? '#f59e0b' : '#3b82f6'}"></i><em style="position:absolute;left:${want * 250}%;top:-2px;bottom:-2px;width:2px;background:#111;opacity:.35"></em></div><span class="muted">${Math.round(share * 100)}%</span>`; }).join('');
    return { grade, notes, acts, bars, days, tot };
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

  /* 매니저가 짚은 빈 곳을 바로 메우는 문제 묶음 */
  function subPick(s, n, weak) {
    const L = Q.filter(q => q.s === s && graded(q) && !q.ocr), seen = new Set(), out = [];
    const add = q => { if (q && !seen.has(q.id) && out.length < n) { seen.add(q.id); out.push(q); } };
    if (weak) shuffle(L.filter(q => P[q.id] && P[q.id][1] === 0)).forEach(add);
    shuffle(L.filter(q => !P[q.id])).forEach(add);
    L.slice().sort((a, b) => (P[a.id] || [0, 0, 0, 0, 0])[4] - (P[b.id] || [0, 0, 0, 0, 0])[4]).forEach(add);
    return out;
  }
  function fixSet(acts, n = 20) {
    const seen = new Set(), out = [], add = q => { if (q && !q.ocr && !seen.has(q.id) && out.length < n) { seen.add(q.id); out.push(q); } };
    acts.filter(a => a.k === 'due').forEach(() => { try { dueList().slice(0, 6).forEach(add); } catch (e) {} });
    acts.filter(a => a.k === 'unsure').forEach(() => unsureIds().slice(0, 4).forEach(k => add(BYID[k])));
    const subs = acts.filter(a => a.k === 'sub' || a.k === 'weak');
    if (subs.length) { const each = Math.max(3, Math.ceil((n - out.length) / subs.length)); subs.forEach(a => subPick(a.s, each, a.k === 'weak').forEach(add)); }
    return out;
  }
  function runFix(a) {
    if (a.k === 'listen') return openListen();
    const l = a.k === 'all' ? fixSet(diagnose().acts) : a.k === 'due' ? (() => { try { return dueList(); } catch (e) { return []; } })()
      : a.k === 'unsure' ? unsureIds().map(k => BYID[k]).filter(Boolean) : subPick(a.s, 15, a.k === 'weak');
    if (!l.length) return window.__toast && __toast('지금 풀 문제가 없어요');
    const t = a.k === 'all' ? '🩺 빈 곳 채우기' : a.k === 'due' ? '🔁 오늘 복습' : a.k === 'unsure' ? '🤔 헷갈렸던 문제' : (a.k === 'weak' ? '🎯 ' : '📘 ') + SUBS[a.s];
    startQuiz(l, { from: 'home', title: t });
  }
  window.fixSet = fixSet;
  // ▶ 오늘 공부 시작에도 매니저 처방을 넣음 (복습 다음 순서)
  try {
    const _tp = todayPlan;
    todayPlan = function () {
      const r = _tp.apply(this, arguments);
      try {
        if (r && r.items && r.ph) {
          const acts = diagnose().acts.filter(a => a.k === 'sub' || a.k === 'weak' || a.k === 'unsure');
          const qs = acts.length ? fixSet(acts, 15) : [];
          if (qs.length) {
            const nm = [...new Set(acts.filter(a => a.s != null).map(a => SUBS[a.s]))].slice(0, 2).join('·');
            const at = r.items.findIndex(it => /오늘 복습/.test(it.label)) + 1;
            r.items.splice(at, 0, { label: `🩺 매니저 처방 ${qs.length}문제`, sub: (nm ? nm + ' 채우기' : '') + (acts.some(a => a.k === 'unsure') ? (nm ? ' + ' : '') + '헷갈렸던 문제' : ''), qs, mode: 'list' });
          }
        }
      } catch (e) {}
      return r;
    };
    setTimeout(() => { try { if (cur === 'home') go('home'); } catch (e) {} }, 0);   // 처음 그린 첫 화면에도 처방 반영
  } catch (e) {}

  function managerCard() {
    const d = diagnose(), status = d.grade[0].replace(/^[^가-힣A-Za-z0-9]+/u, '');
    return '<div id="mgr" class="card calm-manager"><div class="mgh">학습 추천<span class="mgr-status">'+h(status)+'</span></div>' +
      (d.notes.length ? '<details><summary>추천 항목 '+Math.min(d.notes.length,3)+'개 펼쳐보기</summary><div class="fixl">'+d.notes.slice(0,3).map((n,i)=>'<button data-f="'+i+'">'+n+'<i>시작</i></button>').join('')+'</div></details>' : '<p class="muted">골고루 공부하고 있어요.</p>') +
      '<details style="margin-top:6px"><summary>상황에 맞춰 고르기</summary><div class="sit" style="margin-top:8px">'+SITU.map(([k,i,t,sub])=>'<button data-s="'+k+'"><b>'+h(t)+'</b><span>'+h(sub)+'</span></button>').join('')+'</div></details></div>';
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
    qt.innerHTML = '<div class="qstem">' + h(stem) + '</div>' + ch.map(c => {
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
    if (!el) { el = document.createElement('button'); el.id = 'ver'; top.appendChild(el); const sy = document.getElementById('sync'); if (sy) sy.style.display = 'none'; }
    el.textContent = '⚙'; el.title = '설정'; el.setAttribute('aria-label', '설정');
    el.onclick = () => setPanel(v);
    try { const pv = +localStorage.getItem('reb_ver') || 0; if (pv && pv < v && window.__toast) window.__toast('✅ v' + v + '로 업데이트됐어요'); localStorage.setItem('reb_ver', v); } catch (e) {}
  }
  /* 📳 버튼을 누르면 짧은 진동 + 살짝 눌리는 모양 (눌렸는지 확실히) */
  (function haptic() {
    const nb = window.NativeBridge;
    const ok = () => { try { return !nb || !nb.hapticOn || nb.hapticOn(); } catch (e) { return true; } };
    const sel = 'button, .choices button, [data-a], [data-s], [data-f], .hrow, .tabseg button, summary, a[href], .chip, label';
    document.addEventListener('pointerdown', e => {
      const b = e.target.closest(sel); if (!b || b.disabled || e.target.closest('#padc')) return;
      if (ok()) { try { if (nb && nb.tap) nb.tap(!!b.closest('.choices, .btn.pri, #go, .go, .hero button')); else if (navigator.vibrate) navigator.vibrate(12); } catch (x) {} }
    }, { passive: true, capture: true });
    const st = document.createElement('style');
    st.textContent = 'button,.hrow,summary,[data-a],[data-s]{transition:transform .08s,filter .08s} button:active:not(:disabled),.hrow:active,summary:active,[data-a]:active,[data-s]:active{transform:scale(.96);filter:brightness(.92)}';
    document.head.appendChild(st);
  })();

  /* ================= 🏆 성취: 경험치·레벨·배지·축하 ================= */
  const LVN = ['입문', '새싹', '수험생', '꾸준러', '실력자', '고수', '합격권', '달인', '마스터', '전설'];
  function xpNow() { let x = 0; for (const k in P) { const r = P[k], a = r[2] || 1, w = r[3] || 0; x += a * 3 + Math.max(0, a - w) * 7; }
    try { for (const k in LJ.d) { const d = LJ.d[k]; x += (d.ox || 0) * 2 + Math.floor((d.lsec || 0) / 60); } } catch (e) {}   // 🎧 지문 하나 2 XP + 1분에 1 XP
    return x; }
  function lvOf(x) { let n = 1, need = 100, acc = 0; while (x >= acc + need) { acc += need; n++; need = 100 + (n - 1) * 60; } return { n, name: LVN[Math.min(LVN.length - 1, Math.floor((n - 1) / 3))], cur: x - acc, need }; }
  function achStats() {
    const ks = Object.keys(P), st = subjStats();
    let lsec = 0; try { for (const k in LJ.d) lsec += LJ.d[k].lsec || 0; } catch (e) {}
    const days = new Set(ks.map(k => new Date(P[k][4]).toDateString())).size;
    return { solved: ks.length, streak: (() => { try { return streak().n; } catch (e) { return 0; } })(), days, lsec,
      conquer: ks.filter(k => P[k][3] > 0 && P[k][1] === 1).length, st, exams: (EX || []).length, pass: (EX || []).some(e => e.pass) };
  }
  const BADGES = [
    ['first', '🌱', '첫걸음', '첫 문제 풀기', a => a.solved >= 1],
    ['s100', '💯', '100문제', '100문제 풀기', a => a.solved >= 100],
    ['s500', '📚', '500문제', '500문제 풀기', a => a.solved >= 500],
    ['s1000', '🏔️', '1000문제', '1000문제 풀기', a => a.solved >= 1000],
    ['sall', '👑', '기출 정복', '모든 기출 한 번씩', a => a.solved >= Q.filter(q => !q.ocr).length * .98],
    ['k3', '🔥', '3일 연속', '3일 연속 공부', a => a.streak >= 3],
    ['k7', '⚡', '일주일 연속', '7일 연속 공부', a => a.streak >= 7],
    ['k30', '🏅', '한 달 연속', '30일 연속 공부', a => a.streak >= 30],
    ['d50', '🗓️', '50일 공부', '공부한 날 50일', a => a.days >= 50],
    ['c10', '🩹', '오답 정복 10', '틀린 문제 10개 다시 맞히기', a => a.conquer >= 10],
    ['c100', '🛡️', '오답 정복 100', '틀린 문제 100개 다시 맞히기', a => a.conquer >= 100],
    ['fl', '🚧', '과락 탈출', '다섯 과목 모두 정답률 40% 넘기 (과목당 20문제 이상)', a => a.st.every(x => x.grad >= 20 && x.rate >= .4)],
    ['p60', '🎯', '합격선', '다섯 과목 모두 정답률 60% 넘기', a => a.st.every(x => x.grad >= 20 && x.rate >= .6)],
    ['top', '🌟', '한 과목 80%', '한 과목 정답률 80% (50문제 이상)', a => a.st.some(x => x.grad >= 50 && x.rate >= .8)],
    ['ex1', '⏱️', '첫 모의고사', '모의고사 한 회 끝까지', a => a.exams >= 1],
    ['exp', '🏆', '모의고사 합격', '모의고사 합격 점수', a => a.pass],
    ['l60', '🎧', '귀로 1시간', '듣기 공부 누적 1시간', a => a.lsec >= 3600],
    ['l600', '🎼', '귀로 10시간', '듣기 공부 누적 10시간', a => a.lsec >= 36000],
  ];
  function achLoad() { try { return JSON.parse(localStorage.getItem('reb_ach') || '{}'); } catch (e) { return {}; } }
  function achSave(o) { try { localStorage.setItem('reb_ach', JSON.stringify(o)); } catch (e) {} }
  function confetti() {
    const c = document.createElement('canvas'); c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
    document.body.appendChild(c); const d = devicePixelRatio || 1; c.width = innerWidth * d; c.height = innerHeight * d;
    const g = c.getContext('2d'); g.scale(d, d); const C = ['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#ec4899'];
    const ps = Array.from({ length: 110 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .35, vx: (Math.random() - .5) * 11, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 4, c: C[Math.random() * C.length | 0], a: Math.random() * 6 }));
    let t = 0; (function f() { g.clearRect(0, 0, innerWidth, innerHeight); ps.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.a += .2; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.globalAlpha = Math.max(0, 1 - t / 90); g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); g.restore(); });
      if (++t < 95) requestAnimationFrame(f); else c.remove(); })();
  }
  function celebrate(title, sub) {
    confetti(); try { window.NativeBridge && NativeBridge.tap && NativeBridge.tap(true); } catch (e) {}
    const o = document.createElement('div'); o.className = 'achpop';
    o.innerHTML = `<div><b>${title}</b><span>${sub}</span><button>좋아요</button></div>`;
    o.onclick = () => o.remove(); document.body.appendChild(o); setTimeout(() => o.remove(), 4500);
  }
  /* 새로 얻은 배지·레벨업이 있으면 축하 (처음 한 번은 조용히 기록만) */
  function achCheck() {
    const a = achStats(), o = achLoad(), got = BADGES.filter(b => b[4](a)).map(b => b[0]), L = lvOf(xpNow());
    if (!o.init) { achSave({ init: 1, got, lv: L.n }); return; }
    const nb = got.filter(k => !o.got.includes(k));
    const up = L.n > (o.lv || 1);
    achSave({ init: 1, got, lv: L.n });
    if (nb.length) { const b = BADGES.find(x => x[0] === nb[0]); celebrate(`${b[1]} 새 배지: ${b[2]}`, b[3] + (nb.length > 1 ? ` 외 ${nb.length - 1}개` : '')); }
    else if (up) celebrate(`⬆️ 레벨 업! Lv.${L.n} ${L.name}`, `지금까지 ${xpNow().toLocaleString()} XP`);
  }
  window.achCheck = achCheck;
  function lvBar() {
    const x = xpNow(), L = lvOf(x), got = BADGES.filter(b => b[4](achStats())).length;
    return `<button class="lvb" id="lvb"><span class="lvn">Lv.${L.n}</span><span class="lvt"><b>${L.name}</b><i><em style="width:${Math.round(L.cur / L.need * 100)}%"></em></i><small>다음 레벨까지 ${L.need - L.cur} XP · 배지 ${got}/${BADGES.length}</small></span><span class="lvg">🏆</span></button>`;
  }
  /* 기록 → 점수 맨 위: 성취 카드 */
  function achCard() {
    const a = achStats(), x = xpNow(), L = lvOf(x);
    const PD = predict(), r = s => PD.sub[s];   // 맨 위 예상 점수와 같은 계산
    const avg = ids => { const v = ids.map(r); return v.some(z => z == null) ? null : v.reduce((p, q) => p + q, 0) / v.length; };
    const fail = ids => ids.some(s => r(s) != null && r(s) < 40);
    const exm = (nm, ids) => { const v = avg(ids); return `<div class="pr"><b>${nm}</b>${v == null ? '<span class="muted">과목마다 10문제 이상 풀면 보여요</span>' : `<span class="${v >= 60 && !fail(ids) ? 'hok' : 'hno'}">예상 ${Math.round(v)}점</span><small>${v >= 60 && !fail(ids) ? '합격권이에요 👏' : fail(ids) ? '과락(40점 미만) 과목부터 채워요' : `합격선까지 +${Math.ceil(60 - v)}점`}</small>`}</div>`; };
    return `<div class="card" id="achc"><h2>🏆 나의 성취</h2>
      <div class="lvbig"><span class="lvn">Lv.${L.n}</span><div><b>${L.name}</b><i><em style="width:${Math.round(L.cur / L.need * 100)}%"></em></i><small>${x.toLocaleString()} XP · 다음 레벨까지 ${L.need - L.cur} XP</small></div></div>
      <div class="pred">${exm('1차', [0, 1])}${exm('2차', [2, 3, 4])}</div>
      ${predChart()}
      <div class="lgue">${leagueLine()}</div>
      <div class="muted" style="font-size:12.5px;margin:6px 0 10px">🔥 연속 ${streak().n}일${streak().frozen ? ` (🧊 보호권 ${streak().frozen}번 씀)` : ''} · 한 주에 하루는 쉬어도 이어져요 · 🌳 집중 나무 ${trees()}그루</div>
      <div class="bdg">${BADGES.map(b => { const ok = b[4](a); return `<div class="${ok ? 'on' : ''}" title="${b[3]}"><b>${ok ? b[1] : '🔒'}</b><span>${b[2]}</span><small>${b[3]}</small></div>`; }).join('')}</div>
      <div class="muted" style="font-size:12px;margin-top:8px">맞히면 10 XP, 틀려도 풀면 3 XP예요. 틀린 문제를 다시 맞히면 '오답 정복'이 쌓여요.</div></div>`;
  }

  /* 📈 실시간 예상 점수: 맨 위 제목 자리에 늘 보여 주고, 문제를 풀 때마다 바로 바뀜
     과목 점수 = 최근 결과 기준 정답 수를 '아직 모름(30%)' 10문제로 보정한 값 → 적게 풀었을 땐 보수적으로 */
  function predict() {
    const st = subjStats(), k = 10, pr = .3;
    const sub = st.map(x => 100 * (x.ok + k * pr) / (x.grad + k));
    const a1 = (sub[0] + sub[1]) / 2, a2 = (sub[2] + sub[3] + sub[4]) / 3;
    const ok1 = a1 >= 60 && sub[0] >= 40 && sub[1] >= 40, ok2 = a2 >= 60 && sub.slice(2).every(v => v >= 40);
    return { sub: st.map(x => 100 * (x.ok + k * pr) / (x.grad + k)), a1: Math.round(a1 * 10) / 10, a2: Math.round(a2 * 10) / 10, ok1, ok2, n: st.reduce((a, x) => a + x.grad, 0) };
  }
  window.predict = predict;
  let PS0 = null;
  function scoreChip() {
    const top = document.querySelector('header.top'); if (!top) return;
    let c = document.getElementById('pscore');
    if (!c) {
      const h = top.querySelector('h1'); if (h) h.style.display = 'none';
      c = document.createElement('button'); c.id = 'pscore'; c.title = '지금 실력으로 본 예상 점수 (누르면 자세히)';
      c.onclick = () => window.go('stats'); top.insertBefore(c, top.firstChild);
    }
    const p = predict(), cls = ok => ok ? 'ok' : 'no';
    const d = PS0 ? [p.a1 - PS0.a1, p.a2 - PS0.a2] : [0, 0];
    const dt = v => Math.abs(v) >= .1 ? `<i class="${v > 0 ? 'up' : 'dn'}">${v > 0 ? '▲' : '▼'}${Math.abs(v).toFixed(1)}</i>` : '';
    const f0 = PS0 ? [PS0.a1, PS0.a2] : [p.a1, p.a2];
    c.innerHTML = `<small>예상 점수${p.n < 30 ? ' (추정)' : ''}</small><span>1차 <b class="${cls(p.ok1)}" id="ps1">${f0[0].toFixed(1)}</b>${dt(d[0])} · 2차 <b class="${cls(p.ok2)}" id="ps2">${f0[1].toFixed(1)}</b>${dt(d[1])}</span>`;
    if (PS0 && (Math.abs(d[0]) >= .1 || Math.abs(d[1]) >= .1)) {
      c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash');
      // 점수가 0.1점씩 차오르는 모습 (약 1초)
      const t0 = performance.now(), e1 = document.getElementById('ps1'), e2 = document.getElementById('ps2');
      (function tick(t) { const k = Math.min(1, (t - t0) / 1000), ez = 1 - Math.pow(1 - k, 3);
        if (e1) e1.textContent = (f0[0] + (p.a1 - f0[0]) * ez).toFixed(1); if (e2) e2.textContent = (f0[1] + (p.a2 - f0[1]) * ez).toFixed(1);
        if (k < 1) requestAnimationFrame(tick); })(t0);
    }
    PS0 = p; predLog(p);
  }
  window.scoreChip = scoreChip;


  const dkey = d => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };   // 일지 날짜 키 (YYYY-MM-DD)
  /* ================= 동기부여 묶음 =================
     🧊 스트릭 보호권 · 🏁 주간 리그(지난주의 나) · 📈 예상 점수 그래프 · 🌳 집중 타이머 · ⏰ D-30 실전 모드 */
  // 🧊 연속 공부: 문제 풀기나 듣기 5분 이상 한 날. 한 주(월~일)에 하루는 빠져도 이어져요
  function studyDays() {
    const set = new Set();
    try { for (const k in LJ.d) { const d = LJ.d[k]; if ((d.q || 0) > 0 || (d.lsec || 0) >= 300) set.add(k); } } catch (e) {}
    for (const k in P) set.add(dkey(new Date(P[k][4])));
    return set;
  }
  const _streak = window.streak;
  window.streak = streak = function () {
    try {
      const set = studyDays(), used = new Set(); let d = new Date(); d.setHours(12, 0, 0, 0); let n = 0, fz = 0;
      if (!set.has(dkey(d))) d.setDate(d.getDate() - 1);   // 오늘 아직 안 했으면 어제부터 셈
      const wk = x => { const t = new Date(x); const dw = (t.getDay() + 6) % 7; t.setDate(t.getDate() - dw); return dkey(t); };
      for (let k = 0; k < 1500; k++) {
        if (set.has(dkey(d))) n++;
        else if (!used.has(wk(d)) && n > 0) { used.add(wk(d)); fz++; }   // 그 주 보호권 사용
        else break;
        d.setDate(d.getDate() - 1);
      }
      return { n, frozen: fz };
    } catch (e) { return _streak(); }
  };
  // 하루 경험치 (일지 기준): 맞힘 10 · 틀림 3 · 들은 지문 2 · 듣기 1분 1
  function dayXP(d) { return d ? (d.ok || 0) * 10 + Math.max(0, (d.q || 0) - (d.ok || 0)) * 3 + (d.ox || 0) * 2 + Math.floor((d.lsec || 0) / 60) : 0; }
  function weekXP(off) {   // off 0 = 이번 주(월~오늘), 1 = 지난주
    const t = new Date(); t.setHours(12, 0, 0, 0); const dw = (t.getDay() + 6) % 7; t.setDate(t.getDate() - dw - off * 7);
    let x = 0; const days = off ? 7 : dw + 1;
    for (let i = 0; i < days; i++) { const k = dkey(t); try { x += dayXP(LJ.d[k]); } catch (e) {} t.setDate(t.getDate() + 1); }
    return x;
  }
  function leagueLine() {
    const a = weekXP(0), b = weekXP(1);
    return b ? `🏁 이번 주 <b>${a}</b> XP · 지난주의 나 ${b} XP ${a >= b ? '<span class="hok">이기는 중 ▲' + (a - b) + '</span>' : '<span class="hno">' + (b - a) + ' 남음</span>'}`
             : `🏁 이번 주 <b>${a}</b> XP · 다음 주부터 지난주의 나와 겨뤄요`;
  }
  // 📈 예상 점수 날마다 기록 → 그래프
  function predLog(p) { try { const L = JSON.parse(localStorage.getItem('reb_pred') || '{}'); L[dkey()] = [p.a1, p.a2]; const ks = Object.keys(L).sort(); while (ks.length > 120) delete L[ks.shift()]; localStorage.setItem('reb_pred', JSON.stringify(L)); } catch (e) {} }
  function predChart() {
    let L = {}; try { L = JSON.parse(localStorage.getItem('reb_pred') || '{}'); } catch (e) {}
    const ks = Object.keys(L).sort(); if (ks.length < 2) return '<div class="muted" style="font-size:12.5px">📈 이틀 이상 공부하면 예상 점수가 오르는 그래프가 그려져요</div>';
    const W = 320, H = 120, P0 = 22, xs = i => P0 + i * (W - P0 - 6) / (ks.length - 1), ys = v => H - 14 - (Math.max(0, Math.min(100, v)) / 100) * (H - 24);
    const line = (j, c) => `<polyline fill="none" stroke="${c}" stroke-width="2.5" points="${ks.map((k, i) => xs(i) + ',' + ys(L[k][j])).join(' ')}"/>`;
    return `<div style="font-size:13px;font-weight:700;margin:4px 0">📈 예상 점수 변화</div><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
      <line x1="${P0}" x2="${W - 6}" y1="${ys(60)}" y2="${ys(60)}" stroke="#22c55e" stroke-dasharray="4 4"/><text x="0" y="${ys(60) + 4}" font-size="10" fill="#22c55e">60</text>
      <text x="0" y="${ys(40) + 4}" font-size="10" fill="#ef4444">40</text><line x1="${P0}" x2="${W - 6}" y1="${ys(40)}" y2="${ys(40)}" stroke="#ef4444" stroke-dasharray="2 4" opacity=".6"/>
      ${line(0, '#3b82f6')}${line(1, '#f59e0b')}<text x="${P0}" y="${H - 2}" font-size="10" fill="#9aa3b5">${ks[0].slice(5)}</text><text x="${W - 40}" y="${H - 2}" font-size="10" fill="#9aa3b5">${ks[ks.length - 1].slice(5)}</text></svg>
      <div style="font-size:11.5px"><span style="color:#3b82f6">● 1차</span> <span style="color:#f59e0b">● 2차</span> · 초록 점선 = 합격선</div>`;
  }
  // 🌳 집중 타이머 25분: 다 채우면 나무 한 그루
  const FT = { end: 0, t: null };
  function trees() { try { return +localStorage.getItem('reb_trees') || 0; } catch (e) { return 0; } }
  function focusStart(min = 25) {
    FT.end = Date.now() + min * 60000; clearInterval(FT.t);
    const chip = document.getElementById('ftc') || (() => { const c = document.createElement('button'); c.id = 'ftc'; c.onclick = () => { if (confirm('집중 타이머를 멈출까요? (나무는 안 자라요)')) { FT.end = 0; c.remove(); clearInterval(FT.t); } }; document.querySelector('header.top')?.appendChild(c); return c; })();
    const tick = () => { const left = FT.end - Date.now(); if (left <= 0) { clearInterval(FT.t); chip.remove(); FT.end = 0; try { localStorage.setItem('reb_trees', trees() + 1); } catch (e) {} celebrate('🌳 집중 25분 완료!', `나무가 ${trees()}그루가 됐어요. 5분 쉬고 또 한 번?`); return; }
      const m = Math.floor(left / 60000), s2 = Math.floor(left / 1000) % 60; chip.textContent = `🌱 ${m}:${String(s2).padStart(2, '0')}`; };
    tick(); FT.t = setInterval(tick, 1000);
  }
  window.focusStart = focusStart;
  /* ================= 🚀 오늘 코스: '오늘 공부 시작' 하나로 합격까지 =================
     누르면 → 지금 상황에 맞는 방법 추천(보면서 풀기 / 듣기 / 10분만) → 단계별로 자동 진행
     단계: 🔁 복습 → 🎯 약점 훈련 → 🆕 오늘 진도 → 🧩 마무리. 한 단계 끝나면 다음 단계 안내.
     듣기로 한 공부(들은 지문·시간)도 오늘 진도·경험치에 들어감 */
  const COURSE = window.COURSE = { steps: [], i: 0, active: false, session: null };
  function todayLog() { try { return LJ.d[dkey()] || {}; } catch (e) { return {}; } }
  function courseRecommend() {
    const h = new Date().getHours(), wd = new Date().getDay(), t = todayLog();
    if (h >= 22 || h < 6) return ['listen', '🌙 늦은 시간엔 눈 감고 듣기가 오래 남아요 (20분 뒤 저절로 꺼져요)', 20];
    if (wd >= 1 && wd <= 5 && ((h >= 7 && h < 9) || (h >= 17 && h < 20))) return ['listen', '🚌 이동하는 시간이면 듣기로 진도를 빼요', 0];
    if ((t.q || 0) >= 30 && (t.lsec || 0) < 300) return ['listen', '👀 문제를 많이 풀었어요. 귀로 바꿔서 눈을 쉬어요', 0];
    if ((t.q || 0) === 0 && (t.lsec || 0) >= 900) return ['solve', '🎧 오늘 들은 걸 문제로 확인해 봐요', 0];
    return ['solve', '✍️ 보면서 풀기가 실력이 가장 빨리 늘어요', 0];
  }
  function buildCourse(short) {
    const tp = todayPlan(), used = new Set();
    const take = (arr, n) => { const o = []; for (const q of arr) { if (q && !q.ocr && !used.has(q.id) && o.length < n) { used.add(q.id); o.push(q); } } return o; };
    let due = []; try { due = dueList(); } catch (e) {}
    const uns = unsureIds().map(k => BYID[k]).filter(Boolean);
    const acts = diagnose().acts.filter(a => a.k === 'sub' || a.k === 'weak');
    const weak = acts.length ? fixSet(acts, 30) : [];
    const list = [], seen0 = new Set(); let ad = null;   // (오늘 계획 → 문제 목록·맞춤 문제)
    tp.items.forEach(it => { if (it.mode === 'list') (it.qs || []).forEach(q => { if (!seen0.has(q.id) && list.length < 60) { seen0.add(q.id); list.push(q); } }); else if (it.mode === 'ad' && it.n) ad = it; });
    if (short) {   // ⚡ 10분: 복습·약점 위주 10문제 한 단계
      const qs = take(due.concat(uns, weak, list), 10);
      return qs.length ? [{ t: '⚡ 10분 집중', sub: '복습·약점 위주', qs }] : [{ t: '⚡ 10분 집중', ad: { qs: Q, n: 10 } }];
    }
    const st = [];
    // 최근에 틀린 문제는 다음 날 코스 첫 단계에 꼭 (맞힐 때까지 계속 나옴)
    const wrongRecent = Object.keys(P).filter(k => P[k][1] === 0 && BYID[k] && Date.now() - P[k][4] > 6 * 3600000).sort((a, b) => P[b][4] - P[a][4]).map(k => BYID[k]);
    const r = take(wrongRecent.concat(due, uns), 10); if (r.length) st.push({ t: '🔁 복습', sub: '틀린 문제·잊기 직전 문제부터', qs: r });
    const w = take(weak, 10); if (w.length) st.push({ t: '🎯 약점 훈련', sub: [...new Set(acts.filter(a => a.s != null).map(a => SUBS[a.s]))].slice(0, 2).join('·') || '매니저 처방', qs: w });
    if (tp.dday != null && tp.dday <= 30) {   // ⏰ 시험 30일 전부터: 새 진도 대신 실전 감각
      st.push({ t: '📝 실전 20문제', sub: `D-${tp.dday} · 전 과목 섞어서 시험처럼`, ad: { qs: Q, n: 20 } });
      return st;
    }
    const n = take(list, 12); if (n.length) st.push({ t: '🆕 오늘 진도', sub: '새 문제', qs: n }); else if (ad && ad.n) st.push({ t: '🆕 오늘 진도', sub: '실력에 맞춘 문제', ad });
    const m = take(list, 12); if (m.length) st.push({ t: '🧩 마무리', sub: '섞어서 한 번 더', qs: m });
    if (!st.length) st.push({ t: '🎯 맞춤 20문제', sub: '오늘 목표 끝! 더 하기', ad: { qs: Q, n: 20 } });
    return st;
  }
  function pushToday() {   // 듣기용: 복습·헷갈림·약점 문제와 약한 과목을 앱 듣기에 넘김
    try {
      let due = []; try { due = dueList(); } catch (e) {}
      const acts = diagnose().acts.filter(a => a.k === 'sub' || a.k === 'weak');
      const refs = [...due, ...unsureIds().map(k => BYID[k]), ...(acts.length ? fixSet(acts, 40) : [])].filter(Boolean).map(q => q.id);
      const subs = [...new Set(acts.map(a => a.s).filter(s => s != null))];
      window.NativeBridge && NativeBridge.setToday && NativeBridge.setToday(JSON.stringify({ refs, subs }));
    } catch (e) {}
  }
  function courseRun() {
    const st = COURSE.steps[COURSE.i]; if (!st) return courseDone();
    if (st.memo && window.Memory) { COURSE.active = false; return Memory.open({ onDone: () => { COURSE.i++; courseRun(); } }); }
    const title = `${st.t} · ${COURSE.i + 1}/${COURSE.steps.length}단계`;
    const previous = S;
    if (st.ad) startAdaptive(st.ad.qs, st.ad.n, { from: 'home', title }); else startQuiz(st.qs, { from: 'home', title });
    COURSE.session = S !== previous && cur === 'quiz' ? S : null;
    COURSE.active = !!COURSE.session;
  }
  function courseDone() {
    COURSE.active = false; const t = todayLog();
    celebrate('🎉 오늘 코스 완료!', `오늘 ${t.q || 0}문제 · 🎧 ${Math.round((t.lsec || 0) / 60)}분. 자기 전에 🎧 듣기로 한 번 더 들으면 더 오래 남아요`);
    go('home');
  }
  function courseStart(mode, sleep) {
    COURSE.active = false; COURSE.session = null;
    if (mode === 'memory' && window.Memory) return Memory.open({ all: true });
    if (mode === 'listen') { pushToday(); return openListen('today', sleep || 0, 0); }
    COURSE.steps = buildCourse(mode === 'short');
    if (window.Memory && Memory.dueCount()) COURSE.steps.unshift({ t: '🧠 필수 암기', memo: true });
    COURSE.i = 0; courseRun();
  }
  window.courseStart = courseStart;
  function courseSheet() {
    const [rec, why, sl] = courseRecommend(), st = buildCourse(false), t = todayLog();
    const opt = (k, ic, ttl, sub) => `<button class="cso ${k === rec ? 'rec' : ''}" data-m="${k}"><b>${ic}</b><span><b>${ttl}${k === rec ? ' <em>추천</em>' : ''}</b><small>${sub}</small></span></button>`;
    const o = [opt('solve', '📖', '보면서 풀기', st.map(x => x.t.split(' ')[1]).join(' → ') + ` · ${st.reduce((a, x) => a + (x.qs ? x.qs.length : x.ad.n), 0)}문제`),
      opt('listen', '🎧', '듣기로 진도 빼기', '복습·약점 지문부터 들려줘요. 화면 꺼도 돼요 · 지문 2개 = 1문제로 쳐요'),
      opt('short', '⚡', '10분만', '바쁠 땐 복습·약점 10문제만')];
    if (rec === 'listen') o.unshift(o.splice(1, 1)[0]);
    if (window.Memory) o.push(opt('memory', '🧠', '필수 암기 · 전체 목록', '복습할 카드 ' + Memory.dueCount() + '개 · 빈칸·직접 답하기·기출 적용'));
    const el = document.createElement('div'); el.className = 'kc csheet';
    el.innerHTML = `<div><div class="row"><h3 class="grow">오늘 어떻게 할까요?</h3><button class="btn sm" id="csx">닫기</button></div>
      <div class="muted" style="font-size:13px;margin:2px 0 10px">${why}</div>${o.join('')}
      <div class="muted" style="font-size:12px;margin-top:8px">오늘 ${t.q || 0}문제 풀고 🎧 ${t.ox || 0}지문 들었어요</div></div>`;
    el.onclick = e => { if (e.target === el || e.target.id === 'csx') return el.remove(); const b = e.target.closest('[data-m]'); if (b) { el.remove(); courseStart(b.dataset.m, b.dataset.m === 'listen' ? sl : 0); } };
    document.body.appendChild(el);
  }
  /* 단계가 끝난 결과 화면: 다음 단계 안내 */
  function courseNext() {
    if (cur !== 'result' || !COURSE.active || S !== COURSE.session || document.getElementById('cnext')) return;
    const v = document.getElementById('view'); if (!v) return;
    const nx = COURSE.steps[COURSE.i + 1], dots = COURSE.steps.map((x, k) => `<i class="${k <= COURSE.i ? 'on' : ''}">${x.t.split(' ')[0]}</i>`).join('');
    const cheer = ['좋아요! 리듬 탔어요 💪', '잘하고 있어요 👏', '한 단계 끝! 🔥', '꾸준함이 합격을 만들어요 🌱'][COURSE.i % 4];
    v.insertAdjacentHTML('afterbegin', `<div class="card" id="cnext"><div class="cdots">${dots}</div><b style="font-size:17px">${cheer}</b>
      ${nx ? `<div class="muted" style="font-size:13.5px;margin:4px 0 10px">다음: <b>${nx.t}</b> · ${nx.sub || ''} ${nx.qs ? nx.qs.length + '문제' : ''}</div><button class="go" id="cgo">▶ 계속하기</button>`
           : `<div class="muted" style="font-size:13.5px;margin:4px 0 10px">오늘 코스를 다 끝냈어요!</div><button class="go" id="cgo">🎉 마치기</button>`}
      <button class="btn full" id="cstop" style="margin-top:8px">오늘은 여기까지</button></div>`);
    [...v.querySelectorAll('.card')].forEach(c => { if (/오늘 수준 체크/.test(c.textContent) && c.id !== 'cnext') c.remove(); });   // 코스 중엔 딴 길 안 보이게
    document.getElementById('cgo').onclick = e => { e.currentTarget.disabled = true; COURSE.active = false; COURSE.i++; courseRun(); };
    document.getElementById('cstop').onclick = () => { COURSE.active = false; go('home'); };
  }
  setInterval(courseNext, 400);
  function setPanel(v) {
    let p = document.getElementById('setp'); if (p) { p.remove(); return; }
    const nz = document.getElementById('nzp'); if (nz) nz.remove();
    let curT = 'auto'; try { curT = localStorage.getItem('reb_theme') || 'auto'; } catch (e) {}
    const sw = Object.entries(THEMES).map(([k, t]) => {
      const bg = t.bg || 'linear-gradient(135deg,#f6f7f9 50%,#12151b 50%)', pri = t.pri || '#6f9bff', card = t.card || 'transparent';
      return `<button class="thm ${k === curT ? 'on' : ''}" data-t="${k}"><span class="sw" style="background:${bg}"><i style="background:${card}"></i><b style="background:${pri}"></b></span><span class="nm">${t.name}</span><small>${t.sub}</small></button>`;
    }).join('');
    const nv = LATEST && LATEST > v;
    document.body.insertAdjacentHTML('beforeend', `<div id="setp" class="nzp"><div class="nzh"><b>🎨 화면 색</b><button id="spx" aria-label="닫기">✕</button></div>
      <div class="thg">${sw}</div>
      <button id="sph" class="nzoff">📳 터치 진동 ${(() => { try { return !window.NativeBridge || !NativeBridge.hapticOn || NativeBridge.hapticOn(); } catch (e) { return true; } })() ? '켬' : '끔'}</button>
      <button id="spu" class="nzoff">${nv ? '⬇ 새 버전 v' + LATEST + ' 받기' : '지금 v' + v + ' · 업데이트 확인'}</button></div>`);
    p = document.getElementById('setp');
    p.querySelector('#spx').onclick = () => p.remove();
    p.querySelectorAll('.thm').forEach(b => b.onclick = () => { applyTheme(b.dataset.t); p.querySelectorAll('.thm').forEach(x => x.classList.toggle('on', x === b)); });
    p.querySelector('#sph').onclick = e => { try { const nb = NativeBridge, v = !nb.hapticOn(); nb.setHaptic(v); e.target.textContent = '📳 터치 진동 ' + (v ? '켬' : '끔'); if (v) nb.tap(false); } catch (x) {} };
    p.querySelector('#spu').onclick = () => { try { if (nv) NB.update(); else { if (window.__toast) window.__toast('새 버전 확인 중…'); NB.checkUpdate(); } } catch (e) {} p.remove(); };
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
  // 듣기 화면에서 돌아오면 아래 탭 선택 표시를 지금 화면에 맞게
  window.__refreshStudy = () => { if (cur === 'home') home(); };
  window.__fixTab = () => { try { const n = document.getElementById('tabs'); if (!n || typeof TABOF === 'undefined') return;
    const t = (cur === 'quiz' || cur === 'result') ? ((S && S.from) === 'home' ? 'home' : (S && S.from) === 'wrong' ? 'wrong' : 'setup') : TABOF[cur] || 'home';
    n.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === t)); } catch (e) {} };
  window.__upd = v => { LATEST = +v || 0; updBanner(); };

  // 위쪽 제목 줄 오른쪽에 작은 아이콘으로 (내용을 가리지 않게, 어느 화면에서나 같은 자리)
  function hdrPut(b) {
    const top = document.querySelector('header.top'); if (!top) { document.body.appendChild(b); return; }
    let g = document.getElementById('hdrb'); if (!g) { g = document.createElement('div'); g.id = 'hdrb'; top.appendChild(g); }
    const v = document.getElementById('ver'); g.appendChild(b); if (v) top.appendChild(v);
  }
  /* ---------- 해설 군더더기 숨기기: 계산 문제가 아니면 '풀이 순서·공식'(보기마다 같은 말 반복)과 '보기 정리'(이미 보기 밑에 나옴), 맨 아래 안내문 ---------- */
  function trimEx() {
    const q = (typeof S !== 'undefined' && S && S.list) ? S.list[S.i] : null; if (cur !== 'quiz' || !q) return;
    const ex = document.querySelector('#aibox .ex'); if (!ex || ex.dataset.trim) return; ex.dataset.trim = 1;
    const calc = typeof isCalc === 'function' && isCalc(q), annotated = !!document.querySelector('#view .chx .why, #view .chx');
    let hide = false;
    [...ex.children].forEach(el => {
      if (el.classList.contains('exh')) { const t = el.textContent; hide = (!calc && /풀이 순서|공식/.test(t)) || (annotated && /보기 정리/.test(t)); }
      else if (/^(exm|ext|exw|exs|exa|dg)$/.test(el.className.split(' ')[0])) hide = false;
      if (el.classList.contains('muted') && /참고용/.test(el.textContent)) { el.style.display = 'none'; return; }
      if (hide) el.style.display = 'none';
    });
  }
  setInterval(trimEx, 500);


  /* ---------- 🎨 화면 색 테마 (기록 탭 맨 아래에서 고르기) ---------- */
  const DK = { ok: '#4cc17d', okb: '#163324', no: '#ff7676', nob: '#3a1d1f', warn: '#f0b638', warnb: '#3a2f14' };
  const LT = { ok: '#1f9d55', okb: '#e6f6ec', no: '#d64545', nob: '#fdeaea', warn: '#c98a00', warnb: '#fff6e0' };
  const THEMES = {
    auto:     { name: '자동', sub: '폰 설정 따라' },
    night:    { name: '밤하늘', sub: '기본 어두운', dark: 1, bg: '#12151b', card: '#1b1f27', ink: '#e8ebf1', sub2: '#9aa3b5', line: '#2c3240', pri: '#6f9bff', pri2: '#1f2a44', pri3: '#4a7be0' },
    sea:      { name: '깊은 바다', sub: '남색·청록', dark: 1, bg: '#0b1220', card: '#121b2e', ink: '#e5ecf7', sub2: '#8fa0bd', line: '#22304a', pri: '#14a39a', pri2: '#0f2f33', pri3: '#2dd4bf' },
    forest:   { name: '숲', sub: '눈이 편한 초록', dark: 1, bg: '#0f1714', card: '#17211d', ink: '#e6efe9', sub2: '#93a59b', line: '#263630', pri: '#34a46f', pri2: '#163126', pri3: '#5fcf98' },
    paper:    { name: '종이', sub: '따뜻한 미색', bg: '#f4efe6', card: '#fbf8f2', ink: '#3b3127', sub2: '#85776a', line: '#e3d9ca', pri: '#b5651d', pri2: '#f3e3d0', pri3: '#d08a3c' },
    lavender: { name: '라벤더', sub: '부드러운 보라', bg: '#f5f4fb', card: '#ffffff', ink: '#2a2540', sub2: '#726b8c', line: '#e4e1f1', pri: '#6d4fd8', pri2: '#ece7fd', pri3: '#9b7bf0' },
    day:      { name: '맑은 낮', sub: '기본 밝은', bg: '#f6f7f9', card: '#ffffff', ink: '#1d2433', sub2: '#6b7385', line: '#e3e6ec', pri: '#2457c5', pri2: '#e8eefb', pri3: '#4a7be0' }
  };
  function themeCss(k) {
    const t = THEMES[k]; if (!t || !t.bg) return '';
    const st = t.dark ? DK : LT;
    return `:root:root{--bg:${t.bg};--card:${t.card};--ink:${t.ink};--sub:${t.sub2};--line:${t.line};--pri:${t.pri};--pri2:${t.pri2};--pri3:${t.pri3};--ok:${st.ok};--okb:${st.okb};--no:${st.no};--nob:${st.nob};--warn:${st.warn};--warnb:${st.warnb};color-scheme:${t.dark ? 'dark' : 'light'}} body{background:var(--bg);color:var(--ink)}`;
  }
  function applyTheme(k) {
    let el = document.getElementById('themecss'); if (!el) { el = document.createElement('style'); el.id = 'themecss'; document.head.appendChild(el); }
    el.textContent = themeCss(k);
    try { localStorage.setItem('reb_theme', k); } catch (e) {}
    try { const t = THEMES[k], nb = window.NativeBridge; if (nb && nb.setTheme) nb.setTheme(t && t.bg ? JSON.stringify(t) : ''); } catch (e) {}   // 듣기 화면도 같은 색
  }
  try { applyTheme(localStorage.getItem('reb_theme') || 'auto'); } catch (e) {}
  function themeCard() {
    if (document.getElementById('themec')) return;
    const view = document.getElementById('view'); if (!view) return;
    let curT = 'auto'; try { curT = localStorage.getItem('reb_theme') || 'auto'; } catch (e) {}
    const sw = Object.entries(THEMES).map(([k, t]) => {
      const bg = t.bg || 'linear-gradient(135deg,#f6f7f9 50%,#12151b 50%)', pri = t.pri || '#6f9bff', card = t.card || 'transparent';
      return `<button class="thm ${k === curT ? 'on' : ''}" data-t="${k}"><span class="sw" style="background:${bg}"><i style="background:${card}"></i><b style="background:${pri}"></b></span><span class="nm">${t.name}</span><small>${t.sub}</small></button>`;
    }).join('');
    view.insertAdjacentHTML('beforeend', `<div class="card" id="themec"><h3 style="margin:0 0 10px">🎨 화면 색</h3><div class="thg">${sw}</div></div>`);
    view.querySelectorAll('#themec .thm').forEach(b => b.onclick = () => { applyTheme(b.dataset.t); view.querySelectorAll('#themec .thm').forEach(x => x.classList.toggle('on', x === b)); });
  }
  /* ---------- 🔊 말해주기: 모든 화면 오른쪽 아래, 눈 감고 듣기 ---------- */
  function sayClean(t) {
    return String(t || '')
      .replace(/\s*\([\u4e00-\u9fff]+\)/g, '')
      .replace(/[①②③④⑤]/g, c => (MK5.indexOf(c) + 1) + '번, ')
      .replace(/\\[a-zA-Z]+\{?|[{}^_$\\]/g, ' ')
      .replace(/(^|\s)[OＯ○](?=\s|$)/g, '$1오').replace(/(^|\s)[XＸ×✕](?=\s|$)/g, '$1엑스')
      .replace(/[→⇒]/g, ', ').replace(/[·•|]/g, ', ').replace(/[★☆]+/g, '')
      .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
      .replace(/\s*\n+\s*/g, '. ').replace(/\s{2,}/g, ' ').replace(/(\.\s*){2,}/g, '. ').trim();
  }
  // 화면 글자 → 읽을 조각들 [{t: 읽을 말, el: 화면에서 그 부분}]
  function findEl(root, raw, label) {
    if (!root) return null;
    const nz = t => String(t || '').replace(/[^가-힣0-9a-zA-Z]/g, '');
    const key = nz(raw).slice(0, 10);
    let best = null;
    if (key.length >= 4) root.querySelectorAll('*').forEach(e => { const tx = nz(e.textContent); if (tx.includes(key) && (!best || tx.length <= nz(best.textContent).length)) best = e; });
    if (!best && label) root.querySelectorAll('b, h3, h4, .t, strong').forEach(e => { if (!best && (e.textContent || '').includes(label)) best = e.parentElement; });
    return best || root;
  }
  function screenScript() {
    const view = document.getElementById('view'); if (!view) return [];
    const q = (typeof S !== 'undefined' && S && S.list) ? S.list[S.i] : null;
    const seg = [], add = (raw, el) => { const t = sayClean(raw); if (t) seg.push({ t, el }); };
    if (cur === 'quiz' && q) {
      const qt = view.querySelector('.qtext');
      const lines = q.x.split('\n'), idx = lines.findIndex(l => /^\s*①/.test(l));
      add(idx > 0 ? lines.slice(0, idx).join(' ') : q.x, view.querySelector('.qstem') || qt);
      if (idx > 0) {
        const ch = []; lines.slice(idx).forEach(l => { if (/^\s*[①②③④⑤]/.test(l)) ch.push(l); else if (ch.length) ch[ch.length - 1] += ' ' + l; });
        const els = view.querySelectorAll('.qtext .elc, .chx');
        ch.forEach((c, k) => add(c, els[k] || findEl(qt, c.replace(/^\s*[①②③④⑤]\s*/, ''))));
      }
      const pick = S.ans[q.id], ex = S.exam && !S.done;
      if (pick && !ex) {
        const ans = String(q.a).split(',').map(Number), pk = +pick, ok = ans.includes(pk);
        add((ok ? '맞았어요. ' : '틀렸어요. ') + '정답은 ' + ans.join('번, ') + '번이에요.', view.querySelector('.fb.top') || view.querySelector('.fb'));
        const ab = document.getElementById('aibox'), e = expOf(q);
        if (e) {
          if (e.summary) add(e.summary, () => findEl(document.getElementById('aibox'), e.summary, '💡'));
          const ch = e.choices && e.choices[ans[0] - 1];
          if (ch && ch.why) add('정답 풀이. ' + ch.why, () => findEl(document.getElementById('aibox'), ch.why));
          if (!ok && e.choices && e.choices[pk - 1] && e.choices[pk - 1].why) add('내가 고른 ' + pk + '번. ' + e.choices[pk - 1].why, () => findEl(document.getElementById('aibox'), e.choices[pk - 1].why));
          if (e.concept) add('핵심 개념. ' + e.concept, () => findEl(document.getElementById('aibox'), e.concept, '핵심 개념'));
          if (e.memo) (Array.isArray(e.memo) ? e.memo : [e.memo]).forEach((m, k) => add((k ? '' : '암기. ') + m, () => findEl(document.querySelector('#aibox .exm') || document.getElementById('aibox'), m, '암기')));
          if (e.trap) add('함정. ' + e.trap, () => document.querySelector('#aibox .ext') || findEl(document.getElementById('aibox'), e.trap));
        } else if (ab && ab.textContent.trim().length > 20) add(ab.innerText, ab);
        const mt = document.querySelector('#moreBox .fb'); if (mt && mt.textContent.trim()) add('더 자세히. ' + mt.textContent, mt);
      }
      return seg;
    }
    // 다른 화면: 위에서부터 카드 3개, 줄마다 그 줄이 있는 곳 표시
    const cards = [...view.querySelectorAll('.card, .hero, #mgr')].filter(c => !c.closest('.card .card')).slice(0, 3);
    let n = 0;
    (cards.length ? cards : [view]).forEach(c => {
      let t = c.innerText;
      c.querySelectorAll('button, select, input').forEach(x => { const bt = (x.innerText || x.value || '').trim(); if (bt) t = t.replace(bt, ' '); });
      t.split('\n').map(l => l.trim()).filter(l => l.length > 2 && !/^[\d\s.%,·:/■-]+$/.test(l) && !/^막대|^(월|화|수|목|금|토|일)$|보기$|보기 \(/.test(l))
        .forEach(l => { if ((n += l.length) < 700) add(l, findEl(c, l)); });
    });
    return seg;
  }
  function sayMark(el) {
    document.querySelectorAll('.rdg').forEach(x => x.classList.remove('rdg'));
    if (!el) return; el.classList.add('rdg');
    try { const r = el.getBoundingClientRect(); if (r.top < 70 || r.bottom > innerHeight - 90) { if (r.height > innerHeight * .55) window.scrollBy({ top: r.top - 80, behavior: 'smooth' }); else el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } } catch (e) {}
  }
  const SAY = { on: false };
  // 조각들을 차례로 읽고, 읽는 곳을 강조 (조각의 el 은 요소 또는 요소를 돌려주는 함수, open 은 읽기 직전에 할 일)
  function sayRun(seg, b, idle) {
    const T = window.__tts; if (!T) return;
    const lines = []; seg.forEach(sg => { let buf = ''; sg.t.split(/(?<=[.?!요다])\s+/).forEach(x => { if (buf && (buf + ' ' + x).length > 500) { lines.push({ text: buf, el: sg.el, open: sg.open }); buf = x; } else buf = buf ? buf + ' ' + x : x; }); if (buf) lines.push({ text: buf, el: sg.el, open: sg.open }); });
    SAY.on = true; SAY.lines = lines; SAY.btn = b; b.classList.add('on'); b.textContent = '⏹';
    if (!SAY.hooked && T.onLine) { SAY.hooked = true; T.onLine(({ line }) => { const L = SAY.on && SAY.lines && SAY.lines[line]; if (!L) return; try { L.open && L.open(); } catch (e) {} sayMark(typeof L.el === 'function' ? L.el() : L.el); }); }
    T.speak(lines.map(x => ({ text: x.text })), {}).catch(e => { if (e && e.code !== 'viewer_stopped' && window.__toast) __toast(e.message); })
      .finally(() => { SAY.on = false; SAY.lines = null; sayMark(null); b.classList.remove('on'); b.textContent = idle; });
  }
  function sayStop() { const T = window.__tts; SAY.on = false; sayMark(null); try { T && T.stop(); } catch (e) {} if (SAY.btn) { SAY.btn.classList.remove('on'); } }
  function sayBtn() {
    let b = document.getElementById('say');
    if (!b) {
      b = document.createElement('button'); b.id = 'say'; b.setAttribute('aria-label', '화면 읽어 주기'); b.textContent = '🔊';
      hdrPut(b);
      b.onclick = () => {
        const T = window.__tts;
        if (!T) { if (window.__toast) __toast('읽기를 쓸 수 없어요'); return; }
        if (SAY.on || T.busy()) { SAY.on = false; sayMark(null); try { T.stop(); } catch (e) {} b.classList.remove('on'); b.textContent = '🔊'; if (window.__toast) __toast('읽기를 멈췄어요'); return; }
        // 해설까지 읽을 때는 해설을 화면에 펼쳐 두고 읽기(보이는 것과 듣는 것이 같게)
        try { const q = S.list[S.i]; if (cur === 'quiz' && q && S.ans[q.id] && !(S.exam && !S.done) && expOf(q)) { const ab = document.getElementById('aibox'); if (ab && ab.textContent.trim().length < 20) { const qa = document.getElementById('qa'); if (qa) qa.click(); } } } catch (e) {}
        let seg = screenScript(); if (!seg.length) seg = [{ t: '이 화면은 고르는 버튼만 있어요. 문제를 시작하면 문제와 보기, 해설을 읽어 드릴게요.', el: null }];
        sayRun(seg, b, '🔊');
      };
    }
  }
  sayBtn();

  /* ---------- 📝 필기장: 문제마다 따로 저장되는 그리기·메모 (화면 한쪽 작은 버튼) ---------- */
  const PAD = window.__PAD = { open: false, key: '', strokes: [], cur: null, color: 'ink', w: 3, tool: 'pen', snap: true, hist: [], redo: [], tab: 'draw', v: { s: 1, ox: 0, oy: 0 } };
  const padKey = () => { const q = (cur === 'quiz' && typeof S !== 'undefined' && S && S.list) ? S.list[S.i] : null; return q ? q.id : 'free'; };
  const padLoad = k => { try { return JSON.parse(localStorage.getItem('reb_pad_' + k) || '[]'); } catch (e) { return []; } };
  function padSave() {
    try {
      const k = PAD.key, t = (document.getElementById('padt') || {}).value || '';
      if (PAD.strokes.length) localStorage.setItem('reb_pad_' + k, JSON.stringify(PAD.strokes)); else localStorage.removeItem('reb_pad_' + k);
      if (t.trim()) localStorage.setItem('reb_padt_' + k, t); else localStorage.removeItem('reb_padt_' + k);
      const ix = JSON.parse(localStorage.getItem('reb_pad_ix') || '[]').filter(x => x !== k);
      if (PAD.strokes.length || t.trim()) ix.push(k);
      while (ix.length > 300) { const o = ix.shift(); localStorage.removeItem('reb_pad_' + o); localStorage.removeItem('reb_padt_' + o); }
      localStorage.setItem('reb_pad_ix', JSON.stringify(ix));
    } catch (e) { if (window.__toast) __toast('필기 저장 공간이 꽉 찼어요. 🗑로 지운 뒤 써 주세요'); }
    padDot();
  }
  function padDot() {
    const b = document.getElementById('padb'); if (!b) return;
    let has = false; try { const k = padKey(); has = !!(localStorage.getItem('reb_pad_' + k) || localStorage.getItem('reb_padt_' + k)); } catch (e) {}
    b.classList.toggle('has', has);
  }
  /* 손으로 그린 선 → 곧은 선·네모·동그라미 (force: 못 알아보면 곧은 선으로) */
  function padShape(st, cv, force) {
    const r = cv.getBoundingClientRect(), W = r.width, H = r.height;
    const P = st.p.map(q => [q[0] * W, q[1] * H]); if (P.length < 3) return;
    let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const a = P[0], b = P[P.length - 1], D = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const xs = P.map(q => q[0]), ys = P.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), bw = x1 - x0, bh = y1 - y0;
    const N = pts => pts.map(q => [Math.round(q[0] / W * 10000) / 10000, Math.round(q[1] / H * 10000) / 10000]);
    const line = () => {   // 수평·수직·45도 근처면 딱 맞춤
      let ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const step = Math.PI / 4, near = Math.round(ang / step) * step;
      if (Math.abs(ang - near) < .12) ang = near;
      st.p = N([a, [a[0] + Math.cos(ang) * D, a[1] + Math.sin(ang) * D]]); st.s = 'line';
    };
    if (L < 12) return;
    if (D / L > .88) return line();
    const closed = D < Math.max(bw, bh) * .25 && bw > 16 && bh > 16;
    if (closed) {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const rr = P.map(q => Math.hypot((q[0] - cx) / (bw / 2), (q[1] - cy) / (bh / 2)));
      const m = rr.reduce((s, v) => s + v, 0) / rr.length, sd = Math.sqrt(rr.reduce((s, v) => s + (v - m) ** 2, 0) / rr.length);
      const edge = P.filter(q => Math.min(Math.abs(q[0] - x0), Math.abs(q[0] - x1)) < bw * .12 || Math.min(Math.abs(q[1] - y0), Math.abs(q[1] - y1)) < bh * .12).length / P.length;
      if (edge > .8 && sd > .09) { st.p = N([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]); st.s = 'rect'; return; }
      if (sd < .16) {   // 동그라미 (가로세로 비슷하면 정원)
        let rx = bw / 2, ry = bh / 2; if (Math.abs(rx - ry) / Math.max(rx, ry) < .15) rx = ry = (rx + ry) / 2;
        const out = []; for (let i = 0; i <= 48; i++) { const t = i / 48 * Math.PI * 2; out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]); }
        st.p = N(out); st.s = 'oval'; return;
      }
    }
    if (force) line();
  }
  /* 확대·축소·이동: 화면 좌표 = (그림 좌표 − ox,oy) × 크기 × s */
  function padBox() {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    PAD.strokes.forEach(st => st.p.forEach(q => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }));
    return x0 > x1 ? null : [x0, y0, x1, y1];
  }
  function padFit(onlyOut) {   // 그린 것이 다 보이게
    const b = padBox(), v = PAD.v;
    if (!b) { PAD.v = { s: 1, ox: 0, oy: 0 }; return; }
    if (b[0] >= 0 && b[1] >= 0 && b[2] <= 1 && b[3] <= 1 && !onlyOut) { PAD.v = { s: 1, ox: 0, oy: 0 }; return; }
    const m = .06, need = Math.min(1 / ((b[2] - b[0]) + m * 2), 1 / ((b[3] - b[1]) + m * 2));
    const s = Math.max(.2, Math.min(onlyOut ? v.s : 1, need));
    PAD.v = { s, ox: (b[0] + b[2]) / 2 - .5 / s, oy: (b[1] + b[3]) / 2 - .5 / s };
  }
  function padZoom(f, cx = .5, cy = .5) {   // cx,cy: 화면 비율 위치를 중심으로
    const v = PAD.v, ns = Math.max(.2, Math.min(5, v.s * f));
    const wx = v.ox + cx / v.s, wy = v.oy + cy / v.s;
    PAD.v = { s: ns, ox: wx - cx / ns, oy: wy - cy / ns }; padDraw();
  }
  window.padZoom = padZoom;
  function padDraw() {
    const cv = document.getElementById('padc'); if (!cv) return;
    const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(r.width * d) || cv.height !== Math.round(r.height * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
    const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, r.width, r.height);
    g.lineCap = g.lineJoin = 'round';
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#e8ebf1';
    const V = PAD.v, W = r.width, H = r.height, X = x => (x - V.ox) * W * V.s, Y = y => (y - V.oy) * H * V.s;
    // 모눈 (확대에 맞춰)
    const gs = 24 * V.s; if (gs > 5) {
      g.strokeStyle = 'rgba(148,163,184,.14)'; g.lineWidth = 1; g.beginPath();
      for (let x = ((-V.ox * W * V.s) % gs + gs) % gs; x < W; x += gs) { g.moveTo(x, 0); g.lineTo(x, H); }
      for (let y = ((-V.oy * H * V.s) % gs + gs) % gs; y < H; y += gs) { g.moveTo(0, y); g.lineTo(W, y); }
      g.stroke();
    }
    const zl = document.getElementById('padzl'); if (zl) zl.textContent = Math.round(V.s * 100) + '%';
    PAD.strokes.concat(PAD.cur ? [PAD.cur] : []).forEach(st => {
      const k = st.k || 'pen', pts = st.p.map(q => [X(q[0]), Y(q[1])]);
      g.save();
      if (k === 'text') {   // 풀이 도식의 글자
        const fs = st.w * V.s; g.fillStyle = st.c === 'ink' ? ink : st.c; g.font = `${st.b ? '700 ' : ''}${fs}px sans-serif`;
        g.textAlign = st.al || 'left'; g.textBaseline = 'middle';
        const L = String(st.t || '').split('\n'); L.forEach((ln, i) => g.fillText(ln, pts[0][0], pts[0][1] + (i - (L.length - 1) / 2) * fs * 1.25));
        g.restore(); return;
      }
      g.globalCompositeOperation = st.e ? 'destination-out' : 'source-over';   // 예전 지우개 획
      g.strokeStyle = g.fillStyle = st.c === 'ink' || st.c === '#e8ebf1' ? ink : st.c;
      g.lineWidth = (st.e ? 22 : k === 'hl' ? st.w * 4 + 6 : st.w) * V.s;
      if (k === 'hl') { g.globalAlpha = .35; g.lineCap = 'butt'; }
      if (k === 'dash') g.setLineDash([st.w * 3 + 4, st.w * 2 + 5]);
      g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]));
      if (pts.length === 1) g.lineTo(pts[0][0] + .1, pts[0][1]);
      g.stroke();
      if (k === 'arrow' && pts.length > 1) {   // 화살촉
        const b = pts[pts.length - 1], a = pts[Math.max(0, pts.length - 4)], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), h = (8 + st.w * 2.2) * V.s;
        g.setLineDash([]); g.beginPath(); g.moveTo(b[0], b[1]);
        g.lineTo(b[0] - h * Math.cos(ang - .45), b[1] - h * Math.sin(ang - .45)); g.lineTo(b[0] - h * Math.cos(ang + .45), b[1] - h * Math.sin(ang + .45)); g.closePath(); g.fill();
      }
      g.restore();
    });
  }
  function padSwitch() {
    const k = padKey(); if (k === PAD.key) return;
    if (PAD.key) padSave();
    PAD.key = k; PAD.strokes = padLoad(k); PAD.cur = null; PAD.hist = []; PAD.redo = []; padFit(); if (PAD.paint) PAD.paint();
    const t = document.getElementById('padt'); if (t) { try { t.value = localStorage.getItem('reb_padt_' + k) || ''; } catch (e) { t.value = ''; } }
    const lb = document.getElementById('padk'); if (lb) lb.textContent = k === 'free' ? '자유 필기' : k.replace(/^(\d+)-(\d)(\d)-(\d+)$/, '$1회 $4번') + ' 필기';
    padDraw();
  }
  function padTab(t) {
    PAD.tab = t; const p = document.getElementById('pad'); if (!p) return;
    p.querySelectorAll('[data-pt]').forEach(b => b.classList.toggle('on', b.dataset.pt === t));
    p.querySelector('.pdraw').style.display = t === 'draw' ? '' : 'none'; p.querySelector('#padt').style.display = t === 'memo' ? '' : 'none';
    if (t === 'draw') requestAnimationFrame(padDraw);
  }
  function padOpen(on) {
    PAD.open = on; let p = document.getElementById('pad');
    if (!on) { if (p) { padSave(); p.classList.remove('show'); } document.body.classList.remove('padon'); return; }
    if (!p) {
      document.body.insertAdjacentHTML('beforeend', `<div id="pad">
        <div class="ph"><b id="padk"></b><span class="sp"></span><button data-pt="draw">✏️ 그리기</button><button data-pt="memo">⌨️ 글</button><button id="padx" aria-label="닫기">✕</button></div>
        <div class="pdraw"><div class="pt">
          <button class="pk on" data-k="pen" title="펜">✏️</button><button class="pk" data-k="hl" title="형광펜">🖍</button><button class="pk" data-k="dash" title="점선">┅</button><button class="pk" data-k="arrow" title="화살표">➝</button><button class="pk" data-k="erase" title="지우개 (닿은 획을 지워요)">🧽</button>
          <span class="sp"></span><button id="padu" title="되돌리기">↶</button><button id="padr" title="다시">↷</button><button id="padz" title="모두 지우기">🗑</button></div>
          <div class="pt" style="flex-wrap:nowrap">
          <button class="pc" data-c="ink" style="--c:var(--ink)"></button><button class="pc" data-c="#ef4444" style="--c:#ef4444"></button><button class="pc" data-c="#3b82f6" style="--c:#3b82f6"></button><button class="pc" data-c="#22c55e" style="--c:#22c55e"></button><button class="pc" data-c="#f59e0b" style="--c:#f59e0b"></button>
          <input id="padw" type="range" min="1" max="14" step="1" title="굵기"><i id="padwv"></i>
          <button id="pads" title="그린 선을 곧은 선·네모·동그라미로 맞춰요. 끝에서 펜을 잠깐 멈춰도 맞춰져요">📐</button><button id="padp" title="손바닥이 닿아도 선이 안 그어져요">✋</button></div>
          <div class="pcw"><canvas id="padc"></canvas><div class="pzm"><button id="padzo" aria-label="축소">－</button><button id="padzl" title="전체 보기">100%</button><button id="padzi" aria-label="확대">＋</button></div></div></div>
        <textarea id="padt" placeholder="풀이 메모를 적어 두세요. 문제마다 따로 저장돼요."></textarea></div>`);
      p = document.getElementById('pad');
      p.querySelector('#padx').onclick = () => padOpen(false);
      p.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => padTab(b.dataset.pt));
      // 설정 기억: 도구·색·굵기·도형 보정·손바닥 무시
      const LS = (k, d) => { try { const v = localStorage.getItem('reb_pad_' + k); return v == null ? d : v; } catch (e) { return d; } };
      const SS = (k, v) => { try { localStorage.setItem('reb_pad_' + k, v); } catch (e) {} };
      PAD.tool = LS('tool', 'pen'); PAD.color = LS('color', 'ink'); PAD.w = +LS('w', 3); PAD.snap = LS('snap', '1') === '1';
      try { PAD.palm = localStorage.getItem('reb_palm') !== '0'; } catch (e) { PAD.palm = true; }
      const paint = () => {
        p.querySelectorAll('.pk').forEach(b => b.classList.toggle('on', b.dataset.k === PAD.tool));
        p.querySelectorAll('.pc').forEach(b => b.classList.toggle('on', b.dataset.c === PAD.color));
        p.querySelector('#padw').value = PAD.w; p.querySelector('#padwv').textContent = PAD.w;
        p.querySelector('#pads').classList.toggle('on', PAD.snap); p.querySelector('#padp').classList.toggle('on', PAD.palm);
        p.querySelector('#padu').disabled = !PAD.hist.length; p.querySelector('#padr').disabled = !PAD.redo.length;
      };
      PAD.paint = paint; PAD.hist = []; PAD.redo = [];
      p.querySelectorAll('.pk').forEach(b => b.onclick = () => { PAD.tool = b.dataset.k; SS('tool', PAD.tool); paint(); });
      p.querySelectorAll('.pc').forEach(b => b.onclick = () => { PAD.color = b.dataset.c; if (PAD.tool === 'erase') PAD.tool = 'pen'; SS('color', PAD.color); SS('tool', PAD.tool); paint(); });
      p.querySelector('#padw').oninput = e => { PAD.w = +e.target.value; SS('w', PAD.w); paint(); };
      p.querySelector('#pads').onclick = () => { PAD.snap = !PAD.snap; SS('snap', PAD.snap ? '1' : '0'); paint(); };
      p.querySelector('#padp').onclick = () => { PAD.palm = !PAD.palm; try { localStorage.setItem('reb_palm', PAD.palm ? '1' : '0'); } catch (x) {} paint(); window.__toast && __toast(PAD.palm ? '✋ 손바닥 무시 켬' : '✋ 손바닥 무시 끔'); };
      const snapshot = () => { PAD.hist.push(JSON.stringify(PAD.strokes)); if (PAD.hist.length > 40) PAD.hist.shift(); PAD.redo = []; };
      p.querySelector('#padu').onclick = () => { if (!PAD.hist.length) return; PAD.redo.push(JSON.stringify(PAD.strokes)); PAD.strokes = JSON.parse(PAD.hist.pop()); padDraw(); padSave(); paint(); };
      p.querySelector('#padr').onclick = () => { if (!PAD.redo.length) return; PAD.hist.push(JSON.stringify(PAD.strokes)); PAD.strokes = JSON.parse(PAD.redo.pop()); padDraw(); padSave(); paint(); };
      p.querySelector('#padz').onclick = () => { if (!PAD.strokes.length && !p.querySelector('#padt').value) return; if (confirm('이 문제의 필기를 모두 지울까요?')) { snapshot(); PAD.strokes = []; p.querySelector('#padt').value = ''; padDraw(); padSave(); paint(); } };
      p.querySelector('#padt').addEventListener('input', () => { clearTimeout(PAD.tt); PAD.tt = setTimeout(padSave, 600); });
      const cv = p.querySelector('#padc');
      const pos = e => { const r = cv.getBoundingClientRect(), V = PAD.v; return [(e.clientX - r.left) / (r.width * V.s) + V.ox, (e.clientY - r.top) / (r.height * V.s) + V.oy]; };
      p.querySelector('#padzi').onclick = () => padZoom(1.25); p.querySelector('#padzo').onclick = () => padZoom(.8);
      p.querySelector('#padzl').onclick = () => { padFit(); padDraw(); };
      const T = new Map(); let pinch = null;   // 두 손가락: 벌리면 확대, 모으면 축소, 끌면 이동
      const R4 = v => Math.round(v * 10000) / 10000;
      const palmy = e => PAD.palm && e.pointerType === 'touch' && ((e.width || 0) > 38 || (e.height || 0) > 38);
      // 지우개: 손이 지나간 자리에 닿은 획을 통째로 지움
      const eraseAt = pt => {
        const r = cv.getBoundingClientRect(), s = PAD.v.s, X = pt[0] * r.width * s, Y = pt[1] * r.height * s, rad = 10 + PAD.w * 1.5;
        const keep = PAD.strokes.filter(st => !st.p.some(q => Math.hypot(q[0] * r.width * s - X, q[1] * r.height * s - Y) < rad + (st.w || 3) * s / 2));
        if (keep.length !== PAD.strokes.length) { if (!PAD.erasedOnce) { snapshot(); PAD.erasedOnce = true; } PAD.strokes = keep; padDraw(); }
      };
      let hold = null;
      const pinchStart = () => { const [a, b] = [...T.values()], r = cv.getBoundingClientRect();
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), cx: ((a[0] + b[0]) / 2 - r.left) / r.width, cy: ((a[1] + b[1]) / 2 - r.top) / r.height, v: { ...PAD.v } }; };
      cv.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch' && !palmy(e)) {
          T.set(e.pointerId, [e.clientX, e.clientY]);
          // 두 번째 손가락이 바로(획이 짧을 때) 닿으면 확대·이동, 아니면 손바닥으로 보고 무시
          if (T.size === 2 && (!PAD.cur || PAD.cur.p.length < 6) && !PAD.erasing) { PAD.cur = null; PAD.pid = null; clearTimeout(hold); pinchStart(); padDraw(); return; }
        }
        if (pinch) return;
        if (palmy(e) || (PAD.cur && PAD.pid !== e.pointerId)) return;
        PAD.pid = e.pointerId; cv.setPointerCapture(e.pointerId);
        if (PAD.tool === 'erase') { PAD.erasing = true; PAD.erasedOnce = false; eraseAt(pos(e)); return; }
        PAD.cur = { c: PAD.color, w: PAD.w, k: PAD.tool, p: [pos(e)] }; padDraw();
      });
      cv.addEventListener('pointermove', e => {
        if (T.has(e.pointerId)) T.set(e.pointerId, [e.clientX, e.clientY]);
        if (pinch && T.size >= 2) {
          const [a, b] = [...T.values()], r = cv.getBoundingClientRect(), v0 = pinch.v;
          const ns = Math.max(.2, Math.min(5, v0.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / (pinch.d || 1)));
          const cx = ((a[0] + b[0]) / 2 - r.left) / r.width, cy = ((a[1] + b[1]) / 2 - r.top) / r.height;
          const wx = v0.ox + pinch.cx / v0.s, wy = v0.oy + pinch.cy / v0.s;   // 처음 두 손가락 가운데 있던 곳이 손가락을 따라옴
          PAD.v = { s: ns, ox: wx - cx / ns, oy: wy - cy / ns }; padDraw(); return;
        }
        if (e.pointerId !== PAD.pid) return;
        if (PAD.erasing) return eraseAt(pos(e));
        if (!PAD.cur) return;
        const pt = pos(e), c = PAD.cur;
        if (c.fixed) { if (c.s === 'line') { c.p[1] = pt.map(R4); padDraw(); } return; }   // 곧게 맞춘 뒤엔 끝점만 따라감
        const l = c.p[c.p.length - 1];
        if (Math.abs(pt[0] - l[0]) + Math.abs(pt[1] - l[1]) > .002) {
          c.p.push(pt.map(R4)); padDraw();
          // 끝에서 펜을 0.5초 멈추면 도형으로 맞춤 (갤럭시 노트처럼)
          clearTimeout(hold); hold = setTimeout(() => { if (PAD.cur === c && c.p.length > 4) { padShape(c, cv, true); c.fixed = 1; padDraw(); } }, 500);
        }
      });
      const end = e => {
        if (e) T.delete(e.pointerId);
        if (pinch) { if (T.size < 2) pinch = null; return; }
        if (e && e.pointerId !== PAD.pid) return;
        clearTimeout(hold);
        if (PAD.erasing) { PAD.erasing = false; padSave(); paint(); return; }
        if (!PAD.cur) return;
        const c = PAD.cur; PAD.cur = null;
        if (!c.fixed && (PAD.snap || c.k === 'arrow')) padShape(c, cv, c.k === 'arrow');
        delete c.fixed; snapshot(); PAD.strokes.push(c);
        // 화면 가장자리까지 차거나 밖으로 나가면 다 보이게 살짝 축소
        const b = padBox(), V = PAD.v, in0 = .04 / V.s;
        if (b && (b[0] < V.ox + in0 || b[1] < V.oy + in0 || b[2] > V.ox + 1 / V.s - in0 || b[3] > V.oy + 1 / V.s - in0)) padFit(true);
        padDraw(); padSave(); paint();
      };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
      paint();
      window.addEventListener('resize', () => PAD.open && padDraw());
    }
    PAD.key = ''; padSwitch(); padTab(PAD.tab);
    document.body.classList.add('padon'); requestAnimationFrame(() => { p.classList.add('show'); padDraw(); });
  }
  function padBtn() {
    if (document.getElementById('padb')) return;
    const b = document.createElement('button'); b.id = 'padb'; b.textContent = '📝'; b.setAttribute('aria-label', '필기장');
    b.onclick = () => padOpen(!PAD.open); hdrPut(b);
  }
  padBtn();
  setInterval(() => { if (PAD.open) padSwitch(); else padDot(); }, 600);

  /* ---------- 🌧 집중 소음(백색소음): 위쪽 버튼으로 켜고 끄기. 소리 파일 없이 폰에서 직접 만들어요 ---------- */
  const NZ = { ctx: null, src: null, gain: null, type: '', vol: .5, buf: {} };
  const NZT = { white: '화이트 노이즈', pink: '부드러운 노이즈', brown: '깊은 노이즈', rain: '빗소리', cafe: '카페', library: '도서관' };
  try { NZ.vol = +(localStorage.getItem('reb_nzv') || .5); } catch (e) {}
  function nzBuild(type) {
    const ctx = NZ.ctx, sr = ctx.sampleRate, sec = type === 'cafe' || type === 'library' ? 30 : 12, n = sr * sec;
    const b = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0, lp = 0, mv = 0;
      const pink = () => { const w = Math.random() * 2 - 1; b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; const o = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362; b6 = w * .115926; return o * .11; };
      const brown = () => { br = (br + .02 * (Math.random() * 2 - 1)) / 1.02; return br * 3.5; };
      for (let i = 0; i < n; i++) {
        let v;
        if (type === 'white') v = (Math.random() * 2 - 1) * .35;
        else if (type === 'pink') v = pink();
        else if (type === 'brown') v = brown();
        else if (type === 'rain') { const p = pink(); lp += (p - lp) * .55; v = (p - lp * .6) * 1.1 + brown() * .25; }
        else if (type === 'cafe') { const p = pink(); lp += (p - lp) * .08; v = brown() * .55 + lp * .9; }      // 웅성임 바탕
        else { v = brown() * .35; }                                                                            // 도서관: 아주 낮은 공조 소리
        d[i] = v;
      }
      // 사건 소리 얹기(빗방울·잔 부딪힘·말소리 덩어리·책장 넘김)
      const add = (at, len, f) => { for (let i = 0; i < len && at + i < n; i++) d[at + i] += f(i / sr, i / len); };
      const R = (a, z) => a + Math.random() * (z - a);
      if (type === 'rain') for (let k = 0; k < sec * 35; k++) { const at = (Math.random() * n) | 0, a = R(.05, .25); add(at, sr * .03 | 0, (t, x) => (Math.random() * 2 - 1) * a * Math.exp(-x * 6)); }
      if (type === 'cafe') {
        for (let k = 0; k < sec * 2.2; k++) {      // 멀리서 들리는 말소리 덩어리(음절 리듬으로 오르내림)
          const at = (Math.random() * n) | 0, len = sr * R(.8, 2.4) | 0, f0 = R(160, 320), syl = R(3.5, 6), a = R(.04, .1); let ph = 0, ly = 0;
          add(at, len, (t, x) => { ph += 2 * Math.PI * f0 * (1 + .08 * Math.sin(t * 7)) / sr; const env = Math.max(0, Math.sin(Math.PI * t * syl)) * Math.sin(Math.PI * x); ly += ((Math.random() * 2 - 1) - ly) * .2; return (Math.sin(ph) * .5 + ly * .7) * env * a; });
        }
        for (let k = 0; k < sec * .5; k++) { const at = (Math.random() * n) | 0, f = R(2400, 4200), a = R(.04, .09); add(at, sr * .35 | 0, (t, x) => Math.sin(2 * Math.PI * f * t) * a * Math.exp(-x * 9) + Math.sin(2 * Math.PI * f * 1.51 * t) * a * .5 * Math.exp(-x * 12)); }
      }
      if (type === 'library') {
        for (let k = 0; k < sec * .12; k++) { const at = (Math.random() * n) | 0, a = R(.05, .1); let l2 = 0; add(at, sr * .35 | 0, (t, x) => { l2 += ((Math.random() * 2 - 1) - l2) * .35; return l2 * a * Math.sin(Math.PI * x) * (1 + Math.sin(x * 30) * .3); }); }     // 책장 넘김
        for (let k = 0; k < sec * .25; k++) { const at = (Math.random() * n) | 0, a = R(.03, .06); add(at, sr * .12 | 0, (t, x) => Math.sin(2 * Math.PI * R(70, 90) * t) * a * Math.exp(-x * 5)); }       // 먼 발소리
      }
      // 이어 붙는 자리 부드럽게
      const fade = sr * .5 | 0; for (let i = 0; i < fade; i++) { const w = i / fade; d[i] = d[i] * w + d[n - fade + i] * (1 - w); }
    }
    return b;
  }
  function nzPlay(type) {
    try {
      if (!NZ.ctx) { NZ.ctx = new (window.AudioContext || window.webkitAudioContext)(); NZ.gain = NZ.ctx.createGain(); NZ.gain.connect(NZ.ctx.destination); }
      if (NZ.ctx.state === 'suspended') NZ.ctx.resume();
      if (NZ.src) { try { NZ.src.stop(); } catch (e) {} NZ.src = null; }
      if (!type) { NZ.type = ''; nzUi(); return; }
      const b = NZ.buf[type] || (NZ.buf[type] = nzBuild(type));
      const s = NZ.ctx.createBufferSource(); s.buffer = b; s.loop = true; s.connect(NZ.gain);
      NZ.gain.gain.setValueAtTime(0, NZ.ctx.currentTime); NZ.gain.gain.linearRampToValueAtTime(nzLevel(), NZ.ctx.currentTime + 1.2);
      s.start(); NZ.src = s; NZ.type = type;
      try { localStorage.setItem('reb_nzt', type); } catch (e) {}
    } catch (e) { if (window.__toast) __toast('이 폰에서는 소음을 만들 수 없어요'); }
    nzUi();
  }
  // 🔊 읽기 중에는 소음을 살짝 줄여 말소리가 잘 들리게
  const nzLevel = () => NZ.vol * NZ.vol * ((window.__tts && __tts.busy && __tts.busy()) ? .35 : 1);
  setInterval(() => { if (NZ.src && NZ.gain) NZ.gain.gain.setTargetAtTime(nzLevel(), NZ.ctx.currentTime, .3); }, 500);
  function nzUi() {
    const b = document.getElementById('nzb'); if (b) { b.classList.toggle('on', !!NZ.type); b.textContent = '🌊'; }
    document.querySelectorAll('#nzp [data-n]').forEach(x => x.classList.toggle('on', x.dataset.n === NZ.type));
  }
  function nzPanel() {
    let p = document.getElementById('nzp'); if (p) { p.remove(); return; } document.getElementById('setp')?.remove();
    let last = 'pink'; try { last = localStorage.getItem('reb_nzt') || 'pink'; } catch (e) {}
    document.body.insertAdjacentHTML('beforeend', `<div id="nzp" class="nzp"><div class="nzh"><b>집중 소음</b><button id="nzx" aria-label="닫기">✕</button></div>
      <div class="nzg">${Object.entries(NZT).map(([k, v]) => `<button data-n="${k}">${v}</button>`).join('')}</div>
      <div class="nzv"><span>소리 크기</span><input id="nzvol" type="range" min="0.05" max="1" step="0.05" value="${NZ.vol}"></div>
      <button id="nzoff" class="nzoff">${NZ.type ? '끄기' : '켜기 (' + NZT[last] + ')'}</button>
      <button id="nzft" class="nzoff">🌳 집중 25분 시작 <small>(다 채우면 나무 한 그루 · 지금 ${trees()}그루)</small></button></div>`);
    p = document.getElementById('nzp');
    p.querySelector('#nzx').onclick = () => p.remove();
    p.querySelectorAll('[data-n]').forEach(x => x.onclick = () => { const k = x.dataset.n === NZ.type ? '' : x.dataset.n; if (k && !NZ.buf[k] && (k === 'cafe' || k === 'library')) { x.textContent = '만드는 중…'; setTimeout(() => { nzPlay(k); x.textContent = NZT[k]; p.querySelector('#nzoff').textContent = NZ.type ? '끄기' : '켜기'; }, 30); return; } nzPlay(k); p.querySelector('#nzoff').textContent = NZ.type ? '끄기' : '켜기'; });
    p.querySelector('#nzvol').oninput = e => { NZ.vol = +e.target.value; try { localStorage.setItem('reb_nzv', NZ.vol); } catch (er) {} if (NZ.gain) NZ.gain.gain.setTargetAtTime(nzLevel(), NZ.ctx.currentTime, .05); };
    p.querySelector('#nzft').onclick = () => { p.remove(); if (!NZ.type) nzPlay(last); focusStart(25); };
    p.querySelector('#nzoff').onclick = () => { nzPlay(NZ.type ? '' : last); p.querySelector('#nzoff').textContent = NZ.type ? '끄기' : '켜기 (' + NZT[last] + ')'; };
    nzUi();
  }
  (function nzBtn() {
    const b = document.createElement('button'); b.id = 'nzb'; b.textContent = '🌊'; b.setAttribute('aria-label', '집중 소음');
    b.onclick = nzPanel; hdrPut(b);
    const g = document.getElementById('hdrb'); if (g && g.firstChild !== b) g.insertBefore(b, g.firstChild);
  })();

  /* ---------- 🐣 처음부터 알려줘: 도저히 모르겠는 문제를 기초부터 (한 번 받으면 저장) ---------- */
  function begRender(t) {
    const esc = x => String(x).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    return t.split('\n').map(l => {
      const b = esc(l).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      if (/^#{1,4}\s/.test(l)) return `<h4 class="bgh">${b.replace(/^#+\s*/, '')}</h4>`;
      if (/^\s*[-•·]\s/.test(l)) return `<div class="bgl">${b.replace(/^\s*[-•·]\s*/, '• ')}</div>`;
      return l.trim() ? `<p class="bgp">${b}</p>` : '';
    }).join('');
  }
  function begPrompt(q) {
    const e = expOf(q) || {};
    return `너는 법률·부동산을 처음 배우는 사람을 가르치는 공인중개사 강사야. 아래 기출문제를 아무 기초 지식이 없는 사람도 이해하도록 처음부터 차근차근 설명해 줘. 해요체, 쉬운 말, 생활 속 예시를 들어.
아래 제목과 순서를 꼭 지켜(제목 줄은 '## '로 시작):
## 이 문제가 묻는 것
(2~3문장)
## 먼저 알아야 할 낱말
(문제에 나온 어려운 용어 3~6개를 '- 용어: 쉬운 풀이와 예시' 형식으로)
## 기본 원리
(이 단원의 핵심 규칙을 비유와 예시로 4~6문장)
## 보기 하나씩
('- ① 맞아요/틀려요: 이유' 형식으로 ①~⑤ 모두, 틀린 보기는 어디를 어떻게 고치면 맞는지)
## 정답 찾는 순서
(이런 문제를 만나면 어떻게 생각하면 되는지 3단계, '- 1단계: …')
## 한 줄로 기억하기
(한 문장)
한자·영어 약어는 풀어 쓰고, 확실하지 않은 법 내용은 지어내지 마. 아래 정답과 참고 해설을 기준으로 해.
[정답] ${q.a}번
[문제]
${q.x}
[참고 해설] ${[e.summary, e.concept].filter(Boolean).join(' ')}`;
  }
  function decorateBeg() {
    const q = (typeof S !== 'undefined' && S && S.list) ? S.list[S.i] : null;
    // 자리: '더 자세히' 바로 아래(없으면 도구 버튼 줄 아래). 해설을 펼치면 '더 자세히'가 생기니 그때 옮김
    const ex0 = document.getElementById('beg'), mb = document.getElementById('moreBox');
    if (ex0 && mb && mb.nextElementSibling !== ex0 && !document.querySelector('#view .xtabs')) { const bx = document.getElementById('begBox'); mb.after(ex0); if (bx) ex0.after(bx); }
    if (cur !== 'quiz' || !q || !S.ans[q.id] || (S.exam && !S.done) || ex0) return;
    const tb = document.querySelector('.qtb'); if (!tb) return;
    const K = 'reb_beg_' + q.id, saved = (() => { try { return localStorage.getItem(K); } catch (e) { return null; } })();
    const ok = String(q.a).split(',').map(Number).includes(+S.ans[q.id]), unsure = (() => { const v = conf()[q.id]; return !!v && v !== 'sure'; })();
    (document.getElementById('moreBox') || document.getElementById('aibox') || tb).insertAdjacentHTML('afterend', `<button class="btn full ${ok && !unsure ? '' : 'begon'}" id="beg">🐣 처음부터 알려줘 ${saved ? '<span class="svd">✓ 저장됨</span>' : '<span class="svd no">인터넷</span>'}</button><div id="begBox"></div>`);
    const btn = document.getElementById('beg'), box = document.getElementById('begBox');
    const show = t => {
      box.innerHTML = `<div class="begc">${begRender(t)}<button class="btn full" id="begSay">🔊 이 설명 읽기</button></div>`;
      const sb = document.getElementById('begSay');
      sb.onclick = () => {
        if (SAY.on) { sayStop(); sb.textContent = '🔊 이 설명 읽기'; return; }
        const seg = []; box.querySelectorAll('.begc > h4, .begc > p, .begc > div').forEach(el => { const tx = sayClean(el.textContent); if (tx) seg.push({ t: tx, el }); });
        sayRun(seg, sb, '🔊 이 설명 읽기');
      };
    };
    btn.onclick = async () => {
      const cached = (() => { try { return localStorage.getItem(K); } catch (e) { return null; } })();
      if (cached) { box.innerHTML ? (box.innerHTML = '') : show(cached); return; }
      if (btn.disabled) return;
      if (!window.__gem) { if (window.__toast) __toast('이 기능은 앱에서만 돼요'); return; }
      btn.disabled = true; const t0 = Date.now();
      box.innerHTML = '<div class="fb na" style="font-weight:400;margin-top:8px"><span class="spin"></span> <b id="begT">기초부터 설명을 만드는 중… 0초</b><div class="muted" style="font-size:13px;margin-top:4px">길게 만드느라 보통 20~60초 걸려요. 다른 문제로 넘어가도 괜찮아요.</div></div>';
      const tick = setInterval(() => { const e = document.getElementById('begT'); if (e) e.textContent = '기초부터 설명을 만드는 중… ' + Math.round((Date.now() - t0) / 1000) + '초'; else clearInterval(tick); }, 1000);
      try {
        const t = await window.__gem(begPrompt(q), { modelTier: 'default' }, false);
        try { localStorage.setItem(K, t); } catch (e) {}
        if (document.getElementById('begBox') === box) { show(t); btn.innerHTML = '🐣 처음부터 알려줘 <span class="svd">✓ 저장됨</span>'; }
      } catch (e) {
        if (document.getElementById('begBox') === box) box.innerHTML = '<div class="fb no">' + (e.message || '만들지 못했어요') + '</div>';
      } finally { clearInterval(tick); btn.disabled = false; }
    };
  }
  setInterval(decorateBeg, 600);

  /* ---------- 이전/다음으로 넘어갈 때: 안 푼 문제는 맨 위부터, 푼 문제는 보던 자리 그대로 ---------- */
  const QSC = {}; let QSL = '';
  window.addEventListener('scroll', () => { try { const q = cur === 'quiz' && S && S.list && S.list[S.i]; if (q && q.id === QSL) QSC[q.id] = scrollY; } catch (e) {} }, { passive: true });
  function quizScroll() {
    try {
      const q = S && S.list && S.list[S.i]; if (!q || q.id === QSL) return;     // 같은 문제 안에서 다시 그린 건 그대로
      QSL = q.id;
      const done = !!S.ans[q.id];
      const y = done && QSC[q.id] != null ? QSC[q.id] : 0;
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
    } catch (e) {}
  }

  /* ---------- 해설 묶음: [📖 해설 | 🔍 더 자세히 | 🐣 기초부터] 탭 하나로, 도구 버튼은 맨 아래 한 줄 ---------- */

  /* 🧭 풀이 도식: AI가 관계도·순서를 만들어 필기장에 그려 줌 (그 위에 바로 메모) */
  async function makeDiagram(q, btn) {
    const key = 'reb_dia_' + q.id; let d = null;
    try { d = JSON.parse(localStorage.getItem(key)); } catch (e) {}
    const old = btn ? btn.innerHTML : '';
    if (!d) {
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ic">⏳</span>만드는 중…'; }
      try {
        const ex = expOf(q);
        const prompt = `공인중개사 기출 문제를 한눈에 이해하게 하는 '풀이 도식'을 만들어. JSON만 출력.
형식: {"title":"12자 이내 제목","nodes":[{"id":"a","label":"甲\\n매도인","x":15,"y":20}],"edges":[{"from":"a","to":"b","label":"매매계약"}],"steps":["① …","② …","→ 정답 ③ …"]}
규칙:
- nodes 2~7개. x·y는 0~100, 서로 25 이상 떨어지게 넓게 배치. label은 한 줄 9자 이내, 최대 두 줄(\\n).
- edges는 관계·흐름·계산 방향. label은 8자 이내.
- 사람(甲·乙)·물건·권리·금액 관계가 있으면 그 관계도. 계산 문제면 값 → 계산 → 결과 흐름. 개념 문제면 핵심 개념을 분류 트리로.
- steps 3~6줄, 한 줄 28자 이내. 계산 문제는 계산식을 숫자 그대로. 마지막 줄은 정답과 이유.
문제: ${q.x}
정답: ${q.a}
${ex ? '해설: ' + JSON.stringify(ex).slice(0, 2500) : ''}`;
        const raw = await window.__gem(prompt, {}, true);
        d = JSON.parse(String(raw).replace(/^```(json)?|```$/g, '').trim());
        if (!d || !Array.isArray(d.nodes)) throw new Error('도식을 못 만들었어요. 다시 눌러 주세요');
        try { localStorage.setItem(key, JSON.stringify(d)); } catch (e) {}
      } catch (e) { window.__toast && __toast(e.message || '도식을 못 만들었어요'); if (btn) { btn.disabled = false; btn.innerHTML = old; } return; }
      if (btn) { btn.disabled = false; btn.innerHTML = old; }
    }
    padOpen(true); padTab('draw');
    await new Promise(r => setTimeout(r, 350));
    const cv = document.getElementById('padc'); if (!cv) return;
    const R = cv.getBoundingClientRect(), W = R.width || 360, H = R.height || 500;
    const out = [], NF = 14, LF = 12;
    const T = (x, y, t, o = {}) => out.push({ k: 'text', g: 'dia', c: o.c || 'ink', w: o.f || NF, b: o.b ? 1 : 0, al: o.al || 'center', t, p: [[x, y]] });
    if (d.title) T(.05, .05, '🧭 ' + d.title, { al: 'left', f: 16, b: 1, c: '#f59e0b' });
    const nodes = {}; (d.nodes || []).slice(0, 8).forEach(n => {
      const lines = String(n.label || n.id).split('\n').slice(0, 2), wpx = Math.max(...lines.map(l => l.length)) * NF * .95 + 18, hpx = lines.length * NF * 1.25 + 12;
      const x = .1 + Math.min(100, Math.max(0, +n.x || 50)) / 100 * .8, y = .14 + Math.min(100, Math.max(0, +n.y || 50)) / 100 * .44;
      const hw = wpx / 2 / W, hh = hpx / 2 / H; nodes[n.id] = { x, y, hw, hh };
      out.push({ k: 'pen', g: 'dia', c: 'ink', w: 2, p: [[x - hw, y - hh], [x + hw, y - hh], [x + hw, y + hh], [x - hw, y + hh], [x - hw, y - hh]], s: 'rect' });
      T(x, y, lines.join('\n'), { b: 1 });
    });
    const clip = (a, b) => {   // a 상자 가장자리에서 b 쪽으로 나가는 점
      const dx = b.x - a.x, dy = b.y - a.y; const t = Math.min(Math.abs(dx) > 1e-6 ? a.hw / Math.abs(dx) : 9, Math.abs(dy) > 1e-6 ? a.hh / Math.abs(dy) : 9);
      return [a.x + dx * t * 1.08, a.y + dy * t * 1.08];
    };
    (d.edges || []).slice(0, 10).forEach(e => {
      const a = nodes[e.from], b = nodes[e.to]; if (!a || !b) return;
      const p1 = clip(a, b), p2 = clip(b, a);
      out.push({ k: 'arrow', g: 'dia', c: '#3b82f6', w: 2, p: [p1, p2], s: 'line' });
      if (e.label) T((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 - 10 / H, e.label, { c: '#3b82f6', f: LF, b: 1 });
    });
    (d.steps || []).slice(0, 7).forEach((t, i) => T(.05, .66 + i * 24 / H, String(t), { al: 'left', f: 13 }));
    PAD.hist.push(JSON.stringify(PAD.strokes)); PAD.redo = [];
    PAD.strokes = PAD.strokes.filter(st => st.g !== 'dia').concat(out);
    padFit(); padDraw(); padSave(); if (PAD.paint) PAD.paint();
  }
  window.makeDiagram = makeDiagram;

  /* 📌 문제 화면 버튼은 늘 같은 자리: 화면 아래 고정 줄 [← | ☆ | 🧭 | ⋯ | 다음 →]
     ⋯ 를 누르면 원본·핵심 카드·신고·숫자 바꾸기 */
  function dockQuiz() {
    if (cur !== 'quiz') { document.querySelector('.qdock')?.remove(); document.body.classList.remove('qdocked'); return; }
    // 마지막 문제에선 '다음' 대신 '결과 보기'(qf)나 '제출하기'(qs)
    const qn = [...document.querySelectorAll('#view #qn, #view #qf, #view #qs')][0] || document.querySelector('.qdock #qn, .qdock #qf, .qdock #qs'), qp = document.getElementById('qp'); if (!qn || !qp) return;
    let dk = document.querySelector('.qdock');
    if (!dk || !dk.contains(qn)) {
      dk?.remove();
      const row = qn.parentElement;
      dk = document.createElement('div'); dk.className = 'qdock';
      dk.innerHTML = '<div class="qd"></div><div class="qmore"></div>';
      const bar = dk.firstChild, more = dk.lastChild;
      qp.innerHTML = '<span class="ic">←</span>이전'; qp.classList.add('qdi'); qp.setAttribute('aria-label', '이전 문제');
      const mk = document.createElement('button'); mk.className = 'btn qdi'; mk.id = 'qmk'; mk.innerHTML = '<span class="ic">⋯</span>더보기'; mk.setAttribute('aria-label', '더 보기');
      mk.onclick = () => dk.classList.toggle('open');
      bar.append(qp, mk, qn);
      const tb = document.querySelector('#view .qtb'); if (tb) more.appendChild(tb);
      document.body.appendChild(dk); document.body.classList.add('qdocked');
      if (row && !row.children.length) row.remove();
      more.addEventListener('click', e => { if (e.target.closest('button,a')) setTimeout(() => dk.classList.remove('open'), 150); });
    }
    // ☆ 북마크와 🧭 풀이 도식은 바로 누를 수 있게 아래 줄로 (생기면 그때 옮김)
    const bar = dk.querySelector('.qd'), mk = document.getElementById('qmk');
    ['qb', 'qdia'].forEach(id => { const b = document.getElementById(id); if (b && b.parentElement !== bar) { b.classList.add('qdi'); bar.insertBefore(b, mk); } });
    const t = document.querySelector('.qtb'); if (t && !t.closest('.qdock')) dk.querySelector('.qmore').appendChild(t);
    mk.style.display = dk.querySelector('.qmore .qtb')?.children.length ? '' : 'none';
  }
  setInterval(dockQuiz, 300);
  function decorateTabs() {
    const q = (typeof S !== 'undefined' && S && S.list) ? S.list[S.i] : null;
    if (cur !== 'quiz' || !q || !S.ans[q.id] || (S.exam && !S.done)) return;
    const card = document.querySelector('#view .card'); if (!card) return;
    const qa = document.getElementById('qa'), more = document.getElementById('more'), beg = document.getElementById('beg');
    const ab = document.getElementById('aibox'), mb = document.getElementById('moreBox'), bb = document.getElementById('begBox');
    const tb = document.querySelector('.qtb'), qv = document.getElementById('qv');
    if (!qa || !ab || !more || !mb || !beg || !bb || !tb) return;
    let tabs = card.querySelector('.xtabs');
    const saved = k => { try { return !!localStorage.getItem(k); } catch (e) { return false; } };
    const lbl = (ic, t, ok) => `${ic} ${t}${ok ? ' <i class="xs">✓</i>' : ''}`;
    if (!tabs) {
      const conf = card.querySelector('.conf'), fb = card.querySelector('.fb');
      (conf || fb || card.querySelector('.choices')).insertAdjacentHTML('afterend', `<div class="xtabs"><button data-x="ai"></button><button data-x="beg"></button></div><div class="xpanel"></div>`);
      tabs = card.querySelector('.xtabs'); const pnl = card.querySelector('.xpanel');
      pnl.append(ab, more, mb, bb);                      // 더 자세히는 해설 바로 아래 이어서
      [qa, beg].forEach(b => b.classList.add('xhid')); more.classList.add('full', 'xmore');
      if (qv) { qv.className = 'btn'; qv.innerHTML = '<span class="ic">🔁</span>숫자 바꾸기'; tb.insertBefore(qv, tb.lastElementChild); tb.classList.add('q5'); }
      if (!document.getElementById('qdia')) { tb.insertAdjacentHTML('afterbegin', '<button class="btn" id="qdia"><span class="ic">🧭</span>풀이 도식</button>'); document.getElementById('qdia').onclick = e => makeDiagram(q, e.currentTarget); }
      if (!tb.closest('.qdock')) pnl.after(tb);          // (아래 고정 줄에 들어가 있으면 그대로)
      tabs.querySelectorAll('button').forEach(b => b.onclick = () => xshow(b.dataset.x, true));
      // 저장된 해설이 있으면 바로 펼쳐 보여 주기(인터넷 필요 없음)
      xshow('ai', !!expOf(q) || ab.textContent.trim().length > 20);
    }
    const isCalc = /계산/.test(qa.textContent);
    tabs.children[0].innerHTML = lbl('📖', isCalc ? '계산 풀이' : '해설', !!expOf(q));
    tabs.children[1].innerHTML = lbl('🐣', '기초부터', saved('reb_beg_' + q.id));
    tabs.children[1].classList.toggle('warn', beg.classList.contains('begon'));
    // 틀렸거나 헷갈렸으면: 그 테마 핵심 카드로 바로 (개념을 다시 잡을 때)
    const okA = String(q.a).split(',').map(Number).includes(+S.ans[q.id]);
    const fbx = card.querySelector('.fb'), uns = (() => { try { const v = conf()[q.id]; return !!v && v !== 'sure'; } catch (e) { return false; } })();
    if (fbx && (!okA || uns) && !document.getElementById('fbk') && document.getElementById('qk')) {
      fbx.insertAdjacentHTML('beforeend', '<button class="btn fbk" id="fbk">📇 이 테마 핵심 카드로 개념 잡기</button>');
      document.getElementById('fbk').onclick = () => document.getElementById('qk')?.click();
    }
    // 더 자세히: 내용이 펼쳐지면 버튼은 숨김
    const mOpen = mb.textContent.trim().length > 20;
    if (!more.dataset.lbl) { more.dataset.lbl = 1; }
    more.style.display = (tabs.querySelector('.on')?.dataset.x === 'beg' || mOpen) ? 'none' : '';
    if (!mOpen && !more.disabled && !/더 자세히 보기/.test(more.textContent)) more.innerHTML = '🔍 더 자세히 보기 <small>(예시·비교·함정)</small>' + (saved('reb_more_' + q.id) ? ' <span class="svd">✓ 저장됨</span>' : '');
  }
  function xshow(k, load) {
    const card = document.querySelector('#view .card'); if (!card) return;
    if (k === 'more') k = 'ai';
    const map = { ai: ['qa', 'aibox'], beg: ['beg', 'begBox'] };
    card.querySelectorAll('.xtabs button').forEach(b => b.classList.toggle('on', b.dataset.x === k));
    Object.entries(map).forEach(([kk, [, box]]) => { const el = document.getElementById(box); if (el) el.style.display = kk === k ? '' : 'none'; });
    ['more', 'moreBox'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = k === 'ai' ? '' : 'none'; });
    const [btn, box] = map[k]; const el = document.getElementById(box);
    if (load && el && el.textContent.trim().length < 20) { const b = document.getElementById(btn); if (b && !b.disabled) b.click(); }
  }
  setInterval(decorateTabs, 400);

  /* ---------- 화면 정리: 중복·빈 카드 숨기기, 자세한 것은 접어 두기(모든 탭 같은 느낌) ---------- */
  function cardBy(re) { return [...document.querySelectorAll('#view .card')].find(c => { const h = c.querySelector('h2,h3,.ttl,b'); return h && re.test(h.textContent); }); }
  function fold(c, title, open) {
    if (!c || c.dataset.fold) return; c.dataset.fold = 1;
    const d = document.createElement('details'); d.className = 'card fold'; if (open) d.open = true;
    d.innerHTML = `<summary>${title}</summary>`;
    c.before(d); c.classList.remove('card'); c.classList.add('foldin'); d.appendChild(c);
    const h = c.querySelector('h2,h3'); if (h && c.firstElementChild === h) h.style.display = 'none';
  }
  function tidy() {
    document.body.classList.toggle('home-calm', cur === 'home');
    if(cur === 'home') calmHome();
    if (cur === 'stats' && !document.getElementById('achc')) { const sg = document.getElementById('rseg'); if (sg) sg.insertAdjacentHTML('afterend', achCard()); }
    if (cur === 'home' && !document.getElementById('lvb')) {
      const go = document.querySelector('#view .hero .go');
      if (go) { go.insertAdjacentHTML('afterend', lvBar() + `<div id="lgh" class="lgue">${leagueLine()}</div>`); document.getElementById('lvb').onclick = () => window.go('stats'); }
    }
    if (cur === 'result' && !document.getElementById('xpg')) {
      const g = xpNow() - (window.__xp0 ?? xpNow()), v = document.getElementById('view');
      if (v && g > 0) { v.insertAdjacentHTML('afterbegin', `<div class="card" id="xpg" style="text-align:center"><b style="font-size:20px">+${g} XP</b><div class="muted" style="font-size:13px">${lvOf(xpNow()).name} · Lv.${lvOf(xpNow()).n}</div></div>`); }
      achCheck();
    }
    if (cur === 'home') {
      [...document.querySelectorAll('#view .card')].forEach(c => { if (/내용 업데이트/.test(c.textContent.slice(0, 40))) c.style.display = 'none'; });
      document.querySelectorAll('#view > .muted, #view > p.muted, #view .foot').forEach(e => { if (/사용량|요금/.test(e.textContent)) e.style.display = 'none'; });
    }
    if (cur === 'wrong') {
      const empty = c => c && !c.querySelector('li, table, button') && c.textContent.trim().length < 150;   // 안내 문장만 있고 항목이 없는 카드
      [cardBy(/법령 개정 주의/), cardBy(/내 공식 노트/), cardBy(/자주 틀린 문제/)].forEach(c => { if (empty(c)) c.style.display = 'none'; });
      const lg = document.getElementById('logc'); if (lg) fold(lg, '🗂 공부 기록(언제 무엇을 풀었나)');
      const th = document.getElementById('themec'); if (th) fold(th, '🎨 화면 색 바꾸기');
    }
  }
  setInterval(tidy, 500);
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
    qt.innerHTML = '<div class="qstem">' + h(lines.slice(0, idx).join('\n')) + '</div>' + (elHint() ? '<div class="elh">💡 아닌 보기는 옆으로 밀어서 줄 긋기</div>' : '') +
      ch.map(c => `<div class="elc ${set.has(c.n) ? 'x' : ''}" data-n="${c.n}">${h(c.t)}</div>`).join('');
    qt.dataset.el = q.id;
    const sync = () => document.querySelectorAll('#view .choices button').forEach(b => b.classList.toggle('elx', set.has(+b.dataset.c)));
    const tog = el => { const n = +el.dataset.n; set.has(n) ? set.delete(n) : set.add(n); el.classList.toggle('x', set.has(n)); sync(); };
    qt.querySelectorAll('.elc').forEach(el => {
      // 옆으로 밀 때만 줄 긋기(누르기·위아래 스크롤로는 안 그어짐)
      let x0 = 0, y0 = 0;
      el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
      el.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 2) tog(el); }, { passive: true });
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
        if (m.index > 0 && /[가-힣A-Za-z]/.test(t[m.index - 1])) continue;   // 낱말 중간(해'악의')은 건너뜀
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
    wrap('quiz', () => { decorateQuiz(); decorateChoices(); decorateElim(); quizScroll(); dockQuiz(); });
    const _go = window.go; window.go = go = function (v) {
      if (v !== 'quiz' && v !== 'result') { COURSE.active = false; COURSE.session = null; }
      return _go.apply(this, arguments);
    };
    const _sq = window.startQuiz; window.startQuiz = function () { window.__xp0 = xpNow(); COURSE.active = false; return _sq.apply(this, arguments); };
    setTimeout(achCheck, 1500);
    setTimeout(scoreChip, 300);
    const _rec = window.record; window.record = function (q, c) { const r = _rec.apply(this, arguments); logAnswer(q, c); try { scoreChip(); } catch (e) {} return r; }; wrap('home', decorateHome); wrap('setup', decorateSetup); wrap('wrong', decorateWrong); wrap('themes', decorateThemes);
    const v = document.querySelector('#tabs button.on')?.dataset.v;
    if (v === 'home') decorateHome();
  }, 50));
})();

// 전체 자료에서 추출한 암기 후보를 읽어요. 학습 중 추가 AI 호출은 없어요.
(() => {
  const load = (src, done) => { const s=document.createElement('script'); s.src=src; s.onload=done; document.head.appendChild(s); };
  load('memory-data.js', () => load('memory.js', () => {
    const original = window.record;
    if (typeof original === 'function') window.record = function(q, c) {
      const r=original.apply(this,arguments);
      try { Memory.wrong(q.id, isRight(q,c)); } catch (_) {}
      return r;
    };
  }));
})();
