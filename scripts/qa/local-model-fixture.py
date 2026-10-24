#!/usr/bin/env python3
"""Isolated simulator-only engine smoke fixture; never shipped in the app."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['seed', 'restore'])
parser.add_argument('--simulator', required=True)
parser.add_argument('--backup', required=True, type=Path)
parser.add_argument('--model', type=Path)
args = parser.parse_args()
bundle = 'io.github.ios3kov.own'
root = Path(subprocess.check_output(['xcrun', 'simctl', 'get_app_container', args.simulator, bundle, 'data'], text=True).strip())
if '/CoreSimulator/Devices/' not in str(root):
    raise SystemExit('Not a simulator container')
subprocess.run(['xcrun', 'simctl', 'terminate', args.simulator, bundle], capture_output=True)
store = root/'Library/Application Support'/bundle/'RCTAsyncLocalStorage_V1'
model = root/'Documents/models/own-qa-stories15M.gguf'
expected_hash = '66967fbece6dbe97886593fdbb73589584927e29119ec31f08090732d1861739'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

if args.action == 'restore':
    if not model.is_file() or digest(model) != expected_hash:
        raise SystemExit('Fixture model missing or changed; preserve backup')
    # Restore this dedicated simulator's pre-test preferences, including external
    # AsyncStorage value files. No other simulator or project folder is touched.
    paths = list(store.iterdir())
    if any(not path.is_file() for path in paths):
        raise SystemExit('Unexpected preferences subdirectory; preserve backup')
    if not (args.backup/'preferences/manifest.json').is_file():
        raise SystemExit('Original backup missing; preserve current data')
    for path in paths:
        path.unlink()
    shutil.copytree(args.backup/'preferences', store, dirs_exist_ok=True)
    model.unlink()
    print('Restored pre-model-test simulator preferences; removed the exact QA model')
else:
    if args.backup.exists() or model.exists():
        raise SystemExit('Backup or fixture already exists; refusing to overwrite')
    if not args.model or digest(args.model) != expected_hash:
        raise SystemExit('Expected hash-checked tiny engine fixture')
    args.backup.mkdir(parents=True)
    shutil.copytree(store, args.backup/'preferences')
    manifest = store/'manifest.json'
    prefs = json.loads(manifest.read_text())
    def read(key, default):
        raw = prefs.get(key)
        path = store/hashlib.md5(key.encode()).hexdigest()
        return json.loads(raw if isinstance(raw, str) else path.read_text()) if raw is not None or path.exists() else default
    model.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(args.model, model)
    models = read('@local_llm/downloaded_models', [])
    models.append({'id':'own-qa-local-llama','name':'Own QA local model','author':'QA fixture','engine':'llama','filePath':str(model),'fileName':model.name,'fileSize':model.stat().st_size,'quantization':'Q4_0','downloadedAt':'2026-10-24T00:00:00Z'})
    prefs['@local_llm/downloaded_models'] = json.dumps(models)
    state = read('local-llm-app-storage', {'state':{},'version':0})
    state['state']['activeModelId'] = None
    state['state'].setdefault('settings', {}).update({'contextLength':512,'maxTokens':32,'enableGpu':False,'gpuLayers':0,'nThreads':2,'nBatch':64,'flashAttn':False,'cacheType':'f16','inferenceBackend':'cpu','enabledTools':[],'readRepliesAloud':False,'historyTurns':4})
    prefs['local-llm-app-storage'] = json.dumps(state)
    manifest.write_text(json.dumps(prefs))
    print('Seeded tiny local engine fixture; choose it explicitly in the normal model picker')
