/** engine/vectorfield.js — Phase-portrait vector field renderer */
const VectorField={
  /**
   * Draw a 2D vector field for a PhysicsSystem slice.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} o
   *   sys        PhysicsSystem instance (used for .deriv and .nu)
   *   ctrl       controller with .compute(state) or null
   *   ctrlMode   'lqr'|'pid'|'none'
   *   ref        reference state (for PID: ref[pidIdx])
   *   pidIdx     index used for PID setpoint (e.g. 0 for theta1)
   *   axisX,axisY  state indices for the two plotted axes
   *   rangeX,rangeY  [min,max] for each axis
   *   fixedState base state (other dims fixed here)
   *   nx,ny      grid resolution
   *   rect       {x,y,w,h} pixel region
   *   dark       boolean
   */
  draw(ctx,o){
    const{sys,ctrl,ctrlMode,ref,pidIdx,axisX,axisY,rangeX,rangeY,fixedState,nx,ny,rect,dark}=o;
    const dx=(rangeX[1]-rangeX[0])/nx,dy=(rangeY[1]-rangeY[0])/ny;
    const scX=rect.w/(rangeX[1]-rangeX[0]),scY=rect.h/(rangeY[1]-rangeY[0]);
    const arrows=[];let maxMag=0;
    for(let i=0;i<nx;i++){for(let j=0;j<ny;j++){
      const sx=rangeX[0]+(i+.5)*dx,sy=rangeY[0]+(j+.5)*dy;
      const state=fixedState.slice();state[axisX]=sx;state[axisY]=sy;
      let u=Array(sys.nu).fill(0);
      if(ctrlMode==='lqr'&&ctrl&&ctrl.ok)u=ctrl.compute(state);
      else if(ctrlMode==='pid'&&ctrl&&ctrl.compute){
        const sp=ref?ref[pidIdx??0]:0;
        u=[ctrl.compute(sp,state[pidIdx??0],sys.dt)];
      }
      const oldTau=sys.tau;sys.tau=u;
      const d=sys.deriv(0,state);
      sys.tau=oldTau;
      const vx=d[axisX],vy=d[axisY],mag=Math.sqrt(vx*vx+vy*vy);
      if(mag>maxMag)maxMag=mag;
      arrows.push({sx,sy,vx,vy,mag});
    }}
    if(maxMag<1e-12)return;
    const aLen=Math.min(rect.w/nx,rect.h/ny)*.42;
    ctx.save();
    for(const a of arrows){
      if(a.mag<1e-10)continue;
      const px=rect.x+(a.sx-rangeX[0])*scX;
      const py=rect.y+rect.h-(a.sy-rangeY[0])*scY;
      const norm=Math.min(a.mag/maxMag,1);
      const len=aLen*(.25+.75*norm);
      const ang=Math.atan2(-a.vy,a.vx);
      const alpha=.15+.55*norm;
      ctx.strokeStyle=dark?`rgba(129,140,248,${alpha})`:`rgba(67,56,202,${alpha})`;
      ctx.lineWidth=1;
      const ex=px+len*Math.cos(ang),ey=py+len*Math.sin(ang);
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(ex,ey);ctx.stroke();
      const hl=len*.28,ha=.45;
      ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-hl*Math.cos(ang-ha),ey-hl*Math.sin(ang-ha));ctx.stroke();
      ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-hl*Math.cos(ang+ha),ey-hl*Math.sin(ang+ha));ctx.stroke();
    }
    ctx.restore();
  },

  /** Draw axis labels and ticks */
  drawAxes(ctx,o){
    const{rangeX,rangeY,rect,dark,labelX,labelY}=o;
    const scX=rect.w/(rangeX[1]-rangeX[0]),scY=rect.h/(rangeY[1]-rangeY[0]);
    ctx.save();
    ctx.font='10px "Outfit",sans-serif';
    ctx.fillStyle=dark?'#78716c':'#a8a29e';
    ctx.strokeStyle=dark?'#262626':'#e7e5e4';ctx.lineWidth=.5;
    // X ticks
    const xStep=VectorField._tickStep(rangeX[0],rangeX[1],6);
    for(let v=Math.ceil(rangeX[0]/xStep)*xStep;v<=rangeX[1];v+=xStep){
      const px=rect.x+(v-rangeX[0])*scX;
      ctx.beginPath();ctx.moveTo(px,rect.y);ctx.lineTo(px,rect.y+rect.h);ctx.stroke();
      ctx.textAlign='center';ctx.fillText(v.toFixed(1),px,rect.y+rect.h+12);
    }
    // Y ticks
    const yStep=VectorField._tickStep(rangeY[0],rangeY[1],5);
    for(let v=Math.ceil(rangeY[0]/yStep)*yStep;v<=rangeY[1];v+=yStep){
      const py=rect.y+rect.h-(v-rangeY[0])*scY;
      ctx.beginPath();ctx.moveTo(rect.x,py);ctx.lineTo(rect.x+rect.w,py);ctx.stroke();
      ctx.textAlign='right';ctx.fillText(v.toFixed(1),rect.x-4,py+3);
    }
    // Labels
    if(labelX){ctx.textAlign='center';ctx.fillText(labelX,rect.x+rect.w/2,rect.y+rect.h+24)}
    if(labelY){ctx.save();ctx.translate(rect.x-24,rect.y+rect.h/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText(labelY,0,0);ctx.restore()}
    ctx.restore();
  },

  _tickStep(lo,hi,target){
    const range=hi-lo,raw=range/target,mag=Math.pow(10,Math.floor(Math.log10(raw)));
    const opts=[mag,2*mag,5*mag,10*mag];
    return opts.find(s=>range/s<=target*1.5)||opts[opts.length-1];
  }
};
window.VectorField=VectorField;
