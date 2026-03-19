(function(){
'use strict';
let raf=null,sys=null,ctrl=null,ch1=null,ch2=null,paused=false;
const isDark=()=>document.documentElement.getAttribute('data-theme')==='dark';

function drawCart(cv,sys){
  const ctx=cv.getContext('2d'),W=cv.width,H=cv.height,dk=isDark();
  const sc=80,ox=W/2,oy=H*0.7;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=dk?'#171717':'#f5f5f0';ctx.fillRect(0,0,W,H);
  // track
  ctx.strokeStyle=dk?'#3f3f46':'#d6d3d1';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(ox+sys.xMin*sc,oy);ctx.lineTo(ox+sys.xMax*sc,oy);ctx.stroke();
  // tick marks
  ctx.fillStyle=dk?'#52525b':'#a8a29e';ctx.font='9px "Outfit",sans-serif';ctx.textAlign='center';
  for(let i=Math.ceil(sys.xMin);i<=Math.floor(sys.xMax);i++){
    ctx.beginPath();ctx.moveTo(ox+i*sc,oy-4);ctx.lineTo(ox+i*sc,oy+4);ctx.stroke();
    if(i!==0)ctx.fillText(i+'m',ox+i*sc,oy+14);
  }
  // target line
  ctx.strokeStyle=dk?'rgba(129,140,248,.25)':'rgba(67,56,202,.15)';ctx.lineWidth=1;ctx.setLineDash([5,4]);
  ctx.beginPath();ctx.moveTo(ox,oy-200);ctx.lineTo(ox,oy+10);ctx.stroke();ctx.setLineDash([]);

  const[x,,th]=sys.state;
  const cx=ox+x*sc;
  // cart
  const cw=44,ch_h=22;
  ctx.fillStyle=dk?'#3f3f46':'#44403c';
  ctx.beginPath();ctx.roundRect(cx-cw/2,oy-ch_h/2,cw,ch_h,4);ctx.fill();
  // wheels
  ctx.fillStyle=dk?'#52525b':'#78716c';
  ctx.beginPath();ctx.arc(cx-14,oy+ch_h/2+3,4,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(cx+14,oy+ch_h/2+3,4,0,Math.PI*2);ctx.fill();
  // pole
  const pLen=2*sys.L*sc;
  const px=cx+pLen*Math.sin(th), py=oy-pLen*Math.cos(th);
  ctx.strokeStyle=dk?'#d4d4d8':'#292524';ctx.lineWidth=4;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(cx,oy);ctx.lineTo(px,py);ctx.stroke();
  // pole tip
  ctx.fillStyle=dk?'#818cf8':'#4338ca';ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();
  // pivot
  ctx.fillStyle=dk?'#fbbf24':'#b45309';ctx.beginPath();ctx.arc(cx,oy,3,0,Math.PI*2);ctx.fill();
  // info
  ctx.font='11px "Outfit",sans-serif';ctx.fillStyle=dk?'#78716c':'#a8a29e';ctx.textAlign='left';
  ctx.fillText(`t = ${sys.time.toFixed(1)}s  x = ${x.toFixed(2)}m  θ = ${(th*180/Math.PI).toFixed(1)}°`,6,14);
  ctx.fillText(`F = ${(sys.tau[0]||0).toFixed(1)} N`,6,26);
}

function mkChart(cv,l1,l2,c1,c2){
  return new Chart(cv,{type:'line',data:{labels:[],datasets:[{label:l1,data:[],borderColor:c1,borderWidth:1.5,pointRadius:0,tension:.3},{label:l2,data:[],borderColor:c2,borderWidth:1.5,pointRadius:0,tension:.3}]},options:{animation:false,responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{size:10,family:'Outfit'},boxWidth:10,padding:6}}},scales:{x:{display:false},y:{ticks:{font:{size:9}},grid:{color:'rgba(0,0,0,.05)'}}}}})
}
function pushCh(c,t,d0,d1,mx=250){c.data.labels=t.slice(-mx);c.data.datasets[0].data=d0.slice(-mx);c.data.datasets[1].data=d1.slice(-mx);c.update('none')}
function fmtM(M,p=3){return M.map(r=>'['+r.map(v=>v.toFixed(p).padStart(9)).join(' ')+']').join('\n')}
function fmtV(v,p=3){return'['+v.map(x=>x.toFixed(p)).join(', ')+']'}

function render(container){
  container.innerHTML=`
    <div class="tab-bar"><button class="tab-btn active" data-t="play">Playground</button><button class="tab-btn" data-t="design">Control design method</button></div>
    <div id="cp-play"></div><div id="cp-design" style="display:none"></div>`;
  container.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{
    container.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    container.querySelector('#cp-play').style.display=b.dataset.t==='play'?'':'none';
    container.querySelector('#cp-design').style.display=b.dataset.t==='design'?'':'none';
    if(b.dataset.t==='design')buildDesign();
  }));

  const $p=container.querySelector('#cp-play');
  $p.innerHTML=`<div class="two-col"><div>
    <div class="sim-wrap"><div class="sim-bar"><h3>Cart-pole</h3>
      <div class="pill" id="ctrl-sel"><button class="active" data-m="none">Free</button><button data-m="pid">PID</button><button data-m="lqr">LQR</button></div></div>
    <canvas id="cv" class="sim-canvas" width="680" height="340"></canvas>
    <div class="sim-foot"><button class="btn btn-sm" id="b-reset">Reset</button><button class="btn btn-sm" id="b-pause">Pause</button></div></div>
    <div class="plots"><div class="plot-box"><canvas id="ch-st"></canvas></div><div class="plot-box"><canvas id="ch-f"></canvas></div></div>
    <div class="panel" style="margin-top:10px"><h3 style="font-size:13px;margin-bottom:6px">Performance metrics</h3><div class="metrics" id="met">—</div></div>
  </div><div class="sidebar" id="sb">
    <div class="panel" style="margin-bottom:10px"><h3 style="font-size:13px;margin-bottom:8px">Physics</h3>
      <div class="ctrl"><div class="ctrl-row"><span>Cart mass M</span><span class="val" id="v-M">1.0 kg</span></div><input type="range" id="s-M" min=".2" max="5" step=".1" value="1"></div>
      <div class="ctrl"><div class="ctrl-row"><span>Pole mass m</span><span class="val" id="v-m">0.3 kg</span></div><input type="range" id="s-m" min=".05" max="2" step=".05" value=".3"></div>
      <div class="ctrl"><div class="ctrl-row"><span>Pole half-length L</span><span class="val" id="v-L">0.6 m</span></div><input type="range" id="s-L" min=".2" max="1.5" step=".1" value=".6"></div>
      <div class="ctrl"><div class="ctrl-row"><span>Initial angle</span><span class="val" id="v-th0">8.6°</span></div><input type="range" id="s-th0" min="-30" max="30" step=".5" value="8.6"></div>
    </div>
    <div class="panel" id="pan-pid" style="display:none;margin-bottom:10px"><h3 style="font-size:13px;margin-bottom:8px">PID gains (θ → 0)</h3>
      <div class="ctrl"><div class="ctrl-row"><span>Kp</span><span class="val" id="v-kp">40</span></div><input type="range" id="s-kp" min="0" max="120" step="1" value="40"></div>
      <div class="ctrl"><div class="ctrl-row"><span>Ki</span><span class="val" id="v-ki">0</span></div><input type="range" id="s-ki" min="0" max="10" step=".1" value="0"></div>
      <div class="ctrl"><div class="ctrl-row"><span>Kd</span><span class="val" id="v-kd">10</span></div><input type="range" id="s-kd" min="0" max="40" step=".5" value="10"></div>
    </div>
    <div class="panel" id="pan-lqr" style="display:none;margin-bottom:10px"><h3 style="font-size:13px;margin-bottom:8px">LQR weights</h3>
      <div class="ctrl"><div class="ctrl-row"><span>Q₁₁ (x)</span><span class="val" id="v-q1">1</span></div><input type="range" id="s-q1" min="0" max="50" step="1" value="1"></div>
      <div class="ctrl"><div class="ctrl-row"><span>Q₃₃ (θ)</span><span class="val" id="v-q3">50</span></div><input type="range" id="s-q3" min="1" max="200" step="1" value="50"></div>
      <div class="ctrl"><div class="ctrl-row"><span>R</span><span class="val" id="v-r">1</span></div><input type="range" id="s-r" min=".1" max="20" step=".1" value="1"></div>
      <div id="lqr-k" style="margin-top:6px;font-family:var(--mono);font-size:10px;color:var(--text-3);word-break:break-all"></div>
    </div>
  </div></div>`;

  container.querySelector('#cp-design').innerHTML=`<div class="two-col"><div>
    <div class="sim-wrap"><div class="sim-bar"><h3>Closed-loop response</h3><span id="d-stat" style="font-size:11px;color:var(--text-3)">Complete the steps →</span></div>
    <canvas id="d-cv" class="sim-canvas" width="680" height="320"></canvas>
    <div class="sim-foot"><button class="btn btn-sm btn-p" id="b-dsim">Run simulation</button><button class="btn btn-sm" id="b-drst">Reset</button></div></div>
    <div class="plots"><div class="plot-box"><canvas id="dc-st"></canvas></div><div class="plot-box"><canvas id="dc-f"></canvas></div></div>
    <div class="panel" style="margin-top:10px"><h3 style="font-size:13px;margin-bottom:6px">Performance metrics</h3><div class="metrics" id="d-met">—</div></div>
  </div><div class="sidebar" id="d-sb"></div></div>`;

  const $=id=>container.querySelector('#'+id);
  let ctrlMode='none';
  const th0=()=>(+$('s-th0').value)*Math.PI/180;

  sys=new CartPole({M:1,m:.3,L:.6,b:.1,bp:.01,s0:[0,0,th0(),0]});
  function rebuild(){
    sys=new CartPole({M:+$('s-M').value,m:+$('s-m').value,L:+$('s-L').value,b:.1,bp:.01,s0:[0,0,th0(),0]});
    ctrl=null;if(ctrlMode==='pid')makePID();if(ctrlMode==='lqr')makeLQR();
  }
  function makePID(){ctrl=new PIDController({kp:+$('s-kp').value,ki:+$('s-ki').value,kd:+$('s-kd').value,min:-30,max:30});ctrl.reset()}
  function makeLQR(){
    try{const q1=+$('s-q1').value,q3=+$('s-q3').value,r=+$('s-r').value;
    ctrl=new LQRController(sys,[[q1,0,0,0],[0,1,0,0],[0,0,q3,0],[0,0,0,1]],[[r]]);ctrl.min=-30;ctrl.max=30;ctrl.design([0,0,0,0]);
    $('lqr-k').textContent='K = '+fmtV(ctrl.K[0],2)}catch(e){$('lqr-k').textContent='Design failed';ctrl=null}}

  const hook=(s,v,u,cb)=>{$(s)?.addEventListener('input',()=>{$(v).textContent=$(s).value+(u||'');cb?.()})};
  hook('s-M','v-M',' kg',rebuild);hook('s-m','v-m',' kg',rebuild);hook('s-L','v-L',' m',rebuild);hook('s-th0','v-th0','°',rebuild);
  hook('s-kp','v-kp','',()=>{if(ctrl?.kp!==undefined)ctrl.kp=+$('s-kp').value});
  hook('s-ki','v-ki','',()=>{if(ctrl?.ki!==undefined)ctrl.ki=+$('s-ki').value});
  hook('s-kd','v-kd','',()=>{if(ctrl?.kd!==undefined)ctrl.kd=+$('s-kd').value});
  hook('s-q1','v-q1','',makeLQR);hook('s-q3','v-q3','',makeLQR);hook('s-r','v-r','',makeLQR);

  container.querySelectorAll('#ctrl-sel button').forEach(b=>b.addEventListener('click',()=>{
    container.querySelectorAll('#ctrl-sel button').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    ctrlMode=b.dataset.m;$('pan-pid').style.display=ctrlMode==='pid'?'':'none';$('pan-lqr').style.display=ctrlMode==='lqr'?'':'none';
    ctrl=null;if(ctrlMode==='pid')makePID();if(ctrlMode==='lqr')makeLQR();
  }));
  $('b-reset').addEventListener('click',rebuild);
  $('b-pause').addEventListener('click',()=>{paused=!paused;$('b-pause').textContent=paused?'Resume':'Pause'});

  ch1=mkChart($('ch-st'),'x (m)','θ (rad)','#4338ca','#b45309');
  ch2=mkChart($('ch-f'),'Force (N)','Limit','#15803d','#e7e5e4');

  let dSys=null,dCtrl=null,dRun=false,dc1=null,dc2=null,metT=0;

  function buildDesign(){
    const sb=$('d-sb'),p=sys,{A,B}=p.linearize([0,0,0,0]);
    const n=4;let Cv=[B.map(r=>r[0])];let Ak=B.map(r=>[r[0]]);
    for(let i=1;i<n;i++){Ak=numeric.dot(A,Ak);Cv.push(Ak.map(r=>r[0]))}
    let cRk=n;try{cRk=numeric.svd(numeric.transpose(Cv)).S.filter(s=>s>1e-10).length}catch(e){}
    const eigs=numeric.eig(A).lambda.x;

    sb.innerHTML=`
      <div class="step"><div class="step-num">Step 1</div><h4>Cart-pole model</h4>
        <p>Cart (mass M) on a track with a rigid pole (mass m, length 2L) pivoting from the cart. θ = 0 is upright. Single input: horizontal force F on the cart.</p>
        <p style="font-size:12px;color:var(--text-3)">State: x = [x, ẋ, θ, ω]</p></div>
      <div class="step"><div class="step-num">Step 2</div><h4>Linearization around upright (θ = 0)</h4>
        <div class="math-block">A =\n${fmtM(A)}</div><div class="math-block">B =\n${fmtM(B,4)}</div>
        <p style="font-size:12px">Eigenvalues: ${eigs.map(v=>v.toFixed(2)).join(', ')} ${eigs.some(v=>v>0)?'→ <strong style="color:var(--red)">Unstable</strong>':''}</p></div>
      <div class="step"><div class="step-num">Step 3</div><h4>Controllability</h4>
        <div class="math-block">rank(C) = ${cRk} ${cRk>=n?'✓':'✗'}</div></div>
      <div class="step"><div class="step-num">Step 4</div><h4>Weight selection</h4>
        <div class="ctrl"><div class="ctrl-row"><span>Q₁₁ (x pos)</span><span class="val" id="dv-q1">1</span></div><input type="range" id="ds-q1" min="0" max="50" step="1" value="1"></div>
        <div class="ctrl"><div class="ctrl-row"><span>Q₃₃ (θ angle)</span><span class="val" id="dv-q3">50</span></div><input type="range" id="ds-q3" min="1" max="200" step="1" value="50"></div>
        <div class="ctrl"><div class="ctrl-row"><span>R</span><span class="val" id="dv-r">1</span></div><input type="range" id="ds-r" min=".1" max="20" step=".1" value="1"></div></div>
      <div class="step"><div class="step-num">Step 5</div><h4>Solve Riccati & compute K</h4>
        <div class="math-block" id="d-res">Press "Compute K"</div>
        <button class="btn btn-sm btn-p" id="b-solve" style="margin-top:6px">Compute K</button></div>
      <div class="step"><div class="step-num">Step 6</div><h4>Simulate</h4><p>Apply u = −Kx to the nonlinear plant with initial θ₀ ≈ 10°.</p></div>`;
    ['ds-q1','ds-q3','ds-r'].forEach(id=>{$(id)?.addEventListener('input',()=>{$(id.replace('ds-','dv-')).textContent=$(id).value})});
    $('b-solve').addEventListener('click',()=>{
      try{const q1=+$('ds-q1').value,q3=+$('ds-q3').value,r=+$('ds-r').value;
        const Q=[[q1,0,0,0],[0,1,0,0],[0,0,q3,0],[0,0,0,1]],R=[[r]];
        const{K}=LQR.gain(A,B,Q,R);
        const Bv=B.map(r=>[r[0]]),Km=[[K[0][0],K[0][1],K[0][2],K[0][3]]];
        const Acl=numeric.sub(A,numeric.dot(Bv,Km)),clE=numeric.eig(Acl).lambda.x;
        $('d-res').innerHTML='K = '+fmtV(K[0],2)+'\n\nClosed-loop eigenvalues:\n'+clE.map(v=>v.toFixed(3)).join(', ')+'\n'+(clE.every(v=>v<0)?'✓ Stable':'⚠ Unstable');
        dCtrl=new LQRController(sys,Q,R);dCtrl.K=K;dCtrl.ref=[0,0,0,0];dCtrl.ok=true;dCtrl.min=-30;dCtrl.max=30;
        $('d-stat').textContent='Ready to simulate';
      }catch(e){$('d-res').textContent='Failed: '+e.message}});
    if(dc1)dc1.destroy();if(dc2)dc2.destroy();
    dc1=mkChart($('dc-st'),'x (m)','θ (rad)','#4338ca','#b45309');
    dc2=mkChart($('dc-f'),'Force','Limit','#15803d','#e7e5e4');
  }
  $('b-dsim').addEventListener('click',()=>{
    if(!dCtrl?.ok){alert('Compute K first');return}
    dSys=new CartPole({M:sys.M,m:sys.m,L:sys.L,b:.1,bp:.01,s0:[0,0,.17,0]});dRun=true;$('d-stat').textContent='Running...';$('d-met').innerHTML='—';
  });
  $('b-drst').addEventListener('click',()=>{dRun=false;dSys=null;$('d-stat').textContent='Reset';
    if(dc1){dc1.data.labels=[];dc1.data.datasets.forEach(d=>d.data=[]);dc1.update('none')}
    if(dc2){dc2.data.labels=[];dc2.data.datasets.forEach(d=>d.data=[]);dc2.update('none')}$('d-met').innerHTML='—';});

  const cv=$('cv'),dcv=$('d-cv');
  function loop(){
    if(container.querySelector('#cp-play').style.display!=='none'&&!paused){
      let u=[0];
      if(ctrlMode==='pid'&&ctrl)u=[ctrl.compute(0,sys.state[2],sys.dt)];
      else if(ctrlMode==='lqr'&&ctrl?.ok)u=ctrl.compute(sys.state);
      sys.step(u);drawCart(cv,sys);
      if(sys.hist.t.length>0){const t=sys.hist.t,s=sys.hist.s;
        pushCh(ch1,t.map(v=>v.toFixed(1)),s.map(x=>x[0]),s.map(x=>x[2]));
        pushCh(ch2,t.map(v=>v.toFixed(1)),sys.hist.u.map(x=>x[0]||0),sys.hist.u.map(()=>30))}
      metT++;if(metT%30===0&&sys.hist.s.length>60&&ctrlMode!=='none'){
        const m=Metrics.compute(sys.hist.t,sys.hist.s.map(x=>x[2]),0);
        const mx=Metrics.compute(sys.hist.t,sys.hist.s.map(x=>x[0]),0);
        const ru=Metrics.rms(sys.hist.u.map(x=>x[0]||0));
        $('met').innerHTML=Metrics.html(m)+`<div class="metric"><div class="metric-label">Cart SSE</div><div class="metric-val">${mx.sse!==null?mx.sse.toFixed(3)+' m':'—'}</div></div><div class="metric"><div class="metric-label">RMS force</div><div class="metric-val">${ru.toFixed(2)} N</div></div>`;
      }else if(ctrlMode==='none')$('met').innerHTML='<div style="grid-column:span 2;font-size:12px;color:var(--text-3)">Select a controller</div>';
    }
    if(container.querySelector('#cp-design').style.display!=='none'){
      if(dRun&&dSys&&dCtrl){dSys.step(dCtrl.compute(dSys.state));drawCart(dcv,dSys);
        if(dSys.hist.t.length>0&&dc1){pushCh(dc1,dSys.hist.t.map(v=>v.toFixed(1)),dSys.hist.s.map(x=>x[0]),dSys.hist.s.map(x=>x[2]));
          pushCh(dc2,dSys.hist.t.map(v=>v.toFixed(1)),dSys.hist.u.map(x=>x[0]||0),dSys.hist.u.map(()=>30))}
        if(dSys.time>10){dRun=false;$('d-stat').textContent='Done (10 s)';
          const m=Metrics.compute(dSys.hist.t,dSys.hist.s.map(x=>x[2]),0);
          const ru=Metrics.rms(dSys.hist.u.map(x=>x[0]||0));
          $('d-met').innerHTML=Metrics.html(m)+`<div class="metric"><div class="metric-label">RMS force</div><div class="metric-val">${ru.toFixed(2)} N</div></div>`}
      }else if(!dRun&&!dSys){
        const tmp=new CartPole({M:sys.M,m:sys.m,L:sys.L,s0:[0,0,.15,0]});drawCart(dcv,tmp);
      }
    }
    raf=requestAnimationFrame(loop);
  }
  loop();
}
function cleanup(){if(raf){cancelAnimationFrame(raf);raf=null}if(ch1){ch1.destroy();ch1=null}if(ch2){ch2.destroy();ch2=null}sys=null;ctrl=null;paused=false}
ProjectRegistry.register('cart-pole',render,cleanup);
})();
