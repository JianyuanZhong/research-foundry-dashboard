'use strict';
(() => {
  const base = new URL('data/ark300/', document.currentScript.src);
  const models = {'ark-deepseek41':'DeepSeek V4.1 Flash','ark-glm53':'GLM 5.3','ark-kimi3':'Kimi K3','ark-glm53-luna':'GLM 5.3 · Luna harness','ark-deepseek41-luna':'DeepSeek V4.1 Flash · Luna harness'};
  const groups = [
    {id:'clinical_population',name:'Clinical & Population Health Research',islands:['hcc','mimic','eicu']},
    {id:'therapeutic_targets',name:'Therapeutic Target Prioritization',islands:['therapeutic_targets']},
    {id:'disease_mechanisms',name:'Disease Mechanisms & Pathway Hypotheses',islands:['disease_mechanisms']},
    {id:'population_multiomics',name:'Population Multi-omics & Disease Targets',islands:['population_multiomics']}
  ];
  const labels = {hcc:'HCC',mimic:'MIMIC',eicu:'eICU',therapeutic_targets:'Therapeutic targets',disease_mechanisms:'Disease mechanisms',population_multiomics:'UKB / Population multi-omics'};
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = v => Number.isInteger(v)&&v>=0?String(v):'—';
  const stamp = v => typeof v==='number'&&Number.isFinite(v)?new Date(v*1000).toLocaleString():'unknown';
  const sum = (rows,key) => rows.some(r=>!Number.isInteger(r[key]))?null:rows.reduce((v,r)=>v+r[key],0);
  const table = (headers,rows) => `<table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const state = s => ({running:'Running',provider_paused:'Provider paused',operator_paused:'Operator paused',prepared:'Prepared',prepared_access_pending:'Access checks pending',pilot_blocked:'Pilot requires attention',coordinator_failed:'Coordinator requires attention',execution_complete:'Execution complete',settled:'Execution settled',source_error:'Source unavailable',missing_source:'Source unavailable'})[s]||String(s).replaceAll('_',' ');
  const requested = new URL(location.href).searchParams.get('campaign');
  if(requested && !Object.hasOwn(models,requested)) {
    $('campaign-title').textContent='Campaign not found';$('freshness').textContent='Choose a registered campaign to continue.';
    return;
  }
  $('campaign-picker').value=requested||'ark-deepseek41';
  let snapshots=new Map(),trees=new Map(),index=null,failed=false,busy=false;
  async function get(url) {
    const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error('Snapshot unavailable');return r;
  }
  function render() {
    const cid=$('campaign-picker').value,s=snapshots.get(cid);
    $('campaign-title').textContent=models[cid];document.title=`Research Foundry · ${models[cid]}`;
    if(!s){$('freshness').textContent='Snapshot unavailable. No progress is inferred.';return;}
    const age=Date.now()/1000-index.published_at,stale=failed||age>900||age < -5||s.source.stale;
    $('freshness').textContent=`${stale?'Delayed observation · last verified data retained. ':''}${state(s.status)} · Published ${stamp(index.published_at)} · Source observed ${stamp(s.source.observed_at)}`;
    const visible=groups.filter(g=>$('domain-picker').value==='all'||g.id===$('domain-picker').value);
    const rows=s.islands.filter(i=>visible.some(g=>g.islands.includes(i.id)));
    const c=s.counts;
    $('summary').innerHTML=`<span class="badge">${esc(state(s.status))}</span><div class="metrics"><p><strong>${n(c.attempted_closed)} / ${n(s.target)}</strong>Attempted episodes closed</p><p><strong>${n(c.successful)}</strong>Execution successes</p><p><strong>${n(c.active_jobs)}</strong>Running jobs</p></div><p>${n(c.technical_failed)} technical failures · ${n(c.incomplete_or_unclassified)} incomplete / unclassified · ${n(c.cancelled_unattempted)} closed without an attempt</p>`;
    $('domains').innerHTML=visible.map(g=>{
      const r=s.islands.filter(i=>g.islands.includes(i.id)),target=sum(r,'target'),closed=sum(r,'attempted_closed');
      return `<article class="report-card"><h2>${esc(g.name)}</h2><strong>${n(closed)} / ${n(target)}</strong><p>Attempted episodes closed</p>${closed===null?'':`<progress value="${closed}" max="${target}" aria-label="${esc(g.name)} progress"></progress>`}<p>${n(sum(r,'successful'))} successes · ${n(sum(r,'technical_failed'))} technical failures<br>${n(sum(r,'generated_candidates'))} generated candidates · ${n(sum(r,'selected_candidates'))} distinct selections<br>${n(sum(r,'active_workers'))} active workers · ${n(sum(r,'active_jobs'))} running jobs</p></article>`;
    }).join('');
    $('islands').innerHTML=table(['Island','Attempted / target','Closed','Successes','Technical failures','Incomplete','Remaining to attempt'],rows.map(i=>[labels[i.id]||i.id,`${n(i.attempted)} / ${n(i.target)}`,n(i.attempted_closed),n(i.successful),n(i.technical_failed),n(i.incomplete_or_unclassified),n(i.remaining_to_attempt)]));
    window.renderArkTree(trees.get(cid),$('domain-picker').value,cid);
    $('activity').innerHTML=table(['Island','Active workers','Running jobs','Queued jobs','Generated candidates','Distinct selections'],rows.map(i=>[labels[i.id]||i.id,n(i.active_workers),n(i.active_jobs),n(i.queued_jobs),n(i.generated_candidates),n(i.selected_candidates)]));
  }
  async function refresh() {
    if(busy)return;busy=true;
    try {
      const next=await(await get(new URL('index.json',base))).json();
      if(next.schema!=='research-campaign-public-index-v1'||next.metadata_only!==true||next.target!==next.campaigns.filter(c=>!c.historical).reduce((n,c)=>n+c.target,0)||!/^[a-f0-9]{32}$/.test(next.generation)||next.campaigns.length<3)throw Error('Invalid index');
      const values=await Promise.all(next.campaigns.map(async e=>{
        if(!Object.hasOwn(models,e.campaign_id)||e.snapshot!==`generations/${next.generation}/${e.campaign_id}.json`)throw Error('Invalid campaign reference');
        const bytes=await(await get(new URL(e.snapshot,base))).arrayBuffer();
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
        if(digest!==e.sha256)throw Error('Snapshot integrity mismatch');
        const s=JSON.parse(new TextDecoder().decode(bytes));
        if(s.campaign_id!==e.campaign_id||s.model_id!==e.model_id||s.generation!==next.generation||s.target!==300||s.metadata_only!==true||s.islands.length!==6||s.islands.some(i=>i.target!==50))throw Error('Snapshot identity mismatch');
        const path=`generations/${next.generation}/${e.campaign_id}-tree.json`;
        if(e.lineage!==path)throw Error('Invalid lineage reference');
        const treeBytes=await(await get(new URL(path,base))).arrayBuffer();
        const treeHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',treeBytes)),b=>b.toString(16).padStart(2,'0')).join('');
        if(treeHash!==e.lineage_sha256)throw Error('Lineage integrity mismatch');
        const tree=JSON.parse(new TextDecoder().decode(treeBytes));
        if(tree.schema!=='research-campaign-public-lineage-v1'||tree.campaign_id!==e.campaign_id||tree.model_id!==e.model_id||tree.generation!==next.generation)throw Error('Lineage identity mismatch');
        return [e.campaign_id,s,tree];
      }));
      if(new Set(values.map(v=>v[0])).size!==values.length)throw Error('Duplicate campaign');
      snapshots=new Map(values.map(v=>[v[0],v[1]]));trees=new Map(values.map(v=>[v[0],v[2]]));index=next;failed=false;
    } catch {failed=true;} finally {busy=false;render();}
  }
  $('campaign-picker').onchange=()=>{const url=new URL(location.href);url.searchParams.set('campaign',$('campaign-picker').value);history.replaceState(null,'',url);render();};
  $('domain-picker').onchange=render;$('refresh').onclick=refresh;
  refresh();setInterval(refresh,10000);setInterval(render,10000);
})();
