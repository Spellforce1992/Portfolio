const PROJECT_CATEGORIES={
  control:{label:'Control Systems',color:'var(--cat-control)'},
  software:{label:'Software',color:'var(--cat-software)'},
  math:{label:'Math & Algorithms',color:'var(--cat-math)'},
  data:{label:'Data',color:'var(--cat-data)'},
};
const PROJECTS=[
  {id:'double-pendulum',title:'Double Pendulum Control',subtitle:'From chaos to stability',category:'control',status:'live',
    tags:['Lagrangian','RK4','LQR','PID','State-Space'],
    desc:'Explore deterministic chaos with a Lagrangian simulation using distributed mass. Then design a controller step by step: linearize around the target, check controllability, solve the Riccati equation, and simulate the closed-loop response with performance metrics.',
    short:'Chaos → linearize → LQR → closed-loop control',render:null,cleanup:null},
  {id:'cart-pole',title:'Cart-Pole Balancer',subtitle:'Balance the inverted pendulum',category:'control',status:'live',
    tags:['LQR','PID','Inverted Pendulum','Classic Benchmark'],
    desc:'The textbook inverted pendulum problem. Apply PID or LQR to balance a pole on a moving cart, with real-time performance metrics, adjustable physics, and a guided controller design walkthrough.',
    short:'Classic inverted pendulum with PID & LQR',render:null,cleanup:null},
  {id:'robot-arm',title:'3-DOF Robot Arm',subtitle:'Kinematics + trajectory control',category:'control',status:'planned',
    tags:['Three.js','FK/IK','Computed Torque','3D'],desc:'Interactive 3D robot arm with forward and inverse kinematics, physics-based dynamics, and trajectory tracking.',short:'3D arm with FK/IK and trajectory tracking',render:null,cleanup:null},
  {id:'fusion-demo',title:'Isotope Ratio Control',subtitle:'Inspired by DIFFER graduation work',category:'control',status:'planned',
    tags:['Model-Based','Feedforward','LQR','MIMO'],desc:'Simplified demo of hydrogen isotope ratio control in a tokamak fuel subsystem.',short:'MIMO control for fusion fuel processing',render:null,cleanup:null},
  {id:'gradient-descent',title:'Optimization Visualizer',subtitle:'SGD, Adam on loss surfaces',category:'math',status:'planned',
    tags:['Optimization','3D','Learning Rate'],desc:'Watch optimizers navigate loss surfaces. Compare SGD, momentum, Adam.',short:'Compare optimizers on 3D loss landscapes',render:null,cleanup:null},
  {id:'pathfinding',title:'Pathfinding Algorithms',subtitle:'A*, Dijkstra, BFS compared',category:'data',status:'planned',
    tags:['A*','Dijkstra','Visualization'],desc:'Draw obstacles and watch pathfinding algorithms race.',short:'Visual comparison of graph search algorithms',render:null,cleanup:null},
  {id:'grid-shift',title:'Cyclic Grid Solver',subtitle:'Modular arithmetic meets combinatorics',category:'math',status:'planned',
    tags:['Backtracking','Modular Arithmetic','Combinatorics','Pruning'],
    desc:'A combinatorial puzzle where placing shapes on a grid cycles covered cells through states (mod N). Features a backtracking solver with pruning that finds solutions algorithmically, with step-by-step visualization of the search process.',
    short:'Solve modular grid puzzles with backtracking',render:null,cleanup:null},
];
const EXTERNAL_PROJECTS=[
  '../AI Factory Builder/portfolio.json',
];
const ProjectRegistry={
  getAll(){return PROJECTS},get(id){return PROJECTS.find(p=>p.id===id)},byCat(c){return PROJECTS.filter(p=>p.category===c)},cats(){return PROJECT_CATEGORIES},
  register(id,render,cleanup){const p=PROJECTS.find(x=>x.id===id);if(p){p.render=render;p.cleanup=cleanup;if(p.status==='planned')p.status='live'}},
  async loadExternal(){
    const results=await Promise.allSettled(EXTERNAL_PROJECTS.map(url=>fetch(url).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()})));
    for(const r of results){
      if(r.status==='fulfilled'){
        const p=r.value;
        const existing=PROJECTS.find(x=>x.id===p.id);
        if(existing){Object.assign(existing,p)}
        else{PROJECTS.push({...p,render:null,cleanup:null})}
      }
    }
  }
};
window.PROJECTS=PROJECTS;window.PROJECT_CATEGORIES=PROJECT_CATEGORIES;window.ProjectRegistry=ProjectRegistry;
