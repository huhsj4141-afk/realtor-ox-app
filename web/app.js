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
    .cnh .cnq{width:100%;margin-top:10px;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font-size:14px;box-sizing:border-box}
    .cns summary{display:flex;align-items:baseline;gap:8px;font-size:16px;cursor:pointer} .cns summary small{color:var(--sub2,#9aa3b5);font-size:12px} .cnu{font-size:12.5px;font-weight:700;color:var(--sub2,#9aa3b5);margin:12px 0 4px}
    .cnt{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:9px 4px;border:0;border-bottom:1px solid var(--line);background:transparent;color:inherit;font:inherit} .cnt span{flex:1;display:flex;flex-direction:column;min-width:0} .cnt small{font-size:12px;color:var(--sub2,#9aa3b5)}
    .cnm{flex:none;width:54px;height:6px;border-radius:3px;background:var(--line);overflow:hidden;display:block} .cnm em{display:block;height:100%;background:linear-gradient(90deg,var(--pri),#22c55e)}
    .cnb{font-size:12.5px;color:var(--sub2,#9aa3b5)} .cnb a{color:var(--pri);cursor:pointer} .cnbtn{display:flex;gap:8px;margin-top:10px} .cnbtn .go{flex:2;margin:0} .cnbtn .btn{flex:1}
    .cnl{padding-left:2px;list-style:none;margin:6px 0 0;font-size:14.5px;line-height:1.6} .cnl li{padding:5px 0;border-bottom:1px dashed var(--line)} .cnsrc{font-size:12px;color:var(--pri);cursor:pointer;margin-left:4px}
    .cnn{width:100%;min-height:120px;padding:10px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font-size:14px;line-height:1.6;box-sizing:border-box}
    .ccard .cbar{height:5px;border-radius:3px;background:var(--line);margin:8px 0 14px;overflow:hidden} .ccard .cbar em{display:block;height:100%;background:var(--pri)}
    .cth{font-size:12px;color:var(--sub2,#9aa3b5)} .cfront{font-size:22px;font-weight:700;line-height:1.5;margin:10px 0 18px;min-height:70px} .cback{font-size:18px;line-height:1.6;padding:14px;border-radius:14px;background:color-mix(in srgb,var(--pri) 10%,transparent);margin-bottom:8px}
    .crts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px} .crt{display:flex;flex-direction:column;align-items:center;padding:10px 0;border-radius:12px;border:1px solid var(--line);background:var(--card);color:inherit} .crt small{font-size:11px;color:var(--sub2,#9aa3b5)}
    .crt.r1 b{color:#ef4444} .crt.r2 b{color:#f59e0b} .crt.r3 b{color:#22c55e} .crt.r4 b{color:#3b82f6}
    .ahero .add{font-size:24px;font-weight:800} .ahero .ask{font-weight:700} .arnd{margin-top:10px;font-size:15px} .arnd small{color:var(--sub2,#9aa3b5);font-size:12px}
    .abar{height:8px;border-radius:4px;background:var(--line);overflow:hidden;margin:8px 0 14px} .abar em{display:block;height:100%;background:linear-gradient(90deg,var(--pri),#22c55e);border-radius:4px}
    .agp{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:20px;padding:18px} .agp small{font-size:13px;font-weight:400;opacity:.85}
    .arow{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px} .arow .btn{margin:0} .atd{font-size:12.5px;color:var(--sub2,#9aa3b5);margin-top:10px;text-align:center} .ahow{font-size:12.5px;text-align:center;margin:4px 12px}
    .padsay{position:absolute;left:12px;right:12px;top:56px;z-index:5;background:#111d;color:#fff;padding:10px 14px;border-radius:12px;font-size:15px} #padmic{touch-action:none;user-select:none;-webkit-user-select:none} #padmic.on{background:#ef4444;color:#fff} u.khint{text-decoration:underline wavy #f59e0b 2px;text-underline-offset:4px;background:#f59e0b22;border-radius:3px} #sync{display:none} .moreh{font-weight:700;font-size:15px;margin:18px 0 6px;padding-top:12px;border-top:1px dashed var(--line,#e3e7ef)} .morec{white-space:pre-wrap;line-height:1.75;font-size:15px} .diawait{position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);background:#111e;color:#fff;padding:14px 20px;border-radius:14px;z-index:300;font-size:15px} #view .qtext,#view .qtext *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none} .ahero .agp{background:var(--pri);color:#fff;border:0} .ahero .agp small{color:#ffffffcc} #wrev,#view .wbtns .btn{white-space:nowrap;font-size:15px} .sbg{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:6px} .sbig{background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:12px 14px} .sbig small{display:block;font-size:12.5px;color:var(--sub)} .sbig b{font-size:30px;line-height:1.2} .sbig b i{font-size:14px;font-style:normal;margin-left:2px} .sbig span{display:block;font-size:12.5px;color:var(--sub)} .ssub{margin-top:10px} .sr{display:grid;grid-template-columns:7.2em 1fr 2.2em 4.4em;align-items:center;gap:8px;padding:7px 0;font-size:14px} .sr em{height:8px;border-radius:5px;background:var(--line);overflow:hidden} .sr em i{display:block;height:100%} .sr b{text-align:right} .sr small{text-align:right;color:var(--sub);font-size:12px} .sach summary{cursor:pointer;font-weight:600} #pad.p2row .ph{display:none} #pad.p2row.pmemo .ph{display:flex} #pad.p2row .pt{flex-wrap:nowrap;gap:4px;padding:6px 8px 2px} #pad.p2row .pt button{min-width:0;flex:0 0 auto;width:36px;height:36px;padding:0;font-size:16px!important;border-radius:10px} #pad.p2row .pt .sp{flex:1} #pad.p2row #padw{max-width:90px;min-width:50px} .pcb i{display:inline-block;width:18px;height:18px;border-radius:50%;border:2px solid #fff8;vertical-align:middle} .ppal{position:absolute;left:8px;top:6px;z-index:6;display:none;gap:8px;padding:8px;border-radius:14px;background:var(--card);border:1px solid var(--line)} .ppal.on{display:flex} .ppal .pc{width:32px;height:32px} #padmic.on{background:#ef4444!important;color:#fff} .a1c{margin:10px 0;padding:12px 14px;border-radius:12px;background:var(--bg);color:var(--ink);border:1.5px solid var(--warn,#f59e0b)} .a1c small,.a1q small{display:block;font-size:12px;color:var(--sub)} .a1c b{display:block;font-size:16px;margin:6px 0 2px;line-height:1.5} .a1q{text-align:center} .a1f{font-size:20px;font-weight:700;margin:18px 0 10px;line-height:1.5} .a1b{font-size:17px;color:var(--pri,#2563eb);min-height:26px;margin-bottom:12px;line-height:1.5}
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
      { const k = document.getElementById('qk'); if (k) k.remove(); } mk(document.getElementById('qr'), '🚩', '신고');
      { const k2 = document.getElementById('qk'); if (k2) k2.onclick = () => card(q.t); }
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
    // 진도·과목별 수준은 기록 → 점수 탭에 있으니 첫 화면에선 뺌
    [...document.querySelectorAll('#view .card')].forEach(c => { const h = c.querySelector('h2,h3'); if (h && /회독 진도|과목별 수준|내용 업데이트/.test(h.textContent)) c.remove(); });
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
      rw.insertAdjacentHTML("beforebegin", `<button class="btn pri grow" id="wrev">🔁 복습 ${n}문제</button>`);
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
    const d = diagnose();
    return `<div id="mgr" class="inhero"><div class="mgh">🧭 매니저 처방 <b>${d.grade[0]}</b><small>시작 버튼에 들어 있어요 · 하나만 하려면 누르기</small></div>
      ${d.notes.length ? `<div class="fixl">${d.notes.slice(0, 3).map((n, i) => `<button data-f="${i}">${n}<i>${d.acts[i].k === 'listen' ? '🎧' : '▶'}</i></button>`).join('')}</div>` : '<div style="margin-top:6px">빠진 곳 없이 골고루 하고 있어요 👍</div>'}
      <details style="margin-top:10px"><summary style="font-weight:600">📍 상황별로 고르기 (잠·버스·도서관…)</summary>
      <div class="sit" style="margin-top:8px">${SITU.map(([k, i, t, sub]) => `<button data-s="${k}"><b>${i} ${t}</b><span>${sub}</span></button>`).join('')}</div></details></div></div>`;
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
    try { const L = JSON.parse(localStorage.getItem('reb_cardlog') || '{}'); for (const k in L) x += L[k] * 2; } catch (e) {}   // 🃏 카드 한 장 2 XP
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
    const a = achStats(), x = xpNow(), L = lvOf(x), PD = predict(), st = subjStats();
    const col = v => v < 40 ? 'var(--no)' : v < 60 ? 'var(--warn)' : 'var(--ok)';
    const NM = ['부동산학개론', '민법·민사특별법', '중개사법·실무', '부동산공법', '공시법·세법'];
    const dn = [st[0], st[1], st[2], st[3], { done: st[4].done + st[5].done, total: st[4].total + st[5].total }];
    const big = (nm, v, ok, ids) => `<div class="sbig"><small>${nm}</small><b style="color:${ok ? 'var(--ok)' : col(v)}">${Math.round(v)}<i>점</i></b><span>${ok ? '합격권' : ids.some(i => PD.s5[i] < 40) ? '과락 과목 있음' : '합격선까지 +' + Math.max(0, Math.ceil(60 - v))}</span></div>`;
    const got = BADGES.filter(b => b[4](a)).length;
    return `<div class="card" id="achc">
      <div class="sbg">${big('1차 예상', PD.a1, PD.ok1, [0, 1])}${big('2차 예상', PD.a2, PD.ok2, [2, 3, 4])}</div>
      ${predChart()}
      <div class="ssub">${NM.map((n, i) => { const v = PD.s5[i]; return `<div class="sr"><span>${n}</span><em><i style="width:${Math.round(v)}%;background:${col(v)}"></i></em><b style="color:${col(v)}">${Math.round(v)}</b><small>${dn[i].done}/${dn[i].total}</small></div>`; }).join('')}</div>
      <div class="muted" style="font-size:12px;margin-top:6px">과목 점수 = 지금까지 맞힌 비율(적게 풀었으면 낮게 잡음) · 40점 미만 과락 · 오른쪽은 푼 문제 수</div>
    </div>
    <details class="card sach"><summary>🏅 Lv.${L.n} ${L.name} · 배지 ${got}/${BADGES.length} · 🔥 ${streak().n}일 연속</summary>
      <div class="bdg" style="margin-top:10px">${BADGES.map(b => { const ok = b[4](a); return `<div class="${ok ? 'on' : ''}" title="${b[3]}"><b>${ok ? b[1] : '🔒'}</b><span>${b[2]}</span><small>${b[3]}</small></div>`; }).join('')}</div>
      <div class="muted" style="font-size:12px;margin-top:8px">${x.toLocaleString()} XP · 맞히면 10 XP, 틀려도 3 XP</div></details>`;
  }

  /* 📈 실시간 예상 점수: 맨 위 제목 자리에 늘 보여 주고, 문제를 풀 때마다 바로 바뀜
     과목 점수 = 최근 결과 기준 정답 수를 '아직 모름(30%)' 10문제로 보정한 값 → 적게 풀었을 땐 보수적으로 */
  function predict() {
    const st = subjStats(), k = 10, pr = .3;
    const sub = st.map(x => 100 * (x.ok + k * pr) / (x.grad + k));
    const gs = 100 * (st[4].ok + st[5].ok + k * pr) / (st[4].grad + st[5].grad + k);   // 2차 셋째 과목 = 공시법·세법 한 과목
    const s5 = [sub[0], sub[1], sub[2], sub[3], gs];
    const a1 = (s5[0] + s5[1]) / 2, a2 = (s5[2] + s5[3] + s5[4]) / 3;
    const ok1 = a1 >= 60 && s5[0] >= 40 && s5[1] >= 40, ok2 = a2 >= 60 && s5.slice(2).every(v => v >= 40);
    return { sub, s5, a1: Math.round(a1 * 10) / 10, a2: Math.round(a2 * 10) / 10, ok1, ok2, n: st.reduce((a, x) => a + x.grad, 0) };
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
  const COURSE = window.COURSE = { steps: [], i: 0, active: false };
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
    try { const cf = dueFaces(); if (cf.length) st.push({ t: '🃏 카드 복습', sub: '잊기 직전 개념부터', cards: cf.slice(0, 20) }); } catch (e) {}
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
    const title = `${st.t} · ${COURSE.i + 1}/${COURSE.steps.length}단계`;
    if (st.cards) startCards(st.cards, title); else if (st.ad) startAdaptive(st.ad.qs, st.ad.n, { from: 'home', title }); else startQuiz(st.qs, { from: 'home', title });
    COURSE.active = true;
  }
  function courseDone() {
    COURSE.active = false; const t = todayLog();
    celebrate('🎉 오늘 코스 완료!', `오늘 ${t.q || 0}문제 · 🎧 ${Math.round((t.lsec || 0) / 60)}분. 자기 전에 🎧 듣기로 한 번 더 들으면 더 오래 남아요`);
    go('home');
  }
  function courseStart(mode, sleep) {
    if (mode === 'listen') { pushToday(); return openListen('today', sleep || 0, 0); }
    COURSE.steps = buildCourse(mode === 'short'); COURSE.i = 0; courseRun();
  }
  window.courseStart = courseStart;
  function courseSheet() {
    const [rec, why, sl] = courseRecommend(), st = buildCourse(false), t = todayLog();
    const opt = (k, ic, ttl, sub) => `<button class="cso ${k === rec ? 'rec' : ''}" data-m="${k}"><b>${ic}</b><span><b>${ttl}${k === rec ? ' <em>추천</em>' : ''}</b><small>${sub}</small></span></button>`;
    const o = [opt('solve', '📖', '보면서 풀기', st.map(x => x.t.split(' ')[1]).join(' → ') + ` · ${st.reduce((a, x) => a + (x.qs ? x.qs.length : x.ad ? x.ad.n : 0), 0)}문제`),
      opt('listen', '🎧', '듣기로 진도 빼기', '복습·약점 지문부터 들려줘요. 화면 꺼도 돼요 · 지문 2개 = 1문제로 쳐요'),
      opt('short', '⚡', '10분만', '바쁠 땐 복습·약점 10문제만')];
    if (rec === 'listen') o.unshift(o.splice(1, 1)[0]);
    const el = document.createElement('div'); el.className = 'kc csheet';
    el.innerHTML = `<div><div class="row"><h3 class="grow">오늘 어떻게 할까요?</h3><button class="btn sm" id="csx">닫기</button></div>
      <div class="muted" style="font-size:13px;margin:2px 0 10px">${why}</div>${o.join('')}
      <div class="muted" style="font-size:12px;margin-top:8px">오늘 ${t.q || 0}문제 풀고 🎧 ${t.ox || 0}지문 들었어요</div></div>`;
    el.onclick = e => { if (e.target === el || e.target.id === 'csx') return el.remove(); const b = e.target.closest('[data-m]'); if (b) { el.remove(); courseStart(b.dataset.m, b.dataset.m === 'listen' ? sl : 0); } };
    document.body.appendChild(el);
  }
  /* 단계가 끝난 결과 화면: 다음 단계 안내 */
  function courseNext() {
    if (cur !== 'result' || !COURSE.active || document.getElementById('cnext')) return;
    const v = document.getElementById('view'); if (!v) return;
    const nx = COURSE.steps[COURSE.i + 1], dots = COURSE.steps.map((x, k) => `<i class="${k <= COURSE.i ? 'on' : ''}">${x.t.split(' ')[0]}</i>`).join('');
    const cheer = ['좋아요! 리듬 탔어요 💪', '잘하고 있어요 👏', '한 단계 끝! 🔥', '꾸준함이 합격을 만들어요 🌱'][COURSE.i % 4];
    v.insertAdjacentHTML('afterbegin', `<div class="card" id="cnext"><div class="cdots">${dots}</div><b style="font-size:17px">${cheer}</b>
      ${nx ? `<div class="muted" style="font-size:13.5px;margin:4px 0 10px">다음: <b>${nx.t}</b> · ${nx.sub || ''} ${nx.qs ? nx.qs.length + '문제' : nx.cards ? nx.cards.length + '장' : ''}</div><button class="go" id="cgo">▶ 계속하기</button>`
           : `<div class="muted" style="font-size:13.5px;margin:4px 0 10px">오늘 코스를 다 끝냈어요!</div><button class="go" id="cgo">🎉 마치기</button>`}
      <button class="btn full" id="cstop" style="margin-top:8px">오늘은 여기까지</button></div>`);
    [...v.querySelectorAll('.card')].forEach(c => { if (/오늘 수준 체크/.test(c.textContent) && c.id !== 'cnext') c.remove(); });   // 코스 중엔 딴 길 안 보이게
    document.getElementById('cgo').onclick = () => { COURSE.i++; courseRun(); };
    document.getElementById('cstop').onclick = () => { COURSE.active = false; go('home'); };
  }
  setInterval(courseNext, 400);

  /* ================= 🌳 개념 (렘노트 방식) =================
     과목 → 단원 → 테마 → 개념 나무. 노트(해설의 암기 줄·용어·내 메모)가 그대로 카드가 됨.
     - '개념: 설명' 꼴은 양방향 카드(개념→설명, 설명→개념), 숫자가 든 줄은 빈칸 카드
     - 내 메모: 'A >> B'(앞→뒤) 'A << B'(뒤→앞) 'A :: B' 또는 'A <> B'(양방향) '…{{빈칸}}…'
     - 간격 복습(다시·어려움·알맞음·쉬움), 오늘 코스 첫 단계로 들어감
     - 문제를 틀리면 그 테마 카드가 바로 복습 차례로 (문제 ↔ 개념 연결) */
  const CN = { tree: null, cards: null, byTheme: null };
  const tkey = q => q.s + '|' + (q.u || '기타') + '|' + (q.t || '기타');
  const hsh = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const LSJ = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const LSS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  function cnBuild() {
    if (CN.tree) return;
    const tree = {}, byTheme = {}, cards = {};
    Q.filter(q => !q.ocr).forEach(q => {
      const k = tkey(q); (byTheme[k] = byTheme[k] || { k, s: q.s, u: q.u || '기타', t: q.t || '기타', qs: [], cards: [] }).qs.push(q);
      ((tree[q.s] = tree[q.s] || {})[q.u || '기타'] = tree[q.s][q.u || '기타'] || new Set()).add(k);
    });
    const add = (th, c) => { const id = c.kind[0] + hsh(c.f + '|' + c.b); if (cards[id]) return; c.id = id; c.th = th; cards[id] = c; byTheme[th].cards.push(id); };
    // 1) 해설의 암기 줄
    Object.values(byTheme).forEach(T => T.qs.forEach(q => {
      const e = window.__mcx ? window.__mcx(q.id) : null; if (!e || !Array.isArray(e.memo)) return;
      e.memo.forEach(line => {
        line = String(line).trim(); if (line.length < 4 || line.length > 120) return;
        const m = line.match(/^([^:：]{2,30})[:：]\s*(.{2,})$/);
        if (m && /^(주의|팁|암기|참고|핵심|포인트|비교|예시|예|정리|함정|요약|결론|공식|※)/.test(m[1].trim())) return;   // '주의: …' 같은 꼬리표는 카드로 안 만듦
        if (m) add(T.k, { kind: 'both', f: m[1].trim(), b: m[2].trim(), src: q.id });
        else { const n = line.match(/\d+(?:\.\d+)?\s*(?:일|년|월|개월|%|㎡|억\s*원|만\s*원|원|배|분의\s*\d+|층|명|회|시간)/); if (n) add(T.k, { kind: 'cloze', f: line.replace(n[0], '［　？　］'), b: n[0], full: line, src: q.id }); }
      });
    }));
    // 2) 용어 풍선말: 가장 많이 나오는 테마에 붙임
    try {
      const G = window.__GLOSS || (() => { try { return GL; } catch (e) { return {}; } })(); const cnt = {};
      Object.values(byTheme).forEach(T => { const txt = T.qs.map(q => q.x).join(' '); Object.keys(G).forEach(w => { if (w.length >= 2 && txt.includes(w)) { const n = txt.split(w).length - 1; if (!cnt[w] || cnt[w][1] < n) cnt[w] = [T.k, n]; } }); });
      Object.entries(cnt).forEach(([w, [th]]) => add(th, { kind: 'both', f: w, b: G[w], gl: 1 }));
    } catch (e) {}
    // 3) 내 메모
    Object.keys(byTheme).forEach(k => cnNoteCards(k).forEach(c => add(k, c)));
    CN.tree = tree; CN.byTheme = byTheme; CN.cards = cards;
  }
  function cnNoteCards(k) {
    const out = [];
    String(LSJ('reb_note_' + k, '') || '').split('\n').forEach(l => {
      l = l.replace(/^\s*[-•*]\s*/, '').trim(); let m;
      if ((m = l.match(/^(.+?)\s*(::|<>)\s*(.+)$/))) out.push({ kind: 'both', f: m[1], b: m[3], mine: 1 });
      else if ((m = l.match(/^(.+?)\s*>>\s*(.+)$/))) out.push({ kind: 'fwd', f: m[1], b: m[2], mine: 1 });
      else if ((m = l.match(/^(.+?)\s*<<\s*(.+)$/))) out.push({ kind: 'fwd', f: m[2], b: m[1], mine: 1 });
      else if ((m = l.match(/\{\{(.+?)\}\}/))) out.push({ kind: 'cloze', f: l.replace(m[0], '［　？　］').replace(/\{\{|\}\}/g, ''), b: m[1], full: l.replace(/\{\{|\}\}/g, ''), mine: 1 });
    });
    return out;
  }
  // 카드 한 장 = 방향 하나 (양방향 카드는 두 장)
  const faces = c => c.kind === 'both' ? [c.id + '>', c.id + '<'] : [c.id + '>'];
  function face(fid) { const c = CN.cards[fid.slice(0, -1)]; if (!c) return null; const rev = fid.endsWith('<'); return { c, front: rev ? c.b : c.f, back: rev ? c.f : (c.kind === 'cloze' ? c.b : c.b), rev }; }
  // 간격 복습 (SM-2 줄인 판): [다음 때(ms), 간격(일), 쉬움 정도, 맞힌 횟수, 잊은 횟수]
  const SRS = () => LSJ('reb_srs', {});
  const DAYMS = 86400000;
  function nextIvl(r, s) { const [, ivl = 0, ease = 2.5, reps = 0] = s || []; if (r === 1) return 0; if (r === 2) return Math.max(1, ivl * 1.2); if (r === 3) return reps === 0 ? 1 : reps === 1 ? 3 : ivl * ease; return Math.max(4, (reps === 0 ? 3 : ivl * ease * 1.3)); }
  function rate(fid, r) {
    const S2 = SRS(), s = S2[fid] || [0, 0, 2.5, 0, 0]; const ivl = nextIvl(r, s);
    let ease = s[2] + (r === 1 ? -.2 : r === 2 ? -.15 : r === 4 ? .15 : 0); ease = Math.max(1.3, Math.min(3, ease));
    S2[fid] = [Date.now() + (r === 1 ? 10 * 60000 : ivl * DAYMS), ivl, ease, r === 1 ? 0 : s[3] + 1, s[4] + (r === 1 ? 1 : 0)];
    LSS('reb_srs', S2); const L = LSJ('reb_cardlog', {}); L[dkey()] = (L[dkey()] || 0) + 1; LSS('reb_cardlog', L);
  }
  const ivlTxt = d => d <= 0 ? '10분' : d < 1.5 ? '1일' : d < 30 ? Math.round(d) + '일' : Math.round(d / 30) + '달';
  // 오늘 볼 카드: 복습 차례 + 새 카드(공부한 테마부터, 하루 20장)
  function dueFaces(theme) {
    cnBuild(); const S2 = SRS(), now = Date.now(), due = [], fresh = [];
    const studied = new Set(Object.keys(P).map(k => BYID[k]).filter(Boolean).map(tkey));
    const newToday = LSJ('reb_cardnew', {})[dkey()] || 0, cap = theme ? 999 : Math.max(0, 20 - newToday);
    const ths = theme ? [theme] : Object.keys(CN.byTheme).filter(k => studied.has(k));
    ths.forEach(k => CN.byTheme[k].cards.forEach(id => faces(CN.cards[id]).forEach(f => { const s = S2[f]; if (s) { if (s[0] <= now) due.push(f); } else fresh.push(f); })));
    due.sort((a, b) => S2[a][0] - S2[b][0]);
    return due.concat(fresh.slice(0, cap));
  }
  function themeMastery(k) { cnBuild(); const S2 = SRS(), ids = CN.byTheme[k].cards.flatMap(id => faces(CN.cards[id])); if (!ids.length) return null; return Math.round(100 * ids.filter(f => S2[f] && S2[f][1] >= 7).length / ids.length); }
  // 문제를 틀리면 그 테마의 이미 본 카드를 바로 복습 차례로
  function linkWrong(q) { try { cnBuild(); const T = CN.byTheme[tkey(q)]; if (!T) return; const S2 = SRS(); T.cards.forEach(id => faces(CN.cards[id]).forEach(f => { if (S2[f]) S2[f][0] = Math.min(S2[f][0], Date.now()); })); LSS('reb_srs', S2); } catch (e) {} }
  window.cnLinkWrong = linkWrong;

  /* ---- 화면 ---- */
  const V2 = () => document.getElementById('view');
  function navOn(v) { document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); }
  function conceptView(qry) {
    cnBuild(); cur = 'concept'; navOn('concept'); window.scrollTo(0, 0);
    const n = dueFaces().length, S2 = SRS();
    const q = (qry || '').trim();
    let body = '';
    if (q) {   // 찾기: 테마 이름·개념·용어
      const hits = Object.values(CN.byTheme).filter(T => (T.t + T.u).includes(q) || T.cards.some(id => (CN.cards[id].f + CN.cards[id].b).includes(q))).slice(0, 40);
      body = `<div class="card">${hits.length ? hits.map(T => trow(T)).join('') : '<div class="muted">찾는 개념이 없어요</div>'}</div>`;
    } else {
      body = Object.keys(CN.tree).sort().map(s => {
        const units = CN.tree[s]; const ths = Object.values(units).flatMap(x => [...x]);
        const nc = ths.reduce((a, k) => a + CN.byTheme[k].cards.length, 0);
        return `<details class="card cns"><summary><b>${SUBS[s]}</b><small>${ths.length}테마 · 개념 ${nc}</small></summary>
          ${Object.keys(units).sort().map(u => `<div class="cnu">${esc(u)}</div>${[...units[u]].sort((a, b) => CN.byTheme[b].qs.length - CN.byTheme[a].qs.length).map(k => trow(CN.byTheme[k])).join('')}`).join('')}</details>`;
      }).join('');
    }
    V2().innerHTML = `<div class="card cnh"><h2>🌳 개념 노트</h2><div class="muted" style="font-size:13px">과목 → 단원 → 테마로 정리된 노트예요. 노트가 그대로 카드가 되어 잊기 직전에 다시 나와요.</div>
      <button class="go" id="cnrev" style="margin-top:10px">🃏 오늘 카드 ${n}장 복습</button>
      <input id="cnq" class="cnq" placeholder="🔍 개념·용어 찾기 (예: 대항력, 건폐율)" value="${esc(q)}"></div>${body}`;
    document.getElementById('cnrev').onclick = () => startCards(dueFaces(), '🃏 오늘 카드');
    const inp = document.getElementById('cnq'); inp.onchange = () => conceptView(inp.value);
    V2().querySelectorAll('[data-th]').forEach(b => b.onclick = () => themeView(b.dataset.th));
  }
  function trow(T) {
    const m = themeMastery(T.k);
    return `<button class="cnt" data-th="${esc(T.k)}"><span><b>${esc(T.t)}</b><small>문제 ${T.qs.length} · 개념 ${T.cards.length}</small></span><i class="cnm"><em style="width:${m || 0}%"></em></i></button>`;
  }
  function themeView(k) {
    cnBuild(); const T = CN.byTheme[k]; if (!T) return conceptView(); cur = 'cnode'; navOn('concept'); window.scrollTo(0, 0);
    const S2 = SRS(), dot = id => { const f = faces(CN.cards[id]), sc = f.map(x => S2[x]); return sc.every(Boolean) ? (sc.every(x => x[1] >= 7) ? '🟢' : '🟡') : '⚪'; };
    const cs = T.cards.map(id => CN.cards[id]);
    const memo = cs.filter(c => !c.gl && !c.mine), gl = cs.filter(c => c.gl), mine = cs.filter(c => c.mine);
    const li = c => `<li>${dot(c.id)} ${c.kind === 'cloze' ? esc(c.full) : `<b>${esc(c.f)}</b> — ${esc(c.b)}`}${c.src ? ` <a class="cnsrc" data-q="${c.src}">문제</a>` : ''}</li>`;
    const acc = (() => { const g = T.qs.filter(q => P[q.id]); return g.length ? Math.round(100 * g.filter(q => P[q.id][1] === 1).length / g.length) + '%' : '아직'; })();
    V2().innerHTML = `<div class="card"><div class="cnb"><a id="cnup">🌳 ${SUBS[T.s]}</a> › ${esc(T.u)}</div><h2>${esc(T.t)}</h2>
      <div class="muted" style="font-size:13px">문제 ${T.qs.length}개 · 정답률 ${acc} · 외운 정도 ${themeMastery(k) ?? 0}%</div>
      <div class="cnbtn"><button class="go" id="cnc">🃏 이 테마 카드 (${dueFaces(k).length})</button><button class="btn" id="cnp">✏️ 문제 풀기 ${T.qs.length}</button></div></div>
      ${memo.length ? `<div class="card"><h3>📌 핵심 개념</h3><ul class="cnl">${memo.map(li).join('')}</ul></div>` : ''}
      ${gl.length ? `<details class="card"><summary><b>📖 용어</b> <small>${gl.length}</small></summary><ul class="cnl">${gl.map(li).join('')}</ul></details>` : ''}
      <div class="card"><h3>📝 내 노트</h3><div class="muted" style="font-size:12px;margin-bottom:6px">줄마다 하나씩. <b>개념 :: 설명</b> (양방향 카드) · <b>질문 &gt;&gt; 답</b> · <b>…{{빈칸}}…</b> 처럼 쓰면 카드가 돼요</div>
      <textarea id="cnn" class="cnn" placeholder="예) 대항력 :: 주택 인도 + 전입신고 다음 날 0시에 생김&#10;임대차 존속기간 최소 >> 2년&#10;주택임대차 최단기간은 {{2년}}">${esc(LSJ('reb_note_' + k, '') || '')}</textarea>
      ${mine.length ? `<ul class="cnl">${mine.map(li).join('')}</ul>` : ''}</div>`;
    document.getElementById('cnup').onclick = () => conceptView();
    document.getElementById('cnc').onclick = () => startCards(dueFaces(k), '🃏 ' + T.t);
    document.getElementById('cnp').onclick = () => startQuiz(shuffle(T.qs.slice()), { from: 'concept', title: '✏️ ' + T.t });
    const ta = document.getElementById('cnn'); let tm;
    ta.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { LSS('reb_note_' + k, ta.value); CN.tree = null; }, 700); };
    ta.onblur = () => { LSS('reb_note_' + k, ta.value); CN.tree = null; themeView(k); };
    V2().querySelectorAll('.cnsrc').forEach(a => a.onclick = () => { const q = BYID[a.dataset.q]; if (q) startQuiz([q], { from: 'concept', title: '📄 원문 문제' }); });
    CN.last = k;
  }
  /* ---- 카드 복습 ---- */
  const CS = { list: [], i: 0, title: '', ok: 0, n: 0 };
  function startCards(list, title) {
    if (!list.length) { window.__toast && __toast('지금 복습할 카드가 없어요 👍 문제를 풀면 그 테마 카드가 생겨요'); return; }
    Object.assign(CS, { list: list.slice(0, 40), i: 0, title, ok: 0, n: 0, x0: xpNow() }); cardView(false);
  }
  window.startCards = startCards;
  function cardView(show) {
    cur = 'cards'; navOn(COURSE.active ? 'home' : 'concept'); window.scrollTo(0, 0);
    const fid = CS.list[CS.i]; if (!fid) return cardsDone();
    const F = face(fid); if (!F) { CS.i++; return cardView(false); }
    const s = SRS()[fid], T = CN.byTheme[F.c.th];
    const btn = (r, l, cls) => `<button class="crt ${cls}" data-r="${r}"><b>${l}</b><small>${ivlTxt(r === 1 ? 0 : nextIvl(r, s))}</small></button>`;
    V2().innerHTML = `<div class="card ccard"><div class="row"><div class="grow muted" style="font-size:12.5px">${esc(CS.title)} · ${CS.i + 1}/${CS.list.length}${s ? '' : ' · <b style="color:var(--pri)">새 카드</b>'}</div><button class="btn sm" id="cx">그만</button></div>
      <div class="cbar"><em style="width:${Math.round(CS.i / CS.list.length * 100)}%"></em></div>
      <div class="cth">${SUBS[T.s]} › ${esc(T.t)}</div>
      <div class="cfront">${esc(F.front)}</div>
      ${show ? `<div class="cback">${esc(F.c.kind === 'cloze' ? F.c.full : F.back)}</div>${F.c.src ? `<a class="cnsrc" id="csrc">📄 이 개념이 나온 문제 보기</a>` : ''}
        <div class="crts">${btn(1, '다시', 'r1')}${btn(2, '어려움', 'r2')}${btn(3, '알맞음', 'r3')}${btn(4, '쉬움', 'r4')}</div>`
             : `<button class="go" id="cshow">정답 보기</button><div class="muted" style="font-size:12px;text-align:center;margin-top:6px">${F.rev ? '설명 → 무슨 개념일까요?' : F.c.kind === 'cloze' ? '빈칸에 들어갈 말은?' : '뜻을 떠올려 보세요'}</div>`}</div>`;
    document.getElementById('cx').onclick = () => cardsDone(true);
    if (!show) document.getElementById('cshow').onclick = () => cardView(true);
    else {
      V2().querySelectorAll('.crt').forEach(b => b.onclick = () => {
        const r = +b.dataset.r; if (!s) { const L = LSJ('reb_cardnew', {}); L[dkey()] = (L[dkey()] || 0) + 1; LSS('reb_cardnew', L); }
        rate(fid, r); CS.n++; if (r >= 3) CS.ok++; if (r === 1) CS.list.push(fid);   // 다시 → 이번 판 끝에 한 번 더
        CS.i++; cardView(false);
      });
      const sl = document.getElementById('csrc'); if (sl) sl.onclick = () => { const q = BYID[F.c.src]; if (q) startQuiz([q], { from: 'concept', title: '📄 원문 문제' }); };
    }
  }
  function cardsDone(stopped) {
    const g = xpNow() - CS.x0;
    if (COURSE.active && !stopped) { cur = 'result'; V2().innerHTML = `<div class="card" style="text-align:center"><b style="font-size:20px">🃏 카드 ${CS.n}장 끝!</b><div class="muted">기억 ${CS.ok}/${CS.n} · +${g} XP</div></div>`; return; }   // 코스: 다음 단계 안내가 붙음
    if (CS.n >= 5 && !stopped) celebrate('🃏 카드 복습 끝!', `${CS.n}장 · 기억 ${CS.ok}장 · +${g} XP`);
    CN.last ? themeView(CN.last) : conceptView();
  }
  // 이동: 개념 탭·테마·카드
  const _goC = window.go;
  window.go = go = function (v, a) {
    if (v === 'concept') { COURSE.active = false; return conceptView(); }
    const r = _goC.apply(this, arguments);
    if ((v === 'quiz' || v === 'result') && window.S && S.from === 'concept') navOn('concept');
    return r;
  };
  (function cnTab() {
    const nav = document.getElementById('tabs'); if (!nav || nav.querySelector('[data-v=concept]')) return;
    nav.querySelector('[data-v=setup]')?.insertAdjacentHTML('afterend', '<button data-v="concept"><b>🌳</b>개념</button>');
    nav.querySelector('[data-v=concept]').onclick = e => { e.stopPropagation(); window.go('concept'); };
  })();
  try { fetch('glossary.json').then(r => r.json()).then(g => { window.__GLOSS = g; CN.tree = null; }).catch(() => {}); } catch (e) {}

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
      if (Math.abs(ang - near) < .06) ang = near;
      st.p = N([a, [a[0] + Math.cos(ang) * D, a[1] + Math.sin(ang) * D]]); st.s = 'line';
    };
    if (L < 12) return;
    if (D / L > .96 && L > 40) return line();
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
    PAD.key = k; PAD.strokes = padLoad(k); PAD.cur = null; PAD.hist = []; PAD.redo = []; Object.assign(PAD.v, { ox: 0, oy: 0, s: 1 }); if (PAD.paint) PAD.paint();
    const t = document.getElementById('padt'); if (t) { try { t.value = localStorage.getItem('reb_padt_' + k) || ''; } catch (e) { t.value = ''; } }
    const lb = document.getElementById('padk'); if (lb) lb.textContent = k === 'free' ? '자유 필기' : k.replace(/^(\d+)-(\d)(\d)-(\d+)$/, '$1회 $4번') + ' 필기';
    padDraw();
  }
  function padTab(t) {
    PAD.tab = t; const p = document.getElementById('pad'); if (!p) return;
    p.querySelectorAll('[data-pt]').forEach(b => b.classList.toggle('on', b.dataset.pt === t));
    p.querySelector('.pdraw').style.display = t === 'draw' ? '' : 'none'; p.querySelector('#padt').style.display = t === 'memo' ? '' : 'none';
    if (p.classList.contains('p2row')) { p.classList.toggle('pmemo', t === 'memo'); const mic = p.querySelector('#padmic'), x = p.querySelector('#padx'); (t === 'memo' ? p.querySelector('.ph') : p.querySelector('.pdraw .pt')).append(mic, x); if (t === 'memo' && PAD.voice) { PAD.voice = false; mic.classList.remove('on'); } }
    if (t === 'draw') requestAnimationFrame(padDraw);
  }
  function padOpen(on) {
    PAD.open = on; let p = document.getElementById('pad');
    if (!on) { if (p) { padSave(); p.classList.remove('show'); } document.body.classList.remove('padon'); return; }
    if (!p) {
      document.body.insertAdjacentHTML('beforeend', `<div id="pad">
        <div class="ph"><b id="padk"></b><span class="sp"></span><button data-pt="draw">✏️ 그리기</button><button data-pt="memo">⌨️ 글</button><button id="padmic" title="누르고 있는 동안 말하면, 떼는 순간 글자로 들어가요">🎤</button><button id="padx" aria-label="닫기">✕</button></div>
        <div class="pdraw"><div class="pt">
          <button class="pk on" data-k="pen" title="펜">✏️</button><button class="pk" data-k="hl" title="형광펜">🖍</button><button class="pk" data-k="dash" title="점선">┅</button><button class="pk" data-k="arrow" title="화살표">➝</button><button class="pk" data-k="erase" title="지우개 (닿은 획을 지워요)">🧽</button><button class="pk" data-k="move" title="옮기기: 글자·상자·선을 끌어서 옮겨요">✥</button>
          <span class="sp"></span><button id="padu" title="되돌리기">↶</button><button id="padr" title="다시">↷</button><button id="padz" title="모두 지우기">🗑</button></div>
          <div class="pt" style="flex-wrap:nowrap">
          <button class="pc" data-c="ink" style="--c:var(--ink)"></button><button class="pc" data-c="#ef4444" style="--c:#ef4444"></button><button class="pc" data-c="#3b82f6" style="--c:#3b82f6"></button><button class="pc" data-c="#22c55e" style="--c:#22c55e"></button><button class="pc" data-c="#f59e0b" style="--c:#f59e0b"></button>
          <input id="padw" type="range" min="1" max="14" step="1" title="굵기"><i id="padwv"></i>
          <button id="pads" title="그린 선을 곧은 선·네모·동그라미로 맞춰요. 끝에서 펜을 잠깐 멈춰도 맞춰져요">📐</button><button id="padp" title="손바닥이 닿아도 선이 안 그어져요">✋</button></div>
          <div class="pcw"><canvas id="padc"></canvas><div class="pzm"><button id="padzo" aria-label="축소">－</button><button id="padzl" title="100%로">100%</button><button id="padzi" aria-label="확대">＋</button></div></div></div>
        <textarea id="padt" placeholder="풀이 메모를 적어 두세요. 문제마다 따로 저장돼요."></textarea></div>`);
      p = document.getElementById('pad');
      // 🎤 누르고 있는 동안 음성 인식 → 떼면 입력
      (() => {
        const mb = p.querySelector('#padmic'), N = window.NativeBridge; let on = false, last = '', tip = null;
        const show = t => { if (!tip) { tip = document.createElement('div'); tip.className = 'padsay'; p.appendChild(tip); } tip.textContent = t; };
        const hide = () => { if (tip) { tip.remove(); tip = null; } };
        let at = null;
        const put = t => {
          t = String(t || '').trim(); if (!t) return;
          if (at && PAD.tab !== 'memo') { PAD.hist.push(JSON.stringify(PAD.strokes)); PAD.redo = []; PAD.strokes.push({ k: 'text', c: PAD.color || 'ink', w: 15, b: 0, al: 'left', t, p: [at] }); at = null; padDraw(); padSave(); if (PAD.paint) PAD.paint(); return; }
          if (PAD.tab === 'memo') { const ta = p.querySelector('#padt'); ta.value = (ta.value ? ta.value.replace(/\s*$/, '\n') : '') + t; ta.dispatchEvent(new Event('input')); return; }
          const b = padBox(), V = PAD.v, y = Math.min(V.oy + 1 / V.s - .05, (b ? b[3] : V.oy) + .06);
          PAD.hist.push(JSON.stringify(PAD.strokes)); PAD.redo = []; PAD.strokes.push({ k: 'text', c: PAD.color || 'ink', w: 15, b: 0, al: 'left', t, p: [[V.ox + .04 / V.s, Math.max(V.oy + .05, y)]] });
          padDraw(); padSave(); if (PAD.paint) PAD.paint();
        };
        window.__stt = (t, st) => {
          if (st === 2) { hide(); on = false; at = null; return window.__toast && __toast('마이크 권한을 허용한 뒤 다시 눌러 주세요'); }
          if (st === 3) { hide(); on = false; mb.classList.remove('on'); return window.__toast && __toast('이 폰에서 음성 인식을 쓸 수 없어요'); }
          if (t) last = t;
          if (st === 0) show('🎤 ' + t);
          if (st === 1) { hide(); if (!PAD.voice) mb.classList.remove('on'); put(last); last = ''; on = false; }
        };
        // 🎤 누르면 '말하기 모드' → 필기장에서 글자 놓을 곳을 누르고 있는 동안 말하고, 떼면 그 자리에 글자
        mb.onclick = () => { if (PAD.tab === 'memo') return; PAD.voice = !PAD.voice; mb.classList.toggle('on', PAD.voice); if (PAD.voice) { show('🎤 글자를 놓을 곳을 누르고 있는 동안 말해 주세요'); setTimeout(() => { if (!on) hide(); }, 2200); } else hide(); };
        PAD.sttAt = (pt, down) => { if (down) { at = pt; if (!N || !N.sttStart) { at = null; return window.__toast && __toast('앱에서만 쓸 수 있어요'); } on = true; last = ''; show('🎤 듣는 중… 떼면 그 자리에 들어가요'); N.sttStart(); } else if (on) { show('🎤 글자로 바꾸는 중…'); try { N.sttStop(); } catch (x) {} } };
        const start = e => { if (PAD.tab !== 'memo') return; e.preventDefault(); if (!N || !N.sttStart) return window.__toast && __toast('앱에서만 쓸 수 있어요'); on = true; last = ''; mb.classList.add('on'); show('🎤 듣는 중… 떼면 입력돼요'); try { N.tap && N.tap(); } catch (x) {} N.sttStart(); };
        const stop = e => { if (!on) return; e && e.preventDefault(); show('🎤 글자로 바꾸는 중…'); try { N.sttStop(); } catch (x) {} };
        mb.addEventListener('pointerdown', start); mb.addEventListener('pointerup', stop); mb.addEventListener('pointercancel', stop); mb.addEventListener('pointerleave', stop);
        mb.oncontextmenu = e => e.preventDefault();
      })();
      p.querySelector('#padx').onclick = () => padOpen(false);
      p.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => padTab(b.dataset.pt));
      // 도구 2줄로: [도구 6개 · ⌨️ 🎤 ✕] / [● 색 · 굵기 · 📐 ✋ ↶ ↷ 🗑]
      (() => {
        const rows = p.querySelectorAll('.pdraw .pt'), r1 = rows[0], r2 = rows[1]; if (!r1 || !r2) return;
        const sp1 = r1.querySelector('.sp'), und = ['#padu', '#padr', '#padz'].map(x => p.querySelector(x));
        sp1 && sp1.remove();
        const mk = (html) => { const t = document.createElement('div'); t.innerHTML = html; return t.firstElementChild; };
        const kb = mk('<button class="pk2" title="글로 쓰기">⌨️</button>'); kb.onclick = () => padTab('memo');
        const sp = mk('<span class="sp"></span>');
        r1.append(sp, kb, p.querySelector('#padmic'), p.querySelector('#padx'));
        const pcs = [...r2.querySelectorAll('.pc')], pal = mk('<div class="ppal"></div>'), cb = mk('<button class="pcb" title="색"><i></i></button>');
        pcs.forEach(b => { pal.appendChild(b); b.addEventListener('click', () => { pal.classList.remove('on'); setTimeout(() => cb.querySelector('i').style.background = getComputedStyle(b).getPropertyValue('--c') || '', 0); }); });
        cb.onclick = () => pal.classList.toggle('on');
        r2.prepend(cb); p.querySelector('.pcw').appendChild(pal);
        const sel = pcs.find(b => b.classList.contains('on')) || pcs[0]; cb.querySelector('i').style.background = getComputedStyle(sel).getPropertyValue('--c');
        r2.append(...und);
        p.classList.add('p2row');
      })();
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
      p.querySelector('#padzl').onclick = () => { Object.assign(PAD.v, { ox: 0, oy: 0, s: 1 }); padDraw(); };
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
      // ✥ 옮기기: 누른 곳의 글자·상자·선을 찾아 함께 끌기 (상자를 잡으면 안의 글자와 이어진 화살표 끝도 따라옴)
      const tbox = st => { const r = cv.getBoundingClientRect(), W = r.width, H = r.height, fs = st.w || 14, L = String(st.t || '').split('\n');
        const w = Math.max(...L.map(l => [...l].reduce((v, ch) => v + (/[\x00-\x7f]/.test(ch) ? .6 : 1) * fs, 0))) / W, h = L.length * fs * 1.25 / H, x = st.p[0][0], y = st.p[0][1];
        const x0 = st.al === 'center' ? x - w / 2 : st.al === 'right' ? x - w : x; return [x0 - .01, y - h / 2 - .01, x0 + w + .01, y + h / 2 + .01]; };
      const bb = st => { let x0 = 9, y0 = 9, x1 = -9, y1 = -9; st.p.forEach(q => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }); return [x0, y0, x1, y1]; };
      const inB = (q, b, m = 0) => q[0] >= b[0] - m && q[0] <= b[2] + m && q[1] >= b[1] - m && q[1] <= b[3] + m;
      const findHit = pt => {
        const r = cv.getBoundingClientRect(), tol = 16 / (r.width * PAD.v.s), S2 = PAD.strokes;
        let hit = -1;
        for (let i = S2.length - 1; i >= 0 && hit < 0; i--) { const st = S2[i];
          if (st.k === 'text') { if (inB(pt, tbox(st))) hit = i; }
          else if (st.s === 'rect' ? inB(pt, bb(st), tol) : st.p.some((q, j) => Math.hypot(q[0] - pt[0], q[1] - pt[1]) < tol || (j && (() => { const a2 = st.p[j - 1], dx = q[0] - a2[0], dy = q[1] - a2[1], L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((pt[0] - a2[0]) * dx + (pt[1] - a2[1]) * dy) / L2)); return Math.hypot(a2[0] + t * dx - pt[0], a2[1] + t * dy - pt[1]) < tol; })()))) hit = i; }
        if (hit < 0) return null;
        let st = S2[hit];
        if (st.k === 'text') { const ri = S2.findIndex(x => x.s === 'rect' && inB(st.p[0], bb(x))); if (ri >= 0) { hit = ri; st = S2[ri]; } }
        const set = new Set([hit]), att = [];
        if (st.s === 'rect') { const b = bb(st), m = 14 / (r.width * PAD.v.s);
          S2.forEach((x, i) => { if (i === hit) return; if (x.k === 'text' && inB(x.p[0], b)) set.add(i);
            else if (x.k === 'arrow' || x.s === 'line') { if (inB(x.p[0], b, m)) att.push([i, 0]); if (inB(x.p[x.p.length - 1], b, m)) att.push([i, x.p.length - 1]); } }); }
        return { set, att };
      };
      cv.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch' && !palmy(e)) {
          T.set(e.pointerId, [e.clientX, e.clientY]);
          // 두 번째 손가락이 바로(획이 짧을 때) 닿으면 확대·이동, 아니면 손바닥으로 보고 무시
          if (T.size === 2 && !PAD.palm && (!PAD.cur || PAD.cur.p.length < 6) && !PAD.erasing) {   /* 손바닥 무시(✋)가 켜져 있으면 두 손가락 배율 조절 끔: 손바닥이 닿아 배율이 저절로 바뀌는 것 방지 */ PAD.cur = null; PAD.pid = null; clearTimeout(hold); pinchStart(); padDraw(); return; }
        }
        if (pinch) return;
        if (palmy(e) || (PAD.cur && PAD.pid !== e.pointerId)) return;
        PAD.pid = e.pointerId; cv.setPointerCapture(e.pointerId);
        if (PAD.tool === 'erase') { PAD.erasing = true; PAD.erasedOnce = false; eraseAt(pos(e)); return; }
        if (PAD.voice && PAD.sttAt) { PAD.sttAt(pos(e).map(R4), true); PAD.vdown = 1; return; }
        if (PAD.tool === 'move') { const h2 = findHit(pos(e)); if (h2) { snapshot(); PAD.mv = { ...h2, last: pos(e) }; } else PAD.pan = { x: e.clientX, y: e.clientY, v: { ...PAD.v } }; return; }   // 빈 곳을 끌면 화면 이동
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
        if (PAD.pan) { const r = cv.getBoundingClientRect(), v0 = PAD.pan.v; PAD.v.ox = v0.ox - (e.clientX - PAD.pan.x) / (r.width * v0.s); PAD.v.oy = v0.oy - (e.clientY - PAD.pan.y) / (r.height * v0.s); padDraw(); return; }
        if (PAD.mv) { const pt = pos(e), dx = pt[0] - PAD.mv.last[0], dy = pt[1] - PAD.mv.last[1]; PAD.mv.last = pt;
          PAD.mv.set.forEach(i => PAD.strokes[i].p = PAD.strokes[i].p.map(q => [R4(q[0] + dx), R4(q[1] + dy)]));
          PAD.mv.att.forEach(([i, j]) => { const q = PAD.strokes[i].p[j]; PAD.strokes[i].p[j] = [R4(q[0] + dx), R4(q[1] + dy)]; }); padDraw(); return; }
        if (PAD.erasing) return eraseAt(pos(e));
        if (!PAD.cur) return;
        const pt = pos(e), c = PAD.cur;
        if (c.fixed) { if (c.s === 'line') { c.p[1] = pt.map(R4); padDraw(); } return; }   // 곧게 맞춘 뒤엔 끝점만 따라감
        const l = c.p[c.p.length - 1];
        if (Math.abs(pt[0] - l[0]) + Math.abs(pt[1] - l[1]) > .002) {
          c.p.push(pt.map(R4)); padDraw();
          // 끝에서 펜을 0.5초 멈추면 도형으로 맞춤 (갤럭시 노트처럼)
          clearTimeout(hold); hold = setTimeout(() => { if (PAD.cur === c && c.p.length > 6) { const s0 = c.s; padShape(c, cv, c.k === 'arrow'); if (c.s && c.s !== s0) { c.fixed = 1; padDraw(); } } }, 900);
        }
      });
      const end = e => {
        if (e) T.delete(e.pointerId);
        if (pinch) { if (T.size < 2) pinch = null; return; }
        if (e && e.pointerId !== PAD.pid) return;
        clearTimeout(hold);
        if (PAD.vdown) { PAD.vdown = 0; PAD.sttAt && PAD.sttAt(null, false); return; }
        if (PAD.pan) { PAD.pan = null; return; }
        if (PAD.mv) { PAD.mv = null; padSave(); paint(); return; }
        if (PAD.tool === 'move') return;
        if (PAD.erasing) { PAD.erasing = false; padSave(); paint(); return; }
        if (!PAD.cur) return;
        const c = PAD.cur; PAD.cur = null;
        if (!c.fixed && (PAD.snap || c.k === 'arrow')) padShape(c, cv, c.k === 'arrow');
        delete c.fixed; snapshot(); PAD.strokes.push(c);
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

  /* ---------- 해설 묶음: [📖 해설(+자세히) | 🐣 기초부터] 탭 하나로, 도구 버튼은 맨 아래 한 줄 ---------- */

  /* 🧭 풀이 도식: AI가 관계도·순서를 만들어 필기장에 그려 줌 (그 위에 바로 메모) */
  async function makeDiagram(q, btn, pre) {
    const solved = !!document.querySelector('#view .fb');
    pre = pre && !solved;   // 아직 안 풀었으면 정답 없이
    const key = 'reb_dia2_' + (pre ? 'p_' : '') + q.id; let d = null;
    try { d = JSON.parse(localStorage.getItem(key)); } catch (e) {}
    const old = btn ? btn.innerHTML : '';
    if (!d) {
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ic">⏳</span>만드는 중…'; }
      const wt = document.createElement('div'); wt.className = 'diawait'; wt.innerHTML = '<span class="spin"></span> 🔗 관계도 그리는 중… <b>0</b>초'; document.body.appendChild(wt);
      const t0w = Date.now(), tk = setInterval(() => { const b = wt.querySelector('b'); if (b) b.textContent = Math.round((Date.now() - t0w) / 1000); }, 1000);
      const wdone = () => { clearInterval(tk); wt.remove(); };
      try {
        const ex = expOf(q);
        const prompt = `공인중개사 기출 문제를 한눈에 이해하게 하는 '풀이 도식'을 만들어. JSON만 출력.
형식: {"title":"12자 이내 제목","calc":[],"nodes":[{"id":"a","label":"甲\\n매도인","x":15,"y":20}],"edges":[{"from":"a","to":"b","label":"매매계약"}],"steps":["① …","② …","→ 정답 ③ …"]}
규칙:
- nodes 2~7개. x·y는 0~100, 서로 25 이상 떨어지게 넓게 배치. label은 짧게: 한 줄 7자 이내, 최대 두 줄(\\n). 날짜·긴 설명은 label 말고 steps에.
- edges는 관계·흐름·계산 방향. label은 8자 이내.
- 사람(甲·乙)·물건·권리·금액 관계가 있으면 그 관계도. 계산 문제면 값 → 계산 → 결과 흐름. 개념 문제면 핵심 개념을 분류 트리로.
${pre ? `- steps 3~5줄, 한 줄 28자 이내. 문제를 푸는 순서만 안내하고 정답 번호와 결론은 절대 쓰지 말 것.
- 계산 문제면 "calc" 배열도: 대입할 공식과 숫자를 한 단계씩 풀어 쓰되 마지막 결과값은 "= ?"로 남김(예: "PV = 1억 ÷ (1+0.07)^5", "(1.07)^5 = 1.40255", "PV = 1억 ÷ 1.40255 = ?"). 한 줄 30자 이내. 계산 문제가 아니면 빈 배열.
문제: ${q.x}` : `- steps 3~6줄, 한 줄 28자 이내. 마지막 줄은 정답과 이유.
- 계산 문제면 "calc" 배열도: 계산식을 한 단계씩 숫자로 풀어 씀(예: "1억 ÷ (1.07)^5", "= 1억 ÷ 1.40255", "= 71,298,618원 ≈ 7,130만 원"). 한 줄 30자 이내, 3~6줄. 계산 문제가 아니면 calc는 빈 배열.
문제: ${q.x}
정답: ${q.a}
${ex ? '해설: ' + JSON.stringify(ex).slice(0, 2500) : ''}`}`;
        const raw = await window.__gem(prompt, { modelTier: 'quick' }, true);
        const mm = String(raw).match(/\{[\s\S]*\}/); try { d = JSON.parse(mm ? mm[0] : raw); } catch (e) { d = null; }
        if (!d || !Array.isArray(d.nodes) || !d.nodes.length) throw new Error('관계도를 못 만들었어요. 다시 길게 눌러 주세요');
        try { localStorage.setItem(key, JSON.stringify(d)); } catch (e) {}
      } catch (e) { wdone(); window.__toast && __toast(e.message || '관계도를 못 만들었어요'); if (btn) { btn.disabled = false; btn.innerHTML = old; } return; }
      wdone();
      if (btn) { btn.disabled = false; btn.innerHTML = old; }
    }
    padOpen(true); padTab('draw');
    await new Promise(r => setTimeout(r, 350));
    const cv = document.getElementById('padc'); if (!cv) return;
    const R = cv.getBoundingClientRect(), W = R.width || 360, H = R.height || 500;
    const out = [], NF = 14, LF = 12;
    const T = (x, y, t, o = {}) => out.push({ k: 'text', g: 'dia', c: o.c || 'ink', w: o.f || NF, b: o.b ? 1 : 0, al: o.al || 'center', t, p: [[x, y]] });
    if (d.title) T(.05, .05, '🧭 ' + d.title, { al: 'left', f: 16, b: 1, c: '#f59e0b' });
    // 자동 배치: AI 좌표는 줄 순서만 참고, 겹치지 않게 줄마다 고르게 나눠 놓음
    const NF2 = 13, cw = ch => /[\x00-\x7f]/.test(ch) ? NF2 * .62 : NF2 * 1.02;
    const tw = t => [...t].reduce((v, ch) => v + cw(ch), 0);
    const wrap = (t, max) => { const out2 = []; String(t).split('\n').forEach(l => { let cur2 = ''; for (const w of l.split(/(\s+)/)) { if (tw(cur2 + w) > max && cur2.trim()) { out2.push(cur2.trim()); cur2 = w.trimStart(); } else cur2 += w; while (tw(cur2) > max) { let k = 1; while (k < cur2.length && tw(cur2.slice(0, k + 1)) <= max) k++; out2.push(cur2.slice(0, k)); cur2 = cur2.slice(k); } } if (cur2.trim()) out2.push(cur2.trim()); }); return out2.slice(0, 3); };
    const NL = (d.nodes || []).slice(0, 7).map(n => ({ n, y: +n.y || 50, x: +n.x || 50 }));
    NL.sort((a, b) => a.y - b.y || a.x - b.x);
    const rows = []; NL.forEach(o => { const r = rows[rows.length - 1]; if (r && Math.abs(r[0].y - o.y) < 18 && r.length < 3) r.push(o); else rows.push([o]); });
    rows.forEach(r => r.sort((a, b) => a.x - b.x));
    const nodes = {}; let yTop = 66;
    rows.forEach(r => {
      const slot = W / r.length, maxw = Math.min(140, slot - (r.length > 2 ? 34 : 44));
      const boxes = r.map(o => { const lines = wrap(o.n.label || o.n.id, maxw - 14); return { o, lines, wpx: Math.min(maxw, Math.max(...lines.map(tw)) + 18), hpx: lines.length * NF2 * 1.3 + 12 }; });
      const rh = Math.max(...boxes.map(b => b.hpx));
      boxes.forEach((b, i) => {
        const x = (slot * (i + .5)) / W, y = (yTop + rh / 2) / H, hw = b.wpx / 2 / W, hh = b.hpx / 2 / H;
        nodes[b.o.n.id] = { x, y, hw, hh };
        out.push({ k: 'pen', g: 'dia', c: 'ink', w: 2, p: [[x - hw, y - hh], [x + hw, y - hh], [x + hw, y + hh], [x - hw, y + hh], [x - hw, y - hh]], s: 'rect' });
        T(x, y, b.lines.join('\n'), { b: 1, f: NF2 });
      });
      yTop += rh + 64;
    });
    const stepY = (yTop - 30) / H;
    const clip = (a, b) => {   // a 상자 가장자리에서 b 쪽으로 나가는 점
      const dx = b.x - a.x, dy = b.y - a.y; const t = Math.min(Math.abs(dx) > 1e-6 ? a.hw / Math.abs(dx) : 9, Math.abs(dy) > 1e-6 ? a.hh / Math.abs(dy) : 9);
      return [a.x + dx * t * 1.08, a.y + dy * t * 1.08];
    };
    (d.edges || []).slice(0, 10).forEach(e => {
      const a = nodes[e.from], b = nodes[e.to]; if (!a || !b) return;
      const p1 = clip(a, b), p2 = clip(b, a);
      out.push({ k: 'arrow', g: 'dia', c: '#3b82f6', w: 2, p: [p1, p2], s: 'line' });
      if (e.label) {   // 선 옆(수직 방향)으로 살짝 띄워 글자와 안 겹치게
        const mx = (p1[0] + p2[0]) / 2 * W, my = (p1[1] + p2[1]) / 2 * H, dx = (p2[0] - p1[0]) * W, dy = (p2[1] - p1[1]) * H, L2 = Math.hypot(dx, dy) || 1;
        let nx = -dy / L2, ny = dx / L2; if (ny > 0) { nx = -nx; ny = -ny; }
        const off = Math.abs(dy) < 8 ? Math.max(a.hh, b.hh) * H + 10 : 15; T((mx + nx * off) / W, (my + ny * off) / H, String(e.label).slice(0, 10), { c: '#3b82f6', f: LF, b: 1 });
      }
    });
    let sy = stepY;
    const CL = (d.calc || []).filter(Boolean).slice(0, 7);
    if (CL.length) { T(.05, sy, '🧮 계산식', { al: 'left', f: 14, b: 1, c: '#22c55e' }); sy += 26 / H; CL.forEach(t => { T(.08, sy, String(t), { al: 'left', f: 15, b: 1, c: '#22c55e' }); sy += 27 / H; }); sy += 14 / H; }
    (d.steps || []).slice(0, 7).forEach((t, i) => T(.05, sy + i * 24 / H, String(t), { al: 'left', f: 13 }));
    PAD.hist.push(JSON.stringify(PAD.strokes)); PAD.redo = [];
    PAD.strokes = PAD.strokes.filter(st => st.g !== 'dia').concat(out);
    Object.assign(PAD.v, { ox: 0, oy: 0, s: 1 }); padDraw(); padSave(); if (PAD.paint) PAD.paint();
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
      if (!document.getElementById('qdia')) { tb.insertAdjacentHTML('afterbegin', '<button class="btn" id="qdia"><span class="ic">🔗</span>관계도</button>'); document.getElementById('qdia').onclick = e => makeDiagram(q, e.currentTarget); }
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
    if (false && fbx && (!okA || uns) && !document.getElementById('fbk')) {
      fbx.insertAdjacentHTML('beforeend', '<button class="btn fbk" id="fbk">🌳 이 테마 개념 노트로 다시 잡기</button>');
      document.getElementById('fbk').onclick = () => themeView(tkey(q));
    }
    // 더 자세히: 내용이 펼쳐지면 버튼은 숨김
    const mOpen = mb.textContent.trim().length > 20;
    if (!more.dataset.lbl) { more.dataset.lbl = 1; }
    // (해설에 합침) 버튼 없이 해설 탭을 열면 자세한 설명이 이어서 저절로 붙음
    more.style.display = 'none';
    const onAi = tabs.querySelector('.on')?.dataset.x !== 'beg';
    mb.style.display = onAi ? '' : 'none';
    if (onAi && !mOpen && !more.disabled && more.dataset.auto !== q.id) { more.dataset.auto = q.id; setTimeout(() => { try { more.click(); } catch (e) {} }, 300); }
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
    qt.innerHTML = '<div class="qstem">' + h(lines.slice(0, idx).join('\n')) + '</div>' + (elHint() ? '<div class="elh">💡 보기를 옆으로 밀면 줄 긋기 · 보기를 길게 누르면 힌트 밑줄 · 문제를 길게 누르면 관계도·계산 과정</div>' : '') +
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
    const _sq = window.startQuiz; window.startQuiz = function () { window.__xp0 = xpNow(); COURSE.active = false; return _sq.apply(this, arguments); };
    setTimeout(achCheck, 1500);
    setTimeout(scoreChip, 300);
    const _rec = window.record; window.record = function (q, c) { const r = _rec.apply(this, arguments); logAnswer(q, c); try { if (!String(q.a).split(',').includes(String(c))) linkWrong(q); } catch (e) {} try { scoreChip(); } catch (e) {} return r; }; wrap('home', decorateHome); wrap('setup', decorateSetup); wrap('wrong', decorateWrong); wrap('themes', decorateThemes);

    /* ================= A. 기출 회독형 =================
       탭: 오늘 · 오답 · 기록. 첫 화면은 '문제 풀기' 하나.
       문제 풀기 = 다시 볼 틀린 문제(1·3·7일 간격) + 이번 회독에서 아직 안 푼 기출(과목 번갈아). */
    const DAILY = () => { try { return +localStorage.getItem('reb_daily') || 30; } catch (e) { return 30; } };
    function roundInfo() {
      const G = Q.filter(q => !q.ocr && graded(q)), att = q => P[q.id] ? (P[q.id][2] || 1) : 0;
      let r = Infinity; G.forEach(q => { r = Math.min(r, att(q)); }); r = (isFinite(r) ? r : 0) + 1;
      const done = G.filter(q => att(q) >= r).length;
      return { r, done, total: G.length, pct: G.length ? done / G.length : 0, G, att };
    }
    function sessionList() {
      const n = DAILY(), { r, G, att } = roundInfo(), seen = new Set(), rev = [], fresh = [];
      const add = (arr, q, cap) => { if (q && !q.ocr && !seen.has(q.id) && arr.length < cap) { seen.add(q.id); arr.push(q); } };
      let due = []; try { due = dueList(); } catch (e) {}
      const wrong = Object.keys(P).filter(k => P[k][1] === 0 && BYID[k] && Date.now() - P[k][4] > 6 * 3600000).sort((a, b) => P[a][4] - P[b][4]).map(k => BYID[k]);
      wrong.concat(due).forEach(q => add(rev, q, Math.ceil(n / 2)));   // 복습은 하루 몫의 절반까지
      // 이번 회독에서 아직 안 푼 기출: 과목을 번갈아 (오래된 회차부터)
      const bySub = {}; G.filter(q => att(q) < r && !seen.has(q.id)).sort((a, b) => a.n - b.n || a.no - b.no).forEach(q => (bySub[q.s] = bySub[q.s] || []).push(q));
      const subs = Object.keys(bySub);
      for (let i = 0; fresh.length < n - rev.length && subs.some(s => bySub[s].length); i++) add(fresh, bySub[subs[i % subs.length]].shift(), n - rev.length);
      return { rev, fresh, list: rev.concat(fresh), r };
    }
    window.sessionList = sessionList;
    home = window.home = function () {
      cur = 'home'; window.scrollTo(0, 0); navA();
      const R = roundInfo(), S0 = sessionList(), sk = streak(), t = todayLog();
      let dd = null; try { dd = todayPlan().dday; } catch (e) {}
      const V = document.getElementById('view');
      V.innerHTML = `<div class="card ahero">
        <div class="row"><div class="grow"><b class="add">${dd != null ? 'D-' + dd : '공인중개사'}</b></div><div class="ask">🔥 ${sk.n}일</div></div>
        <div class="arnd"><b>${R.r}회독째</b> · ${Math.round(R.pct * 100)}% <small>(${R.done.toLocaleString()} / ${R.total.toLocaleString()}문제)</small></div>
        <div class="abar"><em style="width:${Math.round(R.pct * 100)}%"></em></div>
        <button class="go agp" id="ago">▶ 문제 풀기<small>${(() => { const n = againDue().length; return n ? `카드 ${n} + ` : ''; })()}${S0.rev.length ? `틀린 ${S0.rev.length} + ` : ''}새 기출 ${S0.fresh.length}</small></button>
        <div class="arow"><button class="btn" id="alis">🎧 암기 듣기</button><button class="btn" id="aexm">⏱ 모의고사</button></div>
        <div class="atd">오늘 ${t.q || 0}문제 풀었어요${t.ox ? ` · 🎧 ${t.ox}지문` : ''}</div></div>
        <div class="muted ahow">틀린 문제는 1일·3일·7일 뒤에 다시 나와요. 밖에서는 🎧 암기 듣기로 공식만 외워요.</div>`;
      document.getElementById('ago').onclick = () => {
        const L = sessionList(); if (!L.list.length) return window.__toast && __toast('오늘 몫을 다 했어요 👏');
        const run = () => startQuiz(L.list, { from: 'home', title: `${L.r}회독 · 오늘 ${L.list.length}문제` });
        const due = againDue(); due.length ? quickCards(due.slice(0, 10), run) : run();
        setTimeout(() => prefetch(L.list), 1500);
      };
      document.getElementById('alis').onclick = () => memoListen();
      document.getElementById('aexm').onclick = () => go('exam');
      try { updBanner(); } catch (e) {}
      setTimeout(() => { try { prefetch(S0.list); } catch (e) {} }, 4000);
    };
    // ── 틀리면 그 자리 1장 + 다음 날 다시 보기 ──
    const AG = () => LSJ('reb_again', {});           // { cardId: 다시 볼 시각 }
    let SRC = null;
    function cardFor(q) {
      try { cnBuild(); if (!SRC) { SRC = {}; Object.values(CN.cards).forEach(c => { if (c.src && !c.gl && (c.kind === 'both' || c.kind === 'cloze') && !SRC[c.src]) SRC[c.src] = c; }); } return SRC[q.id] || null; } catch (e) { return null; }
    }
    const cardLine = c => c.kind === 'cloze' ? c.full : c.f + ' : ' + c.b;
    function againDue() { const A = AG(), now = Date.now(); cnBuild(); return Object.keys(A).filter(id => A[id] <= now && CN.cards[id]); }
    function setAgain(id, on) { const A = AG(); if (on) A[id] = todayStart() + DAYMS + 4 * 3600000; else delete A[id]; LSS('reb_again', A); }
    function todayStart() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
    const _rec2 = window.record;
    window.record = function (q, c) {
      const r = _rec2.apply(this, arguments);
      try {
        if (!String(q.a).split(',').includes(String(c))) {
          const cd = cardFor(q);
          if (cd) setTimeout(() => {
            const fb = document.querySelector('#view .fb.no'), ch = document.querySelector('#view .choices'); if (!fb || document.getElementById('a1c')) return;
            (ch || fb).insertAdjacentHTML(ch ? 'beforebegin' : 'afterend', `<div class="a1c" id="a1c"><small>✕ 핵심 1줄</small><b>${esc(cardLine(cd))}</b><div class="arow"><button class="btn" data-k="0">외웠어요</button><button class="btn" data-k="1">다시 볼래요</button></div></div>`);
            const box = document.getElementById('a1c');
            box.querySelectorAll('button').forEach(b => b.onclick = () => { setAgain(cd.id, b.dataset.k === '1'); box.innerHTML = `<small>${b.dataset.k === '1' ? '내일 세션 시작에 다시 나와요' : '좋아요 👍'}</small><b>${esc(cardLine(cd))}</b>`; try { haptic && haptic(); } catch (e) {} });
          }, 80);
        }
      } catch (e) {}
      return r;
    };
    function quickCards(ids, then) {
      let i = 0; const V = document.getElementById('view'); cur = 'cards';
      const step = show => {
        const c = CN.cards[ids[i]]; if (!c) return then();
        const front = c.kind === 'cloze' ? c.f : c.f, back = c.kind === 'cloze' ? c.full : c.b;
        V.innerHTML = `<div class="card a1q"><small>어제 다시 보기로 한 개념 ${i + 1}/${ids.length}</small><div class="a1f">${esc(front)}</div>${show ? `<div class="a1b">${esc(back)}</div><div class="arow"><button class="btn" data-k="0">외웠어요</button><button class="btn" data-k="1">또 볼래요</button></div>` : `<button class="go" id="a1s">정답 보기</button>`}<button class="btn sm" id="a1x" style="margin-top:10px">건너뛰고 문제 풀기</button></div>`;
        if (!show) document.getElementById('a1s').onclick = () => step(true);
        else V.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { setAgain(c.id, b.dataset.k === '1'); i++; i < ids.length ? step(false) : then(); });
        document.getElementById('a1x').onclick = then;
      };
      step(false);
    }
    // ── 🎧 야외 암기 듣기: 묻고 → 쉬고 → 답 두 번 ──
    let MEMO = null;
    try { fetch('memo.json').then(r => r.json()).then(m => { MEMO = m; }).catch(() => {}); } catch (e) {}
    function memoItems() {
      cnBuild(); const out = [];
      Object.keys(AG()).forEach(id => { const c = CN.cards[id]; if (!c) return; if (c.kind === 'cloze') out.push([SUBS[c.th ? CN.byTheme[c.th].s : 0], c.f.replace('［　？　］', '무엇') + '?', c.b]); else if (c.f.length <= 40 && c.b.length <= 70) out.push([SUBS[CN.byTheme[c.th].s], c.f + '?', c.b]); });
      const W = new Set(Object.keys(P).filter(k => P[k][1] === 0).map(k => BYID[k] && BYID[k].s));
      const base = (MEMO || []).slice().sort((a, b) => (W.has(SUBS.indexOf(b[0])) ? 1 : 0) - (W.has(SUBS.indexOf(a[0])) ? 1 : 0));
      return out.concat(base).slice(0, 60);
    }
    function memoListen() {
      const T = window.__tts, items = memoItems(), V = document.getElementById('view');
      if (!items.length) return window.__toast && __toast('암기 목록을 불러오는 중이에요. 잠시 후 다시 눌러 주세요');
      cur = 'memo'; window.scrollTo(0, 0); navA();
      const lines = []; items.forEach(([, q, a, tip], k) => { lines.push({ text: q + ' [pause long] [pause long]', k, s: 0 }); lines.push({ text: a + '.', k, s: 1 }); if (tip) lines.push({ text: '팁, ' + tip + '.', k, s: 2 }); lines.push({ text: a + '.', k, s: 1 }); });
      V.innerHTML = `<div class="card a1q"><small>🎧 암기 듣기 · ${items.length}개 · 묻고 3초 쉬고 답</small><div class="a1f" id="mq">${esc(items[0][1])}</div><div class="a1b" id="ma"></div><div class="muted" id="mt" style="font-size:14px;min-height:20px;margin-bottom:6px"></div><div class="muted" id="mn" style="font-size:12px">1 / ${items.length}</div><button class="btn" id="mst" style="width:100%">■ 그만</button><div class="muted" style="font-size:12px;margin-top:8px">화면을 꺼도 계속 읽어요.</div></div>`;
      document.getElementById('mst').onclick = () => { try { T && T.stop(); } catch (e) {} home(); };
      if (!T) return;
      T.onLine(({ line }) => { if (cur !== 'memo') return; const L = lines[line]; if (!L) return; const it = items[L.k]; const q = document.getElementById('mq'), a = document.getElementById('ma'), n = document.getElementById('mn'); if (!q) return; q.textContent = it[1]; a.textContent = L.s ? it[2] : ''; const t = document.getElementById('mt'); if (t) t.textContent = L.s === 2 || (L.s === 1 && t.textContent) ? (it[3] ? '💡 ' + it[3] : '') : ''; n.textContent = (L.k + 1) + ' / ' + items.length; });
      try { const lg = LSJ('reb_memolog', {}); lg[dkey()] = (lg[dkey()] || 0) + items.length; LSS('reb_memolog', lg); } catch (e) {}
      T.speak(lines.map(l => ({ text: l.text })), {}).catch(e => { if (e && e.code !== 'viewer_stopped' && window.__toast) __toast(e.message); });
    }
    window.memoListen = memoListen;
    // ── 더 자세히·기초부터 미리 받아 두기: 오늘 풀 문제를 뒤에서 조용히 ──
    let PF = false;
    async function prefetch(list) {
      if (PF || !window.__gem || !navigator.onLine) return; PF = true;
      const has = k => { try { return !!localStorage.getItem(k); } catch (e) { return true; } };
      const morePrompt = q => `너는 공인중개사 시험 강사야. 아래 기출문제를 수험생이 완전히 이해하도록 더 자세히, 쉬운 말로 설명해 줘. 왜 그 보기가 정답인지, 헷갈리는 보기는 왜 아닌지, 관련 개념과 암기 요령까지. 해요체, 8문장 안팎. 소리 내어 읽기 좋게 괄호·한자·기호는 쓰지 마.\n[정답] ${q.a}번\n[문제]\n${q.x}`;
      try {
        for (const q of list.slice(0, 30)) {
          if (!q || q.ocr) continue;
          for (const [k, pr] of [['reb_more_' + q.id, () => morePrompt(q)], ['reb_beg_' + q.id, () => (typeof begPrompt === 'function' ? begPrompt(q) : null)]]) {
            if (has(k)) continue; const prompt = pr(); if (!prompt) continue;
            const t = await window.__gem(prompt, { modelTier: 'default' }, false);   // 실패(한도 등)하면 멈춤
            if (t && String(t).trim().length > 30) { try { localStorage.setItem(k, t); } catch (e) { return; } }
            await new Promise(r => setTimeout(r, 2500));
          }
        }
      } catch (e) {} finally { PF = false; }
    }
    window.prefetchExp = prefetch;
    // ── 보기 롱터치 → 참·거짓을 가르는 낱말에 밑줄(힌트) ──
    async function keyHint(q) {
      const K = 'reb_key_' + q.id; let d = null; try { d = JSON.parse(localStorage.getItem(K)); } catch (e) {}
      const OPS = () => { const e = [...document.querySelectorAll('#view .qtext .elc')]; return e.length ? e : [...document.querySelectorAll('#view .choices button')].filter(b => b.innerText.trim().length > 3); };
      const bs = OPS(); if (!bs.length) return;
      if (!d) {
        if (!window.__gem) return window.__toast && __toast('인터넷 연결이 필요해요');
        window.__toast && __toast('🔎 힌트 찾는 중…');
        const ops = bs.map((b, i) => `${i + 1}. ${b.innerText.replace(/^\s*[①-⑤\d]+[.)]?\s*/, '').split('\n')[0]}`).join('\n');
        try {
          const raw = await window.__gem(`공인중개사 기출 문제의 각 보기에서, 그 보기가 옳은지 틀린지를 결정하는 핵심 낱말(숫자·기간·주체·요건 등)을 찾아. 보기 원문에 그대로 있는 2~12자 부분만 골라. 정답이나 옳고 그름은 절대 쓰지 말 것. JSON만: {"k":["보기1 핵심","보기2 핵심",...]}\n문제: ${q.x}\n보기:\n${ops}`, { modelTier: 'quick' }, true);
          d = JSON.parse(String(raw).replace(/^```(json)?|```$/g, '').trim()); if (!d || !Array.isArray(d.k)) throw 0;
          try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) {}
        } catch (e) { return window.__toast && __toast('힌트를 못 찾았어요. 잠시 후 다시 길게 눌러 주세요'); }
      }
      OPS().forEach((b, i) => {
        const w = String(d.k[i] || '').trim(); if (w.length < 2 || b.querySelector('.khint')) return;
        const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let n;
        while ((n = tw.nextNode())) { const at = n.nodeValue.indexOf(w); if (at < 0) continue; const r = document.createRange(); r.setStart(n, at); r.setEnd(n, at + w.length); const m = document.createElement('u'); m.className = 'khint'; r.surroundContents(m); break; }
      });
      try { haptic && haptic(); } catch (e) {}
    }
    setInterval(() => {
      try {
        if (cur !== 'quiz' || typeof S === 'undefined' || !S || !S.list) return; const q = S.list[S.i]; if (!q) return;
        document.querySelectorAll('#view .qtext .elc:not([data-lp]), #view .qtext .qstem:not([data-lp]), #view .qtext:not(:has(.qstem)):not([data-lp]), #view .choices button:not([data-lp])').forEach(b => {
          b.dataset.lp = 1; let t = null, x0 = 0, y0 = 0, fired = false;
          const act = () => { const q2 = S.list[S.i]; if (b.classList.contains('qstem') || b.classList.contains('qtext')) window.makeDiagram(q2, null, true); else keyHint(q2); };   // 문제 길게 → 관계도·계산 과정, 보기 길게 → 힌트 밑줄
          b.addEventListener('pointerdown', e => { fired = false; x0 = e.clientX; y0 = e.clientY; clearTimeout(t); t = setTimeout(() => { fired = true; act(); }, 550); });
          b.addEventListener('pointermove', e => { if (Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 12) clearTimeout(t); });
          ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => clearTimeout(t)));
          b.addEventListener('click', e => { if (fired) { fired = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
          b.addEventListener('contextmenu', e => e.preventDefault());
        });
      } catch (e) {}
    }, 400);
    // 아래 탭 3개
    function navA() {
      const nav = document.getElementById('tabs'); if (!nav) return;
      if (!nav.dataset.a) {
        nav.dataset.a = 1;
        nav.innerHTML = '<button data-v="home"><b>🏠</b>오늘</button><button data-v="wrong"><b>📕</b>오답</button><button data-v="stats"><b>📊</b>기록</button>';
        nav.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); go(b.dataset.v); });
      }
      const t = ['quiz', 'result'].includes(cur) ? ((window.S && S.from) === 'wrong' ? 'wrong' : 'home') : cur === 'wrong' ? 'wrong' : ['stats', 'hist', 'journal', 'plan'].includes(cur) ? 'stats' : cur === 'home' ? 'home' : '';
      nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === t));
    }
    const _goA = window.go;
    window.go = go = function (v, a) {
      if (v === 'setup' || v === 'concept' || v === 'ox') v = v === 'ox' ? 'ox' : 'home';   // 없어진 탭
      const r = _goA.call(this, v, a);
      if (cur === 'wrong') document.getElementById('rseg')?.remove();   // 오답 탭은 오답만
      navA(); return r;
    };
    navA(); if (cur === 'home') home();
  }, 50));
})();
