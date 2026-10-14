#!/usr/bin/env python3
"""Pinned, reproducible GTNH import. No inferred recipes or synthetic quest hierarchy."""
import argparse, base64, collections, gzip, hashlib, io, json, pathlib, shutil, struct, tarfile, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/data'; CACHE=ROOT/'.sources'
QREV='27e61fbea6e245df80839885460994aa0ef9da9f'; RREV='d200440ea31d0357068a294d7312acf1146de909'
def write(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
def strip(s):
 import re
 return re.sub('§.', '', str(s))
def normalize(v):
 if isinstance(v,dict):return {k.rsplit(':',1)[0]:normalize(x) for k,x in v.items()}
 if isinstance(v,list):return [normalize(x) for x in v]
 return v
def uid(d,p='questID'):
 return base64.urlsafe_b64encode(struct.pack('>qq',d[p+'High'],d[p+'Low'])).decode()
def fetch(name,repo,rev):
 CACHE.mkdir(exist_ok=True); dest=CACHE/(name+'.tar.gz')
 if not dest.exists():
  print('Downloading',repo,rev,flush=True)
  with urllib.request.urlopen(f'https://codeload.github.com/{repo}/tar.gz/{rev}') as r:dest.write_bytes(r.read())
 directory=CACHE/name
 if not directory.exists():
  directory.mkdir()
  with tarfile.open(dest) as t:
   for member in t.getmembers():
    parts=pathlib.PurePosixPath(member.name).parts[1:]
    if not parts:continue
    member.name=str(pathlib.PurePosixPath(*parts));t.extract(member,directory,filter='data')
 return directory

def run():
 q=fetch('quests','GTNewHorizons/GT-New-Horizons-Modpack',QREV)
 r=fetch('recipes','ShadowTheAge/gtnh-data',RREV)
 data=gzip.decompress((r/'data.bin').read_bytes()); ints=struct.unpack('<%di'%(len(data)//4),data)
 def sl(p):return ints[p+1:p+1+ints[p]] if p>=0 else []
 def st(p):return data[p*4+4:p*4+4+ints[p]].decode('utf8') if p>=0 else None
 assert ints[0]==7, 'Unexpected binary schema'
 goods={}; pointers={}; identity=collections.defaultdict(list)
 for kind,head in [('item',1),('fluid',2)]:
  for p in sl(ints[head]):
   g={'id':st(ints[p+4]),'name':strip(st(ints[p+5])),'mod':st(ints[p+6]),'registry':st(ints[p+7]),'icon':ints[p+9], 'nbt':st(ints[p+12]),'kind':kind,'unit':'mB' if kind=='fluid' else 'items','damage':ints[p+16] if kind=='item' else 0}
   goods[g['id']]=g;pointers[p]=g['id']
   if kind=='item':identity[g['id'].split(':',1)[1].split('{',1)[0]].append(g['id'])
 for p in sl(ints[3]):pointers[p]=st(ints[p+4])
 ores={st(ints[p+4]):[pointers[z] for z in sl(ints[p+5])] for p in sl(ints[3])}
 recipes={}; outputs=collections.defaultdict(list)
 for p in sl(ints[5]):
  rid=st(ints[p+4]); typ=ints[p+6]; gt=ints[p+7]; inp=[];out=[]
  for t,g,slot,amount,chance in zip(*[iter(sl(ints[p+5]))]*5):
   entry={'id':pointers[g],'amount':amount,'chance':chance/100,'slot':slot}
   if t==1:entry['alternatives']=ores[pointers[g]]
   (inp if t<3 else out).append(entry)
  meta=[]
  if gt>=0:
   for m in sl(ints[gt+4]):meta.append({'key':st(ints[m]),'value':struct.unpack_from('<d',data,(m+1)*4)[0]})
  rec={'id':rid,'machine':st(ints[typ]),'inputs':inp,'outputs':out,'tier':ints[gt+3] if gt>=0 else -1,'voltage':ints[gt] if gt>=0 else 0,'ticks':ints[gt+1] if gt>=0 else None,'metadata':meta,'special':ints[gt+6] if gt>=0 else 0,'machines':[st(ints[z+4]) for z in sl(ints[typ+5])] + [st(ints[z+4]) for z in sl(ints[typ+3])]}
  recipes[rid]=rec
  for x in out:
   if x['id'] in goods:outputs[x['id']].append(rid)
 # 256 deterministic product shards; all recipe types/metadata are retained.
 buckets=collections.defaultdict(dict)
 for gid,g in goods.items():
  key=hashlib.sha256(gid.encode()).hexdigest()[:16];g['shard']=key;g['recipes']=len(outputs[gid]);
  if outputs[gid]:write(OUT/'recipes'/key[:2]/f'{key}.json',[recipes[x] for x in outputs[gid]])
 for key,bucket in buckets.items():write(OUT/'recipes'/f'{key}.json',bucket)
 write(OUT/'catalog.json',list(goods.values()))
 write(OUT/'identity.json',identity)
 # Atlas splits are generated locally: upstream export has no redistribution license.
 from PIL import Image
 atlas=Image.open(r/'atlas.webp'); used={g['icon'] for g in goods.values() if g['icon']>=0}
 icons=ROOT/'public/assets/items';icons.mkdir(parents=True,exist_ok=True)
 for i in used:
  x=i%256*32;y=i//256*32
  assert x+32<=atlas.width and y+32<=atlas.height
  atlas.crop((x,y,x+32,y+32)).save(icons/f'{i}.webp',lossless=True)
 missing=collections.Counter()
 def enrich(v):
  if isinstance(v,dict):
   result={k:enrich(x) for k,x in v.items()}
   if 'id' in v and ('Count' in v or 'Damage' in v):
    ids=identity.get(f"{v['id']}:{v.get('Damage',0)}",[])
    exact=[i for i in ids if not goods[i]['nbt']]
    nbt=v.get('tag');custom=nbt.get('display',{}).get('Name') if isinstance(nbt,dict) else None
    # Do not equate a custom NBT item to an ordinary item for planning.
    chosen=exact[0] if exact and not nbt else (ids[0] if len(ids)==1 and not nbt else None)
    result['resolved']=goods[chosen] if chosen else None
    result['label']=strip(custom) if custom else (goods[chosen]['name'] if chosen else f"Unknown item ({v['id']}, metadata {v.get('Damage',0)})")
    if not chosen:missing[f"{v['id']}:{v.get('Damage',0)}"]+=1
   if 'FluidName' in v:
    match=next((g for g in goods.values() if g['kind']=='fluid' and g['registry']==v['FluidName']),None)
    result['resolved']=match;result['label']=match['name'] if match else f"Unknown fluid ({v['FluidName']})"
   return result
  if isinstance(v,list):return [enrich(x) for x in v]
  return v
 source=q/'config/betterquesting/DefaultQuests'; quests={}; search=[]
 for f in sorted((source/'Quests').rglob('*.json')):
  raw=json.loads(f.read_text());n=normalize(raw);id=uid(n);prop=n['properties']['betterquesting'];items=enrich(n)
  quests[id]={'id':id,'name':strip(prop['name']),'description':prop['desc'],'icon':enrich(prop['icon']),'prerequisites':[uid(x) for x in n.get('preRequisites',{}).values()],'tasks':items.get('tasks',{}),'rewards':items.get('rewards',{}),'properties':prop,'raw':raw,'source':str(f.relative_to(source))}
 chapters=[]; placements=collections.Counter(); order=[s.split(': ',1)[0] for s in (source/'QuestLinesOrder.txt').read_text().splitlines() if ': ' in s]
 for f in (source/'QuestLines').glob('*/QuestLine.json'):
  n=normalize(json.loads(f.read_text()));cid=uid(n,'questLineID');prop=n['properties']['betterquesting'];nodes=[]
  for file in sorted(f.parent.glob('*.json')):
   if file.name=='QuestLine.json':continue
   d=normalize(json.loads(file.read_text()));id=uid(d);assert id in quests,(file,id)
   nodes.append({'id':id,'name':quests[id]['name'],'icon':quests[id]['icon'],'prerequisites':quests[id]['prerequisites'],'x':d.get('x'),'y':d.get('y'),'width':d.get('sizeX',24),'height':d.get('sizeY',24),'raw':d});placements[id]+=1
  chapters.append({'id':cid,'name':strip(prop['name']),'description':prop['desc'],'icon':enrich(prop['icon']),'nodes':nodes,'raw':json.loads(f.read_text()),'generated':False})
 chapters.sort(key=lambda c:order.index(c['id']) if c['id'] in order else len(order))
 orphan=[id for id in quests if id not in placements]
 chapters.append({'id':'unassigned','name':'Unassigned source quests','description':'These quests have no chapter placement in the source. This arrangement is generated, not an in-game chapter.','generated':True,'nodes':[{'id':id,'name':quests[id]['name'],'icon':quests[id]['icon'],'prerequisites':quests[id]['prerequisites'],'x':(i%9)*100,'y':(i//9)*100,'width':48,'height':48} for i,id in enumerate(orphan)]})
 index=[]
 for c in chapters:
  for node in c['nodes']:
   if node['x'] is None or node['y'] is None:node['x']=0;node['y']=0;node['generated']=True
  write(OUT/'chapters'/f"{c['id']}.json",c)
  index.append({k:v for k,v in c.items() if k not in ['nodes','raw']}|{'count':len(c['nodes'])})
 for id,quest in quests.items():
  paths=[{'id':c['id'],'name':c['name']} for c in chapters if any(n['id']==id for n in c['nodes'])]
  write(OUT/'quests'/f'{id}.json',quest)
  search.append({'id':id,'name':quest['name'],'chapters':paths,'text':strip(' '.join([quest['name'],quest['description'],json.dumps(quest['tasks'],ensure_ascii=False),json.dumps(quest['rewards'],ensure_ascii=False)])) .lower()})
 internal=sum(len(q['prerequisites']) for q in quests.values())
 visible=sum(1 for c in chapters for n in c['nodes'] for p in n['prerequisites'] if p in {node['id'] for node in c['nodes']})
 external=[{'quest':q['id'],'prerequisite':id} for q in quests.values() for id in q['prerequisites'] if id not in quests]
 ender=[{'quest':q['name'],'id':q['id'],'chapters':[c['name'] for c in chapters if any(n['id']==q['id'] for n in c['nodes'])]} for q in quests.values() if 'enderio' in q['name'].lower() or 'ender io' in q['name'].lower()]
 report={'questRevision':QREV,'recipeRevision':RREV,'questCount':len(quests),'sourceChapters':len(chapters)-1,'navigationEntries':len(chapters),'placements':sum(placements.values()),'unassigned':len(orphan),'internalEdges':internal-len(external),'chapterEdges':visible,'totalNavigationNodes':sum(len(c['nodes']) for c in chapters),'externalEdges':external,'items':len(goods),'recipes':len(recipes),'icons':len(used),'unresolvedQuestIdentities':dict(missing),'enderIO':ender,'questArchiveSha256':hashlib.sha256((CACHE/'quests.tar.gz').read_bytes()).hexdigest(),'recipeArchiveSha256':hashlib.sha256((CACHE/'recipes.tar.gz').read_bytes()).hexdigest()}
 write(OUT/'index.json',{'chapters':index,'stats':{k:report[k] for k in ['questCount','sourceChapters','navigationEntries','placements','unassigned','internalEdges','chapterEdges','totalNavigationNodes']},'questVersion':'2.9.0-beta-3','recipeVersion':'2.9.0-v7','enderIO':ender})
 write(OUT/'search.json',search);write(OUT/'integrity.json',report)
 assets=q/'config/betterquesting/resources/midnight'
 shutil.copy(assets/'textures/gui/midnight_gui.png',ROOT/'public/assets/midnight_gui.png')
 shutil.copy(assets/'bq_themes.json',ROOT/'public/assets/bq_themes.json')
 licenses=ROOT/'docs/licenses';licenses.mkdir(parents=True,exist_ok=True)
 shutil.copy(q/'LICENSE',licenses/'GTNH-CC-BY-NC-SA-4.0.txt');shutil.copy(r/'README.md',licenses/'recipe-export-notice.md')
 with tarfile.open(OUT/'quest-source.tar.gz','w:gz') as t:t.add(source,arcname='DefaultQuests')
 print(json.dumps({k:v for k,v in report.items() if k!='unresolvedQuestIdentities'},indent=2));print('Unresolved identities:',len(missing))

def verify():
 index=json.loads((OUT/'index.json').read_text());r=json.loads((OUT/'integrity.json').read_text());quests=list((OUT/'quests').glob('*.json'))
 assert len(quests)==r['questCount']==3810
 chapters=[json.loads((OUT/'chapters'/f"{c['id']}.json").read_text()) for c in index['chapters']]
 assert len(chapters)==47 and sum(len(c['nodes']) for c in chapters if not c['generated'])==3942
 assert sum(len(c['nodes']) for c in chapters if c['generated'])==67
 catalog=json.loads((OUT/'catalog.json').read_text());ids={g['id'] for g in catalog}
 for g in catalog:assert (ROOT/'public/assets/items'/f"{g['icon']}.webp").exists()
 for c in chapters:
  for n in c['nodes']:
   q=json.loads((OUT/'quests'/f"{n['id']}.json").read_text());assert n['prerequisites']==q['prerequisites']
   if not c['generated']:assert n['x']==n['raw']['x'] and n['y']==n['raw']['y']
 assert r['chapterEdges']==4317 and r['internalEdges']==5450
 print('Verified 3,810 quests, 46 source chapters + 67 unassigned quests, 3,942 source placements + 67 generated nodes, 4,317 chapter edges / 5,450 internal prerequisites, and every catalogue icon.')
if __name__=='__main__':
 if '--verify' in __import__('sys').argv:verify()
 else:run()
