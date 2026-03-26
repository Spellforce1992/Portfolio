(function(){
'use strict';
let raf=null,renderer=null,scene=null,camera=null,ro=null;
let j1=0,j2=Math.PI/4,j3=-Math.PI/6;
let mode='fk',animating=false,animTime=0;
let isDragging=false,prevMouseX=0,prevMouseY=0;
let camTheta,camPhi,camRadius;
let joint1Pivot,joint2Pivot,joint3Pivot,eeMesh,eeRing;
let targetMesh,targetRing,ground;
let traceGeo,tracePositions,traceCount=0;
const MAX_TRACE=800;
const L1=2.0,L2=1.6,L3=0.8,BASE_HEIGHT=0.5;
const isDark=()=>document.documentElement.getAttribute('data-theme')==='dark';

function render(container){
  container.innerHTML=`
    <div class="two-col"><div>
      <div class="sim-wrap">
        <div class="sim-bar"><h3>3-DOF Robot Arm</h3>
          <div class="pill" id="ra-mode"><button class="active" data-m="fk">FK</button><button data-m="ik">IK</button></div>
        </div>
        <div id="ra-canvas-wrap" style="position:relative;width:100%;height:400px;overflow:hidden;border-radius:6px;background:#0a0a0f"></div>
        <div class="sim-foot">
          <button class="btn btn-sm" id="ra-reset">Reset</button>
          <button class="btn btn-sm" id="ra-clear">Clear trace</button>
          <button class="btn btn-sm" id="ra-anim">Animate</button>
        </div>
      </div>
      <div class="panel" style="margin-top:10px" id="ra-ik-hint" hidden>
        <p style="font-size:12px;color:var(--text-2)">Click on the <strong style="color:var(--accent)">ground plane</strong> in the 3D view to set the IK target.</p>
      </div>
      <div class="panel" style="margin-top:10px"><h3 style="font-size:13px;margin-bottom:6px">End Effector</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:12px">
          <div class="ctrl-row"><span>X</span><span class="val" id="ra-ee-x" style="font-family:var(--mono);color:var(--accent)">0.00</span></div>
          <div class="ctrl-row"><span>Y</span><span class="val" id="ra-ee-y" style="font-family:var(--mono);color:var(--accent)">0.00</span></div>
          <div class="ctrl-row"><span>Z</span><span class="val" id="ra-ee-z" style="font-family:var(--mono);color:var(--accent)">0.00</span></div>
          <div class="ctrl-row"><span>Reach</span><span class="val" id="ra-ee-r" style="font-family:var(--mono);color:var(--accent)">0.00</span></div>
        </div>
      </div>
    </div>
    <div class="sidebar">
      <div class="panel" style="margin-bottom:10px"><h3 style="font-size:13px;margin-bottom:8px">Joint Angles</h3>
        <div class="ctrl"><div class="ctrl-row"><span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:#00e5a0;display:inline-block"></span> Base (θ₁)</span><span class="val" id="ra-v1">0°</span></div><input type="range" id="ra-s1" min="-180" max="180" step="1" value="0"></div>
        <div class="ctrl"><div class="ctrl-row"><span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:#5b7fff;display:inline-block"></span> Elbow (θ₂)</span><span class="val" id="ra-v2">45°</span></div><input type="range" id="ra-s2" min="-180" max="180" step="1" value="45"></div>
        <div class="ctrl"><div class="ctrl-row"><span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:#ff6b6b;display:inline-block"></span> Wrist (θ₃)</span><span class="val" id="ra-v3">-30°</span></div><input type="range" id="ra-s3" min="-180" max="180" step="1" value="-30"></div>
      </div>
      <div class="panel" style="margin-bottom:10px"><h3 style="font-size:13px;margin-bottom:8px">Info</h3>
        <div style="font-size:11px;color:var(--text-3);line-height:1.7">
          <p><strong>Forward Kinematics (FK):</strong> Adjust joint angles with sliders to move the arm. Drag to orbit the camera, scroll to zoom.</p>
          <p style="margin-top:6px"><strong>Inverse Kinematics (IK):</strong> Click the ground plane to set a target position. The arm solves for joint angles automatically.</p>
          <p style="margin-top:6px"><strong>Animate:</strong> Plays a smooth demo trajectory to show the arm's workspace.</p>
        </div>
      </div>
    </div></div>`;

  const $=id=>container.querySelector('#'+id);

  // ── Three.js setup ──
  const wrap=$('ra-canvas-wrap');
  const W=wrap.clientWidth||680,H=wrap.clientHeight||400;

  scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x0a0a0f,0.035);

  camera=new THREE.PerspectiveCamera(50,W/H,0.1,100);
  camera.position.set(6,5,8);
  camera.lookAt(0,2,0);
  camTheta=Math.atan2(camera.position.x,camera.position.z);
  camPhi=Math.acos(camera.position.y/camera.position.length());
  camRadius=camera.position.length();

  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(W,H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  wrap.appendChild(renderer.domElement);

  function updateTheme(){
    const dk=isDark();
    scene.background=new THREE.Color(dk?0x0a0a0f:0xf5f5f0);
    scene.fog.color.set(dk?0x0a0a0f:0xf5f5f0);
    wrap.style.background=dk?'#0a0a0f':'#f5f5f0';
  }
  updateTheme();
  const themeObs=new MutationObserver(updateTheme);
  themeObs.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

  // ── Lights ──
  scene.add(new THREE.AmbientLight(0x303045,0.8));
  const dirLight=new THREE.DirectionalLight(0xffffff,0.6);
  dirLight.position.set(5,10,5);dirLight.castShadow=true;
  dirLight.shadow.mapSize.set(1024,1024);
  dirLight.shadow.camera.near=0.5;dirLight.shadow.camera.far=30;
  dirLight.shadow.camera.left=-10;dirLight.shadow.camera.right=10;
  dirLight.shadow.camera.top=10;dirLight.shadow.camera.bottom=-10;
  scene.add(dirLight);
  const pl1=new THREE.PointLight(0x00e5a0,0.4,15);pl1.position.set(-3,5,3);scene.add(pl1);
  const pl2=new THREE.PointLight(0x5b7fff,0.3,15);pl2.position.set(3,3,-3);scene.add(pl2);

  // ── Materials ──
  const matBase=new THREE.MeshStandardMaterial({color:0x1a1a28,metalness:0.8,roughness:0.3});
  const matLink=new THREE.MeshStandardMaterial({color:0x1e1e2e,metalness:0.6,roughness:0.4});
  const matJ1=new THREE.MeshStandardMaterial({color:0x00e5a0,metalness:0.3,roughness:0.5,emissive:0x00e5a0,emissiveIntensity:0.3});
  const matJ2=new THREE.MeshStandardMaterial({color:0x5b7fff,metalness:0.3,roughness:0.5,emissive:0x5b7fff,emissiveIntensity:0.3});
  const matJ3=new THREE.MeshStandardMaterial({color:0xff6b6b,metalness:0.3,roughness:0.5,emissive:0xff6b6b,emissiveIntensity:0.3});
  const matEE=new THREE.MeshStandardMaterial({color:0x00e5a0,metalness:0.2,roughness:0.5,emissive:0x00e5a0,emissiveIntensity:0.5});

  // ── Ground + grid ──
  const groundGeo=new THREE.PlaneGeometry(40,40);
  const groundMat=new THREE.MeshStandardMaterial({color:0x0e0e16,metalness:0.9,roughness:0.4});
  ground=new THREE.Mesh(groundGeo,groundMat);
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  scene.add(new THREE.GridHelper(20,40,0x1a1a28,0x14141e));

  // Workspace ring
  const wsGeo=new THREE.RingGeometry(L1+L2+L3-0.1,L1+L2+L3+0.02,128);
  const wsMat=new THREE.MeshBasicMaterial({color:0x00e5a0,opacity:0.08,transparent:true,side:THREE.DoubleSide});
  const wsRing=new THREE.Mesh(wsGeo,wsMat);
  wsRing.rotation.x=-Math.PI/2;wsRing.position.y=0.01;scene.add(wsRing);

  // ── Robot arm hierarchy ──
  const baseMesh=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,BASE_HEIGHT,32),matBase);
  baseMesh.position.y=BASE_HEIGHT/2;baseMesh.castShadow=true;scene.add(baseMesh);

  joint1Pivot=new THREE.Group();joint1Pivot.position.y=BASE_HEIGHT;scene.add(joint1Pivot);
  const j1Mesh=new THREE.Mesh(new THREE.SphereGeometry(0.22,32,32),matJ1);j1Mesh.castShadow=true;joint1Pivot.add(j1Mesh);
  const link1=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,L1,16),matLink);link1.position.y=L1/2;link1.castShadow=true;joint1Pivot.add(link1);

  joint2Pivot=new THREE.Group();joint2Pivot.position.y=L1;joint1Pivot.add(joint2Pivot);
  const j2Mesh=new THREE.Mesh(new THREE.SphereGeometry(0.18,32,32),matJ2);j2Mesh.castShadow=true;joint2Pivot.add(j2Mesh);
  const link2=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,L2,16),matLink);link2.position.y=L2/2;link2.castShadow=true;joint2Pivot.add(link2);

  joint3Pivot=new THREE.Group();joint3Pivot.position.y=L2;joint2Pivot.add(joint3Pivot);
  const j3Mesh=new THREE.Mesh(new THREE.SphereGeometry(0.14,32,32),matJ3);j3Mesh.castShadow=true;joint3Pivot.add(j3Mesh);
  const link3=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.04,L3,16),matLink);link3.position.y=L3/2;link3.castShadow=true;joint3Pivot.add(link3);

  eeMesh=new THREE.Mesh(new THREE.SphereGeometry(0.12,32,32),matEE);eeMesh.position.y=L3;eeMesh.castShadow=true;joint3Pivot.add(eeMesh);
  const eeRingGeo=new THREE.RingGeometry(0.15,0.22,32);
  const eeRingMat=new THREE.MeshBasicMaterial({color:0x00e5a0,opacity:0.3,transparent:true,side:THREE.DoubleSide});
  eeRing=new THREE.Mesh(eeRingGeo,eeRingMat);eeRing.position.y=L3;joint3Pivot.add(eeRing);

  // ── IK target marker ──
  targetMesh=new THREE.Mesh(new THREE.SphereGeometry(0.15,16,16),new THREE.MeshBasicMaterial({color:0xff6b6b,opacity:0.6,transparent:true}));
  targetMesh.visible=false;scene.add(targetMesh);
  targetRing=new THREE.Mesh(new THREE.RingGeometry(0.2,0.35,32),new THREE.MeshBasicMaterial({color:0xff6b6b,opacity:0.25,transparent:true,side:THREE.DoubleSide}));
  targetRing.rotation.x=-Math.PI/2;targetRing.visible=false;scene.add(targetRing);

  // ── Trace ──
  tracePositions=new Float32Array(MAX_TRACE*3);
  traceGeo=new THREE.BufferGeometry();
  traceGeo.setAttribute('position',new THREE.BufferAttribute(tracePositions,3));
  const traceLine=new THREE.Line(traceGeo,new THREE.LineBasicMaterial({color:0x00e5a0,opacity:0.5,transparent:true}));
  scene.add(traceLine);
  traceCount=0;

  function addTracePoint(pos){
    if(traceCount<MAX_TRACE){
      tracePositions[traceCount*3]=pos.x;tracePositions[traceCount*3+1]=pos.y;tracePositions[traceCount*3+2]=pos.z;
      traceCount++;traceGeo.setDrawRange(0,traceCount);
    }else{
      for(let i=0;i<(MAX_TRACE-1)*3;i++)tracePositions[i]=tracePositions[i+3];
      tracePositions[(MAX_TRACE-1)*3]=pos.x;tracePositions[(MAX_TRACE-1)*3+1]=pos.y;tracePositions[(MAX_TRACE-1)*3+2]=pos.z;
    }
    traceGeo.attributes.position.needsUpdate=true;
  }

  // ── FK update ──
  function updateArm(){
    joint1Pivot.rotation.y=j1;
    joint2Pivot.rotation.z=j2;
    joint3Pivot.rotation.z=j3;
    const eeWorld=new THREE.Vector3();eeMesh.getWorldPosition(eeWorld);
    $('ra-ee-x').textContent=eeWorld.x.toFixed(2);
    $('ra-ee-y').textContent=eeWorld.y.toFixed(2);
    $('ra-ee-z').textContent=eeWorld.z.toFixed(2);
    $('ra-ee-r').textContent=Math.sqrt(eeWorld.x*eeWorld.x+eeWorld.z*eeWorld.z).toFixed(2);
    const t=Date.now()*0.003;
    eeRing.scale.setScalar(1+0.15*Math.sin(t));
    eeRing.material.opacity=0.2+0.15*Math.sin(t);
    eeRing.lookAt(camera.position);
    addTracePoint(eeWorld);
  }

  // ── IK solver ──
  function solveIK(tx,ty,tz){
    const baseAngle=Math.atan2(tx,tz);
    const r=Math.sqrt(tx*tx+tz*tz);
    const h=ty-BASE_HEIGHT;
    const effL2=L2+L3;
    const dist=Math.sqrt(r*r+h*h);
    const maxReach=L1+effL2,minReach=Math.abs(L1-effL2);
    if(dist>maxReach||dist<minReach){
      const angle=Math.atan2(h,r);
      j1=baseAngle;j2=Math.PI/2-angle;j3=0;
      syncSliders();return;
    }
    const cosJ2=(L1*L1+effL2*effL2-dist*dist)/(2*L1*effL2);
    const elbowAngle=Math.acos(Math.max(-1,Math.min(1,cosJ2)));
    const cosAlpha=(L1*L1+dist*dist-effL2*effL2)/(2*L1*dist);
    const alpha=Math.acos(Math.max(-1,Math.min(1,cosAlpha)));
    const beta=Math.atan2(h,r);
    j1=baseAngle;
    j2=-(Math.PI/2-beta-alpha);
    j3=-(Math.PI-elbowAngle);
    syncSliders();
  }

  function syncSliders(){
    const toDeg=r=>Math.round(r*180/Math.PI);
    $('ra-s1').value=toDeg(j1);$('ra-v1').textContent=toDeg(j1)+'°';
    $('ra-s2').value=toDeg(j2);$('ra-v2').textContent=toDeg(j2)+'°';
    $('ra-s3').value=toDeg(j3);$('ra-v3').textContent=toDeg(j3)+'°';
  }

  // ── Slider events ──
  function hookSlider(sId,vId,setter){
    const el=$(sId);
    el.addEventListener('input',()=>{
      const deg=parseFloat(el.value);
      setter(deg*Math.PI/180);
      $(vId).textContent=Math.round(deg)+'°';
    });
  }
  hookSlider('ra-s1','ra-v1',v=>{j1=v});
  hookSlider('ra-s2','ra-v2',v=>{j2=v});
  hookSlider('ra-s3','ra-v3',v=>{j3=v});

  // ── Mode toggle ──
  container.querySelectorAll('#ra-mode button').forEach(b=>b.addEventListener('click',()=>{
    container.querySelectorAll('#ra-mode button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    mode=b.dataset.m;
    $('ra-ik-hint').hidden=mode!=='ik';
    targetMesh.visible=mode==='ik';
    targetRing.visible=mode==='ik';
  }));

  // ── Buttons ──
  $('ra-reset').addEventListener('click',()=>{
    j1=0;j2=Math.PI/4;j3=-Math.PI/6;animating=false;syncSliders();
  });
  $('ra-clear').addEventListener('click',()=>{traceCount=0;traceGeo.setDrawRange(0,0)});
  $('ra-anim').addEventListener('click',()=>{animating=!animating});

  // ── Mouse: camera orbit + IK click ──
  const raycaster=new THREE.Raycaster();
  const mouse=new THREE.Vector2();

  renderer.domElement.addEventListener('mousedown',e=>{
    if((e.button===0&&mode==='fk')||e.button===2){
      isDragging=true;prevMouseX=e.clientX;prevMouseY=e.clientY;
    }
  });
  renderer.domElement.addEventListener('mousemove',e=>{
    if(!isDragging)return;
    camTheta-=(e.clientX-prevMouseX)*0.005;
    camPhi=Math.max(0.3,Math.min(Math.PI/2-0.05,camPhi+(e.clientY-prevMouseY)*0.005));
    prevMouseX=e.clientX;prevMouseY=e.clientY;
  });
  renderer.domElement.addEventListener('mouseup',()=>{isDragging=false});
  renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
  renderer.domElement.addEventListener('wheel',e=>{
    camRadius=Math.max(4,Math.min(18,camRadius+e.deltaY*0.01));
  });

  renderer.domElement.addEventListener('click',e=>{
    if(mode!=='ik')return;
    const rect=renderer.domElement.getBoundingClientRect();
    mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
    mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(mouse,camera);
    const intersects=raycaster.intersectObject(ground);
    if(intersects.length>0){
      const pt=intersects[0].point;
      targetMesh.position.set(pt.x,1.5,pt.z);
      targetRing.position.set(pt.x,0.02,pt.z);
      targetMesh.visible=true;targetRing.visible=true;
      solveIK(pt.x,1.5,pt.z);
    }
  });

  // ── Resize ──
  ro=new ResizeObserver(()=>{
    const w=wrap.clientWidth,h=wrap.clientHeight;
    if(w>0&&h>0){
      camera.aspect=w/h;camera.updateProjectionMatrix();
      renderer.setSize(w,h);
    }
  });
  ro.observe(wrap);

  // ── Render loop ──
  syncSliders();

  function loop(){
    raf=requestAnimationFrame(loop);
    camera.position.x=camRadius*Math.sin(camPhi)*Math.sin(camTheta);
    camera.position.y=camRadius*Math.cos(camPhi);
    camera.position.z=camRadius*Math.sin(camPhi)*Math.cos(camTheta);
    camera.lookAt(0,BASE_HEIGHT+L1*0.5,0);

    if(animating){
      animTime+=0.015;
      j1=Math.sin(animTime*0.7)*Math.PI*0.6;
      j2=Math.PI/4+Math.sin(animTime*1.1)*Math.PI/4;
      j3=-Math.PI/6+Math.sin(animTime*1.5)*Math.PI/5;
      syncSliders();
    }

    if(targetRing.visible)targetRing.rotation.z+=0.01;

    updateArm();
    renderer.render(scene,camera);
  }
  loop();
}

function cleanup(){
  if(raf){cancelAnimationFrame(raf);raf=null}
  if(ro){ro.disconnect();ro=null}
  if(renderer){
    renderer.dispose();
    renderer.domElement.remove();
    renderer=null;
  }
  if(scene){
    scene.traverse(obj=>{
      if(obj.geometry)obj.geometry.dispose();
      if(obj.material){
        if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose());
        else obj.material.dispose();
      }
    });
    scene=null;
  }
  camera=null;
  joint1Pivot=null;joint2Pivot=null;joint3Pivot=null;
  eeMesh=null;eeRing=null;targetMesh=null;targetRing=null;
  ground=null;traceGeo=null;tracePositions=null;traceCount=0;
  j1=0;j2=Math.PI/4;j3=-Math.PI/6;
  mode='fk';animating=false;animTime=0;
  isDragging=false;
}

ProjectRegistry.register('robot-arm',render,cleanup);
})();
