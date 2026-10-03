# Research Foundry public observatory

GitHub Pages serves only `site/`. Its landing page opens the rolling four-domain demo; `report.html` compares the current Novita80episode trial, archived EHR200episode-target run, and fresh Codex-account GPT-6 Luna80episode trial.

GitHub Actions requests allowlisted structural snapshots from Phai using a forced-command, restricted SSH key. It is scheduled every five minutes; GitHub scheduling and deployment delays may extend this interval. Browser polling does not imply source updates every few seconds. Publication and deployment delays are displayed through snapshot timestamps. This is a descriptive comparison, not a controlled benchmark.

The user authorized publication of environment proposals and model instructions. These are exported as static documents with private host paths redacted and sensitive-content checks; compiled source instruction hashes are verified. Other hypotheses retain numbered titles. Clinical rows, credentials, raw traces and private packages remain excluded. Export validation scans the entire deployed directory. Old repository files outside `site/` are not part of the Pages artifact.

`python3 scripts/check_public_v2.py` validates the deployment. The private source exporter is `scripts/export_campaigns.py`; it contains no credentials and is run on Phai, not in the browser.

Live mode polls a dedicated public-only feed every10seconds; Phai exports it every120seconds. GitHub Actions remains the archival fallback and updates the feed address if the demo tunnel restarts. The temporary Cloudflare tunnel has no production SLA; the timestamp and backup indicator expose interruptions. Only four sanitized JSON documents and aggregate health are served, never a private API or directory listing.
