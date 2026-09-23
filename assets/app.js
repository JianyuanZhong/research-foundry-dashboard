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
  const hypotheses = state.snapshot.public_hypotheses.filter((item) => state.project === "all" || item.project === state.project);
  const environments = state.snapshot.public_environments.filter((item) => state.project === "all" || item.project === state.project);
  const releases = state.snapshot.releases.filter((item) => state.project === "all" || item.project === state.project);
  document.querySelector("#hypothesis-count").textContent = `${hypotheses.length} public`;
  document.querySelector("#environment-count").textContent = `${environments.length} public`;
  document.querySelector("#hypothesis-empty").hidden = hypotheses.length > 0;
  document.querySelector("#environment-empty").hidden = environments.length > 0;
  document.querySelector("#release-empty").hidden = releases.length > 0;
  document.querySelector("#hypothesis-grid").innerHTML = hypotheses.map((item) => `<article class="hypothesis-card"><h3>${item.title}</h3><p>${item.summary}</p><p>Parents: ${item.parents.join(", ") || "none"}</p></article>`).join("");
  document.querySelector("#environment-list").innerHTML = environments.map((item) => `<article class="environment-card"><h3>${item.name} · ${item.version}</h3><p>${item.validation_summary}</p></article>`).join("");
  document.querySelector("#release-list").innerHTML = releases.map((item) => `<article class="release-card"><h3>${item.name} · ${item.version}</h3><p>${item.released_at}</p></article>`).join("");
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
