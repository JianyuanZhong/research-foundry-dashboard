const state = { project: "all", snapshot: null, treeDataset: null, treeNode: null };
const SNAPSHOT_URL = window.location.protocol === "file:"
  ? "https://jianyuanzhong.github.io/research-foundry-dashboard/data/public-snapshot.json"
  : "data/public-snapshot.json";

const sum = (projects, key) => projects.reduce((total, project) => total + Number(project.metrics[key] || 0), 0);
const visibleProjects = () => state.snapshot.projects.filter((project) => state.project === "all" || project.id === state.project);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

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
  document.querySelector("#environment-list").innerHTML = environments.map((item) => `<button class="environment-card" data-environment-id="${item.id}"><h3>${item.project.toUpperCase()} · ${item.public_id}</h3><p>${item.dataset} environment linked to hypothesis ${item.candidate_public_id}.</p><div class="environment-meta"><span>Compiled</span><span>${item.qa_status.replaceAll("_", " ")}</span><span>Open instructions and proposal</span></div></button>`).join("");
  document.querySelectorAll("[data-environment-id]").forEach((button) => button.addEventListener("click", () => openEnvironment(button.dataset.environmentId)));
  document.querySelector("#release-list").innerHTML = releases.map((item) => `<article class="release-card"><h3>${item.name} · ${item.version}</h3><p>${item.released_at}</p></article>`).join("");
}

function lineageViewIsOpen() {
  return document.querySelector("#lineage-view").classList.contains("active");
}

function lineageNodes() {
  return state.snapshot.lineage.filter((item) => state.project === "all" || item.project === state.project);
}

function renderLineage() {
  const nodes = lineageNodes();
  const datasets = [...new Map(nodes.map((item) => [`${item.project}::${item.dataset}`, { key: `${item.project}::${item.dataset}`, project: item.project, dataset: item.dataset }])).values()]
    .sort((a, b) => a.project.localeCompare(b.project) || a.dataset.localeCompare(b.dataset));
  const select = document.querySelector("#progress-tree-dataset");
  if (!datasets.some((item) => item.key === state.treeDataset)) state.treeDataset = datasets[0]?.key || null;
  select.innerHTML = datasets.map((item) => `<option value="${escapeHtml(item.key)}">${item.project.toUpperCase()} · ${escapeHtml(item.dataset)}</option>`).join("");
  if (state.treeDataset) select.value = state.treeDataset;
  drawProgressTree(state.treeDataset);
}

function drawProgressTree(datasetKey) {
  if (!datasetKey) return;
  const [project, ...datasetParts] = datasetKey.split("::");
  const dataset = datasetParts.join("::");
  const nodes = state.snapshot.lineage.filter((item) => item.project === project && item.dataset === dataset);
  const byId = new Map(nodes.map((item) => [item.id, item]));
  if (!nodes.some((item) => item.id === state.treeNode)) {
    state.treeNode = nodes.find((item) => item.readiness_passed)?.id || nodes.find((item) => item.selected)?.id || nodes.at(-1)?.id || null;
  }
  const groups = new Map();
  nodes.forEach((node) => { if (!groups.has(node.episode)) groups.set(node.episode, []); groups.get(node.episode).push(node); });
  const episodes = [...groups.keys()].sort((a,b) => a-b);
  const positions = new Map();
  const width = Math.max(760, episodes.length * 210 + 80);
  const height = Math.max(520, Math.max(...[...groups.values()].map((group) => group.length), 1) * 92 + 100);
  episodes.forEach((episode, column) => groups.get(episode).sort((a,b) => a.generation - b.generation || a.label.localeCompare(b.label)).forEach((node, row) => positions.set(node.id, { x: 35 + column * 210, y: 45 + row * 92 })));
  const edges = nodes.flatMap((node) => node.parents.filter((parent) => positions.has(parent)).map((parent) => {
    const a = positions.get(parent), b = positions.get(node.id);
    if (!a || !b) return "";
    return `<path class="dag-edge ${node.id === state.treeNode ? "active" : ""}" d="M ${a.x+158} ${a.y+36} C ${a.x+178} ${a.y+36}, ${b.x-20} ${b.y+36}, ${b.x} ${b.y+36}"/>`;
  })).join("");
  const marks = nodes.map((node) => {
    const p = positions.get(node.id); const tone = node.id === state.treeNode ? "active" : node.readiness_passed ? "ready" : node.compiled ? "compiled" : "";
    if (!p) return "";
    const operation = node.operation || "unknown";
    return `<g class="dag-node ${tone} op-${escapeHtml(operation)}" data-dag-id="${node.id}" transform="translate(${p.x},${p.y})"><rect width="158" height="72"></rect><text class="node-operation" x="10" y="19">${escapeHtml(operation)}</text><text x="10" y="39">${escapeHtml(node.label.slice(0,20))}</text><text class="node-meta" x="10" y="58">Episode ${node.episode || "seed"} · G${node.generation}</text></g>`;
  }).join("");
  const headers = episodes.map((episode, column) => `<text class="episode-header" x="${35 + column * 210}" y="20">${episode ? `Episode ${episode}` : "Seeds"} · ${groups.get(episode).length}</text>`).join("");
  const svg = document.querySelector("#lineage-dag");
  svg.style.height = `${Math.min(960, Math.max(520, height))}px`;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`); svg.innerHTML = headers + edges + marks;
  svg.querySelectorAll("[data-dag-id]").forEach((mark) => mark.addEventListener("click", () => { state.treeNode = mark.dataset.dagId; drawProgressTree(datasetKey); }));
  const operations = [...new Set(nodes.map((node) => node.operation || "unknown"))];
  document.querySelector("#operation-legend").innerHTML = operations.map((operation) => `<span class="operation-key op-${escapeHtml(operation)}"><i></i>${escapeHtml(operation)}</span>`).join("");
  document.querySelector("#progress-tree-count").textContent = `${nodes.length} hypotheses · ${episodes.length} episodes`;
  const target = byId.get(state.treeNode);
  const parentLabels = target?.parents.map((id) => byId.get(id)?.label || `External ${id.slice(-8)}`) || [];
  document.querySelector("#lineage-detail").innerHTML = target ? `<h3>${escapeHtml(target.label)}</h3><p>${escapeHtml(target.change_note || "No change note was recorded.")}</p><dl><dt>Lead operation</dt><dd>${escapeHtml(target.operation)}</dd><dt>Episode and generation</dt><dd>Episode ${target.episode || "seed"} · generation ${target.generation}</dd><dt>Created by role</dt><dd>${escapeHtml(target.created_role)}</dd><dt>Parents</dt><dd>${parentLabels.map(escapeHtml).join(", ") || "Seed hypothesis"}</dd><dt>Lead rationale</dt><dd>${escapeHtml(target.operation_reason)}</dd><dt>Episode goal</dt><dd>${escapeHtml(target.operation_goal || "Not recorded")}</dd><dt>Status</dt><dd>${target.readiness_passed ? "Readiness passed" : target.compiled ? "Compiled" : target.selected ? "Selected" : "Proposed"}</dd></dl>` : "<p>No hypotheses are available for this dataset.</p>";
}

function openEnvironment(environmentId) {
  const environment = state.snapshot.environment_progress.find((item) => item.id === environmentId);
  if (!environment) return;
  document.querySelector("#environment-dialog-title").textContent = `${environment.project.toUpperCase()} · ${environment.public_id}`;
  document.querySelector("#environment-dialog-meta").innerHTML = `<span>${environment.dataset}</span><span>${environment.qa_status.replaceAll("_", " ")}</span><span>${environment.candidate_public_id}</span>`;
  document.querySelector("#environment-instructions").textContent = environment.instructions || "Instructions were not available in this compiled package.";
  document.querySelector("#environment-proposal").textContent = environment.proposal || "The originating proposal was not available.";
  document.querySelector("#environment-instructions").scrollTop = 0;
  document.querySelector("#environment-proposal").scrollTop = 0;
  document.querySelector("#environment-dialog").showModal();
}

function synchronizeScroll(source, target) {
  const available = source.scrollHeight - source.clientHeight;
  const targetAvailable = target.scrollHeight - target.clientHeight;
  if (available > 0 && targetAvailable > 0) target.scrollTop = (source.scrollTop / available) * targetAvailable;
}

function render() {
  renderFunnel(); renderPrograms(); renderProgress(); renderPublished();
  if (lineageViewIsOpen()) renderLineage();
  document.querySelectorAll("[data-project]").forEach((button) => button.classList.toggle("active", button.dataset.project === state.project));
}

document.querySelectorAll("[data-project]").forEach((button) => button.addEventListener("click", () => { state.project = button.dataset.project; render(); }));
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item === button));
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`#${button.dataset.view}-view`).classList.add("active");
  if (button.dataset.view === "lineage" && state.snapshot) renderLineage();
}));
document.querySelector("#progress-tree-dataset").addEventListener("change", (event) => { state.treeDataset = event.target.value; state.treeNode = null; drawProgressTree(state.treeDataset); });
document.querySelector("#environment-dialog-close").addEventListener("click", () => document.querySelector("#environment-dialog").close());
document.querySelector("#environment-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) event.currentTarget.close(); });
const proposalPane = document.querySelector("#environment-proposal");
const instructionPane = document.querySelector("#environment-instructions");
let syncingEnvironmentScroll = false;
proposalPane.addEventListener("scroll", () => { if (syncingEnvironmentScroll) return; syncingEnvironmentScroll = true; synchronizeScroll(proposalPane, instructionPane); syncingEnvironmentScroll = false; });
instructionPane.addEventListener("scroll", () => { if (syncingEnvironmentScroll) return; syncingEnvironmentScroll = true; synchronizeScroll(instructionPane, proposalPane); syncingEnvironmentScroll = false; });

function loadSnapshot() {
  fetch(`${SNAPSHOT_URL}?t=${Date.now()}`, { cache: "no-store" })
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
