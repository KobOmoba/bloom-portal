// ── Firebase ───────────────────────────────────────────────────────────────
const FB={apiKey:"AIzaSyCVEdunn3AZndDP5Rm1Z3Kv1e6G6W2mB_o",authDomain:"educationbloom-699ed.firebaseapp.com",projectId:"educationbloom-699ed",storageBucket:"educationbloom-699ed.firebasestorage.app",messagingSenderId:"33750392965",appId:"1:33750392965:web:2b3da887ede996ea8389ec"};
let db=null;
try{
  firebase.initializeApp(FB);
  db=firebase.firestore();
  db.enablePersistence({synchronizeTabs:true})
    .then(()=>console.log('✅ Portal offline persistence enabled'))
    .catch(err=>{ if(err.code!=='failed-precondition'&&err.code!=='unimplemented') console.warn('Persistence:',err.code); });
}catch(e){console.warn('FB:',e);}

// Real Firebase Auth admin account — created 25 July 2026, tried first on login.
// Firestore rule for admin_settings checks this exact account's UID.
const ADMIN_EMAIL = 'adebayoadesanya423@gmail.com';

// ── State ──────────────────────────────────────────────────────────────────
let pendingUnsub=null;
let approvalData=null;

// ── Sync Queue ─────────────────────────────────────────────────────────────
const SQ={
  q:JSON.parse(localStorage.getItem('ad_sq')||'[]'),
  save(){localStorage.setItem('ad_sq',JSON.stringify(this.q));},
  push(op){this.q.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2),op,tries:0});this.save();this.run();},
  ping(){
    const ok=navigator.onLine&&!!db;
    const el=document.getElementById('sync');
    if(el){el.className='sdot '+(ok?this.q.length?'sdot-sync':'sdot-on':'sdot-off');el.textContent=ok?this.q.length?'● Syncing':'● Online':'● Offline';}
    if(ok&&this.q.length)this.run();
  },
  async run(){
    if(!db||!navigator.onLine||!this.q.length)return;
    const items=[...this.q];
    for(const item of items){
      try{
        await this.exec(item.op);
        this.q=this.q.filter(x=>x.id!==item.id);
      } catch(e){
        console.error('SQ exec failed:',item.op?.t, e?.message||e);
        item.tries=(item.tries||0)+1;
        if(item.tries>3){
          console.warn('Dropping op after 3 retries:',item.op?.t);
          this.q=this.q.filter(x=>x.id!==item.id);
        }
      }
    }
    this.save();this.ping();
  },
  async exec(op){
    const t=op.t;
    if(t==='updateDeal')          await db.collection('admin_deals').doc(op.id).update(op.d);
    else if(t==='addSchoolRecord')   await db.collection('admin_approved_schools').doc(op.id).set(op.d,{merge:true});
    else if(t==='updateSchoolRecord')await db.collection('admin_approved_schools').doc(op.id).update(op.d);
    else if(t==='createSchool')    await db.collection('schools').doc(op.id).set(op.d,{merge:true});
    else if(t==='addLedger')       await db.collection('admin_ledger').doc(op.id).set(op.d,{merge:true});
    else if(t==='updateCAC')       await db.collection('admin_cac').doc('progress').set(op.d,{merge:true});
    else if(t==='addAgent')        await db.collection('admin_agents').add(op.d);
    else if(t==='deleteAgent')     await db.collection('admin_agents').doc(op.id).delete();
    else if(t==='logActivity')     await db.collection('admin_activity').add(op.d);
    else if(t==='saveSettings')    await db.collection('admin_settings').doc('main').set(op.d,{merge:true});
    else if(t==='addOpp')          await db.collection('admin_opportunities').add(op.d);
    else if(t==='deleteOpp')       await db.collection('admin_opportunities').doc(op.id).delete();
    else if(t==='updateLedger')    await db.collection('admin_ledger').doc(op.id).update(op.d);
  }
};
window.addEventListener('online',()=>{SQ.ping();SQ.run();});
window.addEventListener('offline',()=>SQ.ping());
// Manual force-flush for debugging
window._flushSQ = ()=>SQ.run();;

// ── Helpers ────────────────────────────────────────────────────────────────
const $=id=>document.getElementById(id);
const esc=s=>{if(!s)return'';const d=document.createElement('div');d.textContent=s;return d.innerHTML;};
const fmt=n=>'₦'+Number(n||0).toLocaleString('en-NG');
const openM=id=>$(id).classList.add('on');
const closeM=id=>$(id).classList.remove('on');
window.onclick=e=>{if(e.target.classList.contains('modal'))e.target.classList.remove('on');};
document.onkeydown=e=>{if(e.key==='Escape')document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));};
function genId(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='BLOOM-';for(let i=0;i<6;i++)s+=c[Math.floor(Math.random()*c.length)];return s;}

async function log(msg){
  const local=JSON.parse(localStorage.getItem('ad_act')||'[]');
  local.unshift({message:msg,timestamp:new Date().toISOString()});
  localStorage.setItem('ad_act',JSON.stringify(local.slice(0,60)));
  SQ.push({t:'logActivity',d:{message:msg,timestamp:new Date()}});
  renderActivity();
}

// ── Login ──────────────────────────────────────────────────────────────────
async function doLogin(){
  const pwd=$('l-pwd').value;
  const btn=$('l-btn');btn.textContent='Checking...';btn.disabled=true;
  const errEl=$('l-err'); errEl.style.display='none';

  // EMERGENCY ACCESS — pure client-side check, zero network calls of any
  // kind (no Firebase Auth, no Firestore). Added 2026-08-03 after repeated
  // lockouts where BOTH Firebase Auth and the Firestore backup password
  // failed to load. This always works regardless of connection state.
  // Change this string any time from inside this file — it's just a
  // plain comparison, nothing stored remotely to go stale or be unreachable.
  if(pwd === 'AariNAT-Emergency-2026!'){
    localStorage.setItem('ad_auth','1'); localStorage.setItem('ad_auth_time', Date.now().toString());
    $('login-screen').style.display='none';
    $('main-app').style.display='block';
    SQ.ping();
    await initAdmin();
    btn.textContent='🔓 Enter'; btn.disabled=false;
    return;
  }

  // Try real Firebase Auth first (own project, no third party involved).
  try{
    await firebase.auth().signInWithEmailAndPassword(ADMIN_EMAIL, pwd);
    localStorage.setItem('ad_auth','1'); localStorage.setItem('ad_auth_time', Date.now().toString());
    $('login-screen').style.display='none';
    $('main-app').style.display='block';
    SQ.ping();
    await initAdmin();
    btn.textContent='🔓 Enter'; btn.disabled=false;
    return;
  }catch(authErr){
    // Any failure here — network or wrong password — falls through to the
    // Firestore backup below rather than failing outright. Restored
    // 2026-08-02 after auth/network-request-failed locked Bayo out even
    // with the correct password, because Firestore was still reachable
    // when identitytoolkit.googleapis.com specifically wasn't.
    console.warn('Firebase Auth failed, trying backup password:', authErr?.code, authErr?.message);
  }

  // Backup: Firestore-stored password (Settings → Backup Admin Password).
  let stored='aarinat2024';
  try{const doc=await db.collection('admin_settings').doc('main').get();if(doc.exists&&doc.data().adminPassword)stored=doc.data().adminPassword;}catch(e){}
  if(pwd!==stored){
    errEl.textContent='Incorrect password. (Tried Firebase Auth and the backup password — neither matched. If you know Firebase Auth is right and this is a network issue, try again on a different connection.)';
    errEl.style.display='block';
    btn.textContent='🔓 Enter'; btn.disabled=false;
    return;
  }
  localStorage.setItem('ad_auth','1'); localStorage.setItem('ad_auth_time', Date.now().toString());
  $('login-screen').style.display='none';
  $('main-app').style.display='block';
  SQ.ping();
  await initAdmin();
  btn.textContent='🔓 Enter'; btn.disabled=false;
}

function logout(){if(!confirm('Logout?'))return;localStorage.removeItem('ad_auth');localStorage.removeItem('ad_auth_time');firebase.auth().signOut().catch(()=>{});if(pendingUnsub)pendingUnsub();location.reload();}

async function forgotPassword(){
  const errEl=$('l-err');
  if(!confirm(`Send a password reset link to ${ADMIN_EMAIL}?`)) return;
  try{
    await firebase.auth().sendPasswordResetEmail(ADMIN_EMAIL);
    if(errEl){errEl.style.color='var(--money)';errEl.textContent='✅ Reset link sent to '+ADMIN_EMAIL+' — check your inbox (and spam folder).';errEl.style.display='block';}
  }catch(e){
    if(errEl){errEl.style.color='var(--danger)';errEl.textContent='Could not send reset email: '+(e.message||e);errEl.style.display='block';}
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────
function go(tab){
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on'));
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('on'));
  $(`sec-${tab}`).classList.add('on');
  const btn=document.querySelector(`[data-t="${tab}"]`);if(btn)btn.classList.add('on');
  if(tab==='dashboard') renderDashboard();
  if(tab==='approved')  renderApproved();
  if(tab==='agents')    renderAgents();
  if(tab==='ledger')    renderLedger();
  if(tab==='opps')      renderOpps();
  if(tab==='settings')  loadSettings();
  if(tab==='calendar'){ getTermCalendar().then(cal=>{ const sel=$('cal-state-select'); if(sel){ const states=Object.keys(cal).filter(s=>s!=='_default'); sel.innerHTML='<option value="_default">All States (Default)</option>'+states.map(s=>`<option value="${s}">${s}</option>`).join(''); } renderCalendarTable('_default',cal); }); }
}

// ── Init ───────────────────────────────────────────────────────────────────
async function initAdmin(){
  // seed if empty
  try{
    const ag=await db.collection('admin_agents').get();
    if(ag.empty){
      await db.collection('admin_agents').add({name:'John Doe',phone:'2348012345678',commission:20,joinedAt:new Date()});
      await db.collection('admin_agents').add({name:'Grace Okonkwo',phone:'2348098765432',commission:20,joinedAt:new Date()});
    }
    const sd=await db.collection('admin_settings').doc('main').get();
    if(!sd.exists)await db.collection('admin_settings').doc('main').set({adminPassword:'aarinat2024',defaultSchoolPassword:'bloom2026',autoCAC:'full',whatsappTemplate:'*Welcome to Educational Bloom!* 🎉\n\nYour school has been activated.\n\n*School ID:* {{schoolId}}\n*Password:* {{password}}\n*Portal:* https://school.edubloom.com.ng\n\nLog in and start recovering your fees.\n– AariNAT Admin'});
    const cac=await db.collection('admin_cac').doc('progress').get();
    if(!cac.exists)await db.collection('admin_cac').doc('progress').set({raised:0});
    // demo pending deal
    const deals=await db.collection('admin_deals').get();
    if(deals.empty){
      await db.collection('admin_deals').add({timestamp:new Date(),status:'pending',agent:{id:'demo',name:'John Doe',phone:'2348012345678',commission:20},school:{name:'Demo Academy',phone:'2348011112222',email:'admin@demo.edu.ng',studentCount:75},tier:{name:'Small (51–100)',price:20000},terms:1,notes:'Demo deal — approve to test the full activation flow'});
    }
  }catch(e){console.warn('seed:',e);}
  syncOcrKeysToPublic(true).catch(e=>console.warn('auto OCR key sync failed:',e.message)); // silent, non-blocking — keeps agent/school apps current every session
  getTermCalendar().catch(()=>{}); // pre-warm calendar cache so first approval calculates expiry correctly
  await renderDashboard();
  startPendingListener();
  go('dashboard');
}

// ── Real-time pending listener ─────────────────────────────────────────────
function startPendingListener(){
  if(!db)return;
  if(pendingUnsub)pendingUnsub();
  pendingUnsub=db.collection('admin_deals').where('status','==','pending').onSnapshot(snap=>{
    const deals=snap.docs.map(d=>({id:d.id,...d.data()}));
    $('pending-badge').textContent=deals.length;
    $('d-pending').textContent=deals.length;
    renderPendingList(deals);
  },err=>console.warn('listener:',err));
}

function renderPendingList(deals){
  const c=$('pending-list');
  if(!deals.length){c.innerHTML='<p style="text-align:center;color:var(--sub);padding:2rem;">✅ No pending deals.</p>';return;}
  c.innerHTML=deals.map(d=>{
    const comm=Math.round((d.tier?.price||0)*((d.agent?.commission||20)/100)*(d.terms||1));
    const ts=d.timestamp?.toDate?d.timestamp.toDate():d.timestamp?new Date(d.timestamp):null;
    const tsLabel=ts?ts.toLocaleString('en-NG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    // Detect deals where codes were generated but approval write failed (schoolId already allocated)
    const stuckDeal = !!d.schoolId;
    return`<div class="deal pend" style="${stuckDeal?'border-left:3px solid #f59e0b;':''}">
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:4px;">
        <span class="chip cp">PENDING</span>
        ${stuckDeal?`<span class="chip" style="background:#f59e0b;color:#fff;">⚠️ CODES ISSUED — STUCK</span>`:''}
        ${tsLabel?`<span style="font-size:0.68rem;color:var(--sub);margin-left:auto;">🕐 ${tsLabel}</span>`:''}
      </div>
      <div class="dn">${esc(d.school?.name)}</div>
      <div class="dm">Agent: ${esc(d.agent?.name)} · ${d.school?.studentCount||0} students</div>
      <div class="dm">📱 ${esc(d.school?.phone)}</div>
      <div class="dm" style="color:var(--text);font-weight:600;">${fmt(d.tier?.price)}/term · Your commission: ${fmt(comm)}</div>
      ${d.notes?`<div class="dm" style="font-style:italic;margin-top:4px;">"${esc(d.notes)}"</div>`:''}
      ${stuckDeal?`<div class="dm" style="font-size:0.72rem;color:#f59e0b;background:rgba(245,158,11,0.08);border-radius:5px;padding:3px 6px;margin-top:4px;">
        🆔 ID already assigned: <b style="font-family:monospace;">${d.schoolId}</b> — click Re-Apply to complete activation.
      </div>`:''}
      <div class="dact">
        ${stuckDeal
          ? `<button class="btn-g btn-sm" onclick="reApproveStuck('${d.id}','${d.schoolId}')">🔄 Re-Apply Approval</button>`
          : `<button class="btn-g btn-sm" onclick="openApproveModal('${d.id}')">✅ Approve</button>`
        }
        <button class="btn-d btn-sm" onclick="rejectDeal('${d.id}','${esc(d.school?.name)}')">❌ Reject</button>
      </div>
    </div>`;
  }).join('');
}

// Re-apply approval for a deal where codes were issued but the Firestore write failed
async function reApproveStuck(dealId, existingSchoolId){
  const doc = await db.collection('admin_deals').doc(dealId).get().catch(()=>null);
  if(!doc||!doc.exists){ alert('Deal not found.'); return; }
  const deal = doc.data();
  const sd = await db.collection('admin_settings').doc('main').get().catch(()=>null);
  const defPwd = sd?.exists?(sd.data().defaultSchoolPassword||'bloom2026'):'bloom2026';
  approvalData = { id:dealId, deal, schoolId:existingSchoolId, password:defPwd };
  // Show confirmation before re-running
  if(!confirm(`Re-apply approval for ${deal.school?.name}?\n\nSchool ID: ${existingSchoolId}\nPassword: ${defPwd}\n\nThis will re-write all records and send WhatsApp credentials.`)) return;
  await confirmApproval();
}

// ══════════════════════════════════════════════════════════
// NIGERIA SCHOOL TERM CALENDAR
// Academic year: Sept → July (3 terms)
// Each entry: resumption = first day of term, vacation = last day of term
// Edit via openCalendarEditor() or directly in Firestore admin_settings/main.termCalendar
// ══════════════════════════════════════════════════════════

const DEFAULT_TERM_CALENDAR = {
  // Format: year_termN: { resumption: 'YYYY-MM-DD', vacation: 'YYYY-MM-DD' }
  // These are defaults — Bayo can override per-state in Settings → Calendar
  '_default': {
    '2025_term1': { resumption:'2025-09-22', vacation:'2025-12-13' },
    '2025_term2': { resumption:'2026-01-05', vacation:'2026-04-04' },
    '2026_term3': { resumption:'2026-04-27', vacation:'2026-07-25' },
    '2026_term1': { resumption:'2026-09-21', vacation:'2026-12-12' },
    '2026_term2': { resumption:'2027-01-04', vacation:'2027-04-03' },
    '2027_term3': { resumption:'2027-04-26', vacation:'2027-07-24' },
  },
  'Lagos': {
    '2025_term1': { resumption:'2025-09-15', vacation:'2025-12-06' },
    '2025_term2': { resumption:'2025-12-29', vacation:'2026-03-28' },
    '2026_term3': { resumption:'2026-04-20', vacation:'2026-07-18' },
    '2026_term1': { resumption:'2026-09-14', vacation:'2026-12-05' },
    '2026_term2': { resumption:'2026-12-28', vacation:'2027-03-27' },
    '2027_term3': { resumption:'2027-04-19', vacation:'2027-07-17' },
  },
  'Ogun': {
    '2025_term1': { resumption:'2025-09-22', vacation:'2025-12-13' },
    '2025_term2': { resumption:'2026-01-05', vacation:'2026-04-04' },
    '2026_term3': { resumption:'2026-04-27', vacation:'2026-07-25' },
    '2026_term1': { resumption:'2026-09-21', vacation:'2026-12-12' },
    '2026_term2': { resumption:'2027-01-04', vacation:'2027-04-03' },
    '2027_term3': { resumption:'2027-04-26', vacation:'2027-07-24' },
  },
  'Oyo': {
    '2025_term1': { resumption:'2025-09-22', vacation:'2025-12-13' },
    '2025_term2': { resumption:'2026-01-05', vacation:'2026-04-04' },
    '2026_term3': { resumption:'2026-04-27', vacation:'2026-07-25' },
    '2026_term1': { resumption:'2026-09-21', vacation:'2026-12-12' },
    '2026_term2': { resumption:'2027-01-04', vacation:'2027-04-03' },
    '2027_term3': { resumption:'2027-04-26', vacation:'2027-07-24' },
  },
  'Osun': {
    '2025_term1': { resumption:'2025-09-22', vacation:'2025-12-13' },
    '2025_term2': { resumption:'2026-01-05', vacation:'2026-04-04' },
    '2026_term3': { resumption:'2026-04-27', vacation:'2026-07-25' },
    '2026_term1': { resumption:'2026-09-21', vacation:'2026-12-12' },
    '2026_term2': { resumption:'2027-01-04', vacation:'2027-04-03' },
    '2027_term3': { resumption:'2027-04-26', vacation:'2027-07-24' },
  },
  'Ondo': {
    '2025_term1': { resumption:'2025-09-22', vacation:'2025-12-13' },
    '2025_term2': { resumption:'2026-01-05', vacation:'2026-04-04' },
    '2026_term3': { resumption:'2026-04-27', vacation:'2026-07-25' },
    '2026_term1': { resumption:'2026-09-21', vacation:'2026-12-12' },
    '2026_term2': { resumption:'2027-01-04', vacation:'2027-04-03' },
    '2027_term3': { resumption:'2027-04-26', vacation:'2027-07-24' },
  },
  'Ekiti': {
    '2025_term1': { resumption:'2025-09-22', vacation:'2025-12-13' },
    '2025_term2': { resumption:'2026-01-06', vacation:'2026-04-04' },
    '2026_term3': { resumption:'2026-04-27', vacation:'2026-07-25' },
    '2026_term1': { resumption:'2026-09-21', vacation:'2026-12-12' },
    '2026_term2': { resumption:'2027-01-04', vacation:'2027-04-03' },
    '2027_term3': { resumption:'2027-04-26', vacation:'2027-07-24' },
  },
  'FCT': {
    '2025_term1': { resumption:'2025-09-22', vacation:'2025-12-13' },
    '2025_term2': { resumption:'2026-01-05', vacation:'2026-04-04' },
    '2026_term3': { resumption:'2026-04-27', vacation:'2026-07-18' },
    '2026_term1': { resumption:'2026-09-21', vacation:'2026-12-12' },
    '2026_term2': { resumption:'2027-01-04', vacation:'2027-04-03' },
    '2027_term3': { resumption:'2027-04-26', vacation:'2027-07-18' },
  },
  'Rivers': {
    '2025_term1': { resumption:'2025-09-22', vacation:'2025-12-13' },
    '2025_term2': { resumption:'2026-01-05', vacation:'2026-04-04' },
    '2026_term3': { resumption:'2026-04-27', vacation:'2026-07-25' },
    '2026_term1': { resumption:'2026-09-21', vacation:'2026-12-12' },
    '2026_term2': { resumption:'2027-01-04', vacation:'2027-04-03' },
    '2027_term3': { resumption:'2027-04-26', vacation:'2027-07-24' },
  },
  'Kano': {
    '2025_term1': { resumption:'2025-10-06', vacation:'2025-12-20' },
    '2025_term2': { resumption:'2026-01-12', vacation:'2026-04-11' },
    '2026_term3': { resumption:'2026-05-04', vacation:'2026-08-01' },
    '2026_term1': { resumption:'2026-10-05', vacation:'2026-12-19' },
    '2026_term2': { resumption:'2027-01-11', vacation:'2027-04-10' },
    '2027_term3': { resumption:'2027-05-03', vacation:'2027-07-31' },
  },
  'Kaduna': {
    '2025_term1': { resumption:'2025-10-06', vacation:'2025-12-20' },
    '2025_term2': { resumption:'2026-01-12', vacation:'2026-04-11' },
    '2026_term3': { resumption:'2026-05-04', vacation:'2026-08-01' },
    '2026_term1': { resumption:'2026-10-05', vacation:'2026-12-19' },
    '2026_term2': { resumption:'2027-01-11', vacation:'2027-04-10' },
    '2027_term3': { resumption:'2027-05-03', vacation:'2027-07-31' },
  },
};
let _calendarCache = null;

async function getTermCalendar(){
  if(_calendarCache) return _calendarCache;
  try{
    const sd = await db.collection('admin_settings').doc('main').get();
    if(sd.exists && sd.data().termCalendar){
      _calendarCache = {...DEFAULT_TERM_CALENDAR, ...sd.data().termCalendar};
      return _calendarCache;
    }
  }catch(e){ console.warn('Calendar load failed, using defaults:', e); }
  _calendarCache = DEFAULT_TERM_CALENDAR;
  return _calendarCache;
}

// Figure out which term key is active on a given date
function currentTermKey(date, stateCalendar){
  const yr = date.getFullYear();
  // Check all keys in the calendar to find which term this date falls within
  const keys = Object.keys(stateCalendar);
  for(const k of keys){
    const t = stateCalendar[k];
    const res = new Date(t.resumption);
    const vac = new Date(t.vacation);
    if(date >= res && date <= vac) return k;
  }
  // Not currently in a term — find the next upcoming term
  let soonest = null, soonestKey = null;
  for(const k of keys){
    const res = new Date(stateCalendar[k].resumption);
    if(res > date && (!soonest || res < soonest)){
      soonest = res; soonestKey = k;
    }
  }
  return soonestKey;
}

// Calculate when N terms expire based on state calendar
// Falls back to 3 months/term if no calendar data found
function calcTermExpiry(fromDate, stateName, terms){
  const cal = _calendarCache || DEFAULT_TERM_CALENDAR;
  const stateCal = cal[stateName] || cal['_default'];
  if(!stateCal){ const d=new Date(fromDate); d.setMonth(d.getMonth()+terms*3); return d; }
  
  let termKey = currentTermKey(fromDate, stateCal);
  const allKeys = Object.keys(stateCal).sort();
  
  if(!termKey){
    // Before the first term — expiry = fromDate + terms*3 months (fallback)
    const d = new Date(fromDate); d.setMonth(d.getMonth()+terms*3); return d;
  }
  
  // Walk forward N terms from current
  let idx = allKeys.indexOf(termKey);
  idx = Math.min(idx + terms - 1, allKeys.length - 1);
  const finalKey = allKeys[idx];
  return finalKey ? new Date(stateCal[finalKey].vacation) : (()=>{const d=new Date(fromDate);d.setMonth(d.getMonth()+terms*3);return d;})();
}

// ── Calendar Editor UI ────────────────────────────────────────────────────
async function openCalendarEditor(){
  const cal = await getTermCalendar();
  const states = Object.keys(cal).filter(s=>s!=='_default');
  const TERM_LABELS = {
    '2025_term1':'2025/26 Term 1','2025_term2':'2025/26 Term 2','2026_term3':'2025/26 Term 3',
    '2026_term1':'2026/27 Term 1','2026_term2':'2026/27 Term 2','2027_term3':'2026/27 Term 3',
  };
  const allTermKeys = Object.keys(TERM_LABELS);
  
  // Build editor for default + each state
  const stateOptions = ['_default',...states].map(s=>
    `<option value="${s}">${s==='_default'?'All States (Default)':s}</option>`
  ).join('');
  
  const $m = document.getElementById('calendar-modal');
  if(!$m){ alert('Calendar modal not found — reload the page.'); return; }
  
  document.getElementById('cal-state-select').innerHTML = stateOptions;
  renderCalendarTable('_default', cal);
  $m.classList.add('on');
}

function renderCalendarTable(stateName, cal){
  const TERM_LABELS = {
    '2025_term1':'2025/26 Term 1','2025_term2':'2025/26 Term 2','2026_term3':'2025/26 Term 3',
    '2026_term1':'2026/27 Term 1','2026_term2':'2026/27 Term 2','2027_term3':'2026/27 Term 3',
  };
  const stateCal = (cal||_calendarCache||DEFAULT_TERM_CALENDAR)[stateName] || {};
  const rows = Object.keys(TERM_LABELS).map(key=>{
    const t = stateCal[key] || {resumption:'',vacation:''};
    const res = t.resumption; const vac = t.vacation;
    const today = new Date();
    const resDate = res?new Date(res):null;
    const vacDate = vac?new Date(vac):null;
    const isActive = resDate && vacDate && today >= resDate && today <= vacDate;
    const days = resDate && vacDate ? Math.round((vacDate-resDate)/(1000*60*60*24)) : 0;
    return `<tr style="${isActive?'background:rgba(16,185,129,0.08);':''}">
      <td style="font-weight:600;font-size:0.82rem;">${TERM_LABELS[key]}${isActive?'<span style="font-size:0.65rem;color:#10b981;margin-left:4px;">● ACTIVE</span>':''}</td>
      <td><input type="date" id="cal_res_${key}" value="${res}" style="background:var(--card);border:1px solid var(--border);border-radius:5px;padding:2px 6px;color:var(--text);font-size:0.8rem;"></td>
      <td><input type="date" id="cal_vac_${key}" value="${vac}" style="background:var(--card);border:1px solid var(--border);border-radius:5px;padding:2px 6px;color:var(--text);font-size:0.8rem;"></td>
      <td style="font-size:0.78rem;color:var(--sub);">${days?days+' days':'—'}</td>
    </tr>`;
  }).join('');
  
  const el = document.getElementById('cal-table-body');
  if(el) el.innerHTML = rows;
  const lbl = document.getElementById('cal-state-label');
  if(lbl) lbl.textContent = stateName==='_default'?'All States (Default)':stateName;
}

async function saveCalendarState(){
  const selEl = document.getElementById('cal-state-select');
  if(!selEl) return;
  const stateName = selEl.value;
  const TERM_KEYS = ['2025_term1','2025_term2','2026_term3','2026_term1','2026_term2','2027_term3'];
  const stateData = {};
  for(const key of TERM_KEYS){
    const res = document.getElementById(`cal_res_${key}`)?.value||'';
    const vac = document.getElementById(`cal_vac_${key}`)?.value||'';
    if(res||vac) stateData[key]={resumption:res,vacation:vac};
  }
  const cal = await getTermCalendar();
  cal[stateName] = stateData;
  _calendarCache = cal;
  // Persist to Firestore
  try{
    await db.collection('admin_settings').doc('main').set({termCalendar:{[stateName]:stateData}},{merge:true});
    const info=document.getElementById('cal-save-info');
    if(info){info.textContent='✅ Saved '+new Date().toLocaleTimeString();info.style.color='#10b981';}
  }catch(e){
    const info=document.getElementById('cal-save-info');
    if(info){info.textContent='⚠️ Save failed: '+(e.message||e);info.style.color='#ef4444';}
  }
}

function onCalStateChange(){
  const sel = document.getElementById('cal-state-select');
  if(!sel) return;
  renderCalendarTable(sel.value, _calendarCache||DEFAULT_TERM_CALENDAR);
}

function addCalendarState(){
  const name = prompt('Enter new state name (e.g. Kwara, Kogi, Benue):','')?.trim();
  if(!name) return;
  const cal = _calendarCache || DEFAULT_TERM_CALENDAR;
  if(!cal[name]) cal[name] = {...(cal['_default']||{})};
  _calendarCache = cal;
  const sel = document.getElementById('cal-state-select');
  if(sel){ 
    const opt=document.createElement('option'); opt.value=name; opt.textContent=name; 
    sel.appendChild(opt); sel.value=name; 
  }
  renderCalendarTable(name, cal);
}

// ── Approve ────────────────────────────────────────────────────────────────
async function openApproveModal(dealId){
  let deal;
  try{const doc=await db.collection('admin_deals').doc(dealId).get();if(!doc.exists)return alert('Deal not found.');deal=doc.data();}
  catch(e){alert('Connection error.');return;}
  const sd=await db.collection('admin_settings').doc('main').get().catch(()=>null);
  const defPwd=sd?.exists?(sd.data().defaultSchoolPassword||'bloom2026'):'bloom2026';
  const schoolId=genId();
  const scanned = deal.scannedStudents || [];
  const scannedPreview = scanned.length
    ? '<div style="margin-top:0.5rem;"><b>🤖 AI-Scanned Students (' + scanned.length + '):</b><div style="max-height:80px;overflow-y:auto;margin-top:4px;">' +
      scanned.slice(0,10).map(s=>'<span style="display:inline-block;background:rgba(124,58,237,0.15);border-radius:4px;padding:1px 6px;margin:2px;font-size:0.72rem;color:#a78bfa;">' + esc(s.name||s) + '</span>').join('') +
      (scanned.length > 10 ? '<span style="font-size:0.7rem;color:var(--sub);">...+' + (scanned.length-10) + ' more</span>' : '') +
      '</div></div>'
    : '<div style="margin-top:0.4rem;font-size:0.75rem;color:#f59e0b;">⚠️ No AI-scanned names — students will need manual entry.</div>';

  $('ap-preview').innerHTML=`<div style="background:#080f1a;padding:0.75rem;border-radius:8px;font-size:0.85rem;line-height:1.8;">\n    <div><b>School:</b> ${esc(deal.school?.name)}</div>\n    <div><b>Principal WhatsApp:</b> ${esc(deal.school?.phone)}</div>\n    <div><b>Students:</b> ${deal.school?.studentCount||0} (agent reported)</div>\n    <div><b>Tier:</b> ${esc(deal.tier?.name)} · ${fmt(deal.tier?.price)}/term</div>\n    <div><b>Agent:</b> ${esc(deal.agent?.name)} · ${esc(deal.agent?.phone)}</div>\n    ${scannedPreview}\n  </div>`;
  $('ap-id').textContent=schoolId;
  $('ap-pwd').textContent=defPwd;
  approvalData={id:dealId,deal,schoolId,password:defPwd};
  openM('approve-modal');
}

async function confirmApproval(){
  if(!approvalData)return;
  const{id,deal,schoolId,password}=approvalData;
  const commission=Math.round((deal.tier?.price||0)*((deal.agent?.commission||20)/100)*(deal.terms||1));
  const TS = firebase.firestore.FieldValue.serverTimestamp;

  // ── STEP 1 (CRITICAL): Mark deal approved — DIRECT write, NOT through SQ
  // Using direct write so the real-time listener fires immediately and the
  // deal disappears from the pending list. SQ is unreliable here because
  // a failed SQ item has no user-visible error and the deal stays stuck.
  try {
    await db.collection('admin_deals').doc(id).update({
      status: 'approved',
      schoolId,
      approvedAt: TS()
    });
  } catch(writeErr) {
    const errMsg = writeErr?.code === 'permission-denied'
      ? 'Permission denied — you may need to log in with the main password instead of Emergency Access.'
      : (writeErr?.message || String(writeErr));
    alert(`⚠️ APPROVAL FAILED — deal not updated.\n\n${errMsg}\n\n📋 WRITE THESE DOWN:\nSchool ID: ${schoolId}\nPassword: ${password}\n\nFix the connection issue and click "Re-Apply Approval" on this deal.`);
    // Store the schoolId on the deal so the stuck-deal banner appears
    SQ.push({t:'updateDeal',id,d:{schoolId}});
    closeM('approve-modal');
    approvalData=null;
    return;
  }

  // 2. Add to approved schools list
  // Calculate payment expiry — use term calendar if available, else 3 months per term
  const now = new Date();
  const expiryDate = calcTermExpiry(now, deal.school?.state||'', deal.terms||1);
  const schoolRecord = {
    schoolId,
    schoolName: deal.school?.name,
    principalPhone: deal.school?.phone,
    principalEmail: deal.school?.email||'',
    password,
    tier: deal.tier?.name,
    tierPrice: deal.tier?.price,
    agentName: deal.agent?.name,
    agentPhone: deal.agent?.phone,
    agentId: deal.agent?.id||'',
    approvedAt: TS(),
    activatedAt: TS(),          // human-readable activation timestamp
    state: deal.school?.state||'',
    termsPaid: deal.terms||1,
    termsRemaining: deal.terms||1,
    expiryDate: expiryDate,
    paymentStatus: 'active',
    studentCount: deal.school?.studentCount||0,
    scannedCount: deal.scannedCount||0,
    renewalReminderSent: false,
    lastRenewalCheck: now
  };
  // Direct write so the approved list updates immediately
  try {
    await db.collection('admin_approved_schools').doc(schoolId).set(schoolRecord, {merge:true});
  } catch(e) {
    console.warn('addSchoolRecord direct write failed, queuing:', e);
    SQ.push({t:'addSchoolRecord',id:schoolId,d:{...schoolRecord, approvedAt:now, activatedAt:now}});
  }
  // 3. Create actual school account — DIRECT write so portal login works immediately
  const schoolDoc = {
    config:{
      plan:'basic',fee:50000,
      schoolName:deal.school?.name||'',
      principalEmail:deal.school?.email||'',
      whatsapp:deal.school?.phone||'',
      studentCount:deal.school?.studentCount||0,
      tier:deal.tier?.name||'',
      tierPrice:deal.tier?.price||0,
      createdAt:new Date().toISOString(),
      trialStart:new Date().toISOString(),
      // Agent contact — surfaces in school portal Support tab
      agent:{
        name:deal.agent?.name||'',
        phone:deal.agent?.phone||'',
        agentId:deal.agent?.id||''
      }
    },
    staff:[{name:'Principal',email:deal.school?.email||(schoolId.toLowerCase()+'@bloom.edu.ng'),password,role:'Principal',phone:deal.school?.phone||''}],
    students: (deal.scannedStudents||[]).map((s,i)=>({
      id: 'S' + String(i+1).padStart(4,'0'),
      name: s.name || s,
      class: s.class || '',
      fees: { paid: 0, balance: deal.tier?.price || 0, history: [] },
      attendance: {},
      scores: {}
    })),
    expenses:[],attendance:{},sports:{teams:{},custom:[]},arts:{gallery:[]},
    music:{practiceLogs:[],instruments:[]},health:[],alumni:[],socialPages:[],commsLog:[],opportunities:[]
  };
  try {
    await db.collection('schools').doc(schoolId).set(schoolDoc,{merge:true});
    console.log('✅ School created in Firestore:', schoolId);
  } catch(e) {
    console.warn('Direct write failed, queuing fallback:', e);
    SQ.push({t:'createSchool',id:schoolId,d:schoolDoc});
  }
  // 4. Commission ledger entry
  SQ.push({t:'addLedger',id:id+'_comm',d:{dealId:id,schoolId,agent:deal.agent?.name,agentPhone:deal.agent?.phone,amount:commission,paid:false,date:new Date()}});
  // 5. CAC allocation
  try{
    const sd=await db.collection('admin_settings').doc('main').get();
    const autoCAC=sd.exists?(sd.data().autoCAC||'full'):'full';
    const cacDoc=await db.collection('admin_cac').doc('progress').get();
    let raised=cacDoc.exists?(cacDoc.data().raised||0):0;
    if(autoCAC==='full')raised+=commission;
    else if(autoCAC==='half')raised+=Math.round(commission/2);
    SQ.push({t:'updateCAC',d:{raised,updatedAt:new Date()}});
    updateCACDisplay(raised);
    // 6. WhatsApp credentials
    const tpl=sd.exists?(sd.data().whatsappTemplate||''):'';
    const msg=tpl.replace(/{{schoolId}}/g,schoolId).replace(/{{password}}/g,password);
    window.open(`https://wa.me/${(deal.school?.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,'_blank');
  }catch(e){console.warn('CAC/WA:',e);}

  await log(`✅ Approved: ${deal.school?.name} → ${schoolId} · ${fmt(commission)} commission`);
  closeM('approve-modal');
  approvalData=null;
  renderDashboard();
  renderApproved();
}

// ══════════════════════════════════════════════════════════
// PAYMENT LIFECYCLE MONITOR
// ══════════════════════════════════════════════════════════

// Called from dashboard — checks all active schools for expiry
async function checkPaymentHealth() {
  try {
    const snap = await db.collection('admin_approved_schools').get();
    const now = new Date();
    let expired=0, expiringSoon=0, active=0;

    const updates = [];
    snap.docs.forEach(doc => {
      const s = doc.data();
      if (!s.expiryDate) return;
      const expiry = s.expiryDate.toDate ? s.expiryDate.toDate() : new Date(s.expiryDate);
      const daysLeft = Math.ceil((expiry - now) / (1000*60*60*24));

      if (daysLeft < 0) {
        expired++;
        updates.push({ id: doc.id, data: { paymentStatus: 'expired' } });
      } else if (daysLeft <= 14) {
        expiringSoon++;
        updates.push({ id: doc.id, data: { paymentStatus: 'expiring_soon', daysLeft } });
      } else {
        active++;
      }
    });

    // Batch update statuses
    for (const u of updates) {
      SQ.push({t:'updateSchoolRecord', id: u.id, d: u.data});
    }

    // Show summary banner
    renderPaymentHealthBanner({ active, expiringSoon, expired });
    await log(`💳 Payment check: ${active} active, ${expiringSoon} expiring soon, ${expired} expired`);
  } catch(e) { console.warn('Payment health check failed:', e); }
}

function renderPaymentHealthBanner({active, expiringSoon, expired}) {
  let el = document.getElementById('payment-health-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'payment-health-banner';
    el.style.cssText = 'padding:0.6rem 1rem;border-radius:10px;margin-bottom:0.75rem;font-size:0.82rem;';
    const dash = document.getElementById('d-summary');
    if (dash) dash.parentNode.insertBefore(el, dash);
  }
  const hasIssues = expiringSoon > 0 || expired > 0;
  el.style.background = hasIssues ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)';
  el.style.border = hasIssues ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(16,185,129,0.3)';
  el.innerHTML = `\n    <div style="font-weight:700;margin-bottom:4px;">${hasIssues ? '⚠️ Payment Alert' : '✅ All Schools Current'}</div>\n    <div style="display:flex;gap:1rem;flex-wrap:wrap;">\n      <span style="color:#22c55e;">✅ Active: <b>${active}</b></span>\n      ${expiringSoon ? `<span style="color:#f59e0b;">⏰ Expiring Soon: <b>${expiringSoon}</b></span>` : ''}\n      ${expired ? `<span style="color:#ef4444;">❌ Expired: <b>${expired}</b> <button onclick="viewExpiredSchools()" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:0.75rem;">View</button></span>` : ''}\n    </div>`;
}

async function viewExpiredSchools() {
  try {
    const snap = await db.collection('admin_approved_schools')
      .where('paymentStatus','==','expired').get();
    if (snap.empty) { alert('No expired schools found.'); return; }
    const schools = snap.docs.map(d => d.data());
    const list = schools.map(s =>
      '• ' + s.schoolName + ' (' + s.schoolId + ')\n  Agent: ' + s.agentName + ' · ' + s.agentPhone + '\n  Principal: ' + s.principalPhone
    ).join('\n\n');
    alert('❌ EXPIRED SCHOOLS (' + schools.length + '):\n\n' + list + '\n\nContact agents to collect renewal.');
  } catch(e) { alert('Error: ' + e.message); }
}

// Send renewal reminder via WhatsApp to agent (not principal — agent collects)
function sendRenewalReminder(schoolId, schoolName, agentPhone, principalPhone, daysLeft) {
  const agentMsg = encodeURIComponent(
    `⏰ *EduBloom Renewal Alert*\n\n` +
    `*${schoolName}* (${schoolId}) expires in *${daysLeft} day${daysLeft===1?'':'s'}*.\n\n` +
    `Please collect the renewal fee and send payment confirmation to Bayo.\n\n` +
    `Tier renewal → contact: wa.me/2348145073941`
  );
  window.open(`https://wa.me/${(agentPhone||'').replace(/\D/g,'')}?text=${agentMsg}`, '_blank');
}

// Mark a school as renewed — extend expiry by N terms
async function renewSchool(schoolId, terms) {
  terms = terms || parseInt(prompt('How many terms to renew?','1')) || 1;
  if (!schoolId) return;
  try {
    const snap = await db.collection('admin_approved_schools').where('schoolId','==',schoolId).get();
    if (snap.empty) { alert('School not found.'); return; }
    const doc = snap.docs[0];
    const s = doc.data();
    const currentExpiry = s.expiryDate?.toDate ? s.expiryDate.toDate() : new Date();
    const newExpiry = new Date(currentExpiry);
    newExpiry.setMonth(newExpiry.getMonth() + (terms * 3));
    await db.collection('admin_approved_schools').doc(doc.id).update({
      expiryDate: newExpiry,
      paymentStatus: 'active',
      termsPaid: (s.termsPaid||0) + terms,
      renewedAt: new Date()
    });
    alert(`✅ ${s.schoolName} renewed for ${terms} term(s).\nNew expiry: ${newExpiry.toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}`);
    await log(`💳 Renewed: ${schoolId} · ${terms} term(s) · new expiry ${newExpiry.toLocaleDateString()}`);
    renderApproved();
  } catch(e) { alert('Renewal failed: ' + e.message); }
}

// Repair: re-creates the school Firestore document for already-approved schools
// Use this for schools approved before the direct-write fix
async function repairSchool(schoolId) {
  if(!schoolId) schoolId = prompt('Enter School ID to repair (e.g. BLOOM-CYW96U):');
  if(!schoolId) return;
  schoolId = schoolId.trim().toUpperCase();
  try {
    // Find the school record
    const snap = await db.collection('admin_approved_schools').where('schoolId','==',schoolId).get();
    if(snap.empty) { alert('School ID not found in approved schools list.'); return; }
    const s = snap.docs[0].data();
    const schoolDoc = {
      config:{plan:'basic',fee:50000,schoolName:s.schoolName||'',principalEmail:s.principalEmail||'',whatsapp:s.principalPhone||'',createdAt:new Date().toISOString()},
      staff:[{name:'Principal',email:s.principalEmail||(schoolId.toLowerCase()+'@bloom.edu.ng'),password:s.password,role:'Principal',phone:s.principalPhone||''}],
      students: (deal.scannedStudents||[]).map((s,i)=>({
      id: 'S' + String(i+1).padStart(4,'0'),
      name: s.name || s,
      class: s.class || '',
      fees: { paid: 0, balance: deal.tier?.price || 0, history: [] },
      attendance: {},
      scores: {}
    })),
    expenses:[],attendance:{},sports:{teams:{},custom:[]},arts:{gallery:[]},
      music:{practiceLogs:[],instruments:[]},health:[],alumni:[],socialPages:[],commsLog:[],opportunities:[]
    };
    await db.collection('schools').doc(schoolId).set(schoolDoc,{merge:true});
    alert('✅ School account repaired!\n\nSchool ID: '+schoolId+'\nPassword: '+s.password+'\n\nThe school can now login to the portal.');
    log('🔧 Repaired school account: '+schoolId);
  } catch(e) {
    alert('Repair failed: '+(e.message||e)+'\n\nCheck your internet connection.');
  }
}

async function rejectDeal(dealId,schoolName){
  if(!confirm(`Reject deal for "${schoolName}"?`))return;
  SQ.push({t:'updateDeal',id:dealId,d:{status:'rejected',rejectedAt:new Date()}});
  await log(`❌ Rejected: ${schoolName}`);
  renderDashboard();
}

// ── Dashboard ──────────────────────────────────────────────────────────────
async function renderDashboard(){
  try{
    const[appr,agents,ledger,cac]=await Promise.all([
      db.collection('admin_approved_schools').get(),
      db.collection('admin_agents').get(),
      db.collection('admin_ledger').get(),
      db.collection('admin_cac').doc('progress').get()
    ]);
    $('d-approved').textContent=appr.size;
    $('d-agents').textContent=agents.size;
    let total=0;ledger.forEach(d=>total+=d.data().amount||0);
    $('d-commission').textContent=fmt(total);
    const raised=cac.exists?(cac.data().raised||0):0;
    updateCACDisplay(raised);
  }catch(e){console.warn('dashboard:',e);}
  renderActivity();
}

async function renderActivity(){
  const c=$('activity-feed');if(!c)return;
  let logs=[];
  try{logs=(await db.collection('admin_activity').orderBy('timestamp','desc').limit(10).get()).docs.map(d=>d.data());}
  catch(e){logs=JSON.parse(localStorage.getItem('ad_act')||'[]');}
  if(!logs.length){c.innerHTML='<em style="color:var(--sub);">No activity yet.</em>';return;}
  c.innerHTML=logs.map(l=>{
    const t=l.timestamp?.toDate?l.timestamp.toDate():new Date(l.timestamp);
    return`<div style="padding:0.4rem 0;border-bottom:1px solid var(--border);font-size:0.82rem;"><span style="font-size:0.7rem;color:var(--sub);">${t.toLocaleString('en-NG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span><br>${esc(l.message)}</div>`;
  }).join('');
}

// ── CAC ────────────────────────────────────────────────────────────────────
function updateCACDisplay(raised){
  const pct=Math.min(100,Math.round((raised/250000)*100));
  $('cac-fill').style.width=pct+'%';
  $('cac-raised').textContent=fmt(raised);
  $('cac-left').textContent=fmt(Math.max(0,250000-raised));
}

async function addCAC(){
  const amt=parseFloat($('cac-amt').value);
  const note=$('cac-note').value.trim()||'Manual contribution';
  if(!amt||amt<=0)return alert('Enter a valid amount.');
  let raised=0;
  try{const doc=await db.collection('admin_cac').doc('progress').get();raised=doc.exists?(doc.data().raised||0):0;}catch(e){}
  raised+=amt;
  SQ.push({t:'updateCAC',d:{raised,updatedAt:new Date()}});
  $('cac-amt').value='';$('cac-note').value='';
  updateCACDisplay(raised);
  log(`💰 CAC +${fmt(amt)} — ${note}`);
}

// ── Approved ───────────────────────────────────────────────────────────────
async function renderApproved(){
  let schools=[];
  let liveData={};
  try{
    schools=(await db.collection('admin_approved_schools').get()).docs.map(d=>({_id:d.id,...d.data()}));
    // Fetch live data (studentCount, tierExceeded) from schools collection
    const snaps = await Promise.allSettled(
      schools.map(s=>db.collection('schools').doc(s.schoolId).get())
    );
    snaps.forEach((r,i)=>{
      if(r.status==='fulfilled'&&r.value.exists){
        const cfg=r.value.data().config||{};
        liveData[schools[i].schoolId]={
          studentCount: cfg.studentCount||0,
          tierExceededAt: cfg.tierExceededAt||null,
          tierExceededNewTier: cfg.tierExceededNewTier||null,
          plan: cfg.plan||'basic',
          tierMax: cfg.tierMax||0
        };
      }
    });
  }catch(e){ console.error('renderApproved:',e); }
  const q=($('search-approved')?.value||'').toLowerCase();
  if(q)schools=schools.filter(s=>(s.schoolName||'').toLowerCase().includes(q)||(s.schoolId||'').toLowerCase().includes(q));
  const c=$('approved-list');
  if(!schools.length){c.innerHTML='<p style="text-align:center;color:var(--sub);padding:2rem;">No approved schools.</p>';return;}

  const TIERS=[
    {max:50,  price:10000, name:'Starter (1–50)'},
    {max:100, price:20000, name:'Small (51–100)'},
    {max:200, price:35000, name:'Medium (101–200)'},
    {max:350, price:55000, name:'Large (201–350)'},
    {max:9999,price:75000, name:'Enterprise (351+)'}
  ];
  function getTierByMax(max){ return TIERS.find(t=>t.max>=max)||TIERS[TIERS.length-1]; }

  c.innerHTML=schools.map(s=>{
    const live=liveData[s.schoolId]||{};
    const count=live.studentCount||0;
    const isPrem=live.plan==='premium';
    const tierExceeded=!!live.tierExceededAt;
    const tierMax=live.tierMax||TIERS.find(t=>(s.tierPrice||0)<=t.price)?.max||50;
    const newTier=live.tierExceededNewTier||{};

    // Payment expiry
    const expiry = s.expiryDate?.toDate ? s.expiryDate.toDate() : (s.expiryDate ? new Date(s.expiryDate) : null);
    const daysLeft = expiry ? Math.ceil((expiry - new Date()) / (1000*60*60*24)) : null;
    const payStatus = s.paymentStatus || 'active';
    const expiryLabel = expiry ? expiry.toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'}) : '—';
    const payChip = payStatus === 'expired'
      ? `<span class="chip" style="background:#dc2626;color:#fff;">❌ EXPIRED</span>`
      : daysLeft !== null && daysLeft <= 14
        ? `<span class="chip" style="background:#f59e0b;color:#fff;">⏰ ${daysLeft}d left</span>`
        : `<span class="chip ca">✅ PAID</span>`;

    const statusChip = tierExceeded
      ? `<span class="chip" style="background:#7c3aed;color:#fff;">⚠️ OVER TIER</span>`
      : payChip;
    const planChip = isPrem
      ? `<span class="chip" style="background:#7c3aed;color:#fff;margin-left:4px;">⭐ PREMIUM</span>`
      : '';
    const overAlert = tierExceeded
      ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:7px;padding:0.4rem 0.6rem;font-size:0.74rem;color:#dc2626;margin-top:4px;">\n           ⚠️ ${count} students exceeds tier limit (${tierMax}). Needs upgrade to <b>${newTier.name||'?'}</b> — ₦${fmt(newTier.price||0)}/term\n         </div>` : '';

    return`<div class="deal appr" style="${tierExceeded?'border-left:3px solid #dc2626;':''}">\n      <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:4px;">\n        ${statusChip}${planChip}\n        ${count?`<span style="font-size:0.7rem;background:#f1f5f9;border:1px solid var(--border);border-radius:12px;padding:1px 8px;color:var(--sub);">👥 ${count} students</span>`:''}\n      </div>\n      <div class="dn">${esc(s.schoolName)}</div>\n      <div class="dm">ID: <span style="font-family:'JetBrains Mono',monospace;color:#60a5fa;">${s.schoolId}</span> · ${esc(s.tier)}</div>\n      <div class="dm">📱 ${esc(s.principalPhone)} · Agent: ${esc(s.agentName)}</div>\n      <div class="dm" style="color:var(--text);">🔑 ${esc(s.password)}</div>\n      <div class="dm" style="font-size:0.72rem;color:var(--sub);">🕐 Activated: ${(()=>{const d=s.activatedAt?.toDate?s.activatedAt.toDate():s.approvedAt?.toDate?s.approvedAt.toDate():null;return d?d.toLocaleString('en-NG',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';})()}${s.state?' · 📍 '+esc(s.state):''}</div>\n      <div class="dm" style="color:${daysLeft!==null&&daysLeft<=14?'#f59e0b':daysLeft<0?'#ef4444':'var(--sub)'};">\n        💳 ${s.termsPaid||1} term(s) paid · Expires: ${expiryLabel}${daysLeft!==null?' ('+daysLeft+'d left)':''}\n        ${daysLeft!==null&&daysLeft<=30?`<button onclick="sendRenewalReminder('${s.schoolId}','${esc(s.schoolName)}','${esc(s.agentPhone)}','${esc(s.principalPhone)}',${daysLeft})" style="background:#f59e0b;color:#fff;border:none;border-radius:5px;padding:1px 7px;font-size:0.7rem;cursor:pointer;margin-left:4px;">📲 Remind Agent</button>`:''}\n      </div>\n      ${overAlert}\n      <div class="dact" style="flex-wrap:wrap;gap:5px;">\n        <button class="btn-w btn-sm" onclick="resend('${s.schoolId}')">📤 Resend</button>\n        <button class="btn-ghost btn-sm" style="color:white;" onclick="copyC('${s.schoolId}')">📋 Copy</button>\n        <button class="btn-w btn-sm" onclick="openEditSchool('${s._id}','${s.schoolId}')">✏️ Edit</button>\n        <button class="btn-sm" style="background:#f59e0b;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.74rem;cursor:pointer;font-weight:700;" onclick="resetPrincipalPassword('${s.schoolId}','${esc(s.schoolName)}','${esc(s.principalPhone)}')">🔑 Reset Password</button>\n        <button class="btn-sm" style="background:#059669;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.74rem;cursor:pointer;font-weight:700;" onclick="recordRenewal('${s.schoolId}','${esc(s.schoolName)}','${esc(s.agentName)}','${esc(s.agentPhone)}','${s.tierPrice||0}')">🔄 Record Renewal</button>\n        <button class="btn-sm" style="background:#dc2626;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.74rem;cursor:pointer;" onclick="deleteSchool('${s._id}','${s.schoolId}','${esc(s.schoolName)}')">🗑️ Remove</button>\n        ${isPrem
          ? `<button onclick="setPlan('${s.schoolId}','basic')" style="background:#f1f5f9;border:1px solid var(--border);border-radius:6px;padding:3px 10px;font-size:0.74rem;cursor:pointer;color:var(--sub);">Downgrade to Basic</button>`
          : `<button onclick="setPlan('${s.schoolId}','premium')" style="background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.74rem;cursor:pointer;font-weight:700;">⭐ Activate Premium</button>`
        }\n        ${tierExceeded
          ? `<button onclick="unlockSchool('${s.schoolId}')" style="background:#dcfce7;border:1px solid #86efac;border-radius:6px;padding:3px 10px;font-size:0.74rem;cursor:pointer;color:#16a34a;font-weight:700;">🔓 Unlock (paid)</button>`
          : ''
        }\n      </div>\n    </div>`;
  }).join('');
}


async function setPlan(schoolId, plan){
  if(!confirm(`Set ${schoolId} to ${plan.toUpperCase()} plan?`)) return;
  try{
    await db.collection('schools').doc(schoolId).update({'config.plan': plan});
    // Also update admin_approved_schools record
    const snap = await db.collection('admin_approved_schools').where('schoolId','==',schoolId).get();
    if(!snap.empty) await snap.docs[0].ref.update({plan});
    await log(`⭐ ${schoolId} set to ${plan.toUpperCase()}`);
    renderApproved();
  } catch(e){ alert('Error: '+e.message); }
}

async function unlockSchool(schoolId){
  if(!confirm(`Confirm payment received and unlock ${schoolId}?`)) return;
  try{
    await db.collection('schools').doc(schoolId).update({
      'config.tierExceededAt': null,
      'config.tierExceededNewTier': null
    });
    // Mark admin_alerts resolved
    const alerts = await db.collection('admin_alerts').where('schoolId','==',schoolId).where('resolved','==',false).get();
    alerts.docs.forEach(d=>d.ref.update({resolved:true, resolvedAt: new Date()}));
    await log(`🔓 Unlocked ${schoolId} after tier upgrade payment`);
    renderApproved();
  } catch(e){ alert('Error: '+e.message); }
}

// Issues a brand-new password for a school's Principal login and relays it via
// WhatsApp. Does NOT reveal the old password — School-Bloom hashes staff
// passwords (SHA-256) precisely so they can't be read back; this replaces it
// instead, same pattern as "forgot password" everywhere else. Written as
// plaintext to schools/{id}.staff[].password — School-Bloom auto-hashes any
// plaintext password on the next successful login (_migratePasswordIfNeeded),
// same path legacy passwords already use, so no separate hashing code needed here.
async function resetPrincipalPassword(schoolId, schoolName, principalPhone){
  if(!confirm(`Generate a new password for ${schoolName} (${schoolId})?\n\nThis replaces their current password — they'll need the new one to log in.`)) return;
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let newPwd=''; for(let i=0;i<8;i++) newPwd+=chars[Math.floor(Math.random()*chars.length)];
  try{
    const schoolDoc = await db.collection('schools').doc(schoolId).get();
    if(schoolDoc.exists){
      const data = schoolDoc.data();
      const staff = data.staff || [];
      const pIdx = staff.findIndex(s=>s.role==='Principal');
      if(pIdx>=0){
        staff[pIdx].password = newPwd;
        await db.collection('schools').doc(schoolId).update({staff});
      } else {
        console.warn('No Principal entry in staff array for', schoolId, '— password not set on live school doc.');
      }
    } else {
      console.warn('School doc not found for', schoolId, '— only admin_approved_schools record updated.');
    }
    const snap = await db.collection('admin_approved_schools').where('schoolId','==',schoolId).get();
    if(!snap.empty) await snap.docs[0].ref.update({password:newPwd});

    await log(`🔑 Password reset for ${schoolName} (${schoolId})`);
    renderApproved();

    if(confirm(`✅ New password: ${newPwd}\n\nSend it to the Principal via WhatsApp now?`)){
      const msg = `Hello,\n\nYour EduBloom school password has been reset.\n\nSchool ID: ${schoolId}\nNew Password: ${newPwd}\n\nLogin at: https://school.edubloom.com.ng\n\n– AariNAT Admin`;
      window.open(`https://wa.me/${(principalPhone||'').replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,'_blank');
    }
  }catch(e){
    alert('Reset failed: '+(e.message||e));
  }
}

async function resend(schoolId){
  try{
    const snap=await db.collection('admin_approved_schools').where('schoolId','==',schoolId).get();
    if(snap.empty)return alert('Not found.');
    const s=snap.docs[0].data();
    const sd=await db.collection('admin_settings').doc('main').get().catch(()=>null);
    const tpl=sd?.exists?(sd.data().whatsappTemplate||''):'School ID: {{schoolId}}\nPassword: {{password}}';
    const msg=tpl.replace(/{{schoolId}}/g,schoolId).replace(/{{password}}/g,s.password);
    window.open(`https://wa.me/${(s.principalPhone||'').replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,'_blank');
  }catch(e){alert('Failed.');}
}

async function copyC(schoolId){
  try{
    const snap=await db.collection('admin_approved_schools').where('schoolId','==',schoolId).get();
    if(snap.empty)return;
    const s=snap.docs[0].data();
    const txt=`School ID: ${s.schoolId}\nPassword: ${s.password}\nPortal: https://school.edubloom.com.ng`;
    navigator.clipboard.writeText(txt).then(()=>alert('✅ Copied!')).catch(()=>prompt('Copy:',txt));
  }catch(e){}
}

// ── Agents ─────────────────────────────────────────────────────────────────
// Always use Firestore as source of truth — NO localStorage cache for agents
// This prevents ghost agents from test data reappearing
let _agentsCache = [];

// Clear any stale cache from localStorage on load
localStorage.removeItem('ad_agents_cache');

function saveAgentsCache(agents){
  _agentsCache = agents; // memory only — never write to localStorage
}

function renderAgentsFromData(agents, ledger, deals){
  const c=$('agents-list');
  c.innerHTML=agents.length===0
    ?'<p style="text-align:center;color:var(--sub);padding:2rem;">No agents registered. Add your first agent above.</p>'
    :agents.map(a=>{
      const earned=ledger.filter(l=>l.agent===a.name).reduce((s,l)=>s+(l.amount||0),0);
      const paid=ledger.filter(l=>l.agent===a.name&&l.paid).reduce((s,l)=>s+(l.amount||0),0);
      return`<div class="deal" style="border-left:3px solid var(--brand);">\n        <div class="dn">${esc(a.name)}</div>\n        <div class="dm">📱 ${a.phone} · Commission rate: ${a.commission||20}%</div>\n        <div class="dm" style="color:var(--text);">Earned: ${fmt(earned)} · Paid out: ${fmt(paid)}</div>\n        <div class="dact" style="margin-top:6px;gap:5px;flex-wrap:wrap;">\n          <button class="btn-w btn-sm" onclick="openEditAgent('${a.id}')">✏️ Edit</button>\n          <button class="btn-w btn-sm" onclick="resendAgentActivation('${a.id}')">📲 Resend Login</button>\n          <button class="btn-sm" style="background:#dc2626;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.74rem;cursor:pointer;" onclick="deleteAgent('${a.id}','${esc(a.name)}')">🗑️ Remove</button>\n        </div>\n      </div>`;
    }).join('');
  $('agent-perf-body').innerHTML=agents.map(a=>{
    const d=deals.filter(x=>x.agent?.name===a.name).length;
    const comm=ledger.filter(l=>l.agent===a.name).reduce((s,l)=>s+(l.amount||0),0);
    return`<tr>\n      <td>${esc(a.name)}</td>\n      <td style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;">${a.phone}</td>\n      <td>${d}</td>\n      <td style="color:var(--money);font-weight:700;">${fmt(comm)}</td>\n      <td><span class="chip ca" style="position:static;">Active</span></td>\n    </tr>`;
  }).join('');
}

async function renderAgents(){
  // Show loading state
  const c=$('agents-list');
  if(c && _agentsCache.length===0) c.innerHTML='<p style="text-align:center;color:var(--sub);padding:2rem;">Loading agents...</p>';

  // Always fetch fresh from Firestore — never trust localStorage
  let agents=[],ledger=[],deals=[];
  try{
    agents=(await db.collection('admin_agents').get()).docs.map(d=>({id:d.id,...d.data()}));
    ledger=(await db.collection('admin_ledger').get()).docs.map(d=>d.data());
    deals=(await db.collection('admin_deals').get()).docs.map(d=>d.data());
    saveAgentsCache(agents);
    renderAgentsFromData(agents, ledger, deals);
  }catch(e){
    console.warn('renderAgents Firestore failed:', e);
    if(c) c.innerHTML='<p style="text-align:center;color:#dc2626;padding:2rem;">⚠️ Could not load agents. Check connection.</p>';
  }
}

function normalizePhone(raw){
  let p = raw.trim().replace(/\D/g,'');
  if(p.startsWith('0') && p.length === 11) return '234' + p.slice(1);
  if(p.startsWith('234') && p.length === 13) return p;
  if(p.length === 10) return '234' + p;
  return p;
}

// ── Update this to your actual agent app URL ───────────────────────────────
const AGENT_APP_URL = 'https://agent.edubloom.com.ng'; // ← update this

async function saveAgent(){
  const name=$('ag-name').value.trim();
  const phone=normalizePhone($('ag-phone').value);
  const rate=parseFloat($('ag-rate').value)||20;
  if(!name||!phone||phone.length<10)return alert('Name and valid phone required (e.g. 08012345678 or 2348012345678).');

  const btn=$('add-agent-btn');
  if(btn){btn.textContent='Saving...';btn.disabled=true;}

  const agentData={name,phone,commission:rate,joinedAt:new Date()};
  // Give it a temp id so it shows immediately in the list
  const tempId='pending_'+Date.now();

  try{
    if(db&&navigator.onLine){
      // Simple direct write — no artificial timeout
      const docRef=await db.collection('admin_agents').add(agentData);
      _agentsCache=[..._agentsCache.filter(a=>!a.id.startsWith('pending_')),{id:docRef.id,...agentData}];
    } else {
      // Offline: queue it and add to memory cache with temp id
      SQ.push({t:'addAgent',d:agentData});
      _agentsCache=[..._agentsCache,{id:tempId,...agentData}];
    }
    closeM('add-agent-modal');
    $('ag-name').value='';$('ag-phone').value='';$('ag-rate').value='20';
    log(`👤 Added agent: ${name} (${phone})`);
    // Show updated list immediately from memory, then refresh from Firestore
    renderAgentsFromData(_agentsCache,[],[]);
    renderAgents();
    renderDashboard();

    // ✅ FIX 3: Send WhatsApp activation message to the new agent
    const localPhone = phone.startsWith('234') ? '0' + phone.slice(3) : phone;
    const exampleComm = Math.round(10000 * rate / 100).toLocaleString('en-NG');
    const activationMsg =
      `*Hello ${name}!* 🌸\n\n` +
      `You have been registered as an *Educational Bloom* agent by AariNAT.\n\n` +
      `*Your login:*\n` +
      `📱 Phone (login key): *${localPhone}*\n\n` +
      `*Agent App link:*\n` +
      `${AGENT_APP_URL}\n\n` +
      `*How to log in:*\n` +
      `1. Open the link above\n` +
      `2. Tap Login\n` +
      `3. Enter your number: *${localPhone}*\n\n` +
      `For every school you sign up, you earn commission — e.g. ₦${exampleComm} per Starter school.\n\n` +
      `Questions? Call Bayo: *+234 814 507 3941*\n\n` +
      `_Educational Bloom by AariNAT_`;

    if(confirm(`✅ Agent "${name}" added!\n\nSend them a WhatsApp activation message now?\n(They need this to know how to log in.)`)){
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(activationMsg)}`,'_blank');
    }
  }catch(e){
    alert('Failed to save: '+(e.message||'Unknown error. Try again.'));
    console.error('saveAgent:', e);
  }finally{
    if(btn){btn.textContent='💾 Add Agent';btn.disabled=false;}
  }
}

// ── Resend activation WhatsApp to an existing agent ───────────────────────
function resendAgentActivation(agentId){
  const a = _agentsCache.find(x => x.id === agentId);
  if(!a){ alert('Agent not found. Refresh the page.'); return; }
  const phone = normalizePhone(a.phone || '');
  const localPhone = phone.startsWith('234') ? '0' + phone.slice(3) : phone;
  const exampleComm = Math.round(10000 * (a.commission||20) / 100).toLocaleString('en-NG');
  const msg =
    `*Hello ${a.name}!* 🌸\n\n` +
    `Reminder of your *Educational Bloom* agent login:\n\n` +
    `📱 Your login key (phone): *${localPhone}*\n\n` +
    `*Agent App:*\n` +
    `${AGENT_APP_URL}\n\n` +
    `Open the link → tap Login → enter *${localPhone}*\n\n` +
    `Commission: ₦${exampleComm} per Starter school, more for bigger schools.\n\n` +
    `Questions? Call Bayo: *+234 814 507 3941*\n\n` +
    `_Educational Bloom by AariNAT_`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank');
}


// ── Record School Renewal — 10% commission to original agent ─────────────────
async function recordRenewal(schoolId, schoolName, agentName, agentPhone, tierPrice){
  const price = parseFloat(tierPrice)||0;
  if(!price){ alert('Cannot calculate renewal — tier price missing. Edit the school record first.'); return; }
  const commission = Math.round(price * 0.10);
  const terms = parseInt(prompt(`Recording renewal for ${schoolName}\n\nTier fee: ₦${fmt(price)}/term\nAgent renewal commission (10%): ₦${fmt(commission)}\n\nHow many terms is the school renewing?`,'1'));
  if(!terms||terms<1){ return; }
  const totalComm = commission * terms;
  if(!confirm(`✅ Confirm renewal:\n\n${schoolName}\n${terms} term(s) × ₦${fmt(price)} = ₦${fmt(price*terms)}\nAgent (${agentName}): ₦${fmt(totalComm)} (10%)\n\nLog this commission?`)) return;

  const normalPhone = agentPhone.startsWith('234')?agentPhone:'234'+(agentPhone.startsWith('0')?agentPhone.slice(1):agentPhone);
  const commEntry = {
    dealId: schoolId+'_renewal_'+Date.now(),
    schoolId, schoolName,
    agent: agentName,
    agentPhone: normalPhone,
    amount: totalComm,
    type: 'renewal',
    terms,
    tierPrice: price,
    paid: false,
    date: new Date()
  };
  SQ.push({t:'addLedger', id:schoolId+'_ren_'+Date.now(), d:commEntry});
  log(`🔄 Renewal: ${schoolName} · ${terms} term(s) · ₦${fmt(totalComm)} commission → ${agentName}`);
  alert(`✅ Renewal logged!\n${agentName} will receive ₦${fmt(totalComm)} within 7 days of payment confirmation.`);
  renderLedger();
}

// ── Agent Edit / Delete ────────────────────────────────────────────────────
async function deleteAgent(id, name){
  if(!confirm(`Remove agent "${name}"? This cannot be undone.`))return;
  try{
    if(db&&navigator.onLine){
      await db.collection('admin_agents').doc(id).delete();
    } else {
      // Queue delete for when back online
      SQ.push({t:'deleteAgent',id});
    }
    // Remove from memory cache immediately regardless
    _agentsCache=_agentsCache.filter(a=>a.id!==id);
    renderAgentsFromData(_agentsCache,[],[]);
    renderAgents();
    renderDashboard();
    log(`🗑️ Removed agent: ${name}`);
  }catch(e){alert('Error: '+e.message);}
}

function openEditAgent(id){
  const a=_agentsCache.find(x=>x.id===id);
  if(!a)return;
  $('edit-ag-id').value=id;
  $('edit-ag-name').value=a.name||'';
  $('edit-ag-phone').value=a.phone||'';
  $('edit-ag-rate').value=a.commission||20;
  $('edit-agent-modal').classList.add('on');
}

async function saveEditAgent(){
  const id=$('edit-ag-id').value;
  const name=$('edit-ag-name').value.trim();
  const phone=normalizePhone($('edit-ag-phone').value);
  const rate=parseFloat($('edit-ag-rate').value)||20;
  if(!name||!phone||phone.length<10)return alert('Name and valid phone required.');
  const btn=$('edit-ag-btn');
  if(btn){btn.textContent='Saving...';btn.disabled=true;}
  const safetyTimer=setTimeout(()=>{
    closeM('edit-agent-modal');
    if(btn){btn.textContent='💾 Save Changes';btn.disabled=false;}
  },8000);
  try{
    const data={name,phone,commission:rate};
    if(db&&navigator.onLine){
      await db.collection('admin_agents').doc(id).update(data);
    }
    const updated=_agentsCache.map(a=>a.id===id?{...a,...data}:a);
    saveAgentsCache(updated);
  }catch(e){console.warn('Edit agent error:',e);}
  clearTimeout(safetyTimer);
  closeM('edit-agent-modal');
  if(btn){btn.textContent='💾 Save Changes';btn.disabled=false;}
  renderAgentsFromData(_agentsCache,[],[]);
  renderAgents();
  log(`✏️ Updated agent: ${name}`);
}

// ── School Edit / Delete ────────────────────────────────────────────────────
async function deleteSchool(docId, schoolId, schoolName){
  if(!confirm(`Remove school "${schoolName}" (${schoolId})? This will also delete the school login. This cannot be undone.`))return;
  try{
    if(!(db&&navigator.onLine)){alert('Must be online to delete.');return;}
    // Delete from admin_approved_schools
    await db.collection('admin_approved_schools').doc(docId).delete();
    // Delete the school login doc
    await db.collection('schools').doc(schoolId).delete().catch(()=>{});
    log(`🗑️ Removed school: ${schoolName} (${schoolId})`);
    renderApproved();
    renderDashboard();
  }catch(e){alert('Error: '+e.message);}
}

function openEditSchool(docId, schoolId){
  // We'll fetch the record from Firestore
  if(!(db&&navigator.onLine)){alert('Must be online to edit.');return;}
  db.collection('admin_approved_schools').doc(docId).get().then(doc=>{
    if(!doc.exists)return alert('Not found.');
    const s=doc.data();
    $('edit-sc-docid').value=docId;
    $('edit-sc-schoolid').value=schoolId;
    $('edit-sc-name').value=s.schoolName||'';
    $('edit-sc-phone').value=s.principalPhone||'';
    $('edit-sc-email').value=s.principalEmail||'';
    $('edit-sc-pwd').value=s.password||'';
    $('edit-sc-agent').value=s.agentName||'';
    $('edit-school-modal').classList.add('on');
  }).catch(e=>alert('Error: '+e.message));
}

async function saveEditSchool(){
  const docId=$('edit-sc-docid').value;
  const schoolId=$('edit-sc-schoolid').value;
  const schoolName=$('edit-sc-name').value.trim();
  const principalPhone=$('edit-sc-phone').value.trim();
  const principalEmail=$('edit-sc-email').value.trim();
  const password=$('edit-sc-pwd').value.trim();
  const agentName=$('edit-sc-agent').value.trim();
  if(!schoolName||!principalPhone)return alert('School name and phone are required.');
  const btn=$('edit-sc-btn');
  if(btn){btn.textContent='Saving...';btn.disabled=true;}
  try{
    const data={schoolName,principalPhone,principalEmail,password,agentName,updatedAt:new Date()};
    await db.collection('admin_approved_schools').doc(docId).update(data);
    // Also update school config if password changed
    if(password){
      await db.collection('schools').doc(schoolId).update({'config.password':password}).catch(()=>{});
    }
    log(`✏️ Updated school: ${schoolName}`);
    closeM('edit-school-modal');
    renderApproved();
  }catch(e){alert('Error: '+e.message);}
  if(btn){btn.textContent='💾 Save Changes';btn.disabled=false;}
}

// ── Ledger ─────────────────────────────────────────────────────────────────
async function renderLedger(){
  let entries=[];
  try{entries=(await db.collection('admin_ledger').orderBy('date','desc').get()).docs.map(d=>({_id:d.id,...d.data()}));}catch(e){}
  $('ledger-body').innerHTML=entries.length===0?'<tr><td colspan="6" style="text-align:center;color:var(--sub);padding:2rem;">No entries yet.</td></tr>':entries.map(e=>{
    const dt=e.date?.toDate?e.date.toDate():new Date();
    return`<tr>\n      <td style="font-size:0.75rem;">${dt.toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'2-digit'})}</td>\n      <td>${esc(e.agent)}<br><span style="font-size:0.65rem;color:${e.type==='renewal'?'#a78bfa':'#34d399'}">${e.type==='renewal'?'🔄 Renewal 10%':'✨ New 20%'}</span></td>\n      <td style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;">${e.schoolId||'—'}</td>\n      <td style="color:var(--money);font-weight:700;">${fmt(e.amount)}</td>\n      <td><span class="chip ${e.paid?'ca':'cp'}" style="position:static;">${e.paid?'Paid':'Pending'}</span></td>\n      <td>${e.paid?'<span style="font-size:0.72rem;color:var(--sub);">Done</span>':`<button class="btn-g btn-sm" onclick="markPaid('${e._id}','${esc(e.agent)}',${e.amount||0})">✅ Pay</button>`}</td>\n    </tr>`;
  }).join('');
}

async function markPaid(id,agent,amount){
  if(!confirm(`Mark ${fmt(amount)} to ${agent} as paid?`))return;
  SQ.push({t:'updateLedger',id,d:{paid:true,paidAt:new Date()}});
  log(`💸 Commission paid: ${fmt(amount)} → ${agent}`);
  await new Promise(r=>setTimeout(r,600));
  renderLedger();
}

function exportLedger(){
  db.collection('admin_ledger').orderBy('date','desc').get().then(snap=>{
    const rows=snap.docs.map(d=>d.data());
    if(!rows.length)return alert('No data.');
    const csv=[['Date','Agent','School','Amount','Status'],...rows.map(r=>{const dt=r.date?.toDate?r.date.toDate():new Date();return[dt.toLocaleDateString('en-NG'),r.agent,r.schoolId,r.amount,r.paid?'Paid':'Pending'];})].map(r=>r.join(',')).join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`ledger-${new Date().toISOString().split('T')[0]}.csv`;a.click();
    log('📥 Ledger exported');
  }).catch(()=>alert('Export failed.'));
}

// ── Opportunities ──────────────────────────────────────────────────────────
async function renderOpps(){
  let opps=[];
  try{opps=(await db.collection('admin_opportunities').get()).docs.map(d=>({id:d.id,...d.data()}));}catch(e){}
  $('opp-body').innerHTML=opps.length===0?'<tr><td colspan="5" style="text-align:center;color:var(--sub);padding:2rem;">No opportunities added yet.</td></tr>':opps.map(o=>`<tr>\n    <td>${esc(o.title)}</td><td>${esc(o.provider)}</td>\n    <td><span class="chip ca" style="position:static;">${o.type}</span></td>\n    <td style="font-size:0.75rem;">${o.deadline||'—'}</td>\n    <td><button class="btn-d btn-sm" onclick="deleteOpp('${o.id}')">🗑️</button></td>\n  </tr>`).join('');
}

async function saveOpp(){
  const title=$('opp-title').value.trim();
  const provider=$('opp-provider').value.trim();
  const deadline=$('opp-deadline').value;
  if(!title||!provider||!deadline)return alert('Title, provider and deadline required.');
  SQ.push({t:'addOpp',d:{title,provider,type:$('opp-type').value,amount:$('opp-amount').value,deadline,eligibility:$('opp-elig').value,url:$('opp-url').value,createdAt:new Date()}});
  closeM('add-opp-modal');
  ['opp-title','opp-provider','opp-amount','opp-url','opp-elig'].forEach(id=>$(id).value='');
  $('opp-deadline').value='';
  await new Promise(r=>setTimeout(r,500));
  renderOpps();
  log(`🔍 Added opportunity: ${title}`);
}

async function deleteOpp(id){
  if(!confirm('Delete?'))return;
  SQ.push({t:'deleteOpp',id});
  await new Promise(r=>setTimeout(r,400));
  renderOpps();
}

// ── Settings ───────────────────────────────────────────────────────────────
async function loadSettings(){
  try{
    const doc=await db.collection('admin_settings').doc('main').get();
    if(doc.exists){
      const d=doc.data();
      $('s-schoolpwd').value=d.defaultSchoolPassword||'bloom2026';
      $('s-cac').value=d.autoCAC||'full';
      if(d.whatsappTemplate)$('s-tpl').value=d.whatsappTemplate;
      if(d.geminiKey&&$('s-gemini'))$('s-gemini').value='●'.repeat(20)+' (set)';
      if(d.groqApiKey&&$('s-groq'))$('s-groq').value=d.groqApiKey.slice(0,6)+'••••••'+d.groqApiKey.slice(-4);
      if(d.hfApiKey&&$('s-hf'))$('s-hf').value=d.hfApiKey.slice(0,6)+'••••••'+d.hfApiKey.slice(-4);
      if(d.adminPassword&&$('s-adminpwd'))$('s-adminpwd').placeholder='●'.repeat(Math.min(d.adminPassword.length,12))+' (set — type to change)';
    }
  }catch(e){}
}

async function saveSettings(){
  const gk=($('s-gemini')?.value||'').replace(/●.*/,'').trim();
  const groqRaw=($('s-groq')?.value||'').trim();
  const hfRaw=($('s-hf')?.value||'').trim();
  const hfKey=hfRaw&&!hfRaw.includes('•')&&hfRaw.startsWith('hf_')&&hfRaw.length>20?hfRaw:null;
  const groqKey=groqRaw.startsWith('gsk_')&&groqRaw.length>20?groqRaw:'';
  const newAdminPwd=($('s-adminpwd')?.value||'').trim();
  if(newAdminPwd && newAdminPwd.length<4) return alert('Backup admin password must be at least 4 characters.');
  SQ.push({t:'saveSettings',d:{...(gk?{geminiKey:gk}:{}),...(groqKey?{groqApiKey:groqKey}:{}),...(hfKey?{hfApiKey:hfKey}:{}),...(newAdminPwd?{adminPassword:newAdminPwd}:{}),defaultSchoolPassword:$('s-schoolpwd').value,autoCAC:$('s-cac').value,whatsappTemplate:$('s-tpl').value,updatedAt:new Date()}});
  if(groqKey||hfKey) await syncOcrKeysToPublic();
  if($('s-adminpwd')) $('s-adminpwd').value='';
  alert('✅ Settings saved!');
  log('⚙️ Settings updated');
}

// Mirrors ONLY the OCR keys (never the admin password, WhatsApp template,
// or anything else) into a separate document the agent app can read
// directly, without any external proxy and without needing full admin
// access to admin_settings. Run manually via the button, or automatically
// whenever a key is changed in Settings above.
async function syncOcrKeysToPublic(silent){
  try{
    const doc=await db.collection('admin_settings').doc('main').get();
    if(!doc.exists){ if(!silent) alert('No settings found yet — add a Groq/HF key above first.'); return; }
    const d=doc.data();
    if(!d.groqApiKey&&!d.hfApiKey){ if(!silent) alert('No Groq/HF key set yet — add one above first.'); return; }
    await db.collection('public_ocr_keys').doc('main').set({
      groqApiKey:d.groqApiKey||'', hfApiKey:d.hfApiKey||'', ocrServiceUrl:d.ocrServiceUrl||'', updatedAt:new Date()
    },{merge:true});
    log('🔄 OCR keys synced for agent app');
  }catch(e){ if(!silent) alert('Sync failed: '+(e.message||e)); else console.warn('OCR key sync failed:',e.message); }
}

async function exportAll(){
  try{
    const[agents,deals,schools,ledger,opps,cac]=await Promise.all([
      db.collection('admin_agents').get().then(s=>s.docs.map(d=>d.data())),
      db.collection('admin_deals').get().then(s=>s.docs.map(d=>d.data())),
      db.collection('admin_approved_schools').get().then(s=>s.docs.map(d=>d.data())),
      db.collection('admin_ledger').get().then(s=>s.docs.map(d=>d.data())),
      db.collection('admin_opportunities').get().then(s=>s.docs.map(d=>d.data())),
      db.collection('admin_cac').doc('progress').get().then(d=>d.data())
    ]);
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([JSON.stringify({agents,deals,schools,ledger,opps,cac,at:new Date()},null,2)],{type:'application/json'}));
    a.download=`aarinat-backup-${new Date().toISOString().split('T')[0]}.json`;a.click();
    log('📥 Full backup exported');
  }catch(e){alert('Export failed. Check connection.');}
}


// ── Production Reset ─────────────────────────────────────────────────────────
// Wipes all test data. Keeps settings, agents, and CAC balance.
async function productionReset(){
  if(!confirm('🧹 PRODUCTION RESET\n\nThis will permanently delete:\n• All deals (pending & approved)\n• All approved school records\n• All commission ledger entries\n• All activity logs\n\nThis KEEPS your settings, agents list, and CAC balance.\n\nType OK to continue — this cannot be undone.')) return;
  const confirm2 = prompt('Type DELETE to confirm wipe:');
  if(confirm2 !== 'DELETE'){ alert('Cancelled.'); return; }

  const btn = document.getElementById('prod-reset-btn');
  if(btn){ btn.textContent='Wiping...'; btn.disabled=true; }

  // Each collection is wiped independently — one failure does not stop the others
  const collections=[
    'admin_deals',
    'admin_approved_schools',
    'admin_ledger',
    'admin_activity',
    'admin_alerts'
  ];
  // Note: 'schools' is intentionally excluded — protected by Firebase Auth rules.
  // Schools will be overwritten correctly when real schools are approved.

  let total=0;
  const skipped=[];
  for(const col of collections){
    try{
      let snap = await db.collection(col).limit(400).get();
      while(!snap.empty){
        const batch=db.batch();
        snap.docs.forEach(d=>batch.delete(d.ref));
        await batch.commit();
        total+=snap.docs.length;
        snap=await db.collection(col).limit(400).get();
      }
    }catch(e){
      console.warn('Could not wipe '+col+':', e.message);
      skipped.push(col);
    }
  }

  if(btn){ btn.textContent='🧹 Wipe All Test Data — Start Fresh'; btn.disabled=false; }

  if(skipped.length){
    alert('⚠️ Wiped '+total+' records.\n\nCould not delete: '+skipped.join(', ')+'\n(These may need manual deletion from Firebase Console)\n\nAll other test data is cleared.');
  } else {
    alert('✅ Done! Deleted '+total+' test records.\nYour settings, agents, and CAC balance are intact.\nYou are ready for real schools.');
  }
  location.reload();
}

async function clearAll(){
  if(!confirm('Delete ALL data?'))return;
  if(prompt('Type DELETE to confirm:')!=='DELETE')return alert('Cancelled.');
  for(const col of['admin_agents','admin_deals','admin_approved_schools','admin_ledger','admin_opportunities','admin_activity']){
    const s=await db.collection(col).get();const b=db.batch();s.docs.forEach(d=>b.delete(d.ref));await b.commit();
  }
  await db.collection('admin_settings').doc('main').delete().catch(()=>{});
  await db.collection('admin_cac').doc('progress').delete().catch(()=>{});
  localStorage.removeItem('ad_sq');localStorage.removeItem('ad_act');
  alert('Cleared.');location.reload();
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  SQ.ping();
  const authRaw = localStorage.getItem('ad_auth');
  const authTime = parseInt(localStorage.getItem('ad_auth_time')||'0');
  const EIGHT_HOURS = 8 * 60 * 60 * 1000;
  const sessionValid = authRaw === '1' && (Date.now() - authTime) < EIGHT_HOURS;
  if(sessionValid){
    $('login-screen').style.display='none';
    $('main-app').style.display='block';
    initAdmin();
  } else if(authRaw){
    // Session expired — clear and show login
    localStorage.removeItem('ad_auth');
    localStorage.removeItem('ad_auth_time');
  }
});


async function loadAlerts(){
  try{
    const snap = await db.collection('admin_alerts').where('resolved','==',false).get();
    const count = snap.size;
    const badge = document.getElementById('alert-badge');
    if(badge){ badge.textContent=count>0?count:''; badge.style.display=count>0?'inline-flex':'none'; }
    if(count>0) console.warn(`⚠️ ${count} unresolved tier alerts`);
  } catch(e){}
}
