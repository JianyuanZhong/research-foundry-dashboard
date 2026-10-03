"""Publish explicitly authorized scientific documents, not source rows or credentials."""
import re,hashlib

def public_document(text):
 if not isinstance(text,str):return None
 if len(text)>1000000:raise ValueError('Document exceeds publication limit')
 # Clinical schema names are allowed; concrete patient identifiers are not.
 for pattern in [r'\bsk-[A-Za-z0-9_-]{16,}',r'-----BEGIN [A-Z ]*PRIVATE KEY-----',r'(?i)bearer\s+[a-z0-9._-]{20,}',r'(?i)(?:patientunitstayid|subject_id|hadm_id|patient_id)\s*[=:]\s*[\"\x27]?\d{4,}',r'(?i)(?:api[_ -]?key|auth[_ -]?token|password)\s*[=:]\s*[\"\x27][^\"\x27\n]{8,}']:
  if re.search(pattern,text):raise ValueError('Document requires review before publication')
 # Preserve filenames and scientific field descriptions while removing host paths.
 text=re.sub(r'/(?:data_storage|Users|root|home|tmp)/[^\s`\"\x27<>\)\]\},;]+',lambda m:'[private-path]/'+m.group(0).rstrip('/').split('/')[-1],text)
 return text

def detail(value):
 proposal=public_document(value.get('proposal'));instructions=public_document(value.get('instructions'))
 return {'id':value['id'],'candidate_id':value['candidate_id'],'dataset':value['dataset'],'state':value['state'],'proposal':proposal,'instructions':instructions,'document_status':'Published scientific documents · private host paths redacted; original compiled instruction hash checked' if instructions else 'Original proposal · compilation pending or failed','display_sha256':hashlib.sha256(((proposal or '')+'\n'+(instructions or '')).encode()).hexdigest()}
