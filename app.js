(() => {
  const STORAGE_KEY = 'householdChorePlanner.v1';
  const CATEGORIES = ['Cleaning','Laundry','Pets','Maintenance / Routine','Deep Clean'];
  const CATEGORY_EMOJI = {
    'Cleaning':'🧽','Laundry':'🧺','Pets':'🐾','Maintenance / Routine':'🔧','Deep Clean':'✨'
  };
  const importanceLabel = {essential:'Essential', regular:'Regular', low:'Low stakes'};
  const dayMs = 86400000;
  let plannerWeekStart = startOfWeek(new Date());
  let plannerViewMode = 'week';
  let activeCategory = 'All';
  let choreFilters = { importance:'all', assignee:'all', tag:'all', status:'all' };
  let choreSort = { key:'name', dir:'asc' };
  let selectedChoreIds = new Set();
  let energyMode = 'soon';
  let overviewShowAll = false;
  let toastTimer;

  const starter = () => ({
    version: 2.0,
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
    lastAutoPlanAt: null,
    customDefault: null
  });

  // Default chores start with no fabricated completion history. starterDueInDays seeds
  // the first planning cycle so Reset gives a usable week without claiming a chore
  // was completed when it was not.
  function makeChore(name, category, recurrenceValue, recurrenceUnit, importance, assignee, scheduleBehavior, starterDueInDays=0, areas='') {
    const due = addDays(today(), Number(starterDueInDays)||0);
    return {
      id: uid('chore'), name, category, recurrenceType:'interval', recurrenceValue, recurrenceUnit, importance, assignee,
      scheduleBehavior, areas, tags: [], graceOverride: null,
      lastCompleted: null, lastDueSatisfied: null,
      startDate: toISO(due), nextDueOverride: null,
      // anchorDate is kept for backward-compatible imports, but startDate is the v1.4 schedule anchor.
      anchorDate: toISO(due),
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
    const chores = Array.isArray(s.chores) ? s.chores.map(normalizeChore) : base.chores;
    return {
      ...base,
      ...s,
      settings: {...base.settings, ...(s.settings||{}), grace:{...base.settings.grace, ...((s.settings||{}).grace||{})}},
      version: 2.0,
      chores,
      instances: normalizeInstancesForVersion(s.instances,s.version,chores),
      history: Array.isArray(s.history) ? s.history : [],
      customDefault: normalizeDefaultSnapshot(s.customDefault,s.version)
    };
  }

  function normalizeInstancesForVersion(instances,sourceVersion=0,chores=[]){
    let list=Array.isArray(instances)?instances.map(i=>({
      ...i,
      pinned: Boolean(i.pinned),
      manualPlan: Boolean(i.manualPlan||i.snoozed||i.plannedFromForecast),
      // v2 keeps the intended plan date intact when a chore becomes late.
      // Older versions sometimes carried a missed chore forward by overwriting
      // scheduledDate. We cannot always reconstruct that older plan, so preserve
      // the best date available and stop mutating it going forward.
      plannedDate: i.plannedDate||i.scheduledDate||i.originalDue||null
    })):[];
    if(Number(sourceVersion)<1.8){
      const currentWeekEnd=toISO(endOfWeek(today()));
      // Before v1.8, pressing Auto-plan created future-week instances that were
      // indistinguishable from the forecast. Keep completed, one-off and manually
      // moved/planned items, but let untouched future auto-plan rows fall back to
      // the new continuous forecast model.
      list=list.filter(i=>{
        if(i.completed||i.cancelled||i.oneOff||i.snoozed||i.plannedFromForecast||!i.choreId)return true;
        return !i.scheduledDate||i.scheduledDate<=currentWeekEnd;
      });
    }
    if(Number(sourceVersion)<1.9) list=repairSkippedFirstCalendarOccurrences(list,chores);
    if(Number(sourceVersion)<2){
      list=list.map(i=>({
        ...i,
        // scheduledDate remains the canonical plan date for compatibility;
        // plannedDate is an explicit alias used by the v2 scheduling model.
        plannedDate:i.scheduledDate||i.plannedDate||i.originalDue||null,
        pinned:Boolean(i.pinned),
        manualPlan:Boolean(i.manualPlan||i.snoozed||i.plannedFromForecast)
      }));
    }
    return list;
  }

  function repairSkippedFirstCalendarOccurrences(instances,chores){
    const byId=new Map((chores||[]).map(c=>[c.id,c]));
    return instances.map(i=>{
      if(i.completed||i.cancelled||!i.plannedFromForecast||!i.snoozed||!i.choreId||!i.originalDue||!i.scheduledDate)return i;
      const chore=byId.get(i.choreId);
      if(!chore||(chore.recurrenceType||'interval')==='interval')return i;
      const start=chore.startDate||chore.anchorDate;
      if(!start)return i;
      const first=toISO(firstCalendarOccurrenceOnOrAfter(chore,parseISO(start)));
      const second=toISO(firstCalendarOccurrenceOnOrAfter(chore,addDays(parseISO(first),1)));
      // v1.10 could skip the first calendar occurrence when a chore had older
      // completion history. If the user then moved the immediately-following
      // forecast back onto that missing first date, restore it as that first
      // occurrence so the following date remains in the forecast.
      if(i.scheduledDate===first&&i.originalDue===second){
        return {...i,originalDue:first,snoozed:false,repairedFirstOccurrence:true};
      }
      return i;
    });
  }

  function normalizeChore(c) {
    const out={...c,tags:normalizeTags(c.tags)};
    out.recurrenceType=out.recurrenceType||'interval';
    out.recurrenceValue=Math.max(1,Number(out.recurrenceValue)||1);
    out.recurrenceUnit=out.recurrenceUnit||'days';
    out.weekday=Number.isInteger(Number(out.weekday))?Number(out.weekday):0;
    out.monthDay=Math.min(31,Math.max(1,Number(out.monthDay)||1));
    out.monthOrdinal=String(out.monthOrdinal??'1');
    out.monthWeekday=Number.isInteger(Number(out.monthWeekday))?Number(out.monthWeekday):0;
    out.nextDueOverride=out.nextDueOverride||null;
    out.lastDueSatisfied=out.lastDueSatisfied||null;
    if(!out.startDate){
      // v1.3 stored an anchor one interval before the first due date. Migrate that into a real first-due/start date.
      const legacyBase=out.anchorDate||out.lastCompleted||(out.createdAt?out.createdAt.slice(0,10):toISO(today()));
      if(out.lastCompleted && out.scheduleBehavior!=='fixed') out.startDate=out.anchorDate||out.lastCompleted;
      else out.startDate=toISO(addInterval(parseISO(legacyBase),out.recurrenceValue,out.recurrenceUnit));
    }
    out.anchorDate=out.startDate;
    return out;
  }

  function normalizeDefaultSnapshot(snapshot,sourceVersion=0){
    if(!snapshot||!Array.isArray(snapshot.chores)) return null;
    let chores=snapshot.chores.map(normalizeChore);
    if(Number(sourceVersion)<1.9&&snapshot.savedAt){
      const savedDate=String(snapshot.savedAt).slice(0,10);
      chores=chores.map(c=>{
        if((c.recurrenceType||'interval')==='interval'||!c.nextDueOverride||!c.startDate||savedDate>=c.startDate)return c;
        const first=toISO(firstCalendarOccurrenceOnOrAfter(c,parseISO(c.startDate)));
        const second=toISO(firstCalendarOccurrenceOnOrAfter(c,addDays(parseISO(first),1)));
        // Old custom-default snapshots could capture the skipped second
        // calendar occurrence as Next due even when the default was saved
        // before the first Start-date occurrence happened. Restore the first
        // occurrence as the natural next due in that narrow case.
        if(first===c.startDate&&c.nextDueOverride===second)return {...c,nextDueOverride:null};
        return c;
      });
    }
    return {...snapshot,chores};
  }

  function saveState(message='Saved') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const status = document.getElementById('sidebarStatus');
    if (status) status.textContent = `Saved locally • ${new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}`;
    if (message) toast(message);
  }

  function uid(prefix='id') { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
  function normalizeTags(value) {
    const raw = Array.isArray(value) ? value : (typeof value==='string' ? value.split(',') : []);
    const seen = new Set();
    return raw.map(v=>String(v).trim()).filter(Boolean).filter(v=>{const k=v.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
  }
  function tagKey(value='') { return String(value).trim().toLowerCase(); }
  function tagMarkup(tags=[]) { return normalizeTags(tags).map(t=>`<span class="tag-pill">${esc(t)}</span>`).join(''); }
  function today() { const d = new Date(); d.setHours(0,0,0,0); return d; }
  function parseISO(s) { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
  function toISO(d) { const x = new Date(d); x.setMinutes(x.getMinutes()-x.getTimezoneOffset()); return x.toISOString().slice(0,10); }
  function addDays(d,n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
  function daysBetween(a,b) { return Math.round((parseDateish(b)-parseDateish(a))/dayMs); }
  function parseDateish(x) { if (x instanceof Date) { const d=new Date(x); d.setHours(0,0,0,0); return d; } return parseISO(x); }
  function startOfWeek(d) { const x=new Date(d); x.setHours(0,0,0,0); return addDays(x,-x.getDay()); }
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
  const WEEKDAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const ORDINAL_LABEL={1:'1st',2:'2nd',3:'3rd',4:'4th',5:'5th','-1':'Last'};
  function recurrenceText(c) {
    const type=c.recurrenceType||'interval';
    const n=Math.max(1,Number(c.recurrenceValue)||1);
    if(type==='weekly') return `${n===1?'Every week':`Every ${n} weeks`} on ${WEEKDAYS[Number(c.weekday)||0]}`;
    if(type==='monthly-day') return `${n===1?'Every month':`Every ${n} months`} on the ${ordinalDay(Number(c.monthDay)||1)}`;
    if(type==='monthly-weekday') return `${n===1?'Every month':`Every ${n} months`} on the ${ORDINAL_LABEL[String(c.monthOrdinal)]||'1st'} ${WEEKDAYS[Number(c.monthWeekday)||0]}`;
    const unit=n===1?(c.recurrenceUnit||'days').replace(/s$/,''):(c.recurrenceUnit||'days');
    return `Every ${n} ${unit}`;
  }
  function ordinalDay(n){
    const mod100=n%100;if(mod100>=11&&mod100<=13)return `${n}th`;
    return `${n}${({1:'st',2:'nd',3:'rd'}[n%10]||'th')}`;
  }
  function addInterval(date,value,unit){
    const x=new Date(date);const n=Math.max(1,Number(value)||1);
    if(unit==='days') x.setDate(x.getDate()+n);
    if(unit==='weeks') x.setDate(x.getDate()+7*n);
    if(unit==='months') x.setMonth(x.getMonth()+n);
    return x;
  }
  function addRecurrence(date,chore){ return addInterval(date,chore.recurrenceValue,chore.recurrenceUnit); }
  function monthsBetweenAnchors(a,b){return (b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth());}
  function nthWeekdayOfMonth(year,month,weekday,ordinal){
    const ord=Number(ordinal);
    if(ord===-1){const d=new Date(year,month+1,0);d.setDate(d.getDate()-((d.getDay()-weekday+7)%7));return d;}
    const first=new Date(year,month,1);const offset=(weekday-first.getDay()+7)%7;const d=new Date(year,month,1+offset+7*(Math.max(1,ord)-1));
    return d.getMonth()===month?d:null;
  }
  function monthlyCandidate(chore,year,month){
    if((chore.recurrenceType||'interval')==='monthly-day'){
      const requested=Math.min(31,Math.max(1,Number(chore.monthDay)||1));
      const last=new Date(year,month+1,0).getDate();
      return new Date(year,month,Math.min(requested,last));
    }
    return nthWeekdayOfMonth(year,month,Number(chore.monthWeekday)||0,chore.monthOrdinal||1);
  }
  function calendarAnchorOccurrence(chore){
    const type=chore.recurrenceType||'interval';const start=parseISO(chore.startDate||toISO(today()));
    if(type==='weekly')return addDays(start,((Number(chore.weekday)||0)-start.getDay()+7)%7);
    if(type==='monthly-day'||type==='monthly-weekday'){
      let cursor=new Date(start.getFullYear(),start.getMonth(),1);
      for(let guard=0;guard<36;guard++){
        const candidate=monthlyCandidate(chore,cursor.getFullYear(),cursor.getMonth());
        if(candidate&&candidate>=start)return candidate;
        cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);
      }
    }
    return start;
  }
  function firstCalendarOccurrenceOnOrAfter(chore,fromDate){
    const type=chore.recurrenceType||'interval';
    const anchor=calendarAnchorOccurrence(chore);
    let from=parseDateish(fromDate);if(from<anchor)from=new Date(anchor);
    const interval=Math.max(1,Number(chore.recurrenceValue)||1);
    if(type==='weekly'){
      let d=new Date(from);const target=Number(chore.weekday)||0;d=addDays(d,(target-d.getDay()+7)%7);
      const anchorWeek=startOfWeek(anchor);
      while(Math.max(0,Math.floor(daysBetween(anchorWeek,startOfWeek(d))/7))%interval!==0)d=addDays(d,7);
      return d;
    }
    if(type==='monthly-day'||type==='monthly-weekday'){
      const anchorMonth=new Date(anchor.getFullYear(),anchor.getMonth(),1);
      let cursor=new Date(from.getFullYear(),from.getMonth(),1);
      for(let guard=0;guard<2400;guard++){
        const mdiff=monthsBetweenAnchors(anchorMonth,cursor);
        if(mdiff>=0&&mdiff%interval===0){
          const candidate=monthlyCandidate(chore,cursor.getFullYear(),cursor.getMonth());
          if(candidate&&candidate>=anchor&&candidate>=from)return candidate;
        }
        cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);
      }
    }
    return from;
  }
  function naturalNextDue(chore){
    const type=chore.recurrenceType||'interval';
    const start=chore.startDate||chore.anchorDate||(chore.createdAt?chore.createdAt.slice(0,10):toISO(today()));
    const effectiveBehavior=chore.scheduleBehavior==='ask'?(chore.lastCompletionChoice||'completion'):chore.scheduleBehavior;
    if(type!=='interval'){
      const startDate=parseISO(start);
      if(!chore.lastCompleted&&!chore.lastDueSatisfied)return toISO(firstCalendarOccurrenceOnOrAfter(chore,startDate));
      // Start date is the first eligible occurrence / schedule anchor, not an
      // occurrence that has already been satisfied. Older completion history
      // must not cause the start occurrence itself to be skipped.
      const satisfied=maxISO(chore.lastDueSatisfied,chore.lastCompleted);
      let searchFrom=satisfied?addDays(parseISO(satisfied),1):startDate;
      if(searchFrom<startDate)searchFrom=startDate;
      return toISO(firstCalendarOccurrenceOnOrAfter(chore,searchFrom));
    }
    if(!chore.lastCompleted)return start;
    if(effectiveBehavior!=='fixed')return toISO(addRecurrence(parseISO(chore.lastCompleted),chore));
    const satisfied=maxISO(chore.lastDueSatisfied,chore.lastCompleted,start);
    let due=parseISO(start);
    while(due<=parseISO(satisfied))due=addRecurrence(due,chore);
    return toISO(due);
  }
  function nextDue(chore,ignoreOverride=false){
    if(!ignoreOverride&&chore.nextDueOverride)return chore.nextDueOverride;
    return naturalNextDue(chore);
  }
  function getGrace(chore) {
    return chore.graceOverride !== null && chore.graceOverride !== '' && chore.graceOverride !== undefined
      ? Number(chore.graceOverride) : Number(state.settings.grace[chore.importance] ?? 2);
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
  function assigneeClass(key){
    const normalized=normalizeAssignee(key);
    return normalized==='person1'?'assignee-person1':normalized==='person2'?'assignee-person2':'assignee-either';
  }

  function completionHistoryFor(choreId) { return state.history.filter(h=>h.choreId===choreId).sort((a,b)=>b.completedAt.localeCompare(a.completedAt)); }
  function chooseAssignee(chore, weekStart) {
    const explicit = normalizeAssignee(chore.assignee);
    if (explicit !== 'either') return explicit;
    const hist = completionHistoryFor(chore.id);
    if (hist.length && ['person1','person2'].includes(hist[0].completedBy)) return hist[0].completedBy==='person1' ? 'person2' : 'person1';
    const ws=toISO(weekStart), we=toISO(endOfWeek(weekStart));
    const counts={person1:0,person2:0};
    state.instances.filter(i=>planDateOf(i)>=ws&&planDateOf(i)<=we&&!i.completed).forEach(i=>{ if(counts[i.assignedTo]!==undefined)counts[i.assignedTo]++; });
    return counts.person1<=counts.person2?'person1':'person2';
  }

  function getOpenRecurringInstance(choreId) {
    return state.instances.find(i=>i.choreId===choreId && !i.completed && !i.cancelled);
  }

  function planDateOf(i){
    return i?.plannedDate||i?.scheduledDate||i?.originalDue||null;
  }

  function setPlanDate(i,date){
    if(!i)return;
    i.scheduledDate=date;
    i.plannedDate=date;
  }

  function calendarDateForInstance(i){
    if(i?.completed && i.completedAt) return String(i.completedAt).slice(0,10);
    return planDateOf(i);
  }

  function effectiveScheduleBehavior(chore){
    return chore?.scheduleBehavior==='ask'?(chore.lastCompletionChoice||'completion'):chore?.scheduleBehavior;
  }

  function ensureDueForecastsPlanned() {
    const t=toISO(today());
    let changed=false;
    state.chores.filter(c=>c.active!==false).forEach(chore=>{
      const due=nextDue(chore);
      if(!due||due>t)return;
      // A forecast becomes a real plan when its due day arrives. Keep the plan
      // on the actual due date even if the app is opened later; Today can surface
      // missed plans without rewriting their intended date.
      const represented=state.instances.some(i=>
        i.choreId===chore.id&&!i.completed&&!i.cancelled&&(i.originalDue||planDateOf(i))===due
      );
      if(represented)return;
      state.instances.push({
        id:uid('inst'),choreId:chore.id,name:chore.name,category:chore.category,importance:chore.importance,
        originalDue:due,scheduledDate:due,plannedDate:due,assignedTo:chooseAssignee(chore,startOfWeek(parseISO(due))),
        completed:false,completedAt:null,oneOff:false,snoozed:false,plannedFromForecast:true,manualPlan:false,pinned:false,
        autoPromotedOnDue:true,createdAt:new Date().toISOString()
      });
      changed=true;
    });
    if(changed)saveState('');
  }

  function syncPlannerForToday() {
    ensureDueForecastsPlanned();
  }

  function statusForInstance(i) {
    const t=toISO(today());
    if(i.completed) return 'done';
    if(!i.originalDue) return planDateOf(i)<t?'overdue':'planned';
    const chore=choreById(i.choreId);
    const grace=chore?getGrace(chore):2;
    const graceEnd=toISO(addDays(parseISO(i.originalDue),grace));
    if(t>graceEnd) return 'overdue';
    if(t>i.originalDue) return 'grace';
    return 'due';
  }

  // A completion-based routine treats the current planned date as the best
  // assumption for when the chore will happen. Reflow later plans sequentially
  // so each keeps its relative "do it X days early/late" preference. A pinned
  // occurrence keeps its exact calendar date and then becomes the assumption
  // that anchors the occurrences after it.
  function rebaseFuturePlansAfterAssumptionChange(chore,currentInstance,oldAssumedDate,newAssumedDate,reason='plan'){
    if(!chore||!currentInstance||!oldAssumedDate||!newAssumedDate)return;
    if((chore.recurrenceType||'interval')!=='interval')return;
    if(effectiveScheduleBehavior(chore)==='fixed'||oldAssumedDate===newAssumedDate)return;
    const currentDue=currentInstance.originalDue||oldAssumedDate;
    const future=state.instances
      .filter(i=>i.id!==currentInstance.id&&i.choreId===chore.id&&!i.completed&&!i.cancelled&&(i.originalDue||planDateOf(i))>currentDue)
      .sort((a,b)=>(a.originalDue||planDateOf(a)).localeCompare(b.originalDue||planDateOf(b)))
      .map(i=>({
        instance:i,
        oldDue:i.originalDue||planDateOf(i),
        oldPlan:planDateOf(i),
        offset:daysBetween(i.originalDue||planDateOf(i),planDateOf(i))
      }));
    let due=toISO(addRecurrence(parseISO(newAssumedDate),chore));
    future.forEach(({instance:i,oldPlan,offset})=>{
      i.originalDue=due;
      if(!i.pinned)setPlanDate(i,toISO(addDays(parseISO(due),offset)));
      else if(oldPlan)setPlanDate(i,oldPlan);
      i.rebasedFrom=reason;
      due=toISO(addRecurrence(parseISO(planDateOf(i)||due),chore));
    });
  }

  function reflowFuturePlansToFixedRhythm(chore,currentInstance,reason='fixed'){
    if(!chore||!currentInstance||(chore.recurrenceType||'interval')!=='interval')return;
    const currentDue=currentInstance.originalDue||planDateOf(currentInstance);
    if(!currentDue)return;
    const future=state.instances
      .filter(i=>i.id!==currentInstance.id&&i.choreId===chore.id&&!i.completed&&!i.cancelled&&(i.originalDue||planDateOf(i))>currentDue)
      .sort((a,b)=>(a.originalDue||planDateOf(a)).localeCompare(b.originalDue||planDateOf(b)))
      .map(i=>({instance:i,offset:daysBetween(i.originalDue||planDateOf(i),planDateOf(i)),oldPlan:planDateOf(i)}));
    let due=nextFixedIntervalAfter(chore,currentDue);
    future.forEach(({instance:i,offset,oldPlan})=>{
      i.originalDue=due;
      if(!i.pinned)setPlanDate(i,toISO(addDays(parseISO(due),offset)));
      else if(oldPlan)setPlanDate(i,oldPlan);
      i.rebasedFrom=reason;
      due=nextFixedIntervalAfter(chore,due);
    });
  }

  function completeInstance(id, completedBy, scheduleChoice=null) {
    const i=instanceById(id); if(!i) return;
    const now=new Date();
    const actualDate=toISO(today());
    const intendedPlan=planDateOf(i)||actualDate;
    i.completed=true; i.completedAt=now.toISOString(); i.completedBy=completedBy;
    state.history.push({ id:uid('hist'), instanceId:i.id, choreId:i.choreId||null, name:i.name, category:i.category, completedBy, completedAt:now.toISOString(), originallyDue:i.originalDue||intendedPlan, plannedFor:intendedPlan });
    if(i.choreId){
      const chore=choreById(i.choreId);
      if(chore){
        const behavior=scheduleChoice || chore.scheduleBehavior;
        if(chore.scheduleBehavior==='ask' && scheduleChoice) chore.lastCompletionChoice=scheduleChoice;
        // Reality replaces the planned assumption. This happens before updating
        // lastCompleted so already-planned future occurrences can be rebased.
        if(behavior==='fixed')reflowFuturePlansToFixedRhythm(chore,i,'fixed-completion');
        else rebaseFuturePlansAfterAssumptionChange(chore,i,intendedPlan,actualDate,'completion');
        chore.lastCompleted=actualDate;
        chore.lastDueSatisfied=i.originalDue||intendedPlan||actualDate;
        chore.nextDueOverride=null;
        if((chore.recurrenceType||'interval')==='interval' && behavior!=='fixed') {
          chore.anchorDate=actualDate;
        } else chore.anchorDate=chore.startDate||chore.anchorDate||i.originalDue||actualDate;
      }
    }
    saveState('Marked complete');
    renderAll();
  }

  function moveInstance(id,date,assignee,pinned=false) {
    const i=instanceById(id); if(!i) return;
    const oldPlan=planDateOf(i)||date;
    const chore=choreById(i.choreId);
    setPlanDate(i,date);
    i.assignedTo=assignee;
    i.snoozed=Boolean(i.originalDue&&date!==i.originalDue);
    i.manualPlan=true;
    i.pinned=Boolean(pinned);
    if(chore)rebaseFuturePlansAfterAssumptionChange(chore,i,oldPlan,date,'plan');
    saveState(i.pinned?'Plan pinned':'Plan updated'); renderAll();
  }

  function forecastMoveKey(choreId,dueDate){ return `forecast|${choreId}|${dueDate}`; }
  function parseForecastMoveKey(value=''){
    if(!String(value).startsWith('forecast|')) return null;
    const [,choreId,dueDate]=String(value).split('|');
    return choreId&&dueDate?{choreId,dueDate}:null;
  }
  function scheduleForecast(choreId,dueDate,date,assignee,pinned=false){
    const chore=choreById(choreId);if(!chore)return;
    let existing=state.instances.find(i=>i.choreId===choreId&&!i.completed&&!i.cancelled&&(i.originalDue||planDateOf(i))===dueDate);
    if(existing){
      const oldPlan=planDateOf(existing)||dueDate;
      setPlanDate(existing,date);existing.assignedTo=assignee;existing.snoozed=date!==dueDate;existing.manualPlan=true;existing.pinned=Boolean(pinned);
      rebaseFuturePlansAfterAssumptionChange(chore,existing,oldPlan,date,'plan');
    }else{
      existing={
        id:uid('inst'),choreId:chore.id,name:chore.name,category:chore.category,importance:chore.importance,
        originalDue:dueDate,scheduledDate:date,plannedDate:date,assignedTo:assignee||normalizeAssignee(chore.assignee)||'either',
        completed:false,completedAt:null,oneOff:false,snoozed:date!==dueDate,plannedFromForecast:true,manualPlan:true,pinned:Boolean(pinned),createdAt:new Date().toISOString()
      };
      state.instances.push(existing);
      rebaseFuturePlansAfterAssumptionChange(chore,existing,dueDate,date,'plan');
    }
    saveState(existing.pinned?'Forecast pinned to plan':date===dueDate?'Forecast added to plan':'Forecast moved into plan');renderAll();
  }

  function renderAll() {
    syncPlannerForToday();
    renderPeopleSelects(); renderToday(); renderOverview(); renderPlanner(); renderChores(); renderHistory(); renderSettings();
  }

  function renderToday() {
    const t=toISO(today());
    document.getElementById('todayDate').textContent=formatLong(t).toUpperCase();
    // An unfinished plan stays attached to the day Mak intended to do it, but
    // Today keeps surfacing it until it is completed or deliberately moved.
    const open=state.instances.filter(i=>!i.completed&&!i.cancelled&&planDateOf(i)&&planDateOf(i)<=t);
    const completed=state.instances.filter(i=>i.completed&&!i.cancelled&&String(i.completedAt||'').slice(0,10)===t);
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


  function estimatedCycleStart(chore, dueIso) {
    if (chore.lastCompleted) return chore.lastCompleted;
    const due=parseISO(dueIso);
    const n=Math.max(1,Number(chore.recurrenceValue)||1);
    const type=chore.recurrenceType||'interval';
    let start=new Date(due);
    if(type==='weekly') start=addDays(start,-7*n);
    else if(type==='monthly-day'||type==='monthly-weekday') start.setMonth(start.getMonth()-n);
    else if(chore.recurrenceUnit==='weeks') start=addDays(start,-7*n);
    else if(chore.recurrenceUnit==='months') start.setMonth(start.getMonth()-n);
    else start=addDays(start,-n);
    return toISO(start);
  }

  function maintenanceState(chore) {
    const dueIso=nextDue(chore);
    const due=parseISO(dueIso);
    const now=today();
    const grace=Math.max(0,getGrace(chore));
    const graceEnd=addDays(due,grace);
    const startIso=estimatedCycleStart(chore,dueIso);
    let start=parseISO(startIso);
    if(start>=graceEnd) start=addDays(due,-Math.max(1,Math.round(recurrenceDays(chore))||1));
    const total=Math.max(1,daysBetween(start,graceEnd));
    const remaining=Math.max(0,Math.min(total,daysBetween(now,graceEnd)));
    const freshness=Math.max(0,Math.min(100,Math.round((remaining/total)*100)));
    let key,label;
    if(now>graceEnd){key='overdue';label='Needs attention';}
    else if(now>due){key='grace';label='Grace window';}
    else if(sameDate(now,due)){key='due';label='Due';}
    else if(freshness>=75){key='fresh';label='Fresh';}
    else if(freshness>=40){key='on-track';label='On track';}
    else {key='getting-close';label='Getting close';}
    return {key,label,freshness,due:dueIso,graceEnd:toISO(graceEnd),cycleStart:toISO(start)};
  }

  function overviewSeverity(key){return ({fresh:0,'on-track':1,'getting-close':2,due:3,grace:4,overdue:5}[key]??0);}

  function overviewSummaryFor(chores){
    const essential=chores.filter(c=>c.importance==='essential');
    if(!essential.length) return {tone:'good',title:'Household is in good shape',text:'No chores are currently marked Essential. Regular maintenance can stay on its normal schedule.'};
    const states=essential.map(c=>maintenanceState(c));
    const overdue=states.filter(s=>s.key==='overdue').length;
    const needsNow=states.filter(s=>s.key==='due'||s.key==='grace').length;
    const close=states.filter(s=>s.key==='getting-close').length;
    if(overdue) return {tone:'attention',title:'Some maintenance is behind',text:`${overdue} important chore${overdue===1?' is':'s are'} past the grace window. Focus on that before worrying about anything upcoming.`};
    if(needsNow) return {tone:'watch',title:needsNow===1?'One thing needs attention':'A couple things need attention',text:`${needsNow} important chore${needsNow===1?' has':'s have'} reached the due or grace window. The rest can wait.`};
    if(close) return {tone:'good',title:'Household is in good shape',text:`Important chores are still on track. ${close} ${close===1?'is':'are'} getting closer to the normal maintenance window, but nothing needs doing early.`};
    return {tone:'good',title:'Household is in good shape',text:'All important chores are comfortably within their normal maintenance windows.'};
  }

  function overviewMetaLine(chore,stateInfo){
    const last=chore.lastCompleted?`Done ${relativeDate(chore.lastCompleted).toLowerCase()}`:'No completion logged yet';
    const due=stateInfo.key==='overdue'?`Due ${formatShort(stateInfo.due)}`:stateInfo.key==='grace'?`Due ${formatShort(stateInfo.due)} • grace through ${formatShort(stateInfo.graceEnd)}`:`Due ${relativeDate(stateInfo.due).toLowerCase()}`;
    return `${last} • ${due}`;
  }

  function openOverviewComplete(chore){
    let inst=getOpenRecurringInstance(chore.id);
    if(!inst){
      inst={id:uid('inst'),choreId:chore.id,name:chore.name,category:chore.category,importance:chore.importance,originalDue:nextDue(chore),scheduledDate:toISO(today()),plannedDate:toISO(today()),assignedTo:chooseAssignee(chore,startOfWeek(today())),completed:false,oneOff:false,overviewCompletion:true,manualPlan:true,pinned:false,createdAt:new Date().toISOString()};
      state.instances.push(inst);saveState('');
    }
    openComplete(inst.id);
  }

  function renderOverview(){
    const active=state.chores.filter(c=>c.active!==false);
    const summary=overviewSummaryFor(active);
    const summaryEl=document.getElementById('overviewSummary');
    if(!summaryEl)return;
    summaryEl.classList.remove('tone-good','tone-watch','tone-attention');summaryEl.classList.add(`tone-${summary.tone}`);
    document.getElementById('overviewSummaryTitle').textContent=summary.title;
    document.getElementById('overviewSummaryText').textContent=summary.text;
    const toggle=document.getElementById('overviewToggleBtn');
    toggle.textContent=overviewShowAll?'Show important only':'Show all chores';
    document.getElementById('overviewListKicker').textContent=overviewShowAll?'ALL ACTIVE CHORES':'IMPORTANT CHORES';
    document.getElementById('overviewListTitle').textContent=overviewShowAll?'Whole-house maintenance':'Household essentials';
    document.getElementById('overviewListHelp').textContent=overviewShowAll?'The overview is informational — chores that are not due yet still belong to a future day.':'Bars drain as chores age. Grace days still count as an acceptable maintenance window.';

    const chores=(overviewShowAll?active:active.filter(c=>c.importance==='essential')).slice().sort((a,b)=>{
      const sa=maintenanceState(a),sb=maintenanceState(b);
      return overviewSeverity(sb.key)-overviewSeverity(sa.key)||sa.due.localeCompare(sb.due)||a.name.localeCompare(b.name);
    });
    const list=document.getElementById('overviewChoreList');list.innerHTML='';
    if(!chores.length){list.innerHTML='<div class="empty-state compact-empty"><h3>No important chores yet</h3><p>Mark a chore Essential if you want it represented in the default household overview.</p></div>';}
    chores.forEach(chore=>{
      const info=maintenanceState(chore);
      const card=document.createElement('article');card.className=`overview-chore-card status-${info.key}`;
      const openInst=getOpenRecurringInstance(chore.id);
      card.innerHTML=`
        <button class="overview-card-main" type="button" aria-expanded="false">
          <div class="overview-card-top"><div><div class="overview-chore-name">${CATEGORY_EMOJI[chore.category]||'•'} ${esc(chore.name)}</div><div class="overview-chore-meta">${esc(overviewMetaLine(chore,info))}</div></div><span class="overview-status status-${info.key}">${esc(info.label)}</span></div>
          <div class="freshness-track" aria-label="${esc(chore.name)} maintenance status: ${esc(info.label)}"><span class="freshness-fill status-${info.key}" style="width:${info.freshness}%"></span></div>
        </button>
        <div class="overview-details hidden">
          <div class="overview-detail-grid">
            <div><span>Last done</span><strong>${chore.lastCompleted?formatShort(chore.lastCompleted):'Not logged'}</strong></div>
            <div><span>Rhythm</span><strong>${esc(recurrenceText(chore))}</strong></div>
            <div><span>Due</span><strong>${formatShort(info.due)}</strong></div>
            <div><span>Grace through</span><strong>${formatShort(info.graceEnd)}</strong></div>
            ${openInst?`<div><span>Planned</span><strong>${formatShort(planDateOf(openInst))} • ${esc(personLabel(openInst.assignedTo))}${openInst.pinned?' • 📌':''}</strong></div>`:''}
          </div>
          <div class="overview-detail-actions"><button type="button" class="primary-btn overview-done">✓ Mark done</button>${openInst?'<button type="button" class="secondary-btn overview-snooze">Move / snooze</button>':''}<button type="button" class="text-btn overview-edit">Edit chore</button></div>
        </div>`;
      const main=card.querySelector('.overview-card-main'),details=card.querySelector('.overview-details');
      main.addEventListener('click',()=>{const opening=details.classList.contains('hidden');details.classList.toggle('hidden',!opening);main.setAttribute('aria-expanded',String(opening));});
      card.querySelector('.overview-done').addEventListener('click',()=>openOverviewComplete(chore));
      card.querySelector('.overview-edit').addEventListener('click',()=>openChore(chore.id));
      card.querySelector('.overview-snooze')?.addEventListener('click',()=>openMove(openInst.id));
      list.appendChild(card);
    });

    const catList=document.getElementById('overviewCategoryList');catList.innerHTML='';
    CATEGORIES.forEach(category=>{
      const group=active.filter(c=>c.category===category);if(!group.length)return;
      const worst=group.map(c=>maintenanceState(c)).sort((a,b)=>overviewSeverity(b.key)-overviewSeverity(a.key))[0];
      const row=document.createElement('div');row.className='overview-category-row';row.innerHTML=`<span class="overview-category-name">${CATEGORY_EMOJI[category]||'•'} ${esc(category)}</span><span class="overview-category-state status-${worst.key}">${esc(worst.label)}</span>`;catList.appendChild(row);
    });
  }

  function todayTaskCard(i) {
    const el=document.createElement('div'); el.className='task-card';
    const status=statusForInstance(i);
    const statusBadge=status==='overdue'?'<span class="badge overdue">Needs attention</span>':status==='grace'?'<span class="badge grace">Grace day</span>':'';
    const dueNote=instanceTimingNote(i);
    el.innerHTML=`
      <button class="done-check" aria-label="Mark ${esc(i.name)} complete">✓</button>
      <div><div class="task-name">${CATEGORY_EMOJI[i.category]||'•'} ${esc(i.name)}</div><div class="task-meta"><span>${esc(personLabel(i.assignedTo))}</span><span>•</span><span>${esc(dueNote)}</span>${statusBadge}</div></div>
      <div class="task-actions"><span class="badge ${i.importance||'regular'}">${i.oneOff?'One-off':importanceLabel[i.importance]||'Regular'}</span><button class="more-btn" aria-label="Move or reassign">•••</button></div>`;
    el.querySelector('.done-check').addEventListener('click',()=>openComplete(i.id));
    el.querySelector('.more-btn').addEventListener('click',()=>openMove(i.id));
    return el;
  }
  function instanceTimingNote(i){
    const planned=planDateOf(i);
    const due=i.originalDue;
    if(!due)return i.oneOff?(planned?`Planned ${relativeDate(planned).toLowerCase()}`:'One-off'):recurrenceNote(i);
    if(!planned||planned===due)return `Due ${relativeDate(due).toLowerCase()}`;
    const plannedText=relativeDate(planned).toLowerCase();
    const dueText=relativeDate(due).toLowerCase();
    return planned<due?`Planned ${plannedText} • due ${dueText}`:`Due ${dueText} • planned ${plannedText}`;
  }
  function recurrenceNote(i){ const c=choreById(i.choreId); return c?recurrenceText(c):'One-off'; }

  function plannerPeriod(){
    const anchor=parseDateish(plannerWeekStart);
    if(plannerViewMode==='month'){
      const monthStart=new Date(anchor.getFullYear(),anchor.getMonth(),1);
      const monthEnd=new Date(anchor.getFullYear(),anchor.getMonth()+1,0);
      return {start:monthStart,end:monthEnd,gridStart:startOfWeek(monthStart),gridEnd:endOfWeek(monthEnd)};
    }
    const start=startOfWeek(anchor);
    return {start,end:addDays(start,plannerViewMode==='fortnight'?13:6),gridStart:start,gridEnd:addDays(start,plannerViewMode==='fortnight'?13:6)};
  }

  function nextFixedIntervalAfter(chore,satisfiedIso){
    // Fixed interval routines stay anchored to Start date even if the current
    // occurrence has a one-cycle Next due override.
    let due=parseISO(chore.startDate||chore.anchorDate||satisfiedIso);
    const satisfied=parseISO(satisfiedIso);
    let guard=0;
    while(due<=satisfied && guard++<4000) due=addRecurrence(due,chore);
    return toISO(due);
  }

  function openPlannedOccurrences(choreId){
    const byDue=new Map();
    state.instances
      .filter(i=>i.choreId===choreId&&!i.completed&&!i.cancelled)
      .sort((a,b)=>(a.originalDue||planDateOf(a)).localeCompare(b.originalDue||planDateOf(b))||planDateOf(a).localeCompare(planDateOf(b)))
      .forEach(i=>{
        const key=i.originalDue||planDateOf(i);
        if(!byDue.has(key)) byDue.set(key,i);
      });
    return byDue;
  }

  function advanceProjectedDue(chore,dueIso,plannedDateIso=null){
    const type=chore.recurrenceType||'interval';
    if(type!=='interval') return toISO(firstCalendarOccurrenceOnOrAfter(chore,addDays(parseISO(dueIso),1)));
    const effectiveBehavior=chore.scheduleBehavior==='ask'?(chore.lastCompletionChoice||'completion'):chore.scheduleBehavior;
    if(effectiveBehavior==='fixed') return nextFixedIntervalAfter(chore,dueIso);
    // For completion-based chores, an explicit plan is the best current
    // assumption for when this occurrence will be completed. That planned date
    // becomes the temporary anchor for the rest of the forecast. The real
    // completion date replaces it later if the chore is done early or late.
    const assumedCompletion=plannedDateIso||dueIso;
    return toISO(addRecurrence(parseISO(assumedCompletion),chore));
  }

  function projectedDueDates(chore,startIso,endIso){
    if(chore.active===false) return [];
    let due=nextDue(chore);
    if(!due) return [];
    const out=[];
    const plannedByDue=openPlannedOccurrences(chore.id);
    let guard=0;
    // Every occurrence is projected. If an occurrence has already been moved
    // onto the planner, it is not rendered as a duplicate forecast; instead its
    // scheduled date becomes the assumption that anchors later completion-based
    // occurrences.
    while(due<startIso && guard++<4000){
      const planned=plannedByDue.get(due);
      const next=advanceProjectedDue(chore,due,planned?planDateOf(planned):null);
      if(!next||next<=due) return out;
      due=next;
    }
    while(due<=endIso && guard++<4000){
      const planned=plannedByDue.get(due);
      if(!planned) out.push(due);
      const next=advanceProjectedDue(chore,due,planned?planDateOf(planned):null);
      if(!next||next<=due) break;
      due=next;
    }
    return out;
  }

  function plannerForecastMap(startIso,endIso){
    const map=new Map();
    const represented=new Set(state.instances.filter(i=>!i.cancelled&&i.choreId).map(i=>`${i.choreId}|${i.originalDue||planDateOf(i)}`));
    state.chores.filter(c=>c.active!==false).forEach(chore=>{
      projectedDueDates(chore,startIso,endIso).forEach(due=>{
        if(represented.has(`${chore.id}|${due}`)) return;
        if(!map.has(due)) map.set(due,[]);
        map.get(due).push({preview:true,choreId:chore.id,name:chore.name,category:chore.category,importance:chore.importance,dueDate:due,assignedTo:normalizeAssignee(chore.assignee)});
      });
    });
    return map;
  }

  function manualHistoryItemsForDate(iso){
    return state.chores.filter(c=>c.active!==false&&c.lastCompleted===iso).filter(c=>{
      return !state.instances.some(i=>i.choreId===c.id&&i.completed&&String(i.completedAt||'').slice(0,10)===iso);
    }).map(c=>({
      id:`history-seed|${c.id}|${iso}`,historicalSeed:true,choreId:c.id,name:c.name,category:c.category,importance:c.importance,
      scheduledDate:iso,plannedDate:iso,completed:true,completedAt:`${iso}T12:00:00`,completedBy:null,assignedTo:'either',oneOff:false
    }));
  }

  function plannerItemsForDate(iso){
    const actual=state.instances.filter(i=>!i.cancelled&&calendarDateForInstance(i)===iso);
    return [...actual,...manualHistoryItemsForDate(iso)].sort((a,b)=>Number(a.completed)-Number(b.completed)||priorityScore(a)-priorityScore(b)||a.name.localeCompare(b.name));
  }

  function openPlannerWeekForDate(date){
    plannerWeekStart=startOfWeek(date);
    plannerViewMode='week';
    renderPlanner();
  }

  function compactPlannerItem(item){
    const btn=document.createElement('button');
    btn.type='button';
    if(item.preview){
      btn.className=`calendar-task forecast ${assigneeClass(item.assignedTo)}`;
      btn.innerHTML=`<span class="calendar-task-name">${CATEGORY_EMOJI[item.category]||'•'} ${esc(item.name)}</span><span class="calendar-task-meta">${esc(personLabel(item.assignedTo))}</span>`;
      btn.title=`${item.name} • due ${formatShort(item.dueDate)} • ${recurrenceText(choreById(item.choreId))}`;
      btn.addEventListener('click',e=>{e.stopPropagation();openForecastMove(item.choreId,item.dueDate);});
    } else {
      const owner=item.assignedTo||'either';
      btn.className=`calendar-task planned ${assigneeClass(owner)}${item.completed?' done':''}${item.pinned?' pinned':''}`;
      btn.innerHTML=`<span class="calendar-task-name">${item.pinned?'📌 ':''}${CATEGORY_EMOJI[item.category]||'•'} ${esc(item.name)}</span><span class="calendar-task-meta">${item.historicalSeed?'done':esc(item.completed?(item.completedBy?personLabel(item.completedBy):'done'):personLabel(item.assignedTo))}</span>`;
      btn.title=item.historicalSeed?`${item.name} • last completed ${formatShort(item.scheduledDate)}`:item.completed?`${item.name} • completed${item.completedBy?` by ${personLabel(item.completedBy)}`:''}`:`${item.name} • planned for ${formatShort(planDateOf(item))}${item.pinned?' • pinned':''}`;
      btn.addEventListener('click',e=>{e.stopPropagation();if(item.historicalSeed)openChore(item.choreId);else item.completed?toast(`Completed${item.completedBy?` by ${personLabel(item.completedBy)}`:''}`):openMove(item.id);});
    }
    return btn;
  }

  function renderCalendarPlanner(period){
    const board=document.getElementById('weekBoard');
    board.className=`calendar-board ${plannerViewMode==='month'?'month-board':'fortnight-board'}`;
    board.innerHTML='';
    const gridStart=period.gridStart,gridEnd=period.gridEnd;
    const forecast=plannerForecastMap(toISO(gridStart),toISO(gridEnd));
    const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    weekdays.forEach(day=>{const h=document.createElement('div');h.className='calendar-weekday';h.textContent=day;board.appendChild(h);});
    let date=new Date(gridStart);
    while(date<=gridEnd){
      const cellDate=new Date(date);
      const iso=toISO(cellDate);
      const actual=plannerItemsForDate(iso);
      const previews=(forecast.get(iso)||[]).sort((a,b)=>(a.importance==='essential'?0:a.importance==='regular'?1:2)-(b.importance==='essential'?0:b.importance==='regular'?1:2)||a.name.localeCompare(b.name));
      const items=[...actual,...previews];
      const outside=plannerViewMode==='month'&&cellDate.getMonth()!==period.start.getMonth();
      const cell=document.createElement('section');
      cell.className='calendar-day'+(sameDate(cellDate,today())?' today':'')+(outside?' outside-month':'');
      cell.dataset.date=iso;
      cell.innerHTML=`<button type="button" class="calendar-date-btn" aria-label="Open week of ${formatLong(iso)}"><span>${cellDate.getDate()}</span>${plannerViewMode==='fortnight'?`<small>${cellDate.toLocaleDateString(undefined,{month:'short'})}</small>`:''}</button><div class="calendar-items"></div>`;
      const wrap=cell.querySelector('.calendar-items');
      const limit=plannerViewMode==='month'?4:6;
      items.slice(0,limit).forEach(item=>wrap.appendChild(compactPlannerItem(item)));
      if(items.length>limit){
        const more=document.createElement('button');more.type='button';more.className='calendar-more';more.textContent=`+${items.length-limit} more`;more.addEventListener('click',e=>{e.stopPropagation();openPlannerWeekForDate(cellDate);});wrap.appendChild(more);
      }
      cell.querySelector('.calendar-date-btn').addEventListener('click',e=>{e.stopPropagation();openPlannerWeekForDate(cellDate);});
      cell.addEventListener('click',()=>openPlannerWeekForDate(cellDate));
      board.appendChild(cell);
      date=addDays(date,1);
    }
  }

  function renderPlanner() {
    const period=plannerPeriod();
    const ws=startOfWeek(period.start);
    const label=document.getElementById('weekLabelBtn');
    const title=document.getElementById('plannerTitle');
    const eyebrow=document.getElementById('plannerEyebrow');
    const subtitle=document.getElementById('plannerSubtitle');
    const note=document.getElementById('plannerNote');
    const legend=document.getElementById('plannerLegend');
    const rebalance=document.getElementById('rebalanceBtn');
    document.querySelectorAll('[data-planner-view]').forEach(b=>b.classList.toggle('active',b.dataset.plannerView===plannerViewMode));
    legend.classList.remove('hidden');
    legend.innerHTML=`<span><i class="legend-solid"></i> Planned</span><span><i class="legend-outline"></i> Forecast</span><span><i class="legend-person1"></i> ${esc(personLabel('person1'))}</span><span><i class="legend-person2"></i> ${esc(personLabel('person2'))}</span><span><i class="legend-either"></i> Either</span><span>📌 Pinned</span>`;
    if(plannerViewMode==='week'){
      title.textContent='Weekly Planner';eyebrow.textContent='WEEKLY PLAN';subtitle.textContent='Due is the routine. Planned is your intention. Completed is what actually happened.';
      label.textContent=`${formatShort(ws)} – ${formatShort(endOfWeek(ws))}`;
      note.innerHTML='<strong>Flexible plan:</strong> outlined chores are forecasts; solid chores are plans. If you move a completion-based chore, later plans follow that assumption. If you actually finish it early or late, unpinned future plans shift again to match reality. 📌 pinned dates stay put.';
      rebalance.classList.remove('hidden');
      const board=document.getElementById('weekBoard'); board.className='week-board';board.innerHTML='';
      const forecast=plannerForecastMap(toISO(ws),toISO(endOfWeek(ws)));
      for(let d=0;d<7;d++){
        const date=addDays(ws,d), iso=toISO(date);
        const actual=plannerItemsForDate(iso);
        const previews=(forecast.get(iso)||[]).sort((a,b)=>(a.importance==='essential'?0:a.importance==='regular'?1:2)-(b.importance==='essential'?0:b.importance==='regular'?1:2)||a.name.localeCompare(b.name));
        const col=document.createElement('section'); col.className='day-column'+(sameDate(date,today())?' today':''); col.dataset.date=iso;
        const load=actual.filter(i=>!i.completed).length+previews.length;
        const loadText=load<=1?'Light':load<=3?'Normal':'Busy';
        col.innerHTML=`<div class="day-head"><div><div class="day-name">${date.toLocaleDateString(undefined,{weekday:'short'})}</div><div class="day-date">${date.getDate()}</div></div><div class="load-label">${load?loadText:'Clear'}</div></div><div class="day-tasks"></div>`;
        const wrap=col.querySelector('.day-tasks');
        actual.forEach(i=>wrap.appendChild(plannerCard(i)));
        previews.forEach(i=>wrap.appendChild(plannerForecastCard(i)));
        col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over');});
        col.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
        col.addEventListener('drop',e=>{
          e.preventDefault();col.classList.remove('drag-over');
          const payload=e.dataTransfer.getData('text/plain');if(!payload)return;
          const forecastTarget=parseForecastMoveKey(payload);
          if(forecastTarget){
            const chore=choreById(forecastTarget.choreId);
            scheduleForecast(forecastTarget.choreId,forecastTarget.dueDate,iso,chore?chooseAssignee(chore,ws):'either');
          }else{
            const existing=instanceById(payload);
            moveInstance(payload,iso,existing?.assignedTo||'either',Boolean(existing?.pinned));
          }
        });
        board.appendChild(col);
      }
      return;
    }
    rebalance.classList.add('hidden');
    note.innerHTML='<strong>Continuous schedule:</strong> forecasts show the expected rhythm; plans show your current intention. Completion-based routines reflow from real completion dates, while pinned plans stay on their exact calendar date.';
    if(plannerViewMode==='fortnight'){
      title.textContent='2-Week Planner';eyebrow.textContent='LOOK AHEAD';subtitle.textContent='See the same continuous schedule across two weeks without turning future chores into today’s obligations.';
      label.textContent=`${formatShort(period.start)} – ${formatShort(period.end)}`;
    } else {
      title.textContent='Month Planner';eyebrow.textContent='MONTHLY VIEW';subtitle.textContent='Zoom out to see your expected maintenance rhythm and how occasional chores line up.';
      label.textContent=period.start.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    }
    renderCalendarPlanner(period);
  }

  function plannerCard(i){
    const owner=i.assignedTo||'either';
    const el=document.createElement('article'); el.className=`planner-card ${assigneeClass(owner)}${i.completed?' done':''}${i.pinned?' pinned':''}${i.historicalSeed?' historical-seed':''}`; el.draggable=!i.completed&&!i.historicalSeed; el.dataset.id=i.id;
    const overdue=statusForInstance(i)==='overdue';
    const plan=planDateOf(i);
    const completedDate=i.completedAt?String(i.completedAt).slice(0,10):null;
    const timing=(!i.completed&&i.originalDue&&i.originalDue!==plan)
      ?`<div class="original-due">${overdue?'Overdue • ':''}due ${formatShort(i.originalDue)}</div>`
      :(i.completed&&!i.historicalSeed&&completedDate&&plan&&completedDate!==plan?`<div class="plan-history-note">planned ${formatShort(plan)}</div>`:'');
    el.innerHTML=`<div class="planner-card-title">${i.pinned?'📌 ':''}${CATEGORY_EMOJI[i.category]||'•'} ${esc(i.name)}</div><div class="planner-card-meta"><span class="assignee-dot">${esc(i.historicalSeed?'Previously done':i.completed?(i.completedBy?personLabel(i.completedBy):'Completed'):personLabel(i.assignedTo))}</span>${i.historicalSeed?'':`<button class="planner-card-menu" aria-label="Move or edit">•••</button>`}</div>${timing}`;
    el.addEventListener('dragstart',e=>{if(!i.historicalSeed)e.dataTransfer.setData('text/plain',i.id);});
    el.querySelector('.planner-card-menu')?.addEventListener('click',()=>i.completed?toast(`Completed${i.completedBy?` by ${personLabel(i.completedBy)}`:''}`):openMove(i.id));
    el.addEventListener('dblclick',()=>{if(!i.completed)openComplete(i.id);});
    return el;
  }

  function plannerForecastCard(item){
    const chore=choreById(item.choreId);
    const el=document.createElement('article');
    el.className=`planner-card forecast-card ${assigneeClass(item.assignedTo)}`;
    el.draggable=true;
    el.dataset.choreId=item.choreId;
    el.dataset.dueDate=item.dueDate;
    el.innerHTML=`<div class="planner-card-title">${CATEGORY_EMOJI[item.category]||'•'} ${esc(item.name)}</div><div class="planner-card-meta"><span class="forecast-label">Forecast • ${esc(personLabel(item.assignedTo))}</span><button class="planner-card-menu" aria-label="Plan this occurrence">•••</button></div><div class="forecast-due">due ${formatShort(item.dueDate)}</div>`;
    el.title=chore?`${item.name} • ${recurrenceText(chore)}`:`${item.name} • forecast`;
    el.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',forecastMoveKey(item.choreId,item.dueDate)));
    el.querySelector('.planner-card-menu').addEventListener('click',()=>openForecastMove(item.choreId,item.dueDate));
    return el;
  }

  function recurrenceDays(c){
    const n=Number(c.recurrenceValue)||1;
    if(c.recurrenceUnit==='weeks') return n*7;
    if(c.recurrenceUnit==='months') return n*30.4375;
    return n;
  }

  function choreDueStatus(c){
    const due=parseISO(nextDue(c));
    const now=today();
    const overdueAfter=addDays(due,getGrace(c));
    if(now>overdueAfter) return 'overdue';
    if(now>=due) return 'due';
    return 'upcoming';
  }

  function allChoreTags(){
    const map=new Map();
    state.chores.filter(c=>c.active!==false).forEach(c=>normalizeTags(c.tags).forEach(t=>{const k=tagKey(t);if(!map.has(k))map.set(k,t);}));
    return [...map.values()].sort((a,b)=>a.localeCompare(b));
  }

  function filteredSortedChores(){
    const q=(document.getElementById('choreSearch')?.value||'').trim().toLowerCase();
    const importance=choreFilters.importance;
    const assignee=choreFilters.assignee;
    const tag=choreFilters.tag;
    const status=choreFilters.status;
    const importanceRank={essential:0,regular:1,low:2};
    const dir=choreSort.dir==='desc'?-1:1;
    const chores=state.chores.filter(c=>{
      if(c.active===false) return false;
      if(activeCategory!=='All'&&c.category!==activeCategory) return false;
      if(importance!=='all'&&c.importance!==importance) return false;
      if(assignee!=='all'&&normalizeAssignee(c.assignee)!==assignee) return false;
      if(tag!=='all'&&!normalizeTags(c.tags).some(t=>tagKey(t)===tagKey(tag))) return false;
      if(status!=='all'){
        const s=choreDueStatus(c);
        if(status==='due'&&!(s==='due'||s==='overdue')) return false;
        if(status==='overdue'&&s!=='overdue') return false;
        if(status==='upcoming'&&s!=='upcoming') return false;
        if(status==='never'&&!!c.lastCompleted) return false;
      }
      if(q){
        const hay=`${c.name} ${c.category} ${c.areas||''} ${normalizeTags(c.tags).join(' ')}`.toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });
    const value=(c,key)=>{
      if(key==='name') return c.name.toLowerCase();
      if(key==='category') return c.category.toLowerCase();
      if(key==='recurrence') return recurrenceDays(c);
      if(key==='importance') return importanceRank[c.importance]??1;
      if(key==='lastCompleted') return c.lastCompleted?parseISO(c.lastCompleted).getTime():0;
      if(key==='nextDue') return parseISO(nextDue(c)).getTime();
      if(key==='assignee') return personLabel(normalizeAssignee(c.assignee)).toLowerCase();
      return c.name.toLowerCase();
    };
    chores.sort((a,b)=>{
      const av=value(a,choreSort.key), bv=value(b,choreSort.key);
      const cmp=typeof av==='string'?av.localeCompare(bv):av-bv;
      return (cmp||a.name.localeCompare(b.name))*dir;
    });
    return chores;
  }

  function setChoreSort(key, dir=null){
    if(dir){ choreSort={key,dir}; }
    else if(choreSort.key===key){ choreSort.dir=choreSort.dir==='asc'?'desc':'asc'; }
    else { choreSort={key,dir:(key==='lastCompleted'?'desc':'asc')}; }
    const sortSelect=document.getElementById('choreSortSelect');
    if(sortSelect){
      const value=`${choreSort.key}:${choreSort.dir}`;
      if([...sortSelect.options].some(o=>o.value===value)) sortSelect.value=value;
    }
    renderChores();
  }

  function toggleChoreSelection(id, checked){
    if(checked) selectedChoreIds.add(id); else selectedChoreIds.delete(id);
    renderChores();
  }

  function updateSelectionUI(visible){
    const existing=new Set(state.chores.map(c=>c.id));
    selectedChoreIds=new Set([...selectedChoreIds].filter(id=>existing.has(id)));
    const selectedCount=selectedChoreIds.size;
    const selectedVisible=visible.filter(c=>selectedChoreIds.has(c.id)).length;
    const allVisible=visible.length>0&&selectedVisible===visible.length;
    const selectBox=document.getElementById('selectVisibleCheckbox');
    if(selectBox){selectBox.checked=allVisible;selectBox.indeterminate=selectedVisible>0&&!allVisible;}
    document.getElementById('batchBar')?.classList.toggle('hidden',selectedCount===0);
    const selectedLabel=document.getElementById('selectedChoreCount');if(selectedLabel)selectedLabel.textContent=selectedCount;
    const results=document.getElementById('choreResultsCount');if(results)results.textContent=`${visible.length} chore${visible.length===1?'':'s'} shown`;
    const allBtn=document.getElementById('selectAllFilteredBtn');
    if(allBtn){allBtn.disabled=!visible.length;allBtn.textContent=allVisible?'Deselect all shown':`Select all shown${visible.length?` (${visible.length})`:''}`;}
  }

  function nextOpenPlanForChore(chore){
    const due=nextDue(chore);
    const open=state.instances.filter(i=>i.choreId===chore.id&&!i.completed&&!i.cancelled);
    return open.find(i=>(i.originalDue||planDateOf(i))===due) || null;
  }

  function choreNextMarkup(chore){
    const due=nextDue(chore);
    const plan=nextOpenPlanForChore(chore);
    if(!plan)return `<span>${esc(relativeDate(due))}</span>`;
    const planned=planDateOf(plan);
    const planText=relativeDate(planned);
    const dueText=relativeDate(plan.originalDue||due);
    return `<div class="chore-next-stack"><strong>${plan.pinned?'📌 ':''}Planned ${esc(planText.toLowerCase())}</strong><span>${planned===(plan.originalDue||due)?'Due same day':`Due ${esc(dueText.toLowerCase())}`}</span></div>`;
  }

  function renderChores(){
    const filters=document.getElementById('categoryFilters'); filters.innerHTML='';
    ['All',...CATEGORIES].forEach(cat=>{const b=document.createElement('button');b.className='chip'+(activeCategory===cat?' active':'');b.textContent=cat;b.addEventListener('click',()=>{activeCategory=cat;renderChores();});filters.appendChild(b);});

    const personFilter=document.getElementById('assigneeFilter');
    if(personFilter){
      const [p1,p2]=currentPeople();
      personFilter.innerHTML=`<option value="all">All people</option><option value="either">Either</option><option value="person1">${esc(p1)}</option><option value="person2">${esc(p2)}</option>`;
      personFilter.value=choreFilters.assignee;
    }
    const tagFilter=document.getElementById('tagFilter');
    if(tagFilter){
      const tags=allChoreTags();
      tagFilter.innerHTML='<option value="all">All tags</option>'+tags.map(t=>`<option value="${esc(tagKey(t))}">${esc(t)}</option>`).join('');
      if(tags.some(t=>tagKey(t)===tagKey(choreFilters.tag))) tagFilter.value=tagKey(choreFilters.tag); else {choreFilters.tag='all';tagFilter.value='all';}
    }
    const imp=document.getElementById('importanceFilter');if(imp)imp.value=choreFilters.importance;
    const status=document.getElementById('dueStatusFilter');if(status)status.value=choreFilters.status;
    const sortSelect=document.getElementById('choreSortSelect');
    if(sortSelect){const v=`${choreSort.key}:${choreSort.dir}`;if([...sortSelect.options].some(o=>o.value===v))sortSelect.value=v;}

    document.querySelectorAll('.sort-head').forEach(btn=>{
      const active=btn.dataset.sort===choreSort.key;
      btn.classList.toggle('active',active);
      const ind=btn.querySelector('.sort-indicator');if(ind)ind.textContent=active?(choreSort.dir==='asc'?'↑':'↓'):'';
    });

    const chores=filteredSortedChores();
    const body=document.getElementById('choreTableBody');body.innerHTML='';
    const mobile=document.getElementById('choreCardsMobile');mobile.innerHTML='';
    if(!chores.length){
      body.innerHTML='<tr><td colspan="9"><div class="table-empty">No chores match these filters.</div></td></tr>';
      mobile.innerHTML='<div class="empty-state compact-empty"><h3>No matching chores</h3><p>Try clearing a filter or search.</p></div>';
    }
    chores.forEach(c=>{
      const checked=selectedChoreIds.has(c.id);
      const tags=tagMarkup(c.tags);
      const tr=document.createElement('tr');tr.classList.toggle('selected-row',checked);
      tr.innerHTML=`<td class="select-col"><input class="chore-select" type="checkbox" ${checked?'checked':''} aria-label="Select ${esc(c.name)}" /></td><td class="chore-title-cell"><strong>${esc(c.name)}</strong><span>${esc(c.areas||'')}</span>${tags?`<div class="tag-row">${tags}</div>`:''}</td><td>${esc(c.category)}</td><td>${esc(recurrenceText(c))}</td><td><span class="badge ${c.importance}">${importanceLabel[c.importance]}</span></td><td>${relativeDate(c.lastCompleted)}</td><td>${choreNextMarkup(c)}</td><td>${esc(personLabel(normalizeAssignee(c.assignee)))}</td><td class="table-actions"><button class="text-btn edit-chore">Edit</button><button class="text-btn danger delete-chore">Delete</button></td>`;
      tr.querySelector('.chore-select').addEventListener('change',e=>toggleChoreSelection(c.id,e.target.checked));
      tr.querySelector('.edit-chore').addEventListener('click',()=>openChore(c.id));
      tr.querySelector('.delete-chore').addEventListener('click',()=>deleteChore(c.id)); body.appendChild(tr);

      const card=document.createElement('div'); card.className='chore-mobile-card'+(checked?' selected-row':'');
      card.innerHTML=`<div class="chore-mobile-top"><div class="mobile-select-title"><input class="chore-select" type="checkbox" ${checked?'checked':''} aria-label="Select ${esc(c.name)}" /><div><div class="chore-mobile-title">${CATEGORY_EMOJI[c.category]} ${esc(c.name)}</div><div class="chore-mobile-meta"><span class="badge">${esc(c.category)}</span><span class="badge ${c.importance}">${importanceLabel[c.importance]}</span></div>${tags?`<div class="tag-row">${tags}</div>`:''}</div></div><button class="text-btn edit-chore">Edit</button></div><div class="chore-mobile-dates"><div>Last: ${relativeDate(c.lastCompleted)}</div><div>${choreNextMarkup(c)}</div></div>`;
      card.querySelector('.chore-select').addEventListener('change',e=>toggleChoreSelection(c.id,e.target.checked));
      card.querySelector('.edit-chore').addEventListener('click',()=>openChore(c.id)); mobile.appendChild(card);
    });
    updateSelectionUI(chores);
  }

  function openBatchEdit(){
    if(!selectedChoreIds.size) return;
    const category=document.getElementById('batchCategory');
    category.innerHTML='<option value="">No change</option>'+CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    category.value='';document.getElementById('batchImportance').value='';document.getElementById('batchAssignee').value='';document.getElementById('batchTagMode').value='none';document.getElementById('batchTags').value='';
    document.getElementById('batchTagsLabel').classList.add('hidden');
    document.getElementById('batchEditSummary').textContent=`Editing ${selectedChoreIds.size} selected chore${selectedChoreIds.size===1?'':'s'}. Only chosen fields will change.`;
    document.getElementById('batchEditDialog').showModal();
  }

  function applyBatchEdit(){
    const ids=new Set(selectedChoreIds);if(!ids.size)return;
    const category=document.getElementById('batchCategory').value;
    const importance=document.getElementById('batchImportance').value;
    const assignee=document.getElementById('batchAssignee').value;
    const tagMode=document.getElementById('batchTagMode').value;
    const tags=normalizeTags(document.getElementById('batchTags').value);
    if(!category&&!importance&&!assignee&&tagMode==='none'){toast('Choose something to change');return;}
    state.chores.forEach(c=>{
      if(!ids.has(c.id))return;
      if(category)c.category=category;
      if(importance)c.importance=importance;
      if(assignee)c.assignee=assignee;
      const current=normalizeTags(c.tags);
      if(tagMode==='replace')c.tags=tags;
      if(tagMode==='clear')c.tags=[];
      if(tagMode==='add')c.tags=normalizeTags([...current,...tags]);
      if(tagMode==='remove'){const remove=new Set(tags.map(tagKey));c.tags=current.filter(t=>!remove.has(tagKey(t)));}
      state.instances.filter(i=>i.choreId===c.id&&!i.completed).forEach(i=>{
        i.category=c.category;i.importance=c.importance;
        // A batch change to the default person should update routine-generated
        // upcoming plans, while preserving occurrences the user explicitly
        // moved/planned (those may intentionally be assigned differently).
        if(assignee&&!i.manualPlan&&!i.pinned)i.assignedTo=assignee;
      });
    });
    const count=ids.size;selectedChoreIds.clear();
    saveState(`${count} chore${count===1?'':'s'} updated`);document.getElementById('batchEditDialog').close();renderAll();
  }

  function batchDeleteSelected(){
    const ids=new Set(selectedChoreIds);const count=ids.size;if(!count)return;
    if(!confirm(`Delete ${count} selected chore${count===1?'':'s'}? Their completion history will stay in History.`))return;
    state.chores=state.chores.filter(c=>!ids.has(c.id));
    state.instances=state.instances.filter(i=>!ids.has(i.choreId)||i.completed);
    selectedChoreIds.clear();saveState(`${count} chore${count===1?'':'s'} deleted`);renderAll();
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
    const defaultStatus=document.getElementById('customDefaultStatus');
    if(defaultStatus){
      if(state.customDefault?.savedAt){const d=new Date(state.customDefault.savedAt);defaultStatus.textContent=`Custom default saved ${d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} • ${state.customDefault.chores.length} chores`;}
      else defaultStatus.textContent='Using the built-in chore list as the reset default.';
    }
  }

  function renderPeopleSelects(){
    const [p1,p2]=currentPeople();
    const opts=`<option value="either">Either</option><option value="person1">${esc(p1)}</option><option value="person2">${esc(p2)}</option>`;
    ['choreAssignee','oneOffAssignee','moveAssignee'].forEach(id=>{const el=document.getElementById(id); if(el){const old=el.value;el.innerHTML=opts;if([...el.options].some(o=>o.value===old))el.value=old;}});
    const batchAssignee=document.getElementById('batchAssignee');if(batchAssignee){const old=batchAssignee.value;batchAssignee.innerHTML=`<option value="">No change</option>${opts}`;if([...batchAssignee.options].some(o=>o.value===old))batchAssignee.value=old;}
    const completed=document.getElementById('completedBy');if(completed){const old=completed.value;completed.innerHTML=`<option value="person1">${esc(p1)}</option><option value="person2">${esc(p2)}</option>`;if(old)completed.value=old;}
    const catOpts=CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    ['choreCategory','oneOffCategory'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.options.length)el.innerHTML=catOpts;});
  }

  function setRecurrenceFields(type){
    const chosen=type||document.getElementById('recurrenceType').value||'interval';
    ['intervalRecurrenceFields','weeklyRecurrenceFields','monthlyDayRecurrenceFields','monthlyWeekdayRecurrenceFields'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
    const map={interval:'intervalRecurrenceFields',weekly:'weeklyRecurrenceFields','monthly-day':'monthlyDayRecurrenceFields','monthly-weekday':'monthlyWeekdayRecurrenceFields'};
    document.getElementById(map[chosen])?.classList.remove('hidden');
    const behavior=document.getElementById('scheduleBehavior');
    if(behavior){
      if(chosen!=='interval'){if(!behavior.disabled)behavior.dataset.intervalValue=behavior.value||'completion';behavior.value='fixed';behavior.disabled=true;}
      else {behavior.disabled=false;behavior.value=behavior.dataset.intervalValue||behavior.value||'completion';}
    }
    const help=document.getElementById('scheduleBehaviorHelp');
    if(help)help.textContent=chosen==='interval'?'Choose whether the interval restarts when you complete it.':'Calendar-based routines stay anchored to the selected weekday/date.';
  }

  function openChore(id=null){
    const d=document.getElementById('choreDialog'), c=id?choreById(id):null;
    document.getElementById('choreModalKicker').textContent=c?'EDIT ROUTINE':'NEW ROUTINE';document.getElementById('choreModalTitle').textContent=c?'Edit chore':'Add chore';
    document.getElementById('choreId').value=c?.id||'';document.getElementById('choreName').value=c?.name||'';document.getElementById('choreCategory').value=c?.category||'Cleaning';document.getElementById('choreAssignee').value=normalizeAssignee(c?.assignee||'either');
    const type=c?.recurrenceType||'interval';document.getElementById('recurrenceType').value=type;
    document.getElementById('recurrenceValue').value=c?.recurrenceValue||7;document.getElementById('recurrenceUnit').value=c?.recurrenceUnit||'days';
    document.getElementById('weeklyInterval').value=type==='weekly'?(c?.recurrenceValue||1):1;document.getElementById('weeklyDay').value=String(c?.weekday??0);
    document.getElementById('monthlyDayInterval').value=type==='monthly-day'?(c?.recurrenceValue||1):1;document.getElementById('monthDay').value=c?.monthDay||1;
    document.getElementById('monthlyWeekdayInterval').value=type==='monthly-weekday'?(c?.recurrenceValue||1):1;document.getElementById('monthOrdinal').value=String(c?.monthOrdinal??'1');document.getElementById('monthWeekday').value=String(c?.monthWeekday??0);
    document.getElementById('choreImportance').value=c?.importance||'regular';document.getElementById('choreGrace').value=c?.graceOverride??'';const behavior=document.getElementById('scheduleBehavior');behavior.value=type==='interval'?(c?.scheduleBehavior||'completion'):'fixed';behavior.dataset.intervalValue=type==='interval'?(c?.scheduleBehavior||'completion'):'completion';document.getElementById('lastCompleted').value=c?.lastCompleted||'';
    const startDate=c?.startDate||toISO(today());document.getElementById('startDate').value=startDate;
    const nextInput=document.getElementById('nextDueDate');const shownNext=c?nextDue(c):startDate;nextInput.value=shownNext;nextInput.dataset.natural=c?nextDue(c,true):startDate;nextInput.dataset.hadOverride=c?.nextDueOverride?'1':'0';nextInput.dataset.userEdited='0';
    document.getElementById('choreTags').value=normalizeTags(c?.tags).join(', ');document.getElementById('choreAreas').value=c?.areas||'';setRecurrenceFields(type);d.showModal();
  }

  function recurrenceDataFromForm(){
    const type=document.getElementById('recurrenceType').value;
    if(type==='weekly')return {recurrenceType:type,recurrenceValue:Math.max(1,Number(document.getElementById('weeklyInterval').value)||1),recurrenceUnit:'weeks',weekday:Number(document.getElementById('weeklyDay').value)};
    if(type==='monthly-day')return {recurrenceType:type,recurrenceValue:Math.max(1,Number(document.getElementById('monthlyDayInterval').value)||1),recurrenceUnit:'months',monthDay:Math.min(31,Math.max(1,Number(document.getElementById('monthDay').value)||1))};
    if(type==='monthly-weekday')return {recurrenceType:type,recurrenceValue:Math.max(1,Number(document.getElementById('monthlyWeekdayInterval').value)||1),recurrenceUnit:'months',monthOrdinal:document.getElementById('monthOrdinal').value,monthWeekday:Number(document.getElementById('monthWeekday').value)};
    return {recurrenceType:'interval',recurrenceValue:Math.max(1,Number(document.getElementById('recurrenceValue').value)||1),recurrenceUnit:document.getElementById('recurrenceUnit').value};
  }

  function recurrenceDraftFromForm(existing=null){
    return {...(existing||{}),...recurrenceDataFromForm(),startDate:document.getElementById('startDate').value||toISO(today()),lastCompleted:document.getElementById('lastCompleted').value||null,nextDueOverride:null,scheduleBehavior:document.getElementById('recurrenceType').value==='interval'?document.getElementById('scheduleBehavior').value:'fixed'};
  }
  function refreshNextDuePreview(force=false){
    const input=document.getElementById('nextDueDate');if(!input)return;
    if(!force&&(input.dataset.userEdited==='1'||input.dataset.hadOverride==='1'))return;
    const id=document.getElementById('choreId').value;const existing=id?choreById(id):null;
    input.value=naturalNextDue(recurrenceDraftFromForm(existing));
  }

  function scheduleSignature(c){
    return JSON.stringify({recurrenceType:c.recurrenceType||'interval',recurrenceValue:Number(c.recurrenceValue)||1,recurrenceUnit:c.recurrenceUnit,weekday:c.weekday,monthDay:c.monthDay,monthOrdinal:String(c.monthOrdinal??''),monthWeekday:c.monthWeekday,startDate:c.startDate,nextDueOverride:c.nextDueOverride,scheduleBehavior:c.scheduleBehavior,lastCompleted:c.lastCompleted});
  }

  function saveChoreFromForm(){
    const id=document.getElementById('choreId').value;
    const existing=id?choreById(id):null;
    const recurrence=recurrenceDataFromForm();
    const startDate=document.getElementById('startDate').value||toISO(today());
    const requestedNext=document.getElementById('nextDueDate').value||startDate;
    const beforeSignature=existing?scheduleSignature(existing):null;
    const submittedLastCompleted=document.getElementById('lastCompleted').value||null;
    const submittedLastDueSatisfied=submittedLastCompleted===(existing?.lastCompleted||null)?(existing?.lastDueSatisfied||null):submittedLastCompleted;
    const data={
      id:id||uid('chore'),name:document.getElementById('choreName').value.trim(),category:document.getElementById('choreCategory').value,
      assignee:document.getElementById('choreAssignee').value,...recurrence,
      importance:document.getElementById('choreImportance').value,graceOverride:document.getElementById('choreGrace').value===''?null:Number(document.getElementById('choreGrace').value),scheduleBehavior:recurrence.recurrenceType==='interval'?document.getElementById('scheduleBehavior').value:'fixed',
      lastCompleted:submittedLastCompleted,lastDueSatisfied:submittedLastDueSatisfied,tags:normalizeTags(document.getElementById('choreTags').value),areas:document.getElementById('choreAreas').value.trim(),active:true,
      startDate,nextDueOverride:null,anchorDate:startDate,createdAt:existing?.createdAt||new Date().toISOString()
    };
    if(!data.name)return;
    // Work out the natural date using the edited recurrence. If the entered Next due differs, store a one-cycle override.
    const natural=naturalNextDue(data);const nextInput=document.getElementById('nextDueDate');
    const keepOrCreateOverride=nextInput.dataset.userEdited==='1'||nextInput.dataset.hadOverride==='1';
    data.nextDueOverride=keepOrCreateOverride&&requestedNext&&requestedNext!==natural?requestedNext:null;
    if(existing)Object.assign(existing,data);else state.chores.push(data);
    const target=existing||data;
    const scheduleChanged=!existing||beforeSignature!==scheduleSignature(target);
    if(scheduleChanged){
      state.instances=state.instances.filter(i=>i.choreId!==target.id||i.completed||i.cancelled);
      ensureDueForecastsPlanned();
    }else saveState(existing?'Chore updated':'Chore added');
    if(scheduleChanged)saveState(existing?'Chore schedule updated':'Chore added');
    document.getElementById('choreDialog').close();renderAll();
  }

  function deleteChore(id){
    const c=choreById(id); if(!c) return;
    if(!confirm(`Delete “${c.name}”? Its completion history will stay in History.`)) return;
    state.chores=state.chores.filter(x=>x.id!==id);state.instances=state.instances.filter(i=>i.choreId!==id||i.completed);selectedChoreIds.delete(id);
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
    document.getElementById('moveInstanceId').value=id;document.getElementById('moveTaskName').textContent=i.name;document.getElementById('moveDueHint').textContent=i.originalDue?`Routine due: ${formatLong(i.originalDue)}`:'One-off chore';document.getElementById('moveDate').value=planDateOf(i);document.getElementById('moveAssignee').value=i.assignedTo||'either';document.getElementById('pinPlanDate').checked=Boolean(i.pinned);document.getElementById('moveDialog').showModal();
  }

  function openForecastMove(choreId,dueDate){
    const chore=choreById(choreId);if(!chore)return;
    document.getElementById('moveInstanceId').value=forecastMoveKey(choreId,dueDate);
    document.getElementById('moveTaskName').textContent=chore.name;
    document.getElementById('moveDueHint').textContent=`Routine due: ${formatLong(dueDate)}`;
    document.getElementById('moveDate').value=dueDate;
    document.getElementById('moveAssignee').value=chooseAssignee(chore,startOfWeek(parseISO(dueDate)));
    document.getElementById('pinPlanDate').checked=false;
    document.getElementById('moveDialog').showModal();
  }

  function addOneOff(){
    const name=document.getElementById('oneOffName').value.trim();if(!name)return;
    const date=document.getElementById('oneOffDate').value;
    state.instances.push({id:uid('inst'),choreId:null,name,category:document.getElementById('oneOffCategory').value,importance:'regular',originalDue:date,scheduledDate:date,plannedDate:date,assignedTo:document.getElementById('oneOffAssignee').value,completed:false,oneOff:true,manualPlan:true,pinned:false,createdAt:new Date().toISOString()});
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
        const inst={id:uid('inst'),choreId:x.chore.id,name:x.chore.name,category:x.chore.category,importance:x.chore.importance,originalDue:x.due,scheduledDate:t,plannedDate:t,assignedTo:chooseAssignee(x.chore,startOfWeek(today())),completed:false,oneOff:false,optionalPullForward:true,manualPlan:true,pinned:false,createdAt:new Date().toISOString()};
        state.instances.push(inst);
        rebaseFuturePlansAfterAssumptionChange(x.chore,inst,x.due,t,'plan');
        saveState('Added to today — still optional');document.getElementById('energyDialog').close();renderAll();
      });wrap.appendChild(card);
    });
    if(!wrap.children.length) wrap.innerHTML='<div class="empty-state"><h3>Nothing useful to pull forward.</h3><p>That is a perfectly good reason to stop.</p></div>';
  }

  function rebalanceRemainingWeek(){
    const ws=startOfWeek(plannerWeekStart), we=endOfWeek(ws), todayIso=toISO(today());
    const wsIso=toISO(ws),weIso=toISO(we);
    const movable=state.instances.filter(i=>!i.completed&&!i.cancelled&&!i.pinned&&planDateOf(i)>=wsIso&&planDateOf(i)<=weIso&&planDateOf(i)>=todayIso);
    const loadFor=date=>state.instances.filter(i=>!i.completed&&!i.cancelled&&i.id!==currentBalanceId&&planDateOf(i)===date).length;
    let currentBalanceId=null;
    movable.sort((a,b)=>(a.originalDue||planDateOf(a)).localeCompare(b.originalDue||planDateOf(b))).forEach(i=>{
      currentBalanceId=i.id;
      const chore=choreById(i.choreId);const grace=chore?getGrace(chore):2;
      const due=i.originalDue||planDateOf(i);
      const earliest=maxISO(due,todayIso,wsIso);const latest=minISO(toISO(addDays(parseISO(due),grace)),weIso);
      let candidates=[];for(let d=parseISO(earliest);toISO(d)<=latest;d=addDays(d,1))candidates.push(toISO(d));if(!candidates.length)candidates=[maxISO(todayIso,wsIso)];
      candidates.sort((a,b)=>loadFor(a)-loadFor(b)||a.localeCompare(b));
      const target=candidates[0],oldPlan=planDateOf(i);
      if(target!==oldPlan){
        setPlanDate(i,target);i.snoozed=Boolean(i.originalDue&&target!==i.originalDue);i.manualPlan=true;
        if(chore)rebaseFuturePlansAfterAssumptionChange(chore,i,oldPlan,target,'balance');
      }
    });
    saveState('Planned chores balanced');renderAll();
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

  function defaultSnapshotFromCurrent(){
    const chores=JSON.parse(JSON.stringify(state.chores)).map(c=>{
      const currentNext=nextDue(c);
      const copy=normalizeChore(c);
      // Completion records are live history, not part of a reset template. Preserve the date currently shown as Next due.
      copy.lastCompleted=null;copy.lastDueSatisfied=null;copy.lastCompletionChoice=null;copy.nextDueOverride=currentNext;
      return copy;
    });
    return {savedAt:new Date().toISOString(),chores};
  }
  function setCurrentAsDefault(){
    if(!confirm(`Use the current ${state.chores.length} chore${state.chores.length===1?'':'s'} as your reset default? Names, categories, recurrence rules, start/next dates, importance, assignments, tags and notes will be saved. Completion history and this week's plan will not.`))return;
    state.customDefault=defaultSnapshotFromCurrent();
    saveState('Current chore setup is now your default');renderSettings();
  }
  function resetToDefaults(){
    const hasCustom=!!state.customDefault?.chores?.length;
    const label=hasCustom?'your saved custom default':'the built-in chore list';
    if(!confirm(`Reset chores, weekly plans, and history to ${label}? Your app and cloud settings will be kept.`))return;
    const keptSettings=JSON.parse(JSON.stringify(state.settings||{}));
    const keptDefault=state.customDefault?JSON.parse(JSON.stringify(state.customDefault)):null;
    const fresh=starter();
    if(hasCustom)fresh.chores=keptDefault.chores.map(c=>normalizeChore(JSON.parse(JSON.stringify(c))));
    fresh.settings={...fresh.settings,...keptSettings,grace:{...fresh.settings.grace,...(keptSettings.grace||{})}};
    fresh.customDefault=keptDefault;
    state=fresh;selectedChoreIds.clear();saveState(hasCustom?'Saved default restored':'Built-in defaults restored');renderAll();
  }

  function exportData(){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`household-backup-${toISO(today())}.json`;a.click();URL.revokeObjectURL(url);toast('Backup exported');
  }
  async function importData(file){
    try{const obj=JSON.parse(await file.text());state=normalizeState(obj);saveState('Backup imported');renderAll();}catch(e){toast('That backup could not be read');}
  }

  function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400);}
  function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

  function switchView(name){
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    if(name==='planner'&&plannerViewMode!=='month') plannerWeekStart=startOfWeek(plannerWeekStart);
    window.scrollTo({top:0,behavior:'smooth'});renderAll();
  }

  function bind(){
    document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
    document.getElementById('openPlannerBtn').addEventListener('click',()=>switchView('planner'));
    document.getElementById('overviewToggleBtn').addEventListener('click',()=>{overviewShowAll=!overviewShowAll;renderOverview();});
    document.getElementById('addChoreBtn').addEventListener('click',()=>openChore());
    document.getElementById('choreSearch').addEventListener('input',renderChores);
    document.getElementById('importanceFilter').addEventListener('change',e=>{choreFilters.importance=e.target.value;renderChores();});
    document.getElementById('assigneeFilter').addEventListener('change',e=>{choreFilters.assignee=e.target.value;renderChores();});
    document.getElementById('tagFilter').addEventListener('change',e=>{choreFilters.tag=e.target.value;renderChores();});
    document.getElementById('dueStatusFilter').addEventListener('change',e=>{choreFilters.status=e.target.value;renderChores();});
    document.getElementById('choreSortSelect').addEventListener('change',e=>{const [key,dir]=e.target.value.split(':');setChoreSort(key,dir);});
    document.querySelectorAll('.sort-head').forEach(btn=>btn.addEventListener('click',()=>setChoreSort(btn.dataset.sort)));
    document.getElementById('clearChoreFiltersBtn').addEventListener('click',()=>{activeCategory='All';choreFilters={importance:'all',assignee:'all',tag:'all',status:'all'};document.getElementById('choreSearch').value='';renderChores();});
    document.getElementById('selectAllFilteredBtn').addEventListener('click',()=>{const shown=filteredSortedChores();const all=shown.length&&shown.every(c=>selectedChoreIds.has(c.id));shown.forEach(c=>all?selectedChoreIds.delete(c.id):selectedChoreIds.add(c.id));renderChores();});
    document.getElementById('selectVisibleCheckbox').addEventListener('change',e=>{const shown=filteredSortedChores();shown.forEach(c=>e.target.checked?selectedChoreIds.add(c.id):selectedChoreIds.delete(c.id));renderChores();});
    document.getElementById('clearSelectionBtn').addEventListener('click',()=>{selectedChoreIds.clear();renderChores();});
    document.getElementById('batchEditBtn').addEventListener('click',openBatchEdit);
    document.getElementById('batchDeleteBtn').addEventListener('click',batchDeleteSelected);
    document.getElementById('batchTagMode').addEventListener('change',e=>{document.getElementById('batchTagsLabel').classList.toggle('hidden',e.target.value==='none'||e.target.value==='clear');});
    document.getElementById('applyBatchEditBtn').addEventListener('click',e=>{e.preventDefault();applyBatchEdit();});
    document.getElementById('recurrenceType').addEventListener('change',e=>{setRecurrenceFields(e.target.value);refreshNextDuePreview();});
    ['recurrenceValue','recurrenceUnit','weeklyInterval','weeklyDay','monthlyDayInterval','monthDay','monthlyWeekdayInterval','monthOrdinal','monthWeekday','startDate','lastCompleted','scheduleBehavior'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>refreshNextDuePreview()));
    document.getElementById('nextDueDate').addEventListener('input',e=>{e.target.dataset.userEdited='1';});
    document.getElementById('clearNextDueBtn').addEventListener('click',()=>{const input=document.getElementById('nextDueDate');input.dataset.hadOverride='0';input.dataset.userEdited='0';refreshNextDuePreview(true);toast('Next date reset to schedule');});
    document.getElementById('saveChoreBtn').addEventListener('click',e=>{e.preventDefault();saveChoreFromForm();});
    document.getElementById('confirmCompleteBtn').addEventListener('click',e=>{e.preventDefault();const id=document.getElementById('completeInstanceId').value;const chore=choreById(instanceById(id)?.choreId);let choice=null;if(chore?.scheduleBehavior==='ask')choice=document.querySelector('input[name="scheduleChoice"]:checked')?.value;completeInstance(id,document.getElementById('completedBy').value,choice);document.getElementById('completeDialog').close();});
    document.getElementById('confirmMoveBtn').addEventListener('click',e=>{e.preventDefault();const target=document.getElementById('moveInstanceId').value;const date=document.getElementById('moveDate').value;const assignee=document.getElementById('moveAssignee').value;const pinned=document.getElementById('pinPlanDate').checked;const forecast=parseForecastMoveKey(target);if(forecast)scheduleForecast(forecast.choreId,forecast.dueDate,date,assignee,pinned);else moveInstance(target,date,assignee,pinned);document.getElementById('moveDialog').close();});
    document.querySelectorAll('[data-planner-view]').forEach(b=>b.addEventListener('click',()=>{plannerViewMode=b.dataset.plannerView;plannerWeekStart=plannerViewMode==='month'?new Date(plannerWeekStart.getFullYear(),plannerWeekStart.getMonth(),1):startOfWeek(plannerWeekStart);renderPlanner();}));
    document.getElementById('prevWeekBtn').addEventListener('click',()=>{if(plannerViewMode==='month')plannerWeekStart=new Date(plannerWeekStart.getFullYear(),plannerWeekStart.getMonth()-1,1);else plannerWeekStart=addDays(plannerWeekStart,plannerViewMode==='fortnight'?-14:-7);renderPlanner();});
    document.getElementById('nextWeekBtn').addEventListener('click',()=>{if(plannerViewMode==='month')plannerWeekStart=new Date(plannerWeekStart.getFullYear(),plannerWeekStart.getMonth()+1,1);else plannerWeekStart=addDays(plannerWeekStart,plannerViewMode==='fortnight'?14:7);renderPlanner();});
    document.getElementById('weekLabelBtn').addEventListener('click',()=>{plannerWeekStart=plannerViewMode==='month'?new Date(today().getFullYear(),today().getMonth(),1):startOfWeek(today());renderPlanner();});
    document.getElementById('rebalanceBtn').addEventListener('click',rebalanceRemainingWeek);
    document.getElementById('addOneOffBtn').addEventListener('click',()=>{document.getElementById('oneOffDate').value=maxISO(toISO(plannerPeriod().start),toISO(today()));document.getElementById('oneOffAssignee').value='either';document.getElementById('oneOffCategory').value='Cleaning';document.getElementById('oneOffDialog').showModal();});
    document.getElementById('saveOneOffBtn').addEventListener('click',e=>{e.preventDefault();addOneOff();});
    document.getElementById('energyBtn').addEventListener('click',()=>{energyMode='soon';document.querySelectorAll('[data-energy]').forEach(b=>b.classList.toggle('active',b.dataset.energy==='soon'));renderEnergySuggestions();document.getElementById('energyDialog').showModal();});
    document.querySelectorAll('[data-energy]').forEach(b=>b.addEventListener('click',()=>{energyMode=b.dataset.energy;document.querySelectorAll('[data-energy]').forEach(x=>x.classList.toggle('active',x===b));renderEnergySuggestions();}));
    document.getElementById('saveSettingsBtn').addEventListener('click',saveSettings);document.getElementById('pushCloudBtn').addEventListener('click',pushCloud);document.getElementById('pullCloudBtn').addEventListener('click',pullCloud);
    document.getElementById('exportBtn').addEventListener('click',exportData);document.getElementById('importInput').addEventListener('change',e=>{if(e.target.files?.[0])importData(e.target.files[0]);e.target.value='';});
    document.getElementById('setDefaultBtn').addEventListener('click',setCurrentAsDefault);
    document.getElementById('resetDemoBtn').addEventListener('click',resetToDefaults);
  }

  bind(); renderAll();
  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
})();
