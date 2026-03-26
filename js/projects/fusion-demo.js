(function(){
'use strict';
let raf=null,ch1=null,ch2=null,paused=false,ro=null;
const isDark=()=>document.documentElement.getAttribute('data-theme')==='dark';

// ═══ REDUCED STATE-SPACE MODEL (balanced truncation, 3 states) ═══
// From thesis: linearised around operating point, order reduced 9→3
const Ar=[[-0.1736,5.698e-9,-3.966e-9],[3.7436e-4,-0.0396,0.0276],[-2.606e-4,0.0276,-0.0192]];
const Br=[[-6.2872,-84.660,-146.97],[0.0222,0.2745,0.0523],[-0.0155,-0.1911,-0.0364]];
const Cr=[[-169.7224,-7.4748e-4,-0.0011],[0.0013,0.2803,-0.1951]];

// Operating point
const P_OP=70928, TF_OP=0.5;
// Prefilter for FSF (from thesis Section 5.3)
const Nbar=[[-5.2259e-8,0.0683],[5.4317e-7,0.7865],[2.2284e-5,-0.9235]];
// PI controllers for FF+PI (from thesis Section 4.4, RGA pairing: n3→P, a5→TF)
const PI_P_DEF={kp:2.02e-4,ki:1.06e-4};
const PI_TF_DEF={kp:-0.577,ki:-0.0434};

// Simulation state
let state,time,hist,ctrlMode,spP,spTF;
let piIntP,piIntTF,K_lqr,dist,distTime;

function mvMul(M,v){return M.map(r=>r.reduce((s,c,j)=>s+c*v[j],0))}
function deriv(t,x,u){const Ax=mvMul(Ar,x),Bu=mvMul(Br,u);return Ax.map((a,i)=>a+Bu[i])}
function rk4Step(x,u,dt){
  const k1=deriv(0,x,u);
  const k2=deriv(0,x.map((v,i)=>v+dt/2*k1[i]),u);
  const k3=deriv(0,x.map((v,i)=>v+dt/2*k2[i]),u);
  const k4=deriv(0,x.map((v,i)=>v+dt*k3[i]),u);
  return x.map((v,i)=>v+(dt/6)*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
}

function computeLQR(qpScale,qtfScale,r1,r2,r3){
  // Q = Cr' * S * Cr where S = diag(qpScale/P_OP^2, qtfScale/TF_OP^2)
  const s0=qpScale/(P_OP*P_OP), s1=qtfScale/(TF_OP*TF_OP);
  const Q=[[0,0,0],[0,0,0],[0,0,0]];
  for(let i=0;i<3;i++)for(let j=0;j<3;j++) Q[i][j]=Cr[0][i]*s0*Cr[0][j]+Cr[1][i]*s1*Cr[1][j];
  const R=[[r1,0,0],[0,r2,0],[0,0,r3]];
  try{
    const res=LQR.gain(Ar,Br,Q,R);
    return res.K;
  }catch(e){console.warn('LQR failed:',e);return null}
}

// Steady-state feedforward gain: G_ss = -Cr * inv(Ar) * Br, u_ff = pinv(G_ss) * r
let G_ff=null;
function computeFFGain(){
  try{
    const Ainv=numeric.inv(Ar);
    const AinvB=numeric.dot(Ainv,Br);
    const G=numeric.dot(Cr,AinvB).map(r=>r.map(v=>-v));
    // Pseudoinverse of 2x3: pinv(G) = G'*(G*G')^-1
    const Gt=numeric.transpose(G);
    const GGt=numeric.dot(G,Gt);
    const GGtInv=numeric.inv(GGt);
    G_ff=numeric.dot(Gt,GGtInv);
    return true;
  }catch(e){console.warn('FF gain failed:',e);G_ff=null;return false}
}

function resetSim(){
  state=[0,0,0]; time=0;
  hist={t:[],y0:[],y1:[],u0:[],u1:[],u2:[],max:600};
  piIntP=0; piIntTF=0;
  dist=null; distTime=0;
}

// ═══ CANVAS: Process Flow Diagram ═══
function drawPFD(cv,yOut,uIn,spPv,spTFv){
  const ctx=cv.getContext('2d'),W=cv.width,H=cv.height,dk=isDark();
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=dk?'#171717':'#f5f5f0';ctx.fillRect(0,0,W,H);

  // Colors
  const cBg=dk?'#1e1e2e':'#e7e5e4';
  const cBorder=dk?'#3f3f46':'#a8a29e';
  const cText=dk?'#e2e8f0':'#1c1917';
  const cDim=dk?'#71717a':'#78716c';
  const cAccent=dk?'#818cf8':'#4338ca';
  const cGreen=dk?'#22c55e':'#16a34a';
  const cOrange=dk?'#f59e0b':'#d97706';
  const cPipe=dk?'#52525b':'#a8a29e';
  const cFlow=dk?'rgba(129,140,248,.6)':'rgba(67,56,202,.4)';

  const P_act=P_OP+yOut[0], TF_act=TF_OP+yOut[1];

  // ── Vessel drawing helper ──
  function drawVessel(x,y,w,h,label,vals,accent){
    ctx.fillStyle=cBg;ctx.strokeStyle=cBorder;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.roundRect(x,y,w,h,6);ctx.fill();ctx.stroke();
    ctx.fillStyle=accent||cAccent;ctx.font='bold 11px "Outfit",sans-serif';
    ctx.textAlign='center';ctx.fillText(label,x+w/2,y+16);
    ctx.font='10px "JetBrains Mono","Outfit",monospace';ctx.textAlign='left';
    vals.forEach((v,i)=>{
      ctx.fillStyle=cDim;ctx.fillText(v.label,x+8,y+32+i*14);
      ctx.fillStyle=v.color||cText;ctx.textAlign='right';
      ctx.fillText(v.value,x+w-8,y+32+i*14);ctx.textAlign='left';
    });
  }

  // ── Pipe helper ──
  function drawPipe(x1,y1,x2,y2,viaX,viaY,flowMag){
    ctx.strokeStyle=cPipe;ctx.lineWidth=2.5;ctx.lineCap='round';
    ctx.beginPath();
    if(viaX!==undefined){
      ctx.moveTo(x1,y1);ctx.lineTo(viaX,viaY);ctx.lineTo(x2,y2);
    }else{ctx.moveTo(x1,y1);ctx.lineTo(x2,y2)}
    ctx.stroke();
    // Flow indicator
    if(Math.abs(flowMag)>1e-6){
      const aSize=5;
      const mx=viaX!==undefined?(viaX+x2)/2:(x1+x2)/2;
      const my=viaY!==undefined?(viaY+y2)/2:(y1+y2)/2;
      const dx=x2-(viaX||x1),dy=y2-(viaY||y1);
      const len=Math.sqrt(dx*dx+dy*dy)||1;
      const nx=dx/len,ny=dy/len;
      ctx.fillStyle=cFlow;ctx.beginPath();
      ctx.moveTo(mx+nx*aSize,my+ny*aSize);
      ctx.lineTo(mx-nx*aSize+ny*aSize*0.6,my-ny*aSize-nx*aSize*0.6);
      ctx.lineTo(mx-nx*aSize-ny*aSize*0.6,my-ny*aSize+nx*aSize*0.6);
      ctx.closePath();ctx.fill();
    }
  }

  // ── Valve symbol ──
  function drawValve(x,y,label,open){
    const s=7;
    ctx.strokeStyle=open>0.5?cGreen:cOrange;ctx.lineWidth=1.5;ctx.fillStyle='none';
    ctx.beginPath();ctx.moveTo(x-s,y-s);ctx.lineTo(x+s,y+s);ctx.moveTo(x+s,y-s);ctx.lineTo(x-s,y+s);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-s,y-s);ctx.lineTo(x,y);ctx.lineTo(x+s,y-s);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-s,y+s);ctx.lineTo(x,y);ctx.lineTo(x+s,y+s);ctx.stroke();
    ctx.font='9px "Outfit",sans-serif';ctx.fillStyle=cDim;ctx.textAlign='center';
    ctx.fillText(label,x,y-12);
  }

  // ── Layout ──
  // DTB: top-left
  drawVessel(30,30,155,65,'DT Buffer (DTB)',[
    {label:'P',value:(82715).toFixed(0)+' Pa',color:cDim},
    {label:'TF',value:'0.51',color:cDim}
  ]);
  // DTF: bottom-left
  drawVessel(30,155,155,65,'DT Feed (DTF)',[
    {label:'P',value:(86238).toFixed(0)+' Pa',color:cDim},
    {label:'TF',value:'0.55',color:cDim}
  ]);
  // D2 storage: far left bottom
  drawVessel(30,275,100,45,'D\u2082 Storage',[
    {label:'Pure D\u2082',value:'',color:cDim}
  ],cGreen);

  // FV1: center-right
  const fvX=340,fvY=55,fvW=200,fvH=145;
  // FV1 fill level based on pressure
  const fillFrac=Math.max(0,Math.min(1,P_act/P_OP));
  ctx.fillStyle=cBg;ctx.strokeStyle=dist?cOrange:cAccent;ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(fvX,fvY,fvW,fvH,8);ctx.fill();ctx.stroke();
  // Fill level
  const fillH=Math.max(0,(fvH-20)*fillFrac);
  ctx.fillStyle=dk?'rgba(129,140,248,.12)':'rgba(67,56,202,.08)';
  ctx.beginPath();ctx.roundRect(fvX+2,fvY+fvH-fillH-2,fvW-4,fillH,4);ctx.fill();
  // FV1 labels
  ctx.fillStyle=cAccent;ctx.font='bold 13px "Outfit",sans-serif';ctx.textAlign='center';
  ctx.fillText('Fuel Vessel 1 (FV1)',fvX+fvW/2,fvY+20);
  // Pressure
  ctx.font='12px "JetBrains Mono",monospace';ctx.textAlign='left';
  const pErr=Math.abs(P_act-spPv);
  ctx.fillStyle=pErr<500?cGreen:pErr<2000?cOrange:'#ef4444';
  ctx.fillText('P = '+(P_act/1000).toFixed(2)+' kPa',fvX+14,fvY+42);
  ctx.fillStyle=cDim;ctx.font='10px "JetBrains Mono",monospace';
  ctx.fillText('SP: '+(spPv/1000).toFixed(2)+' kPa',fvX+14,fvY+56);
  // TF
  const tfErr=Math.abs(TF_act-spTFv);
  ctx.fillStyle=tfErr<0.01?cGreen:tfErr<0.03?cOrange:'#ef4444';
  ctx.font='12px "JetBrains Mono",monospace';
  ctx.fillText('TF = '+TF_act.toFixed(4),fvX+14,fvY+78);
  ctx.fillStyle=cDim;ctx.font='10px "JetBrains Mono",monospace';
  ctx.fillText('SP: '+spTFv.toFixed(4),fvX+14,fvY+92);
  // Controller mode
  ctx.fillStyle=cDim;ctx.font='10px "Outfit",sans-serif';ctx.textAlign='right';
  ctx.fillText('t = '+time.toFixed(1)+' s',fvX+fvW-10,fvY+fvH-8);

  // ── Outflow (n11) ──
  drawPipe(fvX+fvW,fvY+fvH/2,fvX+fvW+50,fvY+fvH/2,undefined,undefined,1);
  ctx.fillStyle=cDim;ctx.font='9px "Outfit",sans-serif';ctx.textAlign='left';
  ctx.fillText('n\u0307\u2081\u2081 out',fvX+fvW+12,fvY+fvH/2-6);

  // ── Pipes: DTB → FV1 via valve 6 ──
  const v6x=265,v6y=62;
  drawPipe(185,62,fvX,fvY+30,v6x,fvY+30,uIn[1]);
  drawValve(v6x,fvY+30,'V6',0.5+uIn[1]);

  // ── Pipes: DTF → FV1 via valve 5 ──
  const v5x=265,v5y=187;
  drawPipe(185,187,fvX,fvY+fvH-30,v5x,fvY+fvH-30,uIn[0]);
  drawValve(v5x,fvY+fvH-30,'V5',0.5+uIn[0]);

  // ── Pipes: D2 → FV1 (n3) ──
  drawPipe(130,297,fvX,fvY+fvH-10,280,297,uIn[2]);
  ctx.fillStyle=cDim;ctx.font='9px "Outfit",sans-serif';ctx.textAlign='center';
  ctx.fillText('n\u0307\u2083 (D\u2082)',240,292);

  // ── Disturbance indicator ──
  if(dist){
    ctx.fillStyle='#ef4444';ctx.font='bold 10px "Outfit",sans-serif';ctx.textAlign='center';
    ctx.fillText('\u26A0 '+dist.label,107,25);
  }

  // ── Actuation display ──
  ctx.fillStyle=cDim;ctx.font='9px "JetBrains Mono",monospace';ctx.textAlign='left';
  ctx.fillText('\u0394a\u2085='+uIn[0].toFixed(4),fvX+10,fvY+fvH-28);
  ctx.fillText('\u0394a\u2086='+uIn[1].toFixed(4),fvX+10,fvY+fvH-16);
  ctx.fillText('\u0394n\u0307\u2083='+uIn[2].toFixed(5),fvX+100,fvY+fvH-16);
}

// ═══ CHARTS ═══
function mkChart(cv,label,unit,color,refLabel){
  return new Chart(cv,{type:'line',data:{labels:[],datasets:[
    {label:label,data:[],borderColor:color,borderWidth:1.5,pointRadius:0,tension:.3},
    {label:refLabel||'Setpoint',data:[],borderColor:isDark()?'#52525b':'#a8a29e',borderWidth:1,pointRadius:0,borderDash:[4,3],tension:0}
  ]},options:{animation:false,responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{size:10,family:'Outfit'},boxWidth:10,padding:6}}},scales:{x:{display:false},y:{title:{display:true,text:unit,font:{size:9}},ticks:{font:{size:9}},grid:{color:'rgba(0,0,0,.05)'}}}}});
}

function render(container){
  container.innerHTML=`
    <div class="tab-bar"><button class="tab-btn active" data-t="play">Playground</button><button class="tab-btn" data-t="design">System overview</button></div>
    <div id="fu-play"></div><div id="fu-design" style="display:none"></div>`;
  container.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{
    container.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    container.querySelector('#fu-play').style.display=b.dataset.t==='play'?'':'none';
    container.querySelector('#fu-design').style.display=b.dataset.t==='design'?'':'none';
  }));

  // ═══ PLAYGROUND ═══
  const $p=container.querySelector('#fu-play');
  $p.innerHTML=`<div class="two-col"><div>
    <div class="sim-wrap"><div class="sim-bar"><h3>Fuel Vessel 1 Control</h3>
      <div class="pill" id="fu-ctrl"><button class="active" data-m="none">Free</button><button data-m="ffpi">FF+PI</button><button data-m="lqr">LQR</button></div>
    </div>
    <canvas id="fu-cv" class="sim-canvas" width="600" height="320"></canvas>
    <div class="sim-foot">
      <button class="btn btn-sm" id="fu-reset">Reset</button>
      <button class="btn btn-sm" id="fu-pause">Pause</button>
      <button class="btn btn-sm" id="fu-step">Disturbance: P_DTB +10%</button>
      <button class="btn btn-sm" id="fu-step2">Disturbance: DT_DTF shift</button>
    </div></div>
    <div class="plots"><div class="plot-box"><canvas id="fu-ch-p"></canvas></div><div class="plot-box"><canvas id="fu-ch-tf"></canvas></div></div>
    <div class="panel" style="margin-top:10px"><h3 style="font-size:13px;margin-bottom:6px">Performance metrics</h3><div class="metrics" id="fu-met">\u2014</div></div>
  </div><div class="sidebar" id="fu-sb">
    <div class="panel" style="margin-bottom:10px"><h3 style="font-size:13px;margin-bottom:8px">Setpoints</h3>
      <div class="ctrl"><div class="ctrl-row"><span>Pressure P<sub>FV1</sub></span><span class="val" id="fu-v-p">70.9 kPa</span></div><input type="range" id="fu-s-p" min="-15" max="15" step="0.5" value="0"></div>
      <div class="ctrl"><div class="ctrl-row"><span>Tritium fraction TF</span><span class="val" id="fu-v-tf">0.500</span></div><input type="range" id="fu-s-tf" min="-0.1" max="0.1" step="0.005" value="0"></div>
    </div>
    <div class="panel" id="fu-pan-pi" style="display:none;margin-bottom:10px"><h3 style="font-size:13px;margin-bottom:8px">PI gains (FF+PI)</h3>
      <div class="ctrl"><div class="ctrl-row"><span>K<sub>p</sub> (P\u2192n\u0307\u2083)</span><span class="val" id="fu-v-kpp">2.02e-4</span></div><input type="range" id="fu-s-kpp" min="0" max="0.001" step="0.00001" value="0.000202"></div>
      <div class="ctrl"><div class="ctrl-row"><span>K<sub>i</sub> (P\u2192n\u0307\u2083)</span><span class="val" id="fu-v-kip">1.06e-4</span></div><input type="range" id="fu-s-kip" min="0" max="0.001" step="0.00001" value="0.000106"></div>
      <div class="ctrl"><div class="ctrl-row"><span>K<sub>p</sub> (TF\u2192a\u2085)</span><span class="val" id="fu-v-kpt">-0.577</span></div><input type="range" id="fu-s-kpt" min="-2" max="0" step="0.01" value="-0.577"></div>
      <div class="ctrl"><div class="ctrl-row"><span>K<sub>i</sub> (TF\u2192a\u2085)</span><span class="val" id="fu-v-kit">-0.043</span></div><input type="range" id="fu-s-kit" min="-0.2" max="0" step="0.001" value="-0.0434"></div>
      <p style="margin-top:6px;font-size:10px;color:var(--text-3)">RGA pairing: a\u2085\u2194TF, n\u0307\u2083\u2194P</p>
    </div>
    <div class="panel" id="fu-pan-lqr" style="display:none;margin-bottom:10px"><h3 style="font-size:13px;margin-bottom:8px">LQR weights</h3>
      <div class="ctrl"><div class="ctrl-row"><span>Q<sub>P</sub> (pressure)</span><span class="val" id="fu-v-qp">1.0</span></div><input type="range" id="fu-s-qp" min="0.01" max="10" step="0.01" value="1"></div>
      <div class="ctrl"><div class="ctrl-row"><span>Q<sub>TF</sub> (tritium frac)</span><span class="val" id="fu-v-qtf">1.0</span></div><input type="range" id="fu-s-qtf" min="0.01" max="10" step="0.01" value="1"></div>
      <div class="ctrl"><div class="ctrl-row"><span>R<sub>1</sub> (a\u2085)</span><span class="val" id="fu-v-r1">1</span></div><input type="range" id="fu-s-r1" min="0.1" max="20" step="0.1" value="1"></div>
      <div class="ctrl"><div class="ctrl-row"><span>R<sub>2</sub> (a\u2086)</span><span class="val" id="fu-v-r2">1</span></div><input type="range" id="fu-s-r2" min="0.1" max="20" step="0.1" value="1"></div>
      <div class="ctrl"><div class="ctrl-row"><span>R<sub>3</sub> (n\u0307\u2083)</span><span class="val" id="fu-v-r3">10</span></div><input type="range" id="fu-s-r3" min="0.1" max="50" step="0.1" value="10"></div>
      <div id="fu-lqr-k" style="margin-top:6px;font-family:var(--mono);font-size:9px;color:var(--text-3);word-break:break-all"></div>
    </div>
    <div class="panel" style="margin-bottom:10px"><h3 style="font-size:13px;margin-bottom:8px">Info</h3>
      <div style="font-size:11px;color:var(--text-3);line-height:1.6">
        <p>Simulation of hydrogen isotope ratio control in a tokamak fuel vessel (DEMO reactor concept).</p>
        <p style="margin-top:4px"><strong>Outputs:</strong> Pressure and tritium fraction in FV1.</p>
        <p style="margin-top:4px"><strong>Inputs:</strong> Valve 5 aperture (a\u2085), valve 6 aperture (a\u2086), D\u2082 flow (n\u0307\u2083).</p>
        <p style="margin-top:4px"><strong>FF+PI:</strong> Feedforward from inverse model + dual PI error correction with RGA-based SISO pairing.</p>
        <p style="margin-top:4px"><strong>LQR:</strong> Full-state feedback with prefilter for reference tracking.</p>
        <p style="margin-top:8px;font-style:italic;color:var(--text-3)">Based on graduation thesis at DIFFER (2025).</p>
      </div>
    </div>
  </div></div>`;

  // ═══ DESIGN OVERVIEW TAB ═══
  container.querySelector('#fu-design').innerHTML=`<div style="max-width:780px">
    <div class="step"><h3 style="font-size:14px;margin-bottom:8px">1. System Description</h3>
      <p style="font-size:12px;color:var(--text-2);line-height:1.6">The DEMO fusion reactor recycles unburnt deuterium-tritium fuel through three loops (INTL, OUTL, DIRL) into a gas distribution system feeding two fuel vessels. Fuel Vessel 1 (FV1) supplies the pellet injection system. The control objective is to regulate <strong>pressure</strong> and <strong>tritium fraction</strong> in FV1.</p>
      <div class="math-block" style="margin-top:8px;font-size:11px">
        <strong>State vector:</strong> x = [n<sub>FV1,i</sub>] for i \u2208 {H\u2082, D\u2082, T\u2082, HD, HT, DT, He, Xe, Other} \u2192 9 states<br>
        <strong>Inputs:</strong> u = [a\u2085, a\u2086, n\u0307\u2083] \u2192 3 inputs (2 valve apertures + D\u2082 flow)<br>
        <strong>Outputs:</strong> y = [P<sub>FV1</sub>, TF<sub>FV1</sub>] \u2192 2 outputs (pressure, tritium fraction)<br>
        <strong>Classification:</strong> Nonlinear, over-actuated, time-invariant, MIMO, deterministic
      </div>
    </div>
    <div class="step"><h3 style="font-size:14px;margin-bottom:8px">2. Linearisation &amp; Model Reduction</h3>
      <p style="font-size:12px;color:var(--text-2);line-height:1.6">System dynamics linearised via first-order Taylor expansion around the operating point (P = 70.9 kPa, TF = 0.5). The 9-state model was reduced to 3 states via balanced truncation (Hankel singular values), preserving dominant dynamics.</p>
      <div class="math-block" style="margin-top:8px;font-size:11px">
        <strong>Reduced A:</strong><br>
        <pre style="font-size:10px;line-height:1.4">[-0.1736    5.70e-9  -3.97e-9]
[ 3.74e-4  -0.0396   0.0276 ]
[-2.61e-4   0.0276  -0.0192 ]</pre>
        <strong>Reduced B:</strong><br>
        <pre style="font-size:10px;line-height:1.4">[-6.287   -84.66   -147.0 ]
[ 0.0222    0.2745    0.0523]
[-0.0155   -0.1911   -0.0364]</pre>
        <strong>Reduced C:</strong><br>
        <pre style="font-size:10px;line-height:1.4">[-169.72  -7.47e-4  -1.1e-3]
[  1.3e-3   0.2803  -0.1951 ]</pre>
        <p style="margin-top:4px">All open-loop eigenvalues have negative real parts \u2192 system is naturally stable.</p>
      </div>
    </div>
    <div class="step"><h3 style="font-size:14px;margin-bottom:8px">3. Controller Design: Feedforward + PI</h3>
      <p style="font-size:12px;color:var(--text-2);line-height:1.6">The feedforward controller inverts the system dynamics to compute required flows. Flow n\u0307\u2086 (DTB) is treated as a disturbance to resolve over-actuation. Two PI controllers are paired via RGA analysis (\u039B \u2248 diag(0.91, 0.91)):</p>
      <div class="math-block" style="margin-top:8px;font-size:11px">
        <strong>Pairing (RGA):</strong> a\u2085 \u2194 TF<sub>FV1</sub>, n\u0307\u2083 \u2194 P<sub>FV1</sub><br>
        <strong>PI (pressure):</strong> K<sub>p</sub> = 2.02\u00d710\u207b\u2074, K<sub>i</sub> = 1.06\u00d710\u207b\u2074<br>
        <strong>PI (TF):</strong> K<sub>p</sub> = -0.577, K<sub>i</sub> = -0.0434<br>
        <span style="color:var(--text-3)">Tuned for critically damped response (\u03b6 = 1)</span>
      </div>
    </div>
    <div class="step"><h3 style="font-size:14px;margin-bottom:8px">4. Controller Design: LQR (Full-State Feedback)</h3>
      <p style="font-size:12px;color:var(--text-2);line-height:1.6">LQR minimises J = \u222b(x\u1d40Qx + u\u1d40Ru)dt. Q is derived from the output matrix with scaling to balance pressure (\u223c75 kPa) against tritium fraction (\u223c0.5). Higher R\u2083 discourages D\u2082 usage. A prefilter N\u0304 enables reference tracking.</p>
      <div class="math-block" style="margin-top:8px;font-size:11px">
        <strong>Q = C\u1d40 S C</strong> where S = diag(q<sub>P</sub>/P\u00b2, q<sub>TF</sub>/TF\u00b2)<br>
        <strong>R = diag(R\u2081, R\u2082, R\u2083)</strong><br>
        <strong>K = R\u207b\u00b9B\u1d40P</strong> (from algebraic Riccati equation)<br>
        <strong>u = -Kx + N\u0304r</strong> (state feedback + prefilter)
      </div>
    </div>
    <div class="step"><h3 style="font-size:14px;margin-bottom:8px">5. Results Summary</h3>
      <p style="font-size:12px;color:var(--text-2);line-height:1.6">Both controllers achieve effective disturbance rejection and setpoint tracking. The LQR (FSF) controller settles 10\u201320\u00d7 faster but shows small steady-state pressure errors from nonlinear effects. The FF+PI controller tracks well but occasionally exceeds actuator limits.</p>
      <div style="margin-top:8px;font-size:11px;overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:10px;font-family:var(--mono)">
          <tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:4px">Test</th><th>t<sub>s</sub> FFC</th><th>t<sub>s</sub> FSF</th><th>OS FFC</th><th>OS FSF</th></tr>
          <tr><td style="padding:4px">P<sub>FV1</sub> +10%</td><td style="text-align:center">7.4 s</td><td style="text-align:center;color:var(--green)">0.8 s</td><td style="text-align:center">0%</td><td style="text-align:center">0%</td></tr>
          <tr><td style="padding:4px">TF<sub>FV1</sub> +10%</td><td style="text-align:center">11.4 s</td><td style="text-align:center;color:var(--green)">0.4 s</td><td style="text-align:center">1.7%</td><td style="text-align:center">0%</td></tr>
          <tr><td style="padding:4px">P<sub>DTB</sub> +10%</td><td style="text-align:center">\u2014</td><td style="text-align:center">\u2014</td><td style="text-align:center;color:var(--green)">\u2248 0</td><td style="text-align:center;color:var(--green)">\u2248 0</td></tr>
        </table>
      </div>
    </div>
  </div>`;

  // ═══ WIRING ═══
  const $=id=>container.querySelector('#'+id);
  ctrlMode='none'; spP=P_OP; spTF=TF_OP;
  computeFFGain();
  K_lqr=computeLQR(1,1,1,1,10);
  resetSim();

  const cv=$('fu-cv');
  ch1=mkChart($('fu-ch-p'),'Pressure','kPa',isDark()?'#818cf8':'#4338ca','P setpoint');
  ch2=mkChart($('fu-ch-tf'),'Tritium Fraction','',isDark()?'#22c55e':'#16a34a','TF setpoint');

  function hook(s,v,fmt,cb){
    const el=$(s);if(!el)return;
    el.addEventListener('input',()=>{$(v).textContent=fmt(el.value);cb?.()});
  }

  // Setpoint sliders (perturbation from OP)
  hook('fu-s-p','fu-v-p',v=>((P_OP+v*1000)/1000).toFixed(1)+' kPa',()=>{
    spP=P_OP+parseFloat($('fu-s-p').value)*1000;
  });
  hook('fu-s-tf','fu-v-tf',v=>(TF_OP+parseFloat(v)).toFixed(3),()=>{
    spTF=TF_OP+parseFloat($('fu-s-tf').value);
  });

  // PI gain sliders
  hook('fu-s-kpp','fu-v-kpp',v=>parseFloat(v).toExponential(2));
  hook('fu-s-kip','fu-v-kip',v=>parseFloat(v).toExponential(2));
  hook('fu-s-kpt','fu-v-kpt',v=>parseFloat(v).toFixed(3));
  hook('fu-s-kit','fu-v-kit',v=>parseFloat(v).toFixed(3));

  // LQR weight sliders
  function rebuildLQR(){
    K_lqr=computeLQR(+$('fu-s-qp').value,+$('fu-s-qtf').value,+$('fu-s-r1').value,+$('fu-s-r2').value,+$('fu-s-r3').value);
    if(K_lqr){
      $('fu-lqr-k').textContent='K = ['+K_lqr.map(r=>'['+r.map(v=>v.toFixed(4)).join(', ')+']').join(', ')+']';
    }else{$('fu-lqr-k').textContent='LQR solve failed'}
  }
  hook('fu-s-qp','fu-v-qp',v=>parseFloat(v).toFixed(2),rebuildLQR);
  hook('fu-s-qtf','fu-v-qtf',v=>parseFloat(v).toFixed(2),rebuildLQR);
  hook('fu-s-r1','fu-v-r1',v=>parseFloat(v).toFixed(1),rebuildLQR);
  hook('fu-s-r2','fu-v-r2',v=>parseFloat(v).toFixed(1),rebuildLQR);
  hook('fu-s-r3','fu-v-r3',v=>parseFloat(v).toFixed(1),rebuildLQR);
  rebuildLQR();

  // Controller mode
  container.querySelectorAll('#fu-ctrl button').forEach(b=>b.addEventListener('click',()=>{
    container.querySelectorAll('#fu-ctrl button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    ctrlMode=b.dataset.m;
    $('fu-pan-pi').style.display=ctrlMode==='ffpi'?'':'none';
    $('fu-pan-lqr').style.display=ctrlMode==='lqr'?'':'none';
    piIntP=0;piIntTF=0;
  }));

  // Buttons
  $('fu-reset').addEventListener('click',()=>{resetSim();piIntP=0;piIntTF=0});
  $('fu-pause').addEventListener('click',()=>{paused=!paused;$('fu-pause').textContent=paused?'Resume':'Pause'});

  // Disturbance buttons
  $('fu-step').addEventListener('click',()=>{
    dist={label:'P_DTB +10%',du:[0,0.08,0],duration:20};distTime=0;
  });
  $('fu-step2').addEventListener('click',()=>{
    dist={label:'DT shift DTF',du:[0.02,0,0],duration:20};distTime=0;
  });

  // ResizeObserver
  ro=new ResizeObserver(()=>{
    const w=cv.parentElement.clientWidth;
    if(w>0&&w!==cv.width){cv.width=Math.min(w,900);drawPFD(cv,[0,0],[0,0,0],spP,spTF)}
  });
  ro.observe(cv.parentElement);

  let metFrame=0;

  // ═══ SIMULATION LOOP ═══
  function loop(){
    raf=requestAnimationFrame(loop);
    if(paused)return;
    const dt=1/60, substeps=4;

    // Reference (perturbation from OP)
    const refP=spP-P_OP, refTF=spTF-TF_OP;
    // Current output (perturbation)
    const yOut=mvMul(Cr,state);
    const errP=refP-yOut[0], errTF=refTF-yOut[1];

    let u=[0,0,0];

    if(ctrlMode==='ffpi'&&G_ff){
      // Feedforward: u_ff = G_ff * [refP, refTF]
      const uff=[G_ff[0][0]*refP+G_ff[0][1]*refTF,
                 G_ff[1][0]*refP+G_ff[1][1]*refTF,
                 G_ff[2][0]*refP+G_ff[2][1]*refTF];
      // PI correction (RGA pairing: a5↔TF, n3↔P)
      const kpp=+$('fu-s-kpp').value, kip=+$('fu-s-kip').value;
      const kpt=+$('fu-s-kpt').value, kit=+$('fu-s-kit').value;
      piIntP+=errP*dt; piIntTF+=errTF*dt;
      piIntP=Math.max(-1e5,Math.min(1e5,piIntP));
      piIntTF=Math.max(-10,Math.min(10,piIntTF));
      const uPi_n3=kpp*errP+kip*piIntP;
      const uPi_a5=kpt*errTF+kit*piIntTF;
      u=[uff[0]+uPi_a5, uff[1], uff[2]+uPi_n3];
    }else if(ctrlMode==='lqr'&&K_lqr){
      // u = -K*x + Nbar*r
      const Kx=mvMul(K_lqr,state);
      const Nr=[Nbar[0][0]*refP+Nbar[0][1]*refTF,
                Nbar[1][0]*refP+Nbar[1][1]*refTF,
                Nbar[2][0]*refP+Nbar[2][1]*refTF];
      u=[-Kx[0]+Nr[0], -Kx[1]+Nr[1], -Kx[2]+Nr[2]];
    }

    // Add disturbance
    if(dist){
      u=u.map((v,i)=>v+dist.du[i]);
      distTime+=dt;
      if(distTime>=dist.duration)dist=null;
    }

    // Clamp inputs to physical limits (valve aperture ∈ [-0.5, 0.5] from OP, flow limited)
    u[0]=Math.max(-0.5,Math.min(0.5,u[0]));
    u[1]=Math.max(-0.5,Math.min(0.5,u[1]));
    u[2]=Math.max(-0.01,Math.min(0.01,u[2]));

    // Integrate
    for(let i=0;i<substeps;i++) state=rk4Step(state,u,dt/substeps);
    time+=dt;

    const yNew=mvMul(Cr,state);
    // Record history
    hist.t.push(time);
    hist.y0.push((P_OP+yNew[0])/1000);
    hist.y1.push(TF_OP+yNew[1]);
    hist.u0.push(u[0]);hist.u1.push(u[1]);hist.u2.push(u[2]);
    if(hist.t.length>hist.max){
      hist.t.shift();hist.y0.shift();hist.y1.shift();
      hist.u0.shift();hist.u1.shift();hist.u2.shift();
    }

    // Draw
    drawPFD(cv,yNew,u,spP,spTF);

    // Update charts
    const mx=300;
    const spPArr=hist.t.map(()=>spP/1000);
    const spTFArr=hist.t.map(()=>spTF);
    ch1.data.labels=hist.t.slice(-mx).map(t=>t.toFixed(1));
    ch1.data.datasets[0].data=hist.y0.slice(-mx);
    ch1.data.datasets[1].data=spPArr.slice(-mx);
    ch1.update('none');
    ch2.data.labels=hist.t.slice(-mx).map(t=>t.toFixed(1));
    ch2.data.datasets[0].data=hist.y1.slice(-mx);
    ch2.data.datasets[1].data=spTFArr.slice(-mx);
    ch2.update('none');

    // Metrics every 30 frames
    metFrame++;
    if(metFrame%30===0&&hist.t.length>30&&ctrlMode!=='none'){
      const n=hist.t.length;
      const pArr=hist.y0.map(v=>v*1000), tArr=hist.y1;
      const mP=Metrics.compute(hist.t,pArr,spP,0.02);
      const mTF=Metrics.compute(hist.t,tArr,spTF,0.02);
      const rmsU=Math.sqrt(hist.u0.reduce((s,v)=>s+v*v,0)/n);
      $('fu-met').innerHTML=`
        <div class="metric"><div class="metric-lbl">P settling</div><div class="metric-val ${mP.ts<5?'good':mP.ts<15?'warn':'bad'}">${mP.ts.toFixed(2)} s</div></div>
        <div class="metric"><div class="metric-lbl">P SSE</div><div class="metric-val ${mP.sse<200?'good':mP.sse<1000?'warn':'bad'}">${mP.sse.toFixed(0)} Pa</div></div>
        <div class="metric"><div class="metric-lbl">TF settling</div><div class="metric-val ${mTF.ts<5?'good':mTF.ts<15?'warn':'bad'}">${mTF.ts.toFixed(2)} s</div></div>
        <div class="metric"><div class="metric-lbl">TF SSE</div><div class="metric-val ${mTF.sse<0.005?'good':mTF.sse<0.02?'warn':'bad'}">${mTF.sse.toFixed(4)}</div></div>
        <div class="metric"><div class="metric-lbl">P overshoot</div><div class="metric-val ${mP.os<2?'good':mP.os<10?'warn':'bad'}">${mP.os.toFixed(1)}%</div></div>
        <div class="metric"><div class="metric-lbl">RMS a\u2085</div><div class="metric-val">${rmsU.toFixed(4)}</div></div>`;
    }
  }
  loop();
}

function cleanup(){
  if(raf){cancelAnimationFrame(raf);raf=null}
  if(ch1){ch1.destroy();ch1=null}
  if(ch2){ch2.destroy();ch2=null}
  if(ro){ro.disconnect();ro=null}
  state=null;hist=null;paused=false;
  dist=null;K_lqr=null;G_ff=null;
}

ProjectRegistry.register('fusion-demo',render,cleanup);
})();
