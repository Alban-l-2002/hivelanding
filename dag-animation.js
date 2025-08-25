(function () {
  const stage = document.getElementById('dag-stage');
  const card  = document.getElementById('dag-card');
  if(!stage || !card) { return; }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svgNS = 'http://www.w3.org/2000/svg';
  const clamp = (v,min,max) => Math.max(min, Math.min(max, v));
  const ease  = (t) => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;

  let playing = false; let timers = []; let rafs = [];
  const addTimeout = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const addRAF = (cb) => { const id = requestAnimationFrame(cb); rafs.push(id); return id; };
  function clearAll(){ timers.forEach(clearTimeout); timers = []; rafs.forEach(cancelAnimationFrame); rafs = []; }

  function animateViewBox(svg, from, to, dur = 800) {
    return new Promise(resolve => {
      const t0 = performance.now();
      const tick = (ts) => {
        if(!playing) return resolve();
        const p = clamp((ts - t0) / dur, 0, 1);
        const e = ease(p);
        const vx = from.x + (to.x - from.x) * e;
        const vy = from.y + (to.y - from.y) * e;
        const vw = from.w + (to.w - from.w) * e;
        const vh = from.h + (to.h - from.h) * e;
        svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
        if (p < 1) addRAF(tick); else resolve();
      };
      addRAF(tick);
    });
  }

  function buildDAG() {
    stage.innerHTML = '';

    // --- SVG scaffold
    const W = 900, H = 360;
    const svg = document.createElementNS(svgNS, 'svg');
    svg.classList.add('dag');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.width = '100%';
    svg.style.height = '100%';
    stage.appendChild(svg);

    // Keep drawing order tidy
    const scene = document.createElementNS(svgNS, 'g');
    svg.appendChild(scene);

    // --- Layout (radial, 1 -> 3 -> 9)
    const cx = W / 2, cy = H / 2;
    const r1 = 110, r2 = 210; // radii for level 1 and 2
    const toRad = a => a * Math.PI / 180;

    // Level-1 directions (up, bottom-left, bottom-right)
    const a1 = [-90, 150, 30];
    const p1 = a1.map(a => ({ x: cx + r1 * Math.cos(toRad(a)), y: cy + r1 * Math.sin(toRad(a)), a }));

    // Level-2 for each level-1: fan out with small angle offsets
    const offsets = [-25, 0, 25];
    const p2 = [];
    p1.forEach(({ a }) => {
      offsets.forEach(off => {
        const aa = a + off;
        p2.push({ x: cx + r2 * Math.cos(toRad(aa)), y: cy + r2 * Math.sin(toRad(aa)), a: aa });
      });
    });

    // --- Helpers
    function edge(x1, y1, x2, y2, delay = 0, dur = 520) {
      const l = document.createElementNS(svgNS, 'line');
      l.setAttribute('class', 'edge');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1);
      l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.setAttribute('stroke', '#ffffff');
      l.setAttribute('stroke-width', '4');
      l.setAttribute('stroke-opacity', '0.9');
      l.setAttribute('stroke-linecap', 'round');
      scene.appendChild(l);
      // Make lines immediately visible for debugging
      setTimeout(() => {
        l.style.strokeDasharray = 'none';
        l.style.strokeDashoffset = '0';
      }, delay);
      return l;
    }

    function node(x, y, delay = 0) {
      const r = document.createElementNS(svgNS, 'rect');
      r.setAttribute('class', 'square');
      r.setAttribute('x', x - 8);
      r.setAttribute('y', y - 8);
      r.setAttribute('width', '16');
      r.setAttribute('height', '16');
      r.setAttribute('rx', '3'); r.setAttribute('ry', '3');
      r.style.opacity = '0';
      r.style.transformOrigin = `${x}px ${y}px`;
      r.style.transform = 'scale(.7)';
      r.style.transition = `opacity 220ms ease ${delay}ms, transform 220ms cubic-bezier(.2,.6,.2,1) ${delay}ms`;
      scene.appendChild(r);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{ r.style.opacity = '1'; r.style.transform = 'scale(1)'; }));
      return r;
    }

    function label(x, y, text, w = 280) {
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'label');
      const padX = 14, padY = 10; const estW = Math.max(160, w); const estH = 62;
      const rect = document.createElementNS(svgNS, 'rect'); rect.setAttribute('x', x + 16); rect.setAttribute('y', y - estH - 6); rect.setAttribute('width', estW); rect.setAttribute('height', estH);
      const txt = document.createElementNS(svgNS, 'text'); txt.setAttribute('x', x + 16 + padX); txt.setAttribute('y', y - estH + padY + 12); txt.textContent = text;
      g.appendChild(rect); g.appendChild(txt);
      g.style.opacity = '0'; g.style.transition = 'opacity 250ms ease';
      scene.appendChild(g);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{ g.style.opacity = '1'; }));
      return g;
    }

    // --- Timeline
    let t = 80;
    node(cx, cy, t); t += 120; // root
    // root -> level-1
    p1.forEach(p => { edge(cx, cy, p.x, p.y, t, 520); node(p.x, p.y, t + 260); t += 240; });
    // level-1 -> level-2 (9 edges + 9 nodes)
    let k = 0; p1.forEach(p => { offsets.forEach(() => { const c = p2[k++]; edge(p.x, p.y, c.x, c.y, t, 480); node(c.x, c.y, t + 240); t += 180; }); });

    // --- Camera narrative: zoom to labels, then back out
    const startNarrativeAfter = t + 600; // let final edges finish
    const currentView = () => { const [x, y, w, h] = (svg.getAttribute('viewBox') || `0 0 ${W} ${H}`).split(/\s+/).map(Number); return { x, y, w, h }; };
    const viewOf = (x, y, scale) => { const tw = W / scale, th = H / scale; return { x: clamp(x - tw / 2, 0, W - tw), y: clamp(y - th / 2, 0, H - th), w: tw, h: th }; };
    const showOnce = (x, y, text, hold = 2000) => new Promise(res => { const g = label(x, y, text); addTimeout(() => { g.style.opacity = '0'; addTimeout(() => { g.remove(); res(); }, 260); }, hold); });

    addTimeout(async () => {
      if(!playing) return;
      // 1) Orchestrator (root)
      await animateViewBox(svg, currentView(), viewOf(cx, cy, 2.2), 800);
      const rootNode = scene.querySelector('rect.square'); if (rootNode) rootNode.classList.add('is-highlight');
      await showOnce(cx, cy, '{\n  "role": "Orchestrator",\n  "responsibility": "Plans & coordinates"\n}', 2200);
      if (rootNode) rootNode.classList.remove('is-highlight');
      if(!playing) return;
      // 2) Team Lead (top child)
      const lead = p1[0];
      await animateViewBox(svg, currentView(), viewOf(lead.x, lead.y, 2.2), 800);
      const leadNode = scene.querySelectorAll('rect.square')[1]; if (leadNode) leadNode.classList.add('is-highlight');
      await showOnce(lead.x, lead.y, '{\n  "role": "Team Lead",\n  "tasks": ["delegate", "review"]\n}', 2200);
      if (leadNode) leadNode.classList.remove('is-highlight');
      if(!playing) return;
      // 3) Worker Agent (first leaf under that lead)
      const worker = p2[0];
      await animateViewBox(svg, currentView(), viewOf(worker.x, worker.y, 2.4), 800);
      const workerNode = scene.querySelectorAll('rect.square')[4]; if (workerNode) workerNode.classList.add('is-highlight');
      await showOnce(worker.x, worker.y, '{\n  "role": "Worker",\n  "action": "execute"\n}', 2200);
      if (workerNode) workerNode.classList.remove('is-highlight');
      if(!playing) return;
      // 4) Return to full view
      await animateViewBox(svg, currentView(), { x: 0, y: 0, w: W, h: H }, 800);
    }, startNarrativeAfter);
  }

  function start() { if (playing || reduceMotion) return; playing = true; buildDAG(); }
  function stop()  { if (!playing) return; playing = false; clearAll(); stage.innerHTML = ''; }
  card.addEventListener('mouseenter', start);
  card.addEventListener('mouseleave', stop);
  card.addEventListener('focus', start);
  card.addEventListener('blur', stop);
})();


