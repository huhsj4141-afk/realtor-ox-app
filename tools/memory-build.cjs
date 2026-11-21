/* 저장된 지문·해설·공식·풀이를 근거와 함께 추출. 추가 AI/음성 API 호출 없음. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
const clean=x=>typeof x==='string'?x.replace(/\s+/g,' ').trim():'';
function readable(x){return clean(x).replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g,'($1) ÷ ($2)').replace(/\\(?:text|mathrm)\{([^{}]*)\}/g,'$1').replace(/\\times/g,' × ').replace(/\\div/g,' ÷ ').replace(/\\(?:left|right)/g,'').replace(/\\%/g,'%');}
function build(mc,ex,ox,oxex,vars,blocked={}){
  const cards=[],dedup=new Map(),questions={},coverage={questions:mc.length,withExplanation:0,covered:0,skippedOCR:0,types:{},oxStatements:0};
  const byId=new Map(mc.map(q=>[q.id,q]));
  const list=x=>Array.isArray(x)?x:[];
  const badOCR=q=>![0,"0",false,null,undefined,""].includes(q.ocr);
  function add(q,field,answer,kind,quote=answer,extra={}){
    answer=readable(answer);quote=clean(quote);
    if(answer.length<8||answer.length>650||/^([①②③④⑤]|[1-5]번|정답은?\s*[1-5])/.test(answer))return;
    const label='제'+q.n+'회 '+['학개론','민법','중개사법','공법','공시법','세법'][q.s]+' '+q.no+'번';
    const source={id:q.id,label,quote,field,kind,year:q.y,...extra};
    const key=q.s+':'+answer.replace(/\s+/g,'').replace(/[。.]$/,'');
    const old=dedup.get(key);if(old){if(!old.sources.some(s=>s.id===q.id&&s.field===field))old.sources.push(source);return;}
    const id='mem-'+hash(q.id+':'+field);
    const prompt=kind==='공식'?'다음 공식의 식과 쓰임을 떠올려 보세요: '+(extra.name||q.t):kind==='틀린 지문 해설'?'이 지문은 왜 틀렸나요?\n'+extra.statement:(q.t||q.u)+'에서 기억할 '+kind+'은 무엇인가요?';
    let cloze=answer;const nums=[...answer.matchAll(/\d+(?:\.\d+)?\s*(?:년|개월|일|시간|분|%|배|명|개|만원|억원)/g)];
    if(nums.length){const n=nums[0];cloze=answer.slice(0,n.index)+'[        ]'+answer.slice(n.index+n[0].length);}
    else if(answer.includes('=')){cloze=answer.split('=')[0]+'= [        ]';}
    else {const m=/^(.{4,65}?(?:은|는|란|이란))\s+(.{4,})$/.exec(answer);cloze=m?m[1]+' [        ]':'핵심 내용 떠올리기: '+(q.t||q.u)+'\n[        ]';}
    const c={id,title:(extra.name||q.t||q.u).slice(0,70),kind,subject:q.s,cloze,prompt,answer,
      why:kind==='틀린 지문 해설'?'틀린 원문을 정답으로 외우지 말고, 해설에서 틀린 이유를 확인하세요.':'저장된 자료에서 자동으로 뽑은 내용입니다. 출처와 조건을 함께 확인하세요.',
      trap:clean(ex[q.id]?.trap).slice(0,300),application:'이 핵심이 쓰인 원래 기출문제를 풀어보세요.',applicationAnswer:'원래 기출 정답: '+q.a+'번.\n'+answer,source,sources:[source]};
    dedup.set(key,c);cards.push(c);coverage.types[kind]=(coverage.types[kind]||0)+1;
  }
  for(const q of mc){
    questions[q.id]={question:q.x,correct:q.a,label:'제'+q.n+'회 '+['학개론','민법','중개사법','공법','공시법','세법'][q.s]+' '+q.no+'번',year:q.y,topic:q.t,trap:clean(ex[q.id]?.trap).slice(0,300)};
    if(badOCR(q)){coverage.skippedOCR++;continue;}
    const e=ex[q.id];if(!e)continue;coverage.withExplanation++;
    if(e.summary)add(q,'summary',e.summary,'해설 요약');
    if(e.warn)add(q,'warn',e.warn,'기준·개정 유의');
    for(const key of ['diagram','diagram2']){const d=e[key];if(d?.type==='table'&&Array.isArray(d.rows))d.rows.forEach((row,i)=>{if(Array.isArray(row))add(q,key+'.rows.'+i,row.map((v,j)=>(d.head?.[j]?d.head[j]+': ':'')+String(v)).join(' · '),'풀이 표');});}
    list(e.memo).forEach((s,i)=>add(q,'memo.'+i,s,'암기 요약'));
    list(e.formulas).forEach((f,i)=>{add(q,'formulas.'+i,f.tex,'공식',f.tex,{name:clean(f.name)});if(f.note)add(q,'formulas.'+i+'.note',f.note,'공식 설명');});
    list(e.steps).forEach((f,i)=>{add(q,'steps.'+i+'.say',f.say,'풀이',f.say,{name:clean(f.title)});if(f.tex)add(q,'steps.'+i+'.tex',f.tex,'계산식',f.tex,{name:clean(f.title)});});
    if(e.concept)clean(e.concept).split(/(?<=[.!?])\s+/).forEach((s,i)=>add(q,'concept.'+i,s,'개념 해설'));
    list(e.choices).forEach((c,i)=>{if(c.ox==='O')add(q,'choices.'+i,c.why,'지문 해설');else if(c.fix)add(q,'choices.'+i+'.fix',c.fix,'정정 지문',c.fix);});
    if(!/틀린|옳지|아닌/.test((q.k||'')+' '+q.x.split('①')[0])){
      const choices=[...q.x.matchAll(/[①②③④⑤]([^①②③④⑤]*)/g)];
      if(/^[1-5]$/.test(q.a)){const choice=choices[+q.a-1]?.[1];if(choice)add(q,'correct-choice',choice,'정답 지문');}
    }
  }
  list(ox).forEach((track,ti)=>list(track.items).forEach((it,i)=>{
    const q=byId.get(it.ref);if(!q||badOCR(q))return;coverage.oxStatements++;
    if(it.o===1||it.o===true)add(q,'ox.'+ti+'_'+i,it.s,'OX 지문',it.s,{ox:ti+'_'+i});
    else if(oxex[ti+'_'+i])add(q,'ox.'+ti+'_'+i,oxex[ti+'_'+i],'틀린 지문 해설',oxex[ti+'_'+i],{ox:ti+'_'+i,statement:it.s});
  }));
  Object.entries(vars||{}).forEach(([key,v])=>{const m=/^(.+)_([1-5])$/.exec(key),q=m&&byId.get(m[1]);if(!q||badOCR(q))return;if(v.o===1||v.o===true)add(q,'variation.'+key,v.s,'OX 변형 지문');else if(v.fix&&v.bad&&v.s.includes(v.bad))add(q,'variation.'+key,v.s.replace(v.bad,v.fix),'정정 OX 지문');});
  const seen=new Set();cards.forEach(c=>{c.sources.forEach(s=>seen.add(s.id));c.revision=hash(c.answer+JSON.stringify(c.sources)+JSON.stringify(c.sources.map(s=>questions[s.id])));});coverage.covered=seen.size;coverage.cards=cards.length;
  const compact=cards.map(c=>({id:c.id,title:c.title,kind:c.kind,subject:c.subject,answer:c.answer,revision:c.revision,sources:c.sources.map(s=>{
    const {label,year,kind,...o}=s;if(o.quote===clean(c.answer))delete o.quote;return o;
  })}));
  const active=compact.filter(c=>blocked[c.id]?.revision!==c.revision&&blocked[c.id]?.answer!==c.answer);coverage.pendingReview=compact.length-active.length;coverage.cards=active.length;return {cards:active,questions,coverage};
}
function main(){const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));const d=build(read('data/mc.json'),read('gen/mc_exp.json'),read('data/ox.json'),read('gen/exp.json'),read('gen/ox_var.json'),fs.existsSync(path.join(ROOT,'gen/memory-blocked.json'))?read('gen/memory-blocked.json'):{});
  fs.writeFileSync(path.join(ROOT,'web/memory-data.js'),'window.MEMORY_META = '+JSON.stringify(d.coverage)+';\nwindow.MEMORY_QUESTIONS = '+JSON.stringify(d.questions)+';\nwindow.MEMORY_CARDS = '+JSON.stringify(d.cards)+';\n');console.log(JSON.stringify(d.coverage));return d;
}
if(require.main===module)main();module.exports={build,readable};
