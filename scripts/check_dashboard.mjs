import fs from "node:fs";

const snapshot = JSON.parse(fs.readFileSync("data/public-snapshot.json", "utf8"));

const trees = new Map();
for (const node of snapshot.lineage) {
  for (const field of ["episode", "operation", "operation_reason", "created_role"]) {
    if (node[field] === undefined || node[field] === null || node[field] === "") throw new Error(`Missing ${field} for ${node.id}`);
  }
  const key = `${node.project}::${node.dataset}`;
  if (!trees.has(key)) trees.set(key, []);
  trees.get(key).push(node);
}
for (const [key, nodes] of trees) {
  const groups = new Map();
  nodes.forEach((node) => {
    if (!groups.has(node.episode)) groups.set(node.episode, []);
    groups.get(node.episode).push(node);
  });
  const positions = new Map();
  [...groups.keys()].sort((a, b) => a - b).forEach((episode, column) => {
    groups.get(episode).forEach((node, row) => positions.set(node.id, { x: 35 + column * 210, y: 45 + row * 92 }));
  });
  for (const node of nodes) {
    if (!positions.get(node.id)) throw new Error(`Missing position for ${key}/${node.id}`);
    for (const parent of node.parents.filter((id) => positions.has(id))) {
      if (!positions.get(parent)) throw new Error(`Missing parent position for ${key}/${parent}`);
    }
  }
}

for (const environment of snapshot.environment_progress) {
  if (!environment.instructions?.trim()) throw new Error(`Missing instructions for ${environment.id}`);
  if (!environment.proposal?.trim()) throw new Error(`Missing proposal for ${environment.id}`);
}

console.log(`dashboard data verified: ${snapshot.lineage.length} hypotheses across ${trees.size} research trees, ${snapshot.environment_progress.length} environments`);
