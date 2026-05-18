// ── Firebase ───────────────────────────────────────────────────────────────
const FB={apiKey:"AIzaSyCVEdunn3AZndDP5Rm1Z3Kv1e6G6W2mB_o",authDomain:"educationbloom-699ed.firebaseapp.com",projectId:"educationbloom-699ed",storageBucket:"educationbloom-699ed.firebasestorage.app",messagingSenderId:"33750392965",appId:"1:33750392965:web:2b3da887ede996ea8389ec"};
let db=null;
try{firebase.initializeApp(FB);db=firebase.firestore();}catch(e){console.warn('FB:',e);}

// ── State ──────────────────────────────────────────────────────────────────
let schoolId=null, userRole=null, schoolData={config:{},students:[],staff:[],expenses:[],attendance:{}};
let activeStudentIdx=null;
let activeProfileTab='fees';

// ── Sync ───────────────────────────────────────────────────────────────────
const SQ={
  q:JSON.parse(localStorage.getItem('portal_sq')||'[]'),
  save(){localStorage.setItem('portal_sq',JSON.stringify(this.q));},
  push(op){this.q.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2),op,tries:0});this.save();this.flush();},
  ping(){
    const ok=navigator.onLine&&!!db;
    const el=document.getElementById('sync');
    if(el){el.className='sync-dot '+(ok?this.q.length?'sd-sync':'sd-on':'sd-off');el.textContent=ok?this.q.length?'● Syncing':'● Online':'● Offline';}
    if(ok&&this.q.length)this.flush();
  },
  async flush(){
    if(!db||!navigator.onLine||!this.q.length)return;
    const items=[...this.q];
    for(const item of items){
      try{await this.exec(item.op);this.q=this.q.filter(x=>x.id!==item.id);}
      catch(e){item.tries++;if(item.tries>3)this.q=this.q.filter(x=>x.id!==item.id);}
    }
    this.save();this.ping();
  },
  async exec(op){
    if(!schoolId)return;
    await db.collection('schools').doc(schoolId).set({[op.key]:op.data},{merge:true});
  }
};
window.addEventListener('online',()=>SQ.ping());
window.addEventListener('offline',()=>SQ.ping());

async function saveKey(key,data){
  schoolData[key]=data;
  localStorage.setItem(`portal_${schoolId}_${key}`,JSON.stringify(data));
  SQ.push({key,data});
}

function loadLocalKey(key,def){
  if(schoolId){
    const v=localStorage.getItem(`portal_${schoolId}_${key}`);
    if(v)try{return JSON.parse(v);}catch(e){}
  }
  return def;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const $=id=>document.getElementById(id);
const esc=s=>{if(!s)return'';const d=document.createElement('div');d.textContent=s;return d.innerHTML;};
const fmt=n=>'₦'+Number(n||0).toLocaleString('en-NG');
const openM=id=>$(id).classList.add('on');
const closeM=id=>$(id).classList.remove('on');
window.onclick=e=>{if(e.target.classList.contains('modal'))e.target.classList.remove('on');};
document.onkeydown=e=>{if(e.key==='Escape')document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));};

function gradeScore(total){
  if(total>=70)return{g:'A',r:'Excellent'};
  if(total>=60)return{g:'B',r:'Good'};
  if(total>=50)return{g:'C',r:'Average'};
  if(total>=40)return{g:'D',r:'Below Average'};
  return{g:'F',r:'Fail'};
}

// ── Login ──────────────────────────────────────────────────────────────────
async function doLogin(){
  const sid=$('l-school').value.trim();
  const email=$('l-email').value.trim();
  const pwd=$('l-pwd').value;
  const btn=$('l-btn');btn.textContent='Checking...';btn.disabled=true;
  const err=$('l-err');err.style.display='none';

  if(!sid||!email||!pwd){err.textContent='Fill in all fields.';err.style.display='block';btn.textContent='▶ Login';btn.disabled=false;return;}

  try{
    let school;
    // Try Firestore
    try{
      const doc=await db.collection('schools').doc(sid).get();
      if(doc.exists)school=doc.data();
    }catch(e){}
    // Fall back to localStorage (offline)
    if(!school){
      const local=localStorage.getItem(`portal_${sid}_config`);
      if(local)school={config:JSON.parse(local),staff:loadLocalKey('staff',[])};
    }
    if(!school){err.textContent='School ID not found. Check your credentials.';err.style.display='block';btn.textContent='▶ Login';btn.disabled=false;return;}
    const staffList=school.staff||[];
    const user=staffList.find(s=>s.email===email);
    if(!user||user.password!==pwd){err.textContent='Wrong email or password.';err.style.display='block';btn.textContent='▶ Login';btn.disabled=false;return;}
    schoolId=sid;userRole=user.role;
    localStorage.setItem('portal_auth',JSON.stringify({schoolId:sid,email,role:user.role}));
    // Cache all school data locally
    schoolData.config=school.config||{};
    schoolData.students=school.students||[];
    schoolData.staff=staffList;
    schoolData.expenses=school.expenses||[];
    schoolData.attendance=school.attendance||{};
    // Also cache keys
    Object.keys(school).forEach(k=>localStorage.setItem(`portal_${sid}_${k}`,JSON.stringify(school[k])));
    startApp();
  }catch(e){
    // Offline fallback using cached data
    const cachedConfig=localStorage.getItem(`portal_${sid}_config`);
    const cachedStaff=localStorage.getItem(`portal_${sid}_staff`);
    if(cachedConfig&&cachedStaff){
      const staffList=JSON.parse(cachedStaff);
      const user=staffList.find(s=>s.email===email);
      if(user&&user.password===pwd){
        schoolId=sid;userRole=user.role;
        localStorage.setItem('portal_auth',JSON.stringify({schoolId:sid,email,role:user.role}));
        schoolData.config=JSON.parse(cachedConfig);
        schoolData.students=loadLocalKey('students',[]);
        schoolData.staff=staffList;
        schoolData.expenses=loadLocalKey('expenses',[]);
        schoolData.attendance=loadLocalKey('attendance',{});
        startApp();return;
      }
    }
    err.textContent='Connection failed and no cached data found.';err.style.display='block';
  }
  btn.textContent='▶ Login';btn.disabled=false;
}

function logout(){if(!confirm('Logout?'))return;localStorage.removeItem('portal_auth');location.reload();}

// ── Start App ──────────────────────────────────────────────────────────────
function startApp(){
  $('login').style.display='none';
  $('app').style.display='block';
  const name=schoolData.config.schoolName||schoolId;
  $('hdr-school').textContent=name;
  $('hdr-role').textContent=userRole;
  SQ.ping();
  renderFeeBanner();
  go('dashboard');
}

// ── Navigation ─────────────────────────────────────────────────────────────
function go(tab){
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on'));
  document.querySelectorAll('.nlink').forEach(b=>b.classList.remove('on'));
  $(`sec-${tab}`).classList.add('on');
  const btn=document.querySelector(`[data-t="${tab}"]`);if(btn)btn.classList.add('on');
  if(tab==='dashboard')renderDashboard();
  if(tab==='students') renderStudentList();
  if(tab==='expenses') renderExpenses();
  if(tab==='analytics')renderAnalytics();
  if(tab==='settings') loadSettings();
}

// ── Fee Banner ─────────────────────────────────────────────────────────────
function renderFeeBanner(){
  const students=schoolData.students||[];
  let outstanding=0,overdue=0;
  students.forEach(s=>{const owe=(s.totalFee||0)-(s.paid||0);if(owe>0){outstanding+=owe;overdue++;}});
  $('banner-amount').textContent=fmt(outstanding);
  $('banner-sub').textContent=`${overdue} parent${overdue!==1?'s':''} overdue · ${students.length} total students`;
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function renderDashboard(){
  renderFeeBanner();
  const s=schoolData.students||[];
  let exp=0,col=0;
  s.forEach(x=>{exp+=(x.totalFee||0);col+=(x.paid||0);});
  const pct=exp>0?Math.round((col/exp)*100):0;
  $('d-students').textContent=s.length;
  $('d-collected').textContent=fmt(col);
  $('d-outstanding').textContent=fmt(exp-col);
  $('d-staff').textContent=(schoolData.staff||[]).length;
  $('prog-fill').style.width=pct+'%';
  $('prog-pct').textContent=pct+'%';
  // Overdue list (top 5)
  const overdue=s.filter(x=>(x.totalFee||0)-(x.paid||0)>0).sort((a,b)=>((b.totalFee||0)-(b.paid||0))-((a.totalFee||0)-(a.paid||0))).slice(0,5);
  $('overdue-list').innerHTML=overdue.length===0?'<p style="text-align:center;color:var(--sub);padding:1rem;">All fees collected! 🎉</p>':overdue.map((s,i)=>{
    const owe=(s.totalFee||0)-(s.paid||0);
    const idx=schoolData.students.indexOf(s);
    return`<div class="stu-row">
      <div class="stu-av">${s.name.charAt(0).toUpperCase()}</div>
      <div style="flex:1;">
        <div class="stu-name">${esc(s.name)}</div>
        <div class="stu-meta">${esc(s.class||'—')} · Owes: <strong style="color:var(--danger);">${fmt(owe)}</strong></div>
      </div>
      <button class="btn-wa btn-sm" onclick="sendReminder(${idx})">📲</button>
    </div>`;
  }).join('');
}

// ── Students Tab (Central Hub) ─────────────────────────────────────────────
function renderStudentList(){
  const q=($('stu-search')?.value||'').toLowerCase();
  const clsFilter=$('stu-class-filter')?.value||'';
  const payFilter=$('stu-pay-filter')?.value||'';
  let students=[...schoolData.students];
  if(q)students=students.filter(s=>s.name.toLowerCase().includes(q)||(s.phone||'').includes(q));
  if(clsFilter)students=students.filter(s=>s.class===clsFilter);
  if(payFilter==='paid')students=students.filter(s=>(s.totalFee||0)<=(s.paid||0));
  else if(payFilter==='owing')students=students.filter(s=>(s.totalFee||0)-(s.paid||0)>0);
  const c=$('students-list');
  if(!students.length){c.innerHTML='<p style="text-align:center;color:var(--sub);padding:2rem;">No students match. Add students below.</p>';return;}
  c.innerHTML=students.map((s,i)=>{
    const realIdx=schoolData.students.indexOf(s);
    const owe=(s.totalFee||0)-(s.paid||0);
    const pbClass=owe<=0?'pb-paid':s.paid>0?'pb-part':'pb-owe';
    const pbText=owe<=0?'Paid':s.paid>0?'Partial':'Unpaid';
    return`<div class="stu-row" onclick="openStudentProfile(${realIdx})">
      <div class="stu-av">${s.name.charAt(0).toUpperCase()}</div>
      <div style="flex:1;min-width:0;">
        <div class="stu-name">${esc(s.name)}</div>
        <div class="stu-meta">${esc(s.class||'—')} · 📱 ${s.phone||'—'}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.3rem;flex-shrink:0;">
        <span class="pay-badge ${pbClass}">${pbText}</span>
        ${owe>0?`<span style="font-size:0.7rem;color:var(--danger);">${fmt(owe)}</span>`:''}
      </div>
    </div>`;
  }).join('');
  populateClassFilter();
}

function populateClassFilter(){
  const sel=$('stu-class-filter');if(!sel)return;
  const classes=[...new Set(schoolData.students.map(s=>s.class).filter(Boolean))].sort();
  const cur=sel.value;
  sel.innerHTML='<option value="">All Classes</option>'+classes.map(c=>`<option value="${esc(c)}" ${c===cur?'selected':''}>${esc(c)}</option>`).join('');
}

// ── Student Profile ────────────────────────────────────────────────────────
function openStudentProfile(idx){
  activeStudentIdx=idx;
  activeProfileTab='fees';
  const s=schoolData.students[idx];
  if(!s)return;
  $('prof-name').textContent=s.name;
  $('prof-meta').textContent=`${s.class||'—'} · ${s.phone||'—'}`;
  renderProfileTab('fees');
  openM('student-modal');
}

function setProfileTab(tab){
  activeProfileTab=tab;
  document.querySelectorAll('.ptab').forEach(t=>t.classList.toggle('on',t.dataset.pt===tab));
  renderProfileTab(tab);
}

function renderProfileTab(tab){
  const s=schoolData.students[activeStudentIdx];if(!s)return;
  const c=$('profile-content');
  if(tab==='fees')       c.innerHTML=buildFeesTab(s,activeStudentIdx);
  else if(tab==='attendance') c.innerHTML=buildAttendanceTab(s);
  else if(tab==='scores')     c.innerHTML=buildScoresTab(s,activeStudentIdx);
  else if(tab==='report')     c.innerHTML=buildReportTab(s);
  else if(tab==='swot')       c.innerHTML=buildSWOTTab(s,activeStudentIdx);
}

// FEE TAB
function buildFeesTab(s,idx){
  const owe=(s.totalFee||0)-(s.paid||0);
  return`<div class="card" style="margin-bottom:0.75rem;">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:0.75rem;">
      <div class="stat"><div class="sn">${fmt(s.totalFee||0)}</div><div class="sl">Term Fee</div></div>
      <div class="stat"><div class="sn" style="color:var(--money);">${fmt(s.paid||0)}</div><div class="sl">Paid</div></div>
      <div class="stat"><div class="sn" style="color:var(--danger);">${fmt(owe)}</div><div class="sl">Owing</div></div>
    </div>
    <div class="prog-bg"><div class="prog-fill" style="width:${s.totalFee?Math.min(100,Math.round(((s.paid||0)/(s.totalFee||1))*100)):0}%;"></div></div>
    <div style="text-align:right;font-size:0.72rem;color:var(--sub);margin-top:3px;">${s.totalFee?Math.min(100,Math.round(((s.paid||0)/(s.totalFee||1))*100)):0}% collected</div>
  </div>
  <div class="card">
    <div class="ct">Record Payment</div>
    <label>Amount (₦)</label>
    <input type="number" id="pay-amount" placeholder="e.g. 25000">
    <label>Payment Method</label>
    <select id="pay-method"><option>Bank Transfer</option><option>Cash</option><option>POS</option><option>Online</option></select>
    <label>Date</label>
    <input type="date" id="pay-date" value="${new Date().toISOString().split('T')[0]}">
    <button class="btn-money" onclick="recordPayment(${idx})">💵 Record Payment</button>
    ${owe>0?`<button class="btn-wa" style="margin-top:0.4rem;" onclick="sendReminder(${idx})">📲 Send WhatsApp Reminder</button>`:''}
  </div>`;
}

async function recordPayment(idx){
  const amt=parseFloat($('pay-amount').value);
  if(!amt||amt<=0)return alert('Enter valid amount.');
  schoolData.students[idx].paid=(schoolData.students[idx].paid||0)+amt;
  if(!schoolData.students[idx].paymentHistory)schoolData.students[idx].paymentHistory=[];
  schoolData.students[idx].paymentHistory.unshift({amount:amt,method:$('pay-method').value,date:$('pay-date').value,recordedBy:userRole});
  await saveKey('students',schoolData.students);
  $('pay-amount').value='';
  renderProfileTab('fees');
  renderFeeBanner();
  renderDashboard();
  alert(`✅ Payment of ${fmt(amt)} recorded.`);
}

// ATTENDANCE TAB
function buildAttendanceTab(s){
  const today=new Date().toISOString().split('T')[0];
  const att=schoolData.attendance||{};
  // Last 14 days
  const days=[];
  for(let i=0;i<14;i++){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().split('T')[0]);}
  const total=days.filter(d=>att[d]&&att[d][s.name]).length;
  const present=days.filter(d=>att[d]&&att[d][s.name]==='Present').length;
  const pct=total>0?Math.round((present/total)*100):0;
  return`<div class="card" style="margin-bottom:0.75rem;">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;">
      <div class="stat"><div class="sn" style="color:var(--money);">${present}</div><div class="sl">Present</div></div>
      <div class="stat"><div class="sn" style="color:var(--danger);">${total-present}</div><div class="sl">Absent/Late</div></div>
      <div class="stat"><div class="sn">${pct}%</div><div class="sl">Rate</div></div>
    </div>
  </div>
  <div class="card">
    <div class="ct">📅 Mark Today (${today})</div>
    <div style="display:flex;gap:0.5rem;">
      <button class="btn-money btn-sm" onclick="markAtt(${activeStudentIdx},'${today}','Present')">✅ Present</button>
      <button class="btn-danger btn-sm" onclick="markAtt(${activeStudentIdx},'${today}','Absent')">❌ Absent</button>
      <button style="background:var(--warn);color:white;width:auto;padding:0.35rem 0.75rem;font-size:0.75rem;display:inline-block;margin:0;border-radius:6px;font-weight:700;" onclick="markAtt(${activeStudentIdx},'${today}','Late')">⏰ Late</button>
    </div>
    <div style="margin-top:1rem;">
      <div class="ct" style="font-size:0.82rem;">Recent 14 Days</div>
      ${days.map(d=>{
        const st=att[d]?.[s.name]||null;
        const cls=st==='Present'?'chip-ok':st==='Absent'?'chip-bad':st==='Late'?'chip-warn':'';
        return`<div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0;border-bottom:1px solid var(--border);font-size:0.82rem;">
          <span>${d}</span>
          ${st?`<span class="chip ${cls}">${st}</span>`:'<span style="color:var(--sub);font-size:0.72rem;">Not recorded</span>'}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

async function markAtt(idx,date,status){
  const s=schoolData.students[idx];
  if(!schoolData.attendance)schoolData.attendance={};
  if(!schoolData.attendance[date])schoolData.attendance[date]={};
  schoolData.attendance[date][s.name]=status;
  await saveKey('attendance',schoolData.attendance);
  renderProfileTab('attendance');
}

// SCORES TAB
function buildScoresTab(s,idx){
  const subjects=schoolData.config.subjects||['English','Mathematics','Basic Science','Social Studies','Civic Education'];
  const scores=s.scores||{};
  const term=schoolData.config.currentTerm||'Term 1';
  return`<div class="card">
    <div class="ct">📚 ${esc(term)} Scores</div>
    <p style="font-size:0.78rem;color:var(--sub);margin-bottom:0.75rem;">CA = 40 marks max · Exam = 60 marks max · Total = 100</p>
    <table class="score-table">
      <thead><tr><th>Subject</th><th>CA (40)</th><th>Exam (60)</th><th>Total</th><th>Grade</th></tr></thead>
      <tbody>
        ${subjects.map(sub=>{
          const sc=scores[sub]||{ca:0,exam:0};
          const total=(sc.ca||0)+(sc.exam||0);
          const{g}=gradeScore(total);
          return`<tr>
            <td style="font-weight:600;font-size:0.82rem;">${esc(sub)}</td>
            <td><input type="number" min="0" max="40" value="${sc.ca||''}" placeholder="0" onchange="updateScore(${idx},'${esc(sub)}','ca',this.value)"></td>
            <td><input type="number" min="0" max="60" value="${sc.exam||''}" placeholder="0" onchange="updateScore(${idx},'${esc(sub)}','exam',this.value)"></td>
            <td style="font-weight:700;font-family:'DM Mono',monospace;">${total||0}</td>
            <td><span class="grade-${g}">${g}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <button class="btn-brand" onclick="saveScores(${idx})">💾 Save Scores</button>
  </div>`;
}

async function updateScore(idx,subject,type,val){
  if(!schoolData.students[idx].scores)schoolData.students[idx].scores={};
  if(!schoolData.students[idx].scores[subject])schoolData.students[idx].scores[subject]={ca:0,exam:0};
  const v=Math.min(type==='ca'?40:60,Math.max(0,parseFloat(val)||0));
  schoolData.students[idx].scores[subject][type]=v;
}

async function saveScores(idx){
  await saveKey('students',schoolData.students);
  alert('✅ Scores saved!');
  renderProfileTab('scores');
}

// REPORT CARD TAB
function buildReportTab(s){
  const subjects=schoolData.config.subjects||['English','Mathematics','Basic Science','Social Studies','Civic Education'];
  const scores=s.scores||{};
  const term=schoolData.config.currentTerm||'Term 1';
  const session=schoolData.config.session||'2025/2026';
  const schoolName=schoolData.config.schoolName||'Educational Bloom School';
  let totalScore=0,subjectCount=0;
  const rows=subjects.map(sub=>{
    const sc=scores[sub]||{ca:0,exam:0};
    const total=(sc.ca||0)+(sc.exam||0);
    const{g,r}=gradeScore(total);
    totalScore+=total;subjectCount++;
    return{sub,ca:sc.ca||0,exam:sc.exam||0,total,g,r};
  });
  const avg=subjectCount>0?Math.round(totalScore/subjectCount):0;
  const overallGrade=gradeScore(avg);
  // Class position
  const classStudents=schoolData.students.filter(x=>x.class===s.class&&x.scores);
  const classAvgs=classStudents.map(x=>{
    const sc=x.scores||{};let t=0,n=0;
    subjects.forEach(sub=>{const v=sc[sub]||{};t+=(v.ca||0)+(v.exam||0);n++;});
    return{name:x.name,avg:n>0?Math.round(t/n):0};
  }).sort((a,b)=>b.avg-a.avg);
  const pos=classAvgs.findIndex(x=>x.name===s.name)+1;

  return`<div class="report-card" id="report-output">
    <div class="rc-header">
      <div class="rc-school">${esc(schoolName)}</div>
      <div class="rc-term">Academic Session: ${esc(session)} · ${esc(term)}</div>
      <div style="margin-top:0.5rem;font-size:0.85rem;">
        <strong>Student:</strong> ${esc(s.name)} &nbsp;|&nbsp; <strong>Class:</strong> ${esc(s.class||'—')} &nbsp;|&nbsp; <strong>Position:</strong> ${pos>0?pos+'/'+(classStudents.length||1):'—'}
      </div>
    </div>
    <table class="rc-table">
      <thead><tr><th>Subject</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Remark</th></tr></thead>
      <tbody>
        ${rows.map(r=>`<tr><td><strong>${esc(r.sub)}</strong></td><td>${r.ca}</td><td>${r.exam}</td><td><strong>${r.total}</strong></td><td class="grade-${r.g}"><strong>${r.g}</strong></td><td style="font-size:0.75rem;">${r.r}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="rc-footer">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;text-align:center;">
        <div><strong>${fmt(subjectCount)}</strong><div style="font-size:0.7rem;color:var(--sub);">Subjects</div></div>
        <div><strong>${totalScore}</strong><div style="font-size:0.7rem;color:var(--sub);">Total Score</div></div>
        <div><strong class="grade-${overallGrade.g}">${avg}% (${overallGrade.g})</strong><div style="font-size:0.7rem;color:var(--sub);">Average</div></div>
      </div>
      <div style="margin-top:0.75rem;font-size:0.82rem;">
        <strong>Class Teacher's Remark:</strong> ${overallGrade.r}. ${avg>=70?'Keep up the excellent work!':avg>=50?'Good effort. Work harder.':'More effort needed. Please study consistently.'}
      </div>
    </div>
    <div class="rc-sig">
      <div>Class Teacher: _______________</div>
      <div>Principal: _______________</div>
      <div>Date: ${new Date().toLocaleDateString('en-NG')}</div>
    </div>
  </div>
  <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
    <button class="btn-brand" onclick="printReport()">🖨️ Print Report Card</button>
    <button class="btn-wa" onclick="sendReportCard(${activeStudentIdx})">📲 Send via WhatsApp</button>
  </div>`;
}

function printReport(){
  const content=document.getElementById('report-output');
  if(!content)return;
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report Card</title>
    <style>body{font-family:sans-serif;padding:20px;color:#000;}table{width:100%;border-collapse:collapse;margin:10px 0;}th,td{padding:8px;border:1px solid #ccc;font-size:12px;}th{background:#4f46e5;color:white;}.rc-school{font-size:18px;font-weight:800;color:#4f46e5;text-align:center;}.rc-term{text-align:center;font-size:12px;color:#666;}.rc-header{border-bottom:2px solid #4f46e5;padding-bottom:10px;margin-bottom:10px;}.rc-footer{background:#f8f9fa;padding:10px;margin-top:10px;border-radius:8px;}.rc-sig{display:flex;justify-content:space-between;margin-top:15px;font-size:11px;color:#666;}@media print{button{display:none;}}</style>
    </head><body>${content.innerHTML}</body></html>`);
  w.document.close();w.print();
}

async function sendReportCard(idx){
  const s=schoolData.students[idx];
  const subjects=schoolData.config.subjects||['English','Mathematics','Basic Science','Social Studies','Civic Education'];
  const scores=s.scores||{};
  let lines=`📋 *REPORT CARD — ${schoolData.config.schoolName||'School'}*\n\n`;
  lines+=`*Student:* ${s.name}\n*Class:* ${s.class||'—'}\n*Term:* ${schoolData.config.currentTerm||'Term 1'}\n\n`;
  lines+=`*SUBJECT SCORES*\n`;
  subjects.forEach(sub=>{const sc=scores[sub]||{ca:0,exam:0};const t=(sc.ca||0)+(sc.exam||0);lines+=`${sub}: ${t}/100 (${gradeScore(t).g})\n`;});
  lines+=`\n_Contact school for full printed report card._`;
  if(s.phone)window.open(`https://wa.me/${s.phone.replace(/\D/g,'')}?text=${encodeURIComponent(lines)}`,'_blank');
  else alert('No phone number for this student.');
}

// SWOT TAB
function buildSWOTTab(s,idx){
  const sw=s.swot||{};
  return`<div class="card">
    <div class="ct">🧠 SWOT Analysis</div>
    <label>💪 Strengths</label>
    <textarea id="sw-s" rows="2" placeholder="e.g. Excellent in Mathematics, good team player">${esc(sw.strengths||'')}</textarea>
    <label>🔍 Weaknesses</label>
    <textarea id="sw-w" rows="2" placeholder="e.g. Needs improvement in writing, struggles with fractions">${esc(sw.weaknesses||'')}</textarea>
    <label>🚀 Opportunities</label>
    <textarea id="sw-o" rows="2" placeholder="e.g. Ready for STEM track, scholarship potential">${esc(sw.opportunities||'')}</textarea>
    <label>⚠️ Considerations</label>
    <textarea id="sw-t" rows="2" placeholder="e.g. Financial constraints, attendance issues">${esc(sw.threats||'')}</textarea>
    <label>💰 Estimated Family Capacity</label>
    <input type="text" id="sw-cap" value="${esc(sw.capacity||'')||''}" placeholder="e.g. ₦50,000–₦150,000/term">
    <button class="btn-brand" onclick="saveSWOT(${idx})">💾 Save SWOT</button>
  </div>`;
}

async function saveSWOT(idx){
  schoolData.students[idx].swot={strengths:$('sw-s').value,weaknesses:$('sw-w').value,opportunities:$('sw-o').value,threats:$('sw-t').value,capacity:$('sw-cap').value};
  await saveKey('students',schoolData.students);
  alert('✅ SWOT saved!');
}

// ── Send Reminder ──────────────────────────────────────────────────────────
function sendReminder(idx){
  const s=schoolData.students[idx];
  const owe=(s.totalFee||0)-(s.paid||0);
  const schoolName=schoolData.config.schoolName||'School Management';
  const msg=`Dear Parent,\n\nThis is a friendly reminder from *${schoolName}*.\n\n*${s.name}* has an outstanding fee balance of *${fmt(owe)}* for this term.\n\nKindly make payment at your earliest convenience to avoid disruption.\n\nThank you.\n– ${schoolName}`;
  if(s.phone)window.open(`https://wa.me/${s.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,'_blank');
  else alert('No phone number for this student.');
}

// ── Send All Reminders ─────────────────────────────────────────────────────
function sendAllReminders(){
  const overdue=schoolData.students.filter(s=>(s.totalFee||0)-(s.paid||0)>0);
  if(!overdue.length)return alert('No overdue students!');
  const schoolName=schoolData.config.schoolName||'School';
  // Open WhatsApp for first overdue student as a demonstration; real bulk needs API
  const s=overdue[0];
  const owe=(s.totalFee||0)-(s.paid||0);
  const msg=`Dear Parents,\n\n*${schoolName}* would like to remind all parents with outstanding fees to kindly make payment this week.\n\nThank you for your cooperation.\n– ${schoolName}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
  alert(`WhatsApp opened with reminder template.\n\nNote: ${overdue.length} students have outstanding fees totalling ${fmt(overdue.reduce((s,x)=>s+(x.totalFee||0)-(x.paid||0),0))}.`);
}

// ── Add Student ────────────────────────────────────────────────────────────
async function addStudent(){
  const name=$('ns-name').value.trim();
  const phone=$('ns-phone').value.trim().replace(/\D/g,'');
  const cls=$('ns-class').value.trim();
  const fee=parseFloat($('ns-fee').value)||schoolData.config.fee||50000;
  if(!name||!phone)return alert('Name and phone required.');
  schoolData.students.push({name,phone,class:cls,totalFee:fee,paid:0,scores:{},attendance:{},swot:{}});
  await saveKey('students',schoolData.students);
  closeM('add-student-modal');
  $('ns-name').value='';$('ns-phone').value='';$('ns-class').value='';
  renderStudentList();
  renderFeeBanner();
  renderDashboard();
  alert(`✅ ${name} added!`);
}

async function deleteStudent(idx){
  if(!confirm(`Delete ${schoolData.students[idx].name}?`))return;
  schoolData.students.splice(idx,1);
  await saveKey('students',schoolData.students);
  closeM('student-modal');
  renderStudentList();
  renderFeeBanner();
}

// ── Expenses ───────────────────────────────────────────────────────────────
function renderExpenses(){
  const expenses=schoolData.expenses||[];
  let total=0;expenses.forEach(e=>total+=e.amount||0);
  $('exp-total').textContent=fmt(total);
  $('exp-list').innerHTML=expenses.length===0?'<p style="text-align:center;color:var(--sub);padding:2rem;">No expenses logged yet.</p>':expenses.map((e,i)=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0;border-bottom:1px solid var(--border);">
    <div><div style="font-weight:600;font-size:0.88rem;">${esc(e.description)}</div><div style="font-size:0.72rem;color:var(--sub);">${esc(e.category)} · ${e.date}</div></div>
    <div style="display:flex;align-items:center;gap:0.5rem;">
      <span style="font-weight:700;font-family:'DM Mono',monospace;">${fmt(e.amount)}</span>
      <button class="btn-danger btn-sm" onclick="deleteExpense(${i})">🗑️</button>
    </div>
  </div>`).join('');
}

async function addExpense(){
  const cat=$('exp-cat').value;
  const desc=$('exp-desc').value.trim();
  const amt=parseFloat($('exp-amt').value);
  if(!desc||!amt)return alert('Fill in description and amount.');
  if(!schoolData.expenses)schoolData.expenses=[];
  schoolData.expenses.unshift({category:cat,description:desc,amount:amt,date:new Date().toISOString().split('T')[0],recordedBy:userRole});
  await saveKey('expenses',schoolData.expenses);
  $('exp-desc').value='';$('exp-amt').value='';
  closeM('add-expense-modal');
  renderExpenses();
}

async function deleteExpense(idx){
  if(!confirm('Delete?'))return;
  schoolData.expenses.splice(idx,1);
  await saveKey('expenses',schoolData.expenses);
  renderExpenses();
}

// ── Analytics ──────────────────────────────────────────────────────────────
function renderAnalytics(){
  const s=schoolData.students||[];
  const paid=s.filter(x=>(x.totalFee||0)<=(x.paid||0)).length;
  const partial=s.filter(x=>x.paid>0&&(x.totalFee||0)>(x.paid||0)).length;
  const unpaid=s.filter(x=>!x.paid||x.paid===0).length;
  const totalExp=s.reduce((t,x)=>t+(x.totalFee||0),0);
  const totalCol=s.reduce((t,x)=>t+(x.paid||0),0);
  const totalExpenses=(schoolData.expenses||[]).reduce((t,e)=>t+(e.amount||0),0);
  const net=totalCol-totalExpenses;
  $('an-stats').innerHTML=`
    <div class="stats">
      <div class="stat"><div class="sn" style="color:var(--money);">${paid}</div><div class="sl">Fully Paid</div></div>
      <div class="stat"><div class="sn" style="color:var(--warn);">${partial}</div><div class="sl">Partial</div></div>
      <div class="stat"><div class="sn" style="color:var(--danger);">${unpaid}</div><div class="sl">Unpaid</div></div>
      <div class="stat"><div class="sn" style="font-size:1rem;">${s.length}</div><div class="sl">Total Students</div></div>
    </div>
    <div class="card">
      <div class="ct">💰 Financial Summary</div>
      <div style="display:grid;gap:0.5rem;font-size:0.85rem;">
        <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);"><span>Total Expected</span><strong>${fmt(totalExp)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);"><span>Total Collected</span><strong style="color:var(--money);">${fmt(totalCol)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);"><span>Outstanding</span><strong style="color:var(--danger);">${fmt(totalExp-totalCol)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);"><span>Total Expenses</span><strong style="color:var(--warn);">${fmt(totalExpenses)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:0.5rem 0;"><span><strong>Net Balance</strong></span><strong style="color:${net>=0?'var(--money)':'var(--danger)'};">${fmt(net)}</strong></div>
      </div>
    </div>
    <button class="btn-brand" onclick="exportStudentsCSV()">📥 Export Students CSV</button>`;
}

function exportStudentsCSV(){
  const rows=[['Name','Class','Phone','Total Fee','Paid','Outstanding'],...schoolData.students.map(s=>[s.name,s.class||'',s.phone||'',s.totalFee||0,s.paid||0,(s.totalFee||0)-(s.paid||0)])];
  const csv=rows.map(r=>r.join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`students-${new Date().toISOString().split('T')[0]}.csv`;a.click();
}

// ── Settings ───────────────────────────────────────────────────────────────
function loadSettings(){
  const c=schoolData.config||{};
  $('set-name').value=c.schoolName||'';
  $('set-phone').value=c.whatsapp||'';
  $('set-email').value=c.principalEmail||'';
  $('set-fee').value=c.fee||50000;
  $('set-term').value=c.currentTerm||'Term 1';
  $('set-session').value=c.session||'2025/2026';
  $('set-subjects').value=(c.subjects||['English','Mathematics','Basic Science','Social Studies','Civic Education']).join(', ');
}

async function saveSettings(){
  const subjects=$('set-subjects').value.split(',').map(s=>s.trim()).filter(Boolean);
  schoolData.config={...schoolData.config,schoolName:$('set-name').value.trim(),whatsapp:$('set-phone').value.trim(),principalEmail:$('set-email').value.trim(),fee:parseFloat($('set-fee').value)||50000,currentTerm:$('set-term').value,session:$('set-session').value,subjects};
  await saveKey('config',schoolData.config);
  $('hdr-school').textContent=schoolData.config.schoolName||schoolId;
  renderFeeBanner();
  alert('✅ Settings saved!');
}

// ── CSV Import ─────────────────────────────────────────────────────────────
function handleCSV(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=async ev=>{
    const lines=ev.target.result.split(/\r?\n/).filter(x=>x.trim());
    if(lines.length<2){alert('Invalid CSV — needs header row and data.');return;}
    let count=0;
    for(let i=1;i<lines.length;i++){
      const cols=lines[i].split(',').map(c=>c.trim());
      if(cols[0]&&cols[1]){
        schoolData.students.push({name:cols[0],phone:cols[1].replace(/\D/g,''),class:cols[2]||'JSS1',totalFee:parseFloat(cols[3])||schoolData.config.fee||50000,paid:0,scores:{},swot:{}});
        count++;
      }
    }
    await saveKey('students',schoolData.students);
    $('csv-feedback').textContent=`✅ Imported ${count} students.`;
    renderStudentList();renderFeeBanner();renderDashboard();
  };
  r.readAsText(f);
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  SQ.ping();
  const saved=localStorage.getItem('portal_auth');
  if(saved){
    try{
      const auth=JSON.parse(saved);
      schoolId=auth.schoolId;userRole=auth.role;
      schoolData.config=loadLocalKey('config',{});
      schoolData.students=loadLocalKey('students',[]);
      schoolData.staff=loadLocalKey('staff',[]);
      schoolData.expenses=loadLocalKey('expenses',[]);
      schoolData.attendance=loadLocalKey('attendance',{});
      $('login').style.display='none';
      $('app').style.display='block';
      $('hdr-school').textContent=schoolData.config.schoolName||schoolId;
      $('hdr-role').textContent=userRole;
      renderFeeBanner();
      go('dashboard');
      // Refresh from Firestore in background
      if(db&&navigator.onLine){
        db.collection('schools').doc(schoolId).get().then(doc=>{
          if(!doc.exists)return;
          const d=doc.data();
          schoolData={...schoolData,...d};
          Object.keys(d).forEach(k=>localStorage.setItem(`portal_${schoolId}_${k}`,JSON.stringify(d[k])));
          renderFeeBanner();renderDashboard();
        }).catch(()=>{});
      }
      return;
    }catch(e){}
  }
  $('login').style.display='flex';$('app').style.display='none';
});
