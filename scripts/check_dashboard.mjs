import fs from "node:fs";

const snapshot = JSON.parse(fs.readFileSync("data/public-snapshot.json", "utf8"));

for (const project of ["all", "ehr", "battery"]) {
  const all = snapshot.lineage.filter((item) => project === "all" || item.project === project);
  const byId = new Map(all.map((item) => [item.id, item]));
  const targets = all.filter((item) => item.selected || item.compiled || item.readiness_passed);
  for (const target of targets) {
    const included = new Set();
    const visit = (node) => {
      if (!node || included.has(node.id)) return;
      included.add(node.id);
      node.parents.forEach((parent) => visit(byId.get(parent)));
    };
    visit(target);
    const nodes = all.filter((item) => included.has(item.id));
    const groups = new Map();
    nodes.forEach((node) => {
      if (!groups.has(node.generation)) groups.set(node.generation, []);
      groups.get(node.generation).push(node);
    });
    const positions = new Map();
    [...groups.keys()].sort((a, b) => a - b).forEach((generation, column) => {
      groups.get(generation).forEach((node, row) => positions.set(node.id, { x: 30 + column * 185, y: 35 + row * 90 }));
    });
    for (const node of nodes) {
      if (!positions.get(node.id)) throw new Error(`Missing position for ${project}/${target.id}/${node.id}`);
      for (const parent of node.parents.filter((id) => positions.has(id))) {
        if (!positions.get(parent)) throw new Error(`Missing parent position for ${parent}`);
      }
    }
  }
}

for (const environment of snapshot.environment_progress) {
  if (!environment.instructions?.trim()) throw new Error(`Missing instructions for ${environment.id}`);
  if (!environment.proposal?.trim()) throw new Error(`Missing proposal for ${environment.id}`);
}

console.log(`dashboard data verified: ${snapshot.lineage.length} hypotheses, ${snapshot.environment_progress.length} environments`);
