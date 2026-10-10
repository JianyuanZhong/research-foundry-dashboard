/* Aggregate scores only; private evaluation packets are never loaded. */
(async () => {
  const section = document.createElement('section');
  section.id = 'matched-evaluation';
  const title = document.createElement('h2');
  title.textContent = 'Five-layer comparison · matched V4.1 reviewer';
  section.append(title);
  document.querySelector('footer').before(section);
  try {
    const response = await fetch('data/matched-evaluation.json', {cache: 'no-store'});
    if (!response.ok) throw new Error('Scores unavailable');
    const data = await response.json();
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = `${data.reviewer} · three-role hypothesis panel · human calibration pending. Original Qwen evaluation: ${data.qwen_state}.`;
    section.append(note);
    const wrap = document.createElement('div'); wrap.className = 'table-wrap';
    const table = document.createElement('table');
    const head = document.createElement('thead'); const tr = document.createElement('tr');
    ['Domain', 'Model', 'Episodes', 'H /10 [n/N]', 'Progress', 'T /100 [n/N]', 'C /100', 'Discovery families'].forEach(label => {
      const th = document.createElement('th'); th.textContent = label; tr.append(th);
    });
    head.append(tr); table.append(head);
    const body = document.createElement('tbody');
    const domains = {clinical_population:'Clinical', population_multiomics:'Multi-omics', disease_mechanisms:'Disease mechanisms', therapeutic_targets:'Therapeutic targets'};
    const score = (value) => typeof value === 'number' ? value.toFixed(2) : '—';
    for (const domain of Object.keys(domains)) {
      for (const row of data.rows.filter(r => r.domain === domain)) {
        const pending = row.q == null && row.state === 'reviewing';
        const cells = [domains[domain], row.model, row.episodes,
          pending ? 'Pending' : `${score(row.q)} [${row.q_n ?? 0}/${row.distinct ?? 0}]`,
          typeof row.progress_rate === 'number' ? `${(100*row.progress_rate).toFixed(1)}%` : '—',
          row.trajectory_mean == null ? '—' : `${score(row.trajectory_mean)} [${row.trajectory_n}/${row.trajectory_expected}]`,
          score(row.campaign_mean), row.families ?? '—'];
        const line = document.createElement('tr');
        cells.forEach(value => {const td = document.createElement('td'); td.textContent = String(value); line.append(td);});
        body.append(line);
      }
    }
    table.append(body); wrap.append(table); section.append(wrap);
    const limits = document.createElement('p'); limits.className = 'muted';
    limits.textContent = `${data.limitations} — means no complete numeric score. Partial reviews retain missing panels; scored coverage is shown in brackets. Progress is substantive transitions / all reviewed transitions.`;
    section.append(limits);
  } catch (error) {
    const note = document.createElement('p'); note.textContent = 'Comparison scores are temporarily unavailable.'; section.append(note);
  }
})();
