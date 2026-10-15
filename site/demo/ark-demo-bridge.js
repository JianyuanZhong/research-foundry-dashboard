'use strict';
(() => {
 const base=new URL('../data/ark300/',document.currentScript.src);
 window.arkCampaignLabels={"ark-deepseek41-luna-rerun": "DeepSeek V4.1 Flash", "ark-glm53-luna": "GLM 5.3 Flash", "moonshot-kimi3-luna": "Kimi K3", "codex-gpt61-sol-luna": "GPT-6.1 Sol"};
 window.arkCampaignAliases={"ark-deepseek41": "ark-deepseek41-luna-rerun", "ark-deepseek41-luna": "ark-deepseek41-luna-rerun", "ark-glm53": "ark-glm53-luna", "ark-kimi3": "moonshot-kimi3-luna"};
 const pageUrl=new URL(location.href),oldCampaign=pageUrl.searchParams.get('campaign');
 if(Object.hasOwn(window.arkCampaignAliases,oldCampaign||'')){
  pageUrl.searchParams.set('campaign',window.arkCampaignAliases[oldCampaign]);history.replaceState(null,'',pageUrl);
 }
 const groups=[['clinical_population',['hcc','mimic','eicu']],['therapeutic_targets',['therapeutic_targets']],['disease_mechanisms',['disease_mechanisms']],['population_multiomics',['population_multiomics']]];
 const get=async url=>{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Campaign snapshot unavailable');return r;};
 async function verified(path,hash){const bytes=await(await get(new URL(path,base))).arrayBuffer();const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(actual!==hash)throw Error('Snapshot integrity mismatch');return JSON.parse(new TextDecoder().decode(bytes));}
 window.arkPublicSnapshot=async id=>{
  if(!Object.hasOwn(window.arkCampaignLabels,id))throw Error('Unknown campaign');
  const index=await(await get(new URL('index.json',base))).json();
  if(index.schema!=='research-campaign-public-index-v1'||index.target!==index.campaigns.filter(c=>!c.historical).reduce((n,c)=>n+c.target,0)||!/^[a-f0-9]{32}$/.test(index.generation))throw Error('Invalid campaign index');
  const entry=index.campaigns.find(c=>c.campaign_id===id);
  if(!entry||entry.snapshot!==`generations/${index.generation}/${id}.json`||entry.lineage!==`generations/${index.generation}/${id}-tree.json`)throw Error('Invalid campaign reference');
  const [s,tree]=await Promise.all([verified(entry.snapshot,entry.sha256),verified(entry.lineage,entry.lineage_sha256)]);
  if(s.campaign_id!==id||tree.campaign_id!==id||s.generation!==index.generation||tree.generation!==index.generation||s.model_id!==tree.model_id||s.target!==300)throw Error('Campaign identity mismatch');
  if(s.source.error||s.source.missing)throw Error('Campaign source unavailable; last verified snapshot retained');
  const domains=groups.map(([domain,datasets],i)=>{
   const rows=s.islands.filter(r=>datasets.includes(r.id));
   const total=k=>rows.some(r=>r[k]===null)?null:rows.reduce((a,r)=>a+r[k],0);
   const projected=row=>({...row,source_dataset:row.dataset,dataset:domain});
   const candidates=tree.nodes.filter(n=>datasets.includes(n.dataset)).map(n=>projected({...n,title:n.label,operation:n.imported_seed?'seed':'unrecorded',operation_reason:'Scientific text is not included in this public release.',operation_goal:''}));
   const episodes=tree.episodes.filter(e=>datasets.includes(e.dataset)).map(projected);
   const jobs=tree.jobs.filter(j=>datasets.includes(j.dataset)).map(projected);
   const workers=tree.workers.filter(w=>datasets.includes(w.dataset)).map(projected);
   const target=rows.reduce((a,r)=>a+r.target,0),closed=total('attempted_closed');
   const island={id:domain,target,closed,generated_versions:total('generated_candidates'),distinct_selected:total('selected_candidates'),source_islands:rows.map(r=>({id:r.id,target:r.target,closed:r.attempted_closed,generated_versions:r.generated_candidates,distinct_selected:r.selected_candidates}))};
   const snapshot={schema:'experiment-dashboard-v1',domain,collected_at:index.source_collected_at,run:{label:window.arkCampaignLabels[id],model:s.model_id,provider:id.startsWith('codex-')?'Codex account':id.startsWith('moonshot-')?'Moonshot':'Ark',state:s.status,target,clock:{start:Math.min(index.source_collected_at,...candidates.map(c=>c.created_at))}},islands:[island],episodes,candidates,jobs,workers};
   return {id:domain,number:i+1,target,closed,generated:total('generated_candidates'),workers:total('active_workers'),run:snapshot.run,snapshot};
  });
  window.publicFeedMode='published';
  return {ok:true,json:async()=>({schema:'four-domain-dashboard-v1',trial_label:window.arkCampaignLabels[id],campaign:{state:s.status,target:300},domains,publication:{generated_at:index.published_at},budget:null,ark:true})};
 };
 const publication=document.querySelector('.snapshot p');const oldNote=publication?.textContent;
 window.setArkPublicationNote=mode=>{if(publication)publication.textContent=Object.hasOwn(window.arkCampaignLabels,mode)?'Automatic public snapshots every five minutes; deployment may add delay. The view refreshes every ten seconds.':oldNote;};
})();
