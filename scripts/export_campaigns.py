"""Allowlisted, text-free public projection of exactly two campaign snapshots."""
import json,time,urllib.request,sys,re
from pathlib import Path
CURRENT='novita-luna56-native36-20261003'
LEGACY='ehr-luna56-high-20261002'
DOMAINS=['clinical_population','therapeutic_targets','disease_mechanisms','population_multiomics']
NAMES=['Clinical & Population Health Research','Therapeutic Target Prioritization','Disease Mechanisms & Pathway Hypotheses','Population Multi-omics & Disease Targets']
DATASETS=set(DOMAINS+['hcc','mimic','eicu','ukb'])
def ident(v):
 if v is None:return None
 if not isinstance(v,str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,120}',v):raise ValueError('Invalid identifier')
 return v
def number(v):return v if type(v) in (int,float) else 0
def state(v):return v if v in ['running','queued','prepared','settled','succeeded','failed','cancelled','partial','provider_paused','operator_paused','provider_or_operator_paused','pilot_review','generation_budget_paused','budget_accounting_unavailable','selected','incomplete','no_selection','valid','repairable','invalid','pending'] else 'pending'
def project(x,legacy=False):
 expected=LEGACY if legacy else CURRENT
 if not x['run']['label'].startswith(expected):raise ValueError('Unexpected campaign')
 out={'schema':'experiment-dashboard-v1','collected_at':number(x['collected_at']),'domain':'legacy' if legacy else x['domain'],'run':{'label':expected,'model':'pa/gpt-5.6-luna','state':'archived' if legacy else state(x['run']['state']),'target':200 if legacy else 20,'clock':{'start':number(x['run'].get('clock',{}).get('start'))}},'islands':[],'episodes':[],'candidates':[],'workers':[],'jobs':[]}
 def identity(row,keys):
  z={k:ident(row.get(k)) for k in keys}
  for k in ['dataset','source_dataset']:
   if k in row:
    if row[k] not in DATASETS:raise ValueError('Unknown dataset')
    z[k]=row[k]
  return z
 def island(i):
  z={'id':ident(i['id']),**{k:number(i.get(k)) for k in ['target','closed','generated_versions','distinct_selected']}}
  if 'source_islands' in i:z['source_islands']=[island(s) for s in i['source_islands']]
  return z
 out['islands']=[island(i) for i in x['islands']]
 for e in x['episodes']:out['episodes'].append({**identity(e,['id','selected_id']),'ordinal':number(e['ordinal']),'outcome':state(e.get('outcome')),'closed_at':e.get('closed_at') if type(e.get('closed_at')) in (int,float) else None})
 for c in x['candidates']:
  z={**identity(c,['id','episode_id']),'parents':[ident(i) for i in c['parents']],'generation':number(c['generation']),'created_at':number(c['created_at']),'imported_seed':bool(c['imported_seed']),'selected':bool(c['selected']),'assessment':state(c.get('assessment'))}
  z['operation']=c.get('operation') if c.get('operation') in ['seed','generation','evolve','evolution','repair','crossover','restart'] else 'unrecorded'
  z['title']=('Seed ' if z['imported_seed'] else 'Hypothesis ')+c['id'][-8:]
  z['operation_reason']='Scientific text is not included in this public release.';z['operation_goal']=''
  out['candidates'].append(z)
 for w in ([] if legacy else x['workers']):
  out['workers'].append({**identity(w,['id','episode_id']),'role':w.get('role') if w.get('role') in ['lead','generation','evolution','critique','compiler','progress'] else 'research','work_seq':number(w.get('work_seq'))})
 for j in x['jobs']:
  out['jobs'].append({**identity(j,['id','episode_id','candidate_id']),'operation':j['operation'] if j['operation'] in ['science','compute','compile','validate','calibrate'] else 'other','state':state(j['state']),'created_at':number(j['created_at'])})
 return out

def export(out):
 def get(path):
  with urllib.request.urlopen('http://127.0.0.1:8792'+path,timeout=20) as f:return json.load(f)
 reg=get('/api/domains');assert reg['trial_label']==CURRENT
 root=Path(out);root.mkdir(parents=True,exist_ok=True)
 oldpath=root/'legacy.json'
 old=json.loads(oldpath.read_text()) if oldpath.exists() else project(get('/api/campaign?run=legacy'),True)
 new={'schema':'four-domain-dashboard-v1','trial_label':CURRENT,'domains':[],'campaign':{'state':state(reg['campaign'].get('state')),'closed':number(reg['campaign'].get('closed')),'target':80},'historical_available':True,'previous_trial_available':False,'budget':None,'publication':{'generated_at':time.time(),'content_policy':'Structural progress only; scientific text withheld pending review'}}
 for d in reg['domains']:
  i=DOMAINS.index(d['id']);s=project(d['snapshot'])
  new['domains'].append({'id':DOMAINS[i],'number':i+1,'name':NAMES[i],'target':20,'run':s['run'],'snapshot':s,**{k:number(d[k]) for k in ['closed','generated','workers']}})
 for name,obj in [('current.json',new),('legacy.json',old)]:
  p=root/name;tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(obj,separators=(',',':')));tmp.replace(p)
if __name__=='__main__':export(sys.argv[1])
