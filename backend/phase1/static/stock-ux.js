/* Progressive StockControl UX: real photo thumbnails, filters and native dialogs.
   Does not change stock decisions; all writes stay in the authenticated API. */
'use strict';
(()=>{
  const original=window.StockOperationsUI;
  let activeFormObserver=null;
  window.StockControlUXReset=()=>{
    if(activeFormObserver){activeFormObserver.disconnect();activeFormObserver=null}
    document.querySelectorAll('dialog.stock-ux-dialog').forEach(modalClose);
  };
  if(typeof original!=='function')return;
  const iconFor=m=>{
    const text=(m.name+' '+m.category).toLocaleLowerCase('pt-PT');
    if(/cabo|conector|encoder/.test(text))return 'cables';
    if(/elétr|automação|quadro|born/.test(text))return 'electrical';
    if(/paraf|porca|fixação/.test(text))return 'fasteners';
    if(/rolamento|motor|mecânic/.test(text))return 'bearing';
    if(/metal|alumínio|aço|perfil/.test(text))return 'metal';
    if(/resina|químic|plástic/.test(text))return 'resin';
    return 'warehouse';
  };
  function tag(name,cls,text){
    const node=document.createElement(name);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=String(text);
    return node;
  }
  const button=(text,fn,cls='secondary')=>{
    const b=tag('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;
  };
  const modalClose=(dialog)=>{
    if(dialog.open)dialog.close();
    dialog.remove();
  };
  function modal(title,content){
    document.querySelectorAll('dialog.stock-ux-dialog').forEach(modalClose);
    const dialog=tag('dialog','stock-ux-dialog');
    dialog.setAttribute('aria-label',title);
    const header=tag('div','stock-ux-modal-header');
    header.append(tag('h2','',title),button('Fechar',()=>modalClose(dialog),'secondary'));
    dialog.append(header,content);
    document.body.append(dialog);dialog.showModal();
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    dialog.querySelector('input, select, button')?.focus();
    return dialog;
  }
  function phaseTwoForms(root){
    const header=root.querySelector('.page-heading');
    if(!header)return;
    let actions=header.querySelector('.page-actions');
    if(!actions){actions=tag('div','page-actions');header.append(actions)}
    const bind=()=>root.querySelectorAll('.panel').forEach(panel=>{
      const form=panel.querySelector(':scope > form.edit-form');
      if(!form||panel.dataset.uxForm)return;
      panel.dataset.uxForm='1';
      const label=form.querySelector('[type=submit]')?.textContent?.trim()||'Abrir formulário';
      if(panel.id==='phase2-action'){
        panel.remove();
        const dlg=modal(panel.querySelector('h2')?.textContent||label,panel);
        const observer=new MutationObserver(()=>{modalClose(dlg);observer.disconnect()});
        observer.observe(root,{childList:true});
      }else{
        panel.remove();
        const trigger=button(label,()=>{
          const dlg=modal(panel.querySelector('h2')?.textContent||label,panel);
          const observer=new MutationObserver(()=>{modalClose(dlg);observer.disconnect()});
          observer.observe(root,{childList:true});
        },'primary stock-ux-add');
        actions.append(trigger);
      }
    });
    bind();
    if(activeFormObserver)activeFormObserver.disconnect();
    activeFormObserver=new MutationObserver(bind);
    activeFormObserver.observe(root,{childList:true,subtree:true});
  }
  function addGenericFilter(root,except=null){
    root.querySelectorAll('.panel .table-scroll').forEach(wrap=>{
      if(wrap===except||wrap.dataset.searchReady)return;
      const rows=[...wrap.querySelectorAll('tbody tr')];
      if(rows.length<4)return;
      wrap.dataset.searchReady='true';
      const controls=tag('div','stock-ux-mini-toolbar');
      const input=document.createElement('input');
      input.type='search';input.placeholder='Pesquisar nesta tabela…';
      input.setAttribute('aria-label','Pesquisar registos da tabela');
      const count=tag('small','',String(rows.length)+' registos');
      controls.append(input,count);wrap.parentElement.insertBefore(controls,wrap);
      input.addEventListener('input',()=>{
        const q=input.value.trim().toLocaleLowerCase('pt-PT');
        let found=0;
        for(const tr of rows){const show=tr.textContent.toLocaleLowerCase('pt-PT').includes(q);
          tr.hidden=!show;if(show)found++}
        count.textContent=found+' de '+rows.length+' registos';
      });
    });
  }
  function makePhoto(m,h){
    const frame=tag('span','stock-ux-thumb');
    const img=document.createElement('img');
    img.loading='lazy';img.decoding='async';img.alt='';
    const fallback='/admin-assets/assets/'+iconFor(m)+'.svg';
    img.src=fallback;frame.append(img);
    frame.title=m.has_photo?'Fotografia associada ao material':'Ilustração da categoria, não fotografia real';
    if(m.has_photo){
      // Authenticated images use a blob: never expose bearer token in the URL.
      const loadPhoto=()=>fetch('/api/v2/materials/'+encodeURIComponent(m.id)+'/photo',{
        headers:{Authorization:'Bearer '+h.getToken()},credentials:'omit',cache:'no-store'
      }).then(async resp=>{
        if(!resp.ok)throw Error('Fotografia indisponível');
        const blob=await resp.blob();
        if(!frame.isConnected)return;
        if(blob.type!=='image/webp')throw Error('Fotografia inválida');
        const url=URL.createObjectURL(blob);
        img.onload=()=>URL.revokeObjectURL(url);
        img.onerror=()=>{URL.revokeObjectURL(url);img.src=fallback};
        img.src=url;
      }).catch(()=>{frame.title='Fotografia indisponível; ilustração de categoria'});
      if('IntersectionObserver' in window){
        const observer=new IntersectionObserver(entries=>{
          if(entries.some(entry=>entry.isIntersecting)){
            observer.disconnect();loadPhoto();
          }
        },{rootMargin:'180px'});
        observer.observe(frame);
      }else loadPhoto();
    }
    return frame;
  }
  function photoEditor(m,h){
    const content=tag('div','stock-ux-photo-form');
    const form=tag('form','edit-form');
    const preview=tag('div','stock-ux-photo-preview');
    preview.append(makePhoto(m,h));
    const label=tag('label');
    label.append(tag('span','','Fotografia do material '+m.sku));
    const input=document.createElement('input');input.type='file';
    input.accept='image/jpeg,image/png,image/webp';input.required=true;
    label.append(input);form.append(label,preview);
    form.append(tag('p','hint','JPG, PNG ou WebP até 4 MB. O servidor reprocessa a imagem, remove os metadados e guarda-a de forma privada.'));
    const actions=tag('div','actions');
    const save=tag('button','primary','Guardar fotografia');save.type='submit';actions.append(save);
    let objectUrl=null;
    input.addEventListener('change',()=>{
      if(objectUrl)URL.revokeObjectURL(objectUrl);
      preview.replaceChildren();
      const file=input.files?.[0];
      if(file&&file.type.startsWith('image/')){
        objectUrl=URL.createObjectURL(file);
        const pic=document.createElement('img');pic.src=objectUrl;pic.alt='Pré-visualização da fotografia';
        preview.append(pic);
      }else preview.append(makePhoto(m,h));
    });
    const dialog=modal('Fotografia · '+m.name,content);
    dialog.addEventListener('close',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl)},{once:true});
    if(m.has_photo)actions.append(button('Remover fotografia',async()=>{
      if(!confirm('Eliminar esta fotografia?'))return;
      try{
        const r=await fetch('/api/v2/materials/'+encodeURIComponent(m.id)+'/photo',{
          method:'DELETE',headers:{Authorization:'Bearer '+h.getToken()},credentials:'omit',cache:'no-store'});
        if(!r.ok)throw Error('Não foi possível eliminar a fotografia.');
        modalClose(dialog);h.notify('Fotografia eliminada.');await h.render();
      }catch(e){h.notify(e.message,true)}
    },'secondary'));
    form.append(actions);content.append(form);
    form.addEventListener('submit',async event=>{
      event.preventDefault();save.disabled=true;
      try{
        const file=input.files?.[0];
        if(!file||file.size<=0||file.size>4*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))
          throw Error('Seleciona uma imagem JPG, PNG ou WebP até 4 MB.');
        const data=new FormData();data.append('file',file);
        const response=await fetch('/api/v2/materials/'+encodeURIComponent(m.id)+'/photo',{
          method:'POST',headers:{Authorization:'Bearer '+h.getToken()},
          body:data,credentials:'omit',cache:'no-store'
        });
        if(!response.ok){const error=await response.json().catch(()=>({}));
          throw Error(typeof error.detail==='string'?error.detail:'Falha no envio da fotografia.')}
        modalClose(dialog);h.notify('Fotografia atualizada.');await h.render();
      }catch(e){h.notify(e.message,true)}
      finally{save.disabled=false}
    });
  }
  async function enhanceInventory(root,h){
    const panel=[...root.querySelectorAll('.panel')].find(p=>p.querySelector('h2')?.textContent.startsWith('Materiais ('));
    if(!panel)return;
    const wrap=panel.querySelector('.table-scroll');
    if(!wrap)return;
    const [materials,balances,warehouses]=await Promise.all([
      h.call('/materials'),h.call('/balances'),h.call('/warehouses')
    ]);
    if(!root.isConnected)return;
    const tbody=wrap.querySelector('tbody'),thead=wrap.querySelector('thead tr');
    if(!tbody||!thead)return;
    const allRows=[...tbody.rows];
    const data=materials.map((m,i)=>({m,tr:allRows[i]})).filter(x=>x.tr);
    const opts=(label,values)=>{
      const select=document.createElement('select');select.className='stock-ux-select';
      select.setAttribute('aria-label',label);
      values.forEach(([value,text])=>{const o=tag('option','',text);o.value=value;select.append(o)});
      return select;
    };
    const filters=tag('div','stock-ux-filters');
    const search=document.createElement('input');search.type='search';
    search.placeholder='Pesquisar por nome, SKU ou categoria';
    search.setAttribute('aria-label','Pesquisar inventário');search.className='stock-ux-search';
    const cat=opts('Filtrar por categoria',[['','Todas as categorias'],...
      [...new Set(materials.map(m=>m.category))].sort().map(v=>[v,v])]);
    const where=opts('Filtrar por armazém',[['','Todos os armazéns'],...
      warehouses.map(w=>[w.id,w.name])]);
    const status=opts('Filtrar por estado',[['','Todos os estados'],['low','Stock baixo'],
      ['zero','Sem stock'],['available','Disponível']]);
    const order=opts('Ordenar materiais',[['sku','Ordenar por SKU'],['name','Nome'],
      ['stock','Menor stock'],['cost','Maior custo']]);
    filters.append(search,cat,where,status,order);
    const badge=tag('small','stock-ux-count');badge.setAttribute('aria-live','polite');
    const bar=tag('div','stock-ux-filter-bar');bar.append(filters,badge);
    panel.querySelector('.panel-title')?.after(bar);
    const header=tag('th','','Disponível');thead.insertBefore(header,thead.children[3]||null);
    data.forEach(({m,tr})=>{
      const name=tr.querySelector('td:first-child');
      if(name){const content=tag('div','stock-ux-material');
        content.append(makePhoto(m,h));const label=tag('div');
        label.append(...Array.from(name.childNodes));content.append(label);name.append(content)}
      const stock=tag('td','stock-ux-qty');
      tr.insertBefore(stock,tr.children[3]||null);
      if(h.canManage()){
        const action=tr.lastElementChild?.querySelector('.actions-inline');
        action?.append(button(m.has_photo?'Editar foto':'Adicionar foto',()=>photoEditor(m,h),
          'secondary stock-photo-action'));
      }
    });
    const stockOf=(m)=>{
      const rows=balances.filter(b=>b.material_id===m.id&&(!where.value||b.warehouse_id===where.value));
      return rows.reduce((total,b)=>total+Number(b.available),0);
    };
    let page=0;const pageSize=15;
    const nav=tag('div','stock-ux-pagination');
    const previous=button('Anterior',()=>{if(page>0){page--;refresh()}},'secondary');
    const next=button('Seguinte',()=>{page++;refresh()},'secondary');
    const current=tag('small','','');nav.append(previous,current,next);wrap.after(nav);
    function refresh(resetPage=false){
      if(resetPage)page=0;
      const q=search.value.trim().toLocaleLowerCase('pt-PT');
      let selected=data.filter(({m})=>{
        const qty=stockOf(m);
        if(q&&!(m.name+' '+m.sku+' '+m.category).toLocaleLowerCase('pt-PT').includes(q))return false;
        if(cat.value&&m.category!==cat.value)return false;
        if(status.value==='low'&&!(Number(m.minimum)>0&&qty<=Number(m.minimum)))return false;
        if(status.value==='zero'&&qty>0)return false;
        if(status.value==='available'&&qty<=0)return false;
        return true;
      });
      if(order.value==='name')selected.sort((a,b)=>a.m.name.localeCompare(b.m.name,'pt-PT'));
      else if(order.value==='stock')selected.sort((a,b)=>stockOf(a.m)-stockOf(b.m));
      else if(order.value==='cost')selected.sort((a,b)=>Number(b.m.unit_cost)-Number(a.m.unit_cost));
      else selected.sort((a,b)=>a.m.sku.localeCompare(b.m.sku,'pt-PT'));
      const totalPages=Math.max(1,Math.ceil(selected.length/pageSize));
      page=Math.min(page,totalPages-1);
      const visible=selected.slice(page*pageSize,(page+1)*pageSize);
      tbody.replaceChildren(...visible.map(x=>x.tr));
      visible.forEach(({m,tr})=>{
        const qty=stockOf(m),node=tr.querySelector('.stock-ux-qty');
        node.textContent='';
        const state=tag('span','stock-ux-state'+(qty<=0?' zero':
          Number(m.minimum)>0&&qty<=Number(m.minimum)?' low':'good'),
          new Intl.NumberFormat('pt-PT',{maximumFractionDigits:3}).format(qty)+' '+m.unit);
        node.append(state);
      });
      previous.disabled=page===0;next.disabled=page>=totalPages-1;
      current.textContent='Página '+(page+1)+' de '+totalPages;
      badge.textContent=selected.length+' de '+materials.length+' materiais · até 500 por consulta';
    }
    [search,cat,where,status,order].forEach(x=>x.addEventListener(x===search?'input':'change',()=>refresh(true)));
    refresh();
  }
  window.StockOperationsUI=function(h){
    const pages=original(h);
    const enhanced={};
    for(const [name,fn] of Object.entries(pages)){
      enhanced[name]=async root=>{
        await fn(root);
        if(!root.isConnected)return;
        phaseTwoForms(root);
        if(name==='inventory'){
          try{await enhanceInventory(root,h)}catch(e){h.notify('Filtros visuais indisponíveis: '+e.message,true)}
        }
        addGenericFilter(root,root.querySelector('.stock-ux-filter-bar')?.nextElementSibling);
      };
    }
    return enhanced;
  };
})();