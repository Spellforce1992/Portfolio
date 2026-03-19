(function(){
'use strict';
let raf=null,sys=null,ctrl=null,ch1=null,ch2=null,paused=false,trace=[],target='upright';
const PI=Math.PI;
const TARGETS={upright:[PI,0,PI,0],downward:[0,0,0,0]};
const INIT={upright:[PI-0.3,0,PI+0.2,0],downward:[1.8,0,2.0,0]};
const isDark=()=>document.documentElement.getAttribute('data-theme')==='dark';

function drawPend(cv,sys,tgt){
  const ctx=cv.getContext('2d'),W=cv.width,H=cv.height,sc=100;
  const ox=W/2,oy=tgt==='upright'?H*0.65:H*0.3;
  const dk=isDark();
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=dk?'#171717':'#f5f5f0'; ctx.fillRect(0,0,W,H);
  // grid
  ctx.strokeStyle=dk?'#262626':'#e7e5e4';ctx.lineWidth=.5;
  for(let i=-5;i<=5;i++){ctx.beginPath();ctx.moveTo(ox+i*sc,0);ctx.lineTo(ox+i*sc,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,oy+i*sc);ctx.lineTo(W,oy+i*sc);ctx.stroke()}
  // target ghost + end-effector target marker
  const tp=sys.getPos?.(TARGETS[tgt]);
  if(tp){
    ctx.globalAlpha=.15;ctx.strokeStyle=dk?'#818cf8':'#4338ca';ctx.lineWidth=3;ctx.setLineDash([6,4]);
    ctx.beginPath();ctx.moveTo(ox+tp[0].x*sc,oy-tp[0].y*sc);ctx.lineTo(ox+tp[1].x*sc,oy-tp[1].y*sc);ctx.stroke();
    ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(ox+tp[1].x*sc,oy-tp[1].y*sc);ctx.lineTo(ox+tp[2].x*sc,oy-tp[2].y*sc);ctx.stroke();
    ctx.setLineDash([]);ctx.globalAlpha=1;
    // End-effector target crosshair
    const tx=ox+tp[2].x*sc, ty=oy-tp[2].y*sc;
    ctx.strokeStyle=dk?'#818cf8':'#4338ca';ctx.lineWidth=1.5;ctx.globalAlpha=.4;
    ctx.beginPath();ctx.moveTo(tx-8,ty);ctx.lineTo(tx+8,ty);ctx.stroke();
    ctx.beginPath();ctx.moveTo(tx,ty-8);ctx.lineTo(tx,ty+8);ctx.stroke();
    ctx.beginPath();ctx.arc(tx,ty,5,0,2*PI);ctx.stroke();
    ctx.globalAlpha=1;
  }
  // trace
  if(trace.length>1){ctx.strokeStyle=dk?'rgba(129,140,248,.2)':'rgba(67,56,202,.15)';ctx.lineWidth=1.5;ctx.beginPath();trace.forEach((p,i)=>{const x=ox+p.x*sc,y=oy-p.y*sc;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
  const pos=sys.getPos(sys.state),pts=pos.map(p=>({x:ox+p.x*sc,y:oy-p.y*sc}));
  // mount
  ctx.fillStyle=dk?'#3f3f46':'#a8a29e';ctx.fillRect(pts[0].x-14,pts[0].y-2,28,4);
  // links
  ctx.strokeStyle=dk?'#d4d4d8':'#292524';ctx.lineWidth=4;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);ctx.lineTo(pts[1].x,pts[1].y);ctx.stroke();
  ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(pts[1].x,pts[1].y);ctx.lineTo(pts[2].x,pts[2].y);ctx.stroke();
  // joints
  ctx.fillStyle=dk?'#818cf8':'#4338ca';ctx.beginPath();ctx.arc(pts[0].x,pts[0].y,4,0,2*PI);ctx.fill();
  ctx.fillStyle=dk?'#a5b4fc':'#6366f1';ctx.beginPath();ctx.arc(pts[1].x,pts[1].y,6,0,2*PI);ctx.fill();
  ctx.fillStyle=dk?'#fbbf24':'#b45309';ctx.beginPath();ctx.arc(pts[2].x,pts[2].y,4,0,2*PI);ctx.fill();
  // info
  ctx.font='11px "Outfit",sans-serif';ctx.fillStyle=dk?'#78716c':'#a8a29e';ctx.textAlign='left';
  ctx.fillText(`t = ${sys.time.toFixed(1)}s`,6,14);
  const e=sys.getEnergy(sys.state);ctx.fillText(`E = ${e.E.toFixed(2)} J`,6,26);
  if(sys.tau[0]!==undefined)ctx.fillText(`τ = ${(sys.tau[0]||0).toFixed(1)} N·m`,6,38);
  // End-effector distance from target
  if(tp){const ee=pos[2],tee=tp[2];const dist=Math.sqrt((ee.x-tee.x)**2+(ee.y-tee.y)**2);
    ctx.fillText(`EE error = ${dist.toFixed(3)} m`,6,50)}
}

function mkChart(cv,l1,l2,c1,c2){
  return new Chart(cv,{type:'line',data:{labels:[],datasets:[
    {label:l1,data:[],borderColor:c1,borderWidth:1.5,pointRadius:0,tension:.3},
    {label:l2,data:[],borderColor:c2,borderWidth:1.5,pointRadius:0,tension:.3}
  ]},options:{animation:false,responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{font:{size:10,family:'Outfit'},boxWidth:10,padding:6}}},scales:{x:{display:false},y:{ticks:{font:{size:9}},grid:{color:'rgba(0,0,0,.05)'}}}}});
}
function pushCh(c,t,d0,d1,mx=250){c.data.labels=t.slice(-mx);c.data.datasets[0].data=d0.slice(-mx);c.data.datasets[1].data=d1.slice(-mx);c.update('none')}
function fmtM(M,p=3){return M.map(r=>'['+r.map(v=>v.toFixed(p).padStart(9)).join(' ')+']').join('\n')}
function fmtV(v,p=3){return'['+v.map(x=>x.toFixed(p)).join(', ')+']'}

function render(container){
  const tRef=()=>TARGETS[target];
  container.innerHTML=`
    <div class="tab-bar"><button class="tab-btn active" data-t="play">Playground</button><button class="tab-btn" data-t="design">Control design method</button></div>
    <div id="dp-play"></div><div id="dp-design" style="display:none"></div>`;
  container.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{
    container.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    container.querySelector('#dp-play').style.display=b.dataset.t==='play'?'':'none';
    container.querySelector('#dp-design').style.display=b.dataset.t==='design'?'':'none';
    if(b.dataset.t==='design')buildDesign();
  }));

  // ═══ PLAYGROUND ═══
  const $p=container.querySelector('#dp-play');
  $p.innerHTML=`<div class="two-col"><div>
    <div class="sim-wrap"><div class="sim-bar"><h3>Double pendulum</h3>
      <div style="display:flex;gap:10px;align-items:center">
        <div class="target-sel">Target: <select id="sel-target"><option value="upright" selected>Upright (unstable)</option><option value="downward">Downward (stable)</option></select></div>
        <div class="pill" id="ctrl-sel"><button class="active" data-m="none">Free</button><button data-m="pid">PID</button><button data-m="lqr">LQR</button></div>
      </div>
    </div>
    <canvas id="cv" class="sim-canvas" width="680" height="400"></canvas>
    <div class="sim-foot"><button class="btn btn-sm" id="b-reset">Reset</button><button class="btn btn-sm" id="b-pause">Pause</button><button class="btn btn-sm" id="b-trace">Clear trace</button></div></div>
    <div class="plots"><div class="plot-box"><canvas id="ch-ang"></canvas></div><div class="plot-box"><canvas id="ch-nrg"></canvas></div></div>
    <div class="panel" style="margin-top:10px"><h3 style="font-size:13px;margin-bottom:6px">Performance metrics</h3><div class="metrics" id="met">—</div></div>
  </div>
  <div class="sidebar" id="sb">
    <div class="panel" style="margin-bottom:10px"><h3 style="font-size:13px;margin-bottom:8px">Physics</h3>
      <div class="ctrl"><div class="ctrl-row"><span>m₁</span><span class="val" id="v-m1">1.0 kg</span></div><input type="range" id="s-m1" min=".2" max="3" step=".1" value="1"></div>
      <div class="ctrl"><div class="ctrl-row"><span>m₂</span><span class="val" id="v-m2">1.0 kg</span></div><input type="range" id="s-m2" min=".2" max="3" step=".1" value="1"></div>
      <div class="ctrl"><div class="ctrl-row"><span>L₁</span><span class="val" id="v-L1">1.0 m</span></div><input type="range" id="s-L1" min=".3" max="2" step=".1" value="1"></div>
      <div class="ctrl"><div class="ctrl-row"><span>L₂</span><span class="val" id="v-L2">0.8 m</span></div><input type="range" id="s-L2" min=".3" max="2" step=".1" value=".8"></div>
      <div class="ctrl"><div class="ctrl-row"><span>Damping</span><span class="val" id="v-b">0.10</span></div><input type="range" id="s-b" min="0" max="1" step=".01" value=".1"></div>
    </div>
    <div class="panel" id="pan-pid" style="display:none;margin-bottom:10px"><h3 style="font-size:13px;margin-bottom:8px">PID gains (θ₁ → target)</h3>
      <div class="ctrl"><div class="ctrl-row"><span>Kp</span><span class="val" id="v-kp">20</span></div><input type="range" id="s-kp" min="0" max="80" step=".5" value="20"></div>
      <div class="ctrl"><div class="ctrl-row"><span>Ki</span><span class="val" id="v-ki">0.5</span></div><input type="range" id="s-ki" min="0" max="5" step=".1" value=".5"></div>
      <div class="ctrl"><div class="ctrl-row"><span>Kd</span><span class="val" id="v-kd">6</span></div><input type="range" id="s-kd" min="0" max="25" step=".5" value="6"></div>
    </div>
    <div class="panel" id="pan-lqr" style="display:none;margin-bottom:10px"><h3 style="font-size:13px;margin-bottom:8px">LQR weights</h3>
      <div class="ctrl"><div class="ctrl-row"><span>Q₁₁ (θ₁)</span><span class="val" id="v-q1">20</span></div><input type="range" id="s-q1" min="1" max="200" step="1" value="20"></div>
      <div class="ctrl"><div class="ctrl-row"><span>Q₃₃ (θ₂)</span><span class="val" id="v-q3">20</span></div><input type="range" id="s-q3" min="1" max="200" step="1" value="20"></div>
      <div class="ctrl"><div class="ctrl-row"><span>R</span><span class="val" id="v-r">1</span></div><input type="range" id="s-r" min=".1" max="20" step=".1" value="1"></div>
      <div id="lqr-k" style="margin-top:6px;font-family:var(--mono);font-size:10px;color:var(--text-3);word-break:break-all"></div>
    </div>
  </div></div>`;

  // ═══ DESIGN TAB (populated on switch) ═══
  container.querySelector('#dp-design').innerHTML=`<div class="two-col"><div>
    <div class="sim-wrap"><div class="sim-bar"><h3>Closed-loop response</h3><span id="d-stat" style="font-size:11px;color:var(--text-3)">Complete the steps →</span></div>
    <canvas id="d-cv" class="sim-canvas" width="680" height="360"></canvas>
    <div class="sim-foot"><button class="btn btn-sm btn-p" id="b-dsim">Run simulation</button><button class="btn btn-sm" id="b-drst">Reset</button></div></div>
    <div class="plots"><div class="plot-box"><canvas id="dc-ang"></canvas></div><div class="plot-box"><canvas id="dc-tau"></canvas></div></div>
    <div class="panel" style="margin-top:10px"><h3 style="font-size:13px;margin-bottom:6px">Performance metrics</h3><div class="metrics" id="d-met">—</div></div>
  </div><div class="sidebar" id="d-sb"></div></div>`;

  // Init system
  sys=new DoublePendulum({m1:1,m2:1,L1:1,L2:.8,b1:.1,b2:.1,s0:INIT[target].slice()});
  let ctrlMode='none';

  const $=id=>container.querySelector('#'+id);
  function rebuild(){
    const m1=+$('s-m1').value,m2=+$('s-m2').value,L1=+$('s-L1').value,L2=+$('s-L2').value,b=+$('s-b').value;
    sys=new DoublePendulum({m1,m2,L1,L2,b1:b,b2:b,s0:INIT[target].slice()});
    trace=[];ctrl=null;
    if(ctrlMode==='pid')makePID();
    if(ctrlMode==='lqr')makeLQR();
  }
  function makePID(){ctrl=new PIDController({kp:+$('s-kp').value,ki:+$('s-ki').value,kd:+$('s-kd').value,min:-50,max:50});ctrl.reset()}
  function makeLQR(){
    try{const q1=+$('s-q1').value,q3=+$('s-q3').value,r=+$('s-r').value;
    ctrl=new LQRController(sys,[[q1,0,0,0],[0,1,0,0],[0,0,q3,0],[0,0,0,1]],[[r]]);ctrl.min=-50;ctrl.max=50;ctrl.design(TARGETS[target]);
    $('lqr-k').textContent='K = '+fmtV(ctrl.K[0],2)}catch(e){$('lqr-k').textContent='Design failed';ctrl=null}}

  const hook=(s,v,u,cb)=>{const el=$(s);if(!el)return;el.addEventListener('input',()=>{$(v).textContent=el.value+(u||'');cb?.()})};
  hook('s-m1','v-m1',' kg',rebuild);hook('s-m2','v-m2',' kg',rebuild);hook('s-L1','v-L1',' m',rebuild);hook('s-L2','v-L2',' m',rebuild);hook('s-b','v-b','',rebuild);
  hook('s-kp','v-kp','',()=>{if(ctrl&&ctrl.kp!==undefined)ctrl.kp=+$('s-kp').value});
  hook('s-ki','v-ki','',()=>{if(ctrl&&ctrl.ki!==undefined)ctrl.ki=+$('s-ki').value});
  hook('s-kd','v-kd','',()=>{if(ctrl&&ctrl.kd!==undefined)ctrl.kd=+$('s-kd').value});
  hook('s-q1','v-q1','',makeLQR);hook('s-q3','v-q3','',makeLQR);hook('s-r','v-r','',makeLQR);

  $('sel-target').addEventListener('change',e=>{target=e.target.value;rebuild()});
  container.querySelectorAll('#ctrl-sel button').forEach(b=>b.addEventListener('click',()=>{
    container.querySelectorAll('#ctrl-sel button').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    ctrlMode=b.dataset.m;$('pan-pid').style.display=ctrlMode==='pid'?'':'none';$('pan-lqr').style.display=ctrlMode==='lqr'?'':'none';
    ctrl=null;if(ctrlMode==='pid')makePID();if(ctrlMode==='lqr')makeLQR();
  }));
  $('b-reset').addEventListener('click',rebuild);
  $('b-pause').addEventListener('click',()=>{paused=!paused;$('b-pause').textContent=paused?'Resume':'Pause'});
  $('b-trace').addEventListener('click',()=>{trace=[]});

  ch1=mkChart($('ch-ang'),'θ₁','θ₂','#6366f1','#b45309');
  ch2=mkChart($('ch-nrg'),'Kinetic','Potential','#4338ca','#eab308');

  // ─── DESIGN TAB ───
  let dSys=null,dCtrl=null,dRun=false,dc1=null,dc2=null;

  function buildDesign(){
    const sb=$('d-sb'),p=sys,eq=TARGETS[target],{A,B}=p.linearize(eq);
    // controllability
    const n=4;let Cv=[B.map(r=>r[0])];let Ak=B.map(r=>[r[0]]);
    for(let i=1;i<n;i++){Ak=numeric.dot(A,Ak);Cv.push(Ak.map(r=>r[0]))}
    let cRank=n;try{cRank=numeric.svd(numeric.transpose(Cv)).S.filter(s=>s>1e-10).length}catch(e){}
    const tgtLabel=target==='upright'?'upright (θ₁=π, θ₂=π)':'downward (θ₁=0, θ₂=0)';
    const eigs=numeric.eig(A).lambda.x;

    sb.innerHTML=`
      <div class="step"><div class="step-num">Step 1 — System</div><h4>Physical model</h4>
        <p>Double pendulum with uniform rods (distributed mass). Equations from Lagrangian mechanics. State: <strong>x</strong> = [θ₁, ω₁, θ₂, ω₂].</p>
        <p style="font-size:12px;color:var(--text-3)">m₁=${p.m1}, m₂=${p.m2}, L₁=${p.L1}, L₂=${p.L2}, b=${p.b1}</p></div>
      <div class="step"><div class="step-num">Step 2 — Linearization</div><h4>State-space form around ${tgtLabel}</h4>
        <p>ẋ = Ax + Bu</p>
        <div class="math-block">A =\n${fmtM(A)}</div><div class="math-block">B =\n${fmtM(B,4)}</div>
        <p style="font-size:12px">Open-loop eigenvalues: ${eigs.map(v=>v.toFixed(2)).join(', ')}</p>
        <p style="font-size:12px">${eigs.some(v=>v>0)?'<strong style="color:var(--red)">Unstable</strong> — positive eigenvalues → controller required.':'<strong style="color:var(--green)">Stable</strong> open-loop.'}</p></div>
      <div class="step"><div class="step-num">Step 3 — Controllability</div><h4>rank([B, AB, A²B, A³B])</h4>
        <div class="math-block">rank(C) = ${cRank} ${cRank>=n?'✓ Fully controllable':'✗ Not controllable'}</div></div>
      <div class="step"><div class="step-num">Step 4 — Weight selection</div><h4>Choose Q and R</h4>
        <p>Q penalises state deviation, R penalises control effort. Larger Q → faster but more aggressive.</p>
        <div class="ctrl"><div class="ctrl-row"><span>Q₁₁</span><span class="val" id="dv-q1">20</span></div><input type="range" id="ds-q1" min="1" max="200" step="1" value="20"></div>
        <div class="ctrl"><div class="ctrl-row"><span>Q₃₃</span><span class="val" id="dv-q3">20</span></div><input type="range" id="ds-q3" min="1" max="200" step="1" value="20"></div>
        <div class="ctrl"><div class="ctrl-row"><span>R</span><span class="val" id="dv-r">1</span></div><input type="range" id="ds-r" min=".1" max="20" step=".1" value="1"></div></div>
      <div class="step"><div class="step-num">Step 5 — Solve Riccati</div><h4>Compute optimal gain K</h4>
        <p>A'P + PA − PBR⁻¹B'P + Q = 0</p><p>K = R⁻¹B'P</p>
        <div class="math-block" id="d-res">Press "Compute K"</div>
        <button class="btn btn-sm btn-p" id="b-solve" style="margin-top:6px">Compute K</button></div>
      <div class="step"><div class="step-num">Step 6 — Simulate</div><h4>Nonlinear closed-loop</h4>
        <p>Apply u = −K(x − x_ref) to the full nonlinear system. Initial perturbation from target.</p></div>`;
    ['ds-q1','ds-q3','ds-r'].forEach(id=>{const s=$(id);s?.addEventListener('input',()=>{$(id.replace('ds-','dv-')).textContent=s.value})});
    $('b-solve').addEventListener('click',()=>{
      try{const q1=+$('ds-q1').value,q3=+$('ds-q3').value,r=+$('ds-r').value;
        const Q=[[q1,0,0,0],[0,2,0,0],[0,0,q3,0],[0,0,0,2]],R=[[r]];
        const{K}=LQR.gain(A,B,Q,R);
        const clEig=numeric.eig(numeric.sub(A,numeric.dot(B.map(r=>[r[0]]),[[K[0][0],K[0][1],K[0][2],K[0][3]]]))).lambda.x;
        $('d-res').innerHTML='K = '+fmtV(K[0],2)+'\n\nClosed-loop eigenvalues:\n'+clEig.map(v=>v.toFixed(3)).join(', ')+'\n'+(clEig.every(v=>v<0)?'✓ All stable':'⚠ Unstable poles remain');
        dCtrl=new LQRController(sys,Q,R);dCtrl.K=K;dCtrl.ref=TARGETS[target];dCtrl.ok=true;dCtrl.min=-50;dCtrl.max=50;
        $('d-stat').textContent='Controller designed — ready to simulate';
      }catch(e){$('d-res').textContent='Solver failed: '+e.message}});
    if(dc1)dc1.destroy();if(dc2)dc2.destroy();
    dc1=mkChart($('dc-ang'),'θ₁','θ₂','#6366f1','#b45309');
    dc2=mkChart($('dc-tau'),'Torque τ','Limit','#4338ca','#e7e5e4');
  }
  $('b-dsim').addEventListener('click',()=>{
    if(!dCtrl?.ok){alert('Complete step 5 first');return}
    const eq=TARGETS[target];const s0=eq.map((v,i)=>i%2===0?v+(Math.random()-.5)*.6:0);
    dSys=new DoublePendulum({m1:sys.m1,m2:sys.m2,L1:sys.L1,L2:sys.L2,b1:sys.b1,b2:sys.b2,s0});
    dRun=true;$('d-stat').textContent='Running...';$('d-met').innerHTML='—';
  });
  $('b-drst').addEventListener('click',()=>{dRun=false;dSys=null;$('d-stat').textContent='Reset';
    if(dc1){dc1.data.labels=[];dc1.data.datasets.forEach(d=>d.data=[]);dc1.update('none')}
    if(dc2){dc2.data.labels=[];dc2.data.datasets.forEach(d=>d.data=[]);dc2.update('none')}$('d-met').innerHTML='—';});

  // ─── LOOP ───
  const cv=$('cv'),dcv=$('d-cv');
  let metTimer=0;

  function loop(){
    // playground
    if(container.querySelector('#dp-play').style.display!=='none'&&!paused){
      let u=[0];const ref=TARGETS[target];
      if(ctrlMode==='pid'&&ctrl)u=[ctrl.compute(ref[0],sys.state[0],sys.dt)];
      else if(ctrlMode==='lqr'&&ctrl?.ok)u=ctrl.compute(sys.state);
      sys.step(u);
      const pos=sys.getPos(sys.state);trace.push(pos[2]);if(trace.length>400)trace.shift();
      drawPend(cv,sys,target);
      if(sys.hist.t.length>0){const t=sys.hist.t,s=sys.hist.s;
        pushCh(ch1,t.map(v=>v.toFixed(1)),s.map(x=>x[0]),s.map(x=>x[2]));
        pushCh(ch2,t.map(v=>v.toFixed(1)),sys.hist.e.map(x=>x.T),sys.hist.e.map(x=>x.V))}
      // metrics every 30 frames — track end-effector position, not just θ₁
      metTimer++;if(metTimer%30===0&&sys.hist.s.length>60&&ctrlMode!=='none'){
        const ref=TARGETS[target], tgtPos=sys.getPos(ref)[2]; // target end-effector position
        const eeErr=sys.hist.s.map(s=>{const p=sys.getPos(s)[2];return Math.sqrt((p.x-tgtPos.x)**2+(p.y-tgtPos.y)**2)});
        const mEE=Metrics.compute(sys.hist.t,eeErr,0,.05);
        const m1=Metrics.compute(sys.hist.t,sys.hist.s.map(x=>x[0]),ref[0]);
        const m2=Metrics.compute(sys.hist.t,sys.hist.s.map(x=>x[2]),ref[2]);
        const rmsU=Metrics.rms(sys.hist.u.map(x=>x[0]||0));
        $('met').innerHTML=`
          <div class="metric"><div class="metric-label">EE settling</div><div class="metric-val ${mEE.ts!==null&&mEE.ts<5?'good':mEE.ts!==null&&mEE.ts<10?'warn':'bad'}">${mEE.ts!==null?mEE.ts.toFixed(2)+' s':'—'}</div></div>
          <div class="metric"><div class="metric-label">EE steady-state err</div><div class="metric-val ${mEE.sse!==null&&mEE.sse<.05?'good':'warn'}">${mEE.sse!==null?mEE.sse.toFixed(3)+' m':'—'}</div></div>
          <div class="metric"><div class="metric-label">θ₁ settling</div><div class="metric-val">${m1.ts!==null?m1.ts.toFixed(2)+' s':'—'}</div></div>
          <div class="metric"><div class="metric-label">θ₂ settling</div><div class="metric-val">${m2.ts!==null?m2.ts.toFixed(2)+' s':'—'}</div></div>
          <div class="metric"><div class="metric-label">Overshoot</div><div class="metric-val ${mEE.os<15?'good':mEE.os<35?'warn':'bad'}">${mEE.os.toFixed(1)} %</div></div>
          <div class="metric"><div class="metric-label">RMS torque</div><div class="metric-val">${rmsU.toFixed(2)} N·m</div></div>`;
      }else if(ctrlMode==='none')$('met').innerHTML='<div style="grid-column:span 2;font-size:12px;color:var(--text-3)">Select a controller to see metrics</div>';
    }
    // design
    if(container.querySelector('#dp-design').style.display!=='none'){
      if(dRun&&dSys&&dCtrl){
        dSys.step(dCtrl.compute(dSys.state));
        drawPend(dcv,dSys,target);
        if(dSys.hist.t.length>0&&dc1){const t=dSys.hist.t,s=dSys.hist.s,tu=dSys.hist.u;
          pushCh(dc1,t.map(v=>v.toFixed(1)),s.map(x=>x[0]),s.map(x=>x[2]));
          pushCh(dc2,t.map(v=>v.toFixed(1)),tu.map(x=>x[0]||0),tu.map(()=>50))}
        if(dSys.time>12){dRun=false;$('d-stat').textContent='Done (12 s)';
          const ref=TARGETS[target], tgtPos=dSys.getPos(ref)[2];
          const eeErr=dSys.hist.s.map(s=>{const p=dSys.getPos(s)[2];return Math.sqrt((p.x-tgtPos.x)**2+(p.y-tgtPos.y)**2)});
          const mEE=Metrics.compute(dSys.hist.t,eeErr,0,.05);
          const m1=Metrics.compute(dSys.hist.t,dSys.hist.s.map(x=>x[0]),ref[0]);
          const m2=Metrics.compute(dSys.hist.t,dSys.hist.s.map(x=>x[2]),ref[2]);
          const rmsU=Metrics.rms(dSys.hist.u.map(x=>x[0]||0));
          $('d-met').innerHTML=`
            <div class="metric"><div class="metric-label">EE settling</div><div class="metric-val ${mEE.ts!==null&&mEE.ts<5?'good':mEE.ts!==null&&mEE.ts<10?'warn':'bad'}">${mEE.ts!==null?mEE.ts.toFixed(2)+' s':'—'}</div></div>
            <div class="metric"><div class="metric-label">EE steady-state err</div><div class="metric-val ${mEE.sse!==null&&mEE.sse<.05?'good':'warn'}">${mEE.sse!==null?mEE.sse.toFixed(3)+' m':'—'}</div></div>
            <div class="metric"><div class="metric-label">θ₁ settling</div><div class="metric-val">${m1.ts!==null?m1.ts.toFixed(2)+' s':'—'}</div></div>
            <div class="metric"><div class="metric-label">θ₂ settling</div><div class="metric-val">${m2.ts!==null?m2.ts.toFixed(2)+' s':'—'}</div></div>
            <div class="metric"><div class="metric-label">Overshoot</div><div class="metric-val">${mEE.os.toFixed(1)} %</div></div>
            <div class="metric"><div class="metric-label">RMS torque</div><div class="metric-val">${rmsU.toFixed(2)} N·m</div></div>`}
      }else if(!dRun&&!dSys){
        const tmp=new DoublePendulum({m1:sys.m1,m2:sys.m2,L1:sys.L1,L2:sys.L2,s0:TARGETS[target].map((v,i)=>i%2===0?v+.25:0)});
        drawPend(dcv,tmp,target);
      }
    }
    raf=requestAnimationFrame(loop);
  }
  loop();
}

function cleanup(){if(raf){cancelAnimationFrame(raf);raf=null}if(ch1){ch1.destroy();ch1=null}if(ch2){ch2.destroy();ch2=null}sys=null;ctrl=null;trace=[];paused=false;target='upright'}
ProjectRegistry.register('double-pendulum',render,cleanup);
})();
