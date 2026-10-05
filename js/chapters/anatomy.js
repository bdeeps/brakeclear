// Chapter 1: the whole brake system of a small car, laid bare. 1 scene unit = 25 cm (the rotors,
// drums, servo and pipes are drawn about 40% oversize so they read). The car faces +x; it is right-hand drive, as in
// India, so the pedal, servo and master cylinder sit on the +z side.
// Numbers: kinetic energy ½mv² (1,200 kg at 100 km/h: 463 kJ); the foot-to-wheel chain from
// brake.js (pedal 4:1, servo ×3, 22.2 mm master cylinder, 54 mm front caliper pistons, 19 mm rear
// wheel cylinders); weight transfer m·a·h ÷ L with h = 0.55 m and L = 2.45 m; tyre grip on a dry
// road 0.8, which caps the stop at 0.8 g. Circuits are split diagonally (front-left with
// rear-right, front-right with rear-left), the usual layout on front-wheel-drive cars, so one leak
// leaves one front and one rear brake: half the braking force.
import { THREE, M, box, tube, beam, arrow, exploder, approach, clamp } from '../kit.js';
import {
  G, CAR, ROAD, keJ, brakeDist, frontShare, chain, COL, hex, fmt0, fmtF, fmtE, fmtM, fmtG, board, panelBg, title, text, hbar,
  makeRotor, makeCaliper, makeDrumShell, makeTyre, iron, steel, slab, shade, framer, fitView, fitNarrow, rows, TAU,
} from '../brake.js';

const F_MAX = 250;
const WH = { fl: [4.9, -3], fr: [4.9, 3], rl: [-4.9, -3], rr: [-4.9, 3] };
const CIRC = { fl: 'c1', rr: 'c1', fr: 'c2', rl: 'c2' };
function state(s) {
  const c = chain((s.press / 100) * F_MAX, { fail: s.fail });
  const cap = ROAD.dry.mu * G, a = Math.min(c.a, cap);
  return { c, a, limited: c.a > cap + 1e-6, ke: keJ(CAR.m, s.speed), d: s.press > 0 ? brakeDist(s.speed, a) : Infinity, fs: frontShare(a) };
}

export default {
  id: 'anatomy',
  short: 'The whole system',
  title: 'A car\'s brakes, laid bare',
  subtitle: 'One pedal, two separate circuits of fluid, four brakes that turn speed into heat.',
  view: { pos: [9, 13, 21], target: [0.5, 2, 0] },
  learn: `<p>A moving car carries <b>kinetic energy</b>: ½ × mass × speed². A 1,200 kg car at 100 km/h holds about <b>463 kJ</b>, enough to lift it 39 m into the air. To stop, all of that has to go somewhere. Brakes rub it away as <b>heat</b>.</p>
    <p>Your foot does not touch the wheels. The <b>pedal</b> is a lever. Behind it a <b>vacuum servo</b> adds to your push, and a <b>master cylinder</b> turns the push into pressure in <b>brake fluid</b>. Thin steel pipes carry that pressure to a brake at each wheel: a <b>disc brake</b> at the front, and on many small cars a <b>drum brake</b> at the back. A valve block for <b>ABS</b> sits in between.</p>
    <p>There are <b>two separate circuits</b>, each feeding one front wheel and the rear wheel diagonally opposite. If a pipe bursts, the other circuit still gives you half your braking, with a longer pedal. The <b>handbrake</b> is separate again: a cable that works the rear brakes with no fluid at all.</p>
    <p>Braking throws the car's weight forward. The nose dips, the front tyres are pressed harder into the road, and the rear ones go light. So the <b>front brakes are bigger</b> and do about three quarters of the work.</p>
    <p>The whole car is in <a href="https://glassbox.how/carclear/">CarClear</a>, its gears in <a href="https://glassbox.how/gearboxclear/">GearboxClear</a> and its clutch in <a href="https://glassbox.how/clutchclear/">ClutchClear</a>.</p>
    <p class="tip"><b>Try it:</b> press the pedal and watch the weight move to the front axle. Then burst circuit 1 and see which two brakes are left.</p>`,
  terms: [
    { t: 'Kinetic energy', d: 'The energy of motion: ½ × mass × speed². Double the speed and it is four times as much.' },
    { t: 'Master cylinder', d: 'The pump your foot works. It turns the push on the pedal into pressure in the brake fluid.' },
    { t: 'Dual circuit', d: 'Two separate sets of pipes from one master cylinder, so one leak cannot take away all the brakes.' },
    { t: 'Diagonal split', d: 'Each circuit feeds one front brake and the opposite rear brake.' },
    { t: 'Weight transfer', d: 'Under braking, load moves from the rear tyres to the front ones. The car\'s weight does not change, only where it presses.' },
    { t: 'Deceleration', d: 'How quickly speed falls, often given in g. 1 g is 9.81 m/s².' },
  ],
  defaults: { explode: 0, press: 40, speed: 80, fail: 'none', hand: false },
  controls: [
    { key: 'explode', type: 'range', label: 'Take it apart', min: 0, max: 1, step: 0.01, ends: ['together', 'apart'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'press', type: 'range', label: 'Foot on the pedal', min: 0, max: 100, step: 1, ends: ['off', 'hard'], fmt: (v) => fmt0((v / 100) * F_MAX) + ' N' },
    { key: 'speed', type: 'range', label: 'Speed', min: 20, max: 140, step: 5, fmt: (v) => v + ' km/h' },
    { key: 'fail', type: 'seg', label: 'Burst a pipe', options: [{ v: 'none', label: 'Both fine' }, { v: 'c1', label: 'Circuit 1 leaks' }, { v: 'c2', label: 'Circuit 2 leaks' }] },
    { key: 'hand', type: 'toggle', label: 'Handbrake on', hint: 'A cable pulls the rear shoes out. No fluid involved.' },
  ],
  quiz: [
    { q: 'Where does a car\'s energy of motion go when it brakes to a stop?', options: ['Into the brake fluid as pressure', 'Into heat in the discs, drums and pads', 'Back into the fuel tank', 'It simply disappears'], answer: 1, why: 'Friction between pad and disc turns kinetic energy into heat. The fluid only carries the push.' },
    { q: 'A pipe bursts in one of the two brake circuits. With a diagonal split, what is left?', options: ['Nothing', 'Only the handbrake', 'One front and one rear brake: half the force', 'Both front brakes'], answer: 2, why: 'Each circuit feeds one front wheel and the opposite rear wheel, so one leak leaves the other pair working.' },
    { q: 'Why are front brakes bigger than rear ones?', options: ['The engine is at the front', 'Braking shifts weight onto the front tyres, so they can grip harder', 'Rear brakes are only for parking', 'Front wheels spin faster'], answer: 1, why: 'Weight transfer loads the front tyres. More load means more grip, so the front brakes do about three quarters of the work.' },
  ],
  reel: [
    { ms: 5600, caption: 'A 1,200 kg car at 100 km/h carries 463 kJ. Brakes turn every joule of it into heat.', set: { speed: 100, fail: 'none', explode: 0, hand: false }, anim: { press: [0, 70] }, spin: 0.25 },
    { ms: 5200, caption: 'Two separate circuits, split diagonally: burst one pipe and half the braking is still there.', set: { speed: 80, press: 60, explode: 0.25, fail: 'c1' }, spin: 0.25 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const car = new THREE.Group(); root.add(car);                       // everything that dives with the body
    // ---- ghost body: a generic hatchback outline
    const prof = [[-7.3, 1.3], [-7.5, 3.2], [-6.9, 5.3], [-5.6, 5.95], [-1.2, 6.0], [1.9, 5.7], [4.0, 3.9], [7.5, 3.4], [8.0, 2.5], [8.0, 1.3]];
    const body = new THREE.Group(); car.add(body);
    const shell = slab(prof, 6.2, M.ghost(0x9fc4ff, 0.05), 3.1); shell.castShadow = false; body.add(shell);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry, 20), new THREE.LineBasicMaterial({ color: 0x8fb4e8, transparent: true, opacity: 0.38 }));
    edges.position.copy(shell.position); body.add(edges);
    const floorPan = box(11.5, 0.12, 5.2, M.ghost(0x7f8aa0, 0.12)); floorPan.position.set(0.3, 1.25, 0); car.add(floorPan);
    // ---- pedal, servo, master cylinder
    const ctl = new THREE.Group(); car.add(ctl);
    const pedal = new THREE.Group(); pedal.position.set(3.05, 3.5, 1.5); ctl.add(pedal);
    pedal.add(shade(beam([0, 0, 0], [-0.35, -1.5, 0], 0.07, steel(0x9aa1ad))));
    const padP = box(0.5, 0.1, 0.42, M.matte(0x1b1d22)); padP.position.set(-0.4, -1.55, 0); padP.rotation.z = 0.5; pedal.add(padP);
    const servo = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.7, 32), M.matte(0x23262d)); servo.rotation.z = Math.PI / 2; servo.position.set(3.95, 3.2, 1.5); ctl.add(servo);
    const servoRim = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.06, 8, 32), steel(0x8a909c)); servoRim.rotation.y = Math.PI / 2; servoRim.position.copy(servo.position); ctl.add(servoRim);
    const mc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.1, 20), steel(0xbfc5cf)); mc.rotation.z = Math.PI / 2; mc.position.set(4.75, 3.2, 1.5); ctl.add(mc);
    const res = box(0.62, 0.42, 0.42, M.clear(0xfff2c4, 0.5)); res.position.set(4.75, 3.62, 1.5); ctl.add(res);
    const resF = box(0.58, 0.24, 0.38, M.plastic(0xe0b23a, { transparent: true, opacity: 0.75 })); resF.position.set(4.75, 3.55, 1.5); ctl.add(resF);
    ctl.add(shade(beam([3.1, 3.2, 1.5], [3.7, 3.2, 1.5], 0.04, steel())));
    const absB = box(0.7, 0.6, 0.7, steel(0x9aa1ad)); absB.position.set(5.9, 2.9, 0.3); ctl.add(absB);
    const absTop = box(0.6, 0.3, 0.6, M.matte(0x22252b)); absTop.position.set(5.9, 3.35, 0.3); ctl.add(absTop);
    // ---- pipes: circuit 1 (front-left + rear-right), circuit 2 (front-right + rear-left)
    const pm = { c1: M.plastic(hex(COL.c1), { emissive: hex(COL.c1), emissiveIntensity: 0.15, roughness: 0.4 }), c2: M.plastic(hex(COL.c2), { emissive: hex(COL.c2), emissiveIntensity: 0.3, roughness: 0.4 }) };
    const P = 0.075, Y = 1.38;
    const pipe = (pts, c) => { const t = tube(pts, P, pm[c], false, 80); car.add(t); return t; };
    pipe([[5.25, 3.1, 1.42], [5.5, 3.0, 1.0], [5.75, 2.95, 0.45]], 'c1'); pipe([[5.25, 3.25, 1.58], [5.55, 3.2, 1.1], [5.9, 3.1, 0.6]], 'c2');
    pipe([[5.9, 2.7, 0.05], [5.9, 1.6, -0.6], [5.5, Y, -1.6], [4.95, 1.5, -2.2], [4.75, 2.15, -2.5]], 'c1');                                  // to front-left
    pipe([[5.75, 2.65, 0.3], [5.4, 1.6, 0.5], [3, Y, 0.8], [-3.6, Y, 0.8], [-4.5, Y, 1.4], [-4.9, 1.45, 2.2], [-4.9, 1.75, 2.52]], 'c1');   // to rear-right
    pipe([[6.15, 2.7, 0.5], [6.0, 1.6, 1.3], [5.5, Y, 2.0], [4.95, 1.5, 2.3], [4.75, 2.15, 2.5]], 'c2');                                     // to front-right
    pipe([[5.95, 2.65, 0.0], [5.2, 1.6, -0.4], [3, Y, -0.8], [-3.6, Y, -0.8], [-4.5, Y, -1.4], [-4.9, 1.45, -2.2], [-4.9, 1.75, -2.52]], 'c2'); // to rear-left
    // ---- handbrake: lever between the seats, one cable to each rear drum
    const hb = new THREE.Group(); hb.position.set(-0.6, 1.7, 0); car.add(hb);
    hb.add(shade(beam([0, 0, 0], [1.3, 0.25, 0], 0.07, M.matte(0x2a2e37))));
    const grip = shade(beam([0.9, 0.17, 0], [1.4, 0.27, 0], 0.1, M.matte(0x111317))); hb.add(grip);
    const cabM = M.matte(0x9aa1ad);
    car.add(tube([[-0.6, 1.6, 0], [-2.4, 1.3, 0], [-4.0, 1.3, 1.2], [-4.9, 1.2, 2.5]], 0.03, cabM, false, 60), tube([[-0.6, 1.6, 0], [-2.4, 1.3, 0], [-4.0, 1.3, -1.2], [-4.9, 1.2, -2.5]], 0.03, cabM, false, 60));
    // ---- wheels (they stay on the road while the body dives)
    const R_T = 1.2, R_D = 0.72, R_DR = 0.6;
    const wheels = {}, parts = [{ obj: body, off: [0, 4.5, 0] }, { obj: ctl, off: [0, 1.6, 0] }];
    for (const [k, [x, z]] of Object.entries(WH)) {
      const sgn = Math.sign(z), g = new THREE.Group(); g.position.set(x, R_T, z); root.add(g);
      const spin = new THREE.Group(); g.add(spin);
      const tyre = makeTyre(R_T, 0.76, { ghost: true }); tyre.position.z = sgn * 0.25; g.add(tyre);
      let glow;
      if (x > 0) {
        const rot = makeRotor(R_D); rot.rotation.y = sgn > 0 ? 0 : Math.PI; spin.add(rot); glow = rot.hot;
        const cal = makeCaliper(R_D, rot.T, 0xd8343a, 2.3); cal.rotation.y = sgn > 0 ? 0 : Math.PI; g.add(cal);
        parts.push({ obj: cal, off: [-1.2, 1.5, 0] }, { obj: tyre, off: [0, 0, sgn * 2.6] });
      } else {
        const dr = makeDrumShell(R_DR); dr.rotation.y = sgn > 0 ? 0 : Math.PI; spin.add(dr); glow = dr.children[0].material;
        const bp = new THREE.Mesh(new THREE.CylinderGeometry(R_DR * 1.02, R_DR * 1.02, 0.05, 32), M.matte(0x30343c)); bp.rotation.x = Math.PI / 2; bp.position.z = -sgn * 0.27; g.add(bp);
        parts.push({ obj: spin, off: [0, 0, sgn * 1.3] }, { obj: tyre, off: [0, 0, sgn * 2.8] });
      }
      const fa = arrow(hex(COL.c1), 1, 0.3, 0.07); root.add(fa);
      wheels[k] = { g, spin, glow, fa, x, z, sgn };
    }
    const explode = exploder(parts);
    // ---- load arrows on the two axles, and the car's weight
    const loadF = arrow(hex(COL.w), 1, 0.35, 0.09), loadR = arrow(hex(COL.w), 1, 0.35, 0.09); root.add(loadF, loadR);
    loadF.rotation.z = loadR.rotation.z = Math.PI;
    const lb = {
      pedal: stage.label('Brake pedal', [2.6, 1.7, 1.5], car), servo: stage.label('Vacuum servo', [3.9, 4.2, 1.5], car), mc: stage.label('Master cylinder', [5.1, 4.2, 2.2], car),
      abs: stage.label('ABS valve block', [6.3, 3.9, -0.4], car), disc: stage.label('Front disc and caliper', [4.9, 3.0, -3.4], root), drum: stage.label('Rear drum', [-4.9, 2.6, 3.4], root),
      hand: stage.label('Handbrake', [0.4, 2.6, 0], car), c1: stage.label('Circuit 1', [0, 1.0, 1.2], car, 'hot'), c2: stage.label('Circuit 2', [0, 1.0, -1.2], car, 'hot'),
      lf: stage.label('', [4.9, 6.2, 0], root, 'hot'), lr: stage.label('', [-4.9, 6.2, 0], root, 'hot'),
    };
    lb.c1.element.style.setProperty('--c', COL.c1); lb.c2.element.style.setProperty('--c', COL.c2);
    lb.lf.element.style.setProperty('--c', COL.w); lb.lr.element.style.setProperty('--c', COL.w);
    let S = { press: 40, speed: 80, fail: 'none', hand: false };
    const bd = board(root, 7.2, 5.0, 720, 500, (g, w, h) => {
      panelBg(g, w, h);
      const r = state(S), max = 3200;
      title(g, 'Braking force at each tyre', r.limited ? 'tyres at their grip limit' : `${fmtG(r.a)} of deceleration`, 28);
      const rowsB = [['Front left', 'fl'], ['Front right', 'fr'], ['Rear left', 'rl'], ['Rear right', 'rr']];
      rowsB.forEach(([name, k], i) => hbar(g, 190, w - 30, 100 + i * 58, 40, r.c.w[k].road / max, COL[CIRC[k]], name, r.c.w[k].P > 0 || S.press === 0 ? fmtF(r.c.w[k].road) : 'no pressure', 22));
      text(g, 'Weight on the front axle', 26, 368, COL.muted, '22px sans-serif');
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(26, 384, w - 56, 34);
      g.fillStyle = COL.w; g.fillRect(26, 384, (w - 56) * r.fs, 34);
      text(g, `front ${Math.round(r.fs * 100)}%`, 38, 409, '#0b0d12', 'bold 22px sans-serif');
      text(g, `rear ${Math.round((1 - r.fs) * 100)}%`, w - 40, 409, COL.text, 'bold 22px sans-serif', 'right');
      text(g, `Front brakes do ${Math.round(100 * r.c.frontF / Math.max(1, r.c.total))}% of the braking`, 26, 462, COL.text, '22px sans-serif');
    }, [0.5, 9.3, -4.5]);
    const frame = framer(stage, (mode) => (mode === 'tall' ? fitView(stage, [0, 7.0, 0], [0.5, 0.55, 1], 40) : mode === 'narrow' ? fitView(stage, [0, 3.2, 0], [0.5, 0.6, 1], 36) : fitView(stage, [0.6, 5.2, 0], [0.42, 0.5, 1], 26.5)));
    let spinA = 0, dive = 0, key = '', t = 0, hbA = 0;
    return {
      update(dt, s) {
        dt = Math.max(0, dt); S = s; t += dt;
        const mode = frame();
        fitNarrow(stage, [lb.pedal, lb.servo, lb.abs, lb.hand, lb.c1, lb.c2, lb.mc]);
        bd.mesh.visible = mode !== 'narrow';
        if (mode === 'tall') bd.put([0, 13.5, -1], 2.1); else bd.put([5.2, 10.2, -5], 0.95, 0.3);
        const r = state(s), k = s.press / 100;
        explode(s.explode);
        const ex = s.explode;
        // the body dives: about 1.2° at 0.8 g on soft small-car springs
        dive = approach(dive, (r.a / G) * 0.026 * (1 - ex), 5, dt); car.rotation.z = -dive;
        pedal.rotation.z = approach(pedal.rotation.z, 0.42 * Math.min(1, r.c.travel / 0.13 + (s.press > 0 ? 0.15 : 0)), 8, dt);
        hbA = approach(hbA, s.hand ? 0.5 : 0, 8, dt); hb.rotation.z = hbA;
        spinA -= (s.speed / 3.6 / CAR.rTyre) * dt * 0.25;                       // wheels drawn at quarter speed so the eye can follow
        const heatK = clamp((s.speed / 140) * (r.a / G), 0, 1);
        for (const [kk, w] of Object.entries(wheels)) {
          const f = r.c.w[kk], dead = s.fail === CIRC[kk];
          w.spin.rotation.z = spinA;
          const share = f.road / 3200, hand = w.x < 0 && s.hand ? 0.5 : 0;
          w.glow.emissive?.setRGB(1, 0.28, 0.05); w.glow.emissiveIntensity = clamp(share * heatK * 3.5 + hand * 0.15, 0, 1.6);
          const L = clamp(f.road / 900, 0, 3.4) * (1 - ex);
          w.fa.position.set(w.x + 0.2, 0.12, w.z + w.sgn * 0.9); w.fa.rotation.z = Math.PI / 2; w.fa.set(L);
          w.fa.children.forEach((m) => m.material.color.set(COL[CIRC[kk]]));
          w.fa.visible = L > 0.05 && !dead;
        }
        for (const c of ['c1', 'c2']) {
          const dead = s.fail === c;
          pm[c].emissiveIntensity = dead ? 0 : 0.12 + 0.5 * k * (0.75 + 0.25 * Math.sin(t * 9));
          pm[c].color.set(dead ? '#4a4f59' : COL[c]);
        }
        lb.c1.element.textContent = s.fail === 'c1' ? 'Circuit 1: empty' : 'Circuit 1'; lb.c2.element.textContent = s.fail === 'c2' ? 'Circuit 2: empty' : 'Circuit 2';
        // axle loads
        const W = CAR.m * G, Lf = 0.6 + 3.2 * r.fs, Lr = 0.6 + 3.2 * (1 - r.fs);
        loadF.position.set(4.9, 2.7 + Lf + ex * 3, 0); loadF.set(Lf); loadR.position.set(-4.9, 2.7 + Lr + ex * 3, 0); loadR.set(Lr);
        lb.lf.position.y = loadF.position.y + 0.45; lb.lr.position.y = loadR.position.y + 0.45;
        lb.lf.element.innerHTML = `Front axle: <b>${fmtF(W * r.fs)}</b>`; lb.lr.element.innerHTML = `Rear axle: <b>${fmtF(W * (1 - r.fs))}</b>`;
        const kk = `${s.press}|${s.fail}|${mode}`; if (kk !== key) { key = kk; bd.redraw(); }
      },
      readout(s) {
        const r = state(s);
        return rows(`${s.speed} km/h: ${fmtE(r.ke)} to shed`, [
          ['Slowing at', s.press > 0 ? fmtG(r.a) + (r.limited ? ' (grip limit)' : '') : 'coasting', COL.out],
          ['Braking distance', isFinite(r.d) ? fmtM(r.d) : 'not braking', COL.d],
          ['Weight on the front axle', `${Math.round(r.fs * 100)}% (60% at rest)`, COL.w],
          ['Brakes working', s.fail === 'none' ? 'all four' : 'two of four', s.fail === 'none' ? COL.good : COL.bad],
          ['Pedal travel', (r.c.travel * 1000).toFixed(0) + ' mm'],
        ], s.fail === 'none' ? 'Dry road, grip 0.8. Distance is v² ÷ 2a, after the brakes bite.' : 'Half the force for the same push, and the pedal sinks further before it bites.');
      },
    };
  },
};
