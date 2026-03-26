function initTheme(){
  const s=localStorage.getItem('theme'),p=s||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
  document.documentElement.setAttribute('data-theme',p);
  document.getElementById('theme-toggle').addEventListener('click',()=>{
    const c=document.documentElement.getAttribute('data-theme'),n=c==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',n);localStorage.setItem('theme',n)});
}
function card(p){
  const cat=PROJECT_CATEGORIES[p.category]||{label:'Other',color:'var(--text-3)'};
  const click=p.status!=='planned'?`onclick="location.hash='#/projects/${p.id}'"`:''
  const cls=p.status==='planned'?'card planned':'card';
  const st=p.status==='planned'?'Planned':p.status==='wip'?'In progress':'';
  return`<div class="${cls}" ${click}><div class="card-top"><span class="card-badge" style="background:${cat.color}15;color:${cat.color}">${cat.label}</span>${st?`<span class="card-status">${st}</span>`:''}</div><div class="card-body"><h3>${p.title}</h3><p>${p.short}</p><div class="tags">${p.tags.slice(0,4).map(t=>`<span class="tag">${t}</span>`).join('')}</div></div></div>`;
}

function renderHome(c){
  const feat=PROJECTS.filter(p=>p.status==='live').concat(PROJECTS.filter(p=>p.status!=='live')).slice(0,4);
  c.innerHTML=`<section class="hero">
    <div class="hero-label">Engineering · Mathematics · Software · Simulation</div>
    <h1>Systems that are <span class="accent">modelled, understood,</span> and <span class="accent">built</span></h1>
    <p>Mechanical engineer with experience in control systems, mathematical modelling, and software development. This site hosts interactive projects spanning control theory, algorithms, and simulation — each with real physics, real math, and adjustable parameters.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><a href="#/projects" class="btn btn-p">Explore projects</a><a href="#/cv" class="btn">View CV</a></div>
  </section>
  <section class="section"><h2>Projects</h2><div class="grid">${feat.map(card).join('')}</div></section>
  <section class="section" style="max-width:620px"><h2>Under the hood</h2>
    <p>Simulations run first-principle physics with 4th-order Runge-Kutta integration. Control projects implement real algorithms — PID, LQR via the algebraic Riccati equation — operating on full nonlinear models. Everything runs in the browser with no backend.</p>
    <p>Performance is measured with standard metrics where applicable: settling time, steady-state error, overshoot, and more.</p></section>`;
}

function renderProjects(c){
  let f='all';
  function draw(){
    const list=f==='all'?PROJECTS:PROJECTS.filter(p=>p.category===f);
    c.innerHTML=`<section style="padding-top:28px"><h1>Projects</h1><p>Interactive simulations with adjustable physics, switchable controllers, and performance metrics.</p>
      <div class="filters"><button class="fbtn ${f==='all'?'active':''}" data-f="all">All</button>${Object.entries(PROJECT_CATEGORIES).map(([k,v])=>`<button class="fbtn ${f===k?'active':''}" data-f="${k}">${v.label}</button>`).join('')}</div>
      <div class="grid">${list.map(card).join('')}</div></section>`;
    c.querySelectorAll('.fbtn').forEach(b=>b.addEventListener('click',()=>{f=b.dataset.f;draw()}));
  }draw();
}

function renderDetail(c,params){
  const p=ProjectRegistry.get(params.id);
  if(!p){c.innerHTML='<h1>Not found</h1><p><a href="#/projects">← Back</a></p>';return}
  const cat=PROJECT_CATEGORIES[p.category]||{label:'Other',color:'var(--text-3)'};
  if(p.render){
    c.innerHTML=`<a href="#/projects" class="back">← All projects</a>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px"><span class="card-badge" style="position:static;font-size:10px;padding:2px 8px;border-radius:4px;background:${cat.color}15;color:${cat.color}">${cat.label}</span></div>
      <h1 style="margin-bottom:3px">${p.title}</h1><p style="font-size:14px;max-width:620px;margin-bottom:16px">${p.desc}</p><div id="pm"></div>`;
    p.render(c.querySelector('#pm'));
    if(p.cleanup&&window._router)window._router.setCleanup(p.cleanup);
  }else{
    c.innerHTML=`<a href="#/projects" class="back">← Back</a><h1>${p.title}</h1><p style="font-size:14px">${p.desc}</p>
      <div class="sim-wrap" style="margin-top:16px"><div style="padding:40px 16px;text-align:center"><h3>Coming soon</h3><p>Engine and controllers are built. Visualization is next.</p><div style="margin-top:10px;display:flex;gap:4px;justify-content:center;flex-wrap:wrap">${p.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div></div></div>`;
  }
}

function renderAbout(c){
  c.innerHTML=`<section style="padding-top:28px;max-width:620px">
    <h1>About</h1>
    <p>I'm Joshua Nierop — a control-oriented mechanical engineer with a focus on model-based design, system dynamics, and advanced control algorithms.</p>
    <p>I graduated from Fontys with a BSc in Mechanical Engineering (Precision Engineering). My graduation project at DIFFER involved designing advanced control strategies for hydrogen isotope ratio regulation in a tokamak fuel subsystem aligned with the DEMO fusion reactor. Before that, I developed embedded motor-control software at LifeTec Group and built HVAC process automation tooling at Heesmans.</p>
    <h2 style="margin-top:28px">What drives me</h2>
    <p>Fast-paced precision-engineering environments where mechatronics, control, and system integration come together. I like understanding systems deeply enough to model and control them.</p>
    <h2 style="margin-top:28px">Toolkit</h2>
    <p><strong>Control:</strong> PID, LQR, feedforward/feedback, stability analysis, model-based design<br>
    <strong>Simulation:</strong> MATLAB/Simulink, physics-based modelling, linearization, system identification<br>
    <strong>Embedded:</strong> Assembly (motor control), LabVIEW, automation<br>
    <strong>Software:</strong> JavaScript, Python, Excel/VBA<br>
    <strong>Tools:</strong> Siemens NX, AutoCAD, VABI Elements<br>
    <strong>Languages:</strong> Dutch (native), English (fluent), Spanish, German</p>
    <h2 style="margin-top:28px">Beyond engineering</h2>
    <p>Rock climbing, strength training, Python projects (algorithmic problem-solving), building physical things (self-built longboard), drum and bass & rock.</p>
  </section>`;
}

function renderCV(c){
  c.innerHTML=`<section style="padding-top:28px;max-width:660px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h1 style="margin:0">Curriculum Vitae</h1></div>
    <h2>Education</h2>
    <div class="timeline"><div class="tl-entry"><div class="tl-date">Graduated 2025</div><h3>BSc Mechanical Engineering — Fontys</h3>
      <p>Specialisation: Precision Engineering. Minor: EmbraceTEC. Focus: system dynamics, control, mechatronics, precision mechanics.</p>
      <p style="font-size:12px;color:var(--text-3)">MATLAB, Simulink, LabVIEW, Siemens NX, Excel</p></div></div>
    <h2 style="margin-top:24px">Experience</h2>
    <div class="timeline">
      <div class="tl-entry"><div class="tl-date">Sep 2024 – Jul 2025 · Grade: 8/10</div><h3>Control Systems Engineer (Graduation) — DIFFER</h3>
        <p>Designed advanced control strategies for hydrogen isotope ratio regulation in a tokamak fuel subsystem (DEMO fusion reactor). Built physics-based dynamic model in MATLAB/Simulink. Implemented LQR full-state feedback with reference prefilter and feedforward + dual PID. Evaluated dynamics, stability, disturbance rejection, and actuation limits.</p></div>
      <div class="tl-entry"><div class="tl-date">Jul – Nov 2020 · Grade: 8/10</div><h3>Embedded Control Engineer (Internship) — LifeTec Group</h3>
        <p>Developed embedded motor-control software in Assembly for a dual-axis actuator. Designed LabVIEW UI for precise mechanical loading control in a bioreactor.</p></div>
      <div class="tl-entry"><div class="tl-date">Apr 2021 – Dec 2022</div><h3>HVAC Design / Process Automation — Heesmans</h3>
        <p>Modelled HVAC systems, thermal analyses. Built an Excel/VBA automation tool that reduced the full customer workflow from hours to ~30 minutes.</p></div>
    </div>
    <h2 style="margin-top:24px">Skills</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><h3 style="font-size:13px;margin-bottom:4px">Control & systems</h3><p style="font-size:12px">PID, LQR, feedforward/feedback, stability analysis, model-based design</p></div>
      <div><h3 style="font-size:13px;margin-bottom:4px">Modelling & simulation</h3><p style="font-size:12px">MATLAB/Simulink, first-principle modelling, linearization, system ID</p></div>
      <div><h3 style="font-size:13px;margin-bottom:4px">Embedded & automation</h3><p style="font-size:12px">Assembly (motor control), LabVIEW, measurement systems</p></div>
      <div><h3 style="font-size:13px;margin-bottom:4px">Engineering tools</h3><p style="font-size:12px">Siemens NX, AutoCAD, Excel/VBA, Python, JavaScript</p></div>
    </div>
    <h2>Languages</h2><div class="tags" style="gap:5px"><span class="tag">Dutch (native)</span><span class="tag">English (fluent)</span><span class="tag">Spanish</span><span class="tag">German (basic)</span></div>
  </section>`;
}

function renderContact(c){
  c.innerHTML=`<section style="padding-top:28px;max-width:420px"><h1>Get in touch</h1><p>Interested in working together or discussing control systems and engineering?</p>
    <div style="margin-top:20px;display:flex;flex-direction:column;gap:8px">
      <a href="https://www.linkedin.com/in/joshua-nierop-2b5747198/" target="_blank" rel="noopener" class="btn" style="justify-content:center;padding:11px">LinkedIn →</a>
      <a href="https://github.com/Spellforce1992" target="_blank" rel="noopener" class="btn" style="justify-content:center;padding:11px">GitHub →</a></div></section>`;
}

document.addEventListener('DOMContentLoaded',async()=>{
  initTheme();
  await ProjectRegistry.loadExternal();
  const r=new Router(document.getElementById('app'));window._router=r;
  r.on('/',renderHome).on('/projects',renderProjects).on('/projects/:id',renderDetail)
   .on('/about',renderAbout).on('/cv',renderCV).on('/contact',renderContact).start();
});
