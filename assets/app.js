const state = { project: "all", snapshot: null };

const sum = (projects, key) => projects.reduce((total, project) => total + Number(project.metrics[key] || 0), 0);
const visibleProjects = () => state.snapshot.projects.filter((project) => state.project === "all" || project.id === state.project);

function metric(projects, key) {
  return state.project === "all" ? sum(projects, key) : Number(projects[0]?.metrics[key] || 0);
}

function renderFunnel() {
  const projects = visibleProjects();
  const values = [
    ["Candidates", metric(projects, "candidates")],
    ["Selected", metric(projects, "selected")],
    ["Compiled", metric(projects, "compiled")],
    ["Readiness passed", metric(projects, "readiness_passed")],
    ["Reference validated", metric(projects, "reference_validated")],
    ["Public releases", metric(projects, "public_releases")],
  ];
  document.querySelector("#funnel").innerHTML = values.map(([label, value], index) =>
    `<div class="gate ${index >= 4 && value === 0 ? "zero" : index === 3 ? "warning" : ""}"><strong>${value}</strong><span>${label}</span></div>`
  ).join("");
}

function renderPrograms() {
  document.querySelector("#program-rows").innerHTML = visibleProjects().map((project) => `
    <tr>
      <td><div class="program"><span class="program-icon ${project.id}">${project.id === "ehr" ? "E" : "B"}</span><span><strong>${project.name}</strong><small>${project.subtitle}</small></span></div></td>
      <td><span class="status"><i class="dot ${project.status_tone === "attention" ? "attention" : ""}"></i>${project.status_label}</span></td>
      <td>${project.metrics.candidates}</td>
      <td>${project.metrics.selected}</td>
      <td>${project.metrics.compiled}</td>
      <td>${project.metrics.readiness_passed}</td>
      <td>${project.metrics.public_releases}</td>
    </tr>`).join("");
}

function renderProgress() {
  const rows = visibleProjects().flatMap((project) => [
    [`${project.short_name} selection`, project.metrics.selected, project.metrics.candidates],
    [`${project.short_name} compilation`, project.metrics.compiled, Math.max(project.metrics.selected, 1)],
    [`${project.short_name} readiness`, project.metrics.readiness_passed, Math.max(project.metrics.compiled, 1)],
  ]);
  document.querySelector("#progress-list").innerHTML = rows.map(([label, value, max]) => {
    const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
    return `<div class="progress-row"><strong>${label}</strong><div class="track"><i style="width:${pct}%"></i></div><span>${value} / ${max}</span></div>`;
  }).join("");
}

function renderPublished() {
  const environments = state.snapshot.environment_progress.filter((item) => state.project === "all" || item.project === state.project);
  const releases = state.snapshot.releases.filter((item) => state.project === "all" || item.project === state.project);
  document.querySelector("#environment-count").textContent = `${environments.length} compiled`;
  document.querySelector("#release-empty").hidden = releases.length > 0;
  const ready = environments.filter((item) => item.qa_status === "readiness_passed").length;
  const reference = environments.filter((item) => item.qa_status === "reference_validated").length;
  document.querySelector("#environment-summary").innerHTML = [[environments.length,"Compiled"],[ready,"Readiness passed"],[reference,"Reference validated"]].map(([value,label]) => `<div class="environment-stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
  document.querySelector("#environment-list").innerHTML = environments.map((item) => `<article class="environment-card"><h3>${item.project.toUpperCase()} · ${item.public_id}</h3><p>${item.dataset} environment linked to hypothesis ${item.candidate_public_id}.</p><div class="environment-meta"><span>Compiled</span><span>${item.qa_status.replaceAll("_", " ")}</span></div></article>`).join("");
  document.querySelector("#release-list").innerHTML = releases.map((item) => `<article class="release-card"><h3>${item.name} · ${item.version}</h3><p>${item.released_at}</p></article>`).join("");
  renderLineage();
}

function lineageNodes() {
  return state.snapshot.lineage.filter((item) => state.project === "all" || item.project === state.project);
}

function ancestors(target, byId, found = new Set()) {
  if (!target || found.has(target.id)) return found;
  found.add(target.id);
  target.parents.forEach((id) => ancestors(byId.get(id), byId, found));
  return found;
}

function renderLineage() {
  const nodes = lineageNodes();
  const select = document.querySelector("#lineage-target");
  const targets = nodes.filter((item) => item.selected || item.compiled || item.readiness_passed);
  const previous = select.value;
  select.innerHTML = targets.map((item) => `<option value="${item.id}">${item.project.toUpperCase()} · ${item.dataset} · ${item.label}</option>`).join("");
  if (targets.some((item) => item.id === previous)) select.value = previous;
  else if (targets.length) select.value = targets.find((item) => item.readiness_passed)?.id || targets[0].id;
  drawLineage(select.value);
}

function drawLineage(targetId) {
  const all = lineageNodes();
  const byId = new Map(all.map((item) => [item.id, item]));
  const target = byId.get(targetId);
  const includedIds = ancestors(target, byId);
  const nodes = all.filter((item) => includedIds.has(item.id));
  const groups = new Map();
  nodes.forEach((node) => { if (!groups.has(node.generation)) groups.set(node.generation, []); groups.get(node.generation).push(node); });
  const generations = [...groups.keys()].sort((a,b) => a-b);
  const positions = new Map();
  const width = Math.max(680, generations.length * 190 + 80);
  const height = Math.max(490, Math.max(...[...groups.values()].map((group) => group.length), 1) * 95 + 80);
  generations.forEach((generation, column) => groups.get(generation).forEach((node, row) => positions.set(node.id, { x: 30 + column * 185, y: 35 + row * 90 })));
  const edges = nodes.flatMap((node) => node.parents.filter((parent) => positions.has(parent)).map((parent) => {
    const a = positions.get(parent), b = positions.get(node);
    return `<path class="dag-edge ${node.id === targetId ? "active" : ""}" d="M ${a.x+140} ${a.y+30} C ${a.x+160} ${a.y+30}, ${b.x-20} ${b.y+30}, ${b.x} ${b.y+30}"/>`;
  })).join("");
  const marks = nodes.map((node) => {
    const p = positions.get(node); const tone = node.id === targetId ? "active" : node.readiness_passed ? "ready" : node.compiled ? "compiled" : "";
    return `<g class="dag-node ${tone}" data-dag-id="${node.id}" transform="translate(${p.x},${p.y})"><rect width="140" height="60"></rect><text x="10" y="23">${node.label.slice(0,18)}</text><text class="node-meta" x="10" y="43">G${node.generation} · ${node.dataset}</text></g>`;
  }).join("");
  const svg = document.querySelector("#lineage-dag");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`); svg.innerHTML = edges + marks;
  svg.querySelectorAll("[data-dag-id]").forEach((node) => node.addEventListener("click", () => { document.querySelector("#lineage-target").value = node.dataset.dagId; drawLineage(node.dataset.dagId); }));
  document.querySelector("#lineage-detail").innerHTML = target ? `<h3>${target.label}</h3><p>${target.public_title || "Scientific content remains private; lineage and delivery status are shown publicly."}</p><dl><dt>Project and dataset</dt><dd>${target.project.toUpperCase()} · ${target.dataset}</dd><dt>Generation</dt><dd>${target.generation}</dd><dt>Parents</dt><dd>${target.parents.map((id) => byId.get(id)?.label || id).join(", ") || "Seed hypothesis"}</dd><dt>Status</dt><dd>${target.readiness_passed ? "Readiness passed" : target.compiled ? "Compiled" : target.selected ? "Selected" : "Candidate"}</dd></dl>` : "<p>No lineage is available for this filter.</p>";
}

function render() {
  renderFunnel(); renderPrograms(); renderProgress(); renderPublished();
  document.querySelectorAll("[data-project]").forEach((button) => button.classList.toggle("active", button.dataset.project === state.project));
}

document.querySelectorAll("[data-project]").forEach((button) => button.addEventListener("click", () => { state.project = button.dataset.project; render(); }));
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item === button));
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`#${button.dataset.view}-view`).classList.add("active");
}));
document.querySelector("#lineage-target").addEventListener("change", (event) => drawLineage(event.target.value));

function loadSnapshot() {
  fetch(`data/public-snapshot.json?t=${Date.now()}`, { cache: "no-store" })
    .then((response) => { if (!response.ok) throw new Error(`Snapshot request failed (${response.status})`); return response.json(); })
    .then((snapshot) => {
      const changed = !state.snapshot || state.snapshot.generated_at !== snapshot.generated_at;
      state.snapshot = snapshot;
      document.querySelector("#freshness").textContent = `Live · updated ${new Date(snapshot.generated_at).toLocaleString()}`;
      document.querySelector("#coverage-badge").textContent = snapshot.complete ? "Complete snapshot" : "Partial snapshot";
      document.querySelector("#coverage-badge").classList.toggle("good", snapshot.complete);
      document.querySelector("#error").hidden = true;
      if (changed) render();
    })
    .catch((error) => {
      const box = document.querySelector("#error"); box.hidden = false; box.textContent = error.message;
      document.querySelector("#freshness").textContent = "Snapshot unavailable";
    });
}

loadSnapshot();
setInterval(loadSnapshot, 60_000);
