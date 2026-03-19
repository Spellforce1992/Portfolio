class Router{constructor(el){this.app=el;this.routes=[];this.cleanup=null;window.addEventListener('hashchange',()=>this.resolve())}
on(p,h){const names=[];const re=p.replace(/:(\w+)/g,(_,n)=>{names.push(n);return'([^/]+)'});this.routes.push({re:new RegExp('^'+re+'$'),names,h});return this}
resolve(){const hash=(window.location.hash||'#/').replace('#','')||'/';if(this.cleanup){this.cleanup();this.cleanup=null}
for(const r of this.routes){const m=hash.match(r.re);if(m){const p={};r.names.forEach((n,i)=>p[n]=m[i+1]);this.app.innerHTML='';const d=document.createElement('div');d.className='page-enter';this.app.appendChild(d);r.h(d,p);this._nav(hash);return}}
this.app.innerHTML='<div class="page-enter" style="padding-top:60px;text-align:center"><h1>404</h1><p><a href="#/">Go home</a></p></div>';this._nav('')}
_nav(h){document.querySelectorAll('.nav-links a').forEach(a=>{const hr=a.getAttribute('href').replace('#','');a.classList.toggle('active',h===hr||(h.startsWith(hr+'/')&&hr!=='/')||(h==='/'&&hr==='/'))
})}setCleanup(fn){this.cleanup=fn}start(){this.resolve()}}
window.Router=Router;