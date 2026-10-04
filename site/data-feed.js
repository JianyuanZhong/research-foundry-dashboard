'use strict';
(()=>{
 const base=new URL('data/',document.currentScript.src);let config=null,loaded=0;
 async function settings(){if(config&&Date.now()-loaded<60000)return config;try{const r=await fetch(new URL('feed.json?ts='+Math.floor(Date.now()/60000),base),{cache:'no-store',signal:AbortSignal.timeout(5000)});if(r.ok){const c=await r.json();if(!c.url||/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(c.url)){config=c;loaded=Date.now();}}}catch{}return config||{};}
 window.publicSnapshot=async name=>{
  if(!['current','legacy','account','qwen','environments'].includes(name))throw Error('Unknown public snapshot');
  const c=await settings();
  if(c.url){try{const r=await fetch(c.url+'/'+name+'.json',{cache:'no-store',signal:AbortSignal.timeout(12000)});if(r.ok){window.publicFeedMode='live';return r;}}catch{}}
  window.publicFeedMode=c.mode==='mac-publisher'?'published':'fallback';return fetch(new URL(name+'.json?ts='+Math.floor(Date.now()/30000),base),{cache:'no-store',signal:AbortSignal.timeout(15000)});
 };
})();
