// ====== Hexagon Animation ======
(function() {
  const g = document.getElementById('cluster');
  if (!g) return;

  const svgNS = 'http://www.w3.org/2000/svg';
  const R = 112.5;                    // hex radius (flat-top side length) - 0.75x of 150 for optimal size
  const ORIGIN = { x: 600, y: 420 };  // starting centre - adjusted for larger size
  const SQ3 = Math.sqrt(3);

  // Helpers -----------------------------------------------------------
  const addRAF = fn => requestAnimationFrame(() => requestAnimationFrame(fn));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Axial -> pixel mapping for FLAT-TOP hexes (tiles touch by SIDES)
  const axialToPixel = (q, r) => ({
    x: ORIGIN.x + R * (1.5 * q),
    y: ORIGIN.y + R * (SQ3 * (r + q/2))
  });

  // Corner of a flat-top hex (0..5)
  const corner = (cx, cy, i) => {
    const angle = Math.PI / 180 * (60 * i);
    return [ cx + R * Math.cos(angle), cy + R * Math.sin(angle) ];
  };

  const hexPoints = (cx, cy) => {
    const pts = [];
    for (let i = 0; i < 6; i++) pts.push(corner(cx, cy, i));
    return pts;
  };

  const perimeter = (pts) => {
    let L = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i+1) % pts.length];
      L += Math.hypot(b[0]-a[0], b[1]-a[1]);
    }
    return L;
  };

  // ---------- Gradient utilities ----------
  function paintStroke(el) {
    // Assign via property LAST to control how style.fill/stroke serialises
    el.setAttribute('style', `${el.getAttribute('style')||''};stroke:url(#colorField)`);
    el.style.stroke = 'url(#colorField)';
  }
  function paintFill(el) {
    el.setAttribute('style', `${el.getAttribute('style')||''};fill:url(#colorField)`);
    el.style.fill = 'url(#colorField)'; // final write so el.style.fill returns exactly this
  }
  function forceAllDotsInlineFill() {
    const dots = g.querySelectorAll('circle.dot');
    dots.forEach(d => {
      // strip any previous fill then re-apply exact token
      const raw = (d.getAttribute('style')||'').replace(/fill\s*:\s*[^;]+;?/gi,'');
      d.setAttribute('style', raw);
      d.style.removeProperty('fill');
      d.setAttribute('style', `${d.getAttribute('style')||''};fill:url(#colorField)`);
      d.style.fill = 'url(#colorField)';
    });
  }

  // Create/update the radial colour field centred at the dot below the target hex
  function upsertColorFieldGradient(tc) {
    const existing = document.getElementById('colorField');
    if (existing) existing.remove();
    const grad = document.createElementNS(svgNS, 'radialGradient');
    grad.setAttribute('id', 'colorField');
    grad.setAttribute('gradientUnits', 'userSpaceOnUse');
    const p = corner(tc.x, tc.y, 1); // move hotspot to the dot BELOW the hex (corner index 1)
    const cx = p[0];
    const cy = p[1];
    const rr = R * 2.8;       // radius of the color field
    grad.setAttribute('cx', cx);
    grad.setAttribute('cy', cy);
    grad.setAttribute('r', rr);
    const s0 = document.createElementNS(svgNS, 'stop');
    s0.setAttribute('offset', '0%');
    s0.setAttribute('stop-color', 'rgba(160, 116, 88, 1)');  // Orange-brown center
    s0.setAttribute('stop-opacity', '1');
    const s1 = document.createElementNS(svgNS, 'stop');
    s1.setAttribute('offset', '100%');
    s1.setAttribute('stop-color', 'rgba(52, 76, 95, 1)');    // Blue-gray edge
    s1.setAttribute('stop-opacity', '0.8');
    grad.appendChild(s0);
    grad.appendChild(s1);
    
    // Find existing defs or create one
    let defs = document.querySelector('#cluster').closest('svg').querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(svgNS, 'defs');
      document.querySelector('#cluster').closest('svg').appendChild(defs);
    }
    defs.appendChild(grad);
  }

  // Drawing primitives ------------------------------------------------
  function ripple(x, y, maxR = 28, dur = 420) {
    if (reduceMotion) return;
    const r = document.createElementNS(svgNS, 'circle');
    r.setAttribute('class', 'ring');
    r.setAttribute('cx', x); r.setAttribute('cy', y);
    r.setAttribute('r', 2);
    r.style.transition = `r ${dur}ms cubic-bezier(.22,.61,.36,1), opacity ${dur}ms ease`;
    g.appendChild(r);
    requestAnimationFrame(() => {
      r.style.opacity = '0.85';
      r.setAttribute('r', String(maxR));
      r.style.opacity = '0';
    });
    setTimeout(() => r.remove(), dur + 60);
  }

  function connect(x1, y1, x2, y2, delay = 0, draw = 520, hold = 260, fade = 220) {
    const l = document.createElementNS(svgNS, 'line');
    l.setAttribute('class', 'edge');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1);
    l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    const len = Math.hypot(x2 - x1, y2 - y1);
    l.style.strokeDasharray = String(len);
    l.style.strokeDashoffset = String(len);
    l.style.transition = `stroke-dashoffset ${draw}ms cubic-bezier(.2,.6,.2,1) ${delay}ms`;
    paintStroke(l);
    g.appendChild(l);

    // Make it visible immediately (so you don't see ghost lines later)
    l.style.opacity = '1';

    if (reduceMotion) {
      l.style.strokeDashoffset = '0';
      // quick fade + remove
      setTimeout(() => { l.remove(); }, Math.max(1, draw));
      return l;
    }

    // Animate draw
    addRAF(() => addRAF(() => { l.style.strokeDashoffset = '0'; paintStroke(l); }));

    // Fade out after draw+hold, then remove to avoid background lines
    const ttl = delay + draw + hold;
    setTimeout(() => {
      l.style.transition = `opacity ${fade}ms ease`;
      l.style.opacity = '0';
      setTimeout(() => l.remove(), fade + 40);
    }, ttl);
    return l;
  }

  function hex(cx, cy, delay = 0, dur = 520) {
    const pts = hexPoints(cx, cy);
    const poly = document.createElementNS(svgNS, 'polygon');
    poly.setAttribute('class', 'hex');
    poly.setAttribute('points', pts.map(p => p.join(',')).join(' '));
    const L = perimeter(pts);
    poly.style.strokeDasharray = String(L);
    poly.style.strokeDashoffset = String(L);
    poly.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(.2,.6,.2,1) ${delay}ms`;
    paintStroke(poly);
    g.appendChild(poly);

    if (reduceMotion) {
      poly.style.strokeDashoffset = '0';
    } else {
      addRAF(() => addRAF(() => { poly.style.strokeDashoffset = '0'; paintStroke(poly); }));
    }
    return { poly, pts };
  }

  function dots(pts, delay = 0, dur = 220, isRoot = false, hexKey = null) {
    const circles = [];
    pts.forEach((p, i) => {
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('class', 'dot');
      c.setAttribute('cx', p[0]);
      c.setAttribute('cy', p[1]);
      c.setAttribute('r', 3.5);
      c.style.transition = `opacity ${dur}ms ease ${delay + i*20}ms, transform ${dur}ms cubic-bezier(.2,.6,.2,1) ${delay + i*20}ms`;
      paintFill(c); // ensure inline style immediately
      g.appendChild(c);
      if (reduceMotion) {
        c.style.opacity = '1'; // Full opacity - no transparency
        c.style.transform = 'scale(1)';
        paintFill(c); // reinforce after append
      } else {
        addRAF(() => addRAF(() => { c.style.opacity = '1'; c.style.transform = 'scale(1)'; paintFill(c); }));
      }
      circles.push(c);
    });
    return circles;
  }

  // Layout ------------------------------------------------------------
  const core = [
    { q: 0, r: 0 },   // base (root)
    { q: 1, r: 0 },   // right of base (target for interactivity)
    { q: 2, r: 0 },   // further right
    { q: 1, r: -1 }   // upper-right touching the middle
  ];

  const extras = [
    { q: -1, r: 0 },
    { q: 3,  r: 0 },
    { q: 0,  r: -1 },
    { q: 2,  r: -1 }
  ];

  const below = [
    { q: 0, r: 1 },
    { q: 1, r: 1 },
    { q: 2, r: 1 }
  ];

  const cells = [...core, ...extras, ...below];

  // Index by axial key and centres
  const key = (q,r) => `${q},${r}`;
  const cellSet = new Set(cells.map(c => key(c.q,c.r)));
  const centres = new Map();
  cells.forEach(c => { centres.set(key(c.q,c.r), axialToPixel(c.q, c.r)); });

  // Axial neighbour deltas for flat-top (all 6)
  const NEI6 = [ [1,0], [1,-1], [0,-1], [-1,0], [-1,1], [0,1] ];
  // Unique undirected directions to avoid duplicates
  const UNI3 = [ [1,0], [1,-1], [0,-1] ];

  // BFS tree (parent -> child) starting from root (0,0)
  const rootKey = key(0,0);
  // root hexagon for interactivity: (0,0)
  const targetKey = key(0,0);

  // Now that centres exist, position the gradient
  upsertColorFieldGradient(centres.get(targetKey) || axialToPixel(0,0));
  let targetDots = null;
  const visited = new Set([rootKey]);
  const queue = [rootKey];
  const treeEdges = []; // [parentKey, childKey]
  const treeEdgeSet = new Set();
  const level = new Map([[rootKey, 0]]);

  while (queue.length) {
    const pk = queue.shift();
    const [pq, pr] = pk.split(',').map(Number);
    NEI6.forEach(([dq, dr]) => {
      const nq = pq + dq, nr = pr + dr, nk = key(nq,nr);
      if (cellSet.has(nk) && !visited.has(nk)) {
        visited.add(nk);
        queue.push(nk);
        level.set(nk, (level.get(pk)||0) + 1);
        treeEdges.push([pk, nk]);
        // undirected key
        const ek = [pk, nk].sort().join('>');
        treeEdgeSet.add(ek);
      }
    });
  }

  // All neighbour connections (ensure every adjacent pair is present)
  const allEdges = [];
  cells.forEach(({q,r}) => {
    UNI3.forEach(([dq,dr]) => {
      const a = key(q,r), b = key(q+dq, r+dr);
      if (cellSet.has(b)) allEdges.push([a,b]);
    });
  });

  // Extra edges not in the tree (for full connectivity)
  const extraEdges = allEdges.filter(([a,b]) => !treeEdgeSet.has([a,b].sort().join('>')));

  // --- Timeline ------------------------------------------------------
  let t = 80;
  let maxEnd = 0; // track when everything finishes
  const revealAt = new Map();

  // Root: vertices then outline
  const rootC = centres.get(rootKey);
  const rootPts = hexPoints(rootC.x, rootC.y);
  const t0 = t;
  const rootDots = dots(rootPts, t, 240, true); // vertices first, mark as root
  // Since root is our target, capture these dots for interactivity
  if (targetKey === rootKey) targetDots = rootDots;
  const rootDotsEnd = t0 + 100 + 240;     // last of 6 dots (i*20 => 100)
  maxEnd = Math.max(maxEnd, rootDotsEnd);
  t += 120;

  hex(rootC.x, rootC.y, t, 520);         // draw root outline
  const rootHexEnd = t + 520;
  maxEnd = Math.max(maxEnd, rootHexEnd);
  revealAt.set(rootKey, t);
  t += 180;

  // Animate tree edges outward (guarantees every node appears)
  treeEdges.forEach(([pk, ck]) => {
    const start = t;
    const p = centres.get(pk);
    const c = centres.get(ck);
    connect(p.x, p.y, c.x, c.y, start, 520, 280, 220); // draw -> hold -> fade
    const connectEnd = start + 520 + 280 + 220;
    maxEnd = Math.max(maxEnd, connectEnd);

    hex(c.x, c.y, start + 220, 520); // child outline
    const hexEnd = start + 220 + 520;
    maxEnd = Math.max(maxEnd, hexEnd);

    const cPts = hexPoints(c.x, c.y);
    const created = dots(cPts, start + 260, 220, false, ck);
    if (ck === targetKey) targetDots = created; // capture target dots
    const childDotsEnd = start + 260 + 100 + 220;
    maxEnd = Math.max(maxEnd, childDotsEnd);

    revealAt.set(ck, start + 220);
    t += 200; // advance timeline
  });

  // After nodes are in, add remaining neighbour links, then fade them
  extraEdges.forEach(([a,b]) => {
    const A = centres.get(a), B = centres.get(b);
    const dly = Math.max(revealAt.get(a) || 0, revealAt.get(b) || 0) + 240;
    connect(A.x, A.y, B.x, B.y, dly, 420, 160, 200);
    const extraEnd = dly + 420 + 160 + 200;
    maxEnd = Math.max(maxEnd, extraEnd);
  });

  // One more hardening pass to guarantee inline style value consistency
  forceAllDotsInlineFill();

  // Enable throbbing animation on the 6 vertices *after* all animations complete
  setTimeout(() => {
    (targetDots || []).forEach(d => {
      d.classList.add('interactive');
      const x = +d.getAttribute('cx');
      const y = +d.getAttribute('cy');
      const trigger = () => ripple(x, y, 32, 480);
      d.addEventListener('mouseenter', trigger);
      d.addEventListener('focus', trigger);
      paintFill(d);
    });
    // And patch them all again post-class change
    forceAllDotsInlineFill();
    
    // Add throbbing animation after a short delay
    setTimeout(() => {
      console.log('Attempting to add throbbing animation...');
      console.log('Reduced motion:', reduceMotion);
      console.log('Target dots:', targetDots);
      
      if (!reduceMotion) {
        // Tooltip prompts for each dot
        const tooltipPrompts = [
          "Build a team to run my SaaS",
          "Create an app for driving instructors", 
          "I need a crew for my marketing campaign",
          "Develop a platform for remote teams",
          "Launch an e-commerce solution",
          "Design a workflow automation system"
        ];

        (targetDots || []).forEach((d, i) => {
          d.classList.add('throbbing');
          
          // Create tooltip element
          const tooltip = document.createElement('div');
          tooltip.className = 'hex-tooltip';
          tooltip.textContent = tooltipPrompts[i] || "Let's build something amazing";
          document.body.appendChild(tooltip);
          
          // Add hover event listeners
          const showTooltip = (e) => {
            const rect = d.getBoundingClientRect();
            tooltip.style.left = `${rect.left + rect.width / 2}px`;
            tooltip.style.top = `${rect.top + window.scrollY}px`;
            tooltip.classList.add('visible');
          };
          
          const hideTooltip = () => {
            tooltip.classList.remove('visible');
          };
          
          d.addEventListener('mouseenter', showTooltip);
          d.addEventListener('mouseleave', hideTooltip);
          d.addEventListener('focus', showTooltip);
          d.addEventListener('blur', hideTooltip);
          
          // Store tooltip reference for cleanup
          d._tooltip = tooltip;
          
          // Create efficient but visible throbbing animation
          let frame = 0;
          const maxFrames = 120; // 2 seconds at 60fps
          
          const throb = () => {
            frame = (frame + 1) % maxFrames;
            
            // Use sine wave for smooth animation - much more efficient
            const progress = Math.sin((frame / maxFrames) * Math.PI * 2);
            const scale = 1.5 + (progress * 1.0); // 1.5 to 2.5
            const glowSize = 8 + (Math.abs(progress) * 12); // 8 to 20px (reduced radius)
            const brightness = 1 + (Math.abs(progress) * 2); // 1 to 3 opacity for brightness
            
            // Apply efficient transform and brighter, smaller glow
            d.style.transform = `scale(${scale})`;
            d.style.filter = `url(#dotGlow) drop-shadow(0 0 ${glowSize}px rgba(255, 255, 255, ${brightness}))`;
            d.style.opacity = '1';
            d.style.transformOrigin = 'center';
            
            // Throttle to 30fps instead of 60fps to reduce load
            setTimeout(() => requestAnimationFrame(throb), 33);
          };
          
          // Start the efficient animation
          throb();
          
          console.log(`Added efficient throbbing to dot ${i}:`, d.classList.toString());
        });
        console.log(`Total throbbing dots: ${targetDots ? targetDots.length : 0}`);
      } else {
        console.log('Throbbing disabled due to reduced motion preference');
      }
    }, 500); // Small delay before throbbing starts
  }, reduceMotion ? 0 : (maxEnd + 60));
})();
