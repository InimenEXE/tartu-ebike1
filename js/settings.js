// settings.js — kõik seaded ühes kohas (salvestatakse brauserisse)
window.TB = window.TB || {};
(function (TB) {
  'use strict';
  const DEF = {
    // juhtimine
    steerSrc: 'bar', lookCam: true, lookSens: 1.0, steerSens: 1.0, invert: false, deadzone: 0.12, brakeSens: 1.0, gasSens: 1.0, handsAI: true, showAR: true, roiSize: 34,
    // graafika
    quality: 'high', viewDist: 2600, fov: 75, speedLines: true, labels: true, clouds: true,
    // maailm
    mapMode: 'builtin', traffic: 100, maxSpeed: 300, battery: true,
    // heli
    volume: 0.8, motorSound: true,
    // kuva
    minimap: true, units: 'kmh', firstPerson: true, hudScale: 1.0,
    // süsteem
    wallpaper: 'aurora', accent: '#ff6b35'
  };
  const RELOAD = new Set(['quality', 'mapMode', 'traffic']);
  let S = {}; try { S = JSON.parse(localStorage.getItem('tb-settings') || '{}'); } catch (e) { }
  // vana kaardirežiimi seade
  try { if (!S.mapMode && localStorage.getItem('tb-map')) S.mapMode = localStorage.getItem('tb-map'); } catch (e) { }
  TB.S = Object.assign({}, DEF, S);
  TB.S_DEFAULTS = DEF;
  const subs = [];
  TB.setSetting = function (k, v) {
    TB.S[k] = v; try { localStorage.setItem('tb-settings', JSON.stringify(TB.S)); if (k === 'mapMode') localStorage.setItem('tb-map', v); } catch (e) { }
    subs.forEach(f => f(k, v)); return RELOAD.has(k);
  };
  TB.onSetting = f => subs.push(f);
  TB.needsReload = k => RELOAD.has(k);
  TB.resetSettings = function () { try { localStorage.removeItem('tb-settings'); } catch (e) { } location.reload(); };
  // kaardirežiimi funktsioonid, mida osm.js kasutab
  TB.mapMode = () => TB.S.mapMode;
  TB.setMapMode = m => TB.setSetting('mapMode', m);
})(window.TB);
