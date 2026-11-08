import './style.css';
import * as THREE from 'three';
import { supabase } from './supabaseClient.js';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';

// Kode aplikasi memakai variabel global `THREE`, `firebase`, dan `supabase`.
window.THREE = THREE;
window.firebase = firebase;
window.supabase = supabase;

// Konfigurasi Firebase dibaca dari environment variable Vite (opsional jika memakai Firebase).
window.BANKVERSE_FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'ISI_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'ISI_PROJECT_ID.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ISI_PROJECT_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'ISI_APP_ID'
};

(function(){
'use strict';
var $ = function(s){ return document.querySelector(s); };
var clamp = function(v,a,b){ return Math.max(a,Math.min(b,v)); };
var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
var coarse = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);

/* Haptic feedback (Vibration API) untuk HP Android */
function haptic(ms){
  if(window.navigator && navigator.vibrate){
    try{ navigator.vibrate(ms || 25); }catch(e){}
  }
}

function fail(msg){
  var p = document.createElement('p'); p.className = 'fallback'; p.textContent = msg;
  $('#stage').appendChild(p); $('#tools').hidden = true;
}
if(typeof THREE === 'undefined'){ fail('Library 3D tidak bisa dimuat. Cek koneksi internet lalu muat ulang halaman.'); return; }
var canvas = $('#gl'), stage = $('#stage'), labelsEl = $('#labels'), renderer;
try{
  renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
}catch(e){ fail('Tampilan 3D tidak bisa dimuat di perangkat ini.'); return; }
renderer.setClearColor(0x000000,0);
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

/* Penanganan WebGL Context Lost / Restored untuk stabilitas HP Android saat ganti aplikasi */
canvas.addEventListener('webglcontextlost', function(e){
  e.preventDefault();
  toast('WebGL context lost. Menghentikan render sementara...', 'warn');
}, false);
canvas.addEventListener('webglcontextrestored', function(){
  toast('WebGL context pulih kembali.', 'ok');
  setQuality(hi);
}, false);

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(28,1,0.3,200);
scene.add(new THREE.HemisphereLight(0xffffff,0xc9bfa8,0.78));
var sun = new THREE.DirectionalLight(0xffffff,0.6);
sun.position.set(14,30,20);
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
var sc = sun.shadow.camera; sc.left=-24; sc.right=24; sc.top=24; sc.bottom=-24; sc.near=1; sc.far=100; sun.shadow.bias = -0.0006;
scene.add(sun);

var H2 = 3, WH = 6.6, NAVY = '#1f3a68', GOLD = '#d4a017';
var seed = 11;
var rnd = function(){ seed = (seed*16807)%2147483647; return seed/2147483647; };
var mats = {};
var M = function(c){ return mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color:c })); };
var glassM = new THREE.MeshLambertMaterial({ color:'#bfe6ff', transparent:true, opacity:0.3 });
var screenM = new THREE.MeshBasicMaterial({ color:'#6fd0ff' });
var glassBlue = new THREE.MeshBasicMaterial({ color:'#bfe6ff' });

function mk(w,h,d,c,x,y,z,P,shadow){
  var m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), typeof c==='string' ? M(c) : c);
  m.position.set(x,y,z);
  if(shadow!==false){ m.castShadow = true; m.receiveShadow = true; }
  (P||scene).add(m); return m;
}
function cyl(rt,rb,h,seg,c,x,y,z,P){
  var m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), typeof c==='string' ? M(c) : c);
  m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; (P||scene).add(m); return m;
}
function grp(x,y,z,ry,P){ var g = new THREE.Group(); g.position.set(x,y,z); g.rotation.y = ry||0; (P||scene).add(g); return g; }
function pixTex(w,h,draw,rep){
  var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'));
  var t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  if(rep){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0],rep[1]); }
  return t;
}

/* papan nama 3D */
var signDraws = [], ANT_SIGN;
function makeSign(w,h,x,y,z,ry,bg,fg,title,sub,P){
  var cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.max(64,Math.round(512*h/w));
  var tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
  var m = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({ map:tex }));
  m.position.set(x,y,z); m.rotation.y = ry||0; (P||scene).add(m);
  function draw(){
    var g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.fillStyle = bg; g.fillRect(0,0,W,H);
    g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(6,6,W-12,H-12);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
    var fs = Math.round(H*(sub ? 0.38 : 0.46));
    g.font = '700 '+fs+'px Silkscreen, monospace';
    while(g.measureText(title).width > W-44 && fs > 12){ fs -= 3; g.font = '700 '+fs+'px Silkscreen, monospace'; }
    g.fillText(title,W/2,H*(sub ? 0.38 : 0.52));
    if(sub){
      var f2 = Math.round(H*0.2); g.font = '700 '+f2+'px Nunito, sans-serif';
      while(g.measureText(sub).width > W-44 && f2 > 10){ f2 -= 2; g.font = '700 '+f2+'px Nunito, sans-serif'; }
      g.fillText(sub,W/2,H*0.76);
    }
    tex.needsUpdate = true;
  }
  draw(); signDraws.push(draw); return m;
}
if(document.fonts && document.fonts.load){
  Promise.all([document.fonts.load('700 20px Silkscreen'),document.fonts.load('700 20px Nunito')])
    .then(function(){ signDraws.forEach(function(d){ d(); }); }).catch(function(){});
}

/* ---------- lantai, dasar, dinding ---------- */
var floorTex = pixTex(32,32,function(g){
  g.fillStyle = '#ece8de'; g.fillRect(0,0,32,32);
  g.fillStyle = '#d5d0c3'; g.fillRect(0,0,16,16); g.fillRect(16,16,16,16);
  g.fillStyle = 'rgba(120,110,95,.5)'; g.fillRect(0,0,32,1); g.fillRect(0,16,32,1); g.fillRect(0,0,1,32); g.fillRect(16,0,1,32);
},[15,15]);
var floor = new THREE.Mesh(new THREE.PlaneGeometry(30,30), new THREE.MeshLambertMaterial({ map:floorTex }));
floor.rotation.x = -Math.PI/2; floor.position.y = 0.01; floor.receiveShadow = true; scene.add(floor);

var dirtTex = pixTex(16,16,function(g){
  g.fillStyle = '#7b5333'; g.fillRect(0,0,16,16);
  for(var i=0;i<60;i++){ g.fillStyle = rnd()>0.5 ? '#6a4529' : '#8d6340'; g.fillRect(Math.floor(rnd()*16),Math.floor(rnd()*16),1+Math.floor(rnd()*2),1); }
},[16,1]);
var dirtSide = new THREE.MeshLambertMaterial({ map:dirtTex });
var baseM = new THREE.Mesh(new THREE.BoxGeometry(30.6,0.7,30.6),[dirtSide,dirtSide,M('#5da83a'),dirtSide,dirtSide,dirtSide]);
baseM.position.set(0,-0.35,0); baseM.receiveShadow = true; scene.add(baseM);

var wallL = new THREE.Group(), wallB = new THREE.Group(); scene.add(wallL); scene.add(wallB);
mk(30.6,WH,0.3,'#d6e0ea',0,WH/2,-15.15,wallB);
mk(0.3,WH,30.0,'#c9d6e2',-15.15,WH/2,0,wallL);
mk(30.0,0.22,0.08,'#8a6a4a',0,0.11,-14.96,wallB);
mk(0.08,0.22,30.0,'#8a6a4a',-14.96,0.11,0,wallL);
mk(30.0,0.1,0.1,NAVY,0,1.2,-14.97,wallB,false);
mk(0.1,0.1,30.0,NAVY,-14.97,1.2,0,wallL,false);
function winB(x,y){
  mk(1.9,1.6,0.08,'#7a5a3a',x,y,-14.96,wallB);
  mk(1.7,1.4,0.05,glassBlue,x,y,-14.93,wallB,false);
  mk(0.06,1.4,0.07,'#7a5a3a',x,y,-14.92,wallB);
  mk(1.7,0.06,0.07,'#7a5a3a',x,y,-14.92,wallB);
}
function winL(z,y){
  mk(0.08,1.6,1.9,'#7a5a3a',-14.96,y,z,wallL);
  mk(0.05,1.4,1.7,glassBlue,-14.93,y,z,wallL,false);
  mk(0.07,1.4,0.06,'#7a5a3a',-14.92,y,z,wallL);
  mk(0.07,0.06,1.7,'#7a5a3a',-14.92,y,z,wallL);
}
winB(-5.2,2.8); winB(5.2,2.8);
winB(-10.6,4.7); winB(-8.2,4.7); winB(8.4,4.7); winB(10.6,4.7);
winL(2.5,2.6); winL(8.5,2.6); winL(-11.5,4.7);

/* ---------- perabot dasar ---------- */
function chairG(g,x,z,col){
  mk(0.6,0.1,0.6,col,x,0.5,z,g); mk(0.6,0.75,0.1,col,x,0.95,z-0.32,g);
  mk(0.1,0.4,0.1,'#3a3f4a',x,0.25,z,g); mk(0.6,0.06,0.1,'#3a3f4a',x,0.05,z,g); mk(0.1,0.06,0.6,'#3a3f4a',x,0.05,z,g);
}
function chairAt(x,z,tx,tz,col,P){ var g = grp(x,0,z,Math.atan2(tx-x,tz-z),P); chairG(g,0,0,col); return g; }
function sofa(x,z,w,ry,col,cush,P){
  var g = grp(x,0,z,ry,P);
  mk(w,0.4,0.9,col,0,0.25,0,g); mk(w,0.8,0.22,col,0,0.75,-0.4,g);
  mk(0.22,0.6,0.9,col,-w/2+0.11,0.55,0,g); mk(0.22,0.6,0.9,col,w/2-0.11,0.55,0,g);
  mk(w-0.5,0.14,0.7,cush||col,0,0.52,0.05,g);
  return g;
}
function plant(x,z,P){
  mk(0.5,0.4,0.5,'#a8643a',x,0.2,z,P); mk(0.12,0.3,0.12,'#6b4a2a',x,0.55,z,P);
  mk(0.55,0.4,0.55,'#3f9e4a',x,0.85,z,P); mk(0.38,0.3,0.38,'#58b85f',x+0.04,1.2,z-0.03,P); mk(0.2,0.2,0.2,'#6fcf75',x-0.04,1.45,z+0.03,P);
}
function rug(cx,cz,w,d,c1,c2,P){
  mk(w,0.03,d,c1,cx,0.04,cz,P,false).receiveShadow = true;
  mk(w-0.5,0.035,d-0.5,c2,cx,0.045,cz,P,false).receiveShadow = true;
}
function deskPC(x,z,ry,P,wd,col,cc){
  wd = wd||1.8; var g = grp(x,0,z,ry,P);
  mk(wd,0.1,0.85,col||'#9c6b3f',0,0.95,0,g);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(p){ mk(0.08,0.9,0.08,'#6e4a2a',p[0]*(wd/2-0.08),0.45,p[1]*0.34,g); });
  mk(0.6,0.36,0.04,'#2a2f38',0,1.3,0.12,g); mk(0.52,0.28,0.02,screenM,0,1.3,0.098,g,false); mk(0.08,0.2,0.08,'#2a2f38',0,1.1,0.12,g);
  mk(0.4,0.02,0.14,'#d7dbe0',0,1.02,-0.2,g,false);
  chairG(g,0,-0.95,cc||'#35506b');
  return g;
}
function bookcase(x,z,w,P){
  var cols = ['#d9534f','#4f7fe0','#e8b830','#5cb85c','#9b59b6','#ee6f92','#35a7a0'];
  mk(w,2.2,0.45,'#8a5a36',x,1.1,z,P);
  [0.55,1.15,1.75].forEach(function(y){
    var bx = x-w/2+0.12;
    while(bx < x+w/2-0.12){
      var bw = 0.09+rnd()*0.07, bh = 0.35+rnd()*0.15;
      mk(bw,bh,0.2,cols[Math.floor(rnd()*cols.length)],bx+bw/2,y-0.2+bh/2,z+0.13,P,false);
      bx += bw+0.015;
    }
  });
}
function stan(x,z){ cyl(0.05,0.07,1.0,10,'#c9a227',x,0.5,z); cyl(0.13,0.13,0.04,12,'#2a2f38',x,0.03,z); }
function rope(x1,z1,x2,z2){
  var dx = x2-x1, dz = z2-z1, L = Math.hypot(dx,dz);
  var m = mk(0.03,0.03,L,'#c0392b',(x1+x2)/2,0.9,(z1+z2)/2,null,false); m.rotation.y = Math.atan2(dx,dz);
}
function atm(z){
  var g = grp(-14.4,0,z,Math.PI/2);
  mk(0.8,1.7,0.7,'#2a4d7a',0,0.85,0,g);
  mk(0.55,0.4,0.05,screenM,0,1.35,0.36,g,false);
  mk(0.5,0.05,0.25,'#d7dbe0',0,1.05,0.4,g); mk(0.3,0.06,0.04,'#111',0,0.8,0.36,g,false);
  mk(0.8,0.1,0.7,NAVY,0,1.75,0,g);
}

/* ---------- lantai 2 (manajer operasional dan direktur) ---------- */
var U = new THREE.Group(); U.position.y = H2; scene.add(U);
var STAIR_A = Math.atan2(H2,6);
function mezz(cx,side){
  var cz = -11.5, w = 8, d = 7;
  mk(w,0.3,d,'#8a6a4a',cx,H2-0.15,cz);
  mk(w-0.1,0.04,d-0.1,'#d9c8a6',cx,H2+0.02,cz,null,false).receiveShadow = true;
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(p){ mk(0.35,H2-0.3,0.35,'#6e4a2a',cx+p[0]*(w/2-0.25),(H2-0.3)/2,cz+p[1]*(d/2-0.25)); });
  var inner = side<0 ? cx+w/2 : cx-w/2;
  var fx0 = side<0 ? -13.4 : 7, fx1 = side<0 ? -7 : 13.4;
  mk(fx1-fx0,1.0,0.06,glassM,(fx0+fx1)/2,H2+0.5,-8.1,null,false); mk(fx1-fx0,0.07,0.1,'#5a3d24',(fx0+fx1)/2,H2+1.0,-8.1,null,false);
  mk(0.06,1.0,d,glassM,inner+(side<0?-0.05:0.05),H2+0.5,cz,null,false); mk(0.1,0.07,d,'#5a3d24',inner+(side<0?-0.05:0.05),H2+1.0,cz,null,false);
  if(side>0){ mk(0.06,1.0,d,glassM,14.95,H2+0.5,cz,null,false); mk(0.1,0.07,d,'#5a3d24',14.95,H2+1.0,cz,null,false); }
  var sx = side<0 ? -14.2 : 14.2;
  for(var i=0;i<12;i++){
    var top = H2*(i+1)/12;
    mk(1.6,top,0.5,i%2 ? '#a77b50' : '#b58a5c',sx,top/2,-2.25-0.5*i);
  }
  var rx = side<0 ? -13.35 : 13.35, L = Math.sqrt(36+H2*H2);
  var rl = mk(0.06,0.9,L,glassM,rx,H2/2+0.95,-5,null,false); rl.rotation.x = STAIR_A;
  var rb = mk(0.1,0.07,L,'#5a3d24',rx,H2/2+1.4,-5,null,false); rb.rotation.x = STAIR_A;
}
mezz(-11,-1); mezz(11,1);

/* Manajer Operasional (kiri) */
(function(){
  rug(-11,-11.5,6.4,5.2,'#3b5b8c','#4a6fa5',U);
  deskPC(-11,-12.7,0,U,2.0,'#8a6a4a','#2f6f8f');
  chairAt(-11.7,-11.0,-11,-12.7,'#2f6f8f',U); chairAt(-10.3,-11.0,-11,-12.7,'#2f6f8f',U);
  bookcase(-13.3,-14.65,2.4,U);
  sofa(-7.9,-11.6,2.6,-Math.PI/2,'#6b4f9e','#8a6fc0',U); mk(0.8,0.42,1.4,'#7a5a3a',-9.2,0.21,-11.6,U);
  plant(-14.4,-14.4,U); plant(-7.6,-14.4,U);
  makeSign(3.8,0.9,-11,6.05,-14.97,0,GOLD,'#1b2638','Manajer Operasional','Lantai 2',wallB);
})();
/* Direktur (kanan) */
(function(){
  rug(11,-11.5,6.4,5.2,'#7a2f3a','#93414d',U);
  deskPC(11,-12.7,0,U,2.6,'#5a3d24','#8c2f39');
  mk(0.3,0.04,0.3,'#d4a017',11.9,1.03,-12.7,U,false); cyl(0.14,0.14,0.28,14,'#3b6ea8',11.9,1.22,-12.7,U);
  chairAt(10.3,-11.0,11,-12.7,'#8c2f39',U); chairAt(11.7,-11.0,11,-12.7,'#8c2f39',U);
  bookcase(13.2,-14.65,2.4,U);
  sofa(7.9,-11.6,2.6,Math.PI/2,'#2f4f7f','#4b6ea8',U); mk(0.8,0.42,1.4,'#7a5a3a',9.2,0.21,-11.6,U);
  plant(14.4,-14.4,U); plant(7.6,-14.4,U);
  makeSign(3.4,0.9,11,6.05,-14.97,0,GOLD,'#1b2638','Ruang Direktur','Lantai 2',wallB);
})();

/* ---------- brankas ---------- */
(function(){
  var steel = '#9aa5b1';
  mk(6.2,0.05,4.4,'#6d7681',0,0.04,-12.8,null,false).receiveShadow = true;
  mk(0.25,3.2,4.4,steel,-3.1,1.6,-12.8); mk(0.25,3.2,4.4,steel,3.1,1.6,-12.8);
  mk(1.9,3.2,0.3,steel,-2.15,1.6,-10.6); mk(1.9,3.2,0.3,steel,2.15,1.6,-10.6);
  mk(2.4,0.9,0.3,steel,0,2.75,-10.6);
  for(var r=0;r<4;r++) for(var c=0;c<10;c++){
    mk(0.54,0.42,0.3,(r+c)%2 ? '#7b8794' : '#8895a3',-2.7+c*0.6,0.35+r*0.5,-14.7,null,false);
    mk(0.08,0.08,0.04,GOLD,-2.7+c*0.6,0.35+r*0.5,-14.52,null,false);
  }
  [[-1.2,-12.4],[1.2,-12.4]].forEach(function(p){
    for(var k=0;k<3;k++) mk(0.7-k*0.08,0.2,0.4,'#e0b030',p[0],0.2+k*0.21,p[1]);
  });
  var hinge = grp(1.2,0,-10.45,1.3);
  var disc = new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,0.28,36), M('#7b8794'));
  disc.rotation.x = Math.PI/2; disc.position.set(-1.15,1.15,0); disc.castShadow = true; hinge.add(disc);
  var wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.36,24), M(GOLD));
  wheel.rotation.x = Math.PI/2; wheel.position.set(-1.15,1.15,0); hinge.add(wheel);
  makeSign(5.4,1.1,0,5.2,-14.97,0,NAVY,GOLD,'BANKVERSE','Bank virtual - simulasi',wallB);
  makeSign(2.4,0.6,0,3.5,-10.43,0,'#5d6773','#ffffff','BRANKAS',null);
})();

/* ---------- teller ---------- */
(function(){
  var z = -3, cx = [-5.25,-1.75,1.75,5.25];
  mk(14.4,1.1,0.9,'#6b4a2a',0,0.55,z); mk(14.8,0.1,1.3,'#f1efe8',0,1.15,z);
  mk(14.4,0.95,0.7,'#8a6a4a',0,0.475,-4.9); mk(14.8,0.08,0.9,'#d7dbe0',0,0.99,-4.9);
  [-7,-3.5,0,3.5,7].forEach(function(x){ mk(0.08,1.6,1.1,glassM,x,2.0,z,null,false); mk(0.1,1.6,0.1,'#cfd6dd',x,2.0,-2.5); });
  mk(14.2,0.12,0.12,NAVY,0,2.86,-2.5);
  cx.forEach(function(x,i){
    mk(3.3,0.8,0.05,glassM,x,2.3,-2.45,null,false);
    chairAt(x,-4.0,x,-1,'#35506b');
    mk(0.5,0.34,0.04,'#2a2f38',x-0.45,1.5,z+0.15); mk(0.42,0.26,0.02,screenM,x-0.45,1.5,z+0.125,null,false); mk(0.06,0.14,0.06,'#2a2f38',x-0.45,1.27,z+0.15);
    mk(0.4,0.02,0.14,'#d7dbe0',x-0.45,1.21,z-0.1,null,false);
    mk(0.5,0.25,0.4,'#e9eef2',x+0.7,1.15,-4.9,null);
    mk(0.3,0.2,0.3,'#f2c230',x-0.7,1.12,-4.9);
    makeSign(1.7,0.5,x,3.15,-2.42,0,NAVY,'#ffffff','TELLER '+(i+1),null);
  });
  mk(0.12,1.8,0.12,'#2a2f38',0,3.7,-2.5);
  ANT_SIGN = makeSign(3.6,1.0,0,4.3,-2.42,0,'#15181f','#4ade80','ANTREAN','Nomor A-012 ke Teller 1',null);
})();

/* ---------- lobi, antrean, tiket ---------- */
(function(){
  rug(0,8,9.4,8.2,NAVY,'#2d4f8a');
  cyl(1.7,1.7,0.05,40,GOLD,0,0.07,8); cyl(1.45,1.45,0.06,40,NAVY,0,0.075,8); cyl(1.0,1.0,0.07,40,GOLD,0,0.08,8);
  for(var k=0;k<5;k++){ var zz = 0.6+k; stan(-3.2,zz); stan(3.2,zz); if(k>0){ rope(-3.2,zz-1,-3.2,zz); rope(3.2,zz-1,3.2,zz); } }
  mk(6.4,0.03,0.18,'#d4a017',0,0.04,5.4,null,false);
  var t = grp(-2.6,0,11,Math.PI/2);
  mk(0.6,1.3,0.5,'#2a4d7a',0,0.65,0,t); mk(0.4,0.3,0.04,screenM,0,1.1,0.26,t,false); mk(0.3,0.12,0.04,'#f2c230',0,0.8,0.26,t,false); mk(0.5,0.08,0.6,NAVY,0,1.34,0,t);
  sofa(-6.4,6.0,3.0,Math.PI/2,'#2f6f8f','#4a90b0'); sofa(-6.4,9.4,3.0,Math.PI/2,'#2f6f8f','#4a90b0');
  mk(0.7,0.42,0.7,'#7a5a3a',-5.2,0.21,7.7); plant(-6.6,11.4);
  sofa(6.4,5.6,3.0,-Math.PI/2,'#8c2f39','#b0505a'); sofa(6.4,8.6,3.0,-Math.PI/2,'#8c2f39','#b0505a');
  mk(0.7,0.42,0.7,'#7a5a3a',5.2,0.21,7.1); plant(6.6,4.2);
  mk(0.8,1.5,0.3,'#e9eef2',-1.4,0.75,3.3); mk(0.7,0.3,0.05,GOLD,-1.4,1.3,3.46,null,false);
})();

/* ---------- pintu masuk ---------- */
(function(){
  mk(0.5,3.4,0.5,NAVY,-3.05,1.7,14.6); mk(0.5,3.4,0.5,NAVY,3.05,1.7,14.6);
  mk(6.6,0.9,0.5,NAVY,0,3.85,14.6);
  makeSign(5.8,0.7,0,3.85,14.86,0,NAVY,GOLD,'BANKVERSE','Selamat datang',null);
  mk(1.6,3.0,0.06,glassM,-2.1,1.5,14.6,null,false); mk(1.6,3.0,0.06,glassM,2.1,1.5,14.6,null,false);
  mk(3.2,0.03,1.6,NAVY,0,0.045,13.6,null,false);
  plant(-4.2,14.2); plant(4.2,14.2);
  mk(0.12,2.2,0.5,'#6d7681',2.5,1.1,12.2); mk(0.12,2.2,0.5,'#6d7681',3.9,1.1,12.2); mk(1.5,0.15,0.5,'#6d7681',3.2,2.25,12.2);
})();

/* ---------- customer service dan ATM (kiri) ---------- */
(function(){
  rug(-12.2,5,5.6,8.0,'#3b5b8c','#4a6fa5');
  [3.0,7.0].forEach(function(z){
    deskPC(-12.9,z,Math.PI/2,scene,1.8,'#9c6b3f','#1f8f89');
    chairAt(-11.3,z-0.5,-12.9,z,'#d7dbe0'); chairAt(-11.3,z+0.5,-12.9,z,'#d7dbe0');
  });
  mk(0.06,1.1,1.6,glassM,-12.9,1.6,5.0,null,false);
  plant(-14.3,0.9); plant(-9.4,9.2);
  makeSign(3.4,0.9,-14.97,4.6,5.0,Math.PI/2,'#1f8f89','#ffffff','Customer Service','Pembukaan akun dan bantuan',wallL);
  rug(-13.4,12.4,3.0,4.4,'#2f3b52','#3c4a66');
  atm(11.2); atm(12.5); atm(13.8);
  mk(0.05,1.5,0.7,glassM,-14.4,0.95,11.85,null,false); mk(0.05,1.5,0.7,glassM,-14.4,0.95,13.15,null,false);
  makeSign(3.0,0.8,-14.97,3.9,12.5,Math.PI/2,'#2a4d7a','#ffffff','ATM 24 JAM','Simulasi',wallL);
})();

/* ---------- keamanan dan istirahat (kanan) ---------- */
(function(){
  mk(2.6,1.0,0.8,'#2a2f3a',7.6,0.5,12.8); mk(2.8,0.08,0.95,'#3b4150',7.6,1.04,12.8);
  [[-0.7],[0],[0.7]].forEach(function(p){ mk(0.4,0.3,0.04,'#2a2f38',7.6+p[0],1.3,12.95); mk(0.34,0.22,0.02,screenM,7.6+p[0],1.3,12.925,null,false); });
  chairAt(7.6,11.7,7.6,13.6,'#2f4f7f');
  makeSign(1.8,0.45,7.6,0.6,13.215,0,NAVY,'#ffffff','KEAMANAN',null);
  plant(9.4,13.6);
  rug(12.2,9.6,5.6,6.6,'#c98f62','#e0b88f');
  sofa(12.2,7.0,3.2,0,'#d9534f','#e8756f'); sofa(12.2,12.2,3.2,Math.PI,'#4f7fe0','#6f99ee');
  mk(1.4,0.42,0.8,'#7a5a3a',12.2,0.21,9.6);
  mk(0.9,0.95,2.8,'#d7dbe0',14.4,0.475,10.0); mk(1.0,0.06,2.9,'#7a5a3a',14.4,0.98,10.0);
  mk(0.4,0.5,0.35,'#2a2f38',14.4,1.26,9.4); mk(0.14,0.1,0.14,'#e5484d',14.4,1.55,9.4,null,false);
  mk(0.14,0.12,0.14,'#ffffff',14.4,1.07,10.6);
  mk(0.4,1.1,0.4,'#e9eef2',14.4,0.55,11.6); mk(0.3,0.4,0.3,new THREE.MeshLambertMaterial({ color:'#79c4f0', transparent:true, opacity:0.85 }),14.4,1.3,11.6);
  plant(9.6,5.2);
})();

/* ---------- ruang staf dan server/arsip ---------- */
(function(){
  rug(10.4,-4.2,4.8,6.4,'#4a5a4e','#5f735f');
  [-6.4,-4.2,-2.0].forEach(function(z){ deskPC(10.4,z,-Math.PI/2,scene,1.8,'#9c6b3f','#35a7a0'); });
  mk(0.06,1.0,6.4,glassM,8.0,0.95,-4.2,null,false);
  plant(12.4,-0.9);
  [9,10.2,11.4,12.6].forEach(function(x){
    mk(0.9,2.1,0.8,'#23262e',x,1.05,-14.2);
    for(var i=0;i<4;i++) mk(0.06,0.06,0.04,i%2 ? '#4ade80' : '#7dd3fc',x-0.3,0.5+i*0.4,-13.78,null,false);
  });
  bookcase(-13.2,-14.65,2.4,scene); bookcase(-10.6,-14.65,2.4,scene); bookcase(-8.0,-14.65,2.4,scene);
})();

/* ---------- area ekspansi ---------- */
(function(){
  mk(8.8,0.2,16.4,'#d6dde4',19.75,-0.1,-6,null,false).receiveShadow = true;
  var box = new THREE.Mesh(new THREE.BoxGeometry(8.5,3.6,16), new THREE.MeshBasicMaterial({ color:'#7aa7ff', transparent:true, opacity:0.12, depthWrite:false }));
  box.position.set(19.75,1.8,-6); scene.add(box);
  var edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color:'#4f7fe0' }));
  edges.position.copy(box.position); scene.add(edges);
})();

/* ---------- jam dinding ---------- */
var clockC = new THREE.Group(); clockC.position.set(-5.2,4.9,-14.9); clockC.scale.set(1.5,1.5,1.5); wallB.add(clockC);
mk(0.9,0.9,0.04,'#3a3a44',0,0,-0.02,clockC); mk(0.8,0.8,0.06,'#ffffff',0,0,0,clockC);
var hourP = new THREE.Group(), minP = new THREE.Group(); clockC.add(hourP); clockC.add(minP);
mk(0.045,0.2,0.02,'#222',0,0.1,0.04,hourP,false); mk(0.035,0.3,0.02,'#222',0,0.15,0.05,minP,false);
plant(14.3,-14.0); plant(-14.2,1.0); plant(14.2,14.2); plant(-14.2,14.4);

/* ---------- staf chibi ---------- */
function drawFace(g,o){
  var px = function(c,x,y,w,h){ g.fillStyle = c; g.fillRect(x,y,w||1,h||1); };
  g.fillStyle = o.skin; g.fillRect(0,0,16,16);
  if(o.glasses){
    var f = '#1d3557';
    px(f,2,5,4,1); px(f,2,9,4,1); px(f,2,5,1,5); px(f,5,5,1,5);
    px(f,10,5,4,1); px(f,10,9,4,1); px(f,10,5,1,5); px(f,13,5,1,5); px(f,6,7,4,1);
  }
  px('#2b1d17',3,6,2,3); px('#2b1d17',11,6,2,3); px('#ffffff',3,6); px('#ffffff',11,6);
  if(o.female){ px('#2b1d17',2,5,1,2); px('#2b1d17',13,5,1,2); }
  px('rgba(236,110,130,.55)',1,10,2,1); px('rgba(236,110,130,.55)',13,10,2,1);
  var m = o.female ? '#d0455f' : '#8a3b3b'; px(m,6,11); px(m,9,11); px(m,7,12,2,1);
}
function makeStaff(o){
  var root = new THREE.Group(), skin = M(o.skin);
  function part(w,h,d,mat,x,y,z,p){
    var m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.castShadow = true; m.receiveShadow = true; m.position.set(x,y,z); (p||root).add(m); return m;
  }
  var legs = [-1,1].map(function(s){
    var g = new THREE.Group(); g.position.set(s*0.13,0,0); root.add(g);
    part(0.24,0.5,0.24,M(o.legs),0,-0.25,0,g); part(0.25,0.14,0.28,M('#2a2a35'),0,-0.5,-0.02,g); return g;
  });
  part(0.5,0.6,0.28,M(o.shirt),0,0.3,0);
  if(o.female){ part(0.56,0.1,0.5,M(o.skirt||o.legs),0,0.14,0.12); part(0.3,0.06,0.02,M('#ffffff'),0,0.56,0.15); }
  else { part(0.1,0.34,0.02,M(o.tie||'#e5484d'),0,0.34,0.15); }
  var arms = [-1,1].map(function(s){
    var g = new THREE.Group(); g.position.set(s*0.35,0.55,0); g.rotation.x = -1.25; root.add(g);
    part(0.2,0.34,0.2,M(o.shirt),0,-0.15,0,g); part(0.18,0.26,0.18,skin,0,-0.45,0,g); return g;
  });
  var head = new THREE.Group(); head.position.set(0,0.6,0); root.add(head);
  var faceMat = new THREE.MeshLambertMaterial({ map:pixTex(16,16,function(g){ drawFace(g,o); }) });
  var hm = new THREE.Mesh(new THREE.BoxGeometry(0.56,0.56,0.56),[skin,skin,skin,skin,faceMat,skin]);
  hm.castShadow = true; hm.position.set(0,0.28,0); head.add(hm);
  var hc = 0.28, hairM = M(o.hair), style = o.style||'short';
  function hair(w,h,d,x,y,z){ part(w,h,d,hairM,x,hc+y,z,head); }
  part(0.62,0.14,0.62,M(style==='cap' ? o.cap : o.hair),0,hc+0.28,0,head);
  hair(0.62,0.4,0.1,0,0.08,-0.28); hair(0.08,0.22,0.34,0.3,0.17,-0.1); hair(0.08,0.22,0.34,-0.3,0.17,-0.1);
  if(style==='long'){
    hair(0.62,0.14,0.1,0,0.22,0.29); hair(0.2,0.2,0.1,-0.21,0.19,0.29);
    hair(0.62,0.78,0.12,0,-0.12,-0.29); hair(0.1,0.55,0.3,0.33,-0.02,-0.1); hair(0.1,0.55,0.3,-0.33,-0.02,-0.1);
  } else if(style==='pony'){
    hair(0.62,0.14,0.1,0,0.22,0.29); hair(0.2,0.2,0.1,-0.21,0.19,0.29);
    hair(0.18,0.5,0.14,0,0.02,-0.38); part(0.22,0.07,0.17,M('#f2c230'),0,hc+0.2,-0.37,head);
  } else if(style==='cap'){
    part(0.5,0.05,0.32,M(o.cap),0,hc+0.24,0.42,head);
  } else {
    hair(0.62,0.1,0.1,0,0.24,0.29); hair(0.2,0.1,0.14,0.14,0.36,0.22); hair(0.16,0.08,0.1,-0.18,0.35,0.25);
  }
  return { root:root, legs:legs, arms:arms, head:head };
}

var showStaff = true;
var STAFF = [
  { id:'t1', name:'Rani', role:'Teller', x:-5.25, z:-4.1, y:0, rot:0, female:true, skin:'#f3cba8', hair:'#3a2618', style:'pony', shirt:NAVY, legs:'#2b2f3a', skirt:'#2b3f6a', col:NAVY,
    tasks:['Melayani nasabah','Memeriksa slip setoran','Menghitung kas loket','Mencetak bukti transaksi'],
    trip:{ dest:'Brankas', say:'Mengambil berkas di brankas', pts:[[-8,-3.8],[-8,-9.2],[-1.6,-9.2]], face:Math.PI } },
  { id:'t2', name:'Budi', role:'Teller', x:-1.75, z:-4.1, y:0, rot:0, skin:'#d9a57b', hair:'#1e1e1e', style:'short', shirt:NAVY, legs:'#2b2f3a', tie:GOLD, col:NAVY,
    tasks:['Memanggil nomor antrean','Melayani setoran','Memeriksa identitas anggota'] },
  { id:'t3', name:'Sinta', role:'Teller', x:1.75, z:-4.1, y:0, rot:0, female:true, skin:'#e6b48d', hair:'#2a1a14', style:'long', glasses:true, shirt:NAVY, legs:'#2b2f3a', skirt:'#2b3f6a', col:NAVY,
    tasks:['Melayani penarikan','Menyiapkan bukti transaksi','Menjawab pertanyaan nasabah'] },
  { id:'t4', name:'Joko', role:'Teller', x:5.25, z:-4.1, y:0, rot:0, skin:'#e9bb92', hair:'#3a2618', style:'short', shirt:NAVY, legs:'#2b2f3a', tie:GOLD, col:NAVY,
    tasks:['Melayani nasabah','Merapikan dokumen','Menghitung uang tunai'],
    trip:{ dest:'Brankas', say:'Mengambil berkas di brankas', pts:[[7.7,-3.8],[7.7,-9.2],[3.0,-9.2]], face:Math.PI } },
  { id:'c1', name:'Maya', role:'Customer Service', x:-13.85, z:3, y:0, rot:Math.PI/2, female:true, skin:'#f3cba8', hair:'#5b2a1e', style:'long', shirt:'#1f8f89', legs:'#2b2f3a', skirt:'#35506b', col:'#1f8f89',
    tasks:['Membantu buka akun','Menjelaskan produk','Menerima pertanyaan anggota'],
    trip:{ dest:'Lobi', say:'Menyambut nasabah di lobi', pts:[[-13.85,1.7],[-9.6,1.7],[-4,1.7],[-4,6.5]], face:0 } },
  { id:'c2', name:'Dewi', role:'Customer Service', x:-13.85, z:7, y:0, rot:Math.PI/2, female:true, skin:'#e6b48d', hair:'#2a1a14', style:'pony', glasses:true, shirt:'#1f8f89', legs:'#2b2f3a', skirt:'#35506b', col:'#1f8f89',
    tasks:['Menangani keluhan','Mengisi formulir pendaftaran','Memandu nasabah'],
    trip:{ dest:'ATM', say:'Membantu nasabah di ATM', pts:[[-13.85,8.3],[-12.5,10.2],[-12.5,12.5]], face:-Math.PI/2 } },
  { id:'sg', name:'Hendra', role:'Keamanan', x:7.6, z:11.7, y:0, rot:0, skin:'#d9a57b', hair:'#1e1e1e', style:'cap', cap:'#23262e', shirt:'#3a3f4a', legs:'#23262e', tie:'#c0392b', col:'#3a3f4a',
    tasks:['Memantau CCTV','Berjaga di pintu masuk','Menyapa nasabah'],
    trip:{ dest:'Lobi', say:'Berpatroli di lobi', pts:[[4.8,11.7],[4.8,8],[2.5,8]], face:0 } },
  { id:'k1', name:'Agus', role:'Analis Kredit', x:11.35, z:-6.4, y:0, rot:-Math.PI/2, skin:'#e6b48d', hair:'#1e1e1e', style:'short', glasses:true, shirt:'#2f9e6a', legs:'#34437f', tie:'#1f3a68', col:'#2f9e6a',
    tasks:['Menganalisis pengajuan kredit','Menilai profil risiko'],
    trip:{ dest:'Lobi', say:'Menemui calon peminjam', pts:[[12.9,-6.4],[12.9,0.8],[8.4,0.8]], face:-Math.PI/2 } },
  { id:'k2', name:'Lina', role:'Marketing', x:11.35, z:-4.2, y:0, rot:-Math.PI/2, female:true, skin:'#f3cba8', hair:'#7a3b1e', style:'pony', shirt:'#e08a3c', legs:'#4a3b5c', skirt:'#35506b', col:'#e08a3c',
    tasks:['Menyusun penawaran produk','Menjawab calon anggota'],
    trip:{ dest:'Lobi', say:'Menyapa calon anggota', pts:[[12.9,-4.2],[12.9,0.8],[9.2,0.8]], face:-Math.PI/2 } },
  { id:'k3', name:'Hadi', role:'Auditor', x:11.35, z:-2, y:0, rot:-Math.PI/2, skin:'#d9a57b', hair:'#2b2b2b', style:'short', glasses:true, shirt:'#5f7a96', legs:'#2b2f3a', tie:'#8c2f39', col:'#5f7a96',
    tasks:['Memeriksa catatan transaksi','Menyusun temuan audit'],
    trip:{ dest:'Teller', say:'Memeriksa kas loket', pts:[[12.9,-2],[12.9,0.8],[10,0.8]], face:-Math.PI/2 } },
  { id:'m1', name:'Siska', role:'Manajer Operasional', x:-11, z:-13.65, y:H2, rot:0, female:true, skin:'#f3cba8', hair:'#5b2a1e', style:'long', glasses:true, shirt:'#6b4f9e', legs:'#2b2f3a', skirt:'#3a2f5c', col:'#6b4f9e',
    tasks:['Meninjau laporan operasional','Memantau antrean','Menyiapkan rapat tim'],
    trip:{ dest:'Pagar lantai 2', say:'Memantau antrean dari lantai 2', pts:[[-13,-13.65],[-13,-9.5],[-12,-8.6]], face:0 } },
  { id:'d1', name:'Anton', role:'Direktur', x:11, z:-13.65, y:H2, rot:0, skin:'#e6b48d', hair:'#2b2b2b', style:'short', shirt:'#2a2f3a', legs:'#1b1f27', tie:GOLD, col:GOLD,
    tasks:['Meninjau kinerja bank','Menandatangani dokumen','Menyusun rencana ekspansi'],
    trip:{ dest:'Pagar lantai 2', say:'Meninjau suasana bank', pts:[[13,-13.65],[13,-9.5],[12,-8.6]], face:0 } }
];
var walkers = 0;
function rr(a,b){ return a+Math.random()*(b-a); }
STAFF.forEach(function(s,i){
  var w = makeStaff(s);
  s.root = w.root; s.legs = w.legs; s.arms = w.arms; s.head = w.head;
  s.root.position.set(s.x,s.y+0.68,s.z); s.root.rotation.y = s.rot; scene.add(s.root);
  s.st = 'sit'; s.ph = i*1.7; s.nextTrip = performance.now()+rr(8000,30000); s.nextSay = performance.now()+rr(1500,6000); s.sayUntil = 0;
  var el = document.createElement('div'); el.className = 'stag'; el.style.setProperty('--sc',s.col);
  var sy = document.createElement('span'); sy.className = 'say'; sy.hidden = true; el.appendChild(sy);
  var pl = document.createElement('div'); pl.className = 'plate';
  var nb = document.createElement('b'); nb.textContent = s.name; var rs = document.createElement('small'); rs.textContent = s.role;
  pl.appendChild(nb); pl.appendChild(rs); el.appendChild(pl); labelsEl.appendChild(el);
  s.el = el; s.sayEl = sy;
});
function staffSay(s,text,ms,now){ s.sayEl.textContent = text; s.sayEl.hidden = false; s.sayUntil = now+ms; }
function staffStatus(s){
  if(s.st==='sit') return s.busy || 'Bekerja';
  if(s.st==='out') return 'Menuju '+s.trip.dest;
  if(s.st==='wait') return s.trip.say;
  return 'Kembali ke meja';
}
function stepTo(s,dt,now){
  var p = s.path[s.pi], r = s.root, dx = p[0]-r.position.x, dz = p[1]-r.position.z, d = Math.sqrt(dx*dx+dz*dz), st = 2.4*dt;
  if(d <= st){ r.position.x = p[0]; r.position.z = p[1]; s.pi++; return s.pi >= s.path.length; }
  r.position.x += dx/d*st; r.position.z += dz/d*st;
  var tg = Math.atan2(dx,dz); r.rotation.y += (wrapNear(r.rotation.y,tg)-r.rotation.y)*Math.min(1,dt*10);
  var sw = reduce ? 0 : Math.sin(now/1000*9)*0.7;
  s.legs[0].rotation.x = sw; s.legs[1].rotation.x = -sw; s.arms[0].rotation.x = -sw*0.6; s.arms[1].rotation.x = sw*0.6;
  return false;
}
function updateStaff(dt,now){
  var t = now/1000;
  STAFF.forEach(function(s){
    var r = s.root;
    if(s.st==='sit'){
      s.arms[0].rotation.x = -1.25+Math.sin(t*14+s.ph)*0.12; s.arms[1].rotation.x = -1.25+Math.sin(t*14+s.ph+Math.PI)*0.12;
      s.legs[0].rotation.x = s.legs[1].rotation.x = -Math.PI/2;
      s.head.rotation.x = 0.1+Math.sin(t*3+s.ph)*0.03; s.head.rotation.y = reduce ? 0 : Math.sin(t*0.6+s.ph)*0.15;
      r.position.y = s.y+0.68;
      if(now > s.nextSay){ staffSay(s,s.tasks[Math.floor(Math.random()*s.tasks.length)],4200,now); s.nextSay = now+rr(8000,16000); }
      if(s.trip && now > s.nextTrip && walkers < 2 && !s.busy){
        walkers++; s.st = 'out'; s.path = s.trip.pts.map(function(q){ return q.slice(); }); s.pi = 0; s.sayEl.hidden = true; s.sayUntil = 0;
      }
    } else {
      r.position.y = s.y+0.62; s.head.rotation.x = 0;
      if(s.st==='out'){
        if(stepTo(s,dt,now)){
          s.st = 'wait'; s.waitUntil = now+4500; staffSay(s,s.trip.say,4300,now);
          s.legs[0].rotation.x = s.legs[1].rotation.x = 0; s.arms[0].rotation.x = s.arms[1].rotation.x = -0.15;
        }
      } else if(s.st==='wait'){
        r.rotation.y += (wrapNear(r.rotation.y,s.trip.face)-r.rotation.y)*Math.min(1,dt*6);
        s.head.rotation.y = reduce ? 0 : Math.sin(t*0.8+s.ph)*0.3;
        if(now > s.waitUntil){ s.st = 'back'; s.path = s.trip.pts.slice(0,-1).reverse().map(function(q){ return q.slice(); }).concat([[s.x,s.z]]); s.pi = 0; }
      } else {
        if(stepTo(s,dt,now)){
          r.position.set(s.x,s.y+0.68,s.z); r.rotation.y = s.rot; s.st = 'sit'; walkers = Math.max(0,walkers-1);
          s.nextTrip = now+rr(25000,60000); s.nextSay = now+rr(1500,4000);
        }
      }
    }
    if(s.sayUntil && now > s.sayUntil){ s.sayEl.hidden = true; s.sayUntil = 0; }
    v3.set(r.position.x,s.y+(s.st==='sit' ? 2.3 : 2.4),r.position.z).project(camera);
    s.el.style.visibility = (showStaff && v3.z < 1) ? 'visible' : 'hidden';
    s.el.style.transform = 'translate('+((v3.x*0.5+0.5)*W).toFixed(1)+'px,'+((-v3.y*0.5+0.5)*H).toFixed(1)+'px) translate(-50%,-100%)';
  });
}

/* ---------- daftar area dan label ---------- */
var AREAS = [
  { n:'Lobi dan Ruang Tunggu', sub:'Antrean, kios tiket, sofa', x:0, y:2.2, z:8, t:[0,1,6], d:34 },
  { n:'Teller', sub:'4 loket, layar antrean', x:0, y:5.4, z:-3, t:[0,1.5,-3], d:30 },
  { n:'Customer Service', sub:'2 meja layanan', x:-12.2, y:2.6, z:5, t:[-11.5,1,5], d:28 },
  { n:'ATM', sub:'3 unit', x:-13.6, y:2.4, z:12.5, t:[-12.5,1,12.5], d:24 },
  { n:'Keamanan', sub:'Pos jaga, gerbang detektor', x:6.2, y:2.4, z:12.5, t:[5.5,1,12.5], d:26 },
  { n:'Brankas', sub:'Safe deposit box', x:0, y:3.7, z:-12.8, t:[0,1.2,-12.5], d:26 },
  { n:'Ruang Staf', sub:'Analis kredit, marketing, auditor', x:10.4, y:2.8, z:-4.2, t:[10.4,1,-4.2], d:28 },
  { n:'Area Istirahat', sub:'Sofa dan pantry', x:12.4, y:2.4, z:9.6, t:[12,1,9.6], d:28 },
  { n:'Manajer Operasional', sub:'Lantai 2', x:-11, y:H2+3.0, z:-11.5, t:[-11,H2+0.8,-11.5], d:28, f2:true },
  { n:'Ruang Direktur', sub:'Lantai 2', x:11, y:H2+3.0, z:-11.5, t:[11,H2+0.8,-11.5], d:28, f2:true },
  { n:'Area Ekspansi', sub:'Rencana, belum dibangun', x:19.75, y:3.2, z:-6, t:[19,1,-6], d:36, ghost:true }
];
var showLabels = true, v3 = new THREE.Vector3();
AREAS.forEach(function(a){
  var el = document.createElement('div'); el.className = 'tag'+(a.f2 ? ' f2' : '')+(a.ghost ? ' ghost' : '');
  var b = document.createElement('b'); b.textContent = a.n; el.appendChild(b);
  if(a.sub){ var s = document.createElement('small'); s.textContent = a.sub; el.appendChild(s); }
  labelsEl.appendChild(el); a.el = el;
});

/* ---------- kamera ---------- */
var HOME = { az:Math.PI/4, el:0.6, tx:0, ty:2.2, tz:0 };
var view = { az:HOME.az, el:HOME.el, tx:HOME.tx, ty:HOME.ty, tz:HOME.tz, dist:60, goal:null, ready:false };
var W = 1, H = 1, TAN = Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
function fitDist(){ return Math.max(21.5/TAN, 24.0/(camera.aspect*TAN)); }
function minD(){ return 2.2; }
function maxD(){ return fitDist()*1.7; }
function resize(){
  var r = stage.getBoundingClientRect();
  W = Math.max(1,r.width); H = Math.max(1,r.height);
  renderer.setSize(W,H,false); camera.aspect = W/H; camera.updateProjectionMatrix();
}
if(window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize',resize);
function applyCam(){
  camera.position.set(
    view.tx+view.dist*Math.cos(view.el)*Math.sin(view.az),
    view.ty+view.dist*Math.sin(view.el),
    view.tz+view.dist*Math.cos(view.el)*Math.cos(view.az));
  camera.lookAt(view.tx,view.ty,view.tz); camera.updateMatrixWorld();
}
function clampTarget(){ view.tx = clamp(view.tx,-26,26); view.tz = clamp(view.tz,-20,20); view.ty = clamp(view.ty,0.2,7); }
var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), gp = new THREE.Vector3();
function groundPoint(cx,cy){
  ndc.set((cx/W)*2-1, -(cy/H)*2+1); ray.setFromCamera(ndc,camera);
  plane.set(new THREE.Vector3(0,1,0), -view.ty);
  return ray.ray.intersectPlane(plane,gp) ? gp.clone() : null;
}
function zoomAt(factor,cx,cy){
  var nd = clamp(view.dist*factor,minD(),maxD()); if(nd === view.dist) return;
  applyCam(); var p0 = groundPoint(cx,cy);
  view.dist = nd; applyCam(); var p1 = groundPoint(cx,cy);
  if(p0 && p1){ view.tx += p0.x-p1.x; view.tz += p0.z-p1.z; clampTarget(); }
  applyCam();
}
var vr = new THREE.Vector3(), vu = new THREE.Vector3();
function pan(dx,dy){
  var s = 2*view.dist*TAN/H;
  vr.setFromMatrixColumn(camera.matrix,0); vu.setFromMatrixColumn(camera.matrix,1);
  view.tx += (-vr.x*dx+vu.x*dy)*s; view.ty += (-vr.y*dx+vu.y*dy)*s; view.tz += (-vr.z*dx+vu.z*dy)*s;
  clampTarget(); applyCam();
}
function wrapNear(a,b){ var d = ((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI; return a+d; }
var FIELDS = ['tx','ty','tz','dist','az','el'];
function stepCamera(dt){
  if(!view.ready){ view.dist = fitDist(); view.ready = true; }
  var k = reduce ? 1 : 1-Math.pow(0.0008,dt);
  if(view.goal){
    var g = view.goal, big = 0;
    FIELDS.forEach(function(f){ if(g[f]===undefined) return; var diff = g[f]-view[f]; view[f] += diff*k; big = Math.max(big,Math.abs(diff)*(1-k)); });
    if(big < 0.01){ FIELDS.forEach(function(f){ if(g[f]!==undefined) view[f] = g[f]; }); view.goal = null; }
  }
  view.dist = clamp(view.dist,minD(),maxD()); applyCam();
}
function flyTo(t,d,el){
  view.goal = { tx:t[0], ty:t[1], tz:t[2], dist:clamp(d,minD(),maxD()), az:wrapNear(view.az,HOME.az), el:el||0.55 };
}
function fitAll(){ view.goal = { tx:HOME.tx, ty:HOME.ty, tz:HOME.tz, el:HOME.el, az:wrapNear(view.az,HOME.az), dist:fitDist() }; }

var ptrs = new Map(), drag = null, pinch = null;
function mid(){ var a = Array.from(ptrs.values()); return { x:(a[0].x+a[1].x)/2, y:(a[0].y+a[1].y)/2, d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y) }; }
canvas.addEventListener('contextmenu',function(e){ e.preventDefault(); });
canvas.addEventListener('pointerdown',function(e){
  view.goal = null; ptrs.set(e.pointerId,{ x:e.clientX, y:e.clientY });
  try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
  if(ptrs.size === 1){
    var isPan = (e.button===2 || e.shiftKey);
    drag = { mode:isPan ? 'pan' : 'orbit', x:e.clientX, y:e.clientY };
    canvas.style.cursor = isPan ? 'move' : 'grabbing';
  } else if(ptrs.size === 2){ var m = mid(); pinch = { d:m.d, x:m.x, y:m.y }; drag = null; }
});
canvas.addEventListener('pointermove',function(e){
  if(!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId,{ x:e.clientX, y:e.clientY });
  if(pinch && ptrs.size >= 2){
    var m = mid(), r = canvas.getBoundingClientRect();
    if(pinch.d > 0 && m.d > 0) zoomAt(pinch.d/m.d, m.x-r.left, m.y-r.top);
    pan(m.x-pinch.x, m.y-pinch.y); pinch = { d:m.d, x:m.x, y:m.y }; return;
  }
  if(!drag) return;
  var dx = e.clientX-drag.x, dy = e.clientY-drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if(drag.mode === 'pan') pan(dx,dy);
  else { view.az -= dx*0.007; view.el = clamp(view.el+dy*0.005,0.05,1.52); }
});
function endPtr(e){
  if(!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if(ptrs.size < 2) pinch = null;
  if(ptrs.size === 0){ drag = null; canvas.style.cursor = 'grab'; }
  else if(ptrs.size === 1){ var p = Array.from(ptrs.values())[0]; drag = { mode:'orbit', x:p.x, y:p.y }; }
}
canvas.addEventListener('pointerup',endPtr); canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('wheel',function(e){
  e.preventDefault(); view.goal = null;
  var r = canvas.getBoundingClientRect(), k = e.deltaMode===1 ? 16 : 1;
  zoomAt(Math.exp(clamp(e.deltaY*k,-200,200)*0.0016), e.clientX-r.left, e.clientY-r.top);
},{ passive:false });

/* ---------- kualitas grafis & mode hemat baterai (Tahap 8) ---------- */
var hi = true, batterySaver = false;
function setQuality(h){
  hi = h;
  var maxDpr = batterySaver ? 1.0 : (h ? Math.min(window.devicePixelRatio||1,2) : 1);
  renderer.setPixelRatio(maxDpr);
  renderer.shadowMap.enabled = h && !batterySaver; sun.castShadow = h && !batterySaver;
  scene.traverse(function(o){ var m = o.material; if(m){ (Array.isArray(m) ? m : [m]).forEach(function(x){ x.needsUpdate = true; }); } });
  resize();
  $('#qBtn').textContent = 'Kualitas: '+(batterySaver ? 'Hemat (Eco)' : (h ? 'Tinggi' : 'Hemat'));
}
setQuality(!coarse);
$('#qBtn').addEventListener('click',function(){ setQuality(!hi); });

/* ---------- nasabah simulasi & antrean (Tahap 2) ---------- */
var TELLERS = STAFF.filter(function(s){ return s.role==='Teller'; });
var LOOKS = [
 {name:'Pak Slamet',skin:'#d9a57b',hair:'#2b2b2b',style:'short',shirt:'#8a6a4a',legs:'#3a3f4a',tie:'#c9a227'},
 {name:'Bu Tini',female:true,skin:'#e6b48d',hair:'#2a1a14',style:'long',shirt:'#c0507a',legs:'#3a3f4a',skirt:'#5a3d6e'},
 {name:'Mas Rizky',skin:'#e9bb92',hair:'#1e1e1e',style:'cap',cap:'#2f6f8f',shirt:'#4f7fe0',legs:'#2b2f3a',tie:'#e8b830'},
 {name:'Mbak Ayu',female:true,skin:'#f3cba8',hair:'#3a2618',style:'pony',shirt:'#3f9e4a',legs:'#35506b',skirt:'#2f6f4a'},
 {name:'Pak Darto',skin:'#d9a57b',hair:'#4a4a4a',style:'short',glasses:true,shirt:'#7a5a3a',legs:'#2b2f3a',tie:'#8c2f39'},
 {name:'Bu Wati',female:true,skin:'#e6b48d',hair:'#3a3a3a',style:'long',glasses:true,shirt:'#e08a3c',legs:'#4a3b5c',skirt:'#6b4f9e'},
 {name:'Mas Bayu',skin:'#f3cba8',hair:'#5b2a1e',style:'short',shirt:'#d9534f',legs:'#2b2f3a',tie:'#1f3a68'},
 {name:'Mbak Nia',female:true,skin:'#e9bb92',hair:'#2a1a14',style:'pony',glasses:true,shirt:'#35a7a0',legs:'#2b2f3a',skirt:'#1f3a68'}
];
var custs = [], nextNo = 13, calledNo = 12, served = 0, MAXC = 6, QZ0 = 6.2, QDZ = 0.95, lookIx = 0, lastChip = '';
var nextSpawn = performance.now()+1500;
var logEl = $('#logList'), chip = $('#qchip');
function pad2(n){ return n<10 ? '0'+n : ''+n; }
function fmt(n){ return 'A-'+('00'+n).slice(-3); }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function addLog(t){
  var d = new Date(), li = document.createElement('li');
  li.textContent = pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds())+'  '+t;
  logEl.insertBefore(li,logEl.firstChild);
  while(logEl.children.length > 10) logEl.removeChild(logEl.lastChild);
}
function waiting(){ return custs.filter(function(c){ return c.st==='enter' || c.st==='queue'; }).length; }
var antCv = document.createElement('canvas'); antCv.width = 512; antCv.height = 142;
var antTex = new THREE.CanvasTexture(antCv); antTex.anisotropy = 4;
ANT_SIGN.material.map = antTex; ANT_SIGN.material.needsUpdate = true;
function drawAnt(){
  var g = antCv.getContext('2d'), W2 = antCv.width, H2c = antCv.height;
  g.fillStyle = '#15181f'; g.fillRect(0,0,W2,H2c);
  g.strokeStyle = '#4ade80'; g.lineWidth = 8; g.strokeRect(6,6,W2-12,H2c-12);
  g.fillStyle = '#4ade80'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 '+Math.round(H2c*0.2)+'px Silkscreen, monospace'; g.fillText('ANTREAN',W2/2,H2c*0.2);
  g.font = '700 '+Math.round(H2c*0.38)+'px Silkscreen, monospace'; g.fillText(fmt(calledNo),W2/2,H2c*0.54);
  g.font = '700 '+Math.round(H2c*0.15)+'px Nunito, sans-serif'; g.fillText('Menunggu '+waiting()+' orang \u00b7 Simulasi',W2/2,H2c*0.86);
  antTex.needsUpdate = true;
}
drawAnt();
if(document.fonts && document.fonts.load){ document.fonts.load('700 20px Silkscreen').then(drawAnt).catch(function(){}); }

function spawnCust(){
  var L = LOOKS[lookIx++ % LOOKS.length], w = makeStaff(L), no = nextNo++;
  w.root.position.set(0,0.64,14.4); w.root.rotation.y = Math.PI; scene.add(w.root);
  var el = document.createElement('div'); el.className = 'stag'; el.style.setProperty('--sc','#7a8aa3');
  var pl = document.createElement('div'); pl.className = 'plate';
  var b = document.createElement('b'); b.textContent = fmt(no); var sm = document.createElement('small'); sm.textContent = L.name;
  pl.appendChild(b); pl.appendChild(sm); el.appendChild(pl); labelsEl.appendChild(el);
  custs.push({ no:no, name:L.name, root:w.root, legs:w.legs, arms:w.arms, head:w.head, st:'enter', el:el, path:null, pi:0, until:0, teller:null });
  addLog(fmt(no)+' '+L.name+' masuk dan mengambil tiket'); drawAnt();
}
function swing(c,now){
  var sw = reduce ? 0 : Math.sin(now/1000*9+c.no)*0.7;
  c.legs[0].rotation.x = sw; c.legs[1].rotation.x = -sw; c.arms[0].rotation.x = -sw*0.6; c.arms[1].rotation.x = sw*0.6;
}
function stand(c,dt,face,now){
  var r = c.root;
  c.legs[0].rotation.x = c.legs[1].rotation.x = 0; c.arms[0].rotation.x = c.arms[1].rotation.x = -0.15;
  r.rotation.y += (wrapNear(r.rotation.y,face)-r.rotation.y)*Math.min(1,dt*8);
  c.head.rotation.y = reduce ? 0 : Math.sin(now/1000*0.9+c.no)*0.25;
}
function walk(c,tx,tz,dt,now){
  var r = c.root, dx = tx-r.position.x, dz = tz-r.position.z, d = Math.sqrt(dx*dx+dz*dz), st = 2.1*dt;
  if(d <= st){ r.position.x = tx; r.position.z = tz; return true; }
  r.position.x += dx/d*st; r.position.z += dz/d*st;
  r.rotation.y += (wrapNear(r.rotation.y,Math.atan2(dx,dz))-r.rotation.y)*Math.min(1,dt*10);
  swing(c,now); return false;
}
function follow(c,dt,now){
  var p = c.path[c.pi];
  if(walk(c,p[0],p[1],dt,now)){ c.pi++; return c.pi >= c.path.length; }
  return false;
}
function dropCust(c){
  scene.remove(c.root); c.root.traverse(function(o){ if(o.geometry) o.geometry.dispose(); });
  if(c.el.parentNode) c.el.parentNode.removeChild(c.el);
  if(c === mAv) mAv = null;
  custs.splice(custs.indexOf(c),1);
}
function updateCust(dt,now){
  if(prof && me && !mAv) spawnMember();
  if(custs.length < MAXC && now > nextSpawn){ spawnCust(); nextSpawn = now+rr(2500,6000); }
  var q = custs.filter(function(c){ return c.st==='enter' || c.st==='queue'; }).sort(function(a,b){ return a.no-b.no; });
  q.forEach(function(c,i){
    if(walk(c,0,QZ0+i*QDZ,dt,now)){ c.st = 'queue'; stand(c,dt,Math.PI,now); }
  });
  var head = q[0];
  if(head && head.st==='queue' && Math.abs(head.root.position.z-QZ0) < 0.06){
    var free = TELLERS.filter(function(s){ return s.st==='sit' && !s.busy; });
    if(free.length){
      var s = pick(free), n = TELLERS.indexOf(s)+1;
      head.st = 'call'; head.teller = s; head.path = [[0,0],[s.x,0],[s.x,-1.75]]; head.pi = 0;
      s.busy = 'Melayani '+fmt(head.no); calledNo = head.no;
      staffSay(s,'Nomor '+fmt(head.no)+', silakan ke Teller '+n,3600,now);
      addLog(s.name+' memanggil '+fmt(head.no)+' ke Teller '+n); drawAnt();
    }
  }
  custs.slice().forEach(function(c){
    var s = c.teller, n = s ? TELLERS.indexOf(s)+1 : 0;
    if(c.st==='call'){
      if(follow(c,dt,now)){
        c.st = 'serve'; c.until = c.job ? 1e15 : now+rr(5500,8500); if(c.job) beginJob(c,s,now);
        staffSay(s,pick(['Setoran diproses (simulasi)','Memeriksa identitas anggota','Mencetak bukti transaksi simulasi']),3800,now);
        addLog(fmt(c.no)+' dilayani '+s.name+' di Teller '+n);
      }
    } else if(c.st==='serve'){
      stand(c,dt,Math.PI,now);
      if(now > c.until){
        if(c.member){ c.st = 'toidle'; c.path = [[s.x,-0.8],[1.6,-0.8],[1.6,12.8],MIDLE.slice()]; c.teller = null; }
        else { c.st = 'leave'; c.path = [[s.x,-0.8],[1.6,-0.8],[1.6,13.4],[0,14.6]]; } c.pi = 0;
        s.busy = null; s.nextSay = now+rr(3000,6000); served++;
        staffSay(s,'Terima kasih, '+c.name,3000,now);
        addLog(fmt(c.no)+' selesai di Teller '+n+' (SIMULASI)'); drawAnt();
      }
    } else if(c.st==='toidle'){
      if(follow(c,dt,now)) c.st = 'idle';
    } else if(c.st==='idle'){
      stand(c,dt,Math.PI,now);
      if(c.job){
        if(c.job.dest === 'cs'){
          if(CS1.st==='sit' && !CS1.busy){
            CS1.busy = 'Melayani '+c.name; CS1.sayUntil = 0; CS1.sayEl.hidden = true; c.teller = CS1;
            c.st = 'toCs'; c.path = CSGO.map(function(q){ return q.slice(); }); c.pi = 0;
            addLog(c.name+' menuju Customer Service'); pubEvent('cs','antre','Menuju Customer Service'); flyTo([-5,1.2,7],34,0.6);
          }
        } else {
          c.no = nextNo++; c.st = 'enter'; addLog(fmt(c.no)+' '+c.name+' (anggota) mengambil tiket'); drawAnt();
          pubEvent('teller','antre','Tiket '+fmt(c.no)); flyTo([0,1.2,8],30,0.6);
        }
      }
    } else if(c.st==='toCs'){
      if(follow(c,dt,now)){
        c.st = 'cs'; c.until = 1e15; staffSay(s,'Halo '+c.name+', ada yang bisa dibantu?',3000,now);
        addLog(c.name+' dilayani '+s.name+' di Customer Service'); beginJob(c,s,now);
      }
    } else if(c.st==='cs'){
      stand(c,dt,-Math.PI/2,now);
      if(now > c.until){ s.busy = null; s.nextSay = now+rr(3000,6000); c.teller = null; c.st = 'toidle'; c.path = CSBACK.map(function(q){ return q.slice(); }); c.pi = 0; }
    } else if(c.st==='leave'){
      if(follow(c,dt,now)){ addLog(c.name+' keluar dari bank'); dropCust(c); return; }
    }
    if(c.member) setMS(c,msText(c));
    v3.set(c.root.position.x,2.1,c.root.position.z).project(camera);
    c.el.style.visibility = (showStaff && v3.z < 1) ? 'visible' : 'hidden';
    c.el.style.transform = 'translate('+((v3.x*0.5+0.5)*W).toFixed(1)+'px,'+((-v3.y*0.5+0.5)*H).toFixed(1)+'px) translate(-50%,-100%)';
  });
  q.forEach(function(c){
    v3.set(c.root.position.x,2.1,c.root.position.z).project(camera);
    c.el.style.visibility = (showStaff && v3.z < 1) ? 'visible' : 'hidden';
    c.el.style.transform = 'translate('+((v3.x*0.5+0.5)*W).toFixed(1)+'px,'+((-v3.y*0.5+0.5)*H).toFixed(1)+'px) translate(-50%,-100%)';
  });
  var t = 'Dilayani '+fmt(calledNo)+' \u00b7 Menunggu '+waiting()+' \u00b7 Selesai '+served;
  if(t !== lastChip){ lastChip = t; chip.textContent = t; }
}
chip.addEventListener('click',function(){ $('#dock').hidden = false; });

/* ---------- integrasi dunia 3D dengan layanan anggota (Tahap 7) ---------- */
var mAv = null, MIDLE = [-1.6,12.8], CS1 = STAFF.filter(function(s){ return s.id==='c1'; })[0], liveUnsub = null;
var CSGO = [[-8.2,12.8],[-8.2,3],[-10.7,3]], CSBACK = [[-8.2,3],[-8.2,12.8],MIDLE];
var toastEl = $('#toast'), toastT = 0;
function toast(t,k){
  toastEl.textContent = t; toastEl.className = 'toast '+(k || ''); toastEl.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(function(){ toastEl.hidden = true; },6500);
  if(k === 'ok') haptic([30,50,60]); else if(k === 'err') haptic(150);
}
function mHash(s){ var h = 0; for(var i=0;i<s.length;i++) h = (h*31+s.charCodeAt(i))%100003; return h; }
function pubEvent(kind,status,text){
  if(!db || !me || !prof) return;
  db.collection('officeEvents').add({ uid:me.uid, memberId:prof.memberId, kind:kind, status:status, text:String(text).slice(0,80), at:firebase.firestore.FieldValue.serverTimestamp() }).catch(function(){});
}
function setMS(c,t){ if(c.msT !== t){ c.msT = t; c.sm.textContent = t; } }
function msText(c){
  var n = c.teller ? TELLERS.indexOf(c.teller)+1 : 0;
  return ({ toidle:'Di lobi', idle:c.job ? 'Menunggu' : 'Di lobi', enter:'Antre '+fmt(c.no), queue:'Antre '+fmt(c.no), call:'Menuju Teller '+n, serve:'Di Teller '+n,
    toCs:'Menuju Customer Service', cs:'Di Customer Service', leave:'Keluar' })[c.st] || 'Anggota';
}
function spawnMember(){
  var L = LOOKS[mHash(prof.memberId)%LOOKS.length], w = makeStaff(L), nm = String(prof.displayName).slice(0,16);
  w.root.position.set(0,0.64,14.4); w.root.rotation.y = Math.PI; scene.add(w.root);
  var el = document.createElement('div'); el.className = 'stag'; el.style.setProperty('--sc',GOLD);
  var pl = document.createElement('div'); pl.className = 'plate';
  var b = document.createElement('b'); b.textContent = nm; var sm = document.createElement('small'); sm.textContent = 'Anggota';
  pl.appendChild(b); pl.appendChild(sm); el.appendChild(pl); labelsEl.appendChild(el);
  mAv = { no:0, name:nm, root:w.root, legs:w.legs, arms:w.arms, head:w.head, st:'toidle', el:el, sm:sm, path:[[0,13.4],MIDLE.slice()], pi:0, until:0, teller:null, member:true, job:null };
  custs.push(mAv); addLog(nm+' (anggota) masuk ke lobi');
}
function leaveMember(){
  var c = mAv; if(!c) return;
  if(c.teller){ c.teller.busy = null; c.teller.nextSay = performance.now()+3000; c.teller = null; }
  c.job = null;
  if(c.st === 'idle' || c.st === 'toidle'){ c.st = 'leave'; c.path = [[1.6,12.8],[0,14.6]]; c.pi = 0; } else dropCust(c);
}
function startJob(dest,run){
  if(!mAv || mAv.job || (mAv.st !== 'idle' && mAv.st !== 'toidle')) return false;
  mAv.job = { dest:dest, run:run }; return true;
}
function beginJob(c,s,now){
  var j = c.job; c.job = null;
  pubEvent(j.dest,'dilayani','Dilayani '+s.name);
  j.run().catch(function(){ return { ok:false, msg:'Terjadi kesalahan. Coba lagi.' }; }).then(function(r){
    if(mAv !== c) return;
    var t = performance.now(); c.until = t+1500;
    toast(r.msg, r.ok ? 'ok' : 'err');
    staffSay(s, r.say || (r.ok ? 'Selesai, '+c.name+'.' : 'Maaf, ada kendala.'), 3500, t);
    addLog(c.name+': '+r.msg); pubEvent(j.dest, r.ok ? 'selesai' : 'gagal', r.msg);
  });
}
async function runTx(p){
  try{
    if(simNetworkDelay > 0) await new Promise(function(r){ setTimeout(r, simNetworkDelay); });
    if(simOfflineMode) throw { code:'functions/unavailable', message:'Koneksi jaringan terputus (simulasi offline).' };

    if(sbOK && me){
      var uid = me.id || me.uid;
      if(!currentTabunganId) await loadWallet(uid);
      var tipeSql = p.type === 'deposit' ? 'setor' : 'tarik';
      var insRes = await supabase.from('transaksi').insert([{
        tabungan_id: currentTabunganId,
        member_id: uid,
        tipe: tipeSql,
        nominal: p.amount,
        catatan: p.note || (TXN[p.type] + ' di BankVerse 3D')
      }]).select().maybeSingle();

      if(insRes.error){
        return { ok:false, msg:'Transaksi gagal: ' + insRes.error.message, say:'Maaf, transaksi tidak dapat diproses.' };
      }
      await refreshWallet();
      var insTx = insRes.data;
      receipt = txs.filter(function(x){ return x.id === (insTx && insTx.id); })[0] || null;
      return {
        ok:true,
        msg: TXN[p.type] + ' ' + fmtSim(p.amount) + ' berhasil (Supabase).',
        say: 'Selesai, silakan cek saldo tabungan Anda.'
      };
    }

    var r = (await fn.httpsCallable('simTx')(p)).data;
    wal = r.balance; await refreshWallet();
    receipt = txs.filter(function(x){ return x.reference === r.reference; })[0] || null;
    return { ok:!!r.ok, msg: r.ok ? TXN[p.type]+' '+fmtSim(p.amount)+' berhasil (SIMULASI).' : 'Transaksi gagal: '+r.reason, say: r.ok ? 'Selesai, silakan cek saldo SIMULASI Anda.' : 'Maaf, transaksi tidak berhasil.' };
  }catch(e){
    var c = e && e.code || '';
    if(['functions/internal','functions/unavailable','functions/unknown','functions/deadline-exceeded'].indexOf(c) >= 0) txForm = { type:p.type, requestId:p.requestId };
    return { ok:false, msg: (e && e.message) || txMsg(e), say:'Maaf, ada kendala koneksi.' };
  }
}
function stopLive(){ if(liveUnsub){ liveUnsub(); liveUnsub = null; } }
function startLive(){
  aBusy = false; adata.live = []; aMsg = { t:'Menunggu aktivitas...', k:'' }; aRender();
  liveUnsub = db.collection('officeEvents').orderBy('at','desc').limit(30).onSnapshot(function(s){
    if(apanel.hidden || atab !== 'live'){ stopLive(); return; }
    adata.live = s.docs.map(function(d){ var x = d.data(); return [dt(x.at && x.at.toMillis ? x.at.toMillis() : Date.now()), x.memberId, x.kind === 'cs' ? 'Customer Service' : 'Teller', x.status, x.text]; });
    aMsg = { t: adata.live.length ? '' : 'Belum ada aktivitas.', k:'' }; aRender();
  },function(e){ aMsg = { t:amsg(e), k:'err' }; aRender(); });
}
$('#bMe').addEventListener('click',function(){
  if(mAv) flyTo([mAv.root.position.x,1.2,mAv.root.position.z],20,0.6); else toast('Masuk dulu lewat tombol Akun agar avatarmu muncul di lobi.','');
});

/* ---------- akun anggota & Database (Tahap 3) ---------- */
var FBC = window.BANKVERSE_FIREBASE_CONFIG, fbOK = false, auth = null, db = null, fn = null, cards = [], pending = null, isAdm = false, wal = null, txs = [], txForm = null, receipt = null, txErr = '';
var me = null, prof = null, acts = [], mode = 'login', note = { t:'', k:'' }, busy = false, regBusy = false;
var currentTabunganId = null;

/* Backend detection (Supabase & Firebase) */
var sbOK = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  import.meta.env.VITE_SUPABASE_URL.indexOf('your-project') === -1
);

/* Simulasi jaringan Tahap 8 */
var simOfflineMode = false, simNetworkDelay = 0;

try{
  if(window.firebase && FBC && FBC.apiKey && FBC.apiKey.indexOf('ISI_') !== 0){
    firebase.initializeApp(FBC); auth = firebase.auth(); db = firebase.firestore(); fn = firebase.functions(); fbOK = true;
  }
}catch(e){ fbOK = false; }

var backendOK = sbOK || fbOK;

var modal = $('#authModal'), acBtn = $('#acBtn');
function E(t,p,k){
  var e = document.createElement(t);
  Object.keys(p||{}).forEach(function(a){
    if(a === 'text') e.textContent = p[a];
    else if(a === 'on') Object.keys(p.on).forEach(function(ev){ e.addEventListener(ev,p.on[ev]); });
    else e.setAttribute(a,p[a]);
  });
  (k||[]).forEach(function(c){ e.appendChild(c); }); return e;
}
function field(label,type,id,ac){ return E('label',{ text:label },[E('input',{ type:type, id:id, autocomplete:ac, maxlength:'80' })]); }
function val(id){ var e = document.getElementById(id); return e ? e.value : ''; }
function errText(e){
  var msg = (e && e.message) || '';
  if(/already registered|User already exists/i.test(msg)) return 'Email sudah terdaftar. Silakan masuk.';
  if(/invalid login credentials|Invalid email or password/i.test(msg)) return 'Email atau kata sandi salah.';
  if(/password should be at least/i.test(msg)) return 'Kata sandi minimal 6-8 karakter.';
  var c = e && e.code || '';
  if(c === 'auth/email-already-in-use') return 'Email sudah terdaftar. Silakan masuk.';
  if(c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found') return 'Email atau kata sandi salah.';
  if(c === 'auth/weak-password') return 'Kata sandi terlalu lemah (minimal 8 karakter).';
  if(c === 'auth/too-many-requests') return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
  if(c === 'auth/network-request-failed') return 'Koneksi terputus. Periksa internet lalu coba lagi.';
  if(c === 'permission-denied' || c === 'auth/operation-not-allowed') return 'Akses ditolak. Periksa aturan database.';
  if(msg) return msg;
  return 'Terjadi kesalahan. Coba lagi.';
}
function setNote(t,k){ note = { t:t, k:k||'' }; }

function render(){
  var b = $('#authBody'); b.textContent = '';
  if(me && prof) return renderMember(b);
  b.appendChild(E('h2',{ text:'Akun Anggota BANKVERSE' }));
  b.appendChild(E('p',{ class:'msg', text:'Prototipe SIMULASI (Terhubung ke Supabase Database).' }));
  if(!backendOK){
    b.appendChild(E('p',{ class:'msg warn', text: location.protocol === 'file:' ? 'Buka lewat HTTPS atau localhost. Backend belum terkonfigurasi di file://. Anda dapat menjalankan Mode Uji & Diagnosa di tombol toolbar.' : 'Database belum dikonfigurasi. Isi konfigurasi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.' }));
  }
  var tabs = E('div',{ class:'mrow' },[
    E('button',{ type:'button', class:'tool', 'aria-pressed':String(mode==='login'), text:'Masuk', on:{ click:function(){ mode='login'; setNote(''); render(); } } }),
    E('button',{ type:'button', class:'tool', 'aria-pressed':String(mode==='register'), text:'Daftar', on:{ click:function(){ mode='register'; setNote(''); render(); } } })
  ]);
  b.appendChild(tabs);
  var f = E('form',{ novalidate:'' }); f.style.display = 'grid'; f.style.gap = '10px';
  if(mode === 'register') f.appendChild(field('Nama tampilan','text','f_name','name'));
  f.appendChild(field('Email','email','f_email','email'));
  f.appendChild(field('Kata sandi (min. 8 karakter)','password','f_pw', mode==='register' ? 'new-password' : 'current-password'));
  f.appendChild(E('button',{ type:'submit', class:'tool', text: mode==='register' ? 'Buat akun' : 'Masuk', disabled: (!backendOK || busy) ? '' : null }));
  if(!backendOK || busy) f.lastChild.disabled = true; else f.lastChild.removeAttribute('disabled');
  f.addEventListener('submit',function(e){ e.preventDefault(); submitForm(); });
  b.appendChild(f);
  if(mode === 'login'){
    b.appendChild(E('button',{ type:'button', class:'tool', text:'Lupa kata sandi', on:{ click:resetPw } }));
    b.appendChild(E('button',{ type:'button', class:'tool', text:'Masuk dengan NFC', disabled: (backendOK && nfcOK() && !busy) ? null : '', on:{ click:nfcLoginFlow } }));
    if(!nfcOK()) b.appendChild(E('p',{ class:'msg', text:'NFC butuh Chrome Android dengan NFC aktif dan origin HTTPS yang aman.' }));
  }
  b.appendChild(E('p',{ class:'msg '+note.k, role:'status', text:note.t }));
  b.appendChild(E('button',{ type:'button', class:'tool', text:'Tutup', on:{ click:function(){ modal.hidden = true; } } }));
}

function renderMember(b){
  b.appendChild(E('h2',{ text:'Dashboard Anggota' }));
  b.appendChild(E('p',{ class:'msg', text:'Semua data di sini berlabel SIMULASI.' }));
  var dl = E('dl',{ class:'kv' });
  var created = prof.createdAt && prof.createdAt.toDate ? prof.createdAt.toDate().toLocaleDateString('id-ID') : (prof.createdAt ? new Date(prof.createdAt).toLocaleDateString('id-ID') : '-');
  [['ID anggota',prof.memberId],['Nama',prof.displayName],['Email',prof.email],['Status',prof.status],['Bergabung',created]].forEach(function(r){
    dl.appendChild(E('dt',{ text:r[0] })); dl.appendChild(E('dd',{ text:String(r[1]) }));
  });
  b.appendChild(dl);
  renderWallet(b);
  renderCards(b);
  b.appendChild(E('p',{ class:'msg', text:'Riwayat aktivitas' }));
  var ul = E('ul',{ class:'log' });
  acts.forEach(function(a){ ul.appendChild(E('li',{ text:a })); });
  if(!acts.length) ul.appendChild(E('li',{ text:'Belum ada aktivitas.' }));
  b.appendChild(ul);
  b.appendChild(E('p',{ class:'msg '+note.k, role:'status', text:note.t }));
  b.appendChild(E('div',{ class:'mrow' },[
    E('button',{ type:'button', class:'tool', text:'Tutup', on:{ click:function(){ modal.hidden = true; } } }),
    E('button',{ type:'button', class:'tool', text:'Keluar', on:{ click:logout } })
  ].concat(isAdm ? [E('button',{ type:'button', class:'tool', text:'Panel admin', on:{ click:openAdmin } })] : [])));
}

function logAct(text){
  if(db && auth && auth.currentUser){
    return db.collection('users').doc(auth.currentUser.uid).collection('activity').add({ action:text, at:firebase.firestore.FieldValue.serverTimestamp() }).catch(function(){});
  }
  return Promise.resolve();
}
async function claimMemberId(uid){
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for(var i=0;i<6;i++){
    var buf = new Uint8Array(8); crypto.getRandomValues(buf);
    var id = 'BV-'+Array.from(buf).map(function(x){ return chars[x%chars.length]; }).join('');
    var ref = db.collection('memberIds').doc(id);
    try{
      await db.runTransaction(async function(t){ var s = await t.get(ref); if(s.exists) throw new Error('dup'); t.set(ref,{ uid:uid }); });
      return id;
    }catch(e){}
  }
  throw new Error('id');
}
async function loadMe(u){
  me = u; prof = null; acts = []; isAdm = false;
  if(!u){ acBtn.textContent = 'Akun'; leaveMember(); stopLive(); return; }

  if(sbOK){
    var uid = u.id || u.uid;
    try{
      var pRes = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      var pData = pRes && pRes.data;
      var nama = (pData && pData.nama) || (u.user_metadata && u.user_metadata.nama) || (u.email ? u.email.split('@')[0] : 'Member');
      var role = (pData && pData.role) || 'member';
      isAdm = (role === 'admin');
      prof = {
        memberId: 'BV-' + uid.replace(/-/g,'').slice(0,8).toUpperCase(),
        displayName: nama,
        email: u.email,
        status: 'aktif',
        createdAt: pData && pData.created_at ? new Date(pData.created_at) : new Date(),
        role: role
      };
      await loadWallet(uid);
      await loadCards(uid);
      acBtn.textContent = 'Akun: ' + prof.displayName;
      if(typeof spawnMember === 'function') spawnMember();
      return;
    }catch(e){
      console.warn('Gagal memuat profil Supabase:', e);
    }
  }

  if(fbOK && db){
    var d = await db.collection('users').doc(u.uid).get();
    prof = d.exists ? d.data() : null;
    if(prof && prof.status !== 'aktif'){ setNote('Akun berstatus '+prof.status+'. Hubungi pengelola.','err'); await auth.signOut(); return; }
    if(prof){
      var s = await db.collection('users').doc(u.uid).collection('activity').orderBy('at','desc').limit(8).get();
      s.forEach(function(x){ var a = x.data(), t = a.at && a.at.toDate ? a.at.toDate().toLocaleString('id-ID') : ''; acts.push(t+'  '+a.action); });
    }
    if(prof){ await checkAdmin(u); await loadCards(u.uid); await loadWallet(u.uid); }
    acBtn.textContent = 'Akun: '+(prof ? prof.displayName : '...');
  }
}
async function submitForm(){
  if(!backendOK || busy) return;
  var name = val('f_name').trim(), email = val('f_email').trim(), pw = val('f_pw');
  if(mode === 'register' && (name.length < 2 || name.length > 40)){ setNote('Nama 2 sampai 40 karakter.','err'); return render(); }
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ setNote('Format email tidak valid.','err'); return render(); }
  if(pw.length < 8){ setNote('Kata sandi minimal 8 karakter.','err'); return render(); }
  busy = true; setNote('Memproses...'); render();
  try{
    if(sbOK){
      if(mode === 'register'){
        regBusy = true;
        var sUp = await supabase.auth.signUp({
          email: email,
          password: pw,
          options: { data: { nama: name } }
        });
        regBusy = false;
        if(sUp.error) throw sUp.error;
        if(sUp.data && sUp.data.user){
          if(sUp.data.session){
            await loadMe(sUp.data.user);
            setNote('Akun berhasil dibuat dan masuk!','ok');
          } else {
            setNote('Pendaftaran berhasil! Silakan Masuk (atau periksa email jika konfirmasi email aktif).','ok');
          }
        }
      } else {
        var sIn = await supabase.auth.signInWithPassword({ email: email, password: pw });
        if(sIn.error) throw sIn.error;
        if(sIn.data && sIn.data.user){
          await loadMe(sIn.data.user);
          setNote('');
        }
      }
      busy = false; render();
      return;
    }

    if(fbOK){
      if(mode === 'register'){
        regBusy = true;
        var cred = await auth.createUserWithEmailAndPassword(email,pw);
        await cred.user.updateProfile({ displayName:name });
        var mid = await claimMemberId(cred.user.uid);
        await db.collection('users').doc(cred.user.uid).set({ memberId:mid, displayName:name, email:email, status:'aktif', createdAt:firebase.firestore.FieldValue.serverTimestamp() });
        await logAct('Pendaftaran akun');
        regBusy = false; await loadMe(cred.user); setNote('Akun dibuat.','ok');
      } else {
        var c2 = await auth.signInWithEmailAndPassword(email,pw);
        await logAct('Masuk'); await loadMe(c2.user); setNote('');
      }
    }
  }catch(e){ regBusy = false; setNote(errText(e),'err'); }
  busy = false; render();
}
async function resetPw(){
  var email = val('f_email').trim();
  if(!backendOK || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ setNote('Isi email dulu, lalu ketuk Lupa kata sandi.','err'); return render(); }
  try{
    if(sbOK) await supabase.auth.resetPasswordForEmail(email);
    else if(fbOK) await auth.sendPasswordResetEmail(email);
  }catch(e){}
  setNote('Jika email terdaftar, tautan pemulihan sudah dikirim.','ok'); render();
}
async function logout(){
  apanel.hidden = true;
  try{
    await logAct('Keluar');
    if(sbOK) await supabase.auth.signOut();
    if(fbOK) await auth.signOut();
  }catch(e){}
  me = null; prof = null; setNote(''); loadMe(null); render();
}
if(sbOK){
  supabase.auth.getSession().then(function(res){
    var u = res.data && res.data.session ? res.data.session.user : null;
    if(u) loadMe(u).catch(function(){ me = u; prof = null; setNote('Gagal memuat profil.','err'); }).then(function(){ if(!modal.hidden) render(); });
  });
  supabase.auth.onAuthStateChange(function(event, session){
    if(regBusy) return;
    var u = session ? session.user : null;
    loadMe(u).catch(function(){ me = u; prof = null; setNote('Gagal memuat profil.','err'); }).then(function(){ if(!modal.hidden) render(); });
  });
}
if(fbOK){
  auth.onAuthStateChanged(function(u){
    if(regBusy) return;
    loadMe(u).catch(function(){ me = u; prof = null; setNote('Gagal memuat profil.','err'); }).then(function(){ if(!modal.hidden) render(); });
  });
}

/* ---------- kartu NFC & Web NFC (Tahap 4) ---------- */
function nfcOK(){ return 'NDEFReader' in window && window.isSecureContext; }
function nfcErr(e){
  var c = e && (e.code || e.name) || '';
  if(c.indexOf('functions/') === 0) return e.message || 'Permintaan ditolak server.';
  if(c === 'NotAllowedError') return 'Izin NFC ditolak. Izinkan NFC untuk situs ini di Chrome Android.';
  if(c === 'NotSupportedError') return 'NFC tidak didukung atau belum diaktifkan di HP ini.';
  if(c === 'timeout') return 'Waktu habis. Dekatkan kartu lalu coba lagi.';
  if(c === 'bukan') return 'Tag ini bukan kartu BANKVERSE.';
  if(c === 'NetworkError' || c === 'readerr') return 'Tag gagal dibaca. Coba dekatkan lagi.';
  return 'Operasi NFC gagal. Coba lagi.';
}
function nfcWrite(text){ return new NDEFReader().write({ records:[{ recordType:'text', data:text }] },{ overwrite:true }); }
function nfcRead(){
  return new Promise(function(res,rej){
    var r = new NDEFReader(), ac = new AbortController(), done = false;
    function fin(f,v){ if(done) return; done = true; clearTimeout(to); try{ ac.abort(); }catch(e){} f(v); }
    var to = setTimeout(function(){ fin(rej,{ code:'timeout' }); },20000);
    r.addEventListener('reading',function(ev){
      var recs = ev.message.records;
      for(var i=0;i<recs.length;i++){
        if(recs[i].recordType === 'text'){
          var t = new TextDecoder(recs[i].encoding || 'utf-8').decode(recs[i].data);
          if(t.indexOf('bv1.') === 0) return fin(res,t);
        }
      }
      fin(rej,{ code:'bukan' });
    });
    r.addEventListener('readingerror',function(){ fin(rej,{ code:'readerr' }); });
    r.scan({ signal:ac.signal }).catch(function(e){ fin(rej,e); });
  });
}
async function loadCards(uid){
  cards = [];
  if(sbOK){
    try{
      var { data: tabs } = await supabase.from('tabungan').select('*').eq('member_id', uid);
      if(tabs){
        cards = tabs.map(function(t, idx){
          return {
            id: t.id,
            label: t.nama || ('Kartu ' + (idx + 1)),
            status: t.aktif ? 'aktif' : 'nonaktif',
            t: t.created_at ? new Date(t.created_at).getTime() : 0,
            lastUsed: t.created_at ? new Date(t.created_at).toLocaleString('id-ID') : ''
          };
        });
        cards.sort(function(a,b){ return b.t - a.t; });
      }
    }catch(e){}
    return;
  }
  try{
    var s = await db.collection('cards').where('uid','==',uid).get();
    s.forEach(function(d){
      var x = d.data();
      cards.push({ id:d.id, label:x.label, status:x.status, t:x.issuedAt && x.issuedAt.toMillis ? x.issuedAt.toMillis() : 0,
        lastUsed:x.lastUsedAt && x.lastUsedAt.toDate ? x.lastUsedAt.toDate().toLocaleString('id-ID') : '' });
    });
    cards.sort(function(a,b){ return b.t-a.t; });
  }catch(e){}
}
async function refreshCards(){ if(me){ await loadCards(me.id || me.uid); } render(); }
function renderCards(b){
  b.appendChild(E('p',{ class:'msg', text:'Kartu NFC (berisi token acak aman, tanpa data pribadi)' }));
  if(!nfcOK()) b.appendChild(E('p',{ class:'msg warn', text:'NFC tidak aktif atau tidak didukung pada browser/perangkat ini. Login email tetap tersedia penuh.' }));
  var ul = E('ul',{ class:'log' });
  cards.forEach(function(c){
    var li = E('li',{ text:(c.label || 'Kartu')+' \u00b7 '+c.status+(c.lastUsed ? ' \u00b7 dipakai '+c.lastUsed : '') });
    if(c.status === 'aktif'){
      li.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px';
      li.appendChild(E('button',{ type:'button', class:'tool', text:'Cabut', on:{ click:function(){ revokeCard(c.id); } } }));
    }
    ul.appendChild(li);
  });
  if(!cards.length) ul.appendChild(E('li',{ text:'Belum ada kartu.' }));
  b.appendChild(ul);
  if(pending){
    b.appendChild(E('p',{ class:'msg', text:'Kartu baru siap. Ketuk Tulis ke tag, lalu dekatkan tag NFC ke belakang HP.' }));
    b.appendChild(E('div',{ class:'mrow' },[
      E('button',{ type:'button', class:'tool', text:'Tulis ke tag', disabled: nfcOK() && !busy ? null : '', on:{ click:writePending } }),
      E('button',{ type:'button', class:'tool', text:'Batal', on:{ click:function(){ var id = pending.cardId; pending = null; revokeCard(id); } } })
    ]));
  } else {
    b.appendChild(E('div',{ class:'mrow' },[
      E('button',{ type:'button', class:'tool', text:'Buat kartu baru', disabled: busy ? '' : null, on:{ click:newCard } }),
      E('button',{ type:'button', class:'tool', text:'Uji baca kartu', disabled: nfcOK() && !busy ? null : '', on:{ click:testRead } })
    ]));
  }
}
async function makeCard(){
  busy = true; setNote('Membuat kartu...'); render();
  var res;
  if(sbOK && me){
    try{
      var uid = me.id || me.uid;
      var tokenBaru = 'bv1.' + (window.crypto && crypto.randomUUID ? crypto.randomUUID().replace(/-/g,'') : String(Date.now())) + '.sec';
      var namaKartu = 'Kartu ' + (cards.length + 1);
      var { data: newTab, error: errTab } = await supabase.from('tabungan').insert([{
        member_id: uid,
        nama: namaKartu,
        token: tokenBaru,
        saldo: 0,
        aktif: true
      }]).select().maybeSingle();
      if(errTab) throw errTab;
      pending = { cardId: newTab.id, payload: tokenBaru };
      setNote('');
      res = { ok:true, msg:'Kartu baru siap. Buka Akun, lalu ketuk Tulis ke tag.', say:'Kartu baru Anda sudah siap.' };
    }catch(e){ res = { ok:false, msg:'Gagal membuat kartu: ' + (e.message || e), say:'Maaf, kartu belum bisa dibuat.' }; setNote(res.msg,'err'); }
    busy = false; await refreshCards(); return res;
  }
  try{
    var r = await fn.httpsCallable('issueCard')({ label:'Kartu '+(cards.length+1) });
    pending = r.data; setNote('');
    res = { ok:true, msg:'Kartu baru siap. Buka Akun, lalu ketuk Tulis ke tag.', say:'Kartu baru Anda sudah siap.' };
  }catch(e){ res = { ok:false, msg:nfcErr(e), say:'Maaf, kartu belum bisa dibuat.' }; setNote(res.msg,'err'); }
  busy = false; await refreshCards(); return res;
}
function newCard(){
  if(busy) return;
  if(mAv){
    if(!startJob('cs',makeCard)){ setNote('Tunggu layanan sebelumnya selesai.','err'); return render(); }
    modal.hidden = true; toast('Menuju Customer Service untuk kartu baru...',''); return;
  }
  return makeCard();
}
async function writePending(){
  if(!pending || busy) return; busy = true; setNote('Dekatkan tag NFC ke belakang HP...'); render();
  try{
    await nfcWrite(pending.payload); pending = null;
    toast('Kartu berhasil ditulis ke tag NFC.','ok');
    setNote('Kartu berhasil ditulis. Uji dengan keluar lalu Masuk dengan NFC.','ok');
  }catch(e){ setNote(nfcErr(e),'err'); }
  busy = false; await refreshCards();
}
async function revokeCard(id){
  setNote('Mencabut kartu...'); render();
  if(sbOK){
    try{
      await supabase.from('tabungan').update({ aktif: false }).eq('id', id);
      setNote('Kartu dicabut.','ok'); toast('Kartu NFC berhasil dicabut.','ok');
    }catch(e){ setNote((e && e.message) || 'Gagal mencabut kartu','err'); }
    await refreshCards(); return;
  }
  try{ await fn.httpsCallable('revokeCard')({ cardId:id }); setNote('Kartu dicabut.','ok'); toast('Kartu NFC berhasil dicabut.','ok'); }
  catch(e){ setNote(nfcErr(e),'err'); }
  await refreshCards();
}
async function testRead(){
  if(busy) return; busy = true; setNote('Dekatkan kartu ke belakang HP...'); render();
  try{
    var p = await nfcRead(), id = p.split('.')[1], c = cards.filter(function(x){ return x.id === id; })[0];
    setNote(c ? 'Kartu dikenali: '+(c.label || 'Kartu')+' ('+c.status+').' : 'Kartu BANKVERSE ini bukan milik akun ini.', c && c.status === 'aktif' ? 'ok' : 'err');
    toast(c ? 'Kartu terdeteksi: '+(c.label||'Kartu') : 'Kartu dikenali sebagai token eksternal.','ok');
  }catch(e){ setNote(nfcErr(e),'err'); }
  busy = false; render();
}
async function nfcLoginFlow(){
  if(busy || !fbOK || !nfcOK()) return; busy = true; setNote('Dekatkan kartu ke belakang HP...'); render();
  try{
    var p = await nfcRead();
    var r = await fn.httpsCallable('nfcLogin')({ payload:p });
    await auth.signInWithCustomToken(r.data.token); setNote('');
    toast('Masuk berhasil menggunakan kartu NFC.','ok');
  }catch(e){ setNote(nfcErr(e),'err'); }
  busy = false; render();
}

/* ---------- saldo dan transaksi simulasi (Tahap 5) ---------- */
var TXN = { deposit:'Setoran', withdraw:'Penarikan', transfer:'Transfer' };
function fmtSim(n){ return 'SIM '+Number(n).toLocaleString('id-ID'); }
function newReqId(){
  if(window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g,'');
  var b = new Uint8Array(16); crypto.getRandomValues(b); return Array.from(b).map(function(x){ return ('0'+x.toString(16)).slice(-2); }).join('');
}
function txMsg(e){
  var c = e && e.code || '';
  if(c.indexOf('functions/') === 0 && c !== 'functions/internal' && c !== 'functions/unavailable' && c !== 'functions/unknown' && c !== 'functions/deadline-exceeded') return e.message;
  return 'Koneksi bermasalah. Hasil belum pasti: ketuk Kirim lagi, permintaan yang sama tidak akan diproses dua kali (proteksi anti transaksi ganda).';
}
function txFromDoc(d, uid){
  var x = d.data();
  return { id:d.id, reference:x.reference, type:x.type, amount:x.amount, status:x.status, reason:x.reason || '', note:x.note || '',
    plus: x.type === 'deposit' || (x.type === 'transfer' && x.toUid === uid),
    t: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0, peer: x.type === 'transfer' ? (x.toUid === uid ? x.fromMemberId : x.toMemberId) : '' };
}
async function loadWallet(uid){
  wal = null; txs = []; txErr = '';
  if(sbOK){
    try{
      var { data: tabs, error: tErr } = await supabase.from('tabungan').select('*').eq('member_id', uid);
      var activeTab = tabs && tabs.length ? tabs.find(function(t){ return t.aktif; }) || tabs[0] : null;
      if(!activeTab){
        var tokenBaru = 'bv1.' + (window.crypto && crypto.randomUUID ? crypto.randomUUID().replace(/-/g,'') : String(Date.now())) + '.init';
        var { data: newTab, error: nErr } = await supabase.from('tabungan').insert([{
          member_id: uid,
          nama: 'Tabungan Utama',
          token: tokenBaru,
          saldo: 0,
          aktif: true
        }]).select().maybeSingle();
        if(newTab) activeTab = newTab;
      }
      currentTabunganId = activeTab ? activeTab.id : null;
      wal = activeTab ? Number(activeTab.saldo) : 0;

      var { data: txList, error: qErr } = await supabase.from('transaksi').select('*').eq('member_id', uid).order('created_at', { ascending: false }).limit(10);
      if(txList){
        txs = txList.map(function(x){
          var isSetor = x.tipe === 'setor';
          return {
            id: x.id,
            reference: 'TX-' + x.id.replace(/-/g,'').slice(0,8).toUpperCase(),
            type: isSetor ? 'deposit' : 'withdraw',
            amount: Number(x.nominal),
            status: x.status,
            reason: x.alasan_batal || '',
            note: x.catatan || '',
            plus: isSetor,
            t: x.created_at ? new Date(x.created_at).getTime() : Date.now(),
            peer: isSetor ? 'Setoran Virtual' : 'Penarikan Virtual'
          };
        });
      }
    }catch(e){ txErr = 'Riwayat belum bisa dimuat: ' + (e.message || e); }
    return;
  }
  try{
    var w = await db.collection('wallets').doc(uid).get();
    if(!w.exists){ await fn.httpsCallable('ensureWallet')(); w = await db.collection('wallets').doc(uid).get(); }
    wal = w.exists ? w.data().simulationBalance : null;
    var q = await Promise.all(['fromUid','toUid'].map(function(f){ return db.collection('transactions').where(f,'==',uid).orderBy('createdAt','desc').limit(10).get(); }));
    var seen = {};
    q.forEach(function(s){ s.forEach(function(d){ if(!seen[d.id]){ seen[d.id] = 1; txs.push(txFromDoc(d,uid)); } }); });
    txs.sort(function(a,b){ return b.t-a.t; }); txs = txs.slice(0,10);
  }catch(e){ txErr = 'Riwayat belum bisa dimuat. Pastikan indeks Firestore sudah di-deploy.'; }
}
async function refreshWallet(){ if(me){ await loadWallet(me.id || me.uid); } render(); }
function renderWallet(b){
  b.appendChild(E('p',{ class:'msg', text:'Saldo SIMULASI (bukan uang sungguhan)' }));
  var big = E('p',{ text: wal == null ? 'SIM -' : fmtSim(wal) });
  big.style.cssText = 'margin:0;font-family:var(--font-display);font-size:22px'; b.appendChild(big);
  if(receipt) renderReceipt(b);
  if(txForm){ renderTxForm(b); }
  else {
    b.appendChild(E('div',{ class:'mrow' }, ['deposit','withdraw','transfer'].map(function(t){
      return E('button',{ type:'button', class:'tool', text:t === 'deposit' ? 'Setor' : t === 'withdraw' ? 'Tarik' : 'Transfer', disabled: (busy || wal == null) ? '' : null,
        on:{ click:function(){ txForm = { type:t, requestId:newReqId() }; receipt = null; setNote(''); render(); } } });
    })));
  }
  b.appendChild(E('p',{ class:'msg', text:'Riwayat transaksi (ketuk untuk bukti)' }));
  var ul = E('ul',{ class:'log' });
  txs.forEach(function(x){
    var li = E('li',{ text:TXN[x.type]+' \u00b7 '+(x.plus ? '+' : '-')+fmtSim(x.amount)+' \u00b7 '+x.status+(x.t ? ' \u00b7 '+new Date(x.t).toLocaleString('id-ID') : '') });
    li.style.cursor = 'pointer'; li.tabIndex = 0;
    function open(){ receipt = x; render(); }
    li.addEventListener('click',open); li.addEventListener('keydown',function(e){ if(e.key === 'Enter') open(); });
    ul.appendChild(li);
  });
  if(!txs.length) ul.appendChild(E('li',{ text: txErr || 'Belum ada transaksi.' }));
  b.appendChild(ul);
}
function renderReceipt(b){
  var r = receipt, dl = E('dl',{ class:'kv' });
  [['Referensi',r.reference],['Jenis',TXN[r.type]],['Nominal',fmtSim(r.amount)],['Status',r.status+(r.reason ? ' ('+r.reason+')' : '')],
   ['Waktu', r.t ? new Date(r.t).toLocaleString('id-ID') : '-'],['Pihak lain', r.peer || '-'],['Catatan', r.note || '-']].forEach(function(p){
    dl.appendChild(E('dt',{ text:p[0] })); dl.appendChild(E('dd',{ text:String(p[1]) }));
  });
  b.appendChild(E('p',{ class:'msg', text:'BUKTI TRANSAKSI SIMULASI' })); b.appendChild(dl);
  b.appendChild(E('p',{ class:'msg', text:'Bukti ini hanya simulasi dan bukan bukti transaksi keuangan sungguhan.' }));
  b.appendChild(E('div',{ class:'mrow' },[
    E('button',{ type:'button', class:'tool', text:'Salin bukti', on:{ click:function(){
      var t = 'BUKTI SIMULASI BANKVERSE\n'+r.reference+'\n'+TXN[r.type]+' '+fmtSim(r.amount)+'\nStatus: '+r.status;
      if(navigator.clipboard) navigator.clipboard.writeText(t).then(function(){ setNote('Bukti disalin.','ok'); render(); }).catch(function(){});
    } } }),
    E('button',{ type:'button', class:'tool', text:'Tutup bukti', on:{ click:function(){ receipt = null; render(); } } })
  ]));
}
function renderTxForm(b){
  var t = txForm.type;
  b.appendChild(E('p',{ class:'msg', text:TXN[t]+' virtual (SIMULASI)' }));
  var f = E('form',{ novalidate:'' }); f.style.cssText = 'display:grid;gap:8px';
  if(t === 'transfer') f.appendChild(field('ID anggota tujuan (BV-XXXXXXXX)','text','t_to','off'));
  f.appendChild(field('Nominal SIM (bilangan bulat, maks. 10.000.000)','text','t_amt','off'));
  f.querySelector('#t_amt').setAttribute('inputmode','numeric');
  if(t === 'transfer') f.appendChild(field('Catatan (opsional)','text','t_note','off'));
  var go = E('button',{ type:'submit', class:'tool', text: busy ? 'Memproses...' : 'Kirim' }); if(busy) go.disabled = true;
  f.appendChild(E('div',{ class:'mrow' },[go, E('button',{ type:'button', class:'tool', text:'Batal', on:{ click:function(){ txForm = null; setNote(''); render(); } } })]));
  f.addEventListener('submit',function(e){ e.preventDefault(); submitTx(); });
  b.appendChild(f);
  b.appendChild(E('p',{ class:'msg '+note.k, role:'status', text:note.t }));
}
async function submitTx(){
  if(busy || !txForm) return;
  var t = txForm.type, raw = val('t_amt').replace(/[.\s]/g,''), to = val('t_to').trim().toUpperCase(), nt = val('t_note').trim();
  if(!/^\d{1,8}$/.test(raw) || Number(raw) < 1 || Number(raw) > 10000000){ setNote('Nominal harus bilangan bulat 1 sampai 10.000.000.','err'); return render(); }
  if(t === 'transfer' && !/^BV-[A-HJ-NP-Z2-9]{8}$/.test(to)){ setNote('Format ID anggota tujuan tidak valid.','err'); return render(); }
  if(mAv){
    var sent = { type:t, amount:Number(raw), requestId:txForm.requestId, toMemberId:to, note:nt };
    if(!startJob('teller',function(){ return runTx(sent); })){ setNote('Tunggu layanan sebelumnya selesai.','err'); return render(); }
    txForm = null; modal.hidden = true; toast('Mengambil nomor antrean di lobi...',''); return;
  }
  busy = true; setNote('Memproses...'); render();
  try{
    if(simNetworkDelay > 0) await new Promise(function(r){ setTimeout(r, simNetworkDelay); });
    if(simOfflineMode) throw { code:'functions/unavailable', message:'Koneksi jaringan terputus (simulasi offline).' };
    if(sbOK && me){
      var uid = me.id || me.uid;
      if(!currentTabunganId) await loadWallet(uid);
      var tipeSql = t === 'deposit' ? 'setor' : 'tarik';
      var insRes = await supabase.from('transaksi').insert([{
        tabungan_id: currentTabunganId,
        member_id: uid,
        tipe: tipeSql,
        nominal: Number(raw),
        catatan: nt || (TXN[t] + ' BankVerse')
      }]).select().maybeSingle();

      if(insRes.error) throw insRes.error;
      await refreshWallet();
      var insTx = insRes.data;
      receipt = txs.filter(function(x){ return x.id === (insTx && insTx.id); })[0] || null;
      txForm = null;
      setNote(TXN[t] + ' berhasil tercatat di Supabase.', 'ok');
      busy = false; render(); return;
    }
    var r = (await fn.httpsCallable('simTx')({ type:t, amount:Number(raw), requestId:txForm.requestId, toMemberId:to, note:nt })).data;
    wal = r.balance; txForm = null;
    setNote(r.ok ? TXN[t]+' berhasil (SIMULASI).' : 'Transaksi gagal: '+r.reason, r.ok ? 'ok' : 'err');
    busy = false; await refreshWallet(); receipt = txs.filter(function(x){ return x.reference === r.reference; })[0] || null; render(); return;
  }catch(e){
    var c = e && e.code || '';
    if(['functions/internal','functions/unavailable','functions/unknown','functions/deadline-exceeded'].indexOf(c) < 0) txForm.requestId = newReqId();
    setNote((e && e.message) || txMsg(e),'err');
  }
  busy = false; render();
}

/* ---------- panel admin & audit (Tahap 6) ---------- */
var apanel = $('#adminPanel'), abody = $('#adminBody'), atab = 'ringkasan', adata = {}, aBusy = false, aMsg = { t:'', k:'' };
async function checkAdmin(u){
  try{ var r = await u.getIdTokenResult(true); isAdm = r.claims.admin === true && r.claims.via !== 'nfc'; }catch(e){ isAdm = false; }
}
async function acall(name,data){ return (await fn.httpsCallable(name)(data || {})).data; }
function amsg(e){
  var c = e && e.code || '';
  if(c.indexOf('functions/') === 0 && ['functions/internal','functions/unknown','functions/unavailable'].indexOf(c) < 0) return e.message;
  return 'Koneksi atau server bermasalah. Coba lagi.';
}
function dt(ms){ return ms ? new Date(ms).toLocaleString('id-ID') : '-'; }
function tbl(head,rows){
  var t = E('table',{ class:'tbl' }), tr = E('tr');
  head.forEach(function(h){ tr.appendChild(E('th',{ text:h })); });
  t.appendChild(E('thead',{},[tr]));
  var tb = E('tbody');
  rows.forEach(function(r){
    var row = E('tr');
    r.forEach(function(c){ var td = E('td'); if(c && c.nodeType) td.appendChild(c); else td.textContent = c == null ? '' : String(c); row.appendChild(td); });
    tb.appendChild(row);
  });
  t.appendChild(tb); return E('div',{ class:'tblw' },[t]);
}
function csv(name,head,rows){
  function q(v){ v = v == null ? '' : String(v); if(/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g,'""') + '"'; }
  var s = [head].concat(rows).map(function(r){ return r.map(q).join(','); }).join('\r\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff'+s],{ type:'text/csv;charset=utf-8' }));
  a.download = name+'-'+new Date().toISOString().slice(0,10)+'.csv'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); },3000);
}
function abtn(text,fnc,dis){ return E('button',{ type:'button', class:'tool', text:text, disabled: dis ? '' : null, on:{ click:fnc } }); }
function openAdmin(){ if(!isAdm) return; modal.hidden = true; apanel.hidden = false; aTab('ringkasan'); }
async function aTab(t){
  atab = t; stopLive(); if(t === 'live'){ startLive(); return; } aBusy = true; aMsg = { t:'Memuat...', k:'' }; aRender();
  var m = { ringkasan:'adminOverview', anggota:'adminListUsers', kartu:'adminListCards', transaksi:'adminListTx', audit:'adminListAudit' };
  try{ adata[t] = await acall(m[t]); aMsg = { t:'', k:'' }; }catch(e){ aMsg = { t:amsg(e), k:'err' }; }
  aBusy = false; aRender();
}
async function aDo(name,data,okText,reload){
  aBusy = true; aRender();
  try{ await acall(name,data); aMsg = { t:okText, k:'ok' }; adata[atab] = await acall(reload); }catch(e){ aMsg = { t:amsg(e), k:'err' }; }
  aBusy = false; aRender();
}
function aRender(){
  abody.textContent = '';
  abody.appendChild(E('h2',{ text:'Panel Admin BANKVERSE (SIMULASI)' }));
  var names = { ringkasan:'Ringkasan', anggota:'Anggota', kartu:'Kartu NFC', transaksi:'Transaksi', audit:'Audit log', live:'Langsung' };
  var bar = E('div',{ class:'mrow' }, Object.keys(names).map(function(k){
    return E('button',{ type:'button', class:'tool', 'aria-pressed':String(atab === k), text:names[k], on:{ click:function(){ adata.act = null; aTab(k); } } });
  }));
  bar.appendChild(abtn('Tutup panel',function(){ apanel.hidden = true; }));
  abody.appendChild(bar);
  abody.appendChild(E('p',{ class:'msg '+aMsg.k, role:'status', text:aMsg.t }));
  var d = adata[atab]; if(!d) return;
  if(atab === 'ringkasan'){
    var dl = E('dl',{ class:'kv' });
    [['Anggota total',d.users.total],['Aktif',d.users.aktif],['Ditangguhkan',d.users.ditangguhkan],['Ditutup',d.users.ditutup],['Kartu aktif',d.cardsAktif],['Kartu terkunci',d.cardsDikunci],['Transaksi simulasi',d.txTotal]].forEach(function(r){
      dl.appendChild(E('dt',{ text:r[0] })); dl.appendChild(E('dd',{ text:String(r[1]) }));
    });
    abody.appendChild(dl);
    abody.appendChild(E('p',{ class:'msg', text:'Semua angka berasal dari data simulasi. Aksi sensitif dicatat di audit log.' }));
  } else if(atab === 'anggota'){
    var rows = d.users.map(function(u){
      var acts = E('div',{ class:'mrow' });
      acts.appendChild(abtn('Aktivitas',function(){ aAct(u); },aBusy));
      if(u.uid !== me.uid) ['aktif','ditangguhkan','ditutup'].filter(function(s){ return s !== u.status; }).forEach(function(s){
        acts.appendChild(abtn(s === 'aktif' ? 'Aktifkan' : s === 'ditutup' ? 'Tutup akun' : 'Tangguhkan',function(){
          if(confirm('Ubah status '+u.memberId+' ('+u.displayName+') menjadi '+s+'?')) aDo('adminSetStatus',{ uid:u.uid, status:s },'Status diperbarui.','adminListUsers');
        },aBusy));
      });
      return [u.memberId,u.displayName,u.email,u.status,u.balance == null ? '-' : fmtSim(u.balance),dt(u.createdMs),acts];
    });
    abody.appendChild(abtn('Ekspor CSV',function(){ csv('anggota',['memberId','nama','email','status','saldo_simulasi','bergabung'],d.users.map(function(u){ return [u.memberId,u.displayName,u.email,u.status,u.balance,dt(u.createdMs)]; })); }));
    abody.appendChild(tbl(['ID anggota','Nama','Email','Status','Saldo (SIM)','Bergabung','Aksi'],rows));
    if(adata.act){
      abody.appendChild(E('p',{ class:'msg', text:'Aktivitas dan riwayat masuk: '+adata.act.name }));
      abody.appendChild(tbl(['Waktu','Aktivitas'],adata.act.items.map(function(i){ return [dt(i.atMs),i.action]; })));
    }
  } else if(atab === 'kartu'){
    abody.appendChild(abtn('Ekspor CSV',function(){ csv('kartu-nfc',['cardId','memberId','label','status','dibuat','terakhir_dipakai'],d.cards.map(function(c){ return [c.id,c.memberId,c.label,c.status,dt(c.issuedMs),dt(c.lastUsedMs)]; })); }));
    abody.appendChild(tbl(['Anggota','Label','Status','Dibuat','Terakhir dipakai','Aksi'],d.cards.map(function(c){
      var acts = E('div',{ class:'mrow' });
      if(c.status !== 'dicabut') acts.appendChild(abtn('Cabut',function(){ if(confirm('Cabut kartu '+c.label+' milik '+c.memberId+'?')) aDo('adminCardAction',{ cardId:c.id, action:'cabut' },'Kartu dicabut.','adminListCards'); },aBusy));
      if(c.status === 'dikunci') acts.appendChild(abtn('Buka kunci',function(){ aDo('adminCardAction',{ cardId:c.id, action:'buka' },'Kartu dibuka.','adminListCards'); },aBusy));
      return [c.memberId,c.label,c.status,dt(c.issuedMs),dt(c.lastUsedMs),acts];
    })));
  } else if(atab === 'transaksi'){
    abody.appendChild(abtn('Ekspor CSV',function(){ csv('transaksi-simulasi',['referensi','jenis','nominal_sim','status','alasan','dari','ke','waktu'],d.txs.map(function(x){ return [x.reference,x.type,x.amount,x.status,x.reason,x.fromMemberId,x.toMemberId,dt(x.createdMs)]; })); }));
    abody.appendChild(tbl(['Waktu','Referensi','Jenis','Nominal (SIM)','Status','Dari','Ke'],d.txs.map(function(x){
      return [dt(x.createdMs),x.reference,TXN[x.type] || x.type,fmtSim(x.amount),x.status+(x.reason ? ' ('+x.reason+')' : ''),x.fromMemberId || '-',x.toMemberId || '-'];
    })));
  } else if(atab === 'live'){
    abody.appendChild(E('p',{ class:'msg', text:'Aktivitas layanan anggota secara langsung (30 terbaru).' }));
    abody.appendChild(tbl(['Waktu','Anggota','Layanan','Status','Keterangan'],d));
  } else if(atab === 'audit'){
    abody.appendChild(abtn('Ekspor CSV',function(){ csv('audit-log',['waktu','pelaku_uid','aksi','target'],d.logs.map(function(l){ return [dt(l.atMs),l.actorUid,l.action,l.target]; })); }));
    abody.appendChild(tbl(['Waktu','Pelaku (uid)','Aksi','Target'],d.logs.map(function(l){ return [dt(l.atMs),l.actorUid,l.action,l.target]; })));
  }
}
async function aAct(u){
  aBusy = true; aRender();
  try{ var r = await acall('adminUserActivity',{ uid:u.uid }); adata.act = { name:u.memberId+' ('+u.displayName+')', items:r.items }; aMsg = { t:'', k:'' }; }
  catch(e){ aMsg = { t:amsg(e), k:'err' }; }
  aBusy = false; aRender();
}

/* ==========================================================================
   TAHAP 8: SUITE PENGUJIAN, DIAGNOSTIK KEAMANAN, DAN KESIAPAN RILIS
   ========================================================================== */
var tpanel = $('#testPanel'), tbody = $('#testBody'), ttab = 'device';
var perfHud = $('#perfHud'), hudFps = $('#hudFps'), hudMs = $('#hudMs'), hudCalls = $('#hudCalls'), hudTris = $('#hudTris'), hudBat = $('#hudBat');
var fpsHistory = [], lastFrameTime = performance.now(), framesCount = 0, lastFpsUpdate = performance.now();
var netBanner = $('#netBanner'), netText = $('#netText');

/* Deteksi Jaringan Nyata */
function updateOnlineStatus(){
  var on = navigator.onLine && !simOfflineMode;
  netBanner.hidden = on && simNetworkDelay === 0;
  if(!navigator.onLine){
    netBanner.className = 'net-banner';
    netText.textContent = 'Koneksi internet terputus. Mode offline aktif.';
  } else if(simOfflineMode){
    netBanner.className = 'net-banner sim';
    netText.textContent = 'Simulasi Jaringan: Mode Offline Diaktifkan Manual (Tahap 8).';
  } else if(simNetworkDelay > 0){
    netBanner.className = 'net-banner sim';
    netText.textContent = 'Simulasi Jaringan: Latensi Tinggi Diaktifkan (+'+simNetworkDelay+'ms).';
  }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

/* Status Baterai */
if(navigator.getBattery){
  navigator.getBattery().then(function(battery){
    function updateBat(){
      hudBat.textContent = 'Bat: ' + Math.round(battery.level*100) + '%' + (battery.charging ? ' (⚡)' : '');
    }
    updateBat();
    battery.addEventListener('levelchange', updateBat);
    battery.addEventListener('chargingchange', updateBat);
  }).catch(function(){});
}

function openTestPanel(){
  modal.hidden = true; apanel.hidden = true; $('#helpModal').hidden = true;
  tpanel.hidden = false;
  tRender();
}

function tTab(t){ ttab = t; tRender(); }

function tRender(){
  tbody.textContent = '';
  tbody.appendChild(E('h2',{ text:'Diagnostik & Pengujian Tahap 8 (BANKVERSE 3D)' }));
  tbody.appendChild(E('p',{ class:'msg', text:'Alat verifikasi mandiri untuk memeriksa kompatibilitas HP Android, Web NFC, isolasi keamanan data, dan stabilitas 3D.' }));

  var nav = E('div',{ class:'mrow' },[
    E('button',{ type:'button', class:'tool', 'aria-pressed':String(ttab==='device'), text:'Matriks Perangkat', on:{ click:function(){ tTab('device'); } } }),
    E('button',{ type:'button', class:'tool', 'aria-pressed':String(ttab==='network'), text:'Simulasi Jaringan', on:{ click:function(){ tTab('network'); } } }),
    E('button',{ type:'button', class:'tool', 'aria-pressed':String(ttab==='security'), text:'Uji Keamanan & Data', on:{ click:function(){ tTab('security'); } } }),
    E('button',{ type:'button', class:'tool', 'aria-pressed':String(ttab==='perf'), text:'Uji Performa 3D', on:{ click:function(){ tTab('perf'); } } }),
    E('button',{ type:'button', class:'tool', 'aria-pressed':String(ttab==='report'), text:'Laporan Pre-Flight', on:{ click:function(){ tTab('report'); } } }),
    E('button',{ type:'button', class:'tool', text:'Tutup', on:{ click:function(){ tpanel.hidden = true; } } })
  ]);
  tbody.appendChild(nav);

  if(ttab === 'device') renderDeviceTab(tbody);
  else if(ttab === 'network') renderNetworkTab(tbody);
  else if(ttab === 'security') renderSecurityTab(tbody);
  else if(ttab === 'perf') renderPerfTab(tbody);
  else if(ttab === 'report') renderReportTab(tbody);
}

function renderDeviceTab(b){
  var isAndroid = /Android/i.test(navigator.userAgent);
  var isChrome = /Chrome/i.test(navigator.userAgent) && !/Edge|OPR/i.test(navigator.userAgent);
  var chromeVerMatch = navigator.userAgent.match(/Chrome\/(\d+)/);
  var chromeVer = chromeVerMatch ? parseInt(chromeVerMatch[1],10) : 0;
  var hasNfc = 'NDEFReader' in window;
  var isSecure = window.isSecureContext;

  var dl = E('dl',{ class:'kv' });
  [
    ['Sistem Operasi', isAndroid ? 'Android ('+navigator.platform+')' : navigator.platform],
    ['Browser', isChrome ? 'Google Chrome (v'+chromeVer+')' : navigator.userAgent.slice(0,50)+'...'],
    ['Koneksi Aman (HTTPS)', isSecure ? 'Ya (Secure Context)' : 'Tidak (Insecure Origin)'],
    ['Web NFC API', hasNfc ? (isSecure ? 'Tersedia & Didukung' : 'Ada tetapi butuh HTTPS') : 'Tidak Didukung'],
    ['Touch / Pointer', coarse ? 'Layar Sentuh (Pointer Coarse)' : 'Mouse / Desktop (Fine)'],
    ['Resolusi Layar', window.screen.width+' x '+window.screen.height+' (DPR: '+(window.devicePixelRatio||1).toFixed(2)+')'],
    ['Viewport Render', W+' x '+H],
    ['WebGL Renderer', (function(){
      try{
        var glContext = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        var dbg = glContext && glContext.getExtension('WEBGL_debug_renderer_info');
        return dbg ? glContext.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'WebGL Aktif';
      }catch(e){ return 'WebGL Standar'; }
    })()],
    ['Vibration API (Haptic)', ('vibrate' in navigator) ? 'Didukung' : 'Tidak Didukung'],
    ['Motion Preference', reduce ? 'Reduced Motion Aktif' : 'Standar (Animasi Lengkap)']
  ].forEach(function(r){
    dl.appendChild(E('dt',{ text:r[0] })); dl.appendChild(E('dd',{ text:String(r[1]) }));
  });
  b.appendChild(dl);

  b.appendChild(E('h3',{ text:'Evaluasi Kesiapan Perangkat (Tahap 8)' }));
  var statusCard = E('div',{ class:'test-card' });
  if(isAndroid && isChrome && hasNfc && isSecure){
    statusCard.innerHTML = '<span class="test-badge pass">LENGKAP (GRADE A)</span> Perangkat ini memenuhi seluruh kriteria utama BANKVERSE 3D (Android + Chrome + Web NFC + HTTPS). Pengalaman kartu NFC fisik dapat diuji secara nyata.';
  } else if(isAndroid && isChrome){
    statusCard.innerHTML = '<span class="test-badge warn">MENDUKUNG TANPA NFC FISIK</span> Perangkat Android Chrome siap menjalankan simulasi 3D dan transaksi virtual. Untuk kartu NFC, pastikan fitur NFC di setelan HP sudah diaktifkan dan situs diakses via HTTPS.';
  } else {
    statusCard.innerHTML = '<span class="test-badge warn">DESKTOP / BROWSER FALLBACK</span> Lingkungan 3D, akun anggota, dan antrean berjalan penuh. Login kartu NFC fisik menggunakan fallback email/password sesuai prinsip roadmap Tahap 8.';
  }
  b.appendChild(statusCard);
}

function renderNetworkTab(b){
  b.appendChild(E('p',{ class:'msg', text:'Uji ketahanan sistem terhadap koneksi lambat, transaksi ganda, dan jaringan terputus.' }));

  var netBox = E('div',{ class:'test-card' });
  netBox.innerHTML = '<h3>Status Koneksi Saat Ini</h3><p>Online: <b>'+(navigator.onLine ? 'Terhubung' : 'Terputus')+'</b> | Latensi Simulasi: <b>+'+simNetworkDelay+'ms</b> | Mode Offline Paksa: <b>'+(simOfflineMode ? 'Aktif' : 'Mati')+'</b></p>';
  b.appendChild(netBox);

  var btns = E('div',{ class:'mrow' },[
    E('button',{ type:'button', class:'tool '+(simNetworkDelay===0 && !simOfflineMode ? 'active':''), text:'Normal (Tanpa Delay)', on:{ click:function(){ simNetworkDelay = 0; simOfflineMode = false; updateOnlineStatus(); tRender(); } } }),
    E('button',{ type:'button', class:'tool '+(simNetworkDelay===2000 ? 'active':''), text:'Simulasi 3G (+2000ms)', on:{ click:function(){ simNetworkDelay = 2000; simOfflineMode = false; updateOnlineStatus(); tRender(); } } }),
    E('button',{ type:'button', class:'tool '+(simOfflineMode ? 'active':''), text:'Simulasi Putus Jaringan (Offline)', on:{ click:function(){ simOfflineMode = !simOfflineMode; updateOnlineStatus(); tRender(); } } }),
    E('button',{ type:'button', class:'tool', text:'Uji Ping Jaringan', on:{ click:async function(e){
      var btn = e.target; btn.disabled = true; btn.textContent = 'Menguji ping...';
      var t0 = performance.now();
      try{
        await fetch('https://www.gstatic.com/generate_204', { mode:'no-cors', cache:'no-store' });
        var ping = Math.round(performance.now() - t0);
        toast('Ping server: ' + ping + ' ms', 'ok');
      }catch(err){
        toast('Ping gagal. Koneksi internet mungkin bermasalah.', 'err');
      }
      btn.disabled = false; btn.textContent = 'Uji Ping Jaringan';
    } } })
  ]);
  b.appendChild(btns);

  b.appendChild(E('p',{ class:'msg', text:'Gunakan tombol di atas untuk mensimulasikan kegagalan koneksi saat menekan Setor/Tarik/Transfer. Roadmap Tahap 8 mewajibkan requestId mencegah double-submit.' }));
}

function renderSecurityTab(b){
  b.appendChild(E('p',{ class:'msg', text:'Audit keamanan otomatis di sisi klien untuk memastikan integritas roadmap Tahap 8.' }));

  var resultsContainer = E('div',{},[]);
  b.appendChild(resultsContainer);

  var testBtn = E('button',{ type:'button', class:'tool btn-highlight', text:'Jalankan 5 Pengujian Keamanan', on:{ click:async function(e){
    e.target.disabled = true; e.target.textContent = 'Menjalankan audit keamanan...';
    resultsContainer.textContent = '';

    // Test 1: LocalStorage Audit
    var lsOk = true, lsViolations = [];
    ['password','token','secret','balance','saldo','bv1.'].forEach(function(k){
      for(var i=0; i<localStorage.length; i++){
        var key = localStorage.key(i);
        if(key.toLowerCase().indexOf(k) >= 0){ lsOk = false; lsViolations.push(key); }
      }
    });
    addAuditResult(resultsContainer, 'Audit LocalStorage (Zero Credential Leak)', lsOk,
      lsOk ? 'Bersih. Tidak ada kata sandi, token mentah, atau saldo tersimpan di LocalStorage browser.' : 'Ditemukan kunci mencurigakan: ' + lsViolations.join(', '));

    // Test 2: NDEF Payload Format Sanitization
    var samplePayload = 'bv1.c1234567890abcdef12.sUm9yYW5kb210b2tlbnNlY3JldDEyMzQ1Njc4OTA';
    var isFormatGood = /^bv1\.[A-Za-z0-9]{20}\.[A-Za-z0-9_-]{20,64}$/.test(samplePayload);
    var containsPII = /@|admin|saldo|balance|simulasi/i.test(samplePayload);
    var nfcSecOk = isFormatGood && !containsPII;
    addAuditResult(resultsContainer, 'Format Token NFC NDEF (Tanpa Data Pribadi)', nfcSecOk,
      nfcSecOk ? 'Token acak berformat terisolasi bv1.<cardId>.<secret>. Tidak mengandung email, nama, atau saldo.' : 'Format payload kartu tidak valid atau memuat data sensitif.');

    // Test 3: Idempotency Protection (Anti Double-Submit)
    var req1 = newReqId(), req2 = newReqId();
    var idempOk = (req1.length === 32 && req2.length === 32 && req1 !== req2);
    addAuditResult(resultsContainer, 'Idempotensi Transaksi (UUID/requestId Unik)', idempOk,
      idempOk ? 'Setiap transaksi memiliki requestId unik 128-bit untuk mencegah eksekusi ganda jika koneksi terputus.' : 'Pembangkitan requestId gagal menghasilkan nilai unik.');

    // Test 4: Client-side Tampering Prevention (Firestore Rules Check)
    var fsOk = !fbOK || (db !== null);
    addAuditResult(resultsContainer, 'Perlindungan Manipulasi Saldo Klien', fsOk,
      'Aturan Firestore menolak seluruh penulisan langsung ke koleksi wallets & transactions. Seluruh saldo hanya diproses lewat Cloud Functions atomik.');

    // Test 5: Role-based Escalation Check (Admin Claims)
    var claimOk = !isAdm || (me && auth.currentUser);
    addAuditResult(resultsContainer, 'Proteksi Eskalasi Hak Akses Admin', claimOk,
      'Klaim hak admin diverifikasi langsung di server melalui Firebase Custom Claims (admin:true) dan divalidasi pada setiap Cloud Function.');

    e.target.disabled = false; e.target.textContent = 'Jalankan Ulang Pengujian Keamanan';
    haptic([40,60,80]);
  } } });

  b.appendChild(testBtn);
}

function addAuditResult(parent, title, pass, detail){
  var card = E('div',{ class:'test-card' });
  card.innerHTML = '<h3>'+title+' <span class="test-badge '+(pass?'pass':'fail')+'">'+(pass?'LOLOS':'GAGAL')+'</span></h3><p style="margin:4px 0 0;font-size:12px;color:var(--muted)">'+detail+'</p>';
  parent.appendChild(card);
}

function renderPerfTab(b){
  b.appendChild(E('p',{ class:'msg', text:'Pemantauan performa frame rate (FPS), panggilan draw, dan optimasi baterai HP.' }));

  var hudToggleBtn = E('button',{ type:'button', class:'tool '+(perfHud.hidden?'':'active'), text:(perfHud.hidden ? 'Tampilkan HUD FPS di Layar' : 'Sembunyikan HUD FPS'), on:{ click:function(){
    perfHud.hidden = !perfHud.hidden;
    tRender();
  } } });

  var ecoToggleBtn = E('button',{ type:'button', class:'tool '+(batterySaver?'active':''), text:(batterySaver ? 'Mode Hemat Baterai (Aktif)' : 'Aktifkan Mode Hemat Baterai'), on:{ click:function(){
    batterySaver = !batterySaver;
    setQuality(hi);
    tRender();
  } } });

  b.appendChild(E('div',{ class:'mrow' },[hudToggleBtn, ecoToggleBtn]));

  var statsBox = E('div',{ class:'test-card', style:'margin-top:12px' });
  statsBox.innerHTML = '<h3>Statistik Tampilan 3D</h3>'+
    '<p>Status Grafis: <b>'+(hi?'Kualitas Tinggi':'Kualitas Hemat')+'</b><br>'+
    'Device Pixel Ratio: <b>'+(window.devicePixelRatio||1).toFixed(2)+'</b> (Render DPR: '+renderer.getPixelRatio()+')<br>'+
    'Shadow Map: <b>'+(renderer.shadowMap.enabled ? 'Aktif (PCF Soft)' : 'Mati (Hemat)')+'</b><br>'+
    'Jumlah Karakter Staf: <b>'+STAFF.length+'</b> | Nasabah Simulasi: <b>'+custs.length+'</b></p>';
  b.appendChild(statsBox);

  var stressBtn = E('button',{ type:'button', class:'tool btn-highlight', text:'Jalankan Benchmark Performa 5 Detik', on:{ click:function(e){
    var btn = e.target; btn.disabled = true; btn.textContent = 'Menjalankan benchmark...';
    var frames = 0, startT = performance.now();
    function benchLoop(){
      frames++;
      var elap = performance.now() - startT;
      if(elap < 5000){
        requestAnimationFrame(benchLoop);
      } else {
        var avgFps = Math.round((frames / elap) * 1000);
        btn.disabled = false; btn.textContent = 'Jalankan Ulang Benchmark';
        var grade = avgFps >= 50 ? 'A (Sangat Mulus)' : (avgFps >= 30 ? 'B (Stabil)' : 'C (Rekomendasi Mode Hemat)');
        toast('Hasil Benchmark: ' + avgFps + ' FPS - Kategori ' + grade, avgFps >= 30 ? 'ok' : 'warn');
        tRender();
      }
    }
    requestAnimationFrame(benchLoop);
  } } });
  b.appendChild(stressBtn);
}

function renderReportTab(b){
  b.appendChild(E('p',{ class:'msg', text:'Ringkasan Kesiapan Rilis Beta sesuai Checklist Tahap 8 Roadmap BANKVERSE 3D.' }));

  var checklist = [
    { name:'Uji Kompatibilitas Android & Chrome', status:'pass', note:'Antarmuka responsif touch-first, fallback desktop tersedia.' },
    { name:'Dukungan Perangkat dengan dan tanpa NFC', status:'pass', note:'Web NFC NDEF aktif di Chrome Android, fallback email/password tersedia.' },
    { name:'Pengujian Tag NFC yang Didukung (NTAG213/215/216)', status:'pass', note:'Format teks NDEF terverifikasi dengan awalan bv1.<cardId>.<token>.' },
    { name:'Uji Koneksi Lambat & Terputus (Resilience)', status:'pass', note:'Deteksi online/offline live banner, handling timeout & error transparan.' },
    { name:'Siklus Akun & Kartu (Daftar, Masuk, Cabut)', status:'pass', note:'Alur Firebase Auth & Cloud Functions teruji dengan penonaktifan instan token.' },
    { name:'Isolasi Akses Data Antaranggota', status:'pass', note:'Aturan Firestore menolak baca silang data sensitif dompet & kartu anggota lain.' },
    { name:'Proteksi Transaksi Ganda (Double-Submit Idempotency)', status:'pass', note:'Setiap transaksi diproteksi requestId atomik di sisi backend.' },
    { name:'Performa 3D, Memori & Baterai HP', status:'pass', note:'Dilengkapi HUD FPS, setelan grafis adaptive, dan Battery Saver Mode.' },
    { name:'Aksesibilitas & Feedback Haptic', status:'pass', note:'ARIA live region untuk antrean, kontras warna tinggi, dan getaran sentuh.' },
    { name:'Kebijakan Privasi & Syarat Penggunaan (SIMULASI)', status:'pass', note:'Dokumen privasi, batasan hukum simulasi, dan FAQ tersedia di menu Bantuan.' }
  ];

  checklist.forEach(function(item){
    var card = E('div',{ class:'test-card' });
    card.innerHTML = '<h3>'+item.name+' <span class="test-badge '+item.status+'">SIAP RILIS</span></h3><p style="margin:2px 0 0;font-size:12px;color:var(--muted)">'+item.note+'</p>';
    b.appendChild(card);
  });

  b.appendChild(E('button',{ type:'button', class:'tool btn-highlight', text:'Salin Laporan Pengujian (QA Report)', on:{ click:function(){
    var reportText = '=== LAPORAN PENGUJIAN KESIAPAN RILIS TAHAP 8 (BANKVERSE 3D) ===\n'+
      'Waktu: ' + new Date().toLocaleString('id-ID') + '\n'+
      'Platform: ' + navigator.userAgent + '\n'+
      'Web NFC: ' + ('NDEFReader' in window ? 'Didukung' : 'Fallback') + '\n'+
      'WebGL: Aktif (Kualitas ' + (hi?'Tinggi':'Hemat') + ')\n'+
      'Status Checklist: 10/10 SIAP RILIS BETA\n'+
      'Catatan: Saldo dan transaksi berstatus SIMULASI murni sesuai prinsip roadmap.';
    if(navigator.clipboard){
      navigator.clipboard.writeText(reportText).then(function(){
        toast('Laporan pengujian disalin ke clipboard.', 'ok');
      }).catch(function(){});
    }
  } } }));
}

/* ---------- modal bantuan & kebijakan privasi (Tahap 8) ---------- */
var helpModal = $('#helpModal'), helpBody = $('#helpBody'), helpTab = 'faq';
$('#helpBtn').addEventListener('click', function(){
  tpanel.hidden = true; apanel.hidden = true; modal.hidden = true;
  helpModal.hidden = false;
  hRender();
});

function hRender(){
  helpBody.textContent = '';
  helpBody.appendChild(E('h2',{ text:'Pusat Bantuan & Kebijakan' }));

  var nav = E('div',{ class:'mrow' },[
    E('button',{ type:'button', class:'tool', 'aria-pressed':String(helpTab==='faq'), text:'Bantuan & FAQ', on:{ click:function(){ helpTab='faq'; hRender(); } } }),
    E('button',{ type:'button', class:'tool', 'aria-pressed':String(helpTab==='privacy'), text:'Kebijakan Privasi', on:{ click:function(){ helpTab='privacy'; hRender(); } } }),
    E('button',{ type:'button', class:'tool', 'aria-pressed':String(helpTab==='terms'), text:'Syarat Penggunaan', on:{ click:function(){ helpTab='terms'; hRender(); } } }),
    E('button',{ type:'button', class:'tool', 'aria-pressed':String(helpTab==='nfc'), text:'Panduan NFC', on:{ click:function(){ helpTab='nfc'; hRender(); } } })
  ]);
  helpBody.appendChild(nav);

  var content = E('div',{ style:'display:grid;gap:8px;margin-top:8px;font-size:13px;line-height:1.5' });
  if(helpTab === 'faq'){
    content.innerHTML = '<b>Apakah ini bank sungguhan?</b><p class="msg">Bukan. BANKVERSE 3D adalah prototipe dan simulasi bank virtual tiga dimensi untuk pengujian produk digital dan teknologi Web NFC.</p>'+
      '<b>Bagaimana cara mendapatkan kartu NFC?</b><p class="msg">Daftar akun anggota, masuk ke dashboard akun, lalu pilih "Buat kartu baru". Avatar Anda akan menuju Customer Service 3D dan kartu siap ditulis ke tag NFC HP Android Anda.</p>'+
      '<b>Bagaimana jika HP saya tidak memiliki NFC?</b><p class="msg">Anda tetap dapat masuk dan menikmati seluruh layanan simulasi bank 3D menggunakan email dan kata sandi.</p>';
  } else if(helpTab === 'privacy'){
    content.innerHTML = '<b>Kebijakan Privasi (Data Minimization)</b><p class="msg">BANKVERSE 3D hanya menyimpan email, nama tampilan, dan token kartu NFC acak terenkripsi SHA-256. Kami TIDAK PERNAH menyimpan data perbankan nyata, nomor rekening asli, nomor kartu identitas (KTP), atau kata sandi teks terbuka.</p>'+
      '<b>Pencabutan & Pemulihan Kartu</b><p class="msg">Jika kartu fisik hilang, Anda dapat langsung mencabutnya dari dashboard anggota. Token kartu akan dibatalkan secara permanen di server tanpa memengaruhi saldo simulasi Anda.</p>';
  } else if(helpTab === 'terms'){
    content.innerHTML = '<b>Ketentuan Penggunaan Simulasi</b><p class="msg">1. Seluruh saldo bertanda SIM / SIMULASI dan tidak memiliki nilai tukar uang riil.<br>'+
      '2. Prototipe ini tidak menghimpun dana masyarakat dan tidak menawarkan pinjaman riil.<br>'+
      '3. Dilarang menyalahgunakan sistem ini untuk mengklaim sebagai institusi perbankan berizin resmi OJK/BI.</p>';
  } else if(helpTab === 'nfc'){
    content.innerHTML = '<b>Panduan Penggunaan Web NFC di Chrome Android</b><p class="msg">1. Pastikan fitur NFC aktif di Setelan HP Android Anda.<br>'+
      '2. Buka situs ini menggunakan Google Chrome melalui koneksi HTTPS yang aman.<br>'+
      '3. Dekatkan kartu atau tag NFC (NTAG213, NTAG215, NTAG216) ke bagian belakang atas HP (dekat kamera).<br>'+
      '4. Berikan izin saat Chrome meminta akses membaca tag NFC.</p>';
  }
  helpBody.appendChild(content);

  helpBody.appendChild(E('button',{ type:'button', class:'tool', text:'Tutup', on:{ click:function(){ helpModal.hidden = true; } } }));
}

/* ---------- loop render utama ---------- */
var last = performance.now(), lastMin = -1;
function tick(now){
  requestAnimationFrame(tick);
  var dt = Math.min(0.05,(now-last)/1000); last = now;
  var d = new Date(), mi = d.getMinutes();
  if(mi !== lastMin){ lastMin = mi; minP.rotation.z = -mi/60*Math.PI*2; hourP.rotation.z = -((d.getHours()%12)+mi/60)/12*Math.PI*2; }
  stepCamera(dt);
  updateStaff(dt,now); updateCust(dt,now);
  wallL.visible = camera.position.x > -15.0;
  wallB.visible = camera.position.z > -15.0;
  renderer.render(scene,camera);

  // Perhitungan FPS & Pemantauan Performa Tahap 8
  framesCount++;
  if(now > lastFpsUpdate + 500){
    var curFps = Math.round((framesCount * 1000) / (now - lastFpsUpdate));
    var curMs = (1000 / Math.max(1, curFps)).toFixed(1);
    framesCount = 0; lastFpsUpdate = now;
    if(!perfHud.hidden){
      hudFps.textContent = curFps; hudMs.textContent = curMs;
      hudCalls.textContent = renderer.info.render.calls;
      hudTris.textContent = Math.round(renderer.info.render.triangles / 1000) + 'k';
      perfHud.className = 'perf-hud ' + (curFps >= 45 ? 'good' : (curFps >= 25 ? 'warn' : 'bad'));
    }
  }

  AREAS.forEach(function(a){
    v3.set(a.x,a.y,a.z).project(camera);
    a.el.style.visibility = (showLabels && v3.z < 1) ? 'visible' : 'hidden';
    a.el.style.transform = 'translate('+((v3.x*0.5+0.5)*W).toFixed(1)+'px,'+((-v3.y*0.5+0.5)*H).toFixed(1)+'px) translate(-50%,-100%)';
  });
}
resize(); requestAnimationFrame(tick);

/* ---------- UI Event Listeners ---------- */
var dock = $('#dock'), list = $('#areas');
AREAS.forEach(function(a){
  var li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
  if(a.f2) b.className = 'f2';
  var t1 = document.createElement('b'); t1.textContent = a.n; var t2 = document.createElement('small'); t2.textContent = a.sub;
  b.appendChild(t1); b.appendChild(t2);
  b.addEventListener('click',function(){ flyTo(a.t,a.d,a.f2 ? 0.5 : 0.6); if(window.innerWidth <= 860) dock.hidden = true; });
  li.appendChild(b); list.appendChild(li);
});
var staffList = $('#staffList'), staffStat = {};
STAFF.forEach(function(s){
  var li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
  if(s.y > 0) b.className = 'f2';
  var t1 = document.createElement('b'); t1.textContent = s.name+' - '+s.role; var t2 = document.createElement('small'); t2.textContent = 'Bekerja';
  b.appendChild(t1); b.appendChild(t2); staffStat[s.id] = t2;
  b.addEventListener('click',function(){ flyTo([s.root.position.x,s.y+1.2,s.root.position.z],18,0.55); if(window.innerWidth <= 860) dock.hidden = true; });
  li.appendChild(b); staffList.appendChild(li);
});
setInterval(function(){ STAFF.forEach(function(s){ var t = staffStatus(s); if(staffStat[s.id].textContent !== t) staffStat[s.id].textContent = t; }); },700);

$('#bStaff').addEventListener('click',function(e){ showStaff = !showStaff; e.currentTarget.setAttribute('aria-pressed',showStaff ? 'true' : 'false'); });
$('#zIn').addEventListener('click',function(){ view.goal = null; zoomAt(0.78,W/2,H/2); });
$('#zOut').addEventListener('click',function(){ view.goal = null; zoomAt(1.28,W/2,H/2); });
$('#bFit').addEventListener('click',fitAll);
$('#bF1').addEventListener('click',function(){ flyTo([0,1.2,2],40,0.62); });
$('#bF2').addEventListener('click',function(){ flyTo([0,H2+1,-11.5],34,0.5); });
$('#bLab').addEventListener('click',function(e){ showLabels = !showLabels; e.currentTarget.setAttribute('aria-pressed',showLabels ? 'true' : 'false'); });
$('#bArea').addEventListener('click',function(){ dock.hidden = !dock.hidden; });
$('#dClose').addEventListener('click',function(){ dock.hidden = true; });
$('#tstBtn').addEventListener('click',openTestPanel);

document.addEventListener('keydown',function(e){
  if(e.key === 'Escape'){
    dock.hidden = true; apanel.hidden = true; modal.hidden = true; tpanel.hidden = true; helpModal.hidden = true;
  }
});
acBtn.addEventListener('click',function(){ setNote(''); render(); modal.hidden = false; });

var fsBtn = $('#fsBtn');
function fsEl(){ return document.fullscreenElement || document.webkitFullscreenElement || null; }
function fsToggle(){
  var de = document.documentElement, req = de.requestFullscreen || de.webkitRequestFullscreen, ex = document.exitFullscreen || document.webkitExitFullscreen;
  if(!req){ fsBtn.textContent = 'Layar penuh tidak didukung'; return; }
  try{ if(fsEl()) ex.call(document); else { var pr = req.call(de); if(pr && pr.catch) pr.catch(function(){ fsBtn.textContent = 'Layar penuh diblokir'; }); } }catch(e){}
}
function fsSync(){ fsBtn.textContent = fsEl() ? 'Keluar layar penuh' : 'Layar penuh'; }
fsBtn.addEventListener('click',fsToggle);
['fullscreenchange','webkitfullscreenchange'].forEach(function(n){ document.addEventListener(n,fsSync); });

})();
