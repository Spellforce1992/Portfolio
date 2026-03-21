/** engine/matrixui.js — Interactive matrix table renderer */
const MatrixUI={
  /**
   * Render a matrix as an HTML table.
   * @param {number[][]} M - matrix (array of rows)
   * @param {object} opts
   *   id         unique ID for the table
   *   editable   boolean — if true, cells are <input>
   *   precision  decimal places (default 3)
   *   rowLabels  string[] — optional labels for rows
   *   colLabels  string[] — optional labels for columns
   * @returns {string} HTML string
   */
  render(M,opts={}){
    const{id,editable,precision:p=3,rowLabels,colLabels}=opts;
    const n=M.length,m=M[0].length;
    let h=`<table class="matrix-table"${id?' id="'+id+'"':''}><tbody>`;
    if(colLabels){
      h+='<tr>';if(rowLabels)h+='<th></th>';
      for(let j=0;j<m;j++)h+='<th>'+colLabels[j]+'</th>';
      h+='</tr>';
    }
    for(let i=0;i<n;i++){
      h+='<tr>';
      if(rowLabels)h+='<td class="matrix-label">'+rowLabels[i]+'</td>';
      for(let j=0;j<m;j++){
        const v=M[i][j];
        const vs=typeof v==='number'?v.toFixed(p):v;
        if(editable)h+='<td><input class="matrix-cell" type="number" step="any" value="'+vs+'" data-r="'+i+'" data-c="'+j+'"></td>';
        else h+='<td class="matrix-cell ro">'+vs+'</td>';
      }
      h+='</tr>';
    }
    h+='</tbody></table>';return h;
  },

  /** Read current values from an editable matrix table element. */
  read(table){
    if(!table)return[];
    const inputs=table.querySelectorAll('input.matrix-cell');
    let maxR=0,maxC=0;
    inputs.forEach(inp=>{const r=+inp.dataset.r,c=+inp.dataset.c;if(r>maxR)maxR=r;if(c>maxC)maxC=c});
    const result=[];
    for(let i=0;i<=maxR;i++)result.push(new Array(maxC+1).fill(0));
    inputs.forEach(inp=>{result[+inp.dataset.r][+inp.dataset.c]=parseFloat(inp.value)||0});
    return result;
  },

  /** Wire change listeners to editable matrix inputs. */
  onEdit(container,tableId,cb){
    const table=container.querySelector('#'+tableId);
    if(!table)return;
    table.querySelectorAll('input.matrix-cell').forEach(inp=>{
      inp.addEventListener('change',()=>cb(MatrixUI.read(table)));
    });
  }
};
window.MatrixUI=MatrixUI;
