'use strict';
/* Навчальна детермінована модель; реальні мережеві запити не виконуються. */
const NODES = [
  {id:'pc1', name:'ПК адміністратора', type:'Робоча станція',code:'PC-01',x:100,y:154,icon:'⌘',desc:'Клієнтський пристрій, який може надсилати та приймати демонстраційні пакети.'},
  {id:'pc2', name:'ПК користувача', type:'Робоча станція',code:'PC-02',x:105,y:363,icon:'⌘',desc:'Другий комп’ютер, під’єднаний до комутатора локального сегмента.'},
  {id:'switch', name:'Комутатор', type:'Мережевий вузол',code:'SW-01',x:302,y:261,icon:'▦',desc:'Об’єднує робочі станції в умовний локальний сегмент мережі.'},
  {id:'router', name:'Маршрутизатор', type:'Центральний вузол',code:'R-01',x:509,y:252,icon:'◎',desc:'Центральний вузол, що з’єднує сегменти навчальної топології.'},
  {id:'web', name:'Вебсервер', type:'Сервер',code:'SRV-WEB',x:762,y:132,icon:'▤',desc:'Навчальний сервер вебресурсу. За збою прямої лінії доступний через резервну ділянку.'},
  {id:'db', name:'Сервер даних', type:'Сервер',code:'SRV-DB',x:776,y:350,icon:'▥',desc:'Другий сервер, який використовується як проміжний вузол резервного маршруту.'},
  {id:'ap', name:'Точка доступу', type:'Бездротовий сегмент',code:'AP-01',x:499,y:431,icon:'⌁',desc:'Пристрій доступу, що з’єднує ноутбук з основною мережею.'},
  {id:'laptop', name:'Ноутбук', type:'Клієнтський пристрій',code:'NB-01',x:289,y:449,icon:'▣',desc:'Пристрій бездротового сегмента; умовно під’єднаний через точку доступу.'}
];
const EDGES = [
  {a:'pc1',b:'switch',ms:10},{a:'pc2',b:'switch',ms:14},{a:'switch',b:'router',ms:12},
  {a:'router',b:'web',ms:18},{a:'router',b:'db',ms:24},{a:'web',b:'db',ms:20},
  {a:'router',b:'ap',ms:16},{a:'ap',b:'laptop',ms:13}
];
const $ = id => document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const state={mode:'normal',speed:1,selected:'router',path:[],running:false,paused:false,position:0,elapsed:0,lastFrame:0,raf:0};
const nodeById=id=>NODES.find(n=>n.id===id);
function edgeId(a,b){return [a,b].sort().join(':');}
function isDisabled(edge){return state.mode==='fault'&&edgeId(edge.a,edge.b)===edgeId('router','web');}
function activeEdges(){return EDGES.filter(e=>!isDisabled(e));}
function pathEdges(path){return path.slice(1).map((id,i)=>EDGES.find(e=>edgeId(e.a,e.b)===edgeId(path[i],id)));}
/* BFS: кожне з’єднання вважається одним кроком; це не Dijkstra і не реальний маршрутизатор. */
function findPath(start,goal){
 if(!nodeById(start)||!nodeById(goal)||start===goal)return [];
 const visited=new Set([start]), queue=[[start]];
 while(queue.length){const path=queue.shift(); const last=path[path.length-1];
  for(const e of activeEdges()){
   const next=e.a===last?e.b:e.b===last?e.a:null;
   if(next&& !visited.has(next)){
    const candidate=[...path,next]; if(next===goal)return candidate;
    visited.add(next);queue.push(candidate);
   }
  }
 }return [];
}
function latency(path){const base=pathEdges(path).reduce((n,e)=>n+e.ms,0);return state.mode==='overload'?Math.round(base*2.2):base;}
function svgEl(tag,attributes={}){const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attributes))el.setAttribute(k,String(v));return el;}
function line(a,b,className){return svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:className});}
function renderNetwork(){
 const edgeLayer=$('edgeLayer'),routeLayer=$('routeLayer'),nodeLayer=$('nodeLayer'); edgeLayer.replaceChildren();routeLayer.replaceChildren();nodeLayer.replaceChildren();
 for(const e of EDGES){const a=nodeById(e.a),b=nodeById(e.b);edgeLayer.append(line(a,b,'edge'+(isDisabled(e)?' disabled':'')));}
 for(const e of pathEdges(state.path)){if(!e||isDisabled(e))continue;routeLayer.append(line(nodeById(e.a),nodeById(e.b),'route-edge'));}
 for(const n of NODES){const g=svgEl('g',{class:'node-group'+(n.id===state.selected?' selected':''),transform:`translate(${n.x} ${n.y})`,role:'button',tabindex:'0','aria-label':`${n.name}, відкрити опис`});
  g.append(svgEl('circle',{r:36,class:'node-halo'}));
  const icon=svgEl('text',{x:0,y:1,class:'node-symbol'});icon.textContent=n.icon;g.append(icon);
  const title=svgEl('text',{x:0,y:58,class:'node-text'});title.textContent=n.name;g.append(title);
  const caption=svgEl('text',{x:0,y:75,class:'node-caption'});caption.textContent=n.code;g.append(caption);
  g.addEventListener('click',()=>selectNode(n.id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectNode(n.id);}});
  nodeLayer.append(g);
 }
 $('metricLinks').textContent=String(activeEdges().length).padStart(2,'0');$('linkCount').textContent=`${activeEdges().length} з'єднань`;
 $('linksCaption').textContent=state.mode==='fault'?'1 лінія недоступна':'Усі лінії доступні';
 $('stateName').textContent=state.mode==='fault'?'Збій прямої лінії':state.mode==='overload'?'Підвищене навантаження':'Мережа працює';
 $('stateDot').style.background=state.mode==='fault'?'#ff929a':state.mode==='overload'?'#ffc677':'#3ee3b6';
}
function selectNode(id){const n=nodeById(id);if(!n)return;state.selected=id; $('nodeDetails').replaceChildren();
 const h=document.createElement('h4');h.textContent=n.name;const p=document.createElement('p');p.textContent=n.desc;const tag=document.createElement('span');tag.className='device-tag';tag.textContent=n.type+' / '+n.code;
 $('nodeDetails').append(h,p,tag); renderNetwork();log(`Вибрано пристрій «${n.name}».`);
}
function showMessage(msg,error=false){$('message').textContent=msg;$('message').classList.toggle('error',error);}
function now(){return new Date().toLocaleTimeString('uk-UA',{hour12:false});}
function log(message){const list=$('eventLog'),li=document.createElement('li'),time=document.createElement('time'),span=document.createElement('span');time.textContent=now();span.textContent=message;li.append(time,span);list.prepend(li);while(list.children.length>7)list.lastElementChild.remove();}
function readRoute(){const start=$('sourceSelect').value,goal=$('targetSelect').value;
 if(start===goal){showMessage('Оберіть різні вузли: відправник не може збігатися з одержувачем.',true);return [];}const path=findPath(start,goal);
 if(!path.length){showMessage('Маршрут між вибраними вузлами недоступний.',true);return [];}return path;
}
function showRoute(){stopAnimation(false);const path=readRoute();state.path=path;renderNetwork();
 if(path.length){const ms=latency(path);$('metricLatency').innerHTML=`${ms} <em>мс</em>`;showMessage(`Маршрут: ${path.map(id=>nodeById(id).code).join(' → ')}. Умовна затримка: ${ms} мс.`);log(`Побудовано шлях із ${path.length-1} з'єднань. Оцінка: ${ms} мс.`);}return path;
}
function erasePacket(){ $('packetLayer').replaceChildren(); }
function stopAnimation(clearPath=true){if(state.raf)cancelAnimationFrame(state.raf);state.raf=0;state.running=false;state.paused=false;state.lastFrame=0;state.elapsed=0;state.position=0;$('pauseBtn').disabled=true;$('pauseBtn').textContent='Пауза';$('sendBtn').disabled=false;erasePacket();if(clearPath){state.path=[];renderNetwork();}}
function movePacket(t){const path=state.path;if(path.length<2)return; const segments=pathEdges(path);const durations=segments.map(e=>e.ms);const total=durations.reduce((a,b)=>a+b,0);let accum=0;
 for(let i=0;i<segments.length;i++){
  const share=durations[i]/total; if(t<=accum+share||i===segments.length-1){const local=Math.max(0,Math.min(1,(t-accum)/share));const a=nodeById(path[i]),b=nodeById(path[i+1]);const x=a.x+(b.x-a.x)*local,y=a.y+(b.y-a.y)*local;
   const layer=$('packetLayer');layer.replaceChildren(svgEl('circle',{cx:x,cy:y,r:18,class:'packet-glow'}),svgEl('circle',{cx:x,cy:y,r:7,class:'packet-core'}));return;
  }accum+=share;
 }
}
function frame(timestamp){if(!state.running||state.paused)return;
 if(!state.lastFrame)state.lastFrame=timestamp;
 const delta=Math.min(100,timestamp-state.lastFrame);state.lastFrame=timestamp;
 /* Фізична тривалість анімації відділена від умовної затримки в мс. */
 const duration=2200+((state.path.length-1)*220);state.elapsed+=delta*state.speed;
 state.position=Math.min(1,state.elapsed/duration);movePacket(state.position);
 if(state.position>=1){const target=nodeById(state.path[state.path.length-1]);const m=latency(state.path);stopAnimation(false);showMessage(`Пакет доставлено до «${target.name}». Умовна затримка: ${m} мс.`);log(`Пакет доставлено: ${target.code}. ${m} мс (умовна оцінка).`);return;}
 state.raf=requestAnimationFrame(frame);
}
function sendPacket(){const path=showRoute();if(!path.length)return;state.running=true;state.paused=false;state.elapsed=0;state.lastFrame=0;state.position=0;$('pauseBtn').disabled=false;$('sendBtn').disabled=true;movePacket(0);showMessage('Пакет рухається обраним маршрутом. Можна поставити на паузу.');log(`Відправлено пакет: ${nodeById(path[0]).code} → ${nodeById(path.at(-1)).code}.`);state.raf=requestAnimationFrame(frame);}
function pause(){if(!state.running)return;state.paused=!state.paused;$('pauseBtn').textContent=state.paused?'Продовжити':'Пауза';showMessage(state.paused?'Передавання призупинено.':'Передавання відновлено.');log(state.paused?'Передавання призупинено.':'Передавання відновлено.');if(!state.paused){state.lastFrame=0;state.raf=requestAnimationFrame(frame);}}
function reset(){stopAnimation();$('sourceSelect').value='pc1';$('targetSelect').value='web';$('speedSlider').value='1';$('speedValue').textContent='1.0×';state.speed=1;state.mode='normal';document.querySelector('input[name="mode"][value="normal"]').checked=true;selectNode('router');$('metricLatency').innerHTML='— <em>мс</em>';showMessage('Налаштування відновлено. Оберіть вузли та почніть передавання.');log('Налаштування симулятора скинуто.');}
function init(){for(const n of NODES){for(const id of ['sourceSelect','targetSelect']){const opt=document.createElement('option');opt.value=n.id;opt.textContent=n.name+' · '+n.code;$(id).append(opt);}}
 $('sourceSelect').value='pc1';$('targetSelect').value='web';renderNetwork();
 $('routeBtn').addEventListener('click',showRoute);$('sendBtn').addEventListener('click',sendPacket);$('pauseBtn').addEventListener('click',pause);$('resetBtn').addEventListener('click',reset);
 $('clearLogBtn').addEventListener('click',()=>{ $('eventLog').replaceChildren();log('Журнал очищено.'); });
 for(const input of document.querySelectorAll('input[name="mode"]')) input.addEventListener('change',()=>{if(!input.checked)return;stopAnimation();state.mode=input.value;renderNetwork();$('metricLatency').innerHTML='— <em>мс</em>';const desc={normal:'Нормальний режим',overload:'Навантаження: умовні затримки ×2,2',fault:'Збій: лінія R-01 ↔ SRV-WEB вимкнена'};showMessage(`Режим: ${desc[state.mode]}. Побудуйте маршрут заново.`);log(`Змінено режим: ${desc[state.mode]}.`);});
 $('speedSlider').addEventListener('input',e=>{state.speed=Number(e.target.value);$('speedValue').textContent=state.speed.toFixed(2).replace(/\.00$/,'.0').replace(/0$/, state.speed===1?'0':'')+'×';});
 $('sourceSelect').addEventListener('change',()=>{stopAnimation();showMessage('Відправник змінений. Побудуйте новий маршрут.');});
 $('targetSelect').addEventListener('change',()=>{stopAnimation();showMessage('Одержувач змінений. Побудуйте новий маршрут.');});
}
document.addEventListener('DOMContentLoaded',init);
/* Публічні безпечні функції для локального тестування в браузері. */
window.NetLab={findPath,latency,edgeId};
