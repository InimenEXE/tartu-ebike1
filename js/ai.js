// ai.js — väike närvivõrk (MLP), mida treenitakse otse brauseris sinu enda kaamerapiltidelt.
// Kolm eraldi mudelit: PIDUR (lahti/vajutatud), GAAS (lahti/pool/täis), ROOL (vasak/otse/parem).
window.TB = window.TB || {};
(function (TB) {
  'use strict';
  class MLP {
    constructor(sizes) {
      this.sizes = sizes; this.W = []; this.b = []; this.mW = []; this.vW = []; this.mb = []; this.vb = []; this.t = 0;
      for (let l = 0; l < sizes.length - 1; l++) {
        const n = sizes[l], m = sizes[l + 1], w = new Float32Array(n * m), s = Math.sqrt(2 / n);
        for (let i = 0; i < w.length; i++) w[i] = gauss() * s;
        this.W.push(w); this.b.push(new Float32Array(m));
        this.mW.push(new Float32Array(n * m)); this.vW.push(new Float32Array(n * m)); this.mb.push(new Float32Array(m)); this.vb.push(new Float32Array(m));
      }
    }
    forward(x) {
      const acts = [x];
      for (let l = 0; l < this.W.length; l++) {
        const n = this.sizes[l], m = this.sizes[l + 1], W = this.W[l], b = this.b[l], a = acts[l], o = new Float32Array(m);
        for (let j = 0; j < m; j++) { let s = b[j]; const off = j * n; for (let i = 0; i < n; i++) s += W[off + i] * a[i]; o[j] = s; }
        if (l < this.W.length - 1) for (let j = 0; j < m; j++) o[j] = o[j] > 0 ? o[j] : 0.01 * o[j]; // leaky ReLU
        acts.push(o);
      }
      return acts;
    }
    predict(x) { const a = this.forward(x); return softmax(a[a.length - 1]); }
    // üks minipartii, tagastab keskmise kao
    trainBatch(X, Y, wts, lr, l2) {
      const L = this.W.length, gW = this.W.map(w => new Float32Array(w.length)), gb = this.b.map(b => new Float32Array(b.length));
      let loss = 0, correct = 0;
      for (let s = 0; s < X.length; s++) {
        const acts = this.forward(X[s]); const p = softmax(acts[L]); const y = Y[s], cw = wts[y];
        loss += -Math.log(Math.max(1e-7, p[y])) * cw; let am = 0; for (let k = 1; k < p.length; k++) if (p[k] > p[am]) am = k; if (am === y) correct++;
        let delta = new Float32Array(p.length); for (let k = 0; k < p.length; k++) delta[k] = (p[k] - (k === y ? 1 : 0)) * cw;
        for (let l = L - 1; l >= 0; l--) {
          const n = this.sizes[l], m = this.sizes[l + 1], a = acts[l], W = this.W[l];
          for (let j = 0; j < m; j++) { const d = delta[j]; if (d === 0) continue; gb[l][j] += d; const off = j * n; for (let i = 0; i < n; i++) gW[l][off + i] += d * a[i]; }
          if (l > 0) { const nd = new Float32Array(n); for (let j = 0; j < m; j++) { const d = delta[j]; if (d === 0) continue; const off = j * n; for (let i = 0; i < n; i++) nd[i] += W[off + i] * d; } for (let i = 0; i < n; i++) nd[i] *= a[i] > 0 ? 1 : 0.01; delta = nd; }
        }
      }
      // Adam
      this.t++; const b1 = 0.9, b2 = 0.999, eps = 1e-8, B = X.length, c1 = 1 - Math.pow(b1, this.t), c2 = 1 - Math.pow(b2, this.t);
      for (let l = 0; l < L; l++) {
        const W = this.W[l], mW = this.mW[l], vW = this.vW[l], g = gW[l];
        for (let i = 0; i < W.length; i++) { const gi = g[i] / B + l2 * W[i]; mW[i] = b1 * mW[i] + (1 - b1) * gi; vW[i] = b2 * vW[i] + (1 - b2) * gi * gi; W[i] -= lr * (mW[i] / c1) / (Math.sqrt(vW[i] / c2) + eps); }
        const bb = this.b[l], mb = this.mb[l], vb = this.vb[l], h = gb[l];
        for (let i = 0; i < bb.length; i++) { const gi = h[i] / B; mb[i] = b1 * mb[i] + (1 - b1) * gi; vb[i] = b2 * vb[i] + (1 - b2) * gi * gi; bb[i] -= lr * (mb[i] / c1) / (Math.sqrt(vb[i] / c2) + eps); }
      }
      return { loss: loss / B, acc: correct / B };
    }
    toJSON() { return { sizes: this.sizes, W: this.W.map(w => Array.from(w, v => +v.toFixed(5))), b: this.b.map(b => Array.from(b, v => +v.toFixed(5))) }; }
    static fromJSON(j) { const m = new MLP(j.sizes); m.W = j.W.map(a => Float32Array.from(a)); m.b = j.b.map(a => Float32Array.from(a)); return m; }
  }
  function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function softmax(z) { let m = -1e9; for (const v of z) if (v > m) m = v; const e = z.map(v => Math.exp(v - m)); const s = e.reduce((a, b) => a + b, 0); return e.map(v => v / s); }

  // ---------- AI juhtimine ----------
  const AI = TB.AI = {
    CONTROLS: {
      brake: { name: 'PIDUR', classes: ['lahti', 'vajutatud'], size: 16 },
      gas: { name: 'GAAS (käiguvahetaja)', classes: ['lahti', 'pool', 'täis'], size: 16 },
      steer: { name: 'ROOL (pea)', classes: ['vasak', 'otse', 'parem'], size: 20 }
    },
    data: { brake: [], gas: [], steer: [] },     // {x:Float32Array, y:int}
    models: { brake: null, gas: null, steer: null },
    info: { brake: null, gas: null, steer: null },
    training: false
  };
  AI.MLP = MLP;
  AI.count = (k, cls, dim) => AI.data[k].filter(s => s.y === cls && (!dim || s.x.length === dim)).length;
  AI.addSample = (k, x, y) => { AI.data[k].push({ x, y }); if (AI.data[k].length > 4000) AI.data[k].splice(0, 1); };
  AI.clear = k => { AI.data[k] = []; AI.models[k] = null; AI.info[k] = null; AI.save(); };
  AI.predict = (k, x) => AI.models[k] ? AI.models[k].predict(x) : null;
  // väärtus mängu jaoks: pidur/gaas 0..1, rool -1..1
  AI.value = (k, p) => { if (!p) return 0; if (k === 'brake') return p[1]; if (k === 'gas') return p[1] * 0.5 + p[2]; return p[2] - p[0]; };

  function augment(x) {
    const a = 0.8 + Math.random() * 0.4, b = (Math.random() - 0.5) * 0.3, o = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) o[i] = x[i] * a + b + (Math.random() - 0.5) * 0.15;
    return o;
  }
  // Treenib ühe mudeli; onStep(epoch, epochs, trainLoss, valAcc) kutsutakse iga epohhi järel
  AI.train = async function (k, onStep, epochs, dim) {
    const D = dim ? AI.data[k].filter(s => s.x.length === dim) : AI.data[k], C = AI.CONTROLS[k].classes.length;
    if (!D.length) throw new Error(AI.CONTROLS[k].name + ': selles režiimis pole näiteid');
    const counts = new Array(C).fill(0); D.forEach(s => counts[s.y]++);
    const missing = counts.map((c, i) => c < 15 ? AI.CONTROLS[k].classes[i] : null).filter(Boolean);
    if (missing.length) throw new Error(AI.CONTROLS[k].name + ': liiga vähe näiteid klassile ' + missing.join(', ') + ' (vaja vähemalt 15)');
    const idx = D.map((_, i) => i).sort(() => Math.random() - 0.5);
    const nVal = Math.max(C * 3, Math.floor(D.length * 0.15));
    const val = idx.slice(0, nVal).map(i => D[i]), tr = idx.slice(nVal).map(i => D[i]);
    const wts = counts.map(c => D.length / (C * c));
    const m = new MLP([D[0].x.length, 48, 24, C]);
    epochs = epochs || 40; const BS = 16; let lastVal = 0, lastLoss = 0;
    for (let ep = 0; ep < epochs; ep++) {
      tr.sort(() => Math.random() - 0.5);
      let L = 0, nb = 0; const lr = 0.003 * (ep < epochs * 0.7 ? 1 : 0.3);
      for (let i = 0; i < tr.length; i += BS) {
        const bt = tr.slice(i, i + BS); const r = m.trainBatch(bt.map(s => augment(s.x)), bt.map(s => s.y), wts, lr, 1e-4); L += r.loss; nb++;
        if (nb % 25 === 0) await new Promise(r => setTimeout(r, 0));
      }
      let ok = 0; for (const s of val) { const p = m.predict(s.x); let am = 0; for (let c = 1; c < C; c++) if (p[c] > p[am]) am = c; if (am === s.y) ok++; }
      lastVal = ok / val.length; lastLoss = L / nb;
      onStep && onStep(ep + 1, epochs, lastLoss, lastVal);
      await new Promise(r => setTimeout(r, 0));
    }
    AI.models[k] = m; AI.info[k] = { acc: lastVal, loss: lastLoss, n: D.length, date: new Date().toISOString() };
    await AI.save();
    return AI.info[k];
  };

  // ---------- salvestamine (brauser + fail) ----------
  function packData(all) { // Int8 + base64, et fail oleks väike (ainult viimase režiimi näited)
    if (!all.length) return { dim: 0, y: [], x: '' };
    const dim = all[all.length - 1].x.length, arr = all.filter(s => s.x.length === dim), buf = new Int8Array(arr.length * dim);
    arr.forEach((s, j) => { for (let i = 0; i < dim; i++) buf[j * dim + i] = Math.max(-127, Math.min(127, Math.round(s.x[i] * 32))); });
    let bin = ''; const u = new Uint8Array(buf.buffer); for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
    return { dim, y: arr.map(s => s.y), x: btoa(bin) };
  }
  function unpackData(p) {
    if (!p || !p.dim) return []; const bin = atob(p.x), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const b = new Int8Array(u.buffer); return p.y.map((y, j) => { const x = new Float32Array(p.dim); for (let i = 0; i < p.dim; i++) x[i] = b[j * p.dim + i] / 32; return { x, y }; });
  }
  AI.exportAll = function (rois) {
    const o = { app: 'tartu-ebike-ai', v: 1, date: new Date().toISOString(), rois, models: {}, info: AI.info, data: {} };
    for (const k in AI.models) { o.models[k] = AI.models[k] ? AI.models[k].toJSON() : null; o.data[k] = packData(AI.data[k]); }
    return o;
  };
  AI.importAll = function (o) {
    if (!o || o.app !== 'tartu-ebike-ai') throw new Error('See pole Tartu E-Bike AI fail');
    for (const k in AI.models) { AI.models[k] = o.models && o.models[k] ? MLP.fromJSON(o.models[k]) : null; AI.data[k] = unpackData(o.data && o.data[k]); AI.info[k] = o.info ? o.info[k] : null; }
    return o.rois;
  };
  AI.save = async function () { if (TB.idbSet) await TB.idbSet('ai-v1', AI.exportAll(TB.Vision ? TB.Vision.rois : null)); };
  AI.load = async function () {
    let o = TB.idbGet ? await TB.idbGet('ai-v1') : null;
    if (!o) { try { const r = await fetch('data/ai-model.json', { cache: 'no-cache' }); if (r.ok) o = await r.json(); } catch (e) { } }
    if (o) { try { return AI.importAll(o); } catch (e) { console.warn(e); } }
    return null;
  };
})(window.TB);
