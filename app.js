(() => {
  const STORAGE_KEY = 'householdChorePlanner.v1';
  const CATEGORIES = ['Cleaning','Laundry','Pets','Maintenance / Routine','Deep Clean'];
  const CATEGORY_EMOJI = {
    'Cleaning':'🧽','Laundry':'🧺','Pets':'🐾','Maintenance / Routine':'🔧','Deep Clean':'✨'
  };
  const importanceLabel = {essential:'Essential', regular:'Regular', low:'Low stakes'};
  const dayMs = 86400000;
  let plannerWeekStart = startOfWeek(new Date());
  let activeCategory = 'All';
  let energyMode = 'soon';
  let toastTimer;

  const starter = () => ({
    version: 1.2,
    settings: {
      people: ['Mak','Ty'],
      grace: { essential: 1, regular: 2, low: 4 },
      supabaseUrl: '', supabaseKey: '', syncId: 'mak-household'
    },
    chores: [
      // Everyday / frequent cleaning
      makeChore('Clean the Kitchen','Cleaning',2,'days','essential','either','completion',0,'Kitchen'),
      makeChore('Vacuum','Cleaning',4,'days','regular','either','completion',1,'Bedroom + office / wherever needed'),
      makeChore('Dust','Cleaning',7,'days','regular','either','completion',2,'Often paired with Wipe Surfaces'),
      makeChore('Wipe Surfaces','Cleaning',7,'days','regular','either','completion',2,'Non-kitchen • bedroom + office • often paired with Dust'),
      makeChore('Clean Under the Bed','Cleaning',2,'weeks','regular','either','completion',8,'Trash, toys, hair + dust bunnies'),

      // Household organization / routine
      makeChore('Organize Junk Drawer','Maintenance / Routine',2,'weeks','low','either','completion',10,'Bedroom TV catch-all drawer'),
      makeChore('Organize Products','Maintenance / Routine',1,'months','low','either','completion',21,'Product storage areas'),
      makeChore('Organize Office Closet','Maintenance / Routine',2,'months','low','either','completion',45,'Go through + move things to storage if needed'),
      makeChore('Empty Trashes','Maintenance / Routine',7,'days','regular','either','completion',3,'Consolidate household trash cans'),

      // Pets
      makeChore('Kitty Litter','Pets',2,'days','essential','either','completion',0,'Two litter boxes • 3 cats'),
      makeChore('Wash & Fill Water Bowls','Pets',7,'days','essential','either','completion',5,'Two large gravity water bowls'),
      makeChore('Clean Oakley Kennel','Pets',2,'weeks','regular','either','completion',12,'Wash blankets, wipe down + go through toys'),

      // Laundry
      makeChore('Wash Bedding','Laundry',7,'days','regular','either','completion',4,''),
      makeChore('Wash Office Bedding','Laundry',1,'months','regular','either','completion',18,'Office throw blankets'),
      makeChore('Laundry','Laundry',4,'days','regular','either','completion',1,'Clothes • roughly twice a week'),

      // Deep-clean / occasional chores
      makeChore('Clean Mini Fridge','Deep Clean',1,'months','low','either','completion',20,'Office mini fridge • toss old items + wipe down'),
      makeChore('Wash Curtains','Deep Clean',3,'months','low','either','completion',60,''),
      makeChore('Clean Windows','Deep Clean',2,'months','low','either','completion',35,'Windex inside of windows'),

      // Maintenance / personal routine items
      makeChore('Clean PC','Maintenance / Routine',2,'months','low','either','completion',45,'Take apart, dust + wipe down'),
      makeChore('Go Through Closet','Maintenance / Routine',1,'months','low','either','completion',25,'Clothes • sell/donate what is not being worn'),
      makeChore('Wash Water Bottle','Maintenance / Routine',3,'days','regular','either','completion',0,'Daily Owala bottle'),
      makeChore('Change Filters','Maintenance / Routine',2,'months','regular','either','fixed',55,'Air purifier + A/C unit filter when in use'),
      makeChore('Organize Office Entertainment Stand','Maintenance / Routine',1,'months','low','either','completion',16,'Office TV shelves • knickknacks + crafting items')
    ],
    instances: [],
    history: [],
    lastAutoPlanAt: null
  });

  // Default chores start with no fabricated completion history. starterDueInDays seeds
  // the first planning cycle so Reset gives a usable week without claiming a chore
  // was completed when it was not.
  function makeChore(name, category, recurrenceValue, recurrenceUnit, importance, assignee, scheduleBehavior, starterDueInDays=0, areas='') {
    const due = addDays(today(), Number(starterDueInDays)||0);
    const anchor = new Date(due);
    if (recurrenceUnit==='days') anchor.setDate(anchor.getDate()-Number(recurrenceValue));
    if (recurrenceUnit==='weeks') anchor.setDate(anchor.getDate()-(7*Number(recurrenceValue)));
    if (recurrenceUnit==='months') anchor.setMonth(anchor.getMonth()-Number(recurrenceValue));
    return {
      id: uid('chore'), name, category, recurrenceValue, recurrenceUnit, importance, assignee,
      scheduleBehavior, areas, graceOverride: null,
      lastCompleted: null,
      anchorDate: toISO(anchor),
      active: true, createdAt: new Date().toISOString()
    };
  }

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return starter();
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch (e) { console.warn(e); return starter(); }
  }

  function normalizeState(s) {
    const base = starter();
    return {
      ...base,
      ...s,
      settings: {...base.settings, ...(s.settings||{}), grace:{...base.settings.grace, ...((s.settings||{}).grace||{})}},
      chores: Array.isArray(s.chores) ? s.chores : base.chores,
      instances: Array.isArray(s.instances) ? s.instances : [],
      history: Array.isArray(s.history) ? s.history : []
    };
  }

  function saveState(message='Saved') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const status = document.getElementById('sidebarStatus');
    if (status) status.textContent = `Saved locally • ${new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}`;
    if (message) toast(message);
  }

  function uid(prefix='id') { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
  function today() { const d = new Date(); d.setHours(0,0,0,0); return d; }
  function parseISO(s) { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
  function toISO(d) { const x = new Date(d); x.setMinutes(x.getMinutes()-x.getTimezoneOffset()); return x.toISOString().slice(0,10); }
  function addDays(d,n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
  function daysBetween(a,b) { return Math.round((parseDateish(b)-parseDateish(a))/dayMs); }
  function parseDateish(x) { if (x instanceof Date) { const d=new Date(x); d.setHours(0,0,0,0); return d; } return parseISO(x); }
  function startOfWeek(d) { const x=new Date(d); x.setHours(0,0,0,0); const day=x.getDay(); const diff=(day+6)%7; return addDays(x,-diff); }
  function endOfWeek(d) { return addDays(startOfWeek(d),6); }
  function sameDate(a,b) { return toISO(parseDateish(a))===toISO(parseDateish(b)); }
  function formatShort(d) { return parseDateish(d).toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
  function formatLong(d) { return parseDateish(d).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}); }
  function relativeDate(iso) {
    if (!iso) return 'Never';
    const diff = daysBetween(today(), iso);
    if (diff===0) return 'Today';
    if (diff===1) return 'Tomorrow';
    if (diff===-1) return 'Yesterday';
    if (diff>1 && diff<7) return `In ${diff} days`;
    if (diff< -1 && diff>-7) return `${Math.abs(diff)} days ago`;
    return formatShort(iso);
  }
  function recurrenceText(c) {
    const unit = c.recurrenceValue===1 ? c.recurrenceUnit.replace(/s$/,'') : c.recurrenceUnit;
    return `Every ${c.recurrenceValue} ${unit}`;
  }
  function addRecurrence(date, chore) {
    const x = new Date(date);
    if (chore.recurrenceUnit==='days') x.setDate(x.getDate()+Number(chore.recurrenceValue));
    if (chore.recurrenceUnit==='weeks') x.setDate(x.getDate()+7*Number(chore.recurrenceValue));
    if (chore.recurrenceUnit==='months') x.setMonth(x.getMonth()+Number(chore.recurrenceValue));
    return x;
  }
  function getGrace(chore) {
    return chore.graceOverride !== null && chore.graceOverride !== '' && chore.graceOverride !== undefined
      ? Number(chore.graceOverride) : Number(state.settings.grace[chore.importance] ?? 2);
  }
  function nextDue(chore) {
    const effectiveBehavior = chore.scheduleBehavior==='ask' ? (chore.lastCompletionChoice || 'completion') : chore.scheduleBehavior;
    const base = effectiveBehavior==='fixed' ? (chore.anchorDate || chore.lastCompleted || chore.createdAt.slice(0,10)) : (chore.lastCompleted || chore.anchorDate || chore.createdAt.slice(0,10));
    let due = addRecurrence(parseISO(base), chore);
    // For fixed schedules, keep stepping forward from anchor until the first cycle after the most recent completion.
    if (effectiveBehavior==='fixed' && chore.lastCompleted) {
      const completed = parseISO(chore.lastCompleted);
      while (due <= completed) due = addRecurrence(due, chore);
    }
    return toISO(due);
  }
  function choreById(id) { return state.chores.find(c=>c.id===id); }
  function instanceById(id) { return state.instances.find(i=>i.id===id); }
  function currentPeople() { return state.settings.people; }
  function personLabel(key) {
    const [p1,p2]=currentPeople();
    if (key==='person1') return p1;
    if (key==='person2') return p2;
    if (key==='mak') return p1;
    if (key==='ty') return p2;
    return 'Either';
  }
  function normalizeAssignee(key) {
    if (key==='mak') return 'person1'; if (key==='ty') return 'person2'; return key || 'either';
  }

  function completionHistoryFor(choreId) { return state.history.filter(h=>h.choreId===choreId).sort((a,b)=>b.completedAt.localeCompare(a.completedAt)); }
  function chooseAssignee(chore, weekStart) {
    const explicit = normalizeAssignee(chore.assignee);
    if (explicit !== 'either') return explicit;
    const hist = completionHistoryFor(chore.id);
    if (hist.length && ['person1','person2'].includes(hist[0].completedBy)) return hist[0].completedBy==='person1' ? 'person2' : 'person1';
    const ws=toISO(weekStart), we=toISO(endOfWeek(weekStart));
    const counts={person1:0,person2:0};
    state.instances.filter(i=>i.scheduledDate>=ws&&i.scheduledDate<=we&&!i.completed).forEach(i=>{ if(counts[i.assignedTo]!==undefined)counts[i.assignedTo]++; });
    return counts.person1<=counts.person2?'person1':'person2';
  }

  function getOpenRecurringInstance(choreId) {
    return state.instances.find(i=>i.choreId===choreId && !i.completed && !i.cancelled);
  }

  function ensureAutoPlan() {
    carryForwardMissed();
    const ws = startOfWeek(today());
    const weekKey = toISO(ws);
    const hasWeek = state.instances.some(i=>i.scheduledDate>=weekKey && i.scheduledDate<=toISO(endOfWeek(ws)) && !i.cancelled);
    if (!hasWeek) autoPlanWeek(ws, false);
  }

  function autoPlanWeek(weekStart, notify=true, onlyMissing=true) {
    const ws = startOfWeek(weekStart), we=endOfWeek(ws), wsIso=toISO(ws), weIso=toISO(we);
    const loads = {};
    for(let i=0;i<7;i++) loads[toISO(addDays(ws,i))]=state.instances.filter(x=>x.scheduledDate===toISO(addDays(ws,i))&&!x.completed&&!x.cancelled).length;

    state.chores.filter(c=>c.active!==false).forEach(chore=>{
      if (onlyMissing && getOpenRecurringInstance(chore.id)) return;
      if (!onlyMissing) {
        state.instances = state.instances.filter(i=>!(i.choreId===chore.id && !i.completed && !i.cancelled && i.scheduledDate>=wsIso && i.scheduledDate<=weIso));
      }
      let due = nextDue(chore);
      const grace = getGrace(chore);
      const graceEnd = toISO(addDays(parseISO(due),grace));
      if (due > weIso) return;
      let earliest = due < wsIso ? wsIso : due;
      let latest = graceEnd < weIso ? graceEnd : weIso;
      if (latest < wsIso) { earliest=wsIso; latest=wsIso; }
      let candidates=[];
      let cur=parseISO(earliest);
      while (toISO(cur)<=latest) { candidates.push(toISO(cur)); cur=addDays(cur,1); }
      if (!candidates.length) candidates=[wsIso];
      candidates.sort((a,b)=>(loads[a]??0)-(loads[b]??0) || a.localeCompare(b));
      const scheduled=candidates[0]; loads[scheduled]=(loads[scheduled]||0)+1;
      state.instances.push({
        id:uid('inst'), choreId:chore.id, name:chore.name, category:chore.category, importance:chore.importance,
        originalDue:due, scheduledDate:scheduled, assignedTo:chooseAssignee(chore,ws), completed:false, completedAt:null,
        oneOff:false, snoozed:false, createdAt:new Date().toISOString()
      });
    });
    state.lastAutoPlanAt = new Date().toISOString();
    saveState(notify?'Week planned':'');
    renderAll();
  }

  function carryForwardMissed() {
    const t=toISO(today());
    let changed=false;
    state.instances.filter(i=>!i.completed&&!i.cancelled&&i.scheduledDate<t).forEach(i=>{
      const chore=choreById(i.choreId);
      if (!i.originalDue) i.originalDue=i.scheduledDate;
      // Carry to today; grace/overdue state is computed from original due.
      i.scheduledDate=t;
      i.carriedForward=true;
      changed=true;
    });
    if(changed) saveState('');
  }

  function statusForInstance(i) {
    const t=toISO(today());
    if(i.completed) return 'done';
    if(!i.originalDue) return i.scheduledDate<t?'overdue':'planned';
    const chore=choreById(i.choreId);
    const grace=chore?getGrace(chore):2;
    const graceEnd=toISO(addDays(parseISO(i.originalDue),grace));
    if(t>graceEnd) return 'overdue';
    if(t>i.originalDue) return 'grace';
    return 'due';
  }

  function completeInstance(id, completedBy, scheduleChoice=null) {
    const i=instanceById(id); if(!i) return;
    const now=new Date(); i.completed=true; i.completedAt=now.toISOString(); i.completedBy=completedBy;
    state.history.push({ id:uid('hist'), instanceId:i.id, choreId:i.choreId||null, name:i.name, category:i.category, completedBy, completedAt:now.toISOString(), originallyDue:i.originalDue||i.scheduledDate });
    if(i.choreId){
      const chore=choreById(i.choreId);
      if(chore){
        chore.lastCompleted=toISO(today());
        const behavior=scheduleChoice || chore.scheduleBehavior;
        if(chore.scheduleBehavior==='ask' && scheduleChoice) chore.lastCompletionChoice=scheduleChoice;
        if(behavior==='fixed') {
          if(!chore.anchorDate) chore.anchorDate=i.originalDue||toISO(today());
        } else {
          chore.anchorDate=toISO(today());
        }
      }
    }
    saveState('Marked complete');
    renderAll();
  }

  function moveInstance(id,date,assignee) {
    const i=instanceById(id); if(!i) return;
    i.scheduledDate=date; i.assignedTo=assignee; i.snoozed=true;
    saveState('Chore moved'); renderAll();
  }

  function renderAll() {
    renderPeopleSelects(); renderToday(); renderPlanner(); renderChores(); renderHistory(); renderSettings();
  }

  function renderToday() {
    const t=toISO(today());
    document.getElementById('todayDate').textContent=formatLong(t).toUpperCase();
    const todays=state.instances.filter(i=>i.scheduledDate===t&&!i.cancelled);
    const open=todays.filter(i=>!i.completed);
    const completed=todays.filter(i=>i.completed);
    const list=document.getElementById('todayTaskList'); list.innerHTML='';
    open.sort((a,b)=>priorityScore(a)-priorityScore(b)).forEach(i=>list.appendChild(todayTaskCard(i)));
    document.getElementById('todayCount').textContent=`${open.length} left`;
    document.getElementById('todayEmpty').classList.toggle('hidden',open.length!==0);
    const banner=document.getElementById('doneBanner'); banner.classList.toggle('hidden',open.length!==0);
    if(open.length===0){
      document.getElementById('doneBannerText').textContent=completed.length?`You handled ${completed.length} household chore${completed.length===1?'':'s'} today. Everything else can wait.`:'Nothing is asking for your attention today.';
    }
    document.getElementById('completedTodayCount').textContent=completed.length;
    const mini=document.getElementById('completedTodayList'); mini.innerHTML='';
    completed.slice().sort((a,b)=>(b.completedAt||'').localeCompare(a.completedAt||'')).slice(0,5).forEach(i=>{
      const div=document.createElement('div');div.className='mini-item'; div.innerHTML=`<strong>${esc(i.name)}</strong><span>${esc(personLabel(i.completedBy))}</span>`;mini.appendChild(div);
    });
    if(!completed.length) mini.innerHTML='<div class="tiny-text">Nothing marked off yet — that’s okay.</div>';
  }

  function priorityScore(i){ const s=statusForInstance(i); return ({overdue:0,grace:1,due:2,planned:3}[s]??4)+(i.importance==='essential'?-0.2:i.importance==='low'?0.2:0); }

  function todayTaskCard(i) {
    const el=document.createElement('div'); el.className='task-card';
    const status=statusForInstance(i);
    const statusBadge=status==='overdue'?'<span class="badge overdue">Needs attention</span>':status==='grace'?'<span class="badge grace">Grace day</span>':'';
    const dueNote=i.originalDue && i.originalDue!==i.scheduledDate ? `Originally due ${formatShort(i.originalDue)}` : recurrenceNote(i);
    el.innerHTML=`
      <button class="done-check" aria-label="Mark ${esc(i.name)} complete">✓</button>
      <div><div class="task-name">${CATEGORY_EMOJI[i.category]||'•'} ${esc(i.name)}</div><div class="task-meta"><span>${esc(personLabel(i.assignedTo))}</span><span>•</span><span>${esc(dueNote)}</span>${statusBadge}</div></div>
      <div class="task-actions"><span class="badge ${i.importance||'regular'}">${i.oneOff?'One-off':importanceLabel[i.importance]||'Regular'}</span><button class="more-btn" aria-label="Move or reassign">•••</button></div>`;
    el.querySelector('.done-check').addEventListener('click',()=>openComplete(i.id));
    el.querySelector('.more-btn').addEventListener('click',()=>openMove(i.id));
    return el;
  }
  function recurrenceNote(i){ const c=choreById(i.choreId); return c?recurrenceText(c):'One-off'; }

  function renderPlanner() {
    const ws=startOfWeek(plannerWeekStart), we=endOfWeek(ws);
    document.getElementById('weekLabelBtn').textContent=`${formatShort(ws)} – ${formatShort(we)}`;
    const board=document.getElementById('weekBoard'); board.innerHTML='';
    for(let d=0;d<7;d++){
      const date=addDays(ws,d), iso=toISO(date);
      const items=state.instances.filter(i=>i.scheduledDate===iso&&!i.cancelled).sort((a,b)=>Number(a.completed)-Number(b.completed)||priorityScore(a)-priorityScore(b));
      const col=document.createElement('section'); col.className='day-column'+(sameDate(date,today())?' today':''); col.dataset.date=iso;
      const load=items.filter(i=>!i.completed).length;
      const loadText=load<=1?'Light':load<=3?'Normal':'Busy';
      col.innerHTML=`<div class="day-head"><div><div class="day-name">${date.toLocaleDateString(undefined,{weekday:'short'})}</div><div class="day-date">${date.getDate()}</div></div><div class="load-label">${load?loadText:'Clear'}</div></div><div class="day-tasks"></div>`;
      const wrap=col.querySelector('.day-tasks'); items.forEach(i=>wrap.appendChild(plannerCard(i)));
      col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over');});
      col.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
      col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('drag-over');const id=e.dataTransfer.getData('text/plain');if(id)moveInstance(id,iso,instanceById(id)?.assignedTo||'either');});
      board.appendChild(col);
    }
  }

  function plannerCard(i){
    const el=document.createElement('article'); el.className='planner-card'+(i.completed?' done':''); el.draggable=!i.completed; el.dataset.id=i.id;
    const overdue=statusForInstance(i)==='overdue';
    el.innerHTML=`<div class="planner-card-title">${CATEGORY_EMOJI[i.category]||'•'} ${esc(i.name)}</div><div class="planner-card-meta"><span class="assignee-dot">${esc(i.completed?personLabel(i.completedBy):personLabel(i.assignedTo))}</span><button class="planner-card-menu" aria-label="Move or edit">•••</button></div>${(!i.completed&&i.originalDue&&i.originalDue!==i.scheduledDate)?`<div class="original-due">${overdue?'Overdue • ':''}originally ${formatShort(i.originalDue)}</div>`:''}`;
    el.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',i.id));
    el.querySelector('.planner-card-menu').addEventListener('click',()=>i.completed?toast(`Completed by ${personLabel(i.completedBy)}`):openMove(i.id));
    el.addEventListener('dblclick',()=>{if(!i.completed)openComplete(i.id);});
    return el;
  }

  function renderChores(){
    const filters=document.getElementById('categoryFilters'); filters.innerHTML='';
    ['All',...CATEGORIES].forEach(cat=>{const b=document.createElement('button');b.className='chip'+(activeCategory===cat?' active':'');b.textContent=cat;b.addEventListener('click',()=>{activeCategory=cat;renderChores();});filters.appendChild(b);});
    const q=(document.getElementById('choreSearch').value||'').toLowerCase();
    const chores=state.chores.filter(c=>c.active!==false&&(activeCategory==='All'||c.category===activeCategory)&&(!q||`${c.name} ${c.areas||''}`.toLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name));
    const body=document.getElementById('choreTableBody');body.innerHTML='';
    const mobile=document.getElementById('choreCardsMobile');mobile.innerHTML='';
    chores.forEach(c=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td class="chore-title-cell"><strong>${esc(c.name)}</strong><span>${esc(c.areas||'')}</span></td><td>${esc(c.category)}</td><td>${esc(recurrenceText(c))}</td><td><span class="badge ${c.importance}">${importanceLabel[c.importance]}</span></td><td>${relativeDate(c.lastCompleted)}</td><td>${relativeDate(nextDue(c))}</td><td>${esc(personLabel(normalizeAssignee(c.assignee)))}</td><td class="table-actions"><button class="text-btn edit-chore">Edit</button><button class="text-btn danger delete-chore">Delete</button></td>`;
      tr.querySelector('.edit-chore').addEventListener('click',()=>openChore(c.id));
      tr.querySelector('.delete-chore').addEventListener('click',()=>deleteChore(c.id)); body.appendChild(tr);
      const card=document.createElement('div'); card.className='chore-mobile-card';
      card.innerHTML=`<div class="chore-mobile-top"><div><div class="chore-mobile-title">${CATEGORY_EMOJI[c.category]} ${esc(c.name)}</div><div class="chore-mobile-meta"><span class="badge">${esc(c.category)}</span><span class="badge ${c.importance}">${importanceLabel[c.importance]}</span></div></div><button class="text-btn edit-chore">Edit</button></div><div class="chore-mobile-dates"><span>Last: ${relativeDate(c.lastCompleted)}</span><span>Next: ${relativeDate(nextDue(c))}</span></div>`;
      card.querySelector('.edit-chore').addEventListener('click',()=>openChore(c.id)); mobile.appendChild(card);
    });
  }

  function renderHistory(){
    const list=document.getElementById('historyList');list.innerHTML='';
    const rows=state.history.slice().sort((a,b)=>b.completedAt.localeCompare(a.completedAt));
    if(!rows.length){list.innerHTML='<div class="empty-state"><div class="empty-illustration">✓</div><h3>No history yet</h3><p>Completed chores will show up here.</p></div>';return;}
    rows.forEach(h=>{const d=new Date(h.completedAt);const row=document.createElement('div');row.className='history-row';row.innerHTML=`<div class="history-date">${d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}<br>${d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</div><div class="history-name">${CATEGORY_EMOJI[h.category]||'✓'} ${esc(h.name)}</div><div class="history-who">${esc(personLabel(h.completedBy))}</div>`;list.appendChild(row);});
  }

  function renderSettings(){
    const [p1,p2]=currentPeople();
    document.getElementById('person1Input').value=p1;document.getElementById('person2Input').value=p2;
    document.getElementById('graceEssential').value=state.settings.grace.essential;document.getElementById('graceRegular').value=state.settings.grace.regular;document.getElementById('graceLow').value=state.settings.grace.low;
    document.getElementById('supabaseUrl').value=state.settings.supabaseUrl||'';document.getElementById('supabaseKey').value=state.settings.supabaseKey||'';document.getElementById('syncId').value=state.settings.syncId||'mak-household';
    document.getElementById('syncDot').classList.toggle('connected',!!(state.settings.supabaseUrl&&state.settings.supabaseKey));
  }

  function renderPeopleSelects(){
    const [p1,p2]=currentPeople();
    const opts=`<option value="either">Either</option><option value="person1">${esc(p1)}</option><option value="person2">${esc(p2)}</option>`;
    ['choreAssignee','oneOffAssignee','moveAssignee'].forEach(id=>{const el=document.getElementById(id); if(el){const old=el.value;el.innerHTML=opts;if([...el.options].some(o=>o.value===old))el.value=old;}});
    const completed=document.getElementById('completedBy');if(completed){const old=completed.value;completed.innerHTML=`<option value="person1">${esc(p1)}</option><option value="person2">${esc(p2)}</option>`;if(old)completed.value=old;}
    const catOpts=CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    ['choreCategory','oneOffCategory'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.options.length)el.innerHTML=catOpts;});
  }

  function openChore(id=null){
    const d=document.getElementById('choreDialog'), c=id?choreById(id):null;
    document.getElementById('choreModalKicker').textContent=c?'EDIT ROUTINE':'NEW ROUTINE';document.getElementById('choreModalTitle').textContent=c?'Edit chore':'Add chore';
    document.getElementById('choreId').value=c?.id||'';document.getElementById('choreName').value=c?.name||'';document.getElementById('choreCategory').value=c?.category||'Cleaning';document.getElementById('choreAssignee').value=normalizeAssignee(c?.assignee||'either');
    document.getElementById('recurrenceValue').value=c?.recurrenceValue||7;document.getElementById('recurrenceUnit').value=c?.recurrenceUnit||'days';document.getElementById('choreImportance').value=c?.importance||'regular';document.getElementById('choreGrace').value=c?.graceOverride??'';document.getElementById('scheduleBehavior').value=c?.scheduleBehavior||'completion';document.getElementById('lastCompleted').value=c?.lastCompleted||'';document.getElementById('choreAreas').value=c?.areas||''; d.showModal();
  }

  function saveChoreFromForm(){
    const id=document.getElementById('choreId').value;
    const existing=id?choreById(id):null;
    const data={
      id:id||uid('chore'),name:document.getElementById('choreName').value.trim(),category:document.getElementById('choreCategory').value,
      assignee:document.getElementById('choreAssignee').value,recurrenceValue:Number(document.getElementById('recurrenceValue').value),recurrenceUnit:document.getElementById('recurrenceUnit').value,
      importance:document.getElementById('choreImportance').value,graceOverride:document.getElementById('choreGrace').value===''?null:Number(document.getElementById('choreGrace').value),scheduleBehavior:document.getElementById('scheduleBehavior').value,
      lastCompleted:document.getElementById('lastCompleted').value||null,areas:document.getElementById('choreAreas').value.trim(),active:true,
      anchorDate:existing?.anchorDate||document.getElementById('lastCompleted').value||toISO(today()),createdAt:existing?.createdAt||new Date().toISOString()
    };
    if(!data.name) return;
    if(existing) Object.assign(existing,data); else state.chores.push(data);
    saveState(existing?'Chore updated':'Chore added');
    document.getElementById('choreDialog').close(); renderAll();
  }

  function deleteChore(id){
    const c=choreById(id); if(!c) return;
    if(!confirm(`Delete “${c.name}”? Its completion history will stay in History.`)) return;
    state.chores=state.chores.filter(x=>x.id!==id);state.instances=state.instances.filter(i=>i.choreId!==id||i.completed);
    saveState('Chore deleted');renderAll();
  }

  function openComplete(id){
    const i=instanceById(id);if(!i)return;
    document.getElementById('completeInstanceId').value=id;document.getElementById('completeTaskName').textContent=i.name;
    const select=document.getElementById('completedBy'); select.value=['person1','person2'].includes(i.assignedTo)?i.assignedTo:'person1';
    const chore=choreById(i.choreId);document.getElementById('completionScheduleChoice').classList.toggle('hidden',!chore||chore.scheduleBehavior!=='ask');
    document.getElementById('completeDialog').showModal();
  }

  function openMove(id){
    const i=instanceById(id); if(!i)return;
    document.getElementById('moveInstanceId').value=id;document.getElementById('moveTaskName').textContent=i.name;document.getElementById('moveDate').value=i.scheduledDate;document.getElementById('moveAssignee').value=i.assignedTo||'either';document.getElementById('moveDialog').showModal();
  }

  function addOneOff(){
    const name=document.getElementById('oneOffName').value.trim();if(!name)return;
    state.instances.push({id:uid('inst'),choreId:null,name,category:document.getElementById('oneOffCategory').value,importance:'regular',originalDue:document.getElementById('oneOffDate').value,scheduledDate:document.getElementById('oneOffDate').value,assignedTo:document.getElementById('oneOffAssignee').value,completed:false,oneOff:true,createdAt:new Date().toISOString()});
    saveState('One-off chore added');document.getElementById('oneOffDialog').close();document.getElementById('oneOffForm').reset();renderAll();
  }

  function renderEnergySuggestions(){
    const wrap=document.getElementById('energySuggestions');wrap.innerHTML='';
    const t=toISO(today());
    const openIds=new Set(state.instances.filter(i=>!i.completed&&!i.cancelled).map(i=>i.choreId));
    let pool=state.chores.filter(c=>c.active!==false&&!openIds.has(c.id)).map(c=>({chore:c,due:nextDue(c),days:daysBetween(t,nextDue(c))}));
    if(energyMode==='deep') pool=pool.filter(x=>x.chore.category==='Deep Clean').sort((a,b)=>a.days-b.days);
    else if(energyMode==='quick') pool=pool.filter(x=>x.chore.importance!=='essential'&&x.chore.category!=='Deep Clean').sort((a,b)=>Math.abs(a.days)-Math.abs(b.days));
    else if(energyMode==='future') pool=pool.filter(x=>x.days>=0).sort((a,b)=>a.days-b.days);
    else pool=pool.sort((a,b)=>a.days-b.days);
    pool.slice(0,3).forEach(x=>{
      const card=document.createElement('div');card.className='task-card';
      card.innerHTML=`<div><div class="task-name">${CATEGORY_EMOJI[x.chore.category]} ${esc(x.chore.name)}</div><div class="task-meta"><span>${x.days<=0?'Due now':`Due ${relativeDate(x.due).toLowerCase()}`}</span><span>•</span><span>${importanceLabel[x.chore.importance]}</span></div></div><button class="secondary-btn">Add today</button>`;
      card.querySelector('button').addEventListener('click',()=>{
        state.instances.push({id:uid('inst'),choreId:x.chore.id,name:x.chore.name,category:x.chore.category,importance:x.chore.importance,originalDue:x.due,scheduledDate:t,assignedTo:chooseAssignee(x.chore,startOfWeek(today())),completed:false,oneOff:false,optionalPullForward:true,createdAt:new Date().toISOString()});
        saveState('Added to today — still optional');document.getElementById('energyDialog').close();renderAll();
      });wrap.appendChild(card);
    });
    if(!wrap.children.length) wrap.innerHTML='<div class="empty-state"><h3>Nothing useful to pull forward.</h3><p>That is a perfectly good reason to stop.</p></div>';
  }

  function rebalanceRemainingWeek(){
    const ws=startOfWeek(plannerWeekStart), we=endOfWeek(ws), todayIso=toISO(today());
    const within=state.instances.filter(i=>!i.completed&&!i.cancelled&&i.scheduledDate>=toISO(ws)&&i.scheduledDate<=toISO(we)&&i.scheduledDate>=todayIso);
    const loads={};for(let d=0;d<7;d++){const iso=toISO(addDays(ws,d));loads[iso]=0;}
    within.sort((a,b)=>(a.originalDue||a.scheduledDate).localeCompare(b.originalDue||b.scheduledDate)).forEach(i=>{
      const chore=choreById(i.choreId);const grace=chore?getGrace(chore):2;
      const earliest=maxISO(i.originalDue||i.scheduledDate,todayIso,toISO(ws));const latest=minISO(toISO(addDays(parseISO(i.originalDue||i.scheduledDate),grace)),toISO(we));
      let candidates=[];for(let d=parseISO(earliest);toISO(d)<=latest;d=addDays(d,1))candidates.push(toISO(d));if(!candidates.length)candidates=[maxISO(todayIso,toISO(ws))];
      candidates.sort((a,b)=>(loads[a]||0)-(loads[b]||0)||a.localeCompare(b));i.scheduledDate=candidates[0];loads[i.scheduledDate]=(loads[i.scheduledDate]||0)+1;
    });
    saveState('Remaining week rebalanced');renderAll();
  }
  function maxISO(...xs){return xs.filter(Boolean).sort().slice(-1)[0];}
  function minISO(...xs){return xs.filter(Boolean).sort()[0];}

  function saveSettings(){
    const oldPeople=[...state.settings.people];
    state.settings.people=[document.getElementById('person1Input').value.trim()||'Person 1',document.getElementById('person2Input').value.trim()||'Person 2'];
    state.settings.grace={essential:Number(document.getElementById('graceEssential').value)||0,regular:Number(document.getElementById('graceRegular').value)||0,low:Number(document.getElementById('graceLow').value)||0};
    state.settings.supabaseUrl=document.getElementById('supabaseUrl').value.trim();state.settings.supabaseKey=document.getElementById('supabaseKey').value.trim();state.settings.syncId=document.getElementById('syncId').value.trim()||'mak-household';
    saveState('Settings saved');renderAll();
  }

  async function getSupabase(){
    const {supabaseUrl, supabaseKey}=state.settings;if(!supabaseUrl||!supabaseKey){toast('Add your Supabase URL and key first');return null;}
    if(!window.supabase){toast('Supabase library did not load');return null;}
    return window.supabase.createClient(supabaseUrl,supabaseKey);
  }
  async function pushCloud(){
    saveSettings();const sb=await getSupabase();if(!sb)return;
    const syncId=(state.settings.syncId||'mak-household').trim();
    const payload=JSON.parse(JSON.stringify(state)); payload.settings.supabaseKey='';
    const {data,error}=await sb.from('household_state')
      .upsert({id:syncId,state:payload,updated_at:new Date().toISOString()},{onConflict:'id'})
      .select('id,updated_at')
      .maybeSingle();
    if(error){console.error(error);toast(`Cloud backup failed: ${error.message}`);return;}
    if(!data?.id){toast(`Cloud backup could not be verified for “${syncId}”`);return;}
    toast('Cloud backup saved');
  }
  async function pullCloud(){
    saveSettings();const sb=await getSupabase();if(!sb)return;
    const syncId=(state.settings.syncId||'mak-household').trim();
    const {data,error}=await sb.from('household_state')
      .select('state,updated_at')
      .eq('id',syncId)
      .limit(1);
    if(error){console.error(error);toast(`Cloud restore failed: ${error.message}`);return;}
    const row=Array.isArray(data)?data[0]:data;
    if(!row?.state){toast(`No cloud backup found for “${syncId}”`);return;}
    const creds={supabaseUrl:state.settings.supabaseUrl,supabaseKey:state.settings.supabaseKey,syncId};
    state=normalizeState(row.state);Object.assign(state.settings,creds);saveState('Cloud backup restored');renderAll();
  }

  function exportData(){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`household-backup-${toISO(today())}.json`;a.click();URL.revokeObjectURL(url);toast('Backup exported');
  }
  async function importData(file){
    try{const obj=JSON.parse(await file.text());state=normalizeState(obj);saveState('Backup imported');ensureAutoPlan();renderAll();}catch(e){toast('That backup could not be read');}
  }

  function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400);}
  function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

  function switchView(name){
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    if(name==='planner') plannerWeekStart=startOfWeek(plannerWeekStart);
    window.scrollTo({top:0,behavior:'smooth'});renderAll();
  }

  function bind(){
    document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
    document.getElementById('openPlannerBtn').addEventListener('click',()=>switchView('planner'));
    document.getElementById('addChoreBtn').addEventListener('click',()=>openChore());
    document.getElementById('choreSearch').addEventListener('input',renderChores);
    document.getElementById('saveChoreBtn').addEventListener('click',e=>{e.preventDefault();saveChoreFromForm();});
    document.getElementById('confirmCompleteBtn').addEventListener('click',e=>{e.preventDefault();const id=document.getElementById('completeInstanceId').value;const chore=choreById(instanceById(id)?.choreId);let choice=null;if(chore?.scheduleBehavior==='ask')choice=document.querySelector('input[name="scheduleChoice"]:checked')?.value;completeInstance(id,document.getElementById('completedBy').value,choice);document.getElementById('completeDialog').close();});
    document.getElementById('confirmMoveBtn').addEventListener('click',e=>{e.preventDefault();moveInstance(document.getElementById('moveInstanceId').value,document.getElementById('moveDate').value,document.getElementById('moveAssignee').value);document.getElementById('moveDialog').close();});
    document.getElementById('prevWeekBtn').addEventListener('click',()=>{plannerWeekStart=addDays(plannerWeekStart,-7);renderPlanner();});
    document.getElementById('nextWeekBtn').addEventListener('click',()=>{plannerWeekStart=addDays(plannerWeekStart,7);renderPlanner();});
    document.getElementById('weekLabelBtn').addEventListener('click',()=>{plannerWeekStart=startOfWeek(today());renderPlanner();});
    document.getElementById('generateWeekBtn').addEventListener('click',()=>autoPlanWeek(plannerWeekStart,true,false));
    document.getElementById('rebalanceBtn').addEventListener('click',rebalanceRemainingWeek);
    document.getElementById('addOneOffBtn').addEventListener('click',()=>{document.getElementById('oneOffDate').value=maxISO(toISO(plannerWeekStart),toISO(today()));document.getElementById('oneOffAssignee').value='either';document.getElementById('oneOffCategory').value='Cleaning';document.getElementById('oneOffDialog').showModal();});
    document.getElementById('saveOneOffBtn').addEventListener('click',e=>{e.preventDefault();addOneOff();});
    document.getElementById('energyBtn').addEventListener('click',()=>{energyMode='soon';document.querySelectorAll('[data-energy]').forEach(b=>b.classList.toggle('active',b.dataset.energy==='soon'));renderEnergySuggestions();document.getElementById('energyDialog').showModal();});
    document.querySelectorAll('[data-energy]').forEach(b=>b.addEventListener('click',()=>{energyMode=b.dataset.energy;document.querySelectorAll('[data-energy]').forEach(x=>x.classList.toggle('active',x===b));renderEnergySuggestions();}));
    document.getElementById('saveSettingsBtn').addEventListener('click',saveSettings);document.getElementById('pushCloudBtn').addEventListener('click',pushCloud);document.getElementById('pullCloudBtn').addEventListener('click',pullCloud);
    document.getElementById('exportBtn').addEventListener('click',exportData);document.getElementById('importInput').addEventListener('change',e=>{if(e.target.files?.[0])importData(e.target.files[0]);e.target.value='';});
    document.getElementById('resetDemoBtn').addEventListener('click',()=>{if(confirm('Reset chores, weekly plans, and history to your default chore list? Your app and cloud settings will be kept.')){const keptSettings=JSON.parse(JSON.stringify(state.settings||{}));state=starter();state.settings={...state.settings,...keptSettings,grace:{...state.settings.grace,...(keptSettings.grace||{})}};saveState('Default chores restored');ensureAutoPlan();renderAll();}});
  }

  bind(); ensureAutoPlan(); renderAll();
  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
})();
