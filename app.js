// ── Firebase ───────────────────────────────────────────────────────────────
const FB={apiKey:"AIzaSyCVEdunn3AZndDP5Rm1Z3Kv1e6G6W2mB_o",authDomain:"educationbloom-699ed.firebaseapp.com",projectId:"educationbloom-699ed",storageBucket:"educationbloom-699ed.firebasestorage.app",messagingSenderId:"33750392965",appId:"1:33750392965:web:2b3da887ede996ea8389ec"};
let db=null;
try{firebase.initializeApp(FB);db=firebase.firestore();}catch(e){console.warn('FB:',e);}

// ── State ──────────────────────────────────────────────────────────────────
let pendingUnsub=null;
let agentsUnsub=null;
let approvalData=null;
let _agentsCache=[];
let _agentsLoaded=false; // tracks whether listener has fired at least once

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
      }catch(e){
        console.error('SQ exec failed:',item.op?.t,e?.message||e);
        item.tries=(item.tries||0)+1;
        if(item.tries>3){this.q=this.q.filter(x=>x.id!==item.id);}
      }
    }
    this.save();this.ping();
  },
  async exec(op){
    const t=op.t;
    if(t==='updateDeal')          await db.collection('admin_deals').doc(op.id).update(op.d);
    else if(t==='deleteDeal')     await db.collection('admin_deals').doc(op.id).delete();
    else if(t==='addSchoolRecord')await db.collection('admin_approved_schools').add(op.d);
    else if(t==='createSchool')   await db.collection('schools').doc(op.id).set(op.d,{merge:true});
    else if(t==='addLedger')      await db.collection('admin_ledger').add(op.d);
    else if(t==='updateCAC')      await db.collection('admin_cac').doc('progress').set(op.d,{merge:true});
    else if(t==='addAgent')       await db.collection('admin_agents').add(op.d);
    else if(t==='deleteAgent')    await db.collection('admin_agents').doc(op.id).delete();
    else if(t==='logActivity')    await db.collection('admin_activity').add(op.d);
    else if(t==='saveSettings')   await db.collection('admin_settings').doc('main').set(op.d,{merge:true});
    else if(t==='addOpp')         await db.collection('admin_opportunities').add(op.d);
    else if(t==='deleteOpp')      await db.collection('admin_opportunities').doc(op.id).delete();
    else if(t==='updateLedger')   await db.collection('admin_ledger').doc(op.id).update(op.d);
  }
};
window.addEventListener('online',()=>{SQ.ping();SQ.run();});
window.addEventListener('offline',()=>SQ.ping());
window._flushSQ=()=>SQ.run();

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
  let stored='aarinat2024';
  try{const doc=await db.collection('admin_settings').doc('main').get();if(doc.exists&&doc.data().adminPassword)stored=doc.data().adminPassword;}catch(e){}
  if(pwd!==stored){
    const err=$('l-err');err.textContent='Incorrect password.';err.style.display='block';
    btn.textContent='🔓 Enter';btn.disabled=false;return;
  }
  localStorage.setItem('ad_auth','1');
  localStorage.setItem('ad_auth_time',Date.now().toString());
  $('login-screen').style.display='none';
  $('main-app').style.display='block';
  SQ.ping();
  await initAdmin();
}

function logout(){
  if(!confirm('Logout?'))return;
  localStorage.removeItem('ad_auth');
  if(pendingUnsub)pendingUnsub();
  if(agentsUnsub)agentsUnsub();
  location.reload();
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
}

// ── Init ───────────────────────────────────────────────────────────────────
async function initAdmin(){
  // Only seed settings and CAC if they don't exist — no demo agents, no demo deals
  try{
    const sd=await db.collection('admin_settings').doc('main').get();
    if(!sd.exists)await db.collection('admin_settings').doc('main').set({
      adminPassword:'aarinat2024',
      defaultSchoolPassword:'bloom2026',
      autoCAC:'full',
      whatsappTemplate:'*Welcome to Educational Bloom!* 🎉\n\nYour school has been activated.\n\n*School ID:* {{schoolId}}\n*Password:* {{password}}\n*Portal:* https://kobomoba.github.io/School-Bloom/\n\nLog in and start recovering your fees.\n– AariNAT Admin'
    });
    const cac=await db.collection('admin_cac').doc('progress').get();
    if(!cac.exists)await db.collection('admin_cac').doc('progress').set({raised:0});
  }catch(e){console.warn('init:',e);}
  await renderDashboard();
  startPendingListener();
  startAgentsListener();
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
  },err=>console.warn('pending listener:',err));
}

// ── Real-time agents listener ──────────────────────────────────────────────
function startAgentsListener(){
  if(!db)return;
  if(agentsUnsub)agentsUnsub();
  // Show loading state immediately
  const c=$('agents-list');
  if(c)c.innerHTML='<p style="text-align:center;color:var(--sub);padding:2rem;">⏳ Loading agents...</p>';

  agentsUnsub=db.collection('admin_agents').onSnapshot(snap=>{
    _agentsCache=snap.docs.map(d=>({id:d.id,...d.data()}));
    _agentsLoaded=true;
    renderAgentsListFromCache();
    // refresh dashboard agent count
    const el=$('d-agents');if(el)el.textContent=_agentsCache.length;
  },err=>{
    console.warn('agents listener error:',err);
    // Fallback: show error with manual refresh button
    const c=$('agents-list');
    if(c)c.innerHTML=`<div style="text-align:center;padding:2rem;">
      <p style="color:#f87171;margin-bottom:0.75rem;">⚠️ Could not load agents. Check your connection.</p>
      <button class="btn-b" style="width:auto;" onclick="startAgentsListener()">🔄 Retry</button>
    </div>`;
  });
}

function renderAgentsListFromCache(){
  const c=$('agents-list');
  if(!c)return;
  if(!_agentsLoaded){
    c.innerHTML='<p style="text-align:center;color:var(--sub);padding:2rem;">⏳ Loading agents...</p>';
    return;
  }
  if(!_agentsCache.length){
    c.innerHTML='<p style="text-align:center;color:var(--sub);padding:2rem;">No agents registered. Use the button above to add your first agent.</p>';
    return;
  }
  c.innerHTML=_agentsCache.map(a=>`
    <div class="deal" style="border-left:3px solid var(--brand);">
      <div class="dn">${esc(a.name)}</div>
      <div class="dm">📱 ${esc(a.phone||'')} · Commission: ${a.commission||20}%</div>
      <div class="dact" style="margin-top:8px;gap:6px;flex-wrap:wrap;">
        <button class="btn-sm" style="background:#1e40af;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:0.78rem;cursor:pointer;font-weight:700;" onclick="openEditAgent('${a.id}')">✏️ Edit</button>
        <button class="btn-sm" style="background:#dc2626;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:0.78rem;cursor:pointer;font-weight:700;" onclick="deleteAgent('${a.id}','${esc(a.name)}')">🗑️ Delete Agent</button>
      </div>
    </div>`).join('');
}

async function renderAgents(){
  renderAgentsListFromCache();
  await renderAgentPerformance();
}

async function renderAgentPerformance(){
  let ledger=[],deals=[];
  try{
    ledger=(await db.collection('admin_ledger').get()).docs.map(d=>d.data());
    deals=(await db.collection('admin_deals').get()).docs.map(d=>d.data());
  }catch(e){console.warn('perf table:',e);}
  const body=$('agent-perf-body');if(!body)return;
  if(!_agentsCache.length){
    body.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--sub);padding:1rem;">No agents yet.</td></tr>';
    return;
  }
  body.innerHTML=_agentsCache.map(a=>{
    const d=deals.filter(x=>x.agent?.name===a.name).length;
    const comm=ledger.filter(l=>l.agent===a.name).reduce((s,l)=>s+(l.amount||0),0);
    const paid=ledger.filter(l=>l.agent===a.name&&l.paid).reduce((s,l)=>s+(l.amount||0),0);
    return`<tr>
      <td>${esc(a.name)}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;">${esc(a.phone||'')}</td>
      <td>${d}</td>
      <td style="color:var(--money);font-weight:700;">${fmt(comm)} <span style="font-size:0.68rem;color:var(--sub);">(${fmt(paid)} paid)</span></td>
      <td><span class="chip ca" style="position:static;">Active</span></td>
    </tr>`;
  }).join('');
}

function renderPendingList(deals){
  const c=$('pending-list');
  if(!deals.length){c.innerHTML='<p style="text-align:center;color:var(--sub);padding:2rem;">✅ No pending deals.</p>';return;}
  c.innerHTML=deals.map(d=>{
    const comm=Math.round((d.tier?.price||0)*((d.agent?.commission||20)/100)*(d.terms||1));
    return`<div class="deal pend">
      <span class="chip cp">PENDING</span>
      <div class="dn">${esc(d.school?.name)}</div>
      <div class="dm">Agent: ${esc(d.agent?.name)} · ${d.school?.studentCount||0} students</div>
      <div class="dm">📱 ${esc(d.school?.phone)}</div>
      <div class="dm" style="color:var(--text);font-weight:600;">${fmt(d.tier?.price)}/term · Commission: ${fmt(comm)}</div>
      ${d.notes?`<div class="dm" style="font-style:italic;margin-top:4px;">"${esc(d.notes)}"</div>`:''}
      <div class="dact">
        <button class="btn-g btn-sm" onclick="openApproveModal('${d.id}')">✅ Approve</button>
        <button class="btn-d btn-sm" onclick="rejectDeal('${d.id}','${esc(d.school?.name)}')">❌ Reject</button>
        <button class="btn-sm" style="background:#374151;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.74rem;cursor:pointer;" onclick="deleteDeal('${d.id}','${esc(d.school?.name)}')">🗑️ Delete</button>
      </div>
    </div>`;
  }).join('');
}

// ── Approve ────────────────────────────────────────────────────────────────
async function openApproveModal(dealId){
  let deal;
  try{const doc=await db.collection('admin_deals').doc(dealId).get();if(!doc.exists)return alert('Deal not found.');deal=doc.data();}
  catch(e){alert('Connection error.');return;}
  const sd=await db.collection('admin_settings').doc('main').get().catch(()=>null);
  const defPwd=sd?.exists?(sd.data().defaultSchoolPassword||'bloom2026'):'bloom2026';
  const schoolId=genId();
  $('ap-preview').innerHTML=`<div style="background:#080f1a;padding:0.75rem;border-radius:8px;font-size:0.85rem;">
    <div><b>School:</b> ${esc(deal.school?.name)}</div>
    <div><b>Phone:</b> ${esc(deal.school?.phone)}</div>
    <div><b>Students:</b> ${deal.school?.studentCount||0}</div>
    <div><b>Tier:</b> ${esc(deal.tier?.name)} · ${fmt(deal.tier?.price)}/term</div>
    <div><b>Agent:</b> ${esc(deal.agent?.name)}</div>
  </div>`;
  $('ap-id').textContent=schoolId;
  $('ap-pwd').textContent=defPwd;
  approvalData={id:dealId,deal,schoolId,password:defPwd};
  openM('approve-modal');
}

async function confirmApproval(){
  if(!approvalData)return;
  const{id,deal,schoolId,password}=approvalData;
  const commission=Math.round((deal.tier?.price||0)*((deal.agent?.commission||20)/100)*(deal.terms||1));
  SQ.push({t:'updateDeal',id,d:{status:'approved',schoolId,approvedAt:new Date()}});
  SQ.push({t:'addSchoolRecord',d:{schoolId,schoolName:deal.school?.name,principalPhone:deal.school?.phone,principalEmail:deal.school?.email||'',password,tier:deal.tier?.name,tierPrice:deal.tier?.price,agentName:deal.agent?.name,agentPhone:deal.agent?.phone,approvedAt:new Date(),termsPaid:deal.terms||1}});
  const schoolDoc={
    config:{plan:'basic',fee:50000,schoolName:deal.school?.name||'',principalEmail:deal.school?.email||'',whatsapp:deal.school?.phone||'',studentCount:deal.school?.studentCount||0,tier:deal.tier?.name||'',tierPrice:deal.tier?.price||0,createdAt:new Date().toISOString(),trialStart:new Date().toISOString(),agent:{name:deal.agent?.name||'',phone:deal.agent?.phone||'',agentId:deal.agent?.id||''}},
    staff:[{name:'Principal',email:deal.school?.email||(schoolId.toLowerCase()+'@bloom.edu.ng'),password,role:'Principal',phone:deal.school?.phone||''}],
    students:[],expenses:[],attendance:{},sports:{teams:{},custom:[]},arts:{gallery:[]},
    music:{practiceLogs:[],instruments:[]},health:[],alumni:[],socialPages:[],commsLog:[],opportunities:[]
  };
  try{
    await db.collection('schools').doc(schoolId).set(schoolDoc,{merge:true});
    console.log('✅ School created:',schoolId);
  }catch(e){
    console.warn('Direct write failed, queuing:',e);
    SQ.push({t:'createSchool',id:schoolId,d:schoolDoc});
  }
  SQ.push({t:'addLedger',d:{dealId:id,schoolId,agent:deal.agent?.name,agentPhone:deal.agent?.phone,amount:commission,paid:false,date:new Date()}});
  try{
    const sd=await db.collection('admin_settings').doc('main').get();
    const autoCAC=sd.exists?(sd.data().autoCAC||'full'):'full';
    const cacDoc=await db.collection('admin_cac').doc('progress').get();
    let raised=cacDoc.exists?(cacDoc.data().raised||0):0;
    if(autoCAC==='full')raised+=commission;
    else if(autoCAC==='half')raised+=Math.round(commission/2);
    SQ.push({t:'updateCAC',d:{raised,updatedAt:new Date()}});
    updateCACDisplay(raised);
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

async function repairSchool(schoolId){
  if(!schoolId)schoolId=prompt('Enter School ID to repair (e.g. BLOOM-CYW96U):');
  if(!schoolId)return;
  schoolId=schoolId.trim().toUpperCase();
  try{
    const snap=await db.collection('admin_approved_schools').where('schoolId','==',schoolId).get();
    if(snap.empty){alert('School ID not found.');return;}
    const s=snap.docs[0].data();
    const schoolDoc={config:{plan:'basic',fee:50000,schoolName:s.schoolName||'',principalEmail:s.principalEmail||'',whatsapp:s.principalPhone||'',createdAt:new Date().toISOString()},staff:[{name:'Principal',email:s.principalEmail||(schoolId.toLowerCase()+'@bloom.edu.ng'),password:s.password,role:'Principal',phone:s.principalPhone||''}],students:[],expenses:[],attendance:{},sports:{teams:{},custom:[]},arts:{gallery:[]},music:{practiceLogs:[],instruments:[]},health:[],alumni:[],socialPages:[],commsLog:[],opportunities:[]};
    await db.collection('schools').doc(schoolId).set(schoolDoc,{merge:true});
    alert('✅ Repaired!\n\nSchool ID: '+schoolId+'\nPassword: '+s.password);
    log('🔧 Repaired school: '+schoolId);
  }catch(e){alert('Repair failed: '+(e.message||e));}
}

async function rejectDeal(dealId,schoolName){
  if(!confirm(`Reject deal for "${schoolName}"? It will be marked rejected but stay in the database.`))return;
  SQ.push({t:'updateDeal',id:dealId,d:{status:'rejected',rejectedAt:new Date()}});
  await log(`❌ Rejected deal: ${schoolName}`);
  renderDashboard();
}

// DELETE a pending deal entirely (removes from database)
async function deleteDeal(dealId, schoolName){
  if(!confirm(`Permanently delete this pending deal for "${schoolName}"? It cannot be recovered.`))return;
  if(!db){alert('No database connection.');return;}
  try{
    await db.collection('admin_deals').doc(dealId).delete();
    await log(`🗑️ Deleted pending deal: ${schoolName}`);
  }catch(e){alert('Delete failed: '+(e.message||e));}
}

// ── Dashboard ──────────────────────────────────────────────────────────────
async function renderDashboard(){
  try{
    const[appr,ledger,cac]=await Promise.all([
      db.collection('admin_approved_schools').get(),
      db.collection('admin_ledger').get(),
      db.collection('admin_cac').doc('progress').get()
    ]);
    $('d-approved').textContent=appr.size;
    $('d-agents').textContent=_agentsCache.length;
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

// ── Approved Schools ───────────────────────────────────────────────────────
async function renderApproved(){
  const c=$('approved-list');
  if(c)c.innerHTML='<p style="text-align:center;color:var(--sub);padding:2rem;">⏳ Loading schools...</p>';
  let schools=[];
  let liveData={};
  try{
    schools=(await db.collection('admin_approved_schools').get()).docs.map(d=>({_id:d.id,...d.data()}));
    const snaps=await Promise.allSettled(schools.map(s=>db.collection('schools').doc(s.schoolId).get()));
    snaps.forEach((r,i)=>{
      if(r.status==='fulfilled'&&r.value.exists){
        const cfg=r.value.data().config||{};
        liveData[schools[i].schoolId]={studentCount:cfg.studentCount||0,tierExceededAt:cfg.tierExceededAt||null,tierExceededNewTier:cfg.tierExceededNewTier||null,plan:cfg.plan||'basic',tierMax:cfg.tierMax||0};
      }
    });
  }catch(e){
    console.error('renderApproved:',e);
    if(c)c.innerHTML=`<div style="text-align:center;padding:2rem;">
      <p style="color:#f87171;margin-bottom:0.75rem;">⚠️ Could not load schools. Check connection.</p>
      <button class="btn-b" style="width:auto;" onclick="renderApproved()">🔄 Retry</button>
    </div>`;
    return;
  }
  const q=($('search-approved')?.value||'').toLowerCase();
  if(q)schools=schools.filter(s=>(s.schoolName||'').toLowerCase().includes(q)||(s.schoolId||'').toLowerCase().includes(q));
  if(!schools.length){c.innerHTML='<p style="text-align:center;color:var(--sub);padding:2rem;">No approved schools.</p>';return;}
  const TIERS=[{max:50,price:10000,name:'Starter (1–50)'},{max:100,price:20000,name:'Small (51–100)'},{max:200,price:35000,name:'Medium (101–200)'},{max:350,price:55000,name:'Large (201–350)'},{max:9999,price:75000,name:'Enterprise (351+)'}];
  c.innerHTML=schools.map(s=>{
    const live=liveData[s.schoolId]||{};
    const count=live.studentCount||0;
    const isPrem=live.plan==='premium';
    const tierExceeded=!!live.tierExceededAt;
    const tierMax=live.tierMax||TIERS.find(t=>(s.tierPrice||0)<=t.price)?.max||50;
    const newTier=live.tierExceededNewTier||{};
    const statusChip=tierExceeded?`<span class="chip" style="background:#dc2626;color:#fff;">⚠️ OVER TIER</span>`:`<span class="chip ca">ACTIVE</span>`;
    const planChip=isPrem?`<span class="chip" style="background:#7c3aed;color:#fff;margin-left:4px;">⭐ PREMIUM</span>`:'';
    const overAlert=tierExceeded?`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:7px;padding:0.4rem 0.6rem;font-size:0.74rem;color:#dc2626;margin-top:4px;">⚠️ ${count} students exceeds tier limit (${tierMax}). Needs upgrade to <b>${newTier.name||'?'}</b> — ${fmt(newTier.price||0)}/term</div>`:'';
    return`<div class="deal appr" style="${tierExceeded?'border-left:3px solid #dc2626;':''}">
      <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:4px;">${statusChip}${planChip}${count?`<span style="font-size:0.7rem;background:#1a3048;border:1px solid var(--border);border-radius:12px;padding:1px 8px;color:var(--sub);">👥 ${count} students</span>`:''}</div>
      <div class="dn">${esc(s.schoolName)}</div>
      <div class="dm">ID: <span style="font-family:'JetBrains Mono',monospace;color:#60a5fa;">${s.schoolId}</span> · ${esc(s.tier)}</div>
      <div class="dm">📱 ${esc(s.principalPhone)} · Agent: ${esc(s.agentName)}</div>
      <div class="dm" style="color:var(--text);">🔑 ${esc(s.password)}</div>
      ${overAlert}
      <div class="dact" style="flex-wrap:wrap;gap:6px;margin-top:8px;">
        <button class="btn-sm" style="background:#25d366;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:0.74rem;cursor:pointer;font-weight:700;" onclick="resend('${s.schoolId}')">📤 Resend</button>
        <button class="btn-sm" style="background:#374151;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:0.74rem;cursor:pointer;" onclick="copyC('${s.schoolId}')">📋 Copy</button>
        <button class="btn-sm" style="background:#1e40af;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:0.74rem;cursor:pointer;font-weight:700;" onclick="openEditSchool('${s._id}','${s.schoolId}')">✏️ Edit</button>
        <button class="btn-sm" style="background:#dc2626;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:0.78rem;cursor:pointer;font-weight:700;" onclick="deleteSchool('${s._id}','${s.schoolId}','${esc(s.schoolName)}')">🗑️ Delete School</button>
        ${isPrem
          ?`<button onclick="setPlan('${s.schoolId}','basic')" style="background:#1a3048;border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:0.74rem;cursor:pointer;color:var(--sub);">Downgrade to Basic</button>`
          :`<button onclick="setPlan('${s.schoolId}','premium')" style="background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:0.74rem;cursor:pointer;font-weight:700;">⭐ Activate Premium</button>`}
        ${tierExceeded?`<button onclick="unlockSchool('${s.schoolId}')" style="background:#dcfce7;border:1px solid #86efac;border-radius:6px;padding:5px 10px;font-size:0.74rem;cursor:pointer;color:#16a34a;font-weight:700;">🔓 Unlock (paid)</button>`:''}
      </div>
    </div>`;
  }).join('');
}

async function setPlan(schoolId,plan){
  if(!confirm(`Set ${schoolId} to ${plan.toUpperCase()} plan?`))return;
  try{
    await db.collection('schools').doc(schoolId).update({'config.plan':plan});
    const snap=await db.collection('admin_approved_schools').where('schoolId','==',schoolId).get();
    if(!snap.empty)await snap.docs[0].ref.update({plan});
    await log(`⭐ ${schoolId} set to ${plan.toUpperCase()}`);
    renderApproved();
  }catch(e){alert('Error: '+e.message);}
}

async function unlockSchool(schoolId){
  if(!confirm(`Confirm payment received and unlock ${schoolId}?`))return;
  try{
    await db.collection('schools').doc(schoolId).update({'config.tierExceededAt':null,'config.tierExceededNewTier':null});
    const alerts=await db.collection('admin_alerts').where('schoolId','==',schoolId).where('resolved','==',false).get();
    alerts.docs.forEach(d=>d.ref.update({resolved:true,resolvedAt:new Date()}));
    await log(`🔓 Unlocked ${schoolId} after tier upgrade payment`);
    renderApproved();
  }catch(e){alert('Error: '+e.message);}
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
    const txt=`School ID: ${s.schoolId}\nPassword: ${s.password}\nPortal: https://kobomoba.github.io/School-Bloom/`;
    navigator.clipboard.writeText(txt).then(()=>alert('✅ Copied!')).catch(()=>prompt('Copy:',txt));
  }catch(e){}
}

// ── DELETE SCHOOL ──────────────────────────────────────────────────────────
async function deleteSchool(docId,schoolId,schoolName){
  if(!confirm(`⚠️ DELETE SCHOOL\n\nSchool: "${schoolName}"\nID: ${schoolId}\n\nThis will remove the school from the approved list AND delete their login account. They will no longer be able to access their portal.\n\nThis cannot be undone. Continue?`))return;
  if(!db){alert('No database connection. Must be online to delete.');return;}
  if(!navigator.onLine){alert('You are offline. Connect to the internet first.');return;}
  try{
    // Delete from approved schools list
    await db.collection('admin_approved_schools').doc(docId).delete();
    // Delete the school portal document
    await db.collection('schools').doc(schoolId).delete().catch(()=>{});
    await log(`🗑️ DELETED school: ${schoolName} (${schoolId})`);
    alert(`✅ "${schoolName}" has been deleted.`);
    renderApproved();
    renderDashboard();
  }catch(e){
    alert('Delete failed: '+(e.message||e)+'\n\nCheck your internet connection and try again.');
    console.error('deleteSchool:',e);
  }
}

// ── Agents Save / Delete ───────────────────────────────────────────────────
function normalizePhone(raw){
  let p=raw.trim().replace(/\D/g,'');
  if(p.startsWith('0')&&p.length===11)return'234'+p.slice(1);
  if(p.startsWith('234')&&p.length===13)return p;
  if(p.length===10)return'234'+p;
  return p;
}

async function saveAgent(){
  const name=$('ag-name').value.trim();
  const phone=normalizePhone($('ag-phone').value);
  const rate=parseFloat($('ag-rate').value)||20;
  if(!name||!phone||phone.length<10)return alert('Name and valid phone required (e.g. 08012345678).');
  const btn=$('add-agent-btn');
  if(btn){btn.textContent='Saving...';btn.disabled=true;}
  const agentData={name,phone,commission:rate,joinedAt:new Date()};
  try{
    if(db&&navigator.onLine){
      await db.collection('admin_agents').add(agentData);
      // Listener fires automatically — no manual renderAgents() needed
    }else{
      SQ.push({t:'addAgent',d:agentData});
      // Show optimistically while offline
      _agentsCache=[..._agentsCache,{id:'pending_'+Date.now(),...agentData}];
      renderAgentsListFromCache();
    }
    closeM('add-agent-modal');
    $('ag-name').value='';$('ag-phone').value='';$('ag-rate').value='20';
    log(`👤 Added agent: ${name} (${phone})`);
  }catch(e){
    alert('Failed to save agent: '+(e.message||'Unknown error.'));
    console.error('saveAgent:',e);
  }finally{
    if(btn){btn.textContent='💾 Add Agent';btn.disabled=false;}
  }
}

async function deleteAgent(id,name){
  if(!confirm(`DELETE AGENT\n\n"${name}"\n\nThis removes them from the system permanently. Their past commission records in the Ledger are NOT deleted.\n\nContinue?`))return;
  if(!db){alert('No database connection.');return;}
  try{
    if(navigator.onLine){
      await db.collection('admin_agents').doc(id).delete();
      // Listener fires and updates list automatically
    }else{
      SQ.push({t:'deleteAgent',id});
      _agentsCache=_agentsCache.filter(a=>a.id!==id);
      renderAgentsListFromCache();
    }
    log(`🗑️ Deleted agent: ${name}`);
  }catch(e){
    alert('Delete failed: '+(e.message||e));
    console.error('deleteAgent:',e);
  }
}

function openEditAgent(id){
  const a=_agentsCache.find(x=>x.id===id);
  if(!a){alert('Agent not found. Try refreshing the page.');return;}
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
  try{
    const data={name,phone,commission:rate};
    if(db&&navigator.onLine){
      await db.collection('admin_agents').doc(id).update(data);
      // Listener updates display
    }else{
      _agentsCache=_agentsCache.map(a=>a.id===id?{...a,...data}:a);
      renderAgentsListFromCache();
    }
    closeM('edit-agent-modal');
    log(`✏️ Updated agent: ${name}`);
  }catch(e){
    alert('Error saving: '+(e.message||'Try again.'));
  }finally{
    if(btn){btn.textContent='💾 Save Changes';btn.disabled=false;}
  }
}

// ── School Edit ────────────────────────────────────────────────────────────
function openEditSchool(docId,schoolId){
  if(!navigator.onLine){alert('Must be online to edit.');return;}
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
    await db.collection('admin_approved_schools').doc(docId).update({schoolName,principalPhone,principalEmail,password,agentName,updatedAt:new Date()});
    if(password)await db.collection('schools').doc(schoolId).update({'config.password':password}).catch(()=>{});
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
  $('ledger-body').innerHTML=entries.length===0
    ?'<tr><td colspan="6" style="text-align:center;color:var(--sub);padding:2rem;">No entries yet.</td></tr>'
    :entries.map(e=>{
      const dt=e.date?.toDate?e.date.toDate():new Date();
      return`<tr>
        <td style="font-size:0.75rem;">${dt.toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'2-digit'})}</td>
        <td>${esc(e.agent)}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;">${e.schoolId||'—'}</td>
        <td style="color:var(--money);font-weight:700;">${fmt(e.amount)}</td>
        <td><span class="chip ${e.paid?'ca':'cp'}" style="position:static;">${e.paid?'Paid':'Pending'}</span></td>
        <td>${e.paid
          ?'<span style="font-size:0.72rem;color:var(--sub);">Done</span>'
          :`<button class="btn-g btn-sm" onclick="markPaid('${e._id}','${esc(e.agent)}',${e.amount||0})">✅ Pay</button>`
        }</td>
      </tr>`;
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
    const csv=[['Date','Agent','School','Amount','Status'],...rows.map(r=>{
      const dt=r.date?.toDate?r.date.toDate():new Date();
      return[dt.toLocaleDateString('en-NG'),r.agent,r.schoolId,r.amount,r.paid?'Paid':'Pending'];
    })].map(r=>r.join(',')).join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download=`ledger-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    log('📥 Ledger exported');
  }).catch(()=>alert('Export failed.'));
}

// ── Opportunities ──────────────────────────────────────────────────────────
async function renderOpps(){
  let opps=[];
  try{opps=(await db.collection('admin_opportunities').get()).docs.map(d=>({id:d.id,...d.data()}));}catch(e){}
  $('opp-body').innerHTML=opps.length===0
    ?'<tr><td colspan="5" style="text-align:center;color:var(--sub);padding:2rem;">No opportunities yet.</td></tr>'
    :opps.map(o=>`<tr>
        <td>${esc(o.title)}</td><td>${esc(o.provider)}</td>
        <td><span class="chip ca" style="position:static;">${o.type}</span></td>
        <td style="font-size:0.75rem;">${o.deadline||'—'}</td>
        <td><button class="btn-d btn-sm" onclick="deleteOpp('${o.id}')">🗑️</button></td>
      </tr>`).join('');
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
  if(!confirm('Delete this opportunity?'))return;
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
      $('s-adminpwd').value='';
      $('s-schoolpwd').value=d.defaultSchoolPassword||'bloom2026';
      $('s-cac').value=d.autoCAC||'full';
      if(d.whatsappTemplate)$('s-tpl').value=d.whatsappTemplate;
    }
  }catch(e){}
}

async function saveSettings(){
  const pwd=$('s-adminpwd').value.trim();
  if(pwd&&pwd.length<4)return alert('Admin password must be at least 4 characters.');
  SQ.push({t:'saveSettings',d:{...(pwd?{adminPassword:pwd}:{}),defaultSchoolPassword:$('s-schoolpwd').value,autoCAC:$('s-cac').value,whatsappTemplate:$('s-tpl').value,updatedAt:new Date()}});
  alert('✅ Settings saved!');
  log('⚙️ Settings updated');
}

// ── PRODUCTION RESET ───────────────────────────────────────────────────────
// Wipes ALL test/demo data. Keeps: Settings, CAC balance, Agents.
// Use this once before going live with real schools.
async function productionReset(){
  if(!db||!navigator.onLine){alert('Must be online to reset.');return;}

  // Step 1: Show what will be deleted
  let dealCount=0,schoolCount=0,ledgerCount=0,actCount=0;
  try{
    dealCount=(await db.collection('admin_deals').get()).size;
    schoolCount=(await db.collection('admin_approved_schools').get()).size;
    ledgerCount=(await db.collection('admin_ledger').get()).size;
    actCount=(await db.collection('admin_activity').get()).size;
  }catch(e){alert('Could not read data counts: '+(e.message||e));return;}

  const confirmed=confirm(
    `⚠️ PRODUCTION RESET\n\nThis will permanently delete ALL test data:\n\n`+
    `• ${dealCount} deal records (pending + rejected + approved)\n`+
    `• ${schoolCount} approved school records\n`+
    `• ${ledgerCount} commission ledger entries\n`+
    `• ${actCount} activity log entries\n`+
    `• All school portal documents in Firestore\n\n`+
    `KEPT: Your settings, agents list, and CAC fund balance.\n\n`+
    `This is for wiping test data before real sales begin. It CANNOT be undone.\n\nProceed?`
  );
  if(!confirmed)return;

  const typed=prompt('Type  RESET  (in capitals) to confirm:');
  if(typed!=='RESET'){alert('Cancelled — nothing was deleted.');return;}

  const btn=document.getElementById('prod-reset-btn');
  if(btn){btn.textContent='Wiping...';btn.disabled=true;}

  try{
    // Get all school IDs before deleting the list
    const schoolSnap=await db.collection('admin_approved_schools').get();
    const schoolIds=schoolSnap.docs.map(d=>d.data().schoolId).filter(Boolean);

    // Delete in batches (Firestore batch max = 500 ops)
    const batchDelete=async(col)=>{
      const snap=await db.collection(col).get();
      const batches=[];
      let b=db.batch();let count=0;
      snap.docs.forEach(d=>{b.delete(d.ref);count++;if(count===499){batches.push(b);b=db.batch();count=0;}});
      if(count>0)batches.push(b);
      await Promise.all(batches.map(x=>x.commit()));
    };

    await batchDelete('admin_deals');
    await batchDelete('admin_approved_schools');
    await batchDelete('admin_ledger');
    await batchDelete('admin_activity');

    // Delete all school portal documents
    for(const sid of schoolIds){
      await db.collection('schools').doc(sid).delete().catch(()=>{});
    }

    // Reset local storage cache
    localStorage.removeItem('ad_sq');
    localStorage.removeItem('ad_act');

    alert(
      `✅ PRODUCTION RESET COMPLETE\n\n`+
      `Deleted:\n`+
      `• ${dealCount} deals\n`+
      `• ${schoolCount} schools\n`+
      `• ${ledgerCount} ledger entries\n`+
      `• ${actCount} activity entries\n`+
      `• ${schoolIds.length} school portal documents\n\n`+
      `Your settings, agents, and CAC balance are untouched.\n\n`+
      `You are ready for real sales.`
    );
    renderDashboard();
    renderApproved();
  }catch(e){
    alert('Reset failed partway through: '+(e.message||e)+'\n\nSome data may have been deleted. Reload the page and check.');
  }finally{
    if(btn){btn.textContent='🧹 Wipe All Test Data';btn.disabled=false;}
  }
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
    a.download=`aarinat-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    log('📥 Full backup exported');
  }catch(e){alert('Export failed. Check connection.');}
}

async function clearAll(){
  if(!confirm('Delete EVERYTHING including settings, agents and CAC balance?'))return;
  if(prompt('Type DELETE to confirm:')!=='DELETE')return alert('Cancelled.');
  for(const col of['admin_agents','admin_deals','admin_approved_schools','admin_ledger','admin_opportunities','admin_activity']){
    const s=await db.collection(col).get();const b=db.batch();s.docs.forEach(d=>b.delete(d.ref));await b.commit();
  }
  await db.collection('admin_settings').doc('main').delete().catch(()=>{});
  await db.collection('admin_cac').doc('progress').delete().catch(()=>{});
  localStorage.removeItem('ad_sq');localStorage.removeItem('ad_act');
  alert('All data cleared.');
  location.reload();
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  SQ.ping();
  const authRaw=localStorage.getItem('ad_auth');
  const authTime=parseInt(localStorage.getItem('ad_auth_time')||'0');
  const EIGHT_HOURS=8*60*60*1000;
  const sessionValid=authRaw==='1'&&(Date.now()-authTime)<EIGHT_HOURS;
  if(sessionValid){
    $('login-screen').style.display='none';
    $('main-app').style.display='block';
    initAdmin();
  }else if(authRaw){
    localStorage.removeItem('ad_auth');
    localStorage.removeItem('ad_auth_time');
  }
});

async function loadAlerts(){
  try{
    const snap=await db.collection('admin_alerts').where('resolved','==',false).get();
    const count=snap.size;
    const badge=document.getElementById('alert-badge');
    if(badge){badge.textContent=count>0?count:'';badge.style.display=count>0?'inline-flex':'none';}
  }catch(e){}
}
