(function(){
  itemEditor=function(d){
    const rows=(d.items||[]).map((i,n)=>`<div class="item-row" data-item="${n}">
      <label class="item-cell description" data-mobile-label="Description"><span class="item-mobile-label">Description</span><input data-item-field="description" value="${esc(i.description||'')}" placeholder="Description"></label>
      <label class="item-cell qty" data-mobile-label="Qty"><span class="item-mobile-label">Qty</span><input data-item-field="qty" type="number" step="0.01" value="${num(i.qty)}"></label>
      <label class="item-cell unit" data-mobile-label="Unit"><span class="item-mobile-label">Unit</span><input data-item-field="unit" value="${esc(i.unit||'')}" placeholder="Pax"></label>
      <label class="item-cell rate" data-mobile-label="Rate"><span class="item-mobile-label">Rate</span><input data-item-field="price" type="number" step="0.01" value="${num(i.price)}"></label>
      <div class="item-cell amount-cell" data-mobile-label="Amount"><span class="item-mobile-label">Amount</span><span class="amount">${moneyOnly(num(i.qty)*num(i.price))}</span></div>
      <button class="remove-line" data-remove-item="${n}" type="button" aria-label="Remove item ${n+1}">×</button>
    </div>`).join('');

    return `<div class="item-lines mobile-ready-items"><div class="item-head"><span>Description</span><span>Qty</span><span>Unit</span><span>Rate</span><span style="text-align:right">Amount</span><span></span></div>${rows}</div>
      <div class="items-foot"><button class="btn" data-add-item type="button">+ Add Line</button><div class="totals-mini">Document Total <b>${money(calc(d).total,d.currency)}</b></div></div>
      <div class="form-grid three item-tax-grid" style="margin-top:10px"><div class="field"><label>GST Treatment</label><select data-field="gst_mode"><option value="none" ${d.gst_mode==='none'?'selected':''}>No GST</option><option value="exclusive" ${d.gst_mode==='exclusive'?'selected':''}>Add GST</option><option value="inclusive" ${d.gst_mode==='inclusive'?'selected':''}>Price Includes GST</option></select></div><div class="field"><label>GST %</label><input data-field="gst_rate" type="number" step="0.01" value="${num(d.gst_rate)}"></div><div class="field"><label>Discount</label><input data-field="discount" type="number" step="0.01" value="${num(d.discount)}"></div></div>`;
  };
})();
