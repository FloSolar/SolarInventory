
const CATS = {
  panel:    { label:'Solar Panels', icon:'☀️', fields:['brand','wattage','cost'] },
  inverter: { label:'Inverters',    icon:'⚡', fields:['brand','kw','inv_type'] },
  battery:  { label:'Batteries',    icon:'🔋', fields:['brand','batt_type'] },
};
const OWNER_NAMES = ['Owner 1','Owner 2','Owner 3','Owner 4','Owner 5'];

let sb=null, session=null, loginError='';
let owners=[], stock=[], models=[], jobs=[], movements=[], ready=false;
let tab='dashboard', ownerFilter='all';
let form = { category:'panel', brand:'', wattage:'', cost:'', kw:'', inv_type:'', batt_type:'', quantity:'', model_id:'', pallets:'' };
let batchMeta = { owner_id:'', date:new Date().toISOString().slice(0,10), reference:'' };
let autoAddGateway = true;
let pending = [];
let editPendingId = null, editPendingForm = {};
let newModel = { category:'panel', brand:'', wattage:'', cost:'', kw:'', inv_type:'', batt_type:'', per_pallet:'' };
let jobForm = { owner_id:'', date:new Date().toISOString().slice(0,10), installation_date:'', reference:'', notes:'', panelKey:'', panelQty:'', inverterKey:'', inverterQty:'', batteryKey:'', batteryQty:'', autoGateway:true };
let editJobId=null, editJobForm = { owner_id:'', date:'', installation_date:'', reference:'', notes:'', reason:'' };
let confirmCreateJob=null, confirmEditJob=null;
let editStockId=null, editStockForm={};
let transferOpen=false, transferMsg='';
let transferForm={ from_owner_id:'', category:'panel', itemKey:'', qty:'', to_owner_id:'', reference:'', date:new Date().toISOString().slice(0,10) };
let msg='', jobMsg='', logMsg='', invMsg='';
let stockInSearch='', stockInLimit='20', stockInRange='all', stockInDate='', stockInFrom='', stockInTo='';
let jobSearch='', jobLimit='20', jobRange='all', jobDate='', jobFrom='', jobTo='';
let invSearch='', invCategoryFilter='all', invLimit='all', invRange='all', invDate='', invFrom='', invTo='';
let logSearch='', logLimit='20', logRange='all', logDate='', logFrom='', logTo='';
let dashScope='global', breakdownCat='panel';
let dashExpanded = { panel:false, inverter:false, battery:false };
let confirmDeleteModelId=null, confirmDeleteChecked=false;
let confirmResetOpen=false, confirmResetChecked=false;
let editModelId=null, editModelForm={};
let confirmModelChanges=null;
let editOwnerId=null, editOwnerForm={name:''};
let confirmOwnerEdit=null, confirmOwnerEditChecked=false;
let confirmDeleteOwnerId=null, confirmDeleteOwnerChecked=false;
let subscribed=false, seeded=false;

const $ = s => document.querySelector(s);
const fmt = n => Number(n||0).toLocaleString();
const money = n => '$' + Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
function fmtDate(ds){
  if(!ds) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ds);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ds;
}
function fmtDateTime(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d)) return iso;
  const datePart = fmtDate(d.toISOString().slice(0,10));
  const timePart = d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
  return `${datePart}, ${timePart}`;
}
function renderPreserveFocus(){
  const el=document.activeElement;
  const id=el&&el.id, start=el&&el.selectionStart;
  render();
  if(id){ const ne=document.getElementById(id); if(ne){ ne.focus(); if(start!=null && ne.setSelectionRange) try{ne.setSelectionRange(start,start);}catch(e){} } }
}

sb = window.supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_ANON_KEY);

async function initAuth(){
  const { data } = await sb.auth.getSession();
  session = data.session;
  sb.auth.onAuthStateChange((_e, s)=>{ session = s; render(); if(session) startData(); });
  render();
  if(session) startData();
}
async function login(email, password){
  loginError='';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if(error) loginError = error.message;
  render();
}
async function logout(){ await sb.auth.signOut(); }

async function startData(){
  if(subscribed) return;
  subscribed = true;
  await Promise.all([loadOwners(), loadStock(), loadModels(), loadJobs(), loadMovements()]);
  seedOwnersIfNeeded();
  sb.channel('all-changes')
    .on('postgres_changes',{event:'*',schema:'public',table:'owners'}, loadOwners)
    .on('postgres_changes',{event:'*',schema:'public',table:'stock'}, loadStock)
    .on('postgres_changes',{event:'*',schema:'public',table:'models'}, loadModels)
    .on('postgres_changes',{event:'*',schema:'public',table:'jobs'}, loadJobs)
    .on('postgres_changes',{event:'*',schema:'public',table:'movements'}, loadMovements)
    .subscribe();
}
async function loadOwners(){ const {data}=await sb.from('owners').select('*'); owners=(data||[]).sort((a,b)=>a.id.localeCompare(b.id)); render(); }
async function loadStock(){ const {data}=await sb.from('stock').select('*'); stock=data||[]; ready=true; render(); }
async function loadModels(){ const {data}=await sb.from('models').select('*'); models=data||[]; render(); }
async function loadJobs(){ const {data}=await sb.from('jobs').select('*'); jobs=(data||[]).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')); render(); }
async function loadMovements(){ const {data}=await sb.from('movements').select('*'); movements=(data||[]).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')); render(); }

async function seedOwnersIfNeeded(){
  if(seeded || owners.length>0) return;
  seeded=true;
  for(let i=0;i<OWNER_NAMES.length;i++) await sb.from('owners').upsert({id:'owner-'+(i+1), name:OWNER_NAMES[i]});
}

// ---------- helpers ----------
function ownerName(id){ const o=owners.find(o=>o.id===id); return o?o.name:'—'; }
function modelLabel(m){
  if(m.category==='panel') return `${m.brand} · ${m.wattage}W`;
  if(m.category==='inverter') return `${m.brand} · ${m.kw}kW · ${m.inv_type}`;
  return `${m.brand} · ${m.batt_type}`;
}
function specLabel(it){
  const ship = `${it.reference?` · Ref: ${it.reference}`:''}${it.shipment_date?` · ${fmtDate(it.shipment_date)}`:''}`;
  if(it.category==='panel') return `${it.brand} · ${it.wattage}W${ship}`;
  if(it.category==='inverter') return `${it.brand} · ${it.kw}kW · ${it.inv_type}${ship}`;
  return `${it.brand} · ${it.batt_type}${ship}`;
}
function groupStock(items, category){
  const groups={};
  items.filter(it=>it.category===category).forEach(it=>{
    const key = category==='panel'?`${it.brand}__${it.wattage}`: category==='inverter'?`${it.brand}__${it.kw}__${it.inv_type}`:`${it.brand}__${it.batt_type}`;
    if(!groups[key]) groups[key]={key,category,brand:it.brand,wattage:it.wattage,kw:it.kw,inv_type:it.inv_type,batt_type:it.batt_type,qty:0,value:0};
    groups[key].qty += Number(it.quantity)||0;
    groups[key].value += (Number(it.quantity)||0)*(Number(it.cost)||0);
  });
  return Object.values(groups).sort((a,b)=>b.qty-a.qty);
}
function groupOwnerStock(owner_id, category){
  const items = stock.filter(s=>s.owner_id===owner_id && s.category===category);
  const groups={};
  items.forEach(it=>{
    const key = category==='panel'?`${it.brand}__${it.wattage}`: category==='inverter'?`${it.brand}__${it.kw}__${it.inv_type}`:`${it.brand}__${it.batt_type}`;
    if(!groups[key]) groups[key]={key,category,brand:it.brand,wattage:it.wattage,kw:it.kw,inv_type:it.inv_type,batt_type:it.batt_type,available:0,entries:[]};
    groups[key].available += Number(it.quantity)||0;
    groups[key].entries.push(it);
  });
  return Object.values(groups);
}
function ownerModelMatrix(category){
  const allModels = groupStock(stock, category);
  const perOwner = owners.map(o=>{
    const oGroups = groupStock(stock.filter(s=>s.owner_id===o.id), category);
    const map={}; oGroups.forEach(g=>{map[g.key]=g.qty;});
    return { owner:o, map, total: oGroups.reduce((s,g)=>s+g.qty,0) };
  });
  return { models: allModels, perOwner };
}
function isGatewayItem(it){ return !!it && it.category==='battery' && (it.batt_type==='GW' || (it.brand||'').toLowerCase().includes('gateway')); }
function totalsByCategory(items){
  const t={panel:{qty:0,value:0},inverter:{qty:0,value:0},battery:{qty:0,value:0},gateway:{qty:0,value:0}};
  items.forEach(it=>{
    const bucket = isGatewayItem(it) ? 'gateway' : it.category;
    if(!t[bucket]) return;
    t[bucket].qty += Number(it.quantity)||0;
    t[bucket].value += (Number(it.quantity)||0)*(Number(it.cost)||0);
  });
  return t;
}
function per_pallet(brand){
  const b=(brand||'').trim().toUpperCase();
  if(b.startsWith('JA')) return 36;
  if(b.includes('AIKO')) return 37;
  return null;
}
function panelsPerPalletFor(){
  if(form.model_id){
    const m = models.find(m=>m.id===form.model_id);
    if(m && Number(m.per_pallet)>0) return Number(m.per_pallet);
  }
  return per_pallet(form.brand);
}
function maybeDefaultPanelQty(){
  if(form.category!=='panel') return;
  const pp=panelsPerPalletFor(); if(!pp) return;
  form.quantity = form.pallets ? Number(form.pallets)*pp : pp;
}
function recalcFromPallets(){
  if(form.category!=='panel') return;
  const pp=panelsPerPalletFor();
  if(pp && form.pallets) form.quantity = Number(form.pallets)*pp;
}
function resetEntryFields(){
  form.brand=''; form.wattage=''; form.cost=''; form.kw=''; form.inv_type=''; form.batt_type='';
  form.quantity=''; form.model_id=''; form.pallets='';
  autoAddGateway = true;
}
function isPowerwall3Item(m){ return !!m && m.category==='battery' && (m.batt_type==='PW3' || m.batt_type==='3P'); }
function findGatewayPreset(){ return models.find(m=>m.category==='battery' && (m.batt_type==='GW' || (m.brand||'').toLowerCase().includes('gateway'))); }
const EXTRA_CATS = { job:{icon:'📤',label:'Outgoing stock'}, preset:{icon:'⚙️',label:'Preset model'}, owner:{icon:'👤',label:'Owner'} };
function catMeta(cat){ return CATS[cat] || EXTRA_CATS[cat] || {icon:'📝',label:cat}; }
function movementTypeMeta(type){
  if(type==='in') return { label:'IN', color:'var(--accent2)' };
  if(type==='out') return { label:'OUT', color:'var(--accent)' };
  if(type==='transfer') return { label:'TRANSFER', color:'#3b6ea5' };
  return { label:'ADJUST', color:'#6b7280' };
}
function movementSpec(m){
  if(m.category==='panel') return `${m.brand} · ${m.wattage}W`;
  if(m.category==='inverter') return `${m.brand} · ${m.kw}kW · ${m.inv_type}`;
  if(m.category==='battery') return `${m.brand} · ${m.batt_type}`;
  return m.brand;
}
function movementDetails(m){
  if(m.notes) return m.notes;
  if(m.type==='in') return `Received ${fmt(m.quantity)}x ${m.brand}`;
  if(m.type==='out') return `Issued ${fmt(m.quantity)}x ${m.brand}`;
  if(m.type==='transfer') return `Transferred ${fmt(m.quantity)}x ${m.brand}`;
  return movementSpec(m);
}
function csvEscape(v){ const s=String(v??''); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }

function applyDateRange(items, dateField, range, singleDate, fromDate, toDate){
  if(range==='all') return items;
  const now = new Date();
  return items.filter(it=>{
    const ds = it[dateField] || (it.created_at||'').slice(0,10);
    if(!ds) return false;
    if(range==='week'){ const from=new Date(now); from.setDate(now.getDate()-7); return new Date(ds)>=from; }
    if(range==='fortnight'){ const from=new Date(now); from.setDate(now.getDate()-14); return new Date(ds)>=from; }
    if(range==='month'){ const from=new Date(now); from.setMonth(now.getMonth()-1); return new Date(ds)>=from; }
    if(range==='date'){ return !!singleDate && ds===singleDate; }
    if(range==='between'){ if(fromDate && ds<fromDate) return false; if(toDate && ds>toDate) return false; return true; }
    return true;
  });
}
function applyLimit(items, limit){ return limit==='all' ? items : items.slice(0, Number(limit)); }
function recordControls(prefix, search, limit, range, singleDate, fromDate, toDate, placeholder){
  return `<div class="space-y-2 mb-3">
    <input id="${prefix}-search" value="${search}" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)" placeholder="${placeholder}"/>
    <div class="flex flex-wrap gap-2 items-center">
      <select id="${prefix}-limit" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)">
        <option value="20" ${limit==='20'?'selected':''}>Latest 20</option>
        <option value="50" ${limit==='50'?'selected':''}>Latest 50</option>
        <option value="all" ${limit==='all'?'selected':''}>All</option>
      </select>
      <select id="${prefix}-range" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)">
        <option value="all" ${range==='all'?'selected':''}>Any time</option>
        <option value="week" ${range==='week'?'selected':''}>Last week</option>
        <option value="fortnight" ${range==='fortnight'?'selected':''}>Last fortnight</option>
        <option value="month" ${range==='month'?'selected':''}>Last month</option>
        <option value="date" ${range==='date'?'selected':''}>Specific date</option>
        <option value="between" ${range==='between'?'selected':''}>Date range</option>
      </select>
      ${range==='date'?`<input id="${prefix}-date" type="date" value="${singleDate}" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/>`:''}
      ${range==='between'?`<input id="${prefix}-from" type="date" value="${fromDate}" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/><span class="muted text-sm">to</span><input id="${prefix}-to" type="date" value="${toDate}" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/>`:''}
    </div>
  </div>`;
}

// ---------- CRUD ----------
function applyModel(model_id){
  const m = models.find(m=>m.id===model_id);
  form.model_id = model_id;
  autoAddGateway = true;
  if(!m) return;
  form.brand = m.brand;
  if(m.category==='panel'){ form.wattage=m.wattage; form.cost=m.cost; }
  if(m.category==='inverter'){ form.kw=m.kw; form.inv_type=m.inv_type; form.cost=m.cost; }
  if(m.category==='battery'){ form.batt_type=m.batt_type; form.cost=m.cost; }
  maybeDefaultPanelQty();
}
async function addModel(){
  const m=newModel; if(!m.brand) return;
  const doc={category:m.category, brand:m.brand.trim()};
  if(m.category==='panel'){ doc.wattage=Number(m.wattage)||0; doc.cost=Number(m.cost)||0; doc.per_pallet=Number(m.per_pallet)||0; }
  if(m.category==='inverter'){ doc.kw=Number(m.kw)||0; doc.inv_type=m.inv_type||'—'; doc.cost=Number(m.cost)||0; }
  if(m.category==='battery'){ doc.batt_type=m.batt_type||'—'; doc.cost=Number(m.cost)||0; }
  await sb.from('models').insert(doc);
  newModel={category:m.category,brand:'',wattage:'',cost:'',kw:'',inv_type:'',batt_type:'',per_pallet:''};
  render();
}
async function removeModel(id){ await sb.from('models').delete().eq('id', id); }
async function updateModelField(id, field, value){
  const num=['wattage','cost','kw'].includes(field);
  await sb.from('models').update({[field]: num?Number(value)||0:value}).eq('id', id);
}
async function renameOwner(id, name){ await sb.from('owners').upsert({id, name}); }

function startEditOwner(id){
  const o = owners.find(o=>o.id===id); if(!o) return;
  editOwnerId = id; editOwnerForm = { name:o.name };
  render();
}
function cancelEditOwner(){ editOwnerId=null; render(); }
function requestSaveOwner(){
  const o = owners.find(o=>o.id===editOwnerId); if(!o) return;
  const newName = (editOwnerForm.name||'').trim() || 'Owner';
  if(newName === o.name){ editOwnerId=null; render(); return; }
  confirmOwnerEdit = { id:o.id, oldName:o.name, newName };
  confirmOwnerEditChecked = false;
  render();
}
async function confirmSaveOwner(){
  if(!confirmOwnerEdit || !confirmOwnerEditChecked) return;
  const { id, oldName, newName } = confirmOwnerEdit;
  await sb.from('owners').upsert({ id, name:newName });
  await logMovement('adjust', {category:'owner', brand:`Owner renamed`, quantity:0, owner_id:id}, `Owner renamed: "${oldName}" → "${newName}"`);
  confirmOwnerEdit=null; editOwnerId=null; render();
}
function cancelSaveOwner(){ confirmOwnerEdit=null; render(); }

function requestDeleteOwner(id){ confirmDeleteOwnerId=id; confirmDeleteOwnerChecked=false; render(); }
async function confirmDeleteOwnerAction(){
  if(!confirmDeleteOwnerId || !confirmDeleteOwnerChecked) return;
  const o = owners.find(o=>o.id===confirmDeleteOwnerId);
  await sb.from('owners').delete().eq('id', confirmDeleteOwnerId);
  await logMovement('adjust', {category:'owner', brand:`Owner removed`, quantity:0, owner_id:''}, `Owner removed: "${o?o.name:confirmDeleteOwnerId}"`);
  confirmDeleteOwnerId=null; render();
}

function startEditModel(id){
  const m = models.find(m=>m.id===id); if(!m) return;
  editModelId = id;
  editModelForm = { brand:m.brand, wattage:m.wattage||'', cost:m.cost||'', kw:m.kw||'', inv_type:m.inv_type||'', batt_type:m.batt_type||'', per_pallet:m.per_pallet||'' };
  render();
}
function cancelEditModel(){ editModelId=null; render(); }
function requestSaveModel(){
  const m = models.find(m=>m.id===editModelId); if(!m) return;
  const f = editModelForm;
  const fieldsByCat = { panel:['brand','wattage','cost','per_pallet'], inverter:['brand','kw','inv_type','cost'], battery:['brand','batt_type','cost'] };
  const labels = { brand:'brand', wattage:'wattage', cost:'cost', kw:'kW', inv_type:'type', batt_type:'type', per_pallet:'panels per pallet' };
  const numeric = ['wattage','cost','kw','per_pallet'];
  const relevant = fieldsByCat[m.category];
  const changes=[]; const update={};
  relevant.forEach(field=>{
    let newVal = f[field];
    newVal = numeric.includes(field) ? (Number(newVal)||0) : (newVal||'').toString().trim();
    const oldVal = m[field] ?? (numeric.includes(field)?0:'');
    update[field]=newVal;
    if(String(newVal)!==String(oldVal)) changes.push({ field:labels[field], from: oldVal===''?'—':oldVal, to: newVal===''?'—':newVal });
  });
  if(!changes.length){ editModelId=null; render(); return; }
  confirmModelChanges = { id:m.id, changes, update };
  render();
}
async function confirmSaveModel(){
  if(!confirmModelChanges) return;
  const { id, changes, update } = confirmModelChanges;
  const m = models.find(m=>m.id===id);
  await sb.from('models').update(update).eq('id', id);
  await logMovement('adjust', {category:'preset', brand:`${catMeta(m.category).label} preset "${m.brand}"`, quantity:0, owner_id:''}, `Preset edit: ${changes.map(c=>`${c.field} "${c.from}" → "${c.to}"`).join(', ')}`);
  confirmModelChanges=null; editModelId=null; render();
}
function cancelSaveModel(){ confirmModelChanges=null; render(); }

async function logMovement(type, it, notes, dateOverride){
  await sb.from('movements').insert({
    type, category:it.category, brand:it.brand, wattage:it.wattage||null, kw:it.kw||null,
    inv_type:it.inv_type||null, batt_type:it.batt_type||null, cost:it.cost||0, quantity:Number(it.quantity)||0,
    owner_id: it.owner_id||'', reference: it.reference||'', date: dateOverride || it.shipment_date || new Date().toISOString().slice(0,10),
    notes: notes||'', created_at: new Date().toISOString(), performed_by: session && session.user ? session.user.email : null,
  });
}
function buildDocFromForm(){
  const doc={ category:form.category, brand:form.brand.trim(), quantity:Number(form.quantity), owner_id:batchMeta.owner_id, created_at:new Date().toISOString() };
  if(form.category==='panel'){ doc.wattage=Number(form.wattage)||0; doc.cost=Number(form.cost)||0; doc.shipment_date=batchMeta.date||''; doc.reference=batchMeta.reference.trim(); }
  if(form.category==='inverter'){ doc.kw=Number(form.kw)||0; doc.inv_type=form.inv_type||'—'; doc.cost=Number(form.cost)||0; doc.shipment_date=batchMeta.date||''; doc.reference=batchMeta.reference.trim(); }
  if(form.category==='battery'){ doc.batt_type=form.batt_type||'—'; doc.cost=Number(form.cost)||0; doc.shipment_date=batchMeta.date||''; doc.reference=batchMeta.reference.trim(); }
  return doc;
}
function addToBatch(){
  msg='';
  if(!batchMeta.owner_id || !batchMeta.date){ msg='Select the business owner and date at the top first.'; render(); return; }
  if(!form.model_id || !form.brand){ msg='Select an item first.'; render(); return; }
  if(!form.quantity){ msg='Please enter a quantity.'; render(); return; }
  const selectedModel = models.find(m=>m.id===form.model_id);
  pending.push({ _id:'p'+Date.now()+Math.random(), ...buildDocFromForm() });
  if(form.category==='battery' && isPowerwall3Item(selectedModel) && autoAddGateway){
    const gw = findGatewayPreset();
    if(gw){
      pending.push({ _id:'p'+Date.now()+Math.random()+'g', category:'battery', brand:gw.brand,
        batt_type:gw.batt_type||'—', cost:Number(gw.cost)||0, quantity:Number(form.quantity)||1, owner_id:batchMeta.owner_id,
        shipment_date:batchMeta.date, reference:batchMeta.reference.trim(), created_at:new Date().toISOString(),
        _auto:'Bundled with PW3' });
      msg = `Added — ${form.quantity}x Tesla Gateway was included automatically.`;
    }
  }
  form={ category:form.category, brand:'', wattage:'', cost:'', kw:'', inv_type:'', batt_type:'', quantity:'', model_id:'', pallets:'' };
  render();
}
function removeFromBatch(id){ pending=pending.filter(p=>p._id!==id); render(); }
function startEditPending(id){
  const p = pending.find(p=>p._id===id); if(!p) return;
  editPendingId = id;
  editPendingForm = { quantity:p.quantity, owner_id:p.owner_id, shipment_date:p.shipment_date||'', reference:p.reference||'' };
  render();
}
function cancelEditPending(){ editPendingId=null; render(); }
function saveEditPending(){
  const idx = pending.findIndex(p=>p._id===editPendingId); if(idx===-1) return;
  const f = editPendingForm;
  pending[idx] = { ...pending[idx], quantity:Number(f.quantity)||0, owner_id:f.owner_id, shipment_date:f.shipment_date, reference:(f.reference||'').trim() };
  editPendingId=null;
  render();
}
async function saveBatch(){
  if(!pending.length){ msg='Add at least one item to the batch first.'; render(); return; }
  for(const item of pending){
    const { _id, _auto, ...doc } = item;
    await sb.from('stock').insert(doc);
    const note = _auto ? `Auto-added ${fmt(doc.quantity)}x ${doc.brand} (${_auto})` : `Received ${fmt(doc.quantity)}x ${doc.brand}`;
    await logMovement('in', doc, note);
  }
  msg = `${pending.length} item${pending.length>1?'s':''} added to stock.`;
  pending=[];
  batchMeta = { owner_id:'', date:new Date().toISOString().slice(0,10), reference:'' };
  render();
}
async function removeItem(id){
  const it = stock.find(s=>s.id===id);
  await sb.from('stock').delete().eq('id', id);
  if(it) await logMovement('out', it, 'Manual removal');
}

function startEditStock(id){
  const it = stock.find(s=>s.id===id); if(!it) return;
  editStockId = id;
  editStockForm = { brand:it.brand, quantity:it.quantity, owner_id:it.owner_id,
    wattage:it.wattage||'', cost:it.cost||'', kw:it.kw||'', inv_type:it.inv_type||'', batt_type:it.batt_type||'',
    shipment_date:it.shipment_date||'', reference:it.reference||'' };
  render();
}
function cancelEditStock(){ editStockId=null; render(); }
async function saveEditStock(){
  const it = stock.find(s=>s.id===editStockId); if(!it) return;
  const f = editStockForm;
  const fieldLabels = { brand:'brand', quantity:'quantity', owner_id:'owner', wattage:'wattage', cost:'cost', kw:'kW', inv_type:'type', batt_type:'type', shipment_date:'date received', reference:'reference' };
  const relevant = ['brand','quantity','owner_id','cost','shipment_date','reference',
    ...(it.category==='panel'?['wattage']:it.category==='inverter'?['kw','inv_type']:['batt_type'])];
  const changes = [];
  const update = {};
  relevant.forEach(field=>{
    let newVal = f[field];
    if(['quantity','wattage','cost','kw'].includes(field)) newVal = Number(newVal)||0;
    const oldVal = it[field] ?? (typeof newVal==='number'?0:'');
    update[field] = newVal;
    if(String(newVal) !== String(oldVal)){
      changes.push({ field: fieldLabels[field], from: field==='owner_id'?ownerName(oldVal):(oldVal===''?'—':oldVal), to: field==='owner_id'?ownerName(newVal):(newVal===''?'—':newVal) });
    }
  });
  if(!changes.length){ editStockId=null; render(); return; }
  await sb.from('stock').update(update).eq('id', it.id);
  await logMovement('adjust', {...it, ...update}, `Admin edit: ${changes.map(c=>`${c.field} "${c.from}" → "${c.to}"`).join(', ')}`);
  editStockId=null;
  render();
}

function allOwnerGroups(owner_id){
  if(!owner_id) return [];
  return ['panel','inverter','battery'].flatMap(cat=>groupOwnerStock(owner_id, cat));
}
function openTransfer(){
  transferOpen=true; transferMsg='';
  transferForm={ from_owner_id:'', category:'panel', itemKey:'', qty:'', to_owner_id:'', reference:'', date:new Date().toISOString().slice(0,10) };
  render();
}
function closeTransfer(){ transferOpen=false; render(); }
async function submitTransfer(){
  transferMsg='';
  const f = transferForm;
  if(!f.from_owner_id || !f.to_owner_id){ transferMsg='Select both a from and to owner.'; render(); return; }
  if(f.from_owner_id===f.to_owner_id){ transferMsg='From and to owners must be different.'; render(); return; }
  if(!f.itemKey){ transferMsg='Select an item to transfer.'; render(); return; }
  if(!f.date){ transferMsg='Select a date.'; render(); return; }
  const qty = Number(f.qty)||0;
  if(qty<=0){ transferMsg='Enter a quantity to transfer.'; render(); return; }
  const group = groupOwnerStock(f.from_owner_id, f.category).find(g=>g.key===f.itemKey);
  if(!group || qty>group.available){ transferMsg='Not enough stock available for this item.'; render(); return; }

  let remaining = qty;
  const sortedEntries = [...group.entries].sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||''));
  const repCost = sortedEntries[0]?.cost || 0;
  for(const entry of sortedEntries){
    if(remaining<=0) break;
    const take = Math.min(remaining, Number(entry.quantity)||0);
    remaining -= take;
    const left = (Number(entry.quantity)||0) - take;
    if(left<=0) await sb.from('stock').delete().eq('id', entry.id);
    else await sb.from('stock').update({quantity:left}).eq('id', entry.id);
  }
  const newDoc = { category:f.category, brand:group.brand, quantity:qty, owner_id:f.to_owner_id, cost:repCost,
    shipment_date:f.date, reference:f.reference.trim(), created_at:new Date().toISOString() };
  if(f.category==='panel') newDoc.wattage = group.wattage||0;
  if(f.category==='inverter'){ newDoc.kw = group.kw||0; newDoc.inv_type = group.inv_type||'—'; }
  if(f.category==='battery') newDoc.batt_type = group.batt_type||'—';
  await sb.from('stock').insert(newDoc);
  await logMovement('transfer', {category:f.category, brand:group.brand, wattage:group.wattage, kw:group.kw, inv_type:group.inv_type, batt_type:group.batt_type, quantity:qty, owner_id:f.to_owner_id, reference:f.reference.trim()}, `Transferred from ${ownerName(f.from_owner_id)} to ${ownerName(f.to_owner_id)}`, f.date);

  transferOpen=false;
  invMsg = `Transferred ${fmt(qty)} item(s) from ${ownerName(f.from_owner_id)} to ${ownerName(f.to_owner_id)}.`;
  render();
}
async function downloadStockCsv(){
  const q = invSearch.trim().toLowerCase();
  const byOwner = ownerFilter==='all' ? stock : stock.filter(s=>s.owner_id===ownerFilter);
  const byCategory = invCategoryFilter==='all' ? byOwner : byOwner.filter(s=>s.category===invCategoryFilter);
  let filtered = !q ? byCategory : byCategory.filter(it=>{
    const hay=[it.brand, it.category, it.wattage, it.kw, it.inv_type, it.batt_type, it.reference, ownerName(it.owner_id)].join(' ').toLowerCase();
    return hay.includes(q);
  });
  filtered = applyDateRange(filtered, 'shipment_date', invRange, invDate, invFrom, invTo);
  const header=['Category','Brand','Spec','Quantity','Owner','Unit cost','Total value','Date received','Reference'];
  const rows=filtered.map(it=>[ CATS[it.category].label, it.brand,
    it.category==='panel'?`${it.wattage}W`: it.category==='inverter'?`${it.kw}kW · ${it.inv_type}`:`${it.batt_type}`,
    it.quantity, ownerName(it.owner_id), it.cost||0, (Number(it.quantity)||0)*(Number(it.cost)||0), fmtDate(it.shipment_date), it.reference||'' ]);
  const csv=[header,...rows].map(r=>r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `stock-snapshot-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  invMsg='CSV downloaded.';
  render();
}

function buildJobLines(owner_id, f, msgSetter){
  const lines=[];
  for(const [cat,keyField,qtyField] of [['panel','panelKey','panelQty'],['inverter','inverterKey','inverterQty'],['battery','batteryKey','batteryQty']]){
    const key=f[keyField], qty=Number(f[qtyField])||0;
    if(!key || qty<=0) continue;
    const g = groupOwnerStock(owner_id, cat).find(g=>g.key===key);
    if(!g || qty>g.available){ msgSetter(`Not enough ${cat} stock for this owner to cover the quantity entered.`); return null; }
    lines.push({category:cat, group:g, qty});
  }
  if(lines.length===0){ msgSetter('Add at least one item used (panel, inverter or battery).'); return null; }
  // auto-add Tesla Gateway when a Powerwall 3 / 3P is used
  const pwLine = lines.find(l=>l.category==='battery' && (l.group.batt_type==='PW3'||l.group.batt_type==='3P'));
  if(pwLine && f.autoGateway){
    const gwGroup = groupOwnerStock(owner_id,'battery').find(g=>g.batt_type==='GW' || (g.brand||'').toLowerCase().includes('gateway'));
    if(gwGroup && !lines.some(l=>l.group.key===gwGroup.key)){
      if(gwGroup.available >= pwLine.qty) lines.push({category:'battery', group:gwGroup, qty:pwLine.qty});
    }
  }
  return lines;
}
async function deductLines(owner_id, lines){
  for(const line of lines){
    let remaining=line.qty;
    const sorted=[...line.group.entries].sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||''));
    for(const entry of sorted){
      if(remaining<=0) break;
      const take=Math.min(remaining, Number(entry.quantity)||0);
      remaining-=take;
      const left=(Number(entry.quantity)||0)-take;
      if(left<=0) await sb.from('stock').delete().eq('id', entry.id);
      else await sb.from('stock').update({quantity:left}).eq('id', entry.id);
    }
  }
}
function requestCreateJob(){
  jobMsg='';
  if(!jobForm.owner_id){ jobMsg='Select an owner for this job.'; render(); return; }
  const lines = buildJobLines(jobForm.owner_id, jobForm, m=>{ jobMsg=m; });
  if(!lines){ render(); return; }
  confirmCreateJob = { lines };
  render();
}
async function confirmCreateJobAction(){
  if(!confirmCreateJob) return;
  const lines = confirmCreateJob.lines;
  await deductLines(jobForm.owner_id, lines);
  await sb.from('jobs').insert({
    owner_id: jobForm.owner_id, date: jobForm.date || new Date().toISOString().slice(0,10),
    installation_date: jobForm.installation_date||'', reference: jobForm.reference.trim(),
    notes: jobForm.notes.trim(),
    items: lines.map(l=>({category:l.category, brand:l.group.brand, wattage:l.group.wattage||null, kw:l.group.kw||null, inv_type:l.group.inv_type||null, batt_type:l.group.batt_type||null, quantity:l.qty})),
    created_at: new Date().toISOString(), performed_by: session && session.user ? session.user.email : null,
  });
  for(const line of lines){
    await logMovement('out', {category:line.category, brand:line.group.brand, wattage:line.group.wattage, kw:line.group.kw, inv_type:line.group.inv_type, batt_type:line.group.batt_type, quantity:line.qty, owner_id:jobForm.owner_id}, jobForm.notes.trim()||'Job usage', jobForm.date);
  }
  jobForm={ owner_id:jobForm.owner_id, date:new Date().toISOString().slice(0,10), installation_date:'', reference:'', notes:'', panelKey:'', panelQty:'', inverterKey:'', inverterQty:'', batteryKey:'', batteryQty:'', autoGateway:true };
  jobMsg='Outgoing stock logged and levels updated.';
  confirmCreateJob=null;
  render();
}
function cancelCreateJob(){ confirmCreateJob=null; render(); }

async function startEditJob(id){
  const j=jobs.find(j=>j.id===id); if(!j) return;
  // return the job's original items to stock so the picker shows true availability while editing
  for(const it of (j.items||[])){
    const doc = { category:it.category, brand:it.brand, quantity:it.quantity, owner_id:j.owner_id, cost:0, created_at:new Date().toISOString() };
    if(it.category==='panel') doc.wattage = it.wattage||0;
    if(it.category==='inverter'){ doc.kw = it.kw||0; doc.inv_type = it.inv_type||'—'; }
    if(it.category==='battery') doc.batt_type = it.batt_type||'—';
    await sb.from('stock').insert(doc);
  }
  editJobId=id;
  editJobForm={ owner_id:j.owner_id, date:j.date||(j.created_at||'').slice(0,10), installation_date:j.installation_date||'', reference:j.reference||'', notes:j.notes||'', reason:'',
    panelKey:'', panelQty:'', inverterKey:'', inverterQty:'', batteryKey:'', batteryQty:'', autoGateway:false };
  render();
}
async function cancelEditJob(){
  const j = jobs.find(j=>j.id===editJobId);
  if(j){
    const lines = (j.items||[]).map(it=>{
      const g = groupOwnerStock(j.owner_id, it.category).find(g=>g.brand===it.brand && g.wattage===it.wattage && g.kw===it.kw && g.inv_type===it.inv_type && g.batt_type===it.batt_type);
      return g ? {category:it.category, group:g, qty:it.quantity} : null;
    }).filter(Boolean);
    await deductLines(j.owner_id, lines);
  }
  editJobId=null;
  render();
}
function requestSaveJobEdit(){
  if(!editJobForm.reason || !editJobForm.reason.trim()){ jobMsg='Please enter a reason for this update.'; render(); return; }
  const lines = buildJobLines(editJobForm.owner_id, editJobForm, m=>{ jobMsg=m; });
  if(!lines){ render(); return; }
  confirmEditJob = { lines };
  render();
}
async function confirmSaveJobEdit(){
  if(!confirmEditJob) return;
  const j = jobs.find(j=>j.id===editJobId); if(!j){ confirmEditJob=null; return; }
  const lines = confirmEditJob.lines;
  await deductLines(editJobForm.owner_id, lines);
  const changes=[];
  if(editJobForm.owner_id!==j.owner_id) changes.push({field:'owner', from:ownerName(j.owner_id), to:ownerName(editJobForm.owner_id)});
  if(editJobForm.date!==(j.date||'')) changes.push({field:'date', from:fmtDate(j.date)||'—', to:fmtDate(editJobForm.date)});
  if(editJobForm.installation_date!==(j.installation_date||'')) changes.push({field:'installation date', from:fmtDate(j.installation_date)||'—', to:fmtDate(editJobForm.installation_date)||'—'});
  if(editJobForm.reference.trim()!==(j.reference||'')) changes.push({field:'reference', from:j.reference||'—', to:editJobForm.reference.trim()||'—'});
  if(editJobForm.notes.trim()!==(j.notes||'')) changes.push({field:'notes', from:j.notes||'—', to:editJobForm.notes.trim()||'—'});
  changes.push({field:'items', from:'previous items', to:'updated items'});
  await sb.from('jobs').update({
    owner_id:editJobForm.owner_id, date:editJobForm.date, installation_date:editJobForm.installation_date,
    reference:editJobForm.reference.trim(), notes:editJobForm.notes.trim(),
    items: lines.map(l=>({category:l.category, brand:l.group.brand, wattage:l.group.wattage||null, kw:l.group.kw||null, inv_type:l.group.inv_type||null, batt_type:l.group.batt_type||null, quantity:l.qty})),
  }).eq('id', j.id);
  for(const line of lines){
    await logMovement('out', {category:line.category, brand:line.group.brand, wattage:line.group.wattage, kw:line.group.kw, inv_type:line.group.inv_type, batt_type:line.group.batt_type, quantity:line.qty, owner_id:editJobForm.owner_id}, `Job edit: ${editJobForm.reason.trim()}`, editJobForm.date);
  }
  await logMovement('adjust', {category:'job', brand:`Outgoing stock for ${ownerName(editJobForm.owner_id)}`, quantity:0, owner_id:editJobForm.owner_id}, `Job edit — reason: ${editJobForm.reason.trim()} — ${changes.map(c=>`${c.field} "${c.from}" → "${c.to}"`).join(', ')}`, editJobForm.date);
  editJobId=null; confirmEditJob=null;
  render();
}
function cancelSaveJobEdit(){ confirmEditJob=null; render(); }
async function downloadCsv(){
  const q = logSearch.trim().toLowerCase();
  let filtered = !q ? movements : movements.filter(m=>{
    const hay=[m.brand, m.category, m.type, movementSpec(m), m.reference, m.notes, ownerName(m.owner_id)].join(' ').toLowerCase();
    return hay.includes(q);
  });
  filtered = applyDateRange(filtered, 'date', logRange, logDate, logFrom, logTo);
  const header = ['Date','Type','Category','Brand','Spec','Quantity','Owner','Unit cost','Reference','Notes','By'];
  const rows = filtered.map(m=>[
    fmtDate(m.date) || fmtDate((m.created_at||'').slice(0,10)), movementTypeMeta(m.type).label, catMeta(m.category).label, m.brand,
    movementSpec(m), m.quantity, ownerName(m.owner_id), m.cost||0, m.reference||'', m.notes||'', m.performed_by||'',
  ]);
  const csv = [header, ...rows].map(r=>r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `stock-log-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  logMsg = 'CSV downloaded.';
  render();
}

async function resetAllData(){
  for(const s of stock) await sb.from('stock').delete().eq('id', s.id);
  for(const m of models) await sb.from('models').delete().eq('id', m.id);
  for(const j of jobs) await sb.from('jobs').delete().eq('id', j.id);
  for(const mv of movements) await sb.from('movements').delete().eq('id', mv.id);
  for(const o of owners) await sb.from('owners').delete().eq('id', o.id);
  seeded=false;
  await seedOwnersIfNeeded();
  tab='dashboard'; ownerFilter='all'; dashScope='global'; breakdownCat='panel';
  dashExpanded={panel:false,inverter:false,battery:false};
  form={ category:'panel', brand:'', wattage:'', cost:'', kw:'', inv_type:'', batt_type:'', quantity:'', model_id:'', pallets:'' };
  batchMeta = { owner_id:'', date:new Date().toISOString().slice(0,10), reference:'' };
  autoAddGateway = true;
  pending=[]; editPendingId=null; editPendingForm={};
  newModel={ category:'panel', brand:'', wattage:'', cost:'', kw:'', inv_type:'', batt_type:'', per_pallet:'' };
  jobForm={ owner_id:'', date:new Date().toISOString().slice(0,10), installation_date:'', reference:'', notes:'', panelKey:'', panelQty:'', inverterKey:'', inverterQty:'', batteryKey:'', batteryQty:'', autoGateway:true };
  editJobId=null; editJobForm={ owner_id:'', date:'', installation_date:'', reference:'', notes:'', reason:'' };
  confirmCreateJob=null; confirmEditJob=null;
  editStockId=null; transferOpen=false; transferMsg=''; msg=''; jobMsg=''; logMsg=''; invMsg='';
  editOwnerId=null; editOwnerForm={name:''}; confirmOwnerEdit=null; confirmOwnerEditChecked=false;
  confirmDeleteOwnerId=null; confirmDeleteOwnerChecked=false; editModelId=null; confirmModelChanges=null;
  stockInSearch=''; stockInLimit='20'; stockInRange='all'; stockInDate=''; stockInFrom=''; stockInTo='';
  jobSearch=''; jobLimit='20'; jobRange='all'; jobDate=''; jobFrom=''; jobTo='';
  invSearch=''; invCategoryFilter='all'; invLimit='all'; invRange='all'; invDate=''; invFrom=''; invTo='';
  logSearch=''; logLimit='20'; logRange='all'; logDate=''; logFrom=''; logTo='';
  confirmResetOpen=false; confirmResetChecked=false;
  render();
}

// ---------- render ----------
function render(){
  const el = $('#app');
  if(!session){
    el.innerHTML = loginScreen();
    wireLogin();
    return;
  }
  el.innerHTML = `
  <div class="flex flex-col md:flex-row md:min-h-screen">
    <aside class="md:w-60 md:flex-shrink-0 p-4 border-b md:border-b-0 md:border-r" style="border-color:var(--border)">
      ${header()}
      ${sidebarNav()}
    </aside>
    <main class="flex-1 px-4 py-6 pb-20 max-w-5xl w-full">
      ${tab==='dashboard'?dashboard():''}
      ${tab==='add'?addForm():''}
      ${tab==='jobs'?jobsView():''}
      ${tab==='inventory'?inventory():''}
      ${tab==='log'?logView():''}
      ${tab==='admin'?adminView():''}
    </main>
  </div>
  ${confirmDeleteModal()}${confirmResetModal()}${confirmModelChangesModal()}${confirmOwnerEditModal()}${confirmDeleteOwnerModal()}${transferModal()}${confirmCreateJobModal()}${confirmEditJobModal()}`;
  wire();
}

function confirmDeleteModal(){
  if(!confirmDeleteModelId) return '';
  const m = models.find(m=>m.id===confirmDeleteModelId);
  if(!m){ confirmDeleteModelId=null; return ''; }
  return `<div class="fixed inset-0 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);z-index:50">
    <div class="card p-5 w-full max-w-sm">
      <h3 class="font-semibold mb-2">Remove this preset?</h3>
      <p class="muted text-sm mb-4">${CATS[m.category].icon} ${modelLabel(m)} will be permanently removed from the stock master fields. This doesn't affect stock already recorded, but it can't be undone.</p>
      <label class="flex items-start gap-2 text-sm mb-4">
        <input id="confirm-checkbox" type="checkbox" class="mt-0.5" ${confirmDeleteChecked?'checked':''}/>
        <span>I understand this preset will be permanently removed.</span>
      </label>
      <div class="flex gap-2">
        <button id="confirm-yes" ${confirmDeleteChecked?'':'disabled'} class="px-4 py-2 rounded-lg font-medium text-white text-sm ${confirmDeleteChecked?'':'opacity-50 cursor-not-allowed'}" style="background:#b3413a">Yes, remove it</button>
        <button id="confirm-no" class="px-4 py-2 rounded-lg text-sm border" style="border-color:var(--border)">No, keep it</button>
      </div>
    </div>
  </div>`;
}
function confirmResetModal(){
  if(!confirmResetOpen) return '';
  return `<div class="fixed inset-0 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);z-index:50">
    <div class="card p-5 w-full max-w-sm">
      <h3 class="font-semibold mb-2">Reset all data?</h3>
      <p class="muted text-sm mb-4">This permanently deletes every stock entry, preset model, outgoing stock job and log entry, and resets the owners back to "Owner 1"–"Owner 5". This cannot be undone.</p>
      <label class="flex items-start gap-2 text-sm mb-4">
        <input id="reset-checkbox" type="checkbox" class="mt-0.5" ${confirmResetChecked?'checked':''}/>
        <span>I understand this will permanently erase all data and cannot be undone.</span>
      </label>
      <div class="flex gap-2">
        <button id="reset-yes" ${confirmResetChecked?'':'disabled'} class="px-4 py-2 rounded-lg font-medium text-white text-sm ${confirmResetChecked?'':'opacity-50 cursor-not-allowed'}" style="background:#b3413a">Yes, reset everything</button>
        <button id="reset-no" class="px-4 py-2 rounded-lg text-sm border" style="border-color:var(--border)">No, keep my data</button>
      </div>
    </div>
  </div>`;
}
function confirmModelChangesModal(){
  if(!confirmModelChanges) return '';
  const { changes } = confirmModelChanges;
  return `<div class="fixed inset-0 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);z-index:50">
    <div class="card p-5 w-full max-w-sm">
      <h3 class="font-semibold mb-2">Save these changes?</h3>
      <ul class="text-sm muted mb-4 space-y-1">${changes.map(c=>`<li>${c.field}: "${c.from}" → "${c.to}"</li>`).join('')}</ul>
      <div class="flex gap-2">
        <button id="modelchange-yes" class="px-4 py-2 rounded-lg font-medium text-white text-sm" style="background:var(--accent)">Yes, save changes</button>
        <button id="modelchange-no" class="px-4 py-2 rounded-lg text-sm border" style="border-color:var(--border)">No, go back</button>
      </div>
    </div>
  </div>`;
}
function confirmOwnerEditModal(){
  if(!confirmOwnerEdit) return '';
  const { oldName, newName } = confirmOwnerEdit;
  return `<div class="fixed inset-0 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);z-index:50">
    <div class="card p-5 w-full max-w-sm">
      <h3 class="font-semibold mb-2">Save this change?</h3>
      <p class="muted text-sm mb-4">Rename "${oldName}" to "${newName}".</p>
      <label class="flex items-start gap-2 text-sm mb-4">
        <input id="ownerchange-checkbox" type="checkbox" class="mt-0.5" ${confirmOwnerEditChecked?'checked':''}/>
        <span>I understand this will update the owner name everywhere it's used.</span>
      </label>
      <div class="flex gap-2">
        <button id="ownerchange-yes" ${confirmOwnerEditChecked?'':'disabled'} class="px-4 py-2 rounded-lg font-medium text-white text-sm ${confirmOwnerEditChecked?'':'opacity-50 cursor-not-allowed'}" style="background:var(--accent)">Yes, save change</button>
        <button id="ownerchange-no" class="px-4 py-2 rounded-lg text-sm border" style="border-color:var(--border)">No, go back</button>
      </div>
    </div>
  </div>`;
}
function confirmDeleteOwnerModal(){
  if(!confirmDeleteOwnerId) return '';
  const o = owners.find(o=>o.id===confirmDeleteOwnerId);
  if(!o){ confirmDeleteOwnerId=null; return ''; }
  return `<div class="fixed inset-0 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);z-index:50">
    <div class="card p-5 w-full max-w-sm">
      <h3 class="font-semibold mb-2">Remove this owner?</h3>
      <p class="muted text-sm mb-4">"${o.name}" will be permanently removed. Their existing stock, job and log records will remain but show no owner name. This can't be undone.</p>
      <label class="flex items-start gap-2 text-sm mb-4">
        <input id="ownerdel-checkbox" type="checkbox" class="mt-0.5" ${confirmDeleteOwnerChecked?'checked':''}/>
        <span>I understand this owner will be permanently removed.</span>
      </label>
      <div class="flex gap-2">
        <button id="ownerdel-yes" ${confirmDeleteOwnerChecked?'':'disabled'} class="px-4 py-2 rounded-lg font-medium text-white text-sm ${confirmDeleteOwnerChecked?'':'opacity-50 cursor-not-allowed'}" style="background:#b3413a">Yes, remove it</button>
        <button id="ownerdel-no" class="px-4 py-2 rounded-lg text-sm border" style="border-color:var(--border)">No, keep it</button>
      </div>
    </div>
  </div>`;
}
function transferModal(){
  if(!transferOpen) return '';
  const f = transferForm;
  const fromGroups = allOwnerGroups(f.from_owner_id);
  const selectedGroup = f.itemKey ? fromGroups.find(g=>g.category===f.category && g.key===f.itemKey) : null;
  return `<div class="fixed inset-0 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);z-index:50">
    <div class="card p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
      <h3 class="font-semibold mb-3">Transfer stock between owners</h3>
      ${transferMsg? `<div class="mb-3 text-sm px-3 py-2 rounded-lg" style="background:#b3413a;color:#fff">${transferMsg}</div>`:''}
      <div class="space-y-3">
        <div><label class="text-sm muted">From owner (providing the stock)</label>
          <select id="tr-from" class="w-full mt-1 p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)">
            <option value="">Select owner</option>
            ${owners.map(o=>`<option value="${o.id}" ${f.from_owner_id===o.id?'selected':''}>${o.name}</option>`).join('')}
          </select></div>

        ${f.from_owner_id ? `
        <div><label class="text-sm muted">Item</label>
          <select id="tr-item" class="w-full mt-1 p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)">
            <option value="">${fromGroups.length? 'Select an item…' : 'No stock available for this owner'}</option>
            ${fromGroups.map(g=>`<option value="${g.category}|${g.key}" ${(f.category===g.category&&f.itemKey===g.key)?'selected':''}>${catMeta(g.category).icon} ${modelLabel(g)} (available: ${fmt(g.available)})</option>`).join('')}
          </select></div>` : ''}

        ${selectedGroup ? `
        <div class="p-2 rounded-lg text-sm muted" style="border:1px solid var(--border)">Available from ${ownerName(f.from_owner_id)}: ${fmt(selectedGroup.available)}</div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-sm muted">Quantity to transfer</label><input id="tr-qty" type="number" value="${f.qty}" class="w-full mt-1 p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>
          <div><label class="text-sm muted">To owner</label>
            <select id="tr-to" class="w-full mt-1 p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)">
              <option value="">Select owner</option>
              ${owners.filter(o=>o.id!==f.from_owner_id).map(o=>`<option value="${o.id}" ${f.to_owner_id===o.id?'selected':''}>${o.name}</option>`).join('')}
            </select></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-sm muted">Date</label><input id="tr-date" type="date" value="${f.date}" class="w-full mt-1 p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>
          <div><label class="text-sm muted">Reference</label><input id="tr-reference" value="${f.reference}" class="w-full mt-1 p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)" placeholder="optional"/></div>
        </div>` : ''}

        <div class="flex gap-2 pt-2">
          <button id="tr-submit" class="px-4 py-2 rounded-lg font-medium text-white text-sm" style="background:var(--accent)">Transfer stock</button>
          <button id="tr-cancel" class="px-4 py-2 rounded-lg text-sm border" style="border-color:var(--border)">Cancel</button>
        </div>
      </div>
    </div>
  </div>`;
}
function header(){
  return `<div class="mb-5">
    <div class="flex items-center gap-2 mb-3 flex-wrap">
      <img src="data:image/png;base64,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" alt="PowerPlus" class="h-7 bg-white rounded-md px-2 py-1"/>
      <img src="data:image/png;base64,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n+SLX2Z6ZJpu+maz5gADG6VTSRIkhIVgMPxa1X5khutFwg2jo6PbZrVLRP+FL7RrYx0ZGbsZwM2VSmWTavYqGl9twKlB5BBIwxbTtjXAOG1EmgFTj2FnTsoCQvLwlOIDuci9XxXXm9nXx8bG7mw6r4aXfLkXD4+q6sOAZaptjLeGRCEyVU1EMLGM5zwVA79z585dO3fu/CyALwyXSi9VwcUAziPlKDLPhVosEM0Ipc0IFGguhdY8ZgSAsGg9GKCmOyza9Qp+qViQNsv+uIDofFjVVptZLr5bsOnsa1XVQPJ37RqJbGpbQ7JoBopZr9GQKTQBlq1tjyQpQq6aM3MFm9UiAdrCC7K55OViBSTa2azKlr5PSEJM1/h07jjOYn6kg5k542IrlcoxMcbniOB5Zng2gM2kDRJyKMmWrWa5UobBfgtDDcQvzexuMtyZZdlPJyYmHp11Lo3NUwfSbuPQJKIAAGmabgbwIkDPIvkcAMeQfNo+lWJtfk+TmcHUIoCqAfeK4Icx4paNG8fuvuuuqQpwjbLPK2nTsGXLltDtQbZu3aortABq2HCq/YaGho4IAWcAcq6ZnUHgWArXztt+s34v2m6vAb8i8X9J3FCv681N42Gf71yAgS1btrAH9m1tg97+2bYEYKVS6eQQ7MgYaSHY4jbLmlwi2SwXSTaHuyTr0oXSyd9HGoIxy3DP+Pj4r9GbEheO47jgPaDt0BCc+0w8W7ZsWfX4449vGCBLkRwkdSOAdQDXAjjMzAaQe3HrAJ40sycA7ARkHMAYybFqtbp9jglVmgSZHuA2bo6bnTEhpWlaIrkJiJvMUAE4SKKwLZLCNrvNsIu0RwCMAbJNVbcNDAyMjoyM7J71XQmmH887vR0jmG3XTZs2HBVjeKYZN6vaMMAhEoeb4TAAgURmxt8CuoPGEQEeUJH7q9XqQ7P6fZjr+I7jOI7jgnfpxFnjoV8vxWho8kAcaJ7cTsRvr0Rpv9u1F+PM+ux6GmOk2ywXDZHbabv16h5mB0HbygF8zz+Y76eO47jg7amdOqnXNDs7rN+QF19gLCQEZj8gd7v2nwD2tnMcx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Ecx3Gchfj/KqbeyQnnU2IAAAAASUVORK5CYII=" alt="Harrisons Solar" class="h-7 bg-white rounded-md px-2 py-1"/>
    </div>
    <h1 class="text-lg font-bold leading-tight">Solar Stock Manager</h1>
    <p class="muted text-xs">${session && session.user ? session.user.email : ''}</p>
  </div>
  <button id="logout-btn" class="text-xs muted hover:opacity-70 mb-4">Sign out</button>`;
}
function loginScreen(){
  return `<div class="min-h-screen flex items-center justify-center px-4">
    <div class="card p-6 w-full max-w-sm">
      <div class="text-3xl mb-2">🔋</div>
      <h1 class="text-lg font-bold mb-1">Solar Stock Manager</h1>
      <p class="muted text-sm mb-5">Sign in to view and manage warehouse stock.</p>
      ${loginError? `<div class="mb-4 text-sm px-3 py-2 rounded-lg" style="background:#b3413a;color:#fff">${loginError}</div>`:''}
      <div class="space-y-3">
        <div><label class="text-sm muted">Email</label>
          <input id="login-email" type="email" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)" placeholder="you@company.com"/></div>
        <div><label class="text-sm muted">Password</label>
          <input id="login-password" type="password" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)"/></div>
        <button id="login-submit" class="w-full py-2.5 rounded-lg font-medium text-white" style="background:var(--accent)">Sign in</button>
      </div>
      <p class="muted text-xs mt-4">Accounts are created by an admin in the Supabase dashboard — there's no public sign-up.</p>
    </div>
  </div>`;
}
function wireLogin(){
  const submit=$('#login-submit');
  const doLogin=()=>login($('#login-email').value.trim(), $('#login-password').value);
  if(submit) submit.onclick=doLogin;
  const pw=$('#login-password'); if(pw) pw.onkeydown=(e)=>{ if(e.key==='Enter') doLogin(); };
}
function sidebarNav(){
  const tabs=[['dashboard','📊','Dashboard'],['add','➕','Add Stock'],['jobs','📤','Outgoing Stock'],['inventory','📦','All Stock'],['log','🧾','Log'],['admin','⚙️','Admin']];
  return `<nav class="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
    ${tabs.map(([k,icon,l])=>`<button data-tab="${k}" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left whitespace-nowrap ${tab===k?'tab-active':'hover:opacity-80'}"><span>${icon}</span><span>${l}</span></button>`).join('')}
  </nav>`;
}
function statCard(icon,label,value,sub){
  return `<div class="card p-4"><div class="flex items-center justify-between"><span class="text-2xl">${icon}</span><span class="text-xs muted">${sub||''}</span></div>
    <div class="text-2xl font-bold mt-2">${value}</div><div class="muted text-sm">${label}</div></div>`;
}
function expandStatCard(key,icon,label,value,sub,footnote){
  const open = dashExpanded[key];
  return `<button data-expand="${key}" class="card p-4 text-left w-full hover:opacity-90">
    <div class="flex items-center justify-between"><span class="text-2xl">${icon}</span><span class="text-xs muted">${sub||''}</span></div>
    <div class="text-2xl font-bold mt-2">${value}</div>
    <div class="muted text-sm flex items-center justify-between">${label}<span class="text-xs">${open?'▲ hide':'▼ details'}</span></div>
    ${footnote?`<div class="muted text-xs mt-1">${footnote}</div>`:''}
  </button>`;
}

function dashboard(){
  const scoped = dashScope==='global' ? stock : stock.filter(s=>s.owner_id===dashScope);
  const g = totalsByCategory(scoped);
  const scopeLabel = dashScope==='global' ? 'All owners (global)' : ownerName(dashScope);
  const breakdownTable=(cat)=>{
    const rows=groupStock(scoped, cat);
    if(!rows.length) return `<p class="muted text-sm py-2">No ${CATS[cat].label.toLowerCase()} in stock${dashScope==='global'?'':' for this owner'}.</p>`;
    return `<table class="w-full text-sm"><thead><tr class="text-left muted"><th class="p-2">Model</th><th class="p-2">Qty</th><th class="p-2">Value</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td class="p-2">${modelLabel(r)}</td><td class="p-2">${fmt(r.qty)}</td><td class="p-2">${money(r.value)}</td></tr>`).join('')}</tbody></table>`;
  };
  return `
  <div class="flex gap-2 mb-5 flex-wrap">
    <button data-scope="global" class="px-3 py-1.5 rounded-full text-sm font-medium ${dashScope==='global'?'tab-active':'card'}">Global</button>
    ${owners.map(o=>`<button data-scope="${o.id}" class="px-3 py-1.5 rounded-full text-sm font-medium ${dashScope===o.id?'tab-active':'card'}">${o.name}</button>`).join('')}
  </div>
  <p class="muted text-sm mb-3">Showing: <span class="font-medium" style="color:var(--text)">${scopeLabel}</span></p>
  <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
    ${expandStatCard('panel','☀️','Panels in stock', fmt(g.panel.qty), money(g.panel.value)+' value')}
    ${expandStatCard('inverter','⚡','Inverters in stock', fmt(g.inverter.qty), money(g.inverter.value)+' value')}
    ${expandStatCard('battery','🔋','Batteries in stock', fmt(g.battery.qty), money(g.battery.value)+' value', g.gateway.qty ? `+ ${fmt(g.gateway.qty)} Tesla Gateway${g.gateway.qty>1?'s':''}` : '')}
  </div>
  ${Object.entries(CATS).filter(([k])=>dashExpanded[k]).map(([k,v])=>`
    <div class="card p-4 mt-3"><h3 class="font-semibold mb-2">${v.icon} ${v.label} by model</h3>${breakdownTable(k)}</div>
  `).join('')}
  ${dashScope==='global' ? `
  <h2 class="font-semibold mt-8 mb-3">Breakdown by business owner</h2>
  <div class="flex gap-2 mb-3">${Object.entries(CATS).map(([k,v])=>`<button data-bcat="${k}" class="px-3 py-1.5 rounded-full text-sm font-medium ${breakdownCat===k?'tab-active':'card'}">${v.icon} ${v.label}</button>`).join('')}</div>
  ${(()=>{
    const {models:mods, perOwner} = ownerModelMatrix(breakdownCat);
    if(!mods.length) return `<div class="card p-4 muted text-sm">No ${CATS[breakdownCat].label.toLowerCase()} in stock yet.</div>`;
    const colTotal=k=>perOwner.reduce((s,r)=>s+(r.map[k]||0),0);
    const grandTotal=perOwner.reduce((s,r)=>s+r.total,0);
    return `<div class="card overflow-x-auto"><table class="w-full text-sm min-w-[720px]">
      <thead><tr class="text-left muted"><th class="p-3">Owner</th>${mods.map(m=>`<th class="p-3">${modelLabel(m)}</th>`).join('')}<th class="p-3 font-semibold">Total</th></tr></thead>
      <tbody>${perOwner.map(r=>`<tr><td class="p-3 font-medium">${r.owner.name}</td>${mods.map(m=>`<td class="p-3">${fmt(r.map[m.key]||0)}</td>`).join('')}<td class="p-3 font-semibold">${fmt(r.total)}</td></tr>`).join('')}</tbody>
      <tfoot><tr class="font-semibold" style="border-top:1px solid var(--border)"><td class="p-3">Total</td>${mods.map(m=>`<td class="p-3">${fmt(colTotal(m.key))}</td>`).join('')}<td class="p-3">${fmt(grandTotal)}</td></tr></tfoot>
    </table></div>`;
  })()}` : ''}`;
}

function addForm(){
  const catModels = models.filter(m=>m.category===form.category);
  const selected = form.model_id ? catModels.find(m=>m.id===form.model_id) : null;
  const canAdd = batchMeta.owner_id && batchMeta.date && selected && form.quantity;
  return `<h1 class="text-xl font-bold mb-4">Add Stock</h1>
  <div class="grid lg:grid-cols-2 gap-5 items-start">
    <div class="card p-5">
      <h2 class="font-semibold mb-4">Queue New Stock</h2>
      ${msg? `<div class="mb-4 text-sm px-3 py-2 rounded-lg" style="background:var(--accent2);color:#fff">${msg}</div>`:''}
      <div class="space-y-3">
        <div><label class="text-sm muted">Category</label>
          <select id="f-category" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)">
            ${Object.entries(CATS).map(([k,v])=>`<option value="${k}" ${form.category===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
          </select></div>

        ${!catModels.length ? `<p class="muted text-sm py-2">No presets set up for ${CATS[form.category].label.toLowerCase()} yet — add one in Admin → Stock master fields first.</p>` : `
        <div><label class="text-sm muted">Item Model</label>
          <select id="f-model" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)">
            <option value="">Select the item received…</option>
            ${catModels.map(m=>`<option value="${m.id}" ${form.model_id===m.id?'selected':''}>${modelLabel(m)}</option>`).join('')}
          </select></div>

        ${selected ? `
        <div class="p-3 rounded-lg text-sm" style="background:var(--bg);border:1px solid var(--border)">
          <div><span class="font-medium">Brand:</span> ${selected.brand}</div>
          <div><span class="font-medium">Specs:</span> ${selected.category==='panel'?`${selected.wattage}W`:selected.category==='inverter'?`${selected.kw} (${selected.inv_type})`:selected.batt_type}</div>
        </div>

        ${isPowerwall3Item(selected) && findGatewayPreset() ? `
        <label class="flex items-start gap-2 text-sm p-3 rounded-lg" style="border:1px solid var(--border)">
          <input id="f-autogateway" type="checkbox" class="mt-0.5" ${autoAddGateway?'checked':''}/>
          <span>Add 1x Tesla Gateway per Powerwall to this batch — untick to skip</span>
        </label>` : ''}

        <div><label class="text-sm muted">Quantity</label><input id="f-quantity" type="number" value="${form.quantity}" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)"/></div>
        ${form.category==='panel' ? `<div><label class="text-sm muted">Number of pallets</label><input id="f-pallets" type="number" value="${form.pallets}" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)" placeholder="optional"/><p class="text-xs muted mt-1">Uses this preset's panels/pallet (${selected.per_pallet||'not set'}) to fill quantity automatically</p></div>` : ''}
        ` : ''}`}

        <div><label class="text-sm muted">Date Received <span style="color:#b3413a">*</span></label><input id="bm-date" type="date" value="${batchMeta.date}" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)"/></div>
        <div><label class="text-sm muted">Reference (PO/Shipment)</label><input id="bm-reference" value="${batchMeta.reference}" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)" placeholder="e.g. PO-1042"/></div>
        <div><label class="text-sm muted">Allocate to Owner <span style="color:#b3413a">*</span></label>
          <select id="bm-owner" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)">
            <option value="">-- Select Owner --</option>
            ${owners.map(o=>`<option value="${o.id}" ${batchMeta.owner_id===o.id?'selected':''}>${o.name}</option>`).join('')}
          </select></div>

        <button id="f-addbatch" class="w-full mt-2 py-2.5 rounded-lg font-medium text-white" style="background:var(--accent)">Add to Staging Batch</button>
        ${!canAdd ? `<p class="text-xs text-center" style="color:#b3413a">Please fill all required fields.</p>` : ''}
      </div>
    </div>

    <div class="card p-5">
      <h2 class="font-semibold mb-4">Staging Batch (${pending.length})</h2>
      ${pending.length ? `
      <div class="space-y-2 mb-4">${pending.map(p=> editPendingId===p._id ? `
        <div class="p-3 rounded-lg text-sm" style="border:1px solid var(--accent)">
          <div class="mb-2">${CATS[p.category].icon} ${specLabel(p)}</div>
          <div class="grid grid-cols-2 gap-2 mb-2">
            <div><label class="text-xs muted">Quantity</label><input id="ep-quantity" type="number" value="${editPendingForm.quantity}" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>
            <div><label class="text-xs muted">Owner</label><select id="ep-owner" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)">${owners.map(o=>`<option value="${o.id}" ${editPendingForm.owner_id===o.id?'selected':''}>${o.name}</option>`).join('')}</select></div>
            <div><label class="text-xs muted">Date received</label><input id="ep-shipdate" type="date" value="${editPendingForm.shipment_date}" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>
            <div><label class="text-xs muted">Reference</label><input id="ep-reference" value="${editPendingForm.reference}" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>
          </div>
          <div class="flex gap-2"><button id="ep-save" class="px-3 py-1.5 rounded-lg text-white text-sm font-medium" style="background:var(--accent)">Save</button>
          <button id="ep-cancel" class="px-3 py-1.5 rounded-lg text-sm border" style="border-color:var(--border)">Cancel</button></div>
        </div>` : `<div class="flex items-center justify-between text-sm p-2 rounded-lg" style="border:1px solid var(--border)">
        <span>${CATS[p.category].icon} ${specLabel(p)} · Qty ${fmt(p.quantity)} · ${ownerName(p.owner_id)}</span>
        <span class="whitespace-nowrap"><button data-editpending="${p._id}" class="text-xs muted hover:opacity-70 mr-2">Edit</button><button data-batchdel="${p._id}" class="text-xs muted hover:opacity-70">Remove</button></span></div>`).join('')}</div>
      <button id="f-savebatch" class="w-full py-2.5 rounded-lg font-medium text-white" style="background:var(--accent)">Save ${pending.length} item${pending.length>1?'s':''} to stock</button>
      ` : `
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <div class="text-5xl mb-3 muted">📦</div>
        <div class="font-medium">Your staging area is empty.</div>
        <div class="muted text-sm mt-1">Add items from the form on the left to build a batch before committing to inventory.</div>
      </div>`}
    </div>
  </div>

  <div class="card p-5 mt-5">
    <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
      <h2 class="font-semibold">Record of Ins (History)</h2>
      <input id="stockin-search" value="${stockInSearch}" class="p-2 rounded-lg border bg-transparent text-sm w-64" style="border-color:var(--border)" placeholder="Search reference or item…"/>
    </div>
    <div class="flex flex-wrap gap-2 items-center mb-3">
      <select id="stockin-limit" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)">
        <option value="20" ${stockInLimit==='20'?'selected':''}>Latest 20</option>
        <option value="50" ${stockInLimit==='50'?'selected':''}>Latest 50</option>
        <option value="all" ${stockInLimit==='all'?'selected':''}>All</option>
      </select>
      <select id="stockin-range" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)">
        <option value="all" ${stockInRange==='all'?'selected':''}>Any time</option>
        <option value="week" ${stockInRange==='week'?'selected':''}>Last week</option>
        <option value="fortnight" ${stockInRange==='fortnight'?'selected':''}>Last fortnight</option>
        <option value="month" ${stockInRange==='month'?'selected':''}>Last month</option>
        <option value="date" ${stockInRange==='date'?'selected':''}>Specific date</option>
        <option value="between" ${stockInRange==='between'?'selected':''}>Date range</option>
      </select>
      ${stockInRange==='date'?`<input id="stockin-date" type="date" value="${stockInDate}" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/>`:''}
      ${stockInRange==='between'?`<input id="stockin-from" type="date" value="${stockInFrom}" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/><span class="muted text-sm">to</span><input id="stockin-to" type="date" value="${stockInTo}" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/>`:''}
    </div>
    ${invMsg? `<div class="mb-4 text-sm px-3 py-2 rounded-lg" style="background:var(--accent2);color:#fff">${invMsg}</div>`:''}
    ${(()=>{
      const q = stockInSearch.trim().toLowerCase();
      let ins = movements.filter(m=>m.type==='in');
      if(q) ins = ins.filter(m=>{
        const hay=[m.brand, m.category, movementSpec(m), m.reference, m.notes, ownerName(m.owner_id)].join(' ').toLowerCase();
        return hay.includes(q);
      });
      ins = applyDateRange(ins, 'date', stockInRange, stockInDate, stockInFrom, stockInTo);
      ins = ins.sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
      const shown = applyLimit(ins, stockInLimit);
      if(!shown.length) return `<p class="muted text-sm py-2">No matching stock-in records.</p>`;
      return `<div class="overflow-x-auto"><table class="w-full text-sm min-w-[600px]">
        <thead><tr class="text-left muted"><th class="p-2">Date / Time</th><th class="p-2">Owner</th><th class="p-2">Reference</th><th class="p-2">Details</th></tr></thead>
        <tbody>${shown.map(m=>`<tr style="border-bottom:1px solid var(--border)">
          <td class="p-2 whitespace-nowrap">${fmtDateTime(m.created_at)}</td>
          <td class="p-2">${ownerName(m.owner_id)}</td>
          <td class="p-2">${m.reference||'—'}</td>
          <td class="p-2">${movementDetails(m)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    })()}
  </div>`;
}

function stockEditRow(it){
  const f = editStockForm;
  return `<tr><td colspan="5" class="p-3">
    <div class="p-3 rounded-lg" style="border:1px solid var(--accent)">
      <div class="grid sm:grid-cols-2 gap-2 mb-2">
        <div><label class="text-xs muted">Brand</label><input id="es-brand" value="${f.brand}" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>
        <div><label class="text-xs muted">Quantity</label><input id="es-quantity" type="number" value="${f.quantity}" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>
        ${it.category==='panel'?`<div><label class="text-xs muted">Wattage (W)</label><input id="es-wattage" type="number" value="${f.wattage}" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>`:''}
        ${it.category==='inverter'?`<div><label class="text-xs muted">kW</label><input id="es-kw" type="number" value="${f.kw}" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>
        <div><label class="text-xs muted">Type</label><input id="es-inv_type" value="${f.inv_type}" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>`:''}
        ${it.category==='battery'?`<div><label class="text-xs muted">Type</label><input id="es-batt_type" value="${f.batt_type}" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>`:''}
        <div><label class="text-xs muted">Cost per unit</label><input id="es-cost" type="number" value="${f.cost}" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>
        <div><label class="text-xs muted">Owner</label><select id="es-owner" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)">${owners.map(o=>`<option value="${o.id}" ${f.owner_id===o.id?'selected':''}>${o.name}</option>`).join('')}</select></div>
        <div><label class="text-xs muted">Date received</label><input id="es-shipdate" type="date" value="${f.shipment_date}" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>
        <div><label class="text-xs muted">Reference</label><input id="es-reference" value="${f.reference}" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>
      </div>
      <div class="flex gap-2"><button id="es-save" class="px-3 py-1.5 rounded-lg text-white text-sm font-medium" style="background:var(--accent)">Save correction</button>
      <button id="es-cancel" class="px-3 py-1.5 rounded-lg text-sm border" style="border-color:var(--border)">Cancel</button></div>
    </div>
  </td></tr>`;
}
function inventory(){
  const q = invSearch.trim().toLowerCase();
  const byOwner = ownerFilter==='all' ? stock : stock.filter(s=>s.owner_id===ownerFilter);
  const byCategory = invCategoryFilter==='all' ? byOwner : byOwner.filter(s=>s.category===invCategoryFilter);
  let filtered = !q ? byCategory : byCategory.filter(it=>{
    const hay = [it.brand, it.category, it.wattage, it.kw, it.inv_type, it.batt_type, it.reference, ownerName(it.owner_id)].join(' ').toLowerCase();
    return hay.includes(q);
  });
  filtered = applyDateRange(filtered, 'shipment_date', invRange, invDate, invFrom, invTo);
  const sorted = applyLimit([...filtered].sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')), invLimit);
  return `
  <div class="flex gap-2 mb-3 flex-wrap">
    <button data-invcat="all" class="px-3 py-1.5 rounded-full text-sm font-medium ${invCategoryFilter==='all'?'tab-active':'card'}">All</button>
    ${Object.entries(CATS).map(([k,v])=>`<button data-invcat="${k}" class="px-3 py-1.5 rounded-full text-sm font-medium ${invCategoryFilter===k?'tab-active':'card'}">${v.icon} ${v.label}</button>`).join('')}
  </div>
  <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
    <div class="flex items-center gap-3 flex-wrap">
      <label class="text-sm muted">Filter by owner:</label>
      <select id="owner-filter" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)">
        <option value="all" ${ownerFilter==='all'?'selected':''}>All owners</option>
        ${owners.map(o=>`<option value="${o.id}" ${ownerFilter===o.id?'selected':''}>${o.name}</option>`).join('')}
      </select>
    </div>
    <button id="stock-csv" class="px-4 py-2 rounded-lg font-medium text-white text-sm" style="background:var(--accent)">Download stock CSV</button>
    <button id="transfer-open" class="px-4 py-2 rounded-lg font-medium text-sm border" style="border-color:var(--border)">Transfer stock</button>
  </div>
  ${recordControls('inv', invSearch, invLimit, invRange, invDate, invFrom, invTo, 'Search brand, spec, owner, reference…')}
  ${invMsg? `<div class="mb-4 text-sm px-3 py-2 rounded-lg" style="background:var(--accent2);color:#fff">${invMsg}</div>`:''}
  <div class="card overflow-x-auto"><table class="w-full text-sm min-w-[640px]">
    <thead><tr class="text-left muted"><th class="p-3">Category</th><th class="p-3">Spec</th><th class="p-3">Qty</th><th class="p-3">Owner</th><th class="p-3"></th></tr></thead>
    <tbody>${sorted.length? sorted.map(it=> editStockId===it.id ? stockEditRow(it) : `<tr>
      <td class="p-3">${CATS[it.category].icon} ${CATS[it.category].label}</td>
      <td class="p-3">${specLabel(it)}</td>
      <td class="p-3">${fmt(it.quantity)}</td><td class="p-3">${ownerName(it.owner_id)}</td>
      <td class="p-3 whitespace-nowrap"><button data-editstock="${it.id}" class="text-xs muted hover:opacity-70 mr-2">Edit</button><button data-del="${it.id}" class="text-xs muted hover:opacity-70">Remove</button></td>
    </tr>`).join('') : `<tr><td class="p-4 muted" colspan="5">No stock entries yet.</td></tr>`}</tbody>
  </table></div>`;
}

function jobItemPicker(cat, keyField, qtyField, f, prefix){
  const groups = f.owner_id ? groupOwnerStock(f.owner_id, cat) : [];
  return `<div class="grid grid-cols-3 gap-2 items-end">
    <div class="col-span-2"><label class="text-sm muted">${CATS[cat].icon} ${CATS[cat].label} used</label>
      <select data-jobkey="${prefix}:${keyField}" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)" ${!f.owner_id?'disabled':''}>
        <option value="">Not used</option>
        ${groups.map(g=>`<option value="${g.key}" ${f[keyField]===g.key?'selected':''}>${modelLabel(g)} (${g.available} available)</option>`).join('')}
      </select></div>
    <div><label class="text-sm muted">Qty</label><input data-jobqty="${prefix}:${qtyField}" type="number" value="${f[qtyField]}" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)" ${!f.owner_id?'disabled':''}/></div>
  </div>`;
}

function jobsView(){
  const jobHasPW = jobForm.batteryKey && (()=>{
    const g = jobForm.owner_id ? groupOwnerStock(jobForm.owner_id,'battery').find(g=>g.key===jobForm.batteryKey) : null;
    return g && (g.batt_type==='PW3'||g.batt_type==='3P');
  })();
  return `<div class="grid lg:grid-cols-2 gap-5">
    <div class="card p-5">
      <h2 class="font-semibold mb-4">Log outgoing stock</h2>
      ${jobMsg? `<div class="mb-4 text-sm px-3 py-2 rounded-lg" style="background:var(--accent2);color:#fff">${jobMsg}</div>`:''}
      <div class="space-y-4">
        <div><label class="text-sm muted">Business owner / job for</label>
          <select id="job-owner" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)">
            <option value="">Select owner</option>
            ${owners.map(o=>`<option value="${o.id}" ${jobForm.owner_id===o.id?'selected':''}>${o.name}</option>`).join('')}
          </select></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-sm muted">Date</label><input id="job-create-date" type="date" value="${jobForm.date}" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)"/></div>
          <div><label class="text-sm muted">Installation date</label><input id="job-install-date" type="date" value="${jobForm.installation_date}" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)"/></div>
        </div>
        <div><label class="text-sm muted">Reference / installation address</label><input id="job-reference" value="${jobForm.reference}" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)" placeholder="e.g. 12 Beach Rd, Smith residence"/></div>
        ${jobItemPicker('panel','panelKey','panelQty', jobForm, 'create')}
        ${jobItemPicker('inverter','inverterKey','inverterQty', jobForm, 'create')}
        ${jobItemPicker('battery','batteryKey','batteryQty', jobForm, 'create')}
        ${jobHasPW ? `<label class="flex items-start gap-2 text-sm p-3 rounded-lg" style="border:1px solid var(--border)">
          <input id="job-autogateway" type="checkbox" class="mt-0.5" ${jobForm.autoGateway?'checked':''}/>
          <span>Add 1x Tesla Gateway per Powerwall to this batch — untick to skip</span>
        </label>`:''}
        <div><label class="text-sm muted">Job notes (optional)</label><input id="job-notes" value="${jobForm.notes}" class="w-full mt-1 p-2 rounded-lg border bg-transparent" style="border-color:var(--border)" placeholder="e.g. Smith residence install"/></div>
        <button id="job-submit" class="w-full py-2.5 rounded-lg font-medium text-white" style="background:var(--accent)">Log outgoing stock &amp; update levels</button>
      </div>
    </div>
    <div class="card p-5 max-h-[720px] overflow-y-auto">
      <h2 class="font-semibold mb-3">Outgoing stock history</h2>
      ${recordControls('job', jobSearch, jobLimit, jobRange, jobDate, jobFrom, jobTo, 'Search by owner, brand or notes…')}
      ${(()=>{
        const q=jobSearch.trim().toLowerCase();
        let filtered = !q ? jobs : jobs.filter(j=>{
          const hay = [ownerName(j.owner_id), j.notes||'', j.reference||'', ...(j.items||[]).map(it=>it.brand)].join(' ').toLowerCase();
          return hay.includes(q);
        });
        filtered = applyDateRange(filtered, 'date', jobRange, jobDate, jobFrom, jobTo);
        filtered = filtered.sort((a,b)=>(b.date||b.created_at||'').localeCompare(a.date||a.created_at||''));
        const shown = applyLimit(filtered, jobLimit);
        return shown.length? `<div class="space-y-3">${shown.map(j=>outgoingEntry(j)).join('')}</div>` : `<p class="muted text-sm">${jobs.length?'No matching outgoing stock found.':'No outgoing stock logged yet.'}</p>`;
      })()}
    </div>
  </div>`;
}
function outgoingEntry(j){
  if(editJobId===j.id){
    const jobHasPWEdit = editJobForm.batteryKey && (()=>{
      const g = editJobForm.owner_id ? groupOwnerStock(editJobForm.owner_id,'battery').find(g=>g.key===editJobForm.batteryKey) : null;
      return g && (g.batt_type==='PW3'||g.batt_type==='3P');
    })();
    return `<div class="p-3 rounded-lg" style="border:1px solid var(--accent)">
      <p class="text-xs muted mb-2">Originally recorded: ${(j.items||[]).map(it=>`${it.brand} ×${it.quantity}`).join(', ')||'—'}. That stock has been returned — re-select what should be recorded below.</p>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <select id="edit-owner" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)">${owners.map(o=>`<option value="${o.id}" ${editJobForm.owner_id===o.id?'selected':''}>${o.name}</option>`).join('')}</select>
        <input id="edit-date" type="date" value="${editJobForm.date}" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <input id="edit-install-date" type="date" value="${editJobForm.installation_date}" placeholder="Installation date" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/>
        <input id="edit-reference" value="${editJobForm.reference}" placeholder="Reference / address" class="p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/>
      </div>
      <div class="space-y-2 mb-2">
        ${jobItemPicker('panel','panelKey','panelQty', editJobForm, 'edit')}
        ${jobItemPicker('inverter','inverterKey','inverterQty', editJobForm, 'edit')}
        ${jobItemPicker('battery','batteryKey','batteryQty', editJobForm, 'edit')}
        ${jobHasPWEdit ? `<label class="flex items-start gap-2 text-sm p-2 rounded-lg" style="border:1px solid var(--border)">
          <input id="edit-autogateway" type="checkbox" class="mt-0.5" ${editJobForm.autoGateway?'checked':''}/>
          <span>Add 1x Tesla Gateway per Powerwall — untick to skip</span>
        </label>`:''}
      </div>
      <input id="edit-notes" value="${editJobForm.notes}" class="w-full p-2 rounded-lg border bg-transparent text-sm mb-2" style="border-color:var(--border)" placeholder="Notes"/>
      <textarea id="edit-reason" class="w-full p-2 rounded-lg border bg-transparent text-sm mb-2" style="border-color:var(--border)" placeholder="Reason for update (required)" rows="2">${editJobForm.reason}</textarea>
      <div class="flex gap-2"><button id="edit-save" class="px-3 py-1.5 rounded-lg text-white text-sm font-medium" style="background:var(--accent)">Save changes</button>
      <button id="edit-cancel" class="px-3 py-1.5 rounded-lg text-sm border" style="border-color:var(--border)">Cancel</button></div>
    </div>`;
  }
  return `<div class="p-3 rounded-lg" style="border:1px solid var(--border)">
    <div class="flex justify-between items-start">
      <div>
        <div><span class="font-bold">${ownerName(j.owner_id)}</span> <span class="muted text-sm">${fmtDate(j.date||(j.created_at||'').slice(0,10))}</span></div>
        ${j.reference? `<div class="text-sm mt-0.5">${j.reference}</div>`:''}
        ${j.installation_date? `<div class="muted text-xs mt-0.5">Install: ${fmtDate(j.installation_date)}</div>`:''}
      </div>
      <button data-jobedit="${j.id}" class="text-xs muted hover:opacity-70">Edit</button>
    </div>
    ${j.notes? `<div class="muted text-xs mt-1">${j.notes}</div>`:''}
    <div class="mt-2 pt-2" style="border-top:1px solid var(--border)">
      <ul class="text-sm space-y-0.5">${(j.items||[]).map(it=>`<li>${CATS[it.category].icon} ${it.brand} — ${it.quantity} used</li>`).join('')}</ul>
    </div>
  </div>`;
}

function confirmCreateJobModal(){
  if(!confirmCreateJob) return '';
  const { lines } = confirmCreateJob;
  return `<div class="fixed inset-0 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);z-index:50">
    <div class="card p-5 w-full max-w-sm">
      <h3 class="font-semibold mb-2">Confirm outgoing stock</h3>
      <p class="muted text-sm mb-2">For ${ownerName(jobForm.owner_id)} · ${fmtDate(jobForm.date)}${jobForm.reference? ` · ${jobForm.reference}`:''}</p>
      <ul class="text-sm mb-4 space-y-1">${lines.map(l=>`<li>${CATS[l.category].icon} ${l.group.brand} — ${l.qty} used</li>`).join('')}</ul>
      <div class="flex gap-2">
        <button id="createjob-yes" class="px-4 py-2 rounded-lg font-medium text-white text-sm" style="background:var(--accent)">Yes, log it</button>
        <button id="createjob-no" class="px-4 py-2 rounded-lg text-sm border" style="border-color:var(--border)">No, go back</button>
      </div>
    </div>
  </div>`;
}
function confirmEditJobModal(){
  if(!confirmEditJob) return '';
  const { lines } = confirmEditJob;
  return `<div class="fixed inset-0 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);z-index:50">
    <div class="card p-5 w-full max-w-sm">
      <h3 class="font-semibold mb-2">Confirm changes</h3>
      <p class="muted text-sm mb-2">Reason: ${editJobForm.reason}</p>
      <p class="muted text-sm mb-2">Updated items for ${ownerName(editJobForm.owner_id)} · ${fmtDate(editJobForm.date)}:</p>
      <ul class="text-sm mb-4 space-y-1">${lines.map(l=>`<li>${CATS[l.category].icon} ${l.group.brand} — ${l.qty} used</li>`).join('')}</ul>
      <div class="flex gap-2">
        <button id="editjob-yes" class="px-4 py-2 rounded-lg font-medium text-white text-sm" style="background:var(--accent)">Yes, save changes</button>
        <button id="editjob-no" class="px-4 py-2 rounded-lg text-sm border" style="border-color:var(--border)">No, go back</button>
      </div>
    </div>
  </div>`;
}

function logView(){
  const q = logSearch.trim().toLowerCase();
  let filteredMovements = !q ? movements : movements.filter(m=>{
    const hay=[m.brand, m.category, m.type, movementSpec(m), m.reference, m.notes, ownerName(m.owner_id)].join(' ').toLowerCase();
    return hay.includes(q);
  });
  filteredMovements = applyDateRange(filteredMovements, 'date', logRange, logDate, logFrom, logTo);
  filteredMovements = filteredMovements.sort((a,b)=>(b.date||b.created_at||'').localeCompare(a.date||a.created_at||''));
  const shownMovements = applyLimit(filteredMovements, logLimit);
  return `<div class="flex items-center justify-between mb-4 flex-wrap gap-2">
    <h2 class="font-semibold">Inventory in / out log</h2>
    <button id="log-csv" class="px-4 py-2 rounded-lg font-medium text-white text-sm" style="background:var(--accent)">Download CSV</button>
  </div>
  ${logMsg? `<div class="mb-4 text-sm px-3 py-2 rounded-lg" style="background:var(--accent2);color:#fff">${logMsg}</div>`:''}
  ${recordControls('log', logSearch, logLimit, logRange, logDate, logFrom, logTo, 'Search brand, spec, owner, reference, notes…')}
  <div class="card overflow-x-auto"><table class="w-full text-sm min-w-[720px]">
    <thead><tr class="text-left muted"><th class="p-3">Date</th><th class="p-3">Type</th><th class="p-3">Item</th><th class="p-3">Qty</th><th class="p-3">Owner</th><th class="p-3">Reference</th><th class="p-3">Notes</th><th class="p-3">By</th></tr></thead>
    <tbody>${shownMovements.length? shownMovements.map(m=>`<tr>
      <td class="p-3 whitespace-nowrap">${fmtDate(m.date||(m.created_at||'').slice(0,10))}</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium" style="background:${movementTypeMeta(m.type).color};color:#fff">${movementTypeMeta(m.type).label}</span></td>
      <td class="p-3">${catMeta(m.category).icon} ${movementSpec(m)}</td><td class="p-3">${fmt(m.quantity)}</td><td class="p-3">${ownerName(m.owner_id)}</td>
      <td class="p-3">${m.reference||'—'}</td><td class="p-3 muted">${m.notes||''}</td>
      <td class="p-3 muted whitespace-nowrap">${m.performed_by||'—'}</td>
    </tr>`).join('') : `<tr><td class="p-4 muted" colspan="8">${movements.length?'No matching movements found.':'No movements logged yet.'}</td></tr>`}</tbody>
  </table></div>`;
}

function modelCols(category){
  if(category==='panel') return [['Brand','brand','text'],['Wattage (W)','wattage','number'],['Cost','cost','number'],['Panels/pallet','per_pallet','number']];
  if(category==='inverter') return [['Brand','brand','text'],['kW','kw','number'],['Type','inv_type','text'],['Cost','cost','number']];
  return [['Brand','brand','text'],['Type','batt_type','text'],['Cost','cost','number']];
}
function modelDisplay(m, field){
  if(field==='cost') return money(m.cost||0);
  return (m[field]===undefined || m[field]==='' || m[field]===null) ? '—' : m[field];
}
function modelEditRow(m, cols){
  const f = editModelForm;
  return `<tr><td colspan="${cols.length+1}" class="p-2">
    <div class="p-3 rounded-lg" style="border:1px solid var(--accent)">
      <div class="grid sm:grid-cols-2 gap-2 mb-2">
        ${cols.map(([label,field,type])=>`<div><label class="text-xs muted">${label}</label><input data-medit="${field}" type="${type}" value="${f[field]}" class="w-full p-2 rounded-lg border bg-transparent text-sm" style="border-color:var(--border)"/></div>`).join('')}
      </div>
      <div class="flex gap-2"><button id="modeledit-save" class="px-3 py-1.5 rounded-lg text-white text-sm font-medium" style="background:var(--accent)">Save changes</button>
      <button id="modeledit-cancel" class="px-3 py-1.5 rounded-lg text-sm border" style="border-color:var(--border)">Cancel</button></div>
    </div>
  </td></tr>`;
}
function modelTable(category){
  const list = models.filter(m=>m.category===category);
  const cols = modelCols(category);
  if(!list.length) return `<p class="muted text-sm py-2">No presets yet for this category.</p>`;
  return `<div class="overflow-x-auto"><table class="w-full text-sm">
    <thead><tr class="text-left muted">${cols.map(([label])=>`<th class="p-2">${label}</th>`).join('')}<th class="p-2"></th></tr></thead>
    <tbody>${list.map(m=> editModelId===m.id ? modelEditRow(m,cols) : `<tr style="border-bottom:1px solid var(--border)">
      ${cols.map(([,field])=>`<td class="p-2">${modelDisplay(m,field)}</td>`).join('')}
      <td class="p-2 whitespace-nowrap"><button data-modeledit="${m.id}" class="text-xs muted hover:opacity-70 mr-2">Edit</button><button data-modeldel="${m.id}" class="text-xs muted hover:opacity-70">Remove</button></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
function ownersTable(){
  return `<div class="overflow-x-auto"><table class="w-full text-sm">
    <thead><tr class="text-left muted"><th class="p-2">Name</th><th class="p-2"></th></tr></thead>
    <tbody>${owners.map(o=> editOwnerId===o.id ? `<tr><td colspan="2" class="p-2">
      <div class="p-3 rounded-lg" style="border:1px solid var(--accent)">
        <input id="eo-name" value="${editOwnerForm.name}" class="w-full p-2 rounded-lg border bg-transparent text-sm mb-2" style="border-color:var(--border)"/>
        <div class="flex gap-2"><button id="eo-save" class="px-3 py-1.5 rounded-lg text-white text-sm font-medium" style="background:var(--accent)">Save changes</button>
        <button id="eo-cancel" class="px-3 py-1.5 rounded-lg text-sm border" style="border-color:var(--border)">Cancel</button></div>
      </div>
    </td></tr>` : `<tr style="border-bottom:1px solid var(--border)">
      <td class="p-2">${o.name}</td>
      <td class="p-2 whitespace-nowrap"><button data-owneredit="${o.id}" class="text-xs muted hover:opacity-70 mr-2">Edit</button><button data-ownerdel="${o.id}" class="text-xs muted hover:opacity-70">Remove</button></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
function adminView(){
  return `<div class="space-y-6">
    <div class="card p-5"><h2 class="font-semibold mb-3">Business owners</h2>
      ${ownersTable()}
    </div>
    <div class="card p-5">
      <h2 class="font-semibold mb-1">Stock master fields — preset models</h2>
      <p class="muted text-sm mb-4">These presets prefill the Add Stock form. Table rows are read-only — use Edit to change a preset, and confirm before saving.</p>
      <div class="grid grid-cols-3 gap-2 mb-4">${Object.entries(CATS).map(([k,v])=>`<button data-admincat="${k}" class="p-2 rounded-lg text-sm border ${newModel.category===k?'tab-active':''}" style="border-color:var(--border)">${v.icon} ${v.label}</button>`).join('')}</div>
      ${modelTable(newModel.category)}
      <div class="flex flex-wrap gap-2 items-end mt-4 pt-4" style="border-top:1px solid var(--border)">
        <input id="nm-brand" placeholder="Brand" value="${newModel.brand}" class="p-2 rounded-lg border bg-transparent text-sm flex-1 min-w-[120px]" style="border-color:var(--border)"/>
        ${newModel.category==='panel'?`<input id="nm-wattage" type="number" placeholder="Wattage" value="${newModel.wattage}" class="p-2 rounded-lg border bg-transparent text-sm w-28" style="border-color:var(--border)"/><input id="nm-cost" type="number" placeholder="Cost" value="${newModel.cost}" class="p-2 rounded-lg border bg-transparent text-sm w-28" style="border-color:var(--border)"/><input id="nm-perpallet" type="number" placeholder="Panels/pallet" value="${newModel.per_pallet}" class="p-2 rounded-lg border bg-transparent text-sm w-32" style="border-color:var(--border)"/>`:''}
        ${newModel.category==='inverter'?`<input id="nm-kw" type="number" placeholder="kW" value="${newModel.kw}" class="p-2 rounded-lg border bg-transparent text-sm w-24" style="border-color:var(--border)"/><input id="nm-inv_type" placeholder="Type" value="${newModel.inv_type}" class="p-2 rounded-lg border bg-transparent text-sm w-32" style="border-color:var(--border)"/><input id="nm-cost" type="number" placeholder="Cost" value="${newModel.cost}" class="p-2 rounded-lg border bg-transparent text-sm w-28" style="border-color:var(--border)"/>`:''}
        ${newModel.category==='battery'?`<input id="nm-batt_type" placeholder="Type" value="${newModel.batt_type}" class="p-2 rounded-lg border bg-transparent text-sm w-32" style="border-color:var(--border)"/><input id="nm-cost" type="number" placeholder="Cost" value="${newModel.cost}" class="p-2 rounded-lg border bg-transparent text-sm w-28" style="border-color:var(--border)"/>`:''}
        <button id="nm-submit" class="px-4 py-2 rounded-lg font-medium text-white text-sm" style="background:var(--accent)">Add preset</button>
      </div>
    </div>
    <div class="card p-5" style="border-color:#b3413a">
      <h2 class="font-semibold mb-1">Danger zone</h2>
      <p class="muted text-sm mb-4">Permanently erase all stock, presets, outgoing stock jobs and log history, and reset owners back to defaults. Useful for clearing out test data before going live.</p>
      <button id="reset-all-btn" class="px-4 py-2 rounded-lg font-medium text-white text-sm" style="background:#b3413a">Reset all data</button>
    </div>
  </div>`;
}

function wire(){
  const logoutBtn=$('#logout-btn'); if(logoutBtn) logoutBtn.onclick=logout;
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab; msg=''; render();});
  document.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{dashScope=b.dataset.scope; render();});
  document.querySelectorAll('[data-expand]').forEach(b=>b.onclick=()=>{ const k=b.dataset.expand; dashExpanded[k]=!dashExpanded[k]; render(); });
  document.querySelectorAll('[data-bcat]').forEach(b=>b.onclick=()=>{breakdownCat=b.dataset.bcat; render();});
  const catSelect=$('#f-category'); if(catSelect) catSelect.onchange=()=>{ form.category=catSelect.value; resetEntryFields(); render(); };
  const bind=(id,key)=>{ const e=$(id); if(e) e.oninput=()=>{ form[key]=e.value; }; };
  bind('#f-quantity','quantity');
  const palletsInput=$('#f-pallets'); if(palletsInput) palletsInput.onchange=()=>{ form.pallets=palletsInput.value; recalcFromPallets(); render(); };
  const bmOwner=$('#bm-owner'); if(bmOwner) bmOwner.onchange=()=>{ batchMeta.owner_id=bmOwner.value; render(); };
  const bmDate=$('#bm-date'); if(bmDate) bmDate.onchange=()=>{ batchMeta.date=bmDate.value; render(); };
  const bmReference=$('#bm-reference'); if(bmReference) bmReference.oninput=()=>{ batchMeta.reference=bmReference.value; };
  const addBatch=$('#f-addbatch'); if(addBatch) addBatch.onclick=addToBatch;
  const saveBatchBtn=$('#f-savebatch'); if(saveBatchBtn) saveBatchBtn.onclick=saveBatch;
  document.querySelectorAll('[data-batchdel]').forEach(b=>b.onclick=()=>removeFromBatch(b.dataset.batchdel));
  document.querySelectorAll('[data-editpending]').forEach(b=>b.onclick=()=>startEditPending(b.dataset.editpending));
  const epQty=$('#ep-quantity'); if(epQty) epQty.oninput=()=>{ editPendingForm.quantity=epQty.value; };
  const epOwner=$('#ep-owner'); if(epOwner) epOwner.onchange=()=>{ editPendingForm.owner_id=epOwner.value; };
  const epShipdate=$('#ep-shipdate'); if(epShipdate) epShipdate.onchange=()=>{ editPendingForm.shipment_date=epShipdate.value; };
  const epReference=$('#ep-reference'); if(epReference) epReference.oninput=()=>{ editPendingForm.reference=epReference.value; };
  const epSave=$('#ep-save'); if(epSave) epSave.onclick=saveEditPending;
  const epCancel=$('#ep-cancel'); if(epCancel) epCancel.onclick=cancelEditPending;
  const wireRecordControls=(prefix, get, set)=>{
    const s=$(`#${prefix}-search`); if(s) s.oninput=()=>{ set('search', s.value); renderPreserveFocus(); };
    const l=$(`#${prefix}-limit`); if(l) l.onchange=()=>{ set('limit', l.value); render(); };
    const r=$(`#${prefix}-range`); if(r) r.onchange=()=>{ set('range', r.value); render(); };
    const d=$(`#${prefix}-date`); if(d) d.onchange=()=>{ set('date', d.value); render(); };
    const f=$(`#${prefix}-from`); if(f) f.onchange=()=>{ set('from', f.value); render(); };
    const t=$(`#${prefix}-to`); if(t) t.onchange=()=>{ set('to', t.value); render(); };
  };
  wireRecordControls('stockin', null, (k,v)=>{ if(k==='search')stockInSearch=v; if(k==='limit')stockInLimit=v; if(k==='range')stockInRange=v; if(k==='date')stockInDate=v; if(k==='from')stockInFrom=v; if(k==='to')stockInTo=v; });
  const modelSel=$('#f-model'); if(modelSel) modelSel.onchange=()=>{ applyModel(modelSel.value); render(); };
  const autoGatewayCb=$('#f-autogateway'); if(autoGatewayCb) autoGatewayCb.onchange=()=>{ autoAddGateway=autoGatewayCb.checked; };

  document.querySelectorAll('[data-invcat]').forEach(b=>b.onclick=()=>{ invCategoryFilter=b.dataset.invcat; render(); });
  const filt=$('#owner-filter'); if(filt) filt.onchange=()=>{ ownerFilter=filt.value; render(); };
  wireRecordControls('inv', null, (k,v)=>{ if(k==='search')invSearch=v; if(k==='limit')invLimit=v; if(k==='range')invRange=v; if(k==='date')invDate=v; if(k==='from')invFrom=v; if(k==='to')invTo=v; });
  const stockCsvBtn=$('#stock-csv'); if(stockCsvBtn) stockCsvBtn.onclick=downloadStockCsv;
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>removeItem(b.dataset.del));
  document.querySelectorAll('[data-owneredit]').forEach(b=>b.onclick=()=>startEditOwner(b.dataset.owneredit));
  document.querySelectorAll('[data-ownerdel]').forEach(b=>b.onclick=()=>requestDeleteOwner(b.dataset.ownerdel));
  const eoName=$('#eo-name'); if(eoName) eoName.oninput=()=>{ editOwnerForm.name=eoName.value; };
  const eoSave=$('#eo-save'); if(eoSave) eoSave.onclick=requestSaveOwner;
  const eoCancel=$('#eo-cancel'); if(eoCancel) eoCancel.onclick=cancelEditOwner;
  const ownerChangeCheckbox=$('#ownerchange-checkbox'); if(ownerChangeCheckbox) ownerChangeCheckbox.onchange=()=>{ confirmOwnerEditChecked=ownerChangeCheckbox.checked; render(); };
  const ownerChangeYes=$('#ownerchange-yes'); if(ownerChangeYes) ownerChangeYes.onclick=confirmSaveOwner;
  const ownerChangeNo=$('#ownerchange-no'); if(ownerChangeNo) ownerChangeNo.onclick=cancelSaveOwner;
  const ownerDelCheckbox=$('#ownerdel-checkbox'); if(ownerDelCheckbox) ownerDelCheckbox.onchange=()=>{ confirmDeleteOwnerChecked=ownerDelCheckbox.checked; render(); };
  const ownerDelYes=$('#ownerdel-yes'); if(ownerDelYes) ownerDelYes.onclick=confirmDeleteOwnerAction;
  const ownerDelNo=$('#ownerdel-no'); if(ownerDelNo) ownerDelNo.onclick=()=>{ confirmDeleteOwnerId=null; render(); };
  document.querySelectorAll('[data-editstock]').forEach(b=>b.onclick=()=>startEditStock(b.dataset.editstock));
  const trFrom=$('#tr-from'); if(trFrom) trFrom.onchange=()=>{ transferForm.from_owner_id=trFrom.value; transferForm.itemKey=''; transferForm.qty=''; render(); };
  const trItem=$('#tr-item'); if(trItem) trItem.onchange=()=>{ const [cat,key]=trItem.value.split('|'); transferForm.category=cat||'panel'; transferForm.itemKey=key||''; transferForm.qty=''; render(); };
  const trQty=$('#tr-qty'); if(trQty) trQty.oninput=()=>{ transferForm.qty=trQty.value; };
  const trTo=$('#tr-to'); if(trTo) trTo.onchange=()=>{ transferForm.to_owner_id=trTo.value; };
  const trDate=$('#tr-date'); if(trDate) trDate.onchange=()=>{ transferForm.date=trDate.value; };
  const trReference=$('#tr-reference'); if(trReference) trReference.oninput=()=>{ transferForm.reference=trReference.value; };
  const trSubmit=$('#tr-submit'); if(trSubmit) trSubmit.onclick=submitTransfer;
  const trCancel=$('#tr-cancel'); if(trCancel) trCancel.onclick=closeTransfer;
  const transferOpenBtn=$('#transfer-open'); if(transferOpenBtn) transferOpenBtn.onclick=openTransfer;
  const esBind=(id,key)=>{ const e=$(id); if(e) e.oninput=()=>{ editStockForm[key]=e.value; }; };
  esBind('#es-brand','brand'); esBind('#es-quantity','quantity'); esBind('#es-wattage','wattage'); esBind('#es-kw','kw');
  esBind('#es-inv_type','inv_type'); esBind('#es-batt_type','batt_type'); esBind('#es-cost','cost'); esBind('#es-shipdate','shipment_date'); esBind('#es-reference','reference');
  const esOwner=$('#es-owner'); if(esOwner) esOwner.onchange=()=>{ editStockForm.owner_id=esOwner.value; };
  const esSave=$('#es-save'); if(esSave) esSave.onclick=saveEditStock;
  const esCancel=$('#es-cancel'); if(esCancel) esCancel.onclick=cancelEditStock;

  const jobOwner=$('#job-owner'); if(jobOwner) jobOwner.onchange=()=>{ jobForm.owner_id=jobOwner.value; jobForm.panelKey=jobForm.inverterKey=jobForm.batteryKey=''; render(); };
  const jobCreateDateInput=$('#job-create-date'); if(jobCreateDateInput) jobCreateDateInput.onchange=()=>{ jobForm.date=jobCreateDateInput.value; };
  const jobInstallDate=$('#job-install-date'); if(jobInstallDate) jobInstallDate.onchange=()=>{ jobForm.installation_date=jobInstallDate.value; };
  const jobReference=$('#job-reference'); if(jobReference) jobReference.oninput=()=>{ jobForm.reference=jobReference.value; };
  const jobAutoGateway=$('#job-autogateway'); if(jobAutoGateway) jobAutoGateway.onchange=()=>{ jobForm.autoGateway=jobAutoGateway.checked; };
  document.querySelectorAll('[data-jobkey]').forEach(s=>s.onchange=()=>{
    const [prefix,field]=s.dataset.jobkey.split(':');
    (prefix==='edit'?editJobForm:jobForm)[field]=s.value; render();
  });
  document.querySelectorAll('[data-jobqty]').forEach(i=>i.oninput=()=>{
    const [prefix,field]=i.dataset.jobqty.split(':');
    (prefix==='edit'?editJobForm:jobForm)[field]=i.value;
  });
  const jobNotes=$('#job-notes'); if(jobNotes) jobNotes.oninput=()=>{ jobForm.notes=jobNotes.value; };
  const jobSubmit=$('#job-submit'); if(jobSubmit) jobSubmit.onclick=requestCreateJob;
  const createJobYes=$('#createjob-yes'); if(createJobYes) createJobYes.onclick=confirmCreateJobAction;
  const createJobNo=$('#createjob-no'); if(createJobNo) createJobNo.onclick=cancelCreateJob;
  wireRecordControls('job', null, (k,v)=>{ if(k==='search')jobSearch=v; if(k==='limit')jobLimit=v; if(k==='range')jobRange=v; if(k==='date')jobDate=v; if(k==='from')jobFrom=v; if(k==='to')jobTo=v; });
  document.querySelectorAll('[data-jobedit]').forEach(b=>b.onclick=()=>startEditJob(b.dataset.jobedit));
  const editOwner=$('#edit-owner'); if(editOwner) editOwner.onchange=()=>{ editJobForm.owner_id=editOwner.value; editJobForm.panelKey=editJobForm.inverterKey=editJobForm.batteryKey=''; render(); };
  const editDate=$('#edit-date'); if(editDate) editDate.onchange=()=>{ editJobForm.date=editDate.value; };
  const editInstallDate=$('#edit-install-date'); if(editInstallDate) editInstallDate.onchange=()=>{ editJobForm.installation_date=editInstallDate.value; };
  const editReference=$('#edit-reference'); if(editReference) editReference.oninput=()=>{ editJobForm.reference=editReference.value; };
  const editAutoGateway=$('#edit-autogateway'); if(editAutoGateway) editAutoGateway.onchange=()=>{ editJobForm.autoGateway=editAutoGateway.checked; };
  const editNotes=$('#edit-notes'); if(editNotes) editNotes.oninput=()=>{ editJobForm.notes=editNotes.value; };
  const editReason=$('#edit-reason'); if(editReason) editReason.oninput=()=>{ editJobForm.reason=editReason.value; };
  const editSave=$('#edit-save'); if(editSave) editSave.onclick=requestSaveJobEdit;
  const editCancel=$('#edit-cancel'); if(editCancel) editCancel.onclick=cancelEditJob;
  const editJobYes=$('#editjob-yes'); if(editJobYes) editJobYes.onclick=confirmSaveJobEdit;
  const editJobNo=$('#editjob-no'); if(editJobNo) editJobNo.onclick=cancelSaveJobEdit;

  const csvBtn=$('#log-csv'); if(csvBtn) csvBtn.onclick=downloadCsv;
  wireRecordControls('log', null, (k,v)=>{ if(k==='search')logSearch=v; if(k==='limit')logLimit=v; if(k==='range')logRange=v; if(k==='date')logDate=v; if(k==='from')logFrom=v; if(k==='to')logTo=v; });

  document.querySelectorAll('[data-admincat]').forEach(b=>b.onclick=()=>{ newModel.category=b.dataset.admincat; render(); });
  const nm=(id,key)=>{ const e=$(id); if(e) e.oninput=()=>{ newModel[key]=e.value; }; };
  nm('#nm-brand','brand'); nm('#nm-wattage','wattage'); nm('#nm-cost','cost'); nm('#nm-kw','kw'); nm('#nm-inv_type','inv_type'); nm('#nm-batt_type','batt_type'); nm('#nm-perpallet','per_pallet');
  const nmSubmit=$('#nm-submit'); if(nmSubmit) nmSubmit.onclick=addModel;
  document.querySelectorAll('[data-modeldel]').forEach(b=>b.onclick=()=>{ confirmDeleteModelId=b.dataset.modeldel; confirmDeleteChecked=false; render(); });
  document.querySelectorAll('[data-modeledit]').forEach(b=>b.onclick=()=>startEditModel(b.dataset.modeledit));
  document.querySelectorAll('[data-medit]').forEach(inp=>inp.oninput=()=>{ editModelForm[inp.dataset.medit]=inp.value; });
  const modelEditSave=$('#modeledit-save'); if(modelEditSave) modelEditSave.onclick=requestSaveModel;
  const modelEditCancel=$('#modeledit-cancel'); if(modelEditCancel) modelEditCancel.onclick=cancelEditModel;
  const modelChangeYes=$('#modelchange-yes'); if(modelChangeYes) modelChangeYes.onclick=confirmSaveModel;
  const modelChangeNo=$('#modelchange-no'); if(modelChangeNo) modelChangeNo.onclick=cancelSaveModel;
  const confirmCheckbox=$('#confirm-checkbox'); if(confirmCheckbox) confirmCheckbox.onchange=()=>{ confirmDeleteChecked=confirmCheckbox.checked; render(); };
  const confirmYes=$('#confirm-yes'); if(confirmYes) confirmYes.onclick=async()=>{ if(!confirmDeleteChecked) return; const id=confirmDeleteModelId; confirmDeleteModelId=null; await removeModel(id); };
  const confirmNo=$('#confirm-no'); if(confirmNo) confirmNo.onclick=()=>{ confirmDeleteModelId=null; render(); };

  const resetAllBtn=$('#reset-all-btn'); if(resetAllBtn) resetAllBtn.onclick=()=>{ confirmResetOpen=true; confirmResetChecked=false; render(); };
  const resetCheckbox=$('#reset-checkbox'); if(resetCheckbox) resetCheckbox.onchange=()=>{ confirmResetChecked=resetCheckbox.checked; render(); };
  const resetYes=$('#reset-yes'); if(resetYes) resetYes.onclick=()=>{ if(!confirmResetChecked) return; resetAllData(); };
  const resetNo=$('#reset-no'); if(resetNo) resetNo.onclick=()=>{ confirmResetOpen=false; render(); };
}

initAuth();
