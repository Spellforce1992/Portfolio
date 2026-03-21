/** engine/physics.js — Lagrangian rigid-body dynamics */

class PhysicsSystem {
  constructor(c={}){this.g=c.gravity??9.81;this.dt=c.dt??1/60;this.substeps=c.substeps??20;this.time=0;this.state=[];this.tau=[];this.friction=c.friction??0;
    this.hist={t:[],s:[],u:[],e:[],max:c.histLen??600}}
  deriv(t,s){throw new Error('implement')}
  getPos(s){return[]}
  getEnergy(s){return{T:0,V:0,E:0}}
  linearize(eq){return{A:[],B:[]}}
  get nu(){return 0}
  step(u=null){
    this.tau=u||Array(this.nu).fill(0);
    this.state=RK4.integrate((t,y)=>this.deriv(t,y),this.time,this.state,this.dt,this.substeps);
    this.clamp();this.time+=this.dt;
    const h=this.hist;h.t.push(this.time);h.s.push(this.state.slice());h.u.push(this.tau.slice());h.e.push(this.getEnergy(this.state));
    if(h.t.length>h.max){h.t.shift();h.s.shift();h.u.shift();h.e.shift()}}
  clamp(){}
  reset(s0){this.state=s0.slice();this.time=0;this.tau=[];this.hist={t:[],s:[],u:[],e:[],max:this.hist.max}}
}

class DoublePendulum extends PhysicsSystem {
  constructor(c={}){
    super(c);
    this.m1=c.m1??1;this.m2=c.m2??1;this.L1=c.L1??1;this.L2=c.L2??.8;
    this.b1=c.b1??this.friction;this.b2=c.b2??this.friction;
    this.state=c.s0??[Math.PI*.6,0,Math.PI*.6,0];
  }
  get nu(){return 1}

  deriv(t,s){
    const[th1,w1,th2,w2]=s,{m1,m2,L1,L2,g,b1,b2}=this;
    const d=th1-th2,sd=Math.sin(d),cd=Math.cos(d);
    const a11=(m1/3+m2)*L1*L1,a12=.5*m2*L1*L2*cd,a22=(m2/3)*L2*L2;
    const tau=this.tau[0]??0;
    const r1=-.5*m2*L1*L2*w2*w2*sd-(m1/2+m2)*g*L1*Math.sin(th1)-b1*w1+tau;
    const r2=.5*m2*L1*L2*w1*w1*sd-(m2/2)*g*L2*Math.sin(th2)-b2*w2;
    const D=a11*a22-a12*a12;
    return[w1,(a22*r1-a12*r2)/D,w2,(a11*r2-a12*r1)/D];
  }

  getPos(s){
    const[th1,,th2]=s,{L1,L2}=this;
    const x1=L1*Math.sin(th1),y1=-L1*Math.cos(th1);
    return[{x:0,y:0},{x:x1,y:y1},{x:x1+L2*Math.sin(th2),y:y1-L2*Math.cos(th2)}];
  }

  getEnergy(s){
    const[th1,w1,th2,w2]=s,{m1,m2,L1,L2,g}=this;
    const T=.5*(m1/3)*L1*L1*w1*w1+.5*m2*((L1*w1*Math.cos(th1)+.5*L2*w2*Math.cos(th2))**2+(L1*w1*Math.sin(th1)+.5*L2*w2*Math.sin(th2))**2)+.5*(m2/12)*L2*L2*w2*w2;
    const V=-m1*g*(L1/2)*Math.cos(th1)-m2*g*(L1*Math.cos(th1)+(L2/2)*Math.cos(th2));
    return{T,V,E:T+V};
  }

  /** Linearize around arbitrary equilibrium [th1_eq, 0, th2_eq, 0] */
  linearize(eq=[0,0,0,0]){
    const{m1,m2,L1,L2,g,b1,b2}=this;
    const th1e=eq[0],th2e=eq[2];
    const de=th1e-th2e;
    const cde=Math.cos(de);  // cos(th1_eq - th2_eq)
    // At equilibrium: for downward (0,0) cde=1; for upright (π,π) cde=1 too since π-π=0
    const a11=(m1/3+m2)*L1*L1, a12=.5*m2*L1*L2*cde, a22=(m2/3)*L2*L2;
    const D=a11*a22-a12*a12;
    // Gravity linearization: d/dθ[-mg*L*sin(θ)] at θ_eq = -mg*L*cos(θ_eq)
    const g1=-(m1/2+m2)*g*L1*Math.cos(th1e);
    const g2=-(m2/2)*g*L2*Math.cos(th2e);
    return{
      A:[[0,1,0,0],[a22*g1/D,-a22*b1/D,-a12*g2/D,a12*b2/D],[0,0,0,1],[-a12*g1/D,a12*b1/D,a11*g2/D,-a11*b2/D]],
      B:[[0],[a22/D],[0],[-a12/D]]
    };
  }
}

class CartPole extends PhysicsSystem {
  constructor(c={}){
    super(c);
    this.M=c.M??1;this.m=c.m??.3;this.L=c.L??.6;this.b=c.b??this.friction;this.bp=c.bp??.01;
    this.xMin=c.xMin??-3;this.xMax=c.xMax??3;
    // θ=0 is up (inverted), measured from vertical
    this.state=c.s0??[0,0,.15,0];
  }
  get nu(){return 1}

  deriv(t,s){
    const[x,xd,th,w]=s,{M,m,L,g,b,bp}=this;
    const F=this.tau[0]??0,sn=Math.sin(th),cs=Math.cos(th),den=M+m-m*cs*cs;
    const xdd=(F-b*xd+m*L*w*w*sn-m*g*sn*cs+bp*w*cs/L)/den;
    const thdd=(-F*cs+b*xd*cs-m*L*w*w*sn*cs+(M+m)*g*sn-bp*w*(M+m)/(m*L))/(L*den);
    return[xd,xdd,w,thdd];
  }

  clamp(){
    if(this.state[0]<this.xMin){this.state[0]=this.xMin;this.state[1]=Math.max(0,this.state[1])}
    if(this.state[0]>this.xMax){this.state[0]=this.xMax;this.state[1]=Math.min(0,this.state[1])}
  }

  getPos(s){
    const[x,,th]=s,{L}=this;
    return[{x,y:0},{x:x+2*L*Math.sin(th),y:2*L*Math.cos(th)}];
  }

  getEnergy(s){
    const[x,xd,th,w]=s,{M,m,L,g}=this;
    const T=.5*M*xd*xd+.5*m*((xd+L*w*Math.cos(th))**2+(L*w*Math.sin(th))**2);
    const V=m*g*2*L*Math.cos(th);
    return{T,V,E:T+V};
  }

  /** Linearize around upright (θ=0) */
  linearize(eq=[0,0,0,0]){
    const{M,m,L,g,b,bp}=this,d=M;
    return{
      A:[[0,1,0,0],[0,-b/d,-m*g/d,bp/(d*L)],[0,0,0,1],[0,b/(L*d),(M+m)*g/(L*d),-(M+m)*bp/(m*L*L*d)]],
      B:[[0],[1/d],[0],[-1/(L*d)]]
    };
  }
}

window.PhysicsSystem=PhysicsSystem;window.DoublePendulum=DoublePendulum;window.CartPole=CartPole;
