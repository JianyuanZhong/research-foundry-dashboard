'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={hcc:'HCC',mimic:'MIMIC',eicu:'eICU',ukb:'UK Biobank',clinical_population:'Clinical & Population Health Research',therapeutic_targets:'Therapeutic Target Prioritization',disease_mechanisms:'Disease Mechanisms & Pathway Hypotheses',population_multiomics:'Population Multi-omics & Disease Targets'};
let data=null,busy=false,connectionFailed=false,selectedNode=null,selectedDomain='clinical_population',domainRegistry=null;
const treeView={zoom:null,wide:false,inspector:false,key:null};
const chosen=()=>$('#island').value;
const filtered=list=>(list||[]).filter(x=>chosen()==='all'||(x.dataset||x.id)===chosen());
const stateLabel=s=>({archived:'Archived',queued:'Queued',pilot_review:'Pilot health check',generation_budget_paused:'Generation budget paused',provider_or_operator_paused:'Provider or operator paused',budget_accounting_unavailable:'Budget check unavailable',provider_paused:'Provider blocked',operator_paused:'Paused',running:'In progress',settled:'Settled',prepared:'Prepared'})[s]||s;
const operationLabel=c=>({seed:'Seed',evolve:'Evolution',evolution:'Evolution',repair:'Repair',crossover:'Crossover',restart:'Restart',unrecorded:'Unrecorded'})[c.operation]||c.operation||'Unrecorded';
const compilationLabel=s=>s==='succeeded'?'Compilation success':s==='failed'?'Compilation fail':'Compilation pending';
const qaLabel=s=>({readiness_passed:'✓ Readiness QA passed',qa_running:'Readiness QA running',qa_pending:'Readiness QA pending',qa_blocked:'Readiness QA blocked',qa_failed:'Readiness QA failed'})[s]||'Readiness QA pending';
const table=(head,rows)=>`<div class="table-wrap"><table class="live-table"><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${esc(cell??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const empty=(title,text)=>`<div class="empty-live"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
function activeReplay(){
 const r=domainRegistry?.selection_replay;
 return $('#run-mode').value==='qwen' && r?.source_trial===data?.run.label ? r : null;
}
function replaySelected(id){return !!activeReplay()?.episodes?.some(e=>e.status==='selected'&&e.selected_id===id);}
function replayPanel(){
 const r=activeReplay();if(!r)return '';
 const rows=(r.episodes||[]).filter(e=>chosen()==='all'||e.dataset===chosen()||(chosen()==='clinical_population'&&['hcc','mimic','eicu'].includes(e.dataset)));
 const selected=rows.filter(e=>e.status==='selected');
 return `<section class="live-section" id="live-selection-replay"><p class="eyebrow">FROZEN CAMPAIGN / SELECTION REPLAY</p><h3>Qwen reconsidered ${esc(r.completed)} / ${esc(r.total)} recorded episodes</h3><p><strong>${esc(r.selected_episodes)} episodes selected · ${esc(r.distinct_selected_hypotheses)} distinct candidate versions</strong> · ${esc(r.no_selection_episodes)} no selection · ${esc(r.incomplete_episodes)} incomplete.</p><p>The original campaign remains frozen. These are replay decisions over frozen candidates; original outcomes are preserved. No new research or environment builds were run in this replay.</p><p>${selected.length} selected episodes in this focus. Replay-selected candidates are labelled in Discovery.</p><details><summary>Compare original and replay decisions (${rows.length} episodes in focus)</summary>${table(['Dataset','Episode','Original outcome','Replay outcome','Selected candidate','Environment'],rows.map(e=>[names[e.dataset]||e.dataset,e.episode_number,e.original_outcome,e.status,data.candidates.find(c=>c.id===e.selected_id)?.title||e.selected_id||'—',e.environment_status==='not_run'?'Not run':e.environment_status]))}</details></section>`;
}
function positions(list,mini=false){const byId=new Map(list.map(n=>[n.id,n])),depths=new Map();function depth(n,seen=new Set()){if(depths.has(n.id))return depths.get(n.id);if(seen.has(n.id))return 0;const next=new Set(seen);next.add(n.id);const parents=n.parents.map(id=>byId.get(id)).filter(Boolean);const d=parents.length?1+Math.max(...parents.map(p=>depth(p,next))):0;depths.set(n.id,d);return d}const rows=new Map(),pos=new Map();list.slice().sort((a,b)=>a.episode-b.episode||list.filter(n=>n.parents.includes(b.id)).length-list.filter(n=>n.parents.includes(a.id)).length||a.id.localeCompare(b.id)).forEach(n=>{const col=depth(n),row=rows.get(col)||0;rows.set(col,row+1);pos.set(n.id,{x:col*(mini?90:205),y:row*(mini?14:92)})});return{pos,width:Math.max(1,...rows.keys())*(mini?90:205)+(mini?10:155),height:Math.max(1,...rows.values())*(mini?14:92)}}

const lifeDomains=[
 {id:'clinical_population',name:names.clinical_population,subtitle:'HCC · MIMIC · eICU',description:'Epidemiology and disease outcomes. Payment and policy evaluation requires its own data.'},
 {id:'therapeutic_targets',name:names.therapeutic_targets,subtitle:'GEO · molecular perturbation',description:'Prioritize candidate interventions. Expression responses do not establish druggability or direct target action.'},
 {id:'disease_mechanisms',name:names.disease_mechanisms,subtitle:'Cell states · coculture · pathways',description:'Develop falsifiable mechanisms and distinguish competing biological explanations.'},
 {id:'population_multiomics',name:names.population_multiomics,subtitle:'Data source: UK Biobank',description:'Use admitted omics and clinical data, preserving verified participant linkage boundaries.'}
];
function focusDomain(id){const wasLegacy=$('#run-mode').value==='legacy';selectedDomain=id;if(wasLegacy)$('#run-mode').value='current';$('#island').value=id;selectedNode=null;treeView.zoom=null;if(wasLegacy)refresh();else render();}
window.focusResearchDomain=focusDomain;
function renderDomains(){
 $('#life-domain-cards').innerHTML=lifeDomains.map((d,i)=>{const run=domainRegistry?.domains.find(x=>x.id===d.id);return `<button class="life-domain-card ${selectedDomain===d.id?'selected':''}" data-life-domain="${d.id}" aria-pressed="${selectedDomain===d.id}"><span class="eyebrow">0${i+1} / LIFE SCIENCES</span><h3>${esc(d.name)}</h3><span class="domain-subtitle">${esc(d.subtitle)}</span><p>${esc(d.description)}</p><span class="domain-status">${run?esc(stateLabel(run.run.state))+' · '+run.closed+' / '+run.target+' episodes':'Connecting to domain'}</span></button>`}).join('');
 const d=lifeDomains.find(d=>d.id===selectedDomain)||lifeDomains[0],r=domainRegistry?.domains.find(x=>x.id===d.id),budget=domainRegistry?.budget;
 $('#life-domain-detail').innerHTML=`<div><strong>${esc(d.name)}</strong><p>${esc(d.description)} ${r?r.generated+' new hypothesis versions · '+r.workers+' active workers':''}</p>${budget?.budget_enforced===false?`<small>Generation budget: no monetary cap · ${Number(budget.input_tokens||0).toLocaleString()} input / ${Number(budget.output_tokens||0).toLocaleString()} output tokens reported. Provider charges are not yet reconciled.${budget.transport==='native'?' Native requests · 36 model slots · no global request spacing · 150 min per research task.':''}</small>`:budget?.cap_usd?`<small>Generation budget: $${Number(budget.committed_upper_usd).toFixed(2)} reserved or accounted / $${budget.cap_usd} cap across all four domains. Fresh campaign budget; includes uncertain billing reservations.</small>`:''}</div><button data-domain-explore="${d.id}">Explore this domain ↗</button>`;
 document.querySelectorAll('[data-life-domain]').forEach(b=>b.onclick=()=>{focusDomain(b.dataset.lifeDomain)});
 document.querySelectorAll('[data-domain-explore]').forEach(b=>b.onclick=()=>{focusDomain(b.dataset.domainExplore);location.hash='discovery';render();$('.workspace').scrollIntoView({behavior:'smooth',block:'start'})});
}
function miniOverview(list){
 if(!list.length)return '<div class="mini-empty">No hypotheses recorded yet</div>';
 const nodes=list.map(c=>({...c,episode:c.imported_seed?0:c.generation+1}));
 const layout=positions(nodes,true),points=new Map();
 const maxX=Math.max(1,...[...layout.pos.values()].map(p=>p.x)),maxY=Math.max(1,...[...layout.pos.values()].map(p=>p.y));
 for(const [id,p] of layout.pos)points.set(id,{x:14+p.x/maxX*222,y:12+p.y/maxY*126});
 const edges=nodes.flatMap(n=>n.parents.filter(id=>points.has(id)).map(id=>{const a=points.get(id),b=points.get(n.id);return `<path d="M${a.x} ${a.y} C${(a.x+b.x)/2} ${a.y},${(a.x+b.x)/2} ${b.y},${b.x} ${b.y}"/>`})).join('');
 return `<svg class="live-mini-tree" viewBox="0 0 250 150" role="img" aria-label="${esc(names[list[0].dataset])}: ${list.length} hypothesis nodes and their recorded parent links"><g fill="none" stroke="#617855" stroke-width="1.2">${edges}</g>${nodes.map(n=>{const p=points.get(n.id);return `<circle cx="${p.x}" cy="${p.y}" r="${n.selected?4:3}" fill="${n.imported_seed?'#b49ce4':n.selected?'#e1f4a7':'#8daf78'}"><title>${esc(n.title)}</title></circle>`}).join('')}</svg>`;
}

function researchTree(candidates){
 const ids=new Map(candidates.map(c=>[c.id,c]));
 const nodes=candidates.map(c=>({...c,episode:c.imported_seed?0:c.generation+1}));
 const {pos,width,height}=positions(nodes);
 if(!ids.has(selectedNode))selectedNode=nodes.filter(c=>!c.imported_seed).at(-1)?.id||nodes[0]?.id;
 const n=ids.get(selectedNode);
 const paths=nodes.flatMap(c=>c.parents.filter(id=>pos.has(id)).map(id=>{const a=pos.get(id),b=pos.get(c.id);return `<path d="M${a.x+148} ${a.y+33} C${a.x+180} ${a.y+33},${b.x-30} ${b.y+33},${b.x} ${b.y+33}" fill="none" stroke="${c.id===selectedNode?'#d2e6a4':'#53654c'}" stroke-width="${c.id===selectedNode?2.5:1.5}"/>`})).join('');
 return `<section class="tree-explorer ${treeView.wide?'wide-screen':''} ${treeView.inspector?'':'inspector-hidden'}"><div class="tree-toolbar"><span>Live ancestry · ${nodes.length} nodes</span><div class="tree-controls"><button id="zoom-out" aria-label="Zoom out">−</button><output id="tree-zoom" aria-live="polite">100%</output><button id="zoom-in" aria-label="Zoom in">+</button><button id="fit-live-tree">Fit all</button><button id="actual-tree">100%</button><button id="toggle-inspector" aria-pressed="${treeView.inspector}">${treeView.inspector?'Hide':'Show'} inspector</button><button id="wide-tree" aria-pressed="${treeView.wide}">${treeView.wide?'Exit wide screen':'Wide screen'}</button></div></div><div class="stage"><div class="graph-panel"><div class="graph-caption"><span>${esc(chosen()==='all'?'All domains':names[chosen()])} / live research tree</span><span>Seed → generation → evolution</span></div><div id="live-tree" class="graph-scroll"><div class="tree-canvas" style="width:${width}px;height:${Math.max(height,350)}px"><svg width="${width}" height="${Math.max(height,350)}" aria-hidden="true">${paths}</svg>${nodes.map(c=>{const a=pos.get(c.id);return `<button class="tree-node op-${esc(c.operation||'unrecorded')} ${c.imported_seed?'seed':''} ${c.selected?'selected':''} ${c.id===selectedNode?'current':''}" style="left:${a.x}px;top:${a.y}px" data-live-node="${esc(c.id)}" aria-label="${esc(c.title)}" aria-pressed="${c.id===selectedNode}"><small>${esc(operationLabel(c))} · ${esc(names[c.source_dataset]||names[c.dataset])} · G${c.generation}</small><span>${esc(c.title)}${replaySelected(c.id)?' · Replay selected':''}</span></button>`}).join('')}</div></div><div class="legend"><span><i class="seed"></i> Imported seed</span><span><i class="selected"></i> Selected outline</span><span class="op-key evolve">Evolution</span><span class="op-key repair">Repair</span><span class="op-key crossover">Crossover</span><span class="op-key restart">Restart</span><span>Unrecorded = assignment unavailable</span></div></div><aside id="live-inspector">${n?`<p class="eyebrow">HYPOTHESIS INSPECTOR</p><h3>${esc(n.title)}</h3><span class="status">${n.selected?'Selected':n.imported_seed?'Imported seed':'Proposed'}${replaySelected(n.id)?' · Replay selected':''}</span><p class="meta">${esc(names[n.dataset])} · Generation ${n.generation}</p><h4>RESEARCH OPERATION · ${esc(operationLabel(n))}</h4><p>${esc(n.operation_reason||'No operation rationale recorded.')}</p>${n.operation_goal?`<h4>RESEARCH GOAL</h4><p>${esc(n.operation_goal)}</p>`:''}${n.proposal_excerpt?`<h4>SCIENTIFIC HYPOTHESIS</h4><p>${esc(n.proposal_excerpt)}</p><details class="public-proposal"><summary>Read full proposal</summary><pre>${esc(n.public_proposal||'')}</pre></details>`:''}<h4>RECORDED ASSESSMENT</h4><p>${esc(n.assessment||'Pending')} · This is an agent assessment, not independent DFM validation.</p><h4>SCIENTIFIC ANCESTRY</h4>${n.parents.length?n.parents.map(id=>`<button class="parent-link" data-live-node="${esc(id)}">${esc(ids.get(id)?.title||id)} ↗</button>`).join(''):'<p>No recorded parents.</p>'}<p class="meta">${esc(n.id)}</p>`:'<p>No hypotheses saved for this selection yet.</p>'}</aside></div></section>`;
}
function render(){
 renderDomains();
 if(!data)return;
 const view=['live','progress','discovery','environments','benchmark'].includes(location.hash.slice(1))?location.hash.slice(1):'progress';
 if(view==='discovery'&&chosen()==='all'&&$('#run-mode').value!=='legacy')$('#island').value=selectedDomain;
 document.body.classList.toggle('rolling-mode',view==='live');
 document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+view));
 $('#view-title').textContent=({live:'Live research',progress:'Research, across four domains',discovery:'From expert seeds to new hypotheses',environments:'From proposal to executable environment',benchmark:'Scientific quality, at every scale'})[view];
 const campaignClosed=data.islands.reduce((n,i)=>n+i.closed,0);
 $('#campaign-name').textContent=`${data.run.model}${data.run.provider?' · '+data.run.provider:''} · ${campaignClosed}/${data.run.target} episodes · ${$('#run-mode').value==='legacy'?'EHR campaign · 2026-10-02':'Four-domain test campaign'}`;
 $('#run-id').textContent=data.run.label;
 const age=Math.max(0,Date.now()/1000-data.collected_at),stale=age>300||connectionFailed;
 $('#live-state').textContent=data.run.state==='archived'?'Archived':stale?'Snapshot delayed':stateLabel(data.run.state);
 $('#freshness').textContent=`${window.publicFeedMode==='fallback'?'Backup snapshot':window.publicFeedMode==='published'?'Published snapshot':'Live snapshot'} ${new Date(data.collected_at*1000).toLocaleTimeString()} · ${Math.round(age)}s ago`;
 const islands=filtered(data.islands),candidates=filtered(data.candidates),jobs=filtered(data.jobs),workers=filtered(data.workers),episodes=filtered(data.episodes);
 const generated=candidates.filter(c=>!c.imported_seed),closed=islands.reduce((n,i)=>n+i.closed,0),target=islands.reduce((n,i)=>n+i.target,0);
 const focused=chosen()!=='all';
 $('#summary').innerHTML=[
  [`${campaignClosed} / ${data.run.target}`,'Campaign episodes closed',focused?`Focus: ${closed}/${target}`:''],
  [generated.length,focused?'New versions in focus':'New versions',''],
  [workers.length,focused?'Active workers in focus':'Active workers','']
 ].map(([v,l,detail])=>`<div><strong>${esc(v)}</strong>${esc(l)}${detail?`<br>${esc(detail)}`:''}</div>`).join('');
 let html='';
 if(view==='live'){html='<div id="rolling-root"></div>';}else if(view==='progress'){
 html=`<div class="live-grid">${islands.map(i=>{const js=jobs.filter(j=>j.dataset===i.id),ws=workers.filter(w=>w.dataset===i.id);return `<article class="live-card"><p class="eyebrow">${esc(names[i.id])}</p><h3>${esc(stateLabel(i.state||data.run.state))}</h3><button class="mini-tree-link" data-focus="${i.id}" aria-label="Open ${esc(names[i.id])} research tree">${miniOverview(candidates.filter(c=>c.dataset===i.id))}</button><div class="mini-caption"><span>● Seeds</span><span>● New hypotheses</span></div><div class="number">${i.closed}<small> / ${i.target}</small></div><progress value="${i.closed}" max="${i.target}" aria-label="${esc(names[i.id])} episodes closed"></progress><p>${i.generated_versions} new hypothesis versions<br>${i.source_islands?i.source_islands.map(x=>esc(names[x.id])+': '+x.closed+'/'+x.target).join(' · ')+'<br>':''}${i.distinct_selected} original selections · ${ws.length} active workers<br>${js.filter(j=>j.state==='running').length} running jobs · ${js.filter(j=>j.state==='failed').length} failed jobs</p><button data-focus="${i.id}">Inspect this domain ↗</button></article>`}).join('')}</div><p class="live-note">Imported seeds are counted separately from generated hypotheses. Closed episodes include all outcomes; they do not imply a successful discovery.</p><section class="live-section"><h3>Active research team</h3>${workers.length?table(['Domain','Dataset','Role','Branch','Episode'],workers.map(w=>[names[w.dataset],names[w.source_dataset]||names[w.dataset],w.role,w.work_seq??'Lead coordination',(episodes.find(e=>e.id===w.episode_id)?.ordinal??0)+1])):empty('No active workers',data.run.state.includes('paused')?'The campaign is paused.':'No active worker records in the latest snapshot.')}</section>`;
 }else if(view==='discovery'){
 html=researchTree(candidates)+`<p class="live-note">${candidates.filter(c=>c.imported_seed).length} imported seeds · ${generated.length} new versions. Parent identifiers retain the recorded lineage. Candidate titles are summaries, not validated findings.</p>${generated.length?table(['Hypothesis','Domain','Operation','Generation','Parents','Review','Original selection','Replay selection'],generated.slice().reverse().map(c=>[c.title,names[c.dataset],operationLabel(c),c.generation,c.parents.map(id=>candidates.find(p=>p.id===id)?.title||id).join(' → ')||'New direction',c.assessment||'Pending',c.selected?'Yes':'No',activeReplay()?(replaySelected(c.id)?'Selected':'Not selected'):'Not applicable'])):empty('Research is underway','No new hypotheses have been saved for this selection yet. Seed records are available below.')}<details class="live-section"><summary>Imported research seeds (${candidates.filter(c=>c.imported_seed).length})</summary>${table(['Seed','Domain'],candidates.filter(c=>c.imported_seed).map(c=>[c.title,names[c.dataset]]))}</details>`;
 }else if(view==='environments'){
 const delivery=jobs.filter(j=>['compile','validate'].includes(j.operation));
 html=`<div class="environment-flow"><div><span>01</span><strong>Scientific selection</strong><p>${candidates.filter(c=>c.selected).length} selected hypotheses</p></div><b>→</b><div><span>02</span><strong>Environment compilation</strong><p>${delivery.filter(j=>j.operation==='compile'&&j.state==='succeeded').length} completed · ${delivery.filter(j=>j.operation==='compile'&&j.state==='running').length} running</p></div><b>→</b><div><span>03</span><strong>Readiness checks</strong><p>${delivery.filter(j=>j.operation==='validate'&&j.state==='succeeded'&&j.task_readiness==='passed').length} readiness QA passed</p></div></div>${delivery.length?table(['Domain','Stage','State','Hypothesis','Failure category'],delivery.slice().reverse().map(j=>[names[j.dataset],j.operation,j.state,candidates.find(c=>c.id===j.candidate_id)?.title||j.candidate_id,j.category])):empty('No environments queued yet',activeReplay()?'The campaign is frozen. Selection replay did not run environment compilation or readiness checks.':'Selected proposals will appear here as they enter compilation and readiness checks.')}<section class="live-section"><h3>Research compute</h3>${table(['Domain','State','Stage','Failure category'],jobs.filter(j=>j.operation==='compute').slice(-30).reverse().map(j=>[names[j.dataset],j.state,j.stage,j.category]))}</section><p class="live-note">These are the current campaign’s delivery records. Historical demonstration environments are in the recorded showcase. Successful execution is not scientific validation.</p>`;
 }else{
 html=`<div class="phase-grid">${['Hypothesis','Transition','Trajectory','Campaign','Discovery'].map(t=>`<article class="live-card"><p class="eyebrow">INDEPENDENT DFM REVIEW</p><h3>${t}</h3><span class="tag">Pending</span><p>No independent score has been loaded for this campaign.</p></article>`).join('')}</div><p class="live-note">The campaign’s final five-layer review is scheduled after discovery and delivery settle. Historical Sol scores are not presented as scores for this run.</p>`;
 }
 if(view==='environments'){
 const compiled=jobs.filter(j=>j.operation==='compile');
 html=`<div class="environment-catalog">${compiled.map(j=>`<button class="environment-card" data-open-environment="${esc(j.id)}"><div><span class="eyebrow">${esc(names[j.dataset])}</span><span class="env-status ${j.state==='succeeded'?'passed':''}">${esc(compilationLabel(j.state))}</span></div><h3>${esc(candidates.find(c=>c.id===j.candidate_id)?.title||'Research environment')}</h3><span class="environment-open">Open proposal & model instructions ↗</span></button>`).join('')}</div>`+html;
 }
 const oldTree=$('#live-tree'), oldScroll=oldTree?{left:oldTree.scrollLeft,top:oldTree.scrollTop}:null;
 $('#content').innerHTML=replayPanel()+html;
 if(oldScroll&&$('#live-tree')){$('#live-tree').scrollLeft=oldScroll.left;$('#live-tree').scrollTop=oldScroll.top;}
 document.querySelectorAll('[data-live-node]').forEach(b=>b.onclick=()=>{selectedNode=b.dataset.liveNode;treeView.inspector=true;render()});
 if($('#live-tree')){
 const panel=$('#live-tree'),canvas=panel.querySelector('.tree-canvas');
 if(treeView.key!==chosen()){treeView.key=chosen();treeView.zoom=null;}
 const fit=()=>Math.min(1,(panel.clientWidth-40)/parseFloat(canvas.style.width),(panel.clientHeight-40)/parseFloat(canvas.style.height));
 function zoomTo(value,center=true){
  const previous=treeView.zoom||1,cx=(panel.scrollLeft+panel.clientWidth/2)/previous,cy=(panel.scrollTop+panel.clientHeight/2)/previous;
  treeView.zoom=Math.max(.02,Math.min(2.5,value));canvas.style.zoom=String(treeView.zoom);$('#tree-zoom').textContent=Math.round(treeView.zoom*100)+'%';
  if(center){panel.scrollLeft=cx*treeView.zoom-panel.clientWidth/2;panel.scrollTop=cy*treeView.zoom-panel.clientHeight/2;}
 }
 zoomTo(treeView.zoom??fit(),false);
 if(oldScroll){panel.scrollLeft=oldScroll.left;panel.scrollTop=oldScroll.top;}
 $('#zoom-in').onclick=()=>zoomTo(treeView.zoom*1.25);$('#zoom-out').onclick=()=>zoomTo(treeView.zoom/1.25);
 $('#actual-tree').onclick=()=>zoomTo(1);
 $('#fit-live-tree').onclick=()=>{zoomTo(fit(),false);panel.scrollTo({left:0,top:0})};
 $('#toggle-inspector').onclick=()=>{treeView.inspector=!treeView.inspector;render()};
 $('#wide-tree').onclick=()=>{treeView.wide=!treeView.wide;render()};
 panel.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoomTo(treeView.zoom*(e.deltaY<0?1.1:1/1.1));}},{passive:false});
 }
 document.body.classList.toggle('tree-wide-open',view==='discovery'&&treeView.wide);
 if(view==='live'&&window.renderRolling)window.renderRolling(data);

 document.querySelectorAll('[data-open-environment]').forEach(b=>b.onclick=()=>window.openEnvironmentModal(b.dataset.openEnvironment,b));
 document.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>{$('#island').value=b.dataset.focus;location.hash='discovery';render()});
}
async function refresh(){if(busy)return;busy=true;try{
 const r=await publicSnapshot(['account','qwen'].includes($('#run-mode').value)?$('#run-mode').value:'current');if(!r.ok)throw Error('Live connection unavailable. Previous snapshot retained.');
 const registry=await r.json();if(registry.schema!=='four-domain-dashboard-v1')throw Error('Unexpected domain registry');domainRegistry=registry;
 if($('#run-mode').value==='legacy'){const response=await publicSnapshot('legacy');if(!response.ok)throw Error('Historical campaign unavailable');data=await response.json();}
 else {const snapshots=registry.domains.map(d=>d.snapshot);data={schema:'experiment-dashboard-v1',collected_at:Math.min(...snapshots.map(s=>s.collected_at)),run:{label:registry.trial_label||'life-science-four-domains-20261003',model:snapshots[0].run.model,provider:snapshots[0].run.provider,state:registry.campaign.state||'prepared',target:registry.campaign.target||registry.domains.reduce((n,d)=>n+(d.target||d.run.target||0),0)},islands:[],episodes:[],candidates:[],workers:[],jobs:[]};for(const s of snapshots){for(const k of ['islands','episodes','candidates','workers','jobs'])data[k].push(...(s[k]||[]).map(x=>k==='islands'?{...x,state:s.run.state}:x));}}
 const choices=$('#run-mode').value==='legacy'?['hcc','mimic','eicu','ukb']:lifeDomains.map(d=>d.id),previous=chosen();$('#island').innerHTML='<option value="all">All '+($('#run-mode').value==='legacy'?'historical islands':'four domains')+'</option>'+choices.map(id=>`<option value="${id}">${esc(names[id])}</option>`).join('');$('#island').value=choices.includes(previous)?previous:'all';
 connectionFailed=false;$('#connection-error').hidden=true;render();
 }catch(e){connectionFailed=true;$('#connection-error').hidden=false;$('#connection-error').textContent=e.message;render()}finally{busy=false}}
window.environmentQuery=dataset=>'?domain='+encodeURIComponent($('#run-mode').value==='legacy'?'clinical_population':dataset||selectedDomain)+'&run='+$('#run-mode').value;
const initialCampaign=new URLSearchParams(location.search).get('campaign');if(['current','legacy','account','qwen'].includes(initialCampaign))$('#run-mode').value=initialCampaign;
$('#run-mode').onchange=()=>{selectedNode=null;refresh()};
$('#refresh').onclick=refresh;$('#island').onchange=render;window.addEventListener('hashchange',render);setInterval(refresh,10000);setInterval(()=>{if(data){const age=Math.max(0,Math.round(Date.now()/1000-data.collected_at));$('#freshness').textContent=`${window.publicFeedMode==='fallback'?'Backup snapshot':window.publicFeedMode==='published'?'Published snapshot':'Live snapshot'} ${new Date(data.collected_at*1000).toLocaleTimeString()} · ${age}s ago`;if(age>300&&data.run.state!=='archived')$('#live-state').textContent='Connection stale'}},1000);refresh();

window.addEventListener('keydown',e=>{if(e.key==='Escape'&&treeView.wide){treeView.wide=false;render()}});
