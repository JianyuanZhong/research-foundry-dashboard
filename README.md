# Research Foundry public observatory

GitHub Pages serves only `site/`. Its landing page opens the rolling four-domain demo; `report.html` compares the current 80-episode trial with the archived 200-episode-target EHR run.

GitHub Actions requests allowlisted structural snapshots from Phai using a forced-command, restricted SSH key. It is scheduled every five minutes; GitHub scheduling and deployment delays may extend this interval. Browser polling does not imply source updates every few seconds. Publication and deployment delays are displayed through snapshot timestamps. This is a descriptive comparison, not a controlled benchmark.

Scientific text is withheld pending separate review. Only numbered hypotheses, ancestry, recorded operations, selection and aggregate execution metadata are exported. No environment detail API, clinical rows, credentials, raw traces or private packages are public. Export validation scans the entire deployed directory. Old repository files outside `site/` are not part of the Pages artifact.

`python3 scripts/check_public_v2.py` validates the deployment. The private source exporter is `scripts/export_campaigns.py`; it contains no credentials and is run on Phai, not in the browser.
