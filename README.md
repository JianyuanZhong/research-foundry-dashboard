# Research Foundry Dashboard

Public, static dashboard for approved projections from the private EHR and Battery hypothesis-discovery systems.

## Privacy boundary

This repository accepts only `research-foundry-public-v1` snapshots. It must not contain source datasets, clinical rows or notes, licensed papers, credentials, absolute private paths, raw trajectories, dataset bindings, reference solutions, private tests, or private validation scripts.

The dashboard has no connection to Phai Labs or the private registry. A cluster-local publisher writes the approved JSON snapshot into this repository and GitHub Pages deploys it.

## Local preview

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.
