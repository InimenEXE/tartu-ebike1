// teach.js — „Õpeta ratast“ viisard: märgi pildil pidur/gaas/pea, näita vajutusi, AI õpib, proovi AR eelvaates
window.TB = window.TB || {};
(function (TB) {
  'use strict';
  const $ = id => document.getElementById(id);
  const V = TB.Vision, AI = TB.AI, H = TB.Hands;
  const SEQ = [
    { tag: 'brakeOff', k: 'brake', cls: 0, say: 'Hoia PIDUR LAHTI', hl: 'brake' },
    { tag: 'brakeOn', k: 'brake', cls: 1, say: 'Tõmba PIDUR ALLA ja hoia', hl: 'brake' },
    { tag: 'brakeOff2', k: 'brake', cls: 0, say: 'Lase pidur LAHTI', hl: 'brake' },
    { tag: 'brakeOn2', k: 'brake', cls: 1, say: 'Tõmba PIDURIT uuesti', hl: 'brake' },
    { tag: 'gasOff', k: 'gas', cls: 0, say: 'Hoia GAAS LAHTI', hl: 'gas' },
    { tag: 'gasHalf', k: 'gas', cls: 1, say: 'Vajuta GAASI POOLEST', hl: 'gas' },
    { tag: 'gasFull', k: 'gas', cls: 2, say: 'Vajuta GAAS PÕHJA', hl: 'gas' },
    { tag: 'gasOff2', k: 'gas', cls: 0, say: 'Lase GAAS LAHTI', hl: 'gas' },
    { tag: 'steerCenter', k: 'steer', cls: 1, say: 'steerC', hl: 'head' },
    { tag: 'steerLeft', k: 'steer', cls: 0, say: 'steerL', hl: 'head' },
    { tag: 'steerRight', k: 'steer', cls: 2, say: 'steerR', hl: 'head' },
  ];
  const STEPS = [
    { id: 'intro', title: 'Õpetame su ratast', text: 'Pane kaamera nii, et pildis on <b>sinu nägu</b> ja <b>lenks koos kätega</b>. Hea valgus aitab. Kogu õpetamine võtab umbes 1 minuti.' },
    { id: 'brake', title: 'Kus on PIDUR?', text: '👆 <b>Klõpsa pildil pidurihoova peale.</b> Seal hakkab AI jälgima, millal sa pidurdad.', mark: 'brake' },
    { id: 'gas', title: 'Kus on GAAS?', text: '👆 <b>Klõpsa käiguvahetaja (gaasi) peale.</b>', mark: 'gas' },
    { id: 'head', title: 'Kus on su PEA?', text: '👆 <b>Klõpsa oma näole.</b> Seda on vaja ainult siis, kui roolid pea kallutamisega (Seaded → Juhtimine → Rool).', mark: 'head', skip: true },
    { id: 'rec', title: 'Näita, kuidas sa vajutad', text: 'Tee täpselt seda, mida pildil kirjas on. Iga liigutuse ees on 2 s aega valmistuda.' },
    { id: 'train', title: 'AI õpib…', text: 'Närvivõrk õpib sinu liigutustest. Oota hetk.' },
    { id: 'test', title: 'Proovi!', text: 'Vajuta pidurit ja gaasi, kalluta pead. <b>Nooled ja ringid</b> näitavad, mida AI näeb. Kui midagi on valesti, vajuta „Õpeta uuesti“.' }
  ];
  const T = TB.Teach = { step: 0, busy: false };
  let cv, recState = null;

  function renderList() {
    $('teachSteps').innerHTML = STEPS.map((s, i) => `<li class="${i < T.step ? 'done' : i === T.step ? 'cur' : ''}"><span>${i < T.step ? '✓' : i + 1}</span>${s.title}</li>`).join('');
  }
  function render() {
    const s = STEPS[T.step]; renderList();
    $('teachTitle').textContent = s.title; $('teachText').innerHTML = s.text;
    $('teachBack').style.visibility = T.step > 0 && !T.busy ? 'visible' : 'hidden';
    const next = $('teachNext'); next.style.display = 'inline-block';
    if (s.id === 'intro') next.textContent = 'Alusta ▶';
    else if (s.mark) { next.textContent = s.skip ? 'Jäta vahele ▶' : (V.marks[s.mark] ? 'Edasi ▶' : 'Klõpsa pildil…'); next.disabled = !s.skip && !V.marks[s.mark]; }
    else if (s.id === 'rec') { next.textContent = 'Alusta salvestust ●'; next.disabled = false; }
    else if (s.id === 'train') next.style.display = 'none';
    else if (s.id === 'test') next.textContent = '🚲 Sõitma!';
    if (!s.mark) next.disabled = T.busy;
    $('teachRedo').style.display = s.id === 'test' ? 'inline-block' : 'none';
    cv._arOpts = { highlight: s.mark || (recState && recState.hl) || null };
    $('teachBar').style.width = (T.step / (STEPS.length - 1) * 100) + '%';
  }
  function go(i) { const dir = i >= T.step ? 1 : -1; T.step = Math.max(0, Math.min(STEPS.length - 1, i)); if (STEPS[T.step].id === 'head' && TB.S.steerSrc !== 'head') T.step = Math.max(0, Math.min(STEPS.length - 1, T.step + dir)); render(); }

  // suur juhis pildi peal
  function overlay(x, W, Hh, now) {
    const s = STEPS[T.step];
    if (s.mark && !V.marks[s.mark]) {
      const t = now / 1000; x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, Hh - 54, W, 54);
      x.fillStyle = '#fff'; x.font = 'bold ' + Math.round(W / 26) + 'px system-ui'; x.textAlign = 'center'; x.fillText('👆 Klõpsa: ' + { brake: 'PIDUR', gas: 'GAAS', head: 'PEA' }[s.mark], W / 2, Hh - 20 + Math.sin(t * 5) * 3);
    }
    if (recState) {
      const r = recState; x.fillStyle = 'rgba(5,8,14,0.55)'; x.fillRect(0, 0, W, Hh * 0.2);
      x.textAlign = 'center'; x.fillStyle = r.phase === 'prep' ? '#ffd23f' : '#ff4d5e'; x.font = 'bold ' + Math.round(W / 18) + 'px system-ui';
      x.fillText((r.phase === 'prep' ? 'Valmistu: ' : '● ') + r.say, W / 2, Hh * 0.09);
      x.font = 'bold ' + Math.round(W / 34) + 'px system-ui'; x.fillStyle = '#fff'; x.fillText(r.phase === 'prep' ? Math.ceil(r.left) + '…' : 'Salvestan… ' + Math.round(r.p * 100) + '%', W / 2, Hh * 0.165);
      x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(0, Hh * 0.2 - 5, W, 5); x.fillStyle = '#ff4d5e'; x.fillRect(0, Hh * 0.2 - 5, W * ((r.i + (r.phase === 'rec' ? r.p : 0)) / SEQ.length), 5);
    }
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let actx; function beep(f, d) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f; g.gain.value = 0.08; o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + (d || 0.12)); } catch (e) { } }
  async function runRecording() {
    T.busy = true; render();
    for (const k of ['brake', 'gas', 'steer']) AI.clear(k);
    V.samples = {}; V.snapshotRefs();
    const useSteer = TB.S.steerSrc !== 'head' ? H.status === 'ready' : !!V.marks.head;
    const seq = SEQ.filter(s => s.k !== 'steer' || useSteer);
    for (let i = 0; i < seq.length; i++) {
      const s = seq[i]; const src = TB.S.steerSrc;
      const say = s.say === 'steerC' ? (src === 'bar' ? 'Hoia LENKS OTSE' : src === 'hands' ? 'Hoia käed OTSE' : 'Vaata OTSE') : s.say === 'steerL' ? (src === 'bar' ? 'Keera LENKS VASAKULE ◀' : 'Kalluta VASAKULE ◀') : s.say === 'steerR' ? (src === 'bar' ? 'Keera LENKS PAREMALE ▶' : 'Kalluta PAREMALE ▶') : s.say;
      recState = { say, phase: 'prep', left: 2, p: 0, i, hl: s.hl }; cv._arOpts = { highlight: s.hl };
      for (let t = 2000; t > 0; t -= 100) { recState.left = t / 1000; if (t % 1000 === 0) beep(440); await sleep(100); }
      beep(880); recState.phase = 'rec';
      V.onRec = (rec, p) => { recState.p = p; };
      await V.record(s.k, s.cls, 2500, s.tag);
      beep(660, 0.08);
    }
    // ühendame korduste andmed
    const S2 = V.samples; S2.brakeOff = (S2.brakeOff || []).concat(S2.brakeOff2 || []); S2.brakeOn = (S2.brakeOn || []).concat(S2.brakeOn2 || []); S2.gasOff = (S2.gasOff || []).concat(S2.gasOff2 || []);
    recState = null; V.onRec = null; T.busy = false;
    go(STEPS.findIndex(s => s.id === 'train')); await runTraining();
  }
  async function runTraining() {
    T.busy = true; render();
    const warn = V.calibrateFromSamples(); const res = [];
    const ks = ['brake', 'gas', 'steer'].filter(k => AI.data[k].length);
    for (let j = 0; j < ks.length; j++) {
      const k = ks[j];
      try { const inf = await AI.train(k, (ep, n, loss, acc) => { $('teachText').innerHTML = `Õpin: <b>${AI.CONTROLS[k].name}</b> · ${ep}/${n} · täpsus ${Math.round(acc * 100)}%`; $('teachBar').style.width = (((j + ep / n) / ks.length) * 100) + '%'; }, 30, V.featureDim(k)); res.push(`${AI.CONTROLS[k].name}: ${Math.round(inf.acc * 100)}%`); }
      catch (e) { res.push(AI.CONTROLS[k].name + ': ' + e.message); }
    }
    await AI.save(); T.busy = false;
    go(STEPS.findIndex(s => s.id === 'test'));
    $('teachText').innerHTML = STEPS[T.step].text + '<br><br><b>AI täpsus:</b> ' + res.join(' · ') + (warn.length ? `<br>⚠ ${warn.join(' ja ')} liigutus oli väike – vajuta tugevamalt ja õpeta uuesti.` : '');
    TB.UI && TB.UI.refreshAI && TB.UI.refreshAI();
  }
  T.init = function () {
    cv = $('teachCv'); cv._overlay = overlay;
    cv.addEventListener('click', e => {
      const s = STEPS[T.step]; if (!s.mark || T.busy) return;
      const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      V.setMark(s.mark, x, y); beep(880); render();
      setTimeout(() => { if (STEPS[T.step] === s) go(T.step + 1); }, 700);
    });
    $('teachNext').onclick = async () => {
      const s = STEPS[T.step]; if (T.busy) return;
      if (s.id === 'rec') return runRecording();
      if (s.id === 'test') { TB.UI.close('winTeach'); TB.Game.drive(true); return; }
      go(T.step + 1);
    };
    $('teachBack').onclick = () => { if (!T.busy) go(T.step - 1); };
    $('teachRedo').onclick = () => { if (!T.busy) go(1); };
  };
  T.open = function () { go(V.taught ? STEPS.length - 1 : 0); if (V.taught) $('teachText').innerHTML = 'Ratas on juba õpetatud. Proovi liigutusi või vajuta „Õpeta uuesti“.'; };
})(window.TB);
