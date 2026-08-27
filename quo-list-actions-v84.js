/* Quo v84 - stable document-list actions. No MutationObserver. */
(function(){
  if(typeof S==='undefined')return;

  tableDocs=function(rows,compact=false){
    if(!rows.length)return '<div class="empty">No documents found.</div>';
    const actionHead=compact?'':'<th class="actions-col">Actions</th>';
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Document</th><th>Customer</th><th>Date</th><th class="num">Total</th><th>Status</th>${actionHead}</tr></thead><tbody>${rows.map(d=>{
      const c=calc(d);
      const label=d.document_type==='proforma'?'Payment Request':d.document_type==='receipt'?'Payment Receipt':CFG[d.document_type]?.label||d.document_type;
      const pay=typeof paymentSummaryLine==='function'?paymentSummaryLine(d):'';
      const rowOpen=compact?` data-open="${d.id}"`:'';
      const action=d.document_type==='receipt'?'View':'Edit';
      const actions=compact?'':`<td class="row-actions"><button class="table-action" data-open="${d.id}" type="button">${action}</button>${d.document_type==='receipt'?'':`<button class="table-action danger-text" data-delete-doc="${d.id}" type="button">Delete</button>`}</td>`;
      return `<tr${rowOpen}><td><strong>${esc(d.document_number)}</strong><span class="subline">${esc(label)}</span></td><td>${esc(d.customer_name||'No customer')}</td><td>${esc(dateTiny(d.creation_date)||'-')}</td><td class="num">${moneyOnly(c.total)}</td><td><span class="badge ${statusClass(d.status)}">${esc(d.status||'Draft')}</span>${pay}</td>${actions}</tr>`;
    }).join('')}</tbody></table></div>`;
  };

  /* If any legacy quotation action panel is shown outside the new dashboard, use Edit wording. */
  try{
    const previousQuotePipelineCard=quotePipelineCard;
    quotePipelineCard=function(d){
      return previousQuotePipelineCard(d).replace(/>Open<\/button>/g,'>Edit</button>');
    };
  }catch(e){}
})();