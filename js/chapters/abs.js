// Chapter 5: grip, slip and ABS, as a live simulation of one braked wheel. 1 scene unit = 10 cm.
// The wheel is seen from the car's centre line, so the disc, caliper, toothed sensor ring and the
// ABS valve block are in front of the tyre. The car drives towards +x.
// Model (all in brake.js, makeAbs): a quarter of the car (300 kg) on one tyre; tyre friction from
//   Burckhardt's slip curves for dry asphalt, wet asphalt and snow; wheel inertia 1.0 kg·m²; brake
//   torque = pressure × 2 μ_pad A r_eff; the driver stamps the pedal to 120 bar; the ABS valves
//   hold, release and re-apply on slip thresholds; steering by combined slip. Nothing here is
//   scripted: lock-up, the pulsing, the loss of steering and the distances all come out of it.
// Thinking distance: 0.68 s at the starting speed, the figure behind the UK Highway Code's table
//   (Rule 126). Its typical dry-road distances are shown for comparison.
// The wheel and the road are drawn turning at 12% of true speed so the eye can follow them.
import { THREE, M, box, rod, tube, arrow, canvasTexture, approach, clamp } from '../kit.js';
import {
  G, KMH, BAR, SURF, WHEEL, T_THINK, muSlip, muPeak, makeAbs, absRun, highwayCode, COL, hex, fmt0, fmtM, board, panelBg, title, text, axes, line, dot,
  makeRotor, makeCaliper, makeTyre, ringZ, iron, steel, shade, framer, fitView, fitNarrow, rows, TAU,
} from '../brake.js';

const R = 3, SLOW = 0.12, WX = -4.6, OBST = 0.86;
const opts = (s, abs = s.abs) => ({ kmh: s.speed, surf: s.surf, abs, steer: s.steer });
const PH = { apply: ['Apply: inlet valve open', '#5ce1a9'], hold: ['Hold: both valves shut', '#ffb547'], release: ['Release: outlet valve open', '#49c6ff'] };
const ROADCOL = { dry: '#2b2f36', wet: '#1b2536', snow: '#c9d6e4' };

export default {
  id: 'abs',
  short: 'Grip and ABS',
  title: 'Grip, slip and ABS',
  subtitle: 'A tyre grips best while it is still turning. ABS keeps it there, several times a second.',
  view: { pos: [2, 8, 23], target: [0.5, 6, 0] },
  learn: `<p>Brakes only stop the wheel. It is the <b>tyre's grip on the road</b> that stops the car. And grip depends on <b>slip</b>: how much slower the tyre's surface is moving than the road beneath it.</p>
    <p>A little slip is good. Grip climbs to a peak at about <b>10 to 20% slip</b>. Brake harder than that and the wheel suddenly stops turning: it <b>locks</b> and slides. A sliding tyre grips less, so the stop gets longer. Worse, a sliding tyre pushes only against the direction it is sliding. It has nothing left for turning, so a car with locked front wheels goes <b>straight on</b>, whatever the steering wheel says. <a href="https://glassbox.how/frictionclear/">FrictionClear</a> has more on grip.</p>
    <p><b>ABS</b>, the anti-lock braking system, watches each wheel with a <b>toothed ring and a sensor</b>. When a wheel slows much faster than the car could, a computer shuts a valve to <b>hold</b> the brake pressure, opens another to <b>release</b> some, and lets it build again as the wheel spins back up. It repeats this several times a second. You feel it as a buzz in the pedal.</p>
    <p>ABS holds the tyre near its peak grip. On tarmac that usually shortens the stop, but its real gift is that you can <b>still steer</b>. On loose gravel or deep snow a locked wheel can pile up a wedge in front of itself and stop shorter than ABS does. <b>EBD</b> uses the same valves to trim the rear brakes, and <b>stability control</b> brakes single wheels to stop a spin.</p>
    <p>India made ABS compulsory on new car models from 1 April 2018 and on all new cars from 1 April 2019. New two-wheelers above 125 cc need ABS, and smaller ones ABS or combined brakes, under the same dates. See <a href="https://glassbox.how/motorcycleclear/">MotorcycleClear</a>.</p>
    <p class="tip"><b>Try it:</b> brake on the wet road with ABS off and watch the wheel speed fall to zero. Switch ABS on, turn on steering, and brake again.</p>`,
  terms: [
    { t: 'Slip', d: 'How much slower the tyre\'s tread moves than the road, as a share of the car\'s speed. 0% is rolling freely, 100% is locked.' },
    { t: 'Lock-up', d: 'A braked wheel stopping dead while the car is still moving, so the tyre slides.' },
    { t: 'ABS', d: 'Anti-lock braking system. It senses a wheel about to lock and briefly lowers that brake\'s pressure.' },
    { t: 'Wheel-speed sensor', d: 'A sensor that counts the teeth of a ring on the hub as they pass, to measure how fast the wheel turns.' },
    { t: 'Thinking distance', d: 'How far the car travels between the driver seeing a hazard and the brakes going on.' },
    { t: 'EBD', d: 'Electronic brake-force distribution: ABS hardware used to share braking between front and rear wheels.' },
  ],
  defaults: { speed: 80, surf: 'wet', abs: false, steer: false, slow: true },
  controls: [
    { key: 'go', type: 'buttons', label: 'Emergency stop', items: [{ label: 'Stamp on the brake', act: (s, inst) => inst.brake() }, { label: 'Drive again', act: (s, inst) => inst.reset() }] },
    { key: 'abs', type: 'toggle', label: 'ABS' },
    { key: 'steer', type: 'toggle', label: 'Steer around the obstacle', hint: 'Asks the tyre to move the car one lane (3.5 m) sideways while braking.' },
    { key: 'surf', type: 'seg', label: 'Road', options: [{ v: 'dry', label: 'Dry' }, { v: 'wet', label: 'Wet' }, { v: 'snow', label: 'Snow' }], fmt: (v) => 'peak grip ' + muPeak(v).mu.toFixed(2) },
    { key: 'speed', type: 'range', label: 'Speed', min: 40, max: 140, step: 5, fmt: (v) => v + ' km/h' },
    { key: 'slow', type: 'toggle', label: 'Slow motion', hint: 'Quarter speed, so you can see the pulses.' },
  ],
  quiz: [
    { q: 'When does a tyre grip the road hardest under braking?', options: ['When the wheel is locked solid', 'When it slips a little, about 10 to 20%', 'When it is not braked at all', 'Grip is the same at any slip'], answer: 1, why: 'The friction curve peaks at a small slip. A locked, sliding tyre has less grip than one still turning.' },
    { q: 'Why can\'t a car with locked front wheels steer?', options: ['The steering wheel jams', 'A sliding tyre\'s friction points straight back along the slide, leaving no sideways force', 'The power steering switches off', 'The tyres go flat'], answer: 1, why: 'Friction on a sliding tyre opposes the direction of sliding. Turning the wheel does not change that direction, so there is no force to turn the car.' },
    { q: 'What does ABS do when it senses a wheel about to lock?', options: ['Presses the brake harder', 'Holds, then briefly lowers the brake pressure at that wheel, then lets it build again', 'Switches the engine off', 'Locks the other wheels too'], answer: 1, why: 'Valves hold and release pressure so the wheel spins back up towards peak grip, then pressure is re-applied. The cycle repeats many times a second.' },
  ],
  reel: [
    { ms: 5600, caption: 'Stamp on the brake on a wet road without ABS: the wheel locks, slides, and cannot steer.', set: { speed: 80, surf: 'wet', abs: false, steer: true, slow: false }, act: (s, inst) => { inst.reset(); inst.brake(); }, spin: 0 },
    { ms: 6000, caption: 'ABS holds, releases and re-applies the pressure many times a second, so the tyre keeps gripping and steering.', set: { speed: 80, surf: 'wet', abs: true, steer: true, slow: false }, act: (s, inst) => { inst.reset(); inst.brake(); }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    // ---- road: a strip whose dashes slide back under the wheel
    const roadTex = canvasTexture(512, 64, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.28)'; for (let i = 0; i < 8; i++) g.fillRect(i * 64 + 8, 6 + (i % 3) * 18, 26, 5); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3); });
    roadTex.tex.wrapS = THREE.RepeatWrapping; roadTex.tex.repeat.set(6, 1);
    const roadM = new THREE.MeshStandardMaterial({ map: roadTex.tex, color: 0x2b2f36, roughness: 0.6, metalness: 0.1 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(26, 4.4), roadM); road.rotation.x = -Math.PI / 2; road.position.set(WX + 4, 0.02, 0); road.receiveShadow = true; root.add(road);
    // ---- wheel: tyre and rim behind, disc, caliper and sensor ring in front
    const Wg = new THREE.Group(); Wg.position.set(WX, R, 0); root.add(Wg);
    const spinG = new THREE.Group(); Wg.add(spinG);
    spinG.add(makeTyre(R, 1.9));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU, sp = box(R * 0.5, 0.34, 0.2, steel(0x9aa1ad)); sp.position.set(Math.cos(a) * R * 0.36, Math.sin(a) * R * 0.36, 0.3); sp.rotation.z = a; spinG.add(sp); }
    const rotor = makeRotor(1.34); rotor.rotation.y = Math.PI; rotor.position.z = 1.15; spinG.add(rotor);
    const ring = new THREE.Group(); ring.position.z = 1.55; spinG.add(ring);
    ring.add(ringZ(0.5, 0.66, -0.08, 0.08, steel(0xd8dce4)));
    for (let i = 0; i < 44; i++) { const a = (i / 44) * TAU, tth = box(0.1, 0.05, 0.16, steel(0xd8dce4)); tth.position.set(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0); tth.rotation.z = a; ring.add(tth); }
    const cal = makeCaliper(1.34, rotor.T, 0xc8343a, 2.4); cal.rotation.y = Math.PI; cal.rotation.z = -0.7; cal.position.z = 1.15; Wg.add(cal);
    const sensor = box(0.22, 0.5, 0.22, M.matte(0x111317)); sensor.position.set(0, 1.02, 1.55); Wg.add(sensor);
    const sensLed = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), M.glow(0x5ce1a9)); sensLed.position.set(0, 1.32, 1.6); Wg.add(sensLed);
    // ---- ABS valve block and its pipes
    const blk = new THREE.Group(); blk.position.set(0.6, 6.0, 1.0); root.add(blk);
    blk.add(shade(box(2.0, 1.3, 1.0, steel(0x9aa1ad))));
    const ecu = box(1.8, 0.5, 0.9, M.matte(0x1b1d22)); ecu.position.y = 0.9; blk.add(ecu);
    const vIn = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 16), M.glow(0x5ce1a9)), vOut = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 16), M.glow(0x49c6ff));
    vIn.rotation.x = vOut.rotation.x = Math.PI / 2; vIn.position.set(-0.5, 0, 0.55); vOut.position.set(0.5, 0, 0.55); blk.add(vIn, vOut);
    const pipeM = M.plastic(0xe0b23a, { emissive: 0xe0b23a, emissiveIntensity: 0.2 });
    root.add(tube([[0.6 + 1.0, 6.0, 1.0], [2.6, 6.2, 1.0], [3.2, 7.4, 0.6], [3.2, 9.0, 0]], 0.09, M.plastic(0xe0b23a), false, 40));
    root.add(tube([[-0.4, 6.0, 1.0], [-1.6, 6.4, 1.3], [-3.2, 6.6, 1.6], [WX - 0.6, R + 1.25, 1.8]], 0.09, pipeM, false, 50));
    root.add(tube([[WX, R + 1.3, 1.6], [WX + 0.6, R + 2.6, 1.6], [-2.0, 6.9, 1.3], [0.2, 6.95, 1.0]], 0.035, M.matte(0x111317), false, 40));
    // ---- arrows at the contact patch
    const aGrip = arrow(hex(COL.grip), 1, 0.4, 0.1), aSide = arrow(hex(COL.w), 1, 0.4, 0.1), aCar = arrow(0xffffff, 1, 0.35, 0.06); root.add(aGrip, aSide, aCar);
    aGrip.rotation.z = Math.PI / 2; aSide.rotation.x = Math.PI / 2; aCar.rotation.z = -Math.PI / 2;
    const NS = 40, spray = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshBasicMaterial({ color: 0xcfe0f5, transparent: true, opacity: 0.7, toneMapped: false }), NS); spray.frustumCulled = false; root.add(spray);
    const o3 = new THREE.Object3D();
    const L = (t, p, cls, col) => { const l = stage.label(t, p, root, cls); if (col) l.element.style.setProperty('--c', col); return l; };
    const lb = {
      spd: L('', [WX, 2 * R + 1.1, 0], 'hot', COL.text), slip: L('', [WX + 2.2, 0.75, 2.4], 'hot', COL.grip), side: L('', [WX - 1.2, -0.75, 2.6], 'hot', COL.w),
      blk: L('', [0.6, 7.65, 1.0], 'hot', COL.force), sens: L('Toothed ring and speed sensor', [WX + 0.2, R - 1.35, 2]), mc: L('from the master cylinder', [3.2, 9.4, 0]),
    };
    // ---- simulation
    let S = null, sim = makeAbs({ kmh: 80 }), running = false, pending = false, key = '', angle = 0, roadU = 0, redraw = 0, tclock = 0;
    const tr = { t: [], v: [], w: [], p: [], x: [], y: [] };
    const clearTr = () => Object.values(tr).forEach((a) => { a.length = 0; });
    const fresh = (s) => { sim = makeAbs(opts(s)); running = false; clearTr(); };
    const bdA = board(root, 7.6, 5.4, 760, 540, (g, w, h) => {
      panelBg(g, w, h);
      const s = S; if (!s) return;
      const pre = absRun(opts(s)), tMax = Math.max(1, Math.ceil(pre.t * 2) / 2);
      title(g, 'Car speed and wheel speed', s.abs ? 'ABS on' : 'ABS off', 26);
      const A = axes(g, w, h, { xMax: tMax, yMax: Math.ceil(s.speed / 20) * 20, y0: h - 214, y1: 100, xTicks: [], yTicks: [0, s.speed / 2, s.speed].map(Math.round), yLabel: 'km/h', font: 20 });
      line(g, tr.t.map((t, i) => [t, tr.v[i]]), A.X, A.Y, '#ffffff', 4); line(g, tr.t.map((t, i) => [t, tr.w[i]]), A.X, A.Y, COL.grip, 4);
      text(g, 'car', A.x1 - 190, A.y1 + 22, '#fff', 'bold 20px sans-serif'); text(g, 'wheel rim', A.x1 - 130, A.y1 + 22, COL.grip, 'bold 20px sans-serif');
      const B = axes(g, w, h, { xMax: tMax, yMax: 120, y0: h - 54, y1: h - 150, xTicks: Array.from({ length: Math.floor(tMax) + 1 }, (_, i) => i), yTicks: [0, 60, 120], xFmt: (v) => v + ' s', yLabel: 'brake pressure, bar', font: 20 });
      line(g, tr.t.map((t, i) => [t, tr.p[i]]), B.X, B.Y, COL.P, 4);
    }, [5.3, 10.4, 0]);
    const bdB = board(root, 7.6, 5.4, 760, 540, (g, w, h) => {
      panelBg(g, w, h);
      const s = S; if (!s) return;
      const pk = muPeak(s.surf);
      title(g, `Tyre grip against slip: ${SURF[s.surf].name.toLowerCase()}`, '', 26);
      const A = axes(g, w, h, { x0: 80, x1: w - 30, xMax: 1, yMax: 1.3, y0: 300, y1: 84, xTicks: [0, 0.2, 0.4, 0.6, 0.8, 1], yTicks: [0, 0.5, 1], xFmt: (v) => Math.round(v * 100) + '%', font: 20 });
      line(g, Array.from({ length: 101 }, (_, i) => [i / 100, muSlip(i / 100, s.surf)]), A.X, A.Y, COL.grip, 5);
      text(g, `peak ${pk.mu.toFixed(2)} at ${Math.round(pk.s * 100)}% slip`, A.X(pk.s) + 14, Math.max(A.y1 + 20, A.Y(pk.mu) - 10), COL.grip, '20px sans-serif');
      text(g, `locked: ${muSlip(1, s.surf).toFixed(2)}`, A.x1 - 6, A.Y(muSlip(1, s.surf)) - 12, COL.bad, '20px sans-serif', 'right');
      text(g, 'rolling', A.x0 + 4, A.y0 + 48, COL.muted, '18px sans-serif'); text(g, 'locked', A.x1, A.y0 + 48, COL.muted, '18px sans-serif', 'right');
      dot(g, A.X(sim.slip), A.Y(muSlip(sim.slip, s.surf)), running && !sim.done ? '#fff' : 'rgba(255,255,255,.4)', 10);
      // the road from above: the lane, an obstacle, and the path so far
      const lock = absRun(opts(s, false)), dObs = lock.d * OBST, xm = Math.max(lock.d, absRun(opts(s, true)).d) * 1.06;
      const X = (x) => 40 + (x / xm) * (w - 80), Y = (y) => 484 - y * 15;
      g.fillStyle = ROADCOL[s.surf]; g.fillRect(40, Y(5.25), w - 80, Y(-1.75) - Y(5.25));
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.setLineDash([14, 12]); g.lineWidth = 2; g.beginPath(); g.moveTo(40, Y(1.75)); g.lineTo(w - 40, Y(1.75)); g.stroke(); g.setLineDash([]);
      g.fillStyle = COL.bad; g.fillRect(X(dObs), Y(1.2), 16, Y(-1.2) - Y(1.2));
      text(g, 'obstacle', X(dObs) + 8, Y(-1.75) + 22, COL.bad, '18px sans-serif', 'center');
      line(g, tr.x.map((x, i) => [x, tr.y[i]]), X, Y, '#ffffff', 5);
      if (tr.x.length) dot(g, X(tr.x[tr.x.length - 1]), Y(tr.y[tr.y.length - 1]), s.surf === 'snow' ? '#333' : '#fff', 8);
      text(g, 'from above', 44, Y(5.25) - 8, COL.muted, '18px sans-serif'); text(g, fmtM(xm), w - 44, Y(5.25) - 8, COL.muted, '18px sans-serif', 'right');
    }, [5.3, 4.2, 0]);
    const frame = framer(stage, (mode) => (mode === 'tall' ? fitView(stage, [-3.4, 11.0, 0], [0.06, 0.06, 1], 33) : mode === 'narrow' ? fitView(stage, [-0.6, 7.0, 0], [0.08, 0.1, 1], 31) : fitView(stage, [0.6, 7.7, 0], [0.08, 0.1, 1], 25)));
    const api = {
      brake() { pending = true; },
      reset() { pending = false; if (S) fresh(S); },
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt); S = s; tclock += dt;
        const mode = frame();
        fitNarrow(stage, [lb.sens, lb.mc, lb.side]);
        if (mode === 'tall') { bdA.put([-3.4, 19.3, 0], 1.4); bdB.put([-3.4, 11.5, 0], 1.4); } else if (mode === 'narrow') { bdA.put([4.6, 3.4, 0], 0.95); bdB.put([4.6, -2.2, 0], 0.95); } else { bdA.put([5.5, 10.6, 0], 1); bdB.put([5.5, 4.8, 0], 1); }
        const kk = `${s.speed}|${s.surf}|${s.abs}|${s.steer}`; if (kk !== key) { key = kk; fresh(s); }
        if (pending) { pending = false; fresh(s); running = true; }
        if (running && !sim.done) {
          sim.step(dt * (s.slow ? 0.25 : 1));
          tr.t.push(sim.t); tr.v.push(sim.v * KMH); tr.w.push(sim.w * WHEEL.r * KMH); tr.p.push(sim.P / BAR); tr.x.push(sim.x); tr.y.push(sim.y);
          if (tr.t.length > 1600) for (const k of Object.keys(tr)) tr[k] = tr[k].filter((_, i) => i % 2 === 0);
        }
        const rate = s.slow && running ? 0.25 : 1, locked = running && !sim.done && sim.w * WHEEL.r < 0.5 && sim.v > 1;
        angle -= sim.w * dt * rate * SLOW * 0.33; spinG.rotation.z = angle;
        roadU += (sim.v * dt * rate * SLOW * 10 * 0.33) / (26 / 6); roadTex.tex.offset.x = roadU;
        roadM.color.set(ROADCOL[s.surf]); roadM.roughness = s.surf === 'wet' ? 0.18 : 0.7; roadM.metalness = s.surf === 'wet' ? 0.5 : 0.05;
        // forces on the tyre from the road
        const N = WHEEL.m * G, lg = 4.2 * (sim.Fx / N), ls = 4.2 * (Math.abs(sim.Fy) / N);
        aGrip.position.set(WX - 0.2, 0.2, 1.4); aGrip.set(running ? lg : 0);
        aSide.position.set(WX, 0.2, 1.2); aSide.set(running ? ls : 0);
        aCar.position.set(WX + R + 0.6, 2 * R + 0.4, 0); aCar.set(clamp(sim.v / 12, 0, 3.2));
        const ph = PH[sim.phase];
        vIn.material.color.set(sim.phase === 'apply' ? '#5ce1a9' : '#2a3a34'); vOut.material.color.set(sim.phase === 'release' ? '#49c6ff' : '#22323c');
        pipeM.emissiveIntensity = 0.15 + 0.8 * clamp(sim.P / WHEEL.Pmax, 0, 1);
        sensLed.material.color.set(Math.sin(angle * 44) > 0 && sim.w > 0.5 ? '#5ce1a9' : '#1d3a2e');
        for (let i = 0; i < NS; i++) {
          const u = (tclock * 1.6 + i / NS) % 1, on = locked || (running && !sim.done && s.surf !== 'dry' && sim.v > 2);
          o3.position.set(WX - 0.4 - u * (locked ? 4.5 : 2.6), 0.15 + Math.sin(u * Math.PI) * (locked ? 1.3 : 0.6) * (0.5 + ((i * 7) % 5) / 5), -0.9 + ((i * 13) % 10) / 5.5);
          o3.scale.setScalar(on ? (1 - u) * (locked ? 1.6 : 0.8) : 0.0001); o3.updateMatrix(); spray.setMatrixAt(i, o3.matrix);
        }
        spray.instanceMatrix.needsUpdate = true; spray.material.color.set(s.surf === 'dry' ? '#8a8f98' : '#cfe0f5');
        lb.spd.element.innerHTML = `car <b>${fmt0(sim.v * KMH)}</b> km/h · wheel rim <b style="color:${COL.grip}">${fmt0(sim.w * WHEEL.r * KMH)}</b> km/h`;
        lb.slip.element.innerHTML = !running ? 'rolling freely' : sim.done ? 'stopped' : locked ? '<b>LOCKED</b>: sliding' : `slip <b>${Math.round(sim.slip * 100)}%</b> · grip ${sim.mu.toFixed(2)}`;
        lb.slip.element.style.setProperty('--c', locked ? COL.bad : COL.grip);
        lb.side.element.innerHTML = !s.steer ? 'not steering' : !running || sim.done ? 'steering ready' : `sideways force: <b>${fmt0(Math.abs(sim.Fy))} N</b>`;
        lb.blk.element.innerHTML = !s.abs ? 'ABS off: valves stay open' : running && !sim.done ? (sim.cut ? 'ABS rests below 7 km/h' : ph[0]) : 'ABS valve block';
        lb.blk.element.style.setProperty('--c', s.abs && running ? ph[1] : COL.muted);
        redraw += dt; if (redraw > 0.1) { redraw = 0; bdA.redraw(); bdB.redraw(); }
      },
      readout(s) {
        const on = absRun(opts(s, true)), off = absRun(opts(s, false)), cur = s.abs ? on : off, think = (s.speed / KMH) * T_THINK, hc = highwayCode(s.speed);
        const dObs = off.d * OBST, st = sim;
        const live = running ? (st.done ? `Stopped in ${fmtM(st.x)}` : `${fmt0(st.v * KMH)} km/h · ${fmtM(st.x)} so far`) : `${s.abs ? 'ABS' : 'No ABS'}: stops in ${fmtM(cur.d)}`;
        return rows(live, [
          ['Braking distance, ABS on', fmtM(on.d), COL.good],
          ['Braking distance, wheel locked', fmtM(off.d), COL.bad],
          ['Thinking distance first (0.68 s)', '+ ' + fmtM(think), COL.d],
          ['Sideways move while braking', s.steer ? (cur.y < 0.3 ? 'none: it cannot steer' : cur.y.toFixed(1) + ' m') : 'not steering', s.steer && cur.y < 0.3 ? COL.bad : COL.text],
          ['ABS cycles', s.abs ? `${on.cycles} (${on.hz.toFixed(0)} a second)` : 'off'],
          ['UK Highway Code, dry road', `${fmt0(hc.think)} m + ${fmt0(hc.brake)} m`],
        ], `A single-wheel model. The obstacle sits at ${fmtM(dObs)}.`, 4);
      },
    };
    return api;
  },
};
