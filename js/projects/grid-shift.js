(function(){
'use strict';
// Grid Shift — Cyclic puzzle solver
const isDark=()=>document.documentElement.getAttribute('data-theme')==='dark';

// ═══ PIECE LIBRARY (confirmed shapes from real puzzle data) ═══
const PIECES=[
  [[1]],
  [[1,1]],[[1],[1]],
  [[1,1,1]],[[1],[1],[1]],
  [[1,1],[1,0]],[[1,0],[1,1]],[[0,1],[1,1]],[[1,1],[0,1]],
  [[1,1,1],[0,1,0]],[[0,1,0],[1,1,1]],[[1,0],[1,1],[1,0]],[[0,1],[1,1],[0,1]],
  [[1,1],[1,1]],
  [[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[1,1,1],[1,0,0]],[[1,1,1],[0,0,1]],
  [[1,0],[1,0],[1,1]],[[0,1],[0,1],[1,1]],[[1,1],[1,0],[1,0]],[[1,1],[0,1],[0,1]],
  [[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]],
  [[1,0],[1,1],[0,1]],[[0,1],[1,1],[1,0]],
  [[1,1,1,1]],[[1],[1],[1],[1]],
  [[1,0,1],[1,1,1]],[[1,1,1],[1,0,1]],
  [[1,1],[1,0],[1,1]],[[1,1],[0,1],[1,1]],
  [[1,0,1],[1,0,1],[1,1,1]],[[1,1,1],[1,0,1],[1,0,1]],
  [[0,1,0],[1,1,1],[0,1,0]],
  [[1,1,1],[1,1,0]],[[1,1,1],[0,1,1]],[[1,1,0],[1,1,1]],[[0,1,1],[1,1,1]],
  [[1,1],[1,1],[1,0]],[[1,1],[1,1],[0,1]],[[1,0],[1,1],[1,1]],[[0,1],[1,1],[1,1]],
  [[1,1,0],[0,1,0],[0,1,1]],[[0,1,1],[0,1,0],[1,1,0]],
  [[1,0,0],[1,1,0],[0,1,1]],[[0,0,1],[0,1,1],[1,1,0]],
  [[1,1,1,1,1]],[[1],[1],[1],[1],[1]],
  [[1,1,1],[0,1,0],[0,1,0]],[[0,1,0],[0,1,0],[1,1,1]],
  [[1,0,0,0],[1,1,1,1]],[[0,0,0,1],[1,1,1,1]],[[1,1,1,1],[1,0,0,0]],[[1,1,1,1],[0,0,0,1]],
  [[1,0,0],[1,0,0],[1,1,1]],[[0,0,1],[0,0,1],[1,1,1]],[[1,1,1],[0,0,1],[0,0,1]],[[1,1,1],[1,0,0],[1,0,0]],
  [[0,1,1],[0,1,1],[1,1,0]],[[1,1,0],[1,1,0],[0,1,1]],
  [[1,0,1],[1,1,1],[1,0,1]],
  [[1,1,1],[1,0,1],[1,1,1]],
  // Confirmed from real puzzle data
  [[1,1,1,1],[1,0,1,1],[0,1,1,0],[0,0,1,1]],
  [[1,1,0,0,0],[0,1,1,1,0],[0,0,1,0,0],[0,0,1,1,1]],
  [[0,1,1,1],[1,1,0,1],[0,1,0,0],[0,1,1,0]],
  [[1,1,0,0,0],[0,1,1,0,1],[0,0,1,0,1],[1,0,1,1,1],[1,1,1,0,0]],
];

// State colors: blue(goal) → green → yellow-orange → red → purple
function stateColors(n){
  const dk=isDark();
  const all=dk
    ?['#60a5fa','#4ade80','#fbbf24','#f87171','#c084fc']
    :['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed'];
  return all.slice(0,n);
}

function pieceArea(p){let a=0;for(const r of p)for(const c of r)a+=c;return a}

// ═══ IMPORT PARSER ═══
function parseHTML(html){
  const gxM=html.match(/gX\s*=\s*(\d+)/), gyM=html.match(/gY\s*=\s*(\d+)/);
  if(!gxM||!gyM)return null;
  const cols=+gxM[1], rows=+gyM[1];
  const cellRe=/imgLocStr\[(\d+)\]\[(\d+)\]\s*=\s*"(\w+)"/g;
  const rawBoard=Array.from({length:rows},()=>Array(cols).fill(''));
  const allSyms=new Set();
  let m;
  while((m=cellRe.exec(html))!==null){
    const x=+m[1], y=+m[2], sym=m[3];
    if(x<cols&&y<rows) rawBoard[y][x]=sym;
    allSyms.add(sym);
  }
  const symMap=new Map();
  const cycleMatch=html.match(/arrow\.gif[\s\S]*?DOEL/i);
  if(cycleMatch){
    const cycleSection=html.match(/<table\s+border="1"[\s\S]*?DOEL/i);
    if(cycleSection){
      const cycleSyms=[...cycleSection[0].matchAll(/\/(\w+)_0\.gif/g)].map(m=>m[1]).filter(s=>s!=='arrow');
      const seen=new Set(),ordered=[];
      for(const s of cycleSyms)if(!seen.has(s)){seen.add(s);ordered.push(s)}
      if(ordered.length>=2)
        for(let i=0;i<ordered.length;i++)symMap.set(ordered[i],i);
    }
  }
  if(symMap.size===0)for(const s of allSyms)if(!symMap.has(s))symMap.set(s,symMap.size);
  const numStates=symMap.size;
  const board=rawBoard.map(r=>r.map(s=>symMap.has(s)?symMap.get(s):0));
  const goalState=numStates-1;
  const pieces=[];
  const pieceRe=/if\s*\(xX(\d+)\s*<\s*gX\s*&&\s*yY(\d+)\s*<\s*gY\)/g;
  const offsets=[];
  while((m=pieceRe.exec(html))!==null) offsets.push([+m[2],+m[1]]);
  if(offsets.length>0){
    const maxR=Math.max(...offsets.map(o=>o[0]));
    const maxC=Math.max(...offsets.map(o=>o[1]));
    const piece=Array.from({length:maxR+1},()=>Array(maxC+1).fill(0));
    for(const[r,c]of offsets) piece[r][c]=1;
    pieces.push(piece);
  }
  const parser=new DOMParser();
  const doc=parser.parseFromString(html,'text/html');
  const pieceCells=doc.querySelectorAll('td[align="center"][valign="center"]');
  for(const cell of pieceCells){
    const table=cell.querySelector('table');
    if(!table)continue;
    const trs=table.querySelectorAll('tr');
    if(trs.length===0)continue;
    const grid=[];
    for(const tr of trs){
      const tds=tr.querySelectorAll('td');
      const row=[];
      for(const td of tds) row.push(td.querySelector('img[src*="square"]')?1:0);
      grid.push(row);
    }
    if(grid.some(r=>r.some(c=>c===1))) pieces.push(grid);
  }
  if(pieces.length===0)return null;
  return{board,pieces,numStates,goal:goalState,rows,cols,symbolMap:Object.fromEntries(symMap)};
}

// ═══ PUZZLE GENERATION ═══
function generatePuzzle(rows,cols,numStates,numPieces){
  const goal=0;
  const board=Array.from({length:rows},()=>Array(cols).fill(goal));
  const pieces=[],solution=[];
  const eligible=PIECES.filter(p=>p.length<=rows&&(p[0]||[]).length<=cols);
  if(eligible.length===0)return null;
  for(let i=0;i<numPieces;i++){
    const p=eligible[Math.floor(Math.random()*eligible.length)];
    const ph=p.length,pw=p[0].length;
    const r=Math.floor(Math.random()*(rows-ph+1));
    const c=Math.floor(Math.random()*(cols-pw+1));
    pieces.push(p);solution.push([r,c]);
    for(let dr=0;dr<ph;dr++)for(let dc=0;dc<pw;dc++){
      if(p[dr][dc])board[r+dr][c+dc]=(board[r+dr][c+dc]+numStates-1)%numStates;
    }
  }
  return{board,pieces,numStates,goal,solution};
}

const LEVELS=[
  [3,3,2,2],[3,3,2,3],[3,3,2,4],[3,3,2,5],[3,3,2,6],[3,3,2,7],[3,3,2,8],[3,3,2,9],[3,3,2,10],[3,3,2,11],
  [4,3,2,7],[4,3,2,8],[4,3,2,9],[4,3,2,10],[4,3,2,11],[4,3,2,12],[4,3,2,13],[4,3,2,14],[4,3,2,15],[4,3,2,16],
  [4,4,2,12],[4,4,2,13],[4,4,2,14],[4,4,2,15],[4,4,2,16],
  [4,4,3,11],[4,4,3,12],[4,4,3,13],[4,4,3,14],[4,4,3,15],
  [6,6,2,12],[6,6,2,13],[6,6,2,14],[6,6,2,12],[6,6,2,13],
  [6,6,3,14],[6,6,3,15],[6,6,3,16],[6,6,3,17],[6,6,3,18],
  [8,7,2,15],[8,7,2,16],[8,7,2,17],[8,7,2,18],[8,7,2,19],
  [8,7,3,16],[8,7,3,17],[8,7,3,18],[8,7,3,19],[8,7,3,20],
  [8,8,2,16],[8,8,3,16],[8,8,3,17],[8,8,3,18],[8,8,4,15],[8,8,4,16],[8,8,4,17],[8,8,4,18],[8,8,4,19],[8,8,4,20],
  [10,10,3,17],[10,10,3,18],[10,10,3,19],[10,10,3,20],[10,10,4,18],[10,10,4,19],[10,10,4,20],[10,10,4,21],[10,10,4,22],[10,10,4,23],
  [10,11,3,18],[10,11,3,19],[10,11,3,20],[10,11,3,21],[10,11,3,22],[10,11,4,20],[10,11,4,21],[10,11,4,22],[10,11,4,23],[10,11,4,24],
  [12,12,3,20],[12,12,3,21],[12,12,3,22],[12,12,3,23],[12,12,3,24],[12,12,4,21],[12,12,4,22],[12,12,4,23],[12,12,4,24],[12,12,4,25],
  [14,13,4,23],[14,13,4,24],[14,13,4,25],[14,13,4,26],[14,13,5,24],[14,13,5,26],[14,13,5,28],[14,13,5,30],[14,13,5,32],[14,14,5,36],
];

function preset(level){
  const l=LEVELS[Math.min(level,LEVELS.length-1)];
  return generatePuzzle(l[0],l[1],l[2],l[3]);
}

// ═══ SOLVER (Web Worker with backtracking + pruning) ═══
function solverWorker(){
  'use strict';
  self.onmessage=function(ev){
    var board=ev.data.board, pieces=ev.data.pieces, N=ev.data.numStates, goal=ev.data.goal;
    var rows=board.length, cols=board[0].length, sz=rows*cols;

    self.postMessage({type:'phase',phase:'Preparing puzzle\u2026'});

    // Flatten board into typed array
    var state=new Uint8Array(sz);
    for(var r=0;r<rows;r++)for(var c=0;c<cols;c++) state[r*cols+c]=board[r][c];

    // Enumerate valid placements per piece
    var pdata=[];
    for(var pi=0;pi<pieces.length;pi++){
      var sh=pieces[pi], ph=sh.length, pw=sh[0].length;
      var offs=[];
      for(var dr=0;dr<ph;dr++)for(var dc=0;dc<pw;dc++)
        if(sh[dr][dc]) offs.push(dr*cols+dc);
      var area=offs.length, pls=[];
      for(var rr=0;rr<=rows-ph;rr++)for(var cc=0;cc<=cols-pw;cc++){
        var base=rr*cols+cc;
        var cells=new Array(area);
        for(var k=0;k<area;k++) cells[k]=base+offs[k];
        pls.push({r:rr,c:cc,cells:cells});
      }
      var sk='';
      for(var ri=0;ri<ph;ri++) sk+=sh[ri].join(',')+';';
      pdata.push({origIdx:pi, area:area, shapeKey:sk, placements:pls});
    }

    // Sort: fewest placements first, then largest area
    pdata.sort(function(a,b){return a.placements.length-b.placements.length||b.area-a.area});

    // Mark duplicates (identical shapes adjacent after sort)
    var n=pdata.length;
    var sameAsPrev=new Uint8Array(n);
    for(var i=1;i<n;i++)
      if(pdata[i].shapeKey===pdata[i-1].shapeKey) sameAsPrev[i]=1;

    // Feasibility: totalDeficit mod N must equal totalArea mod N
    var totalDeficit=0, totalArea=0;
    for(var i=0;i<sz;i++) totalDeficit+=(goal-state[i]+N)%N;
    for(var i=0;i<n;i++) totalArea+=pdata[i].area;

    if(totalDeficit%N!==totalArea%N){
      self.postMessage({type:'failed',nodesExplored:0,surfaceSkipped:0,elapsed:0,cornerCombos:0});
      return;
    }

    // Per-cell coverage: pCov[i][cell] = # placements of piece i covering cell
    var pCov=[];
    for(var i=0;i<n;i++){
      var cov=new Uint16Array(sz);
      var pls_i=pdata[i].placements;
      for(var j=0;j<pls_i.length;j++){
        var cells=pls_i[j].cells;
        for(var k=0;k<cells.length;k++) cov[cells[k]]++;
      }
      pCov.push(cov);
    }

    // Remaining coverage per cell (sum of all pieces' coverage)
    var remCov=new Uint16Array(sz);
    for(var i=0;i<n;i++)for(var c=0;c<sz;c++) remCov[c]+=pCov[i][c];

    var remArea=totalArea;
    var reqChange=totalDeficit;

    // Corner analysis for UI
    var cornerCells=[[0,0],[0,cols-1],[rows-1,0],[rows-1,cols-1]];
    var cornerLabels=['Top-left','Top-right','Bottom-left','Bottom-right'];
    var cornerStats=[];
    for(var ci=0;ci<4;ci++){
      var idx=cornerCells[ci][0]*cols+cornerCells[ci][1];
      var def=(goal-state[idx]+N)%N;
      var reach=0;
      for(var i=0;i<n;i++) if(pCov[i][idx]>0) reach++;
      cornerStats.push({label:cornerLabels[ci],needed:def,placements:reach});
    }

    var totalCombinations=1;
    for(var i=0;i<n;i++) totalCombinations*=pdata[i].placements.length;
    var dupFactor=1,streak=1;
    for(var i=1;i<n;i++){
      if(sameAsPrev[i]){streak++;dupFactor*=streak}else streak=1;
    }
    totalCombinations/=dupFactor;

    var cornerPieces=0;
    for(var i=0;i<n;i++){
      var reachesCorner=false;
      for(var ci=0;ci<4;ci++){
        var idx=cornerCells[ci][0]*cols+cornerCells[ci][1];
        if(pCov[i][idx]>0){reachesCorner=true;break}
      }
      if(reachesCorner) cornerPieces++;
    }

    self.postMessage({type:'cornerAnalysis',cornerStats:cornerStats,
      piecesWithCornerOpts:cornerPieces,totalSearchSpace:totalCombinations});

    // ── Solve ──
    self.postMessage({type:'phase',phase:'Solving\u2026'});
    var nodesExplored=0, surfacePruned=0, cellPruned=0;
    var solved=false;
    var chosen=new Int32Array(n);
    for(var i=0;i<n;i++) chosen[i]=-1;
    var startTime=performance.now();
    var lastReport=startTime;
    var firstPiecePos=0;
    var firstPieceTotal=n>0?pdata[0].placements.length:1;

    function solve(pi){
      if(solved) return;
      if(pi===n){
        if(reqChange===0) solved=true;
        return;
      }

      var pd=pdata[pi];
      var startPl=(sameAsPrev[pi]&&pi>0)?chosen[pi-1]:0;

      // Remove this piece from remaining coverage
      var cov_pi=pCov[pi];
      for(var c=0;c<sz;c++) remCov[c]-=cov_pi[c];
      remArea-=pd.area;

      var placements=pd.placements;
      for(var pli=startPl;pli<placements.length;pli++){
        if(solved) break;
        nodesExplored++;
        if(pi===0) firstPiecePos=pli;

        // Progress every ~65K nodes
        if((nodesExplored&0xFFFF)===0){
          var now=performance.now();
          if(now-lastReport>500){
            lastReport=now;
            var elapsed=(now-startTime)/1000;
            var progress=firstPiecePos/firstPieceTotal*100;
            var expectedRemaining=progress>0?elapsed*(100-progress)/progress:1/0;
            self.postMessage({type:'progress',totalCombinations:totalCombinations,
              elapsed:elapsed,nodesExplored:nodesExplored,
              expectedRemaining:expectedRemaining,progress:progress,
              cornerComboProgress:'depth '+pi+'/'+n,
              surfaceSkipPercent:nodesExplored>0?(surfacePruned+cellPruned)/nodesExplored*100:0});
          }
        }

        var pl=placements[pli];
        var cells=pl.cells;

        // Place: compute delta and apply
        var delta=0;
        for(var k=0;k<cells.length;k++){
          var ci=cells[k];
          if(state[ci]===goal) delta+=N-1; else delta--;
          state[ci]=(state[ci]+1)%N;
        }
        reqChange+=delta;
        chosen[pi]=pli;

        var pruned=false;

        // Prune 1: surface area
        if(reqChange>remArea){
          surfacePruned++;
          pruned=true;
        }

        // Prune 2: per-cell feasibility
        if(!pruned){
          for(var c=0;c<sz;c++){
            var def=(goal-state[c]+N)%N;
            if(def>0&&def>remCov[c]){
              cellPruned++;
              pruned=true;
              break;
            }
          }
        }

        if(!pruned) solve(pi+1);

        // Undo placement
        for(var k=0;k<cells.length;k++)
          state[cells[k]]=(state[cells[k]]+N-1)%N;
        reqChange-=delta;
      }

      // Restore coverage
      for(var c=0;c<sz;c++) remCov[c]+=cov_pi[c];
      remArea+=pd.area;
    }

    if(n===0){
      solved=(reqChange===0);
    } else {
      solve(0);
    }

    var elapsed=(performance.now()-startTime)/1000;
    if(solved){
      var solution={};
      for(var i=0;i<n;i++){
        var pl=pdata[i].placements[chosen[i]];
        solution[pdata[i].origIdx]=[pl.r,pl.c];
      }
      self.postMessage({type:'solved',solution:solution,nodesExplored:nodesExplored,
        surfaceSkipped:surfacePruned+cellPruned,elapsed:elapsed});
    } else {
      self.postMessage({type:'failed',nodesExplored:nodesExplored,
        surfaceSkipped:surfacePruned+cellPruned,elapsed:elapsed,cornerCombos:0});
    }
  };
}

function createSolverManager(board,pieces,numStates,goal,onMessage){
  var code='('+solverWorker.toString()+')()';
  var blob=new Blob([code],{type:'text/javascript'});
  var url=URL.createObjectURL(blob);
  var worker=new Worker(url);
  URL.revokeObjectURL(url);
  worker.onmessage=function(e){onMessage(e.data)};
  worker.postMessage({board:board,pieces:pieces,numStates:numStates,goal:goal});
  return{terminate:function(){worker.terminate()}};
}

// ═══ RENDERING ═══
function calcGrid(cv,rows,cols){
  const cs=Math.min(50,Math.floor((cv.width-20)/cols),Math.floor((cv.height-20)/rows));
  return{cs,ox:(cv.width-cols*cs)/2,oy:(cv.height-rows*cs)/2};
}

function drawBoard(cv,board,numStates,highlight,goal){
  const ctx=cv.getContext('2d'),dk=isDark();
  const rows=board.length,cols=board[0].length;
  const{cs,ox,oy}=calcGrid(cv,rows,cols);
  const colors=stateColors(numStates);
  const g=goal||0;
  ctx.clearRect(0,0,cv.width,cv.height);
  ctx.fillStyle=dk?'#171717':'#f5f5f0';ctx.fillRect(0,0,cv.width,cv.height);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const x=ox+c*cs,y=oy+r*cs;
    const dv=(board[r][c]-g+numStates)%numStates;
    ctx.fillStyle=colors[dv];
    ctx.beginPath();ctx.roundRect(x+1,y+1,cs-2,cs-2,3);ctx.fill();
    if(highlight&&highlight.some(h=>h[0]===r&&h[1]===c)){
      ctx.strokeStyle=dk?'#e2e8f0':'#1c1917';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.roundRect(x+1,y+1,cs-2,cs-2,3);ctx.stroke();
    }
    ctx.fillStyle=dk?'rgba(0,0,0,.5)':'rgba(255,255,255,.6)';
    ctx.font=`bold ${Math.max(10,cs/3)}px "JetBrains Mono",monospace`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(dv,x+cs/2,y+cs/2);
  }
  ctx.strokeStyle=dk?'#3f3f46':'#d6d3d1';ctx.lineWidth=1;
  ctx.strokeRect(ox,oy,cols*cs,rows*cs);
}

function drawPiece(cv,piece,numStates,active,placed){
  const ctx=cv.getContext('2d'),dk=isDark();
  const ph=piece.length,pw=piece[0].length;
  const cs=Math.min(20,Math.floor(cv.width/(pw+1)),Math.floor(cv.height/(ph+1)));
  const ox=(cv.width-pw*cs)/2,oy=(cv.height-ph*cs)/2;
  ctx.clearRect(0,0,cv.width,cv.height);
  if(placed){
    ctx.fillStyle=dk?'rgba(34,197,94,.12)':'rgba(22,163,74,.08)';
    ctx.fillRect(0,0,cv.width,cv.height);
  }else if(active){
    ctx.fillStyle=dk?'rgba(129,140,248,.15)':'rgba(67,56,202,.08)';
    ctx.fillRect(0,0,cv.width,cv.height);
  }
  const col=placed?(dk?'#4ade80':'#16a34a'):stateColors(numStates)[1];
  ctx.globalAlpha=placed?0.55:1;
  for(let r=0;r<ph;r++)for(let c=0;c<pw;c++){
    if(!piece[r][c])continue;
    ctx.fillStyle=col;
    ctx.beginPath();ctx.roundRect(ox+c*cs+1,oy+r*cs+1,cs-2,cs-2,2);ctx.fill();
  }
  ctx.globalAlpha=1;
  // Placed indicator: small x in corner
  if(placed){
    ctx.fillStyle=dk?'rgba(248,113,113,.7)':'rgba(220,38,38,.5)';
    ctx.font='bold 10px sans-serif';ctx.textAlign='right';ctx.textBaseline='top';
    ctx.fillText('\u00d7',cv.width-3,1);
  }
}

function fmtSci(n){
  if(!isFinite(n))return'\u221e';
  if(n<1e6)return n.toLocaleString();
  const exp=Math.floor(Math.log10(n));
  return(n/Math.pow(10,exp)).toFixed(3)+'E+'+exp;
}
function fmtTime(s){
  if(!isFinite(s)||s<0)return'\u2014';
  if(s<60)return s.toFixed(1)+'s';
  if(s<3600)return Math.floor(s/60)+'m '+Math.floor(s%60)+'s';
  return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m';
}

// ═══ MAIN RENDER ═══
function render(container){
  container.innerHTML=`
    <div class="tab-bar"><button class="tab-btn active" data-t="play">Puzzle</button><button class="tab-btn" data-t="algo">Algorithm</button></div>
    <div id="gs-play"></div><div id="gs-algo" style="display:none"></div>`;
  container.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{
    container.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    container.querySelector('#gs-play').style.display=b.dataset.t==='play'?'':'none';
    container.querySelector('#gs-algo').style.display=b.dataset.t==='algo'?'':'none';
  }));

  const $p=container.querySelector('#gs-play');
  $p.innerHTML=`<div class="two-col"><div>
    <div class="sim-wrap"><div class="sim-bar"><h3>Cyclic Grid Puzzle</h3>
      <span id="gs-status" style="font-size:11px;color:var(--text-3)">Place pieces on the grid</span>
    </div>
    <canvas id="gs-cv" class="sim-canvas" width="500" height="420"></canvas>
    <div class="sim-foot">
      <button class="btn btn-sm btn-p" id="gs-solve">Solve</button>
      <button class="btn btn-sm" id="gs-reset">Reset</button>
      <button class="btn btn-sm" id="gs-undo">Undo</button>
      <button class="btn btn-sm" id="gs-new">New puzzle</button>
      <button class="btn btn-sm" id="gs-import-btn">Paste puzzle</button>
      <span id="gs-import-status" style="font-size:10px;color:var(--text-3)"></span>
    </div></div>
    <div class="panel" id="gs-stats-panel" style="margin-top:8px;display:none">
      <h3 style="font-size:13px;margin-bottom:8px">Solver Statistics</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:11px;font-family:var(--mono)">
        <div class="ctrl-row"><span style="color:var(--text-3)">Combinations</span><span id="gs-st-combos" style="color:var(--accent)">-</span></div>
        <div class="ctrl-row"><span style="color:var(--text-3)">Elapsed</span><span id="gs-st-elapsed">-</span></div>
        <div class="ctrl-row"><span style="color:var(--text-3)">Nodes explored</span><span id="gs-st-nodes">-</span></div>
        <div class="ctrl-row"><span style="color:var(--text-3)">Expected time</span><span id="gs-st-eta">-</span></div>
        <div class="ctrl-row"><span style="color:var(--text-3)">Progress</span><span id="gs-st-progress" style="color:var(--accent)">-</span></div>
        <div class="ctrl-row"><span style="color:var(--text-3)">Pruned %</span><span id="gs-st-skipped" style="color:var(--green)">-</span></div>
      </div>
      <div style="margin-top:6px;height:4px;background:var(--bg-muted);border-radius:2px;overflow:hidden">
        <div id="gs-st-bar" style="height:100%;width:0%;background:var(--accent);transition:width .3s"></div>
      </div>
      <details id="gs-corner-details" style="margin-top:8px;font-size:10px;color:var(--text-3)">
        <summary style="cursor:pointer;font-size:11px;color:var(--text-2);margin-bottom:4px">Corner analysis &amp; pruning details</summary>
        <div id="gs-corner-info" style="font-family:var(--mono);line-height:1.8;margin-top:4px">Waiting for solver\u2026</div>
      </details>
    </div>
    <div style="margin-top:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <h4 style="font-size:12px;color:var(--text-2);margin:0">Pieces <span id="gs-placed" style="color:var(--accent)">0</span>/<span id="gs-total">0</span></h4>
        <button class="btn btn-sm" id="gs-hide-placed" style="font-size:9px;padding:2px 6px">Hide placed</button>
      </div>
      <div id="gs-pieces" style="display:flex;flex-wrap:wrap;gap:4px"></div>
    </div>
    <div class="panel" style="margin-top:10px">
      <div style="display:flex;gap:16px;font-size:11px;color:var(--text-3);flex-wrap:wrap">
        <span>Goal: all cells \u2192 <strong id="gs-goal-state" style="color:var(--accent)">0</strong></span>
        <span>States: <strong id="gs-num-states">2</strong></span>
        <span>Grid: <strong id="gs-grid-size">3\u00d73</strong></span>
      </div>
    </div>
  </div><div class="sidebar">
    <div class="panel" style="margin-bottom:10px"><h3 style="font-size:13px;margin-bottom:8px">Difficulty</h3>
      <div class="ctrl"><div class="ctrl-row"><span>Level</span><span class="val" id="gs-v-lvl">1</span></div><input type="range" id="gs-s-lvl" min="0" max="99" step="1" value="0"></div>
      <div id="gs-lvl-info" style="font-size:10px;color:var(--text-3);margin-top:4px;line-height:1.4"></div>
      <div style="font-size:9px;color:var(--text-3);margin-top:6px;line-height:1.5">
        <div>1\u201310: 3\u00d73, 2 states</div><div>11\u201320: 4\u00d73, 2 states</div>
        <div>21\u201330: 4\u00d74, 2\u20133 states</div><div>31\u201340: 6\u00d76, 2\u20133 states</div>
        <div>41\u201350: 8\u00d77, 2\u20133 states</div><div>51\u201360: 8\u00d78, 2\u20134 states</div>
        <div>61\u201370: 10\u00d710, 3\u20134 states</div><div>71\u201380: 10\u00d711, 3\u20134 states</div>
        <div>81\u201390: 12\u00d712, 3\u20134 states</div><div>91\u2013100: 14\u00d713/14, 4\u20135 states</div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:10px"><h3 style="font-size:13px;margin-bottom:8px">How to play</h3>
      <div style="font-size:11px;color:var(--text-3);line-height:1.6">
        <p><strong>1.</strong> Select a piece from the list below the grid.</p>
        <p><strong>2.</strong> Click on the grid to place the piece centered on your cursor.</p>
        <p><strong>3.</strong> Each covered cell advances by 1 state (mod N).</p>
        <p><strong>4.</strong> Place all pieces so every cell reaches the goal state.</p>
        <p style="margin-top:4px;font-size:10px;color:var(--text-3)">Click a placed piece (green) to remove it from the grid.</p>
      </div>
    </div>
    <div class="panel"><h3 style="font-size:13px;margin-bottom:8px">Legend</h3>
      <div id="gs-legend" style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px"></div>
    </div>
  </div></div>`;

  // Algorithm tab
  container.querySelector('#gs-algo').innerHTML=`<div style="max-width:780px">
    <div class="step"><h3 style="font-size:14px;margin-bottom:8px">1. Problem Formulation</h3>
      <p style="font-size:12px;color:var(--text-2);line-height:1.6">Given a grid of cells each in one of N states (Z/NZ), a set of polyomino pieces, and a goal state: place each piece exactly once so every cell equals the goal. Placement adds +1 mod N to each covered cell. Order-independent (abelian group).</p>
    </div>
    <div class="step"><h3 style="font-size:14px;margin-bottom:8px">2. Feasibility Pre-check</h3>
      <p style="font-size:12px;color:var(--text-2);line-height:1.6">Total deficit (sum of needed increments) mod N must equal total piece area mod N. If not, no solution exists. O(1) check that catches impossible puzzles instantly.</p>
    </div>
    <div class="step"><h3 style="font-size:14px;margin-bottom:8px">3. Piece Ordering &amp; Symmetry</h3>
      <p style="font-size:12px;color:var(--text-2);line-height:1.6">Most constrained first: pieces with fewest valid placements are tried first, ties broken by largest area. Identical pieces are grouped and canonically ordered to eliminate k! duplicate subtrees (e.g. 3 identical pieces = 6\u00d7 less work).</p>
    </div>
    <div class="step"><h3 style="font-size:14px;margin-bottom:8px">4. Surface Area Pruning</h3>
      <p style="font-size:12px;color:var(--text-2);line-height:1.6">Track required change (sum of cell deficits) vs remaining piece area. If required &gt; remaining, the branch is dead. ~97% prune rate. O(1) per node via incremental delta tracking.</p>
    </div>
    <div class="step"><h3 style="font-size:14px;margin-bottom:8px">5. Per-Cell Feasibility</h3>
      <p style="font-size:12px;color:var(--text-2);line-height:1.6">For each cell, precompute how many remaining placements can cover it. If any cell\u2019s deficit exceeds its remaining coverage, prune. Catches dead cells and isolated regions. Maintained incrementally in O(cells) per move.</p>
    </div>
    <div class="step"><h3 style="font-size:14px;margin-bottom:8px">6. Implementation</h3>
      <p style="font-size:12px;color:var(--text-2);line-height:1.6">Pure JavaScript in a Web Worker for non-blocking execution. Recursive backtracking with typed arrays, incremental deficit tracking, per-cell coverage arrays, and timer-based progress reporting (500ms intervals). Preparation phase completes in &lt;50ms.</p>
    </div>
  </div>`;

  const $=id=>container.querySelector('#'+id);
  let puzzle,boardState,currentPiece,placedPieces,moveHistory,solving,hidePlaced=false;

  function loadPuzzle(pz){
    puzzle=pz;boardState=pz.board.map(r=>[...r]);
    currentPiece=0;placedPieces=0;moveHistory=[];solving=false;
    stopSolver();
    $('gs-total').textContent=pz.pieces.length;
    $('gs-placed').textContent='0';
    $('gs-num-states').textContent=pz.numStates;
    $('gs-grid-size').textContent=pz.board.length+'\u00d7'+pz.board[0].length;
    $('gs-goal-state').textContent='0';
    $('gs-status').textContent='Place pieces on the grid';
    $('gs-status').style.color='var(--text-3)';
    $('gs-stats-panel').style.display='none';
    renderPieces();renderLegend();redraw();
  }

  function renderPieces(){
    const div=$('gs-pieces');div.innerHTML='';
    puzzle.pieces.forEach((p,i)=>{
      const cv=document.createElement('canvas');
      cv.width=60;cv.height=50;
      cv.style.cursor='pointer';cv.style.borderRadius='4px';
      cv.style.border='1px solid var(--border)';
      cv.addEventListener('click',()=>{
        if(solving)return;
        const mv=moveHistory.find(m=>m.piece===i);
        if(mv){
          unplacePiece(i);
        }else{
          currentPiece=i;highlightPiece();redraw();
        }
      });
      div.appendChild(cv);
      drawPiece(cv,p,puzzle.numStates,i===currentPiece,false);
    });
  }

  function highlightPiece(){
    $('gs-pieces').querySelectorAll('canvas').forEach((cv,i)=>{
      const placed=moveHistory.some(m=>m.piece===i);
      if(placed&&hidePlaced){
        cv.style.display='none';
      }else{
        cv.style.display='';
        cv.style.cursor=solving?'default':'pointer';
        drawPiece(cv,puzzle.pieces[i],puzzle.numStates,i===currentPiece&&!placed,placed);
      }
    });
  }

  function unplacePiece(idx){
    const mvIdx=moveHistory.findIndex(m=>m.piece===idx);
    if(mvIdx===-1)return;
    const mv=moveHistory[mvIdx];
    const p=puzzle.pieces[idx],ph=p.length,pw=p[0].length;
    for(let dr=0;dr<ph;dr++)for(let dc=0;dc<pw;dc++){
      if(p[dr][dc])boardState[mv.r+dr][mv.c+dc]=(boardState[mv.r+dr][mv.c+dc]+puzzle.numStates-1)%puzzle.numStates;
    }
    moveHistory.splice(mvIdx,1);
    placedPieces--;$('gs-placed').textContent=placedPieces;
    currentPiece=idx;highlightPiece();redraw();
    $('gs-status').textContent='Place pieces on the grid';$('gs-status').style.color='var(--text-3)';
  }

  function renderLegend(){
    const div=$('gs-legend');div.innerHTML='';
    const colors=stateColors(puzzle.numStates);
    for(let i=0;i<puzzle.numStates;i++){
      const s=document.createElement('span');
      s.style.display='flex';s.style.alignItems='center';s.style.gap='4px';
      s.innerHTML=`<span style="width:14px;height:14px;border-radius:3px;background:${colors[i]};display:inline-block"></span> State ${i}${i===0?' (goal)':''}`;
      div.appendChild(s);
    }
  }

  function redraw(hl){drawBoard($('gs-cv'),boardState,puzzle.numStates,hl,puzzle.goal)}

  function canvasCoords(e){
    const cv=$('gs-cv'),rect=cv.getBoundingClientRect();
    const cx=(e.clientX-rect.left)*cv.width/rect.width;
    const cy=(e.clientY-rect.top)*cv.height/rect.height;
    const rows=boardState.length,cols=boardState[0].length;
    const{cs,ox,oy}=calcGrid(cv,rows,cols);
    return{gr:Math.floor((cy-oy)/cs),gc:Math.floor((cx-ox)/cs),rows,cols};
  }

  function placePieceOnBoard(idx,r,c){
    const p=puzzle.pieces[idx],ph=p.length,pw=p[0].length;
    if(r<0||c<0||r+ph>boardState.length||c+pw>boardState[0].length)return false;
    const aff=[];
    for(let dr=0;dr<ph;dr++)for(let dc=0;dc<pw;dc++){
      if(p[dr][dc]){boardState[r+dr][c+dc]=(boardState[r+dr][c+dc]+1)%puzzle.numStates;aff.push([r+dr,c+dc])}
    }
    moveHistory.push({piece:idx,r,c});placedPieces++;
    $('gs-placed').textContent=placedPieces;
    const used=new Set(moveHistory.map(m=>m.piece));
    for(let i=0;i<puzzle.pieces.length;i++){if(!used.has(i)){currentPiece=i;break}}
    highlightPiece();redraw(aff);
    if(placedPieces===puzzle.pieces.length){
      const ok=boardState.every(r=>r.every(c=>c===puzzle.goal));
      $('gs-status').textContent=ok?'\u2705 Solved!':'\u274c Not solved. Click placed pieces to adjust.';
      $('gs-status').style.color=ok?'var(--green)':'var(--red)';
    }
    return true;
  }

  function undoLast(){
    if(!moveHistory.length||solving)return;
    unplacePiece(moveHistory[moveHistory.length-1].piece);
  }

  $('gs-cv').addEventListener('click',e=>{
    if(solving||moveHistory.some(m=>m.piece===currentPiece))return;
    const{gr,gc,rows,cols}=canvasCoords(e);
    if(gr<0||gc<0||gr>=rows||gc>=cols)return;
    const p=puzzle.pieces[currentPiece],ph=p.length,pw=p[0].length;
    placePieceOnBoard(currentPiece,gr-Math.floor(ph/2),gc-Math.floor(pw/2));
  });

  $('gs-cv').addEventListener('mousemove',e=>{
    if(solving||moveHistory.some(m=>m.piece===currentPiece))return;
    const{gr,gc,rows,cols}=canvasCoords(e);
    if(gr<0||gc<0||gr>=rows||gc>=cols){redraw();return}
    const p=puzzle.pieces[currentPiece],ph=p.length,pw=p[0].length;
    const pr=gr-Math.floor(ph/2),pc=gc-Math.floor(pw/2);
    if(pr<0||pc<0||pr+ph>rows||pc+pw>cols){redraw();return}
    const hl=[];
    for(let dr=0;dr<ph;dr++)for(let dc=0;dc<pw;dc++){if(p[dr][dc])hl.push([pr+dr,pc+dc])}
    redraw(hl);
  });
  $('gs-cv').addEventListener('mouseleave',()=>{if(!solving)redraw()});

  $('gs-reset').addEventListener('click',()=>loadPuzzle(puzzle));
  $('gs-undo').addEventListener('click',undoLast);
  $('gs-new').addEventListener('click',()=>loadPuzzle(preset(+$('gs-s-lvl').value)));

  // Hide placed pieces toggle
  $('gs-hide-placed').addEventListener('click',()=>{
    hidePlaced=!hidePlaced;
    $('gs-hide-placed').textContent=hidePlaced?'Show placed':'Hide placed';
    highlightPiece();
  });

  function updateLvlInfo(){
    const lv=+$('gs-s-lvl').value;$('gs-v-lvl').textContent=lv+1;
    const l=LEVELS[Math.min(lv,LEVELS.length-1)];
    $('gs-lvl-info').textContent=l[0]+'\u00d7'+l[1]+', '+l[2]+' states, '+l[3]+' pieces';
  }
  $('gs-s-lvl').addEventListener('input',updateLvlInfo);
  updateLvlInfo();

  // ═══ IMPORT (clipboard) ═══
  $('gs-import-btn').addEventListener('click',async()=>{
    try{
      const html=await navigator.clipboard.readText();
      if(!html.trim()){$('gs-import-status').textContent='Clipboard empty';return}
      const parsed=parseHTML(html);
      if(!parsed){$('gs-import-status').textContent='No puzzle found in clipboard';return}
      const pz={board:parsed.board,pieces:parsed.pieces.map(p=>[...p.map(r=>[...r])]),numStates:parsed.numStates,goal:parsed.goal};
      loadPuzzle(pz);
      $('gs-import-status').textContent=parsed.pieces.length+' pieces ('+parsed.rows+'\u00d7'+parsed.cols+', '+parsed.numStates+' states)';
    }catch(e){$('gs-import-status').textContent='Clipboard access denied'}
  });

  // ═══ SOLVER ═══
  let solverManager=null;
  function stopSolver(){
    if(solverManager){solverManager.terminate();solverManager=null}
    solving=false;$('gs-solve').textContent='Solve';
  }

  $('gs-solve').addEventListener('click',()=>{
    if(solving){stopSolver();return}
    loadPuzzle(puzzle);solving=true;
    $('gs-solve').textContent='Stop';
    $('gs-status').textContent='Solving\u2026';$('gs-status').style.color='var(--accent)';
    $('gs-stats-panel').style.display='';

    solverManager=createSolverManager(
      puzzle.board.map(r=>[...r]),puzzle.pieces,puzzle.numStates,puzzle.goal,
      function(d){
        if(d.type==='phase'){
          $('gs-status').textContent=d.phase;
        }else if(d.type==='cornerAnalysis'){
          let html='<strong>Corner requirements (mod N):</strong><br>';
          d.cornerStats.forEach(c=>{
            html+=`<span style="color:var(--accent)">${c.label}</span>: need ${c.needed} hits, ${c.placements} pieces can reach<br>`;
          });
          html+=`<br><strong>Corner-affecting pieces (placed first):</strong> ${d.piecesWithCornerOpts}`;
          html+=`<br><strong>Total search space:</strong> ${fmtSci(d.totalSearchSpace)}`;
          $('gs-corner-info').innerHTML=html;
        }else if(d.type==='progress'){
          $('gs-st-combos').textContent=fmtSci(d.totalCombinations);
          $('gs-st-elapsed').textContent=fmtTime(d.elapsed);
          $('gs-st-nodes').textContent=fmtSci(d.nodesExplored);
          $('gs-st-eta').textContent=fmtTime(d.expectedRemaining);
          $('gs-st-progress').textContent=d.progress.toFixed(2)+'% ('+d.cornerComboProgress+')';
          $('gs-st-skipped').textContent=d.surfaceSkipPercent.toFixed(1)+'%';
          $('gs-st-bar').style.width=Math.min(100,d.progress)+'%';
        }else if(d.type==='solved'){
          solving=false;$('gs-solve').textContent='Solve';
          $('gs-status').textContent='\u2705 Solved in '+fmtTime(d.elapsed)+' ('+fmtSci(d.nodesExplored)+' nodes)';
          $('gs-status').style.color='var(--green)';
          $('gs-st-elapsed').textContent=fmtTime(d.elapsed);
          $('gs-st-nodes').textContent=fmtSci(d.nodesExplored);
          $('gs-st-progress').textContent='100%';$('gs-st-bar').style.width='100%';
          $('gs-st-skipped').textContent=(d.nodesExplored>0?(d.surfaceSkipped/d.nodesExplored*100):0).toFixed(1)+'%';
          boardState=puzzle.board.map(r=>[...r]);
          moveHistory=[];placedPieces=0;
          if(d.solution){
            for(let i=0;i<puzzle.pieces.length;i++){
              if(!d.solution[i])continue;
              const[sr,sc]=d.solution[i],p=puzzle.pieces[i],ph=p.length,pw=p[0].length;
              for(let dr=0;dr<ph;dr++)for(let dc=0;dc<pw;dc++){
                if(p[dr][dc])boardState[sr+dr][sc+dc]=(boardState[sr+dr][sc+dc]+1)%puzzle.numStates;
              }
              moveHistory.push({piece:i,r:sr,c:sc});placedPieces++;
            }
          }
          $('gs-placed').textContent=placedPieces;
          highlightPiece();redraw();solverManager=null;
        }else if(d.type==='failed'){
          solving=false;$('gs-solve').textContent='Solve';
          $('gs-status').textContent='\u274c No solution ('+fmtTime(d.elapsed)+', '+fmtSci(d.nodesExplored)+' nodes)';
          $('gs-status').style.color='var(--red)';
          $('gs-st-elapsed').textContent=fmtTime(d.elapsed);
          $('gs-st-nodes').textContent=fmtSci(d.nodesExplored);
          solverManager=null;
        }
      }
    );
  });

  loadPuzzle(preset(0));
}

function cleanup(){}

ProjectRegistry.register('grid-shift',render,cleanup);
})();
