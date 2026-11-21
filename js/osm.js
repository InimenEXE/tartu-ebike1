// osm.js — päris Tartu kaardiandmete laadimine OpenStreetMapist (Overpass API)
// Järjekord: 1) data/tartu-osm.json (sinu GitHubi repos)  2) brauseri vahemälu  3) Overpass API  4) varukaart
window.TB = window.TB || {};
(function (TB) {
  'use strict';
  const LAT0 = 58.3801, LON0 = 26.7224;                 // Raekoja plats = (0,0)
  const KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KZ = 110540;
  TB.P = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
  TB.LL = (x, z) => [LAT0 - z / KZ, LON0 + x / KX];

  // Tartu linn (kõik majad, tänavad, poed) + suur ala maanteede jaoks
  const CITY = '58.330,26.620,58.425,26.840';
  const REGION = '58.00,26.00,58.85,27.40';
  const Q_CITY = `[out:json][timeout:300][maxsize:1073741824][bbox:${CITY}];
(
  way["building"];
  relation["building"]["type"="multipolygon"];
  way["highway"];
  way["natural"="water"]; relation["natural"="water"];
  way["waterway"~"^(river|canal|stream|riverbank)$"];
  way["landuse"]; relation["landuse"];
  way["leisure"~"^(park|garden|pitch|playground|stadium|golf_course|track|sports_centre)$"]; relation["leisure"="park"];
  way["natural"~"^(wood|scrub|grassland|wetland|heath|sand)$"]; relation["natural"="wood"];
  way["railway"="rail"];
  way["amenity"="parking"];
  node["shop"]["name"];
  node["amenity"~"^(restaurant|cafe|fast_food|fuel|pharmacy|bank|bar|pub|cinema|theatre|library|school|university|college|hospital|kindergarten|marketplace|post_office|police|fire_station|place_of_worship)$"]["name"];
  node["tourism"]["name"];
  node["leisure"]["name"];
  way["shop"]["name"]; way["amenity"]["name"]; way["tourism"]["name"];
  node["natural"="tree"];
);
out body geom qt;`;
  const Q_HWY = `[out:json][timeout:240][bbox:${REGION}];
way["highway"~"^(motorway|trunk|primary|secondary|tertiary)(_link)?$"];
out body geom qt;`;
  const MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
  ];
  const KEEP = ['building', 'building:levels', 'height', 'min_height', 'building:colour', 'roof:colour', 'roof:shape', 'name', 'shop', 'amenity', 'tourism',
    'highway', 'lanes', 'oneway', 'natural', 'water', 'waterway', 'landuse', 'leisure', 'railway', 'bridge', 'layer', 'tunnel', 'ref',
    'addr:street', 'addr:housenumber', 'brand', 'area', 'junction', 'service'];

  // ---------- IndexedDB vahemälu ----------
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('tartu-ebike', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  TB.idbGet = async k => { try { const db = await idb(); return await new Promise(res => { const t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result); t.onerror = () => res(null); }); } catch (e) { return null; } };
  TB.idbSet = async (k, v) => { try { const db = await idb(); await new Promise(res => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = res; }); } catch (e) { } };
  TB.idbDel = async k => { try { const db = await idb(); await new Promise(res => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = res; t.onerror = res; }); } catch (e) { } };

  // ---------- allalaadimine edenemisega ----------
  async function fetchProgress(url, opts, label, onProgress) {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(url + ' -> HTTP ' + r.status);
    if (!r.body || !r.body.getReader) return await r.text();
    const rd = r.body.getReader(); const chunks = []; let n = 0;
    for (; ;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); n += value.length; onProgress && onProgress(label + ' ' + (n / 1048576).toFixed(1) + ' MB'); }
    const all = new Uint8Array(n); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
    return new TextDecoder('utf-8').decode(all);
  }
  async function overpass(query, label, onProgress) {
    let lastErr;
    for (const m of MIRRORS) {
      try {
        onProgress && onProgress(label + ' (' + new URL(m).host + ')…');
        const txt = await fetchProgress(m, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, label, onProgress);
        const j = JSON.parse(txt);
        if (!j.elements) throw new Error('vigane vastus');
        return j;
      } catch (e) { lastErr = e; console.warn('Overpass', m, e); }
    }
    throw lastErr || new Error('Overpass ei vasta');
  }

  // ---------- Overpassi JSON -> kompaktne formaat ----------
  function tags(t) { const o = {}; if (!t) return o; for (const k of KEEP) if (t[k] != null) o[k] = t[k]; return o; }
  function geomXZ(g) { const a = new Array(g.length * 2); for (let i = 0; i < g.length; i++) { const p = TB.P(g[i].lat, g[i].lon); a[i * 2] = Math.round(p[0] * 10) / 10; a[i * 2 + 1] = Math.round(p[1] * 10) / 10; } return a; }
  // liidab mitmikpolügooni jooned rõngasteks
  function stitch(lines) {
    const rings = []; const pool = lines.filter(l => l.length >= 4).map(l => l.slice());
    const eq = (a, i, b, j) => Math.abs(a[i] - b[j]) < 0.05 && Math.abs(a[i + 1] - b[j + 1]) < 0.05;
    while (pool.length) {
      let cur = pool.shift();
      let guard = 0;
      while (!eq(cur, 0, cur, cur.length - 2) && guard++ < 5000) {
        let found = false;
        for (let i = 0; i < pool.length; i++) {
          const l = pool[i], L = l.length, C = cur.length;
          if (eq(cur, C - 2, l, 0)) { cur = cur.concat(l.slice(2)); }
          else if (eq(cur, C - 2, l, L - 2)) { const r = []; for (let k = L - 2; k >= 0; k -= 2) r.push(l[k], l[k + 1]); cur = cur.concat(r.slice(2)); }
          else if (eq(cur, 0, l, L - 2)) { cur = l.slice(0, L - 2).concat(cur); }
          else if (eq(cur, 0, l, 0)) { const r = []; for (let k = L - 2; k >= 0; k -= 2) r.push(l[k], l[k + 1]); cur = r.slice(0, r.length - 2).concat(cur); }
          else continue;
          pool.splice(i, 1); found = true; break;
        }
        if (!found) break;
      }
      if (cur.length >= 6) rings.push(cur);
    }
    return rings;
  }
  function compact(jsons) {
    const out = { v: 2, created: new Date().toISOString(), ways: [], rels: [], pois: [] };
    const seen = new Set();
    for (const j of jsons) for (const e of j.elements) {
      const key = e.type + e.id; if (seen.has(key)) continue; seen.add(key);
      if (e.type === 'node') {
        if (!e.tags) continue;
        const p = TB.P(e.lat, e.lon);
        if (e.tags.natural === 'tree') { out.pois.push({ x: Math.round(p[0]), z: Math.round(p[1]), k: 'tree' }); continue; }
        out.pois.push({ x: Math.round(p[0] * 10) / 10, z: Math.round(p[1] * 10) / 10, name: e.tags.name, k: e.tags.shop ? 'shop' : e.tags.amenity ? e.tags.amenity : e.tags.tourism ? 'tourism' : 'other', brand: e.tags.brand });
      } else if (e.type === 'way' && e.geometry) {
        const w = { id: e.id, t: tags(e.tags), g: geomXZ(e.geometry) };
        if (e.tags && e.tags.highway) w.n = e.nodes;
        out.ways.push(w);
      } else if (e.type === 'relation' && e.members) {
        const outer = [], inner = [];
        for (const m of e.members) if (m.type === 'way' && m.geometry) (m.role === 'inner' ? inner : outer).push(geomXZ(m.geometry));
        const r = { id: e.id, t: tags(e.tags), outer: stitch(outer), inner: stitch(inner) };
        if (r.outer.length) out.rels.push(r);
      }
    }
    return out;
  }
  TB.compactOSM = compact;

  // ---------- peamine laadija ----------
  // režiim: 'builtin' (kiire, vaikimisi) või 'osm' (päris OpenStreetMap, aeglane esimesel korral)
  TB.loadMap = async function (onProgress, force) {
    // 1) kaardifail repos (GitHub Pages) – kõige täpsem ja kiire
    if (!force) {
      try {
        const r = await fetch('data/tartu-osm.json', { cache: 'no-cache' });
        if (r.ok) { onProgress(0.05, 'Laen kaardifaili reposse salvestatud kaardist…'); const d = JSON.parse(await r.text()); if (d && d.ways && d.ways.length > 100) { d.source = 'päris OSM kaart (data/tartu-osm.json)'; return d; } }
      } catch (e) { /* faili pole */ }
    }
    if (TB.mapMode() !== 'osm' && !force) { const d = await TB.builtinMap(onProgress); d.source = 'sisseehitatud Tartu (kiire)'; return d; }
    // 2) vahemälu
    if (!force) { const c = await TB.idbGet('osm-v2'); if (c && c.ways && c.ways.length > 100) { c.source = 'päris OSM kaart (vahemälu ' + (c.created || '').slice(0, 10) + ')'; return c; } }
    // 3) Overpass
    try {
      const t0 = performance.now();
      const prog = (m) => { const mb = parseFloat((m.match(/([\d.]+) MB/) || [0, 0])[1]); onProgress(Math.min(0.9, mb / 35), m, t0); };
      const a = await overpass(Q_CITY, 'Laen päris Tartut OpenStreetMapist', prog);
      let b = { elements: [] };
      try { b = await overpass(Q_HWY, 'Laen maanteid', prog); } catch (e) { console.warn('maanteed ei laadinud', e); }
      onProgress(0.95, 'Töötlen kaardiandmeid…'); await new Promise(r => setTimeout(r, 20));
      const d = compact([a, b]); await TB.idbSet('osm-v2', d); d.source = 'päris OSM kaart (värske)'; return d;
    } catch (e) {
      console.warn('OSM laadimine ebaõnnestus', e);
      const d = await TB.builtinMap(onProgress); d.source = 'sisseehitatud Tartu (OSM ei vastanud)'; d.osmFailed = true; return d;
    }
  };
})(window.TB);
