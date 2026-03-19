const LQR={
  care(A,B,Q,R){
    const n=A.length,Ri=numeric.inv(R),BT=numeric.transpose(B),S=numeric.dot(B,numeric.dot(Ri,BT));
    const AT=numeric.transpose(A);
    const H=[];
    for(let i=0;i<n;i++){const r=[];for(let j=0;j<n;j++)r.push(A[i][j]);for(let j=0;j<n;j++)r.push(-S[i][j]);H.push(r)}
    for(let i=0;i<n;i++){const r=[];for(let j=0;j<n;j++)r.push(-Q[i][j]);for(let j=0;j<n;j++)r.push(-AT[i][j]);H.push(r)}
    try{
      const eig=numeric.eig(H),lam=eig.lambda.x,E=eig.E.x,si=[];
      for(let i=0;i<2*n;i++)if(lam[i]<0)si.push(i);
      if(si.length>=n){
        const U1=[],U2=[];
        for(let i=0;i<n;i++){const r1=[],r2=[];for(let k=0;k<n;k++){r1.push(E[i][si[k]]);r2.push(E[i+n][si[k]])}U1.push(r1);U2.push(r2)}
        const P=numeric.dot(U2,numeric.inv(U1));
        return numeric.mul(.5,numeric.add(P,numeric.transpose(P)));
      }
    }catch(e){}
    return this._iter(A,B,Q,R);
  },
  _iter(A,B,Q,R,mx=300){
    const n=A.length,S=numeric.dot(B,numeric.dot(numeric.inv(R),numeric.transpose(B)));
    let P=numeric.identity(n);
    for(let i=0;i<mx;i++){
      const Pn=numeric.add(numeric.add(numeric.dot(numeric.transpose(A),P),numeric.dot(P,A)),numeric.sub(Q,numeric.dot(P,numeric.dot(S,P))));
      const bl=numeric.add(numeric.mul(.5,Pn),numeric.mul(.5,P));
      if(numeric.norm2(numeric.sub(bl,P))<1e-10){P=bl;break}P=bl;
    }
    return numeric.mul(.5,numeric.add(P,numeric.transpose(P)));
  },
  gain(A,B,Q,R){
    const P=this.care(A,B,Q,R);
    return{K:numeric.dot(numeric.dot(numeric.inv(R),numeric.transpose(B)),P),P};
  },
  apply(K,x,ref){
    const e=x.map((v,i)=>v-(ref[i]||0)),u=numeric.dot(K,e);
    return(Array.isArray(u)?u:[u]).map(v=>-v);
  }
};
class LQRController{
  constructor(sys,Q,R){this.sys=sys;this.Q=Q;this.R=R;this.K=null;this.ref=null;this.ok=false;this.min=-Infinity;this.max=Infinity}
  design(eq){const{A,B}=this.sys.linearize(eq);const{K}=LQR.gain(A,B,this.Q,this.R);this.K=K;this.ref=eq;this.ok=true}
  compute(x){if(!this.ok)return[0];return LQR.apply(this.K,x,this.ref).map(v=>Math.max(this.min,Math.min(this.max,v)))}
}
window.LQR=LQR;window.LQRController=LQRController;