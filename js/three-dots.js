// Reusable Weave animation that only runs on hover/focus
class Weave {
  constructor(host, opts={}){
    this.host = host;
    this.opts = Object.assign({ width: 800, height: 240, amplitude: 46, frequency: 0.38, tailLength: 320, waveSpeed: 120, dx: 6 }, opts);
    this._build();
    this.playing = false; this._raf = null; this._t0 = 0; this._base = 0;
    this._idle();
  }
  _build(){
    const {width:W, height:H} = this.opts; this.cx = W/2; this.cy = H/2;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    svg.style.width = '100%'; svg.style.height = '100%'; svg.style.display = 'block';
    this.trails = [0,1,2].map(()=>{ const p = document.createElementNS(svgNS, 'path'); p.setAttribute('class','trail'); svg.appendChild(p); return p; });
    this.squares = [0,1,2].map(()=>{ const r = document.createElementNS(svgNS, 'rect'); r.setAttribute('class','square'); r.setAttribute('x','-10'); r.setAttribute('y','-10'); r.setAttribute('width','20'); r.setAttribute('height','20'); svg.appendChild(r); return r; });
    this.host.appendChild(svg); this.svg = svg; this.phases = [0, 2*Math.PI/3, 4*Math.PI/3];
    const {tailLength, dx} = this.opts; this.SAMPLES = Math.max(2, Math.floor(tailLength/dx)); this.dt = dx / this.opts.waveSpeed; this.omega = 2*Math.PI*this.opts.frequency;
  }
  _pathAt(t, phase){ const {SAMPLES, dt, omega, cx, cy} = this; const {dx, amplitude} = this.opts; let d=''; for(let i=0;i<=SAMPLES;i++){ const x=cx - i*dx; const y = cy + amplitude*Math.sin(omega*(t - i*dt) + phase); d += (i? ' L ':'M ') + x.toFixed(2) + ' ' + y.toFixed(2);} return d; }
  _draw(t){ for(let k=0;k<3;k++){ const phase = this.phases[k]; this.trails[k].setAttribute('d', this._pathAt(t, phase)); const y = this.cy + this.opts.amplitude * Math.sin(this.omega * t + phase); this.squares[k].setAttribute('transform', `translate(${this.cx}, ${y})`);} }
  _tick = (ts)=>{ if(!this.playing) return; if(this._t0===0) this._t0 = ts; const t = this._base + (ts - this._t0)/1000; this._draw(t); this._raf = requestAnimationFrame(this._tick); }
  start(){ if(this.playing) return; this.playing = true; this._t0 = 0; this._raf = requestAnimationFrame(this._tick); }
  stop(resetIdle=false){ if(!this.playing && !resetIdle) return; cancelAnimationFrame(this._raf); this._raf=null; this.playing=false; this._base = 0; if(resetIdle) this._idle(); }
  _idle(){ const keepAmp = this.opts.amplitude * 0.15; const prevAmp = this.opts.amplitude; this.opts.amplitude = keepAmp; const t = 0; this._draw(t); this.opts.amplitude = prevAmp; }
}

// Mount weave instances with keyboard + reduced motion support
(function(){
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-weave]').forEach(stage=>{
    const sim = new Weave(stage);
    const card = stage.closest('[data-card]');
    function start(){ if(!reduceMotion) sim.start(); }
    function stop(){ sim.stop(true); }
    if (card) {
      card.addEventListener('mouseenter', start);
      card.addEventListener('mouseleave', stop);
      card.addEventListener('focus', start);
      card.addEventListener('blur', stop);
      card.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); start(); }
        if(e.key === 'Escape'){ stop(); }
      });
    }
  });
})();
