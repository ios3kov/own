#!/usr/bin/env python3
"""Seed only named synthetic gallery images on a selected simulator; never a phone."""
import argparse,base64,hashlib,json,shutil,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--refresh',action='store_true');p.add_argument('--simulator',required=True);p.add_argument('--backup',required=True,type=Path);a=p.parse_args()
bundle='io.github.ios3kov.own'
root=Path(subprocess.check_output(['xcrun','simctl','get_app_container',a.simulator,bundle,'data'],text=True).strip())
if '/CoreSimulator/Devices/' not in str(root):raise SystemExit('Not a simulator')
if a.backup.exists():raise SystemExit('Backup already exists; preserve it')
subprocess.run(['xcrun','simctl','terminate',a.simulator,bundle],capture_output=True)
store=root/'Library/Application Support'/bundle/'RCTAsyncLocalStorage_V1'
a.backup.mkdir(parents=True);shutil.copytree(store,a.backup/'preferences')
manifest=store/'manifest.json';prefs=json.loads(manifest.read_text());key='local-llm-app-storage'
external=store/hashlib.md5(key.encode()).hexdigest();raw=prefs.get(key)
state=json.loads(raw if isinstance(raw,str) else external.read_text());images=state['state'].setdefault('generatedImages',[])
folder=root/'Documents/generated_images';folder.mkdir(parents=True,exist_ok=True)
png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3WQAAAAASUVORK5CYII=')
for suffix in ['one','two']:
 ident='own-qa-gallery-'+suffix;target=folder/(ident+'.png')
 if target.exists() or any(x['id']==ident for x in images):
  if not a.refresh:raise SystemExit('Fixture already exists')
  if target.exists() and target.read_bytes()!=png:raise SystemExit('Fixture bytes changed; refusing overwrite')
  images[:]=[x for x in images if x['id']!=ident]
 target.write_bytes(png)
 images.append(dict(id=ident,prompt='Synthetic gallery QA '+suffix,imagePath=str(target),width=1,height=1,steps=1,seed=1,modelId='qa',createdAt='2026-10-24T00:00:00Z'))
prefs[key]=json.dumps(state);manifest.write_text(json.dumps(prefs))
(a.backup/'identity.json').write_text(json.dumps({'simulator':a.simulator,'container':str(root),'ids':['own-qa-gallery-one','own-qa-gallery-two']}))
print('Seeded two synthetic gallery images; existing preferences backed up and retained')
