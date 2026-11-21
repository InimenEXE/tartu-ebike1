// tartu-map.js — sisseehitatud Tartu kaart (avaneb kohe, ei vaja internetti).
// Peateed, Emajõgi ja vaatamisväärsused on päris koordinaatidel; linnaosade tänavad ja majad on
// tehtud linnaosa iseloomu järgi (Vanalinn, Supilinn, Karlova, Annelinn, Ihaste, Tammelinn jne).
window.TB = window.TB || {};
(function (TB) {
  'use strict';
  // ---------- deterministlik juhuslikkus (sama linn iga kord) ----------
  let seed = 20261121; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = a => a[(rnd() * a.length) | 0];

  // ---------- peateed (päris koordinaadid, lähendatud) ----------
  const MAIN = [
    { n: 'Tallinna maantee', h: 'trunk', l: 4, p: [[58.3868, 26.7158], [58.3940, 26.7050], [58.4010, 26.6930], [58.4100, 26.6780], [58.4200, 26.6600], [58.4400, 26.6300], [58.4800, 26.5800], [58.5400, 26.5000], [58.6000, 26.4300], [58.6600, 26.3500], [58.7200, 26.2600]] },
    { n: 'Riia maantee', h: 'trunk', l: 4, p: [[58.3770, 26.7190], [58.3720, 26.7130], [58.3650, 26.7000], [58.3570, 26.6850], [58.3500, 26.6700], [58.3300, 26.6300], [58.3000, 26.5800], [58.2600, 26.5200], [58.2100, 26.4500], [58.1600, 26.3800]] },
    { n: 'Narva maantee', h: 'trunk', l: 4, p: [[58.3822, 26.7290], [58.3860, 26.7400], [58.3910, 26.7550], [58.3970, 26.7720], [58.4050, 26.7950], [58.4200, 26.8300], [58.4450, 26.8900], [58.4700, 26.9600], [58.5000, 27.0400]] },
    { n: 'Võru maantee', h: 'primary', l: 2, p: [[58.3720, 26.7240], [58.3620, 26.7300], [58.3540, 26.7360], [58.3420, 26.7420], [58.3200, 26.7550], [58.2900, 26.7800], [58.2500, 26.8100], [58.2000, 26.8500]] },
    { n: 'Räpina maantee', h: 'primary', l: 2, p: [[58.3540, 26.7360], [58.3480, 26.7600], [58.3420, 26.7900], [58.3350, 26.8300], [58.3250, 26.9000], [58.3100, 26.9800]] },
    { n: 'Viljandi maantee', h: 'primary', l: 2, p: [[58.3650, 26.7000], [58.3700, 26.6750], [58.3740, 26.6400], [58.3750, 26.5900], [58.3700, 26.5200], [58.3600, 26.4400]] },
    { n: 'Luunja maantee', h: 'secondary', l: 2, p: [[58.3700, 26.7760], [58.3720, 26.8000], [58.3740, 26.8300], [58.3760, 26.8700], [58.3780, 26.9200]] },
    { n: 'Ringtee', h: 'primary', l: 4, p: [[58.3520, 26.6740], [58.3530, 26.6900], [58.3530, 26.7050], [58.3515, 26.7200], [58.3540, 26.7360], [58.3590, 26.7520], [58.3640, 26.7640], [58.3700, 26.7760]] },
    { n: 'Turu tänav', h: 'secondary', l: 4, p: [[58.3772, 26.7300], [58.3720, 26.7380], [58.3660, 26.7480], [58.3600, 26.7550]] },
    { n: 'Vabaduse puiestee', h: 'tertiary', p: [[58.3845, 26.7228], [58.3810, 26.7262], [58.3790, 26.7278], [58.3765, 26.7298]] },
    { n: 'Ülikooli tänav', h: 'residential', p: [[58.3835, 26.7212], [58.3810, 26.7205], [58.3790, 26.7210], [58.3765, 26.7200]] },
    { n: 'Rüütli tänav', h: 'living_street', p: [[58.3832, 26.7228], [58.3815, 26.7230], [58.3803, 26.7228]] },
    { n: 'Lai tänav', h: 'residential', p: [[58.3850, 26.7195], [58.3830, 26.7200], [58.3812, 26.7190]] },
    { n: 'Jakobi tänav', h: 'tertiary', p: [[58.3835, 26.7212], [58.3845, 26.7170], [58.3855, 26.7120], [58.3868, 26.7158]] },
    { n: 'Kalda tee', h: 'secondary', l: 2, p: [[58.3810, 26.7390], [58.3760, 26.7480], [58.3700, 26.7600], [58.3640, 26.7700], [58.3590, 26.7800], [58.3540, 26.7950]] },
    { n: 'Sõpruse puiestee', h: 'secondary', l: 4, p: [[58.3700, 26.7330], [58.3712, 26.7420], [58.3725, 26.7500], [58.3740, 26.7600], [58.3760, 26.7720]] },
    { n: 'Anne tänav', h: 'secondary', p: [[58.3785, 26.7330], [58.3755, 26.7450], [58.3720, 26.7600], [58.3690, 26.7720], [58.3660, 26.7820]] },
    { n: 'Kaunase puiestee', h: 'secondary', l: 4, p: [[58.3800, 26.7560], [58.3760, 26.7650], [58.3710, 26.7760], [58.3660, 26.7860]] },
    { n: 'Jaama tänav', h: 'tertiary', p: [[58.3860, 26.7335], [58.3910, 26.7370], [58.3960, 26.7410], [58.4050, 26.7480]] },
    { n: 'Aardla tänav', h: 'tertiary', p: [[58.3650, 26.7000], [58.3610, 26.7120], [58.3590, 26.7230], [58.3570, 26.7320]] },
    { n: 'Tähe tänav', h: 'tertiary', p: [[58.3742, 26.7180], [58.3690, 26.7200], [58.3640, 26.7220], [58.3560, 26.7250]] },
    { n: 'Raadi tee', h: 'residential', p: [[58.3862, 26.7400], [58.3910, 26.7460], [58.3950, 26.7510], [58.3975, 26.7560]] },
    { n: 'Ihaste tee', h: 'tertiary', p: [[58.3600, 26.7550], [58.3580, 26.7650], [58.3560, 26.7760], [58.3545, 26.7900], [58.3530, 26.8000]] },
    { n: 'Puiestee', h: 'tertiary', p: [[58.3880, 26.7240], [58.3920, 26.7300], [58.3950, 26.7330], [58.3985, 26.7350]] },
    { n: 'Kreutzwaldi tänav', h: 'tertiary', p: [[58.3835, 26.7340], [58.3860, 26.7450], [58.3880, 26.7560]] },
    { n: 'Lille tänav', h: 'residential', p: [[58.3700, 26.7000], [58.3740, 26.7060], [58.3770, 26.7120], [58.3790, 26.7175]] },
    { n: 'Kuperjanovi tänav', h: 'tertiary', p: [[58.3830, 26.7130], [58.3860, 26.7050], [58.3890, 26.6970]] },
    { n: 'Ropka tee', h: 'tertiary', p: [[58.3640, 26.7220], [58.3620, 26.7330], [58.3600, 26.7440], [58.3600, 26.7550]] },
    { n: 'Lunini tänav', h: 'tertiary', p: [[58.3720, 26.7130], [58.3700, 26.7200], [58.3690, 26.7260], [58.3700, 26.7330]] },
    { n: 'Emajõe tänav', h: 'residential', p: [[58.3850, 26.7230], [58.3880, 26.7200], [58.3910, 26.7140], [58.3940, 26.7090]] },
    { n: 'Ravila tänav', h: 'tertiary', p: [[58.3680, 26.7000], [58.3700, 26.6900], [58.3720, 26.6820]] },
    { n: 'Nõlvaku tänav', h: 'residential', p: [[58.3700, 26.7600], [58.3670, 26.7680], [58.3640, 26.7760]] },
  ];
  const RIVER = [[58.4120, 26.6200], [58.4080, 26.6450], [58.4060, 26.6600], [58.4020, 26.6800], [58.3985, 26.6960], [58.3945, 26.7080], [58.3890, 26.7170], [58.3845, 26.7232], [58.3812, 26.7262], [58.3780, 26.7292], [58.3740, 26.7340], [58.3705, 26.7410], [58.3670, 26.7500], [58.3625, 26.7610], [58.3575, 26.7720], [58.3530, 26.7850], [58.3500, 26.8050], [58.3480, 26.8300], [58.3500, 26.8600], [58.3550, 26.9000], [58.3600, 26.9500]];
  // linnaosad: [nimi, keskpunkt, laius×kõrgus m, nurk, tänavavahe m, tüüp, tänavanimed]
  const DISTRICTS = [
    { n: 'Supilinn', c: [58.3878, 26.7215], s: [700, 450], a: -0.6, sp: 85, t: 'wooden', names: ['Herne', 'Oa', 'Kartuli', 'Marja', 'Meloni', 'Lepiku', 'Põik', 'Kroonuaia', 'Aleksandri', 'Kalda'] },
    { n: 'Karlova', c: [58.3700, 26.7270], s: [1100, 800], a: 0.12, sp: 95, t: 'wooden', names: ['Salme', 'Kalevi', 'Lina', 'Päeva', 'Õnne', 'Tüve', 'Pargi', 'Kesk', 'Tiigi', 'Raudtee', 'Kalda', 'Võru põik'] },
    { n: 'Tammelinn', c: [58.3615, 26.7020], s: [1300, 900], a: 0.3, sp: 100, t: 'houses', names: ['Tamme', 'Kreegi', 'Kaare', 'Lääne', 'Kuu', 'Päikese', 'Vikerkaare', 'Ilmatsalu', 'Valgamaa', 'Viljandi'] },
    { n: 'Annelinn', c: [58.3720, 26.7700], s: [1700, 1300], a: -0.45, sp: 190, t: 'panel', names: ['Mõisavahe', 'Nõlvaku', 'Uus', 'Pikk', 'Ploomi', 'Vasara', 'Annemõisa', 'Jaamamõisa', 'Kaunase'] },
    { n: 'Ihaste', c: [58.3540, 26.7820], s: [1500, 900], a: 0.25, sp: 95, t: 'houses', names: ['Paju', 'Õuna', 'Pirni', 'Kirsi', 'Kase', 'Lepa', 'Pihlaka', 'Vahtra', 'Ristiku', 'Luha', 'Sireli', 'Tamme'] },
    { n: 'Raadi-Kruusamäe', c: [58.3895, 26.7500], s: [1300, 900], a: -0.2, sp: 105, t: 'mixed', names: ['Peetri', 'Roosi', 'Kalmistu', 'Muuseumi tee', 'Rõõmu tee', 'Puiestee', 'Vanemuise', 'Kruusamäe', 'Lepiku'] },
    { n: 'Tähtvere', c: [58.3900, 26.7040], s: [1000, 700], a: 0.5, sp: 105, t: 'houses', names: ['Kungla', 'Laulupeo', 'Tähtvere', 'Oru', 'Vaba', 'Hurda', 'Pepleri', 'Kastani'] },
    { n: 'Veeriku', c: [58.3610, 26.6760], s: [1100, 900], a: 0.15, sp: 120, t: 'mixed', names: ['Raja', 'Veeriku', 'Tuglase', 'Rebase', 'Kaare', 'Riia põik', 'Kalda', 'Mäe'] },
    { n: 'Ropka', c: [58.3610, 26.7380], s: [1000, 700], a: 0.2, sp: 140, t: 'industrial', names: ['Jalaka', 'Sõbra', 'Ravila', 'Tähe', 'Ropka', 'Turu', 'Aardla põik'] },
    { n: 'Jaamamõisa', c: [58.3960, 26.6900], s: [900, 700], a: 0.4, sp: 160, t: 'panel', names: ['Rõõmu', 'Ilmatsalu', 'Kaare', 'Jaamamõisa'] },
    { n: 'Maarjamõisa', c: [58.3720, 26.6980], s: [700, 500], a: 0.3, sp: 150, t: 'institutional', names: ['Puusepa', 'Nooruse', 'Ravila', 'Oru'] },
  ];
  // vaatamisväärsused ja suured hooned [nimi, lat, lon, laius, sügavus, kõrgus, nurk, tüüp, värv]
  const LANDMARKS = [
    ['Tartu Raekoda', 58.3801, 26.7215, 40, 16, 14, 0.08, 'townhall', '#e9b9a8'],
    ['Tartu Ülikooli peahoone', 58.3812, 26.7199, 60, 22, 16, 0.05, 'university', '#f4f1ea'],
    ['Jaani kirik', 58.3822, 26.7212, 48, 20, 18, 0.1, 'church', '#a9583d'],
    ['Toomkiriku varemed', 58.3797, 26.7158, 80, 26, 20, 0.15, 'church', '#9a6a52'],
    ['Emajõe Ärikeskus', 58.3778, 26.7335, 26, 26, 62, 0.3, 'office', '#7fa5c4'],
    ['Tasku keskus', 58.3784, 26.7312, 60, 55, 22, -0.4, 'retail', '#c8cdd2'],
    ['Tartu Kaubamaja', 58.3779, 26.7279, 70, 40, 18, -0.6, 'retail', '#c9c2b4'],
    ['Kvartal', 58.3762, 26.7272, 60, 45, 20, -0.6, 'retail', '#b5bcc4'],
    ['AHHAA keskus', 58.3762, 26.7360, 50, 30, 9, 0.3, 'public', '#9aa8b4'],
    ['Vanemuise teater', 58.3768, 26.7218, 60, 40, 20, 0.1, 'public', '#efe7d6'],
    ['A. Le Coq õlletehas', 58.3735, 26.7150, 90, 55, 16, 0.2, 'industrial', '#a65a42'],
    ['Tartu rongijaam', 58.3764, 26.7085, 34, 12, 10, 0.6, 'train_station', '#e8d9b5'],
    ['Eesti Rahva Muuseum', 58.3965, 26.7525, 70, 356, 14, 0.6, 'museum', '#3a4650'],
    ['Lõunakeskus', 58.3578, 26.6775, 260, 140, 16, 0.1, 'retail', '#d6d6d0'],
    ['Eeden', 58.3735, 26.7660, 120, 80, 12, -0.45, 'retail', '#d2d0c8'],
    ['Aardla Selver', 58.3575, 26.7335, 90, 60, 9, 0.2, 'retail', '#eeeeee'],
    ['Sõbra keskus', 58.3700, 26.7385, 70, 45, 9, 0.2, 'retail', '#dcdcd6'],
    ['Tartu Ülikooli Kliinikum', 58.3720, 26.6950, 160, 60, 24, 0.3, 'hospital', '#e8e4dc'],
    ['Delta õppehoone', 58.3853, 26.7290, 60, 50, 32, -0.5, 'university', '#c7d0d6'],
    ['Peetri kirik', 58.3868, 26.7395, 40, 18, 16, -0.3, 'church', '#a9583d'],
    ['Tartu Kunstimuuseum (viltune maja)', 58.3806, 26.7240, 16, 12, 12, 0.08, 'public', '#f1d9c6'],
  ];
  const SHOPS = [
    ['Selver', 58.3575, 26.7335], ['Sõbra Selver', 58.3700, 26.7385], ['Kvartali Selver', 58.3762, 26.7272], ['Annelinna Selver', 58.3735, 26.7660], ['Ränilinna Selver', 58.3550, 26.6900],
    ['Rimi', 58.3784, 26.7312], ['Rimi Annelinn', 58.3705, 26.7720], ['Rimi Hyper', 58.3578, 26.6775], ['Maxima', 58.3905, 26.7505], ['Maxima Ihaste', 58.3555, 26.7790],
    ['Coop Konsum', 58.3690, 26.7210], ['Coop Konsum', 58.3610, 26.7020], ['Coop Konsum', 58.3880, 26.7220], ['Lidl', 58.3605, 26.6905], ['Lidl', 58.3655, 26.7470],
    ['Apotheka', 58.3798, 26.7228], ['Benu apteek', 58.3779, 26.7279], ['Circle K', 58.3630, 26.6980], ['Circle K', 58.3930, 26.7600], ['Olerex', 58.3560, 26.7240], ['Alexela', 58.3700, 26.7740],
    ['Werner', 58.3796, 26.7205], ['Vilde ja Vine', 58.3804, 26.7186], ['Pierre', 58.3800, 26.7225], ['Pizza Grande', 58.3720, 26.7650], ['McDonald\'s', 58.3700, 26.7100], ['Hesburger', 58.3786, 26.7300],
    ['Kaubamaja', 58.3779, 26.7279], ['Tasku', 58.3784, 26.7312], ['Lõunakeskus', 58.3578, 26.6775], ['Eeden', 58.3735, 26.7660], ['Raekoja plats', 58.3801, 26.7224], ['Toomemägi', 58.3800, 26.7165],
    ['AHHAA', 58.3762, 26.7360], ['ERM', 58.3965, 26.7525], ['Kaarsild', 58.3812, 26.7262], ['Tartu Turuhoone', 58.3786, 26.7290], ['Botaanikaaed', 58.3832, 26.7270], ['Tähtvere park', 58.3890, 26.7060],
  ];

  function catmull(pts, step) {
    if (pts.length < 3) { const o = []; const [a, b] = pts; const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step)); for (let i = 0; i <= n; i++)o.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); return o; }
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.ceil(L / step));
      for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
    }
    out.push(pts[pts.length - 1].slice()); return out;
  }
  const flat = pts => { const g = []; pts.forEach(p => g.push(Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10)); return g; };
  function pip(g, x, z) { let ins = false; for (let i = 0, j = g.length - 2; i < g.length; j = i, i += 2) { const xi = g[i], zi = g[i + 1], xj = g[j], zj = g[j + 1]; if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) ins = !ins; } return ins; }
  function segDist(ax, az, bx, bz, x, z) { const vx = bx - ax, vz = bz - az, wx = x - ax, wz = z - az; let t = (vx * wx + vz * wz) / (vx * vx + vz * vz || 1); t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(wx - vx * t, wz - vz * t); }
  const RW = { trunk: 18, primary: 13, secondary: 12, tertiary: 10, residential: 7, living_street: 6, service: 4.5, unclassified: 7 };

  TB.builtinMap = async function (onProgress) {
    seed = 20261121;
    const tick = async (f, m) => { onProgress && onProgress(f, m); await new Promise(r => setTimeout(r, 0)); };
    const d = { v: 2, builtin: true, ways: [], rels: [], pois: [], extras: [] };
    let nid = 1, wid = 1;
    const ids = n => { const a = []; for (let i = 0; i < n; i++)a.push(nid++); return a; };
    // --- jõgi ---
    await tick(0.02, 'Joonistan Emajõge…');
    const rc = catmull(RIVER.map(a => TB.P(a[0], a[1])), 25);
    const L = [], R = [];
    rc.forEach((p, i) => {
      const a = rc[Math.max(0, i - 1)], b = rc[Math.min(rc.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const w = 32 + 8 * Math.sin(i * 0.37) + (Math.hypot(p[0], p[1]) < 1500 ? 0 : 6); L.push([p[0] + dz * w, p[1] - dx * w]); R.push([p[0] - dz * w, p[1] + dx * w]);
    });
    const riverRing = flat(L.concat(R.reverse()).concat([L[0]]));
    d.ways.push({ id: wid++, t: { natural: 'water', water: 'river', name: 'Emajõgi' }, g: riverRing });
    const inWater = (x, z) => pip(riverRing, x, z);
    // --- pargid ja maakasutus ---
    const poly = (cx, cz, rx, rz, n, jit) => { const g = []; for (let i = 0; i <= n; i++) { const a = (i % n) / n * Math.PI * 2, j = 1 + (rnd() - 0.5) * jit; g.push(cx + Math.cos(a) * rx * j, cz + Math.sin(a) * rz * j); } g[g.length - 2] = g[0]; g[g.length - 1] = g[1]; return g; };
    const area = (ll, rx, rz, tags) => { const p = TB.P(ll[0], ll[1]); d.ways.push({ id: wid++, t: tags, g: poly(p[0], p[1], rx, rz, 18, 0.25) }); };
    area([58.3800, 26.7165], 230, 180, { leisure: 'park', name: 'Toomemägi' });
    area([58.3832, 26.7270], 90, 70, { leisure: 'garden', name: 'Botaanikaaed' });
    area([58.3890, 26.7060], 260, 180, { leisure: 'park', name: 'Tähtvere park' });
    area([58.3960, 26.7600], 500, 300, { leisure: 'park', name: 'Raadi park' });
    area([58.3880, 26.7520], 160, 120, { landuse: 'cemetery', name: 'Raadi kalmistu' });
    area([58.3740, 26.7500], 200, 90, { leisure: 'park', name: 'Anne kanal' });
    area([58.3745, 26.7480], 150, 35, { natural: 'water', name: 'Anne kanal' });
    area([58.3620, 26.7900], 500, 250, { landuse: 'meadow', name: 'Emajõe luht' });
    area([58.3700, 26.8100], 900, 400, { landuse: 'meadow', name: 'Emajõe Suursoo' });
    area([58.3880, 26.6880], 150, 90, { leisure: 'pitch', name: 'Tähtvere staadion' });
    // metsad ja põllud linna ümber
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2, r = 4500 + rnd() * 16000, x = Math.cos(a) * r, z = Math.sin(a) * r;
      d.ways.push({ id: wid++, t: rnd() < 0.55 ? { landuse: 'forest' } : { landuse: 'farmland' }, g: poly(x, z, 300 + rnd() * 900, 200 + rnd() * 700, 14, 0.4) });
    }
    // --- peateed ---
    await tick(0.08, 'Ehitan peateid…');
    const roads = []; // {g:[[x,z]], n:[ids], t}
    for (const r of MAIN) {
      const pts = catmull(r.p.map(a => TB.P(a[0], a[1])), 14);
      roads.push({ pts, n: ids(pts.length), t: Object.assign({ highway: r.h, name: r.n }, r.l ? { lanes: String(r.l) } : {}, r.h === 'trunk' ? { ref: r.n.startsWith('Tallinna') ? '2' : r.n.startsWith('Riia') ? '3' : '3' } : {}) });
    }
    // ruudustik peateede jaoks (lähedustest)
    const G = 50, grid = new Map(); const gk = (x, z) => Math.floor(x / G) * 100003 + Math.floor(z / G);
    const addRoadGrid = (r, ri) => { for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1]; const k = gk((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); for (let dx = -1; dx <= 1; dx++)for (let dz = -1; dz <= 1; dz++) { const kk = k + dx * 100003 + dz; let l = grid.get(kk); if (!l) { l = []; grid.set(kk, l); } l.push([ri, i]); } } };
    roads.forEach(addRoadGrid);
    const nearRoad = (x, z, ignore) => { const l = grid.get(gk(x, z)); let best = 1e9, bw = 0; if (l) for (const [ri, i] of l) { if (ri === ignore) continue; const r = roads[ri], a = r.pts[i], b = r.pts[i + 1]; const dd = segDist(a[0], a[1], b[0], b[1], x, z) - (RW[r.t.highway] || 7) / 2; if (dd < best) { best = dd; bw = RW[r.t.highway] || 7; } } return best; };
    // --- linnaosade tänavad ---
    await tick(0.15, 'Ehitan linnaosade tänavaid…');
    const districtOf = []; // [x,z,hw,hh,ca,sa,type,name]
    for (const D of DISTRICTS) {
      const c = TB.P(D.c[0], D.c[1]), ca = Math.cos(D.a), sa = Math.sin(D.a), [W, Hh] = D.s, sp = D.sp;
      districtOf.push({ c, ca, sa, hw: W / 2, hh: Hh / 2, t: D.t, n: D.n });
      const nu = Math.floor(W / sp), nv = Math.floor(Hh / sp), nodeId = new Map(), pos = new Map();
      const P2 = (i, j) => { const key = i + ',' + j; if (!pos.has(key)) { const u = -W / 2 + i * sp + (rnd() - 0.5) * 10, v = -Hh / 2 + j * sp + (rnd() - 0.5) * 10; pos.set(key, [c[0] + u * ca - v * sa, c[1] + u * sa + v * ca]); nodeId.set(key, nid++); } return pos.get(key); };
      const nameU = D.names, h = D.t === 'panel' ? 'residential' : D.t === 'industrial' ? 'service' : 'residential';
      for (let i = 0; i <= nu; i++)for (let j = 0; j <= nv; j++) {
        for (const [di, dj, nm] of [[1, 0, nameU[j % nameU.length]], [0, 1, nameU[(i + 3) % nameU.length]]]) {
          if (i + di > nu || j + dj > nv) continue; if (rnd() < 0.07) continue;
          const a = P2(i, j), b = P2(i + di, j + dj), mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
          if (inWater(a[0], a[1]) || inWater(b[0], b[1]) || inWater(mx, mz)) continue;
          if (nearRoad(a[0], a[1]) < 14 && nearRoad(b[0], b[1]) < 14) continue; // kattub peateega
          const pts = [a, [mx, mz], b];
          roads.push({ pts, n: [nodeId.get(i + ',' + j), nid++, nodeId.get((i + di) + ',' + (j + dj))], t: { highway: h, name: nm + (nm.includes(' ') ? '' : ' tänav') } });
        }
      }
    }
    // --- otsapunktide ühendamine (et autod saaks ristmikel pöörata) ---
    await tick(0.22, 'Ühendan ristmikke…');
    grid.clear(); roads.forEach(addRoadGrid);
    const use = new Map(); roads.forEach(r => r.n.forEach(id => use.set(id, (use.get(id) || 0) + 1)));
    roads.forEach((r, ri) => {
      for (const e of [0, r.pts.length - 1]) {
        if (use.get(r.n[e]) > 1) continue; const p = r.pts[e]; const l = grid.get(gk(p[0], p[1])); if (!l) continue;
        let best = 32, bp = null;
        for (const [rj, i] of l) { if (rj === ri) continue; const o = roads[rj]; for (const k of [i, i + 1]) { const q = o.pts[k]; const dd = Math.hypot(q[0] - p[0], q[1] - p[1]); if (dd < best) { best = dd; bp = [rj, k]; } } }
        if (bp) { const o = roads[bp[0]]; r.pts[e] = o.pts[bp[1]].slice(); r.n[e] = o.n[bp[1]]; use.set(r.n[e], (use.get(r.n[e]) || 0) + 1); }
      }
    });
    for (const r of roads) d.ways.push({ id: wid++, t: r.t, g: flat(r.pts), n: r.n });
    // Raekoja plats (kõnniala)
    { const p = TB.P(58.3801, 26.7224); const g = []; [[-70, -32], [70, -32], [70, 32], [-70, 32], [-70, -32]].forEach(([u, v]) => { const a = 0.08; g.push(p[0] + u * Math.cos(a) - v * Math.sin(a), p[1] + u * Math.sin(a) + v * Math.cos(a)); }); d.ways.push({ id: wid++, t: { highway: 'pedestrian', area: 'yes', name: 'Raekoja plats' }, g }); }
    // jalgteed parkides
    for (const [lat, lon, n] of [[58.3800, 26.7165, 'Toomemäe tee'], [58.3890, 26.7060, 'Tähtvere pargi tee'], [58.3740, 26.7500, 'Anne kanali promenaad']]) { const p = TB.P(lat, lon); const pts = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2; pts.push([p[0] + Math.cos(a) * 120, p[1] + Math.sin(a) * 90]); } d.ways.push({ id: wid++, t: { highway: 'footway', name: n }, g: flat(pts) }); }

    // --- majad ---
    await tick(0.3, 'Ehitan maju…');
    const occ = new Set(); const ok = (x, z) => Math.floor(x / 7) * 100003 + Math.floor(z / 7);
    const reserve = (x, z, r) => { for (let a = -r; a <= r; a += 7)for (let b = -r; b <= r; b += 7)if (a * a + b * b <= r * r) occ.add(ok(x + a, z + b)); };
    const districtAt = (x, z) => {
      for (const D of districtOf) { const dx = x - D.c[0], dz = z - D.c[1]; const u = dx * D.ca + dz * D.sa, v = -dx * D.sa + dz * D.ca; if (Math.abs(u) < D.hw && Math.abs(v) < D.hh) return D.t; }
      const dist = Math.hypot(x, z); if (dist < 520 && x < 230) return 'oldtown'; if (dist < 900) return 'center'; if (dist < 3500) return 'mixed'; if (dist < 6000) return 'houses'; return 'rural';
    };
    let bid = 5000000;
    const addB = (cx, cz, w, dp, ang, tags) => {
      const c = Math.cos(ang), s = Math.sin(ang), corners = [[-dp / 2, -w / 2], [dp / 2, -w / 2], [dp / 2, w / 2], [-dp / 2, w / 2]];
      const g = []; for (const [u, v] of corners) { const x = cx + u * c + v * s, z = cz - u * s + v * c; if (nearRoad(x, z) < 3 || inWater(x, z)) return false; g.push(x, z); }
      if (nearRoad(cx, cz) < 3 || inWater(cx, cz)) return false;
      const cells = []; for (let u = -dp / 2; u <= dp / 2; u += 5)for (let v = -w / 2; v <= w / 2; v += 5) { const k = ok(cx + u * c + v * s, cz - u * s + v * c); if (occ.has(k)) return false; cells.push(k); }
      cells.forEach(k => occ.add(k)); g.push(g[0], g[1]);
      d.ways.push({ id: bid++, t: tags, g: g.map(v => Math.round(v * 10) / 10) }); return true;
    };
    // vaatamisväärsused enne
    for (const [n, lat, lon, w, dp, h, a, type, col] of LANDMARKS) { const p = TB.P(lat, lon); addB(p[0], p[1], w, dp, a, { building: type, name: n, height: String(h), 'building:colour': col }); }
    reserve(...TB.P(58.3801, 26.7224), 75); reserve(...TB.P(58.3800, 26.7165), 200); reserve(...TB.P(58.3890, 26.7060), 230); reserve(...TB.P(58.3960, 26.7600), 420);
    const style = (t, dist) => {
      switch (t) {
        case 'oldtown': return { w: 14 + rnd() * 14, d: 12 + rnd() * 8, tags: { building: 'apartments', 'building:levels': String(3 + (rnd() * 2 | 0)) }, gap: 1 };
        case 'center': return rnd() < 0.5 ? { w: 25 + rnd() * 30, d: 18 + rnd() * 15, tags: { building: 'commercial', 'building:levels': String(5 + (rnd() * 7 | 0)) }, gap: 4 } : { w: 18 + rnd() * 16, d: 14 + rnd() * 8, tags: { building: 'apartments', 'building:levels': String(4 + (rnd() * 3 | 0)) }, gap: 3 };
        case 'wooden': return rnd() < 0.8 ? { w: 10 + rnd() * 8, d: 9 + rnd() * 5, tags: { building: 'house', 'building:levels': String(1 + (rnd() * 2 | 0)), wooden: '1' }, gap: 5 } : { w: 16 + rnd() * 10, d: 12, tags: { building: 'apartments', 'building:levels': '3' }, gap: 5 };
        case 'houses': return { w: 9 + rnd() * 6, d: 8 + rnd() * 5, tags: { building: rnd() < 0.85 ? 'house' : 'garage', 'building:levels': String(1 + (rnd() * 2 | 0)) }, gap: 12 };
        case 'panel': return rnd() < 0.85 ? { w: 55 + rnd() * 50, d: 12, tags: { building: 'apartments', 'building:levels': rnd() < 0.45 ? '9' : '5', panel: '1' }, gap: 18 } : { w: 30 + rnd() * 30, d: 25, tags: { building: 'retail', 'building:levels': '2' }, gap: 15 };
        case 'industrial': return { w: 30 + rnd() * 50, d: 20 + rnd() * 30, tags: { building: rnd() < 0.7 ? 'industrial' : 'warehouse', 'building:levels': String(1 + (rnd() * 2 | 0)) }, gap: 12 };
        case 'institutional': return { w: 40 + rnd() * 40, d: 18 + rnd() * 12, tags: { building: rnd() < 0.5 ? 'university' : 'hospital', 'building:levels': String(3 + (rnd() * 5 | 0)) }, gap: 15 };
        case 'mixed': return rnd() < 0.55 ? { w: 10 + rnd() * 6, d: 9 + rnd() * 4, tags: { building: 'house', 'building:levels': '2' }, gap: 10 } : { w: 25 + rnd() * 25, d: 13, tags: { building: 'apartments', 'building:levels': String(3 + (rnd() * 3 | 0)) }, gap: 10 };
        default: return rnd() < 0.15 ? { w: 10 + rnd() * 6, d: 8 + rnd() * 4, tags: { building: rnd() < 0.7 ? 'house' : 'farm_auxiliary', 'building:levels': '1' }, gap: 60 } : null;
      }
    };
    let ri = 0;
    for (const r of roads) {
      if (++ri % 250 === 0) await tick(0.3 + 0.55 * ri / roads.length, 'Ehitan maju… ' + ri + ' / ' + roads.length + ' tänavat');
      const hw = (RW[r.t.highway] || 7) / 2;
      const P = r.pts; let acc = 0;
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.1) continue;
        const fx = (b[0] - a[0]) / L, fz = (b[1] - a[1]) / L;
        for (let s = acc; s < L; ) {
          const x = a[0] + fx * s, z = a[1] + fz * s; const dist = Math.hypot(x, z);
          if (dist > 9000 && r.t.highway === 'trunk' && rnd() < 0.97) { s += 60; continue; }
          const t = districtAt(x, z), st = style(t, dist); if (!st) { s += 40; continue; }
          for (const sd of [-1, 1]) {
            const off = hw + 4 + st.d / 2 + rnd() * (t === 'houses' || t === 'wooden' ? 6 : 2);
            addB(x - fz * off * sd, z + fx * off * sd, st.w, st.d, Math.atan2(fx, fz), st.tags);
            if ((t === 'panel' || t === 'houses' || t === 'wooden' || t === 'mixed') && rnd() < 0.7) { const st2 = style(t, dist); if (st2) { const off2 = off + st.d / 2 + st2.d / 2 + 10 + rnd() * 14; addB(x - fz * off2 * sd, z + fx * off2 * sd, st2.w, st2.d, Math.atan2(fx, fz) + (t === 'panel' && rnd() < 0.4 ? Math.PI / 2 : 0), st2.tags); } }
          }
          s += st.w + st.gap * (0.6 + rnd() * 0.8);
        }
        acc = 0;
      }
    }
    // --- poed ja kohad ---
    for (const [n, lat, lon] of SHOPS) { const p = TB.P(lat, lon); d.pois.push({ x: p[0], z: p[1], name: n, k: /Selver|Rimi|Maxima|Coop|Lidl|Apotheka|apteek|Circle|Olerex|Alexela|Kaubamaja|Tasku|Lõunakeskus|Eeden/.test(n) ? 'shop' : 'tourism' }); }
    for (const D of DISTRICTS) { const p = TB.P(D.c[0], D.c[1]); d.pois.push({ x: p[0], z: p[1], name: D.n, k: 'place' }); }
    // tänavapuud
    for (const r of roads) { if (r.t.highway === 'trunk' || r.t.highway === 'service') continue; const hw = (RW[r.t.highway] || 7) / 2; for (let i = 0; i < r.pts.length - 1; i += 2) { if (rnd() < 0.55) continue; const a = r.pts[i], b = r.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, sd = rnd() < 0.5 ? -1 : 1; d.pois.push({ x: a[0] - (b[1] - a[1]) / L * (hw + 2.6) * sd, z: a[1] + (b[0] - a[0]) / L * (hw + 2.6) * sd, k: 'tree' }); } }
    // eriobjektid (kaarsild, tornid, kuppel…)
    const E = (type, lat, lon, o) => { const p = TB.P(lat, lon); d.extras.push(Object.assign({ type, x: p[0], z: p[1] }, o || {})); };
    E('arch', 58.3812, 26.7262, { ang: -0.75, span: 80 }); E('spire', 58.3801, 26.7215, { h: 14, w: 7, top: 30, col: '#e9b9a8' }); E('spire', 58.3822, 26.7212, { h: 18, w: 8, top: 45, col: '#a9583d' });
    E('spire', 58.3868, 26.7395, { h: 16, w: 7, top: 52, col: '#a9583d' }); E('dome', 58.3762, 26.7360, { r: 20 }); E('columns', 58.3812, 26.7199, { ang: 0.05 }); E('ermroof', 58.3965, 26.7525, { ang: 0.6 });
    E('fountain', 58.3801, 26.7224);
    await tick(0.9, 'Kaart valmis');
    return d;
  };
})(window.TB);
