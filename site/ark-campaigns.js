'use strict';
(() => {
  const base = new URL('data/ark300/', document.currentScript.src);
  const models = new Map([['glm-5.3', 'GLM 5.3'], ['deepseek-v4.1-flash', 'DeepSeek V4.1 Flash'], ['kimi-k3', 'Kimi K3']]);
  const names = {hcc:'HCC', mimic:'MIMIC', eicu:'eICU', therapeutic_targets:'Therapeutic targets', disease_mechanisms:'Disease mechanisms', population_multiomics:'Population multi-omics'};
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = v => Number.isInteger(v) && v >= 0 ? String(v) : '—';
  const stamp = v => typeof v === 'number' && Number.isFinite(v) ? new Date(v * 1000).toLocaleString() : 'unknown';
  const state = s => ({draining:'Finishing active work',execution_complete:'Execution complete',pilot_blocked:'Pilot requires attention',coordinator_failed:'Coordinator requires attention',planned:'Planned',prepared:'Prepared',prepared_access_pending:'Prepared · access checks pending',running:'Running',queued:'Queued',pilot_review:'Pilot review',pilot_failed:'Pilot requires attention',pilot_complete:'Pilot complete',operator_paused:'Operator paused',provider_paused:'Provider paused',stopped:'Stopped',window_expired:'Time window expired',settled:'Execution settled',completed:'Execution complete',missing_source:'Source not available',source_error:'Source unavailable'})[s] || 'Paused / awaiting update';
  let last = null, busy = false, fetchFailed = false;
  async function get(url) {
    const response = await fetch(url, {cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Error('Publication unavailable');
    return response;
  }
  async function readGeneration() {
    const index = await (await get(new URL('index.json',base))).json();
    if (index.schema !== 'research-campaign-public-index-v1' || index.metadata_only !== true || !/^[a-f0-9]{32}$/.test(index.generation) || !Array.isArray(index.campaigns)) throw Error('Invalid public registry');
    const entries = index.campaigns.filter(e => !e.historical && models.has(e.model_id));
    if (entries.length !== 3 || new Set(entries.map(e=>e.model_id)).size !== 3) throw Error('Incomplete model registry');
    const snapshots = await Promise.all(entries.map(async e => {
      if (!/^[a-z0-9][a-z0-9_-]{0,95}$/.test(e.campaign_id) || e.snapshot !== `generations/${index.generation}/${e.campaign_id}.json` || !/^[a-f0-9]{64}$/.test(e.sha256)) throw Error('Invalid snapshot reference');
      const bytes = await (await get(new URL(e.snapshot,base))).arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      if (digest !== e.sha256) throw Error('Snapshot integrity mismatch');
      const s = JSON.parse(new TextDecoder().decode(bytes));
      if (s.generation !== index.generation || s.campaign_id !== e.campaign_id || s.model_id !== e.model_id || s.target !== e.target || s.metadata_only !== true || !Array.isArray(s.islands) || s.islands.reduce((a,i)=>a+i.target,0) !== s.target) throw Error('Snapshot generation mismatch');
      return s;
    }));
    return {index,snapshots};
  }
  function render() {
    const freshness = document.querySelector('#ark-freshness');
    if (!last) {freshness.textContent = 'New campaign publication is not available yet. No research progress is inferred; historical campaigns below remain separate.';return;}
    const {index,snapshots} = last;
    const age = Date.now()/1000-index.published_at;
    const delayed = fetchFailed || age > 900 || age < -5;
    freshness.textContent = `${delayed?'Publication delayed · previous verified generation retained. ':'Verified publication · '}Published ${stamp(index.published_at)} · Collected ${stamp(index.source_collected_at)} · ${snapshots.reduce((a,s)=>a+s.target,0)} planned episodes across three models. Snapshots publish every five minutes plus deployment time. Snapshots publish every five minutes plus deployment time. Structural counts only; scientific quality is evaluated separately.`;
    document.querySelector('#ark-cards').innerHTML = snapshots.map(s => {
      const c=s.counts, source=s.source, stale=delayed || source.stale;
      return `<article class="report-card"><span class="badge">${esc(state(s.status))}${stale?' · stale observation':''}</span><h3>${esc(models.get(s.model_id))}</h3><strong>${n(c.attempted_closed)} / ${n(s.target)}</strong><p>Actually attempted episodes closed</p><p>${n(c.successful)} execution successes · ${n(c.technical_failed)} technical failures<br>${n(c.incomplete_or_unclassified)} other incomplete / unclassified closures<br>${n(c.cancelled_unattempted)} closed without an attempt — excluded from completion<br>${n(c.remaining_to_attempt)} episodes still to attempt</p><p>${n(c.generated_candidates)} generated candidates · ${n(c.selected_candidates)} distinct selections<br>${n(c.active_workers)} active workers · ${n(c.active_jobs)} running jobs</p><p>Pilot gate: ${n(s.pilot_episodes_per_island)} episode per island · full target ${n(s.target)}</p><small>Source observed ${esc(stamp(source.observed_at))}<br>Last source change ${esc(stamp(source.updated_at))}</small><p><a href="campaign.html?campaign=${encodeURIComponent(s.campaign_id)}#progress">View this campaign ↗</a></p></article>`;
    }).join('');
    const ids = [...new Set(snapshots.flatMap(s=>s.islands.map(i=>i.id)))];
    document.querySelector('#ark-islands').innerHTML = `<h3>Island progress</h3><table><thead><tr><th>Island</th>${snapshots.map(s=>`<th>${esc(models.get(s.model_id))}</th>`).join('')}</tr></thead><tbody>${ids.map(id=>`<tr><td>${esc(names[id]||'Registered island')}</td>${snapshots.map(s=>{const r=s.islands.find(i=>i.id===id);return `<td>${r?`${n(r.attempted_closed)} / ${n(r.target)} closed · ${n(r.successful)} successful`:'—'}</td>`}).join('')}</tr>`).join('')}</tbody></table><p class="muted">Missing counts are unknown, never zero. A completed execution, a selected candidate, and a confirmed scientific finding are different outcomes. This view contains no proposals, raw notes, private record identifiers, source paths or execution packages.</p>`;
  }
  async function refresh() {
    if(busy)return;busy=true;
    try {last=await readGeneration();fetchFailed=false;} catch {fetchFailed=true;}
    finally {busy=false;render();}
  }
  refresh();setInterval(refresh,10000);setInterval(render,10000);
})();
