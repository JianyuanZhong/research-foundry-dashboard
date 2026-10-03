import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'site'
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
for s in [h]+[d['snapshot'] for d in c['domains']]+[d['snapshot'] for d in a['domains']]:
 ids={n['id'] for n in s['candidates']}
 for n in s['candidates']:
  assert n.get('public_document') or re.fullmatch(r'(Seed|Hypothesis) [a-f0-9]{8}',n['title'])
  assert all(p in ids for p in n['parents'])
  assert n['operation_reason']=='Scientific text is not included in this public release.'
 assert sum(i['closed'] for i in s['islands'])==sum(bool(e['closed_at']) for e in s['episodes'])
print('Public artifact checks passed: three campaigns, counts, lineage and private-material boundary.')

from public_documents import public_document
for item in json.loads((root/'data/environments.json').read_text()).values():
 for field in ['proposal','instructions']:
  if item.get(field):assert public_document(item[field])==item[field]
print('Published environment document checks passed.')
