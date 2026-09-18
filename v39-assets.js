/* Stage-scoped asset store. At most current + optional next stage retained.
 * Static GitHub Pages compatible. All paths resolve relative to this site's directory.
 */
(() => {
 'use strict';
 const images=new Map(), stages=new Map();let catalog=null,current=null,next=null;
 const required=['normal','happy','curious','sleepy','alert','hurt1','hurt2','hurt3','attack','strong','special','defeated'];
 const url=p=>new URL(p,document.baseURI).href;
 const timeout=15000;
 async function json(path){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
  try{const r=await fetch(url(path),{signal:ctl.signal,cache:'no-store'});if(!r.ok)throw Error(path+' ('+r.status+')');return await r.json();}finally{clearTimeout(timer);}}
 async function getCatalog(){if(!catalog){const v=await json('v39-course.json');if(v.schema!==1||v.version!=='0.39-BODY39'||!Array.isArray(v.stages)||!v.stages.length)throw Error('Invalid course manifest');catalog=v;}return catalog;}
 function image(path){const key=url(path);if(images.has(key))return images.get(key).promise;
  const im=new Image(),entry={im,promise:null};
  entry.promise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>failed(Error('Image timeout: '+path)),timeout);
   function failed(e){clearTimeout(timer);im.onload=null;im.onerror=null;images.delete(key);reject(e);}
   im.onload=async()=>{try{if(!im.naturalWidth)throw Error('Empty image');if(im.decode)await im.decode();clearTimeout(timer);im.onload=null;im.onerror=null;resolve(im);}catch(e){failed(e);}};
   im.onerror=()=>failed(Error('Image not found: '+path));im.src=key;
  });images.set(key,entry);return entry.promise;
 }
 function validate(s){
  if(s.build!=='0.39-BODY39'||s.artRevision!=='body39')throw Error('旧素材が混ざっています。v39のファイル一式で更新してください。');
  for(const p of Object.values(s.poses||{}))if(!/^v39-(korafu|bunker|rough|boss)-(idle|step|ready|hit|down)\.webp$/.test(p.src))throw Error('未確認の画像を拒否しました: '+p.src);
  if(s.schema!==1||!s.id||!s.name||!s.poses||!s.stats)throw Error('Invalid stage');
  for(const k of required)if(!s.poses[k]?.src)throw Error('Missing pose '+k);
  for(const k of ['enemyMax','playerMax','enemyAttack','enemyEvery','attackPerBall','healPerBall'])if(!Number.isFinite(s.stats[k])||s.stats[k]<=0)throw Error('Invalid '+k);
  return s;
 }
 async function prepare(id,onProgress=()=>{}){
  if(stages.has(id)){onProgress(1,1);return stages.get(id);}
  const c=await getCatalog(),record=c.stages.find(s=>s.id===id);if(!record)throw Error('Stage not available: '+id);
  const s=validate(await json(record.manifest));
  const resources=[...new Set([s.background,s.texture,...Object.values(s.poses).map(p=>p.src)].filter(Boolean))];
  let done=0,cursor=0;onProgress(0,resources.length);
  const workers=Array.from({length:Math.min(4,resources.length)},async()=>{
   while(cursor<resources.length){const path=resources[cursor++];await image(path);onProgress(++done,resources.length);}
  });await Promise.all(workers);
  stages.set(id,Object.freeze({...s,resources}));return stages.get(id);
 }
 function releaseExcept(ids){const keep=new Set(ids.filter(Boolean)),urls=new Set();
  for(const [id,stage] of stages)if(keep.has(id))for(const p of stage.resources)urls.add(url(p));
  for(const [id] of stages)if(!keep.has(id))stages.delete(id);
  for(const [key,entry] of images)if(!urls.has(key)){entry.im.onload=null;entry.im.onerror=null;entry.im.removeAttribute('src');images.delete(key);}
 }
 async function activate(id,onProgress){const s=await prepare(id,onProgress);current=id;next=null;releaseExcept([current]);return s;}
 async function prefetchNext(){const c=await getCatalog(),i=c.stages.findIndex(s=>s.id===current),id=c.stages[i+1]?.id;
  if(!id)return null;const s=await prepare(id);next=id;releaseExcept([current,next]);return s;
 }
 window.PazugoruAssets=Object.freeze({getCatalog,prepare,activate,prefetchNext,releaseExcept,
  info:()=>({current,next,stages:[...stages.keys()],imageCount:images.size,urls:[...images.keys()],decodedPixels:[...images.values()].reduce((n,e)=>n+e.im.naturalWidth*e.im.naturalHeight,0)}),
  nextId:()=>{if(!catalog)return null;const i=catalog.stages.findIndex(s=>s.id===current);return catalog.stages[i+1]?.id||null;}});
})();
