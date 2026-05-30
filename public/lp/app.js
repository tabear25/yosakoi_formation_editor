/* ZIN（陣）landing — interactions */
(function () {
  'use strict';
  var COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899','#0ea5e9','#64748b'];
  var INITIALS = ['あ','は','ゆ','そ','み','れ','さ','か','ひ','つ'];
  var demoCtl = null;

  /* ---- nav scroll state ---- */
  var nav = document.getElementById('nav');
  function onScroll(){ nav.classList.toggle('scrolled', window.scrollY > 12); }
  onScroll(); window.addEventListener('scroll', onScroll, { passive:true });

  /* ---- helpers ---- */
  function makeMarker(color, label){
    var m = document.createElement('div');
    m.className = 'marker';
    m.style.background = color;
    if (label){ m.textContent = label; }
    // readable text colour for light dots (yellow)
    if (color === '#eab308'){ m.style.color = '#1f2937'; }
    return m;
  }
  function place(m, x, y){ m.style.left = x + '%'; m.style.top = y + '%'; }

  /* ---- formation presets (10 dancers, % within stage) ---- */
  var PRESETS = {
    row:   range(10).map(function(i){ return { x: 8 + i*(84/9), y: 50 }; }),
    col:   range(10).map(function(i){ return { x: 50, y: 10 + i*(80/9) }; }),
    grid: (function(){ var xs=[14,32,50,68,86], ys=[37,64], p=[]; ys.forEach(function(y){ xs.forEach(function(x){ p.push({x:x,y:y}); }); }); return p; })(),
    circle: range(10).map(function(i){ var a=-Math.PI/2 + i*(2*Math.PI/10); return { x: 50 + Math.cos(a)*38, y: 47 + Math.sin(a)*36 }; }),
    triangle: [
      {x:26,y:18},{x:42,y:18},{x:58,y:18},{x:74,y:18},
      {x:34,y:40},{x:50,y:40},{x:66,y:40},
      {x:42,y:62},{x:58,y:62},
      {x:50,y:83}
    ]
  };
  function range(n){ var a=[]; for(var i=0;i<n;i++)a.push(i); return a; }

  /* ---- interactive alignment demo ---- */
  var demoStage = document.getElementById('demoStage');
  var demoMarkers = [];
  if (demoStage){
    range(10).forEach(function(i){
      var m = makeMarker(COLORS[i], String(i+1));
      demoStage.appendChild(m); demoMarkers.push(m);
    });
    var applied = false;
    function applyShape(shape){
      var pts = PRESETS[shape] || PRESETS.row;
      demoMarkers.forEach(function(m,i){ place(m, pts[i].x, pts[i].y); });
    }
    var btns = Array.prototype.slice.call(document.querySelectorAll('#shapeBtns .shape-btn'));
    btns.forEach(function(b){
      b.addEventListener('click', function(){
        btns.forEach(function(x){ x.classList.remove('active'); });
        b.classList.add('active');
        applyShape(b.getAttribute('data-shape'));
        stopCycle();
      });
    });
    // initial layout once visible
    applyShape('row');
    // gentle auto-cycle until user interacts
    var order = ['row','col','grid','circle','triangle'], ci = 0, timer = null;
    function tick(){
      ci = (ci+1) % order.length;
      btns.forEach(function(x){ x.classList.toggle('active', x.getAttribute('data-shape')===order[ci]); });
      applyShape(order[ci]);
    }
    function startCycle(){ if(!timer && !reduceMotion()) timer = setInterval(tick, 2600); }
    function stopCycle(){ if(timer){ clearInterval(timer); timer = null; } }
    // exposed to the scroll-driven controller below
    demoCtl = { start:startCycle, stop:stopCycle, el:demoStage };
  }

  /* ---- hero stage static formation ---- */
  var heroStage = document.getElementById('heroStage');
  if (heroStage){
    // a wedge / arrow formation aimed at the audience
    var heroPts = [
      {x:50,y:24},{x:38,y:34},{x:62,y:34},{x:27,y:46},{x:73,y:46},
      {x:40,y:52},{x:60,y:52},{x:30,y:64},{x:50,y:62},{x:70,y:64}
    ];
    heroPts.forEach(function(p,i){
      var m = makeMarker(COLORS[i], INITIALS[i]);
      heroStage.appendChild(m); place(m, p.x, p.y);
    });
  }

  /* ---- scatter dots into a plain box (scenes, sheets, devices, cta) ---- */
  function scatterDots(el, pts, size, opacity){
    if(!el) return;
    pts.forEach(function(p){
      var i = document.createElement('i');
      i.style.left = p.x + '%'; i.style.top = p.y + '%';
      i.style.background = p.c;
      if(size){ i.style.width = size+'px'; i.style.height = size+'px'; }
      if(opacity){ i.style.opacity = opacity; }
      el.appendChild(i);
    });
  }
  function withColors(pts){ return pts.map(function(p,i){ p.c = COLORS[i % COLORS.length]; return p; }); }

  // scene thumbnails — different mini formations
  scatterDots(document.getElementById('sb1'), withColors([{x:14,y:50},{x:30,y:50},{x:46,y:50},{x:62,y:50},{x:78,y:50}]));
  scatterDots(document.getElementById('sb2'), withColors([{x:30,y:30},{x:70,y:30},{x:50,y:50},{x:30,y:72},{x:70,y:72}]));
  scatterDots(document.getElementById('sb3'), withColors([{x:50,y:22},{x:74,y:38},{x:78,y:62},{x:50,y:78},{x:24,y:62},{x:24,y:38}]));
  scatterDots(document.getElementById('sb4'), withColors([{x:18,y:50},{x:38,y:50},{x:50,y:28},{x:62,y:50},{x:82,y:50}]));

  // export sheet — 大円陣 (circle)
  var circlePts = range(10).map(function(i){ var a=-Math.PI/2+i*(2*Math.PI/10); return { x:50+Math.cos(a)*34, y:50+Math.sin(a)*34, c:COLORS[i] }; });
  scatterDots(document.getElementById('sheetStage'), circlePts);

  // devices — a wedge formation, scaled by dot size
  var dvPts = [{x:50,y:22},{x:36,y:38},{x:64,y:38},{x:26,y:56},{x:74,y:56},{x:42,y:54},{x:58,y:54},{x:34,y:74},{x:66,y:74},{x:50,y:72}];
  scatterDots(document.getElementById('dvPc'), withColors(clone(dvPts)));
  scatterDots(document.getElementById('dvTab'), withColors(clone(dvPts)), 9);
  scatterDots(document.getElementById('dvPhone'), withColors(clone(dvPts)), 8);
  function clone(a){ return a.map(function(p){ return {x:p.x,y:p.y}; }); }

  // cta band decorative dots
  var ctaEl = document.getElementById('ctaDots');
  if (ctaEl){
    var cp = [];
    for (var k=0;k<26;k++){ cp.push({ x: Math.random()*100, y: Math.random()*100, c: COLORS[k%COLORS.length] }); }
    cp.forEach(function(p){
      var i=document.createElement('i');
      i.style.left=p.x+'%'; i.style.top=p.y+'%'; i.style.background=p.c;
      var sz=4+Math.random()*9; i.style.width=sz+'px'; i.style.height=sz+'px';
      i.style.opacity=(0.18+Math.random()*0.4).toFixed(2);
      ctaEl.appendChild(i);
    });
  }

  /* ---- FAQ accordion ---- */
  Array.prototype.slice.call(document.querySelectorAll('.faq-item')).forEach(function(item){
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    var snap = null;
    q.addEventListener('click', function(){
      var open = item.classList.contains('open');
      if (snap){ clearTimeout(snap); snap = null; }
      if (open){
        // animate back to height first, then to 0
        a.style.transition = ''; a.style.maxHeight = a.scrollHeight + 'px'; void a.offsetHeight;
        item.classList.remove('open'); a.style.maxHeight = '0px';
      } else {
        item.classList.add('open');
        a.style.transition = ''; a.style.maxHeight = a.scrollHeight + 'px';
        // snap open so the full answer always shows even if the transition is
        // throttled/frozen — and lets long/dynamic copy grow freely
        snap = setTimeout(function(){ if (item.classList.contains('open')){ a.style.transition = 'none'; a.style.maxHeight = 'none'; } }, 320);
      }
    });
  });
  window.addEventListener('resize', function(){
    document.querySelectorAll('.faq-item.open .faq-a').forEach(function(a){ a.style.maxHeight = 'none'; });
  });

  /* ---- scroll-driven reveal + demo cycle (rect-based, no IO dependency) ---- */
  function reduceMotion(){ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var rm = reduceMotion();
  if (rm){ reveals.forEach(function(r){ r.classList.add('in'); }); }

  var ticking = false;
  function inView(el, frac){
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var margin = (frac || 0) * vh;
    return r.top < vh - margin && r.bottom > margin;
  }
  function check(){
    ticking = false;
    if (!rm){
      for (var i = reveals.length - 1; i >= 0; i--){
        if (inView(reveals[i], 0.06)){ revealEl(reveals[i]); reveals.splice(i,1); }
      }
    }
    if (demoCtl){
      if (inView(demoCtl.el, 0.2)) demoCtl.start(); else demoCtl.stop();
    }
  }
  function revealEl(el){
    el.classList.add('in');
    // snap to final state after the animation window so visibility never
    // depends on a running transition (handles throttled/offscreen renders)
    setTimeout(function(){ el.style.transition = 'none'; el.style.opacity = '1'; el.style.transform = 'none'; }, 820);
  }
  function onScrollCheck(){ if (!ticking){ ticking = true; requestAnimationFrame(check); } }
  window.addEventListener('scroll', onScrollCheck, { passive:true });
  window.addEventListener('resize', onScrollCheck);
  window.addEventListener('load', check);
  check();
  // failsafe: never leave any in-view content hidden
  setTimeout(check, 400);
})();
