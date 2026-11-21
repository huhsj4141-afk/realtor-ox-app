/* 관계가 확인되는 개념만 질문→짧은 답으로 만든다. 문장 끝·임의 숫자 가리기는 하지 않는다. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {inspect,acceptAudit}=require('./memory-quality.cjs');
const ROOT=path.resolve(__dirname,'..'),hash=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
const clean=x=>typeof x==='string'?x.replace(/\s+/g,' ').trim():'',list=x=>Array.isArray(x)?x:[];
function readable(x){return clean(x).replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g,'($1) ÷ ($2)').replace(/\\(?:text|mathrm)\{([^{}]*)\}/g,'$1').replace(/\\times/g,' × ').replace(/\\div/g,' ÷ ').replace(/\\(?:left|right)/g,'').replace(/\\%/g,'%');}
const META=/빈출|출제자|출제\s*의도|수험생|혼동하게|유도하|유도하는|함정|정답\s*(?:도출|확정|선택)|[①②③④⑤]|[1-5]번이|[1-5]번을|이 문제|이 문항|암기해야|기억하세요|살펴보|확인한다|계산합니다|계산하면/;
const termText=x=>clean(x).replace(/\([^)]*\)/g,'').replace(/^['"‘“]|['"’”]$/g,'').trim();
const norm=s=>clean(s).replace(/\s+/g,'').replace(/[.。]$/,'');
function fieldValue(q,e,field){let v=field==='question'?q.x:e;for(const k of field==='question'?[]:field.split('.'))v=v?.[k];return Array.isArray(v)?v.join(' | '):clean(v);}
function build(mc,ex,ox,oxex,vars,blocked={},reviewed=[],audits={}){
 const cards=[],questions={},dedup=new Map(),protectedKeys=new Set(),coverage={method:'semantic-quality-v4',questions:mc.length,withExplanation:0,covered:0,cards:0,reviewed:0,pendingReview:0,skippedOCR:0,types:{},rejected:0};
 const byId=new Map(mc.map(q=>[q.id,q]));const bad=q=>![0,'0',false,null,undefined,''].includes(q.ocr);
 for(const q of mc)questions[q.id]={question:q.x,correct:q.a,label:'제'+q.n+'회 '+['학개론','민법','중개사법','공법','공시법','세법'][q.s]+' '+q.no+'번',year:q.y,topic:q.t};
 function add(q,field,term,relation,front,back,options={}){
  term=termText(term);front=clean(front);back=readable(back).replace(/[.。]$/,'');
  const e=ex[q.id],whole=fieldValue(q,e,field),quote=clean(options.evidence||whole);
  if(options.sourceHash&&options.sourceHash!==hash(whole)){coverage.rejected++;return;}
  if(!whole||!quote||!whole.includes(quote)||term.length<2||term.length>42||front.length<4||front.length>100||back.length<2||back.length>150||META.test(front+' '+back)||/\\[A-Za-z]/.test(back)||/^[\d\s.,%+*/=()÷×-]+$/.test(back)){coverage.rejected++;return;}
  if(!options.reviewed && (/^(?:자체|위탁|혼합|장점|단점|관리주체|관리기관|원칙|예외|기간|요건|종류|대상|목적|효과|기준|특징|정의|의의|의미|내용|비율|계산식|계산법|공식)$/.test(term)||/[+·=]/.test(term)||/(?:한다|된다|낸다|구입|불가|가능|필요)$/.test(term)||(term.match(/\(/g)||[]).length!==(term.match(/\)/g)||[]).length)){coverage.rejected++;return;}
  const relationKey=q.s+':'+norm(term)+':'+relation;
  if(!options.reviewed&&protectedKeys.has(relationKey))return;
  const source={id:q.id,field,quote};const key=relationKey+':'+norm(back),existing=dedup.get(key);
  if(existing){if(!existing.sources.some(s=>s.id===q.id&&s.field===field))existing.sources.push(source);return;}
  if(options.reviewed)protectedKeys.add(relationKey);
  const id='mem-'+hash('qa-v2:'+q.id+':'+field+':'+relation+':'+norm(term));
  const c={id,title:term,kind:relation==='공식'?'공식 카드':'개념 카드',subject:q.s,prompt:front,answer:back,
   cloze:options.cloze||null,blankAnswer:options.blank||null,
   why:clean(options.explanation||''),reviewed:!!options.reviewed,sources:[source],context:{topic:q.t,question:q.x,correct:q.a,year:q.y}};
  dedup.set(key,c);cards.push(c);
 }
 // 직접 대조한 핵심 카드를 먼저 배치. 원문 근거가 달라지면 누락/검토 대상으로 남김.
 for(const n of reviewed){const q=byId.get(n.qid);if(q&&!bad(q))add(q,n.field,n.term,n.relation,n.front,n.back,{...n,reviewed:true});}
 for(const q of mc){
  if(bad(q)){coverage.skippedOCR++;continue;}const e=ex[q.id];if(!e)continue;coverage.withExplanation++;
  // 요약·출제 의도·풀이 순서·오답 보기·숫자 계산 예제는 카드로 만들지 않는다.
  list(e.memo).forEach((raw,i)=>{
   const text=readable(raw);if(META.test(text))return;
   const m=/^(.{2,42}?)\s*[:：=]\s*(.{2,150})$/.exec(text);if(!m||/vs|비교|핵심|요령|주의/.test(m[1])||/[,;]|\s+vs\s+/.test(m[2]))return;
   const term=termText(m[1]);add(q,'memo.'+i,term,'정의',term+'의 의미는?',m[2]);
  });
  list(e.formulas).forEach((f,i)=>{
   const text=readable(f.tex),m=/^(.{1,42}?)\s*=\s*(.{2,130})$/.exec(text);if(!m||/\d/.test(m[1])||/\d/.test(m[2])||/\\[A-Za-z]/.test(m[2]))return;
   const term=termText(f.name||m[1]);add(q,'formulas.'+i+'.tex',term,'공식',term+'의 식은?',m[2],{cloze:m[1]+' = [        ]',blank:m[2]});
  });
  for(const key of ['diagram','diagram2']){
   const d=e[key];if(d?.type!=='table'||!Array.isArray(d.head))continue;
   list(d.rows).forEach((row,i)=>{
    if(!Array.isArray(row)||row.length<2)return;const term=termText(String(row[0]));if(/\d|단계|산출|계산|정답|결과/.test(term))return;
    row.slice(1).forEach((v,j)=>{const header=clean(d.head[j+1]);if(!/의미|정의|개념|특징|요건|대상|효과|기간|비율|방법|가능 여부|종류/.test(header))return;
     const definition=/의미|정의|개념/.test(header),relation=definition?'정의':header;
     add(q,key+'.rows.'+i,term,relation,definition?term+'란?':term+' — '+header+'?',String(v));
    });
   });
  }
  // 문장 전체가 아니라 명시적인 정의 관계만: 주어와 정의를 함께 유지한다.
  clean(e.concept).split(/(?<=[다요])\.\s+/).forEach((sentence,i)=>{
   if(META.test(sentence)||/^(이는|따라서|반면|그러나|또한|이때|특히|여기서)/.test(sentence))return;
   const m=/^(.{2,42}?)(?:이란|란|은|는)\s+(.{4,145}?)(?:을|를)?\s*(?:뜻합니다|의미합니다|말합니다|뜻한다|의미한다|말한다)[.]?$/.exec(sentence);if(!m)return;
   const term=termText(m[1]);if(/[,·]|\s(?:및|또는)\s/.test(term))return;
   add(q,'concept',term,'정의',term+'란?',m[2],{evidence:sentence});
  });
 }
 const candidates=cards.map(c=>({...c,revision:hash('qa-v2:'+JSON.stringify(c)+JSON.stringify(c.sources.map(s=>questions[s.id])))}));
 const active=[],audit=[];
 for(const c of candidates){
  const reasons=inspect(c);let accepted=null;
  if(c.reviewed&&!reasons.length)accepted={...c};else if(!c.reviewed)accepted=acceptAudit(c,audits[c.id]);
  if(accepted)accepted.revision=hash('quality-v4:'+JSON.stringify(accepted));
  const reported=blocked[c.id]?.revision===c.revision||blocked[c.id]?.answer===c.answer||accepted&&(blocked[c.id]?.revision===accepted.revision||blocked[c.id]?.answer===accepted.answer);
  if(reported){accepted=null;coverage.pendingReview++;}
  const editorial=!!accepted&&!c.reviewed;
  if(editorial)accepted=null;
  const status=editorial?'pending-editorial':accepted?'active':reported?'reported':c.reviewed?'needs-fix':audits[c.id]?.policy===4&&audits[c.id]?.sourceRevision===c.revision&&audits[c.id]?.valid===false?'rejected':'pending-semantic';
  audit.push({id:c.id,status,reasons,sourceRevision:c.revision});
  if(accepted)active.push(accepted);
 }
 const seen=new Set();active.forEach(c=>{c.sources.forEach(s=>seen.add(s.id));coverage.types[c.kind]=(coverage.types[c.kind]||0)+1;if(c.reviewed)coverage.reviewed++;});coverage.covered=seen.size;coverage.cards=active.length;coverage.candidates=candidates.length;coverage.pendingSemantic=audit.filter(a=>a.status==='pending-semantic').length;coverage.pendingEditorial=audit.filter(a=>a.status==='pending-editorial').length;coverage.rejectedByAudit=audit.filter(a=>a.status==='rejected'||a.status==='needs-fix').length;
 return {cards:active,questions,coverage,candidates,audit};
}
function main(){const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8').replace(/^\uFEFF/,''));const d=build(read('data/mc.json'),read('gen/mc_exp.json'),[],{},{},fs.existsSync(path.join(ROOT,'gen/memory-blocked.json'))?read('gen/memory-blocked.json'):{},read('data/memory-reviewed.json'),fs.existsSync(path.join(ROOT,'gen/memory-audit.json'))?read('gen/memory-audit.json'):{});
 fs.writeFileSync(path.join(ROOT,'web/memory-data.js'),'window.MEMORY_META = '+JSON.stringify(d.coverage)+';\nwindow.MEMORY_QUESTIONS = '+JSON.stringify(d.questions)+';\nwindow.MEMORY_CARDS = '+JSON.stringify(d.cards,null,2)+';\n');fs.writeFileSync(path.join(ROOT,'gen/memory-candidates.json'),JSON.stringify(d.candidates));fs.writeFileSync(path.join(ROOT,'gen/memory-audit-report.json'),JSON.stringify({coverage:d.coverage,items:d.audit},null,2));console.log(JSON.stringify(d.coverage));return d;}
if(require.main===module)main();module.exports={build,readable,META};
