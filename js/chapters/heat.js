// Chapter 4: where the motion goes. One front brake of the small car, followed through hard stops
// and a long downhill. 1 scene unit = 4 cm (rotor 256 mm across).
// Energy: ½mv² per stop; this brake takes its share of the fixed hydraulic split (about 39%), and
//   about 90% of that goes into the rotor (5.0 kg of cast iron, 500 J/kg·K), the rest into the pads.
//   One stop from 100 km/h at 1,200 kg: 463 kJ × 0.39 × 0.9 = 162 kJ, so +65 °C before any cooling.
// Cooling, fade, fluid and engine braking: the models and their sources are in brake.js
//   (coolW, padMu, FLUID, engineBrake, descentPower). Hard stops are at 0.7 g, in real time; the
//   "ten stops" run and the descent are time-lapses. On the slope the driver holds a steady speed,
//   so the brakes must turn into heat whatever gravity feeds in beyond drag, rolling and the engine.
// The glow drawn on the rotor is real incandescence: iron starts to show dull red near 500 °C.
import { THREE, M, box, rod, arrow, approach, clamp } from '../kit.js';
import {
  G, KMH, CAR, ROTOR, FLUID, FLUID_SHARE, FLUID_LAG, HYD, keJ, coolW, padMu, frontBrakeShare, descentPower, footFor, COL, hex, fmt0, fmtE, fmtF,
  board, panelBg, title, text, axes, line, hbar, trace, makeRotor, makeCaliper, iron, steel, shade, framer, fitView, fitNarrow, rows, TAU,
} from '../brake.js';

const T_AIR = 30, A_STOP = 0.7 * G, A_GO = 0.25 * G, SHARE = frontBrakeShare();
const boilOf = (s) => FLUID[s.fluid][s.old ? 'wet' : 'dry'];
const GEAR_NAME = { 0: 'neutral', 5: '5th gear', 3: '3rd gear', 2: '2nd gear' };
// Heat flowing into this rotor (W) for a braking power P at the whole car.
const toRotor = (P) => P * SHARE * ROTOR.toRotor;
// Steady rotor temperature on a descent (where heat in = heat out), by bisection.
function steadyT(Pin, v) { let lo = T_AIR, hi = 1400; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (coolW(m, T_AIR, v) < Pin) lo = m; else hi = m; } return (lo + hi) / 2; }
function glow(T, out) { const k = clamp((T - 430) / 400, 0, 1); out.setRGB(1, 0.16 + 0.5 * k * k, 0.02 + 0.1 * k * k); return k; }

export default {
  id: 'heat',
  short: 'Heat and fade',
  title: 'Motion into heat, then fade',
  subtitle: 'Every stop is paid for in heat. Brakes fail when they cannot get rid of it fast enough.',
  view: { pos: [3, 6, 22], target: [2, 4.5, 0] },
  learn: `<p>A brake is a machine for making heat. Stopping a 1,200 kg car from 100 km/h turns 463 kJ into heat in a few seconds, mostly in the two front <b>rotors</b>. Each one is about 5 kg of cast iron, and one hard stop warms it by about <b>65 °C</b>. Speed counts twice over: from 140 km/h the same stop makes almost twice the heat. See <a href="https://glassbox.how/energyclear/">EnergyClear</a> and <a href="https://glassbox.how/heatclear/">HeatClear</a>.</p>
    <p>One stop is easy. The trouble is heat arriving faster than air can carry it off. A <b>ventilated</b> rotor is two discs joined by vanes: it pumps air through itself like a fan. Even so, cooling takes minutes, and a stop takes seconds.</p>
    <p>Above roughly 300 °C the resin in the pads starts to break down and their friction falls. The same push on the pedal slows you less: <b>brake fade</b>. Hotter still, heat creeps through the pads into the caliper, and the <b>brake fluid</b> can boil. Liquid cannot be squashed, but vapour can, so the pedal goes soft and sinks.</p>
    <p>Brake fluid soaks up water from the air over the years, and wet fluid boils much sooner: DOT 4 must manage <b>230 °C</b> when fresh and only <b>155 °C</b> when wet. That is why makers ask for it to be changed on a schedule.</p>
    <p>On a long ghat road, gravity feeds in energy the whole way down. In a low gear the engine soaks up much of it, and the brakes stay cool. <a href="https://glassbox.how/gearboxclear/">GearboxClear</a> shows how a low gear multiplies that drag.</p>
    <p class="tip"><b>Try it:</b> run ten hard stops back to back from 120 km/h and watch the friction bar. Then take the hill in neutral, and again in 2nd gear.</p>`,
  terms: [
    { t: 'Rotor', d: 'The disc the pads rub on. It soaks up the heat of a stop, then sheds it to the air.' },
    { t: 'Specific heat', d: 'How much energy it takes to warm 1 kg of a material by 1 °C. Cast iron: about 500 J.' },
    { t: 'Brake fade', d: 'Brakes working less well when hot, because the pads\' friction falls.' },
    { t: 'Boiling point (dry and wet)', d: 'The temperature at which brake fluid boils when fresh, and after it has taken up water.' },
    { t: 'Vapour lock', d: 'Boiled fluid makes squashy vapour in the lines, so the pedal sinks without building pressure.' },
    { t: 'Engine braking', d: 'Letting the wheels turn the engine with the throttle shut, so the engine soaks up energy.' },
  ],
  defaults: { mode: 'stop', speed: 100, load: 1200, slope: 8, gear: 0, fluid: 'dot4', old: false },
  controls: [
    { key: 'mode', type: 'seg', label: 'Test', options: [{ v: 'stop', label: 'Hard stops' }, { v: 'hill', label: 'Long downhill' }] },
    { key: 'go', type: 'buttons', label: 'Go', items: [
      { label: 'Stop once', act: (s, inst) => inst.stops(1) }, { label: 'Ten stops in a row', act: (s, inst) => inst.stops(10) }, { label: 'Let it cool', act: (s, inst) => inst.cool() },
    ] },
    { key: 'speed', type: 'range', label: 'Speed', min: 20, max: 140, step: 5, fmt: (v, s) => v + ' km/h' + (s.mode === 'hill' ? ' held' : '') },
    { key: 'load', type: 'seg', label: 'Car and load', options: [{ v: 1200, label: '1,200 kg' }, { v: 1600, label: '1,600 kg, full' }] },
    { key: 'slope', type: 'range', label: 'Downhill slope', min: 3, max: 12, step: 0.5, fmt: (v) => v + '% (drops ' + Math.round(v * 10) + ' m each km)' },
    { key: 'gear', type: 'seg', label: 'Downhill gear', options: [{ v: 0, label: 'Neutral' }, { v: 5, label: '5th' }, { v: 3, label: '3rd' }, { v: 2, label: '2nd' }] },
    { key: 'fluid', type: 'seg', label: 'Brake fluid', options: [{ v: 'dot3', label: 'DOT 3' }, { v: 'dot4', label: 'DOT 4' }, { v: 'dot51', label: 'DOT 5.1' }], fmt: (v, s) => 'boils at ' + boilOf(s) + ' °C' },
    { key: 'old', type: 'toggle', label: 'Old, damp fluid', hint: 'After a few years fluid holds about 3.7% water: the "wet" boiling point.' },
  ],
  quiz: [
    { q: 'One hard stop from 100 km/h warms a front rotor by about 65 °C. From 140 km/h it is about…', options: ['The same', '90 °C: a bit more', '130 °C: nearly double', '20 °C: less'], answer: 2, why: 'Kinetic energy goes with speed squared: (140 ÷ 100)² = 1.96, so nearly twice the heat.' },
    { q: 'Why does the pedal go soft if the brake fluid boils?', options: ['Hot fluid leaks out', 'Vapour can be squashed, so pushing the pedal no longer builds pressure', 'The pads melt', 'The servo stops working'], answer: 1, why: 'Hydraulics rely on liquid that cannot be compressed. Bubbles of vapour squash instead of passing the push on.' },
    { q: 'Why does a low gear keep brakes cool on a long descent?', options: ['It makes the wheels smaller', 'The engine soaks up much of the energy, so the brakes have less to turn into heat', 'It cools the fluid', 'It locks the wheels'], answer: 1, why: 'With the throttle shut, the wheels drive the engine. A low gear spins it faster, so it absorbs more power.' },
  ],
  reel: [
    { ms: 6200, caption: 'One hard stop from 100 km/h heats each front rotor by about 65 °C. Ten in a row and the pads fade.', set: { mode: 'stop', speed: 120, load: 1200, fluid: 'dot4', old: false }, act: (s, inst) => { inst.cool(); inst.stops(10, 30); }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const W = new THREE.Group(); W.position.set(-2.4, 3.9, 0); root.add(W);
    const RR = 3.2, rotor = makeRotor(RR); W.add(rotor);
    const cal = makeCaliper(RR, rotor.T, 0xc8343a, 2.5); W.add(cal);
    const knuckle = shade(rod(0, 1, 0.5, 0.5, iron(0x4d5159), 20)); knuckle.rotation.y = Math.PI / 2; knuckle.position.set(0, 0, -1.4); knuckle.scale.x = 2.0; W.add(knuckle);
    const strut = box(0.5, 4.2, 0.5, iron(0x4d5159)); strut.position.set(-0.2, 2.0, -2.2); strut.rotation.z = 0.12; W.add(shade(strut));
    const halo = new THREE.Mesh(new THREE.RingGeometry(RR * 0.56, RR * 1.02, 64), new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); halo.position.z = rotor.T / 2 + 0.02; W.add(halo);
    // air flung out through the vanes, then swept back by the wind of the car's motion (the car drives towards +x)
    const NA = 90, air = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.8, toneMapped: false }), NA); air.frustumCulled = false; W.add(air);
    const NB = 14, bub = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), M.glow(0xffffff), NB); bub.frustumCulled = false; W.add(bub);
    const o3 = new THREE.Object3D(), col = new THREE.Color();
    const lb = {
      T: stage.label('', [0, -RR - 0.7, 1], W, 'hot'), cal: stage.label('', [-RR + 0.6, RR + 0.9, 0.5], W, 'hot'),
      air: stage.label('Air flung out through the vanes', [RR + 0.6, -RR + 0.2, 0], W), car: stage.label('', [8.9, 5.0, 0], W),
    };
    lb.T.element.style.setProperty('--c', COL.heat); lb.cal.element.style.setProperty('--c', COL.c2);
    // ---- simulation state
    const sim = { T: T_AIR, Tf: T_AIR, v: 100 / KMH, t: 0, left: 0, phase: 'cruise', lapse: 1, lastRise: 0, T0: T_AIR, eStop: 0, boiled: false, km: 0, Pin: 0, need: 1, mode: 'stop' };
    const tr = trace(1500);
    let S = null, redraw = 0, spin = 0, traceT = 0, clock = 0;
    const span = () => (sim.mode === 'hill' ? 1200 : sim.lapse > 1 ? 400 : 90);
    const bd = board(root, 7.8, 6.3, 780, 630, (g, w, h) => {
      panelBg(g, w, h);
      const s = S || { fluid: 'dot4', old: false }, boil = boilOf(s), sp = span();
      title(g, 'Temperature of the rotor and the fluid', sim.mode === 'hill' ? 'time-lapse: 1 second shows 30 seconds' : sim.lapse > 1 ? 'time-lapse' : 'real time', 26);
      const tEnd = Math.max(sp, sim.t), A = axes(g, w, h, { xMin: tEnd - sp, xMax: tEnd, yMax: 700, y0: h - 190, y1: 104, xTicks: [], yTicks: [0, 100, 200, 300, 400, 500, 600, 700], yLabel: '°C', font: 20 });
      text(g, sp >= 600 ? `last ${Math.round(sp / 60)} minutes` : `last ${sp} seconds`, A.x1, A.y0 + 28, COL.muted, '20px sans-serif', 'right');
      g.setLineDash([10, 8]); g.lineWidth = 2;
      g.strokeStyle = COL.heat; g.beginPath(); g.moveTo(A.x0, A.Y(300)); g.lineTo(A.x1, A.Y(300)); g.stroke();
      g.strokeStyle = COL.c2; g.beginPath(); g.moveTo(A.x0, A.Y(boil)); g.lineTo(A.x1, A.Y(boil)); g.stroke(); g.setLineDash([]);
      text(g, 'pads begin to fade', A.x0 + 10, A.Y(300) - 8, COL.heat, '19px sans-serif'); text(g, `fluid boils at ${boil} °C`, A.x1 - 8, A.Y(boil) + 22, COL.c2, '19px sans-serif', 'right');
      const pts = (k) => tr.T.map((t, i) => [t, tr.V[i][k]]).filter(([t]) => t >= tEnd - sp);
      line(g, pts(0), A.X, A.Y, COL.heat, 5); line(g, pts(1), A.X, A.Y, COL.c2, 4);
      text(g, 'rotor', A.x0 + 14, A.y1 + 24, COL.heat, 'bold 21px sans-serif'); text(g, 'fluid in the caliper', A.x0 + 90, A.y1 + 24, COL.c2, 'bold 21px sans-serif');
      const mu = padMu(sim.T);
      hbar(g, 250, w - 30, h - 132, 36, mu / 0.42, mu < 0.3 ? COL.bad : COL.out, 'Pad friction', 'μ = ' + mu.toFixed(2), 21);
      hbar(g, 250, w - 30, h - 86, 36, clamp((sim.Tf - T_AIR) / (boil - T_AIR), 0, 1), sim.Tf >= boil ? COL.bad : COL.c2, 'Fluid, towards boiling', Math.round(sim.Tf) + ' of ' + boil + ' °C', 21);
      text(g, sim.boiled ? 'The fluid has boiled: vapour in the caliper, the pedal sinks.'   : mu < 0.36 ? `Fade: the pedal needs ${(HYD.mu / mu).toFixed(1)} times the push for the same braking.` : 'Pads and fluid are within their working range.', 26, h - 18, sim.boiled || mu < 0.36 ? COL.bad : COL.muted, '20px sans-serif');
    }, [6.3, 5.6, 0]);
    const frame = framer(stage, (mode) => (mode === 'tall' ? fitView(stage, [-2.4, 9.6, 0], [0.1, 0.08, 1], 31) : mode === 'narrow' ? fitView(stage, [1.9, 6.0, 0], [0.1, 0.1, 1], 39) : fitView(stage, [2.1, 7.4, 0], [0.1, 0.1, 1], 24.5)));
    const api = {
      stops(n, lapse) { sim.mode = 'stop'; sim.left = n; sim.lapse = lapse || (n > 1 ? 8 : 1); if (sim.phase === 'cruise') sim.phase = 'ready'; },
      cool() { sim.T = sim.Tf = T_AIR; sim.t = 0; sim.left = 0; sim.phase = 'cruise'; sim.boiled = false; sim.km = 0; sim.lastRise = 0; tr.clear(); traceT = 0; },
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt); S = s; clock += dt;
        const mode = frame();
        fitNarrow(stage, [lb.air, lb.car]);
        if (mode === 'tall') bd.put([-2.4, 14.6, 0], 1.45); else if (mode === 'narrow') bd.put([5.4, 4.2, 0], 0.95); else bd.put([6.5, 5.2, 0], 1);
        if (s.mode !== sim.mode) { sim.mode = s.mode; sim.left = 0; sim.phase = 'cruise'; sim.lapse = 1; }
        const v0 = s.speed / KMH, m = s.load, boil = boilOf(s);
        // ---- step the heat model in small pieces of simulated time
        const lapse = sim.mode === 'hill' ? 30 : sim.left > 0 || sim.phase !== 'cruise' ? sim.lapse : 1;
        let left = dt * lapse; sim.Pin = 0;
        while (left > 1e-6) {
          const h = Math.min(left, 0.05); left -= h;
          let P = 0;
          if (sim.mode === 'hill') {
            sim.v = v0; const d = descentPower(m, s.slope, v0, s.gear); P = sim.boiled ? 0 : d.brakes; sim.km += (v0 * h) / 1000;
          } else if (sim.phase === 'ready') { sim.v = approach(sim.v, v0, 3, h); if (Math.abs(sim.v - v0) < 0.3) { sim.v = v0; sim.phase = 'brake'; sim.T0 = sim.T; sim.eStop = keJ(m, s.speed); } }
          else if (sim.phase === 'brake') { P = m * A_STOP * sim.v; sim.v -= A_STOP * h; if (sim.v <= 0) { sim.v = 0; sim.phase = 'go'; sim.left--; sim.lastRise = sim.T - sim.T0; } }
          else if (sim.phase === 'go') { sim.v += A_GO * h; if (sim.v >= v0) { sim.v = v0; sim.phase = sim.left > 0 ? 'brake' : 'cruise'; if (sim.left > 0) { sim.T0 = sim.T; } else sim.lapse = 1; } }
          else sim.v = approach(sim.v, v0, 2, h);
          const Q = toRotor(P); sim.Pin = Q;
          sim.T += ((Q - coolW(sim.T, T_AIR, sim.v)) / (ROTOR.m * ROTOR.c)) * h;
          sim.Tf += ((T_AIR + FLUID_SHARE * (sim.T - T_AIR) - sim.Tf) / FLUID_LAG) * h;
          if (sim.Tf >= boil) sim.boiled = true;
          sim.t += h;
        }
        if (sim.Tf < boil - 15) sim.boiled = false;
        traceT += dt * lapse; if (traceT > span() / 400) { traceT = 0; tr.push(sim.t, sim.T, sim.Tf); }
        // ---- picture
        spin -= (sim.v / CAR.rTyre) * dt * 0.2; rotor.rotation.z = spin;
        const gk = glow(sim.T, col); rotor.hot.emissive.copy(col); rotor.hot.emissiveIntensity = gk * 1.6; halo.material.opacity = gk * 0.35;
        const braking = sim.Pin > 500;
        for (let i = 0; i < NA; i++) {
          const uu = (((i * 0.618034 - spin * 0.05) % 1) + 1) % 1;
          const a0 = i * 2.399, r = RR * (1.0 + 0.55 * uu), a = a0 + spin * 0.6 - uu * 0.9;
          o3.position.set(Math.cos(a) * r - uu * uu * 2.2, Math.sin(a) * r, 0.15 * Math.sin(i)); o3.scale.setScalar(sim.v > 1 ? (1 - uu) * (0.5 + sim.v / 30) : 0.0001); o3.updateMatrix(); air.setMatrixAt(i, o3.matrix);
        }
        air.instanceMatrix.needsUpdate = true; air.material.color.setHSL(0.58 - 0.5 * clamp((sim.T - 60) / 500, 0, 1), 0.9, 0.78);
        for (let i = 0; i < NB; i++) {
          const u = (clock * 1.1 + i / NB) % 1, a = 2.5 + 0.25 * Math.sin(i * 3.1);
          o3.position.set(Math.cos(a) * RR * 0.86 + 0.3 * Math.sin(i * 1.7), Math.sin(a) * RR * 0.86 + u * 1.6, -rotor.T / 2 - 0.5 + 0.2 * Math.cos(i)); o3.scale.setScalar(sim.boiled ? 0.4 + u : 0.0001); o3.updateMatrix(); bub.setMatrixAt(i, o3.matrix);
        }
        bub.instanceMatrix.needsUpdate = true;
        lb.T.element.innerHTML = `Rotor: <b>${fmt0(sim.T)} °C</b>` + (braking ? ` · heat in ${(sim.Pin / 1000).toFixed(0)} kW` : '');
        lb.cal.element.innerHTML = sim.boiled ? 'Fluid: <b>boiling</b>' : `Fluid: <b>${fmt0(sim.Tf)} °C</b>`;
        lb.car.element.textContent = sim.mode === 'hill' ? `${s.speed} km/h down a ${s.slope}% slope, ${GEAR_NAME[s.gear]} · ${sim.km.toFixed(1)} km so far` : sim.phase === 'brake' ? `Braking hard: ${fmt0(sim.v * KMH)} km/h` : sim.phase === 'go' || sim.phase === 'ready' ? `Speeding up again: ${fmt0(sim.v * KMH)} km/h` : `Cruising at ${fmt0(sim.v * KMH)} km/h`;
        redraw += dt; if (redraw > 0.12) { redraw = 0; bd.redraw(); }
      },
      readout(s) {
        const mu = padMu(sim.T), boil = boilOf(s);
        if (s.mode === 'hill') {
          const d = descentPower(s.load, s.slope, s.speed / KMH, s.gear), Ts = steadyT(toRotor(d.brakes), s.speed / KMH);
          return rows(`Rotor ${fmt0(sim.T)} °C, heading for ${fmt0(Ts)} °C`, [
            ['Gravity feeds in', (d.grav / 1000).toFixed(1) + ' kW', COL.w],
            ['Air and tyres take', ((d.roll + d.aero) / 1000).toFixed(1) + ' kW'],
            [s.gear ? `Engine takes (${GEAR_NAME[s.gear]}, ${fmt0(d.rpm)} rpm)` : 'Engine takes (neutral)', (d.eng / 1000).toFixed(1) + ' kW', COL.out],
            ['Brakes must turn into heat', (d.brakes / 1000).toFixed(1) + ' kW', COL.heat],
            ['Pad friction', 'μ = ' + mu.toFixed(2), mu < 0.3 ? COL.bad : COL.text],
            ['Fluid in the caliper', sim.boiled ? 'boiling' : `${fmt0(sim.Tf)} °C (boils at ${boil})`, sim.boiled ? COL.bad : COL.c2],
          ], d.rpm > 6000 ? 'That gear would over-rev the engine at this speed.' : d.brakes <= 0 ? 'The engine, air and tyres hold the car back on their own: the brakes rest.' : 'Steady speed. One front brake shown; it takes 39% of the braking.', 4);
        }
        const e = keJ(s.load, s.speed), er = e * SHARE * ROTOR.toRotor;
        return rows(`Rotor ${fmt0(sim.T)} °C`, [
          [`A stop from ${s.speed} km/h sheds`, fmtE(e), COL.w],
          ['Into this one rotor', fmtE(er) + ' (35%)', COL.heat],
          ['That warms 5 kg of iron by', '+' + fmt0(er / (ROTOR.m * ROTOR.c)) + ' °C', COL.heat],
          ['Pad friction', 'μ = ' + mu.toFixed(2), mu < 0.3 ? COL.bad : COL.text],
          ['Fluid in the caliper', sim.boiled ? 'boiling' : `${fmt0(sim.Tf)} °C (boils at ${boil})`, sim.boiled ? COL.bad : COL.c2],
          ['Stops still to run', String(Math.max(0, sim.left))],
        ], 'Stops at 0.7 g. Rise = energy ÷ (mass × specific heat).', 4);
      },
    };
    return api;
  },
};
