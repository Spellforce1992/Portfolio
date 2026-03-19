class PIDController{constructor(c={}){this.kp=c.kp??1;this.ki=c.ki??0;this.kd=c.kd??0;this.min=c.min??-Infinity;this.max=c.max??Infinity;this.I=0;this.ep=null}
compute(sp,pv,dt){const e=sp-pv;const P=this.kp*e;this.I=Math.max(-100,Math.min(100,this.I+e*dt));const I=this.ki*this.I;let D=0;if(this.ep!==null&&dt>0)D=this.kd*(e-this.ep)/dt;this.ep=e;let u=Math.max(this.min,Math.min(this.max,P+I+D));if(u===this.max||u===this.min)this.I-=e*dt;return u}
reset(){this.I=0;this.ep=null}}
window.PIDController=PIDController;