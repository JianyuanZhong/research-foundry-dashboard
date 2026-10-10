(async () => {
 const section=document.createElement('section');section.id='evidence-iteration-pilot';document.querySelector('footer').before(section);
 const h=document.createElement('h2');h.textContent='Evidence iteration · matched 30-episode campaigns';section.append(h);
 const names={clinical_population:'Clinical',disease_mechanisms:'Disease mechanisms',population_multiomics:'Multi-omics',therapeutic_targets:'Therapeutic targets'};
 const paragraph=text=>{const p=document.createElement('p');p.className='muted';p.textContent=text;section.append(p)};
 const table=(headers,rows)=>{const wrap=document.createElement('div');wrap.className='table-wrap';const t=document.createElement('table');const head=document.createElement('thead');const tr=document.createElement('tr');headers.forEach(x=>{const th=document.createElement('th');th.textContent=x;tr.append(th)});head.append(tr);t.append(head);const body=document.createElement('tbody');rows.forEach(row=>{const line=document.createElement('tr');row.forEach(x=>{const c=document.createElement('td');c.textContent=String(x);line.append(c)});body.append(line)});t.append(body);wrap.append(t);section.append(wrap)};
 try {
  const response=await fetch(`data/qwen.json?pilot=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw Error();
  const registry=await response.json();const campaigns=registry.balanced_campaigns||[];const report=campaigns.find(c=>c.dashboard_id==='balanced-evidence-original')?.paired_evidence_comparison;
  if(!report){paragraph('New campaigns are being prepared. Their live progress and matched evaluation will appear here.');return}
  const links=document.createElement('p');for(const [id,label] of [['original','Original Qwen'],['raft','RAFT R2']]){const a=document.createElement('a');a.href=`demo/?campaign=balanced-evidence-${id}#progress`;a.textContent=`${label} campaign ↗`;links.append(a,document.createTextNode('  '))}section.append(links);
  paragraph(`Five episodes per island; 30 per model. Identical one-hour episodes, five-minute finalization, 16 serving slots per model, and CPU scientific resources. Campaigns: ${report.state}. Scientific evaluation: ${report.quality_state}.`);
  table(['Domain','Model','Closed','Versions / distinct texts','Compute passed / failed','Recorded evidence checks','Selected episodes'],report.rows.map(r=>[names[r.domain],r.model,`${r.closed}/${r.target}`,`${r.versions} / ${r.distinct}`,`${r.compute_succeeded} / ${r.compute_failed}`,r.recorded_evidence_checks,r.selected_episodes]));
  const score=x=>typeof x==='number'?x.toFixed(2):'—';
  paragraph('Five-layer scientific comparison · DeepSeek V4.1 Flash, three-role hypothesis panel. Ratings are populated after the campaigns settle; missing scores are never zero.');
  table(['Domain','Model','H /10 [n/N]','Progress','T /100 [n/N]','C /100','Discovery families'],report.rows.map(r=>{const q=r.quality||{};return[names[r.domain],r.model,q.q==null?'Pending':`${score(q.q)} [${q.q_n}/${q.distinct}]`,typeof q.progress_rate==='number'?`${(q.progress_rate*100).toFixed(1)}%`:'—',q.trajectory_mean==null?'—':`${score(q.trajectory_mean)} [${q.trajectory_n}/${q.trajectory_expected}]`,score(q.campaign_mean),q.families??'—']}));
  paragraph(report.note+' Human calibration remains pending. Scientific exploration may end with an informative negative, a blocker, or no selection.');
 }catch(e){paragraph('The latest comparison is temporarily unavailable. Campaign work continues independently.')}
})();
