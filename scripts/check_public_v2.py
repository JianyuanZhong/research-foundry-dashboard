import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'site'
from public_documents import public_document
for p in root.rglob('*'):
 if not p.is_file():continue
 assert p.suffix in {'.html','.css','.js','.json'},p
 s=p.read_text()
 for marker in ['/data_storage/','/Users/','BEGIN PRIVATE KEY','BEGIN OPENSSH','127.0.0.1','localhost','/api/','encrypted_content']:
  assert marker not in s,(p,marker)
 assert not re.search(r'\bsk-[A-Za-z0-9]{15,}',s),p
c=json.loads((root/'data/current.json').read_text());h=json.loads((root/'data/legacy.json').read_text())
assert len(c['domains'])==4 and c['trial_label']=='novita-luna56-native36-20261003'
assert h['run']['label']=='ehr-luna56-high-20261002' and h['run']['target']==200
assert sum(i['target'] for d in c['domains'] for i in d['snapshot']['islands'])==80
a=json.loads((root/'data/account.json').read_text());assert a['trial_label']=='codex-account-gpt6-luna-20261003' and len(a['domains'])==4
assert all(d['snapshot']['run']['model']=='gpt-6-luna' for d in a['domains'])
assert sum(i['target'] for d in a['domains'] for i in d['snapshot']['islands'])==80
q=json.loads((root/'data/qwen.json').read_text())
qwen_targets={'qwen38-27b-sft-four-domains-20261004':80,'qwen38-27b-sft-draft-first-60-20261004':60}
assert q['trial_label'] in qwen_targets and len(q['domains'])==4
assert q['campaign']['target']==qwen_targets[q['trial_label']]
assert all(d['snapshot']['run']['model']=='qwen38-27b-sft-256k' for d in q['domains'])
assert sum(i['target'] for d in q['domains'] for i in d['snapshot']['islands'])==qwen_targets[q['trial_label']]
for s in [d['snapshot'] for d in q['domains']]+[h]+[d['snapshot'] for d in c['domains']]+[d['snapshot'] for d in a['domains']]:
 ids={n['id'] for n in s['candidates']}
 for n in s['candidates']:
  assert n.get('public_document') or re.fullmatch(r'(Seed|Hypothesis) [a-f0-9]{8}',n['title'])
  assert all(p in ids for p in n['parents'])
  if n.get('public_proposal'):
   assert n.get('proposal_excerpt') and n.get('public_document')
   assert public_document(n['public_proposal'])==n['public_proposal']
  else:assert n['operation_reason']=='Scientific text is not included in this public release.'
 assert sum(i['closed'] for i in s['islands'])==sum(bool(e['closed_at']) for e in s['episodes'])
print('Public artifact checks passed: four campaigns, counts, lineage and private-material boundary.')

for item in json.loads((root/'data/environments.json').read_text()).values():
 for field in ['proposal','instructions']:
  if item.get(field):assert public_document(item[field])==item[field]
print('Published environment document checks passed.')
