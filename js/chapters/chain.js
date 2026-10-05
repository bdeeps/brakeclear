// Chapter 2: from the foot to the wheel, in cut-away. A schematic: the parts are in the right order
// and work the right way, but bores and gaps are drawn far larger than life so they can be seen
// (master-cylinder travel is drawn at 34 scene units per metre; the 0.3 mm pad gap as 0.12 units).
// Pedal: a lever, pivot at the top; the pushrod joins a quarter of the way down, so ratio 4 : 1.
// Vacuum servo: a diaphragm between two chambers. At rest both are at engine vacuum (about 0.3 bar
//   absolute). Pressing the pedal opens a valve that lets outside air (1 bar) into the chamber on
//   the pedal side, and the pressure difference on the 280 cm² diaphragm adds to the push: boost
//   ratio 3 until the chamber is full of air (the knee point, 1,960 N of help), then no more.
// Tandem master cylinder: the pushrod drives the primary piston; the fluid it traps (and a spring)
//   drives the floating secondary piston. Both chambers end at the same pressure, P = rod force ÷
//   bore area. Each piston's seal first covers a small port to the reservoir, then pressure builds.
//   If one circuit is empty, its piston runs on until it meets a stop (15 mm of lost travel) and the
//   other circuit then works as normal.
// Floating caliper: pressure pushes the piston and inner pad one way, and pushes the bore's closed
//   end the other way. The body slides on its pins and pulls the outer pad in, so both pads clamp
//   with the same force P × A_piston. All numbers from chain() in brake.js.
import { THREE, M, box, rod, beam, tube, spring, arrow, approach, clamp, smooth } from '../kit.js';
import {
  G, BAR, HYD, A_M, A_C, CAR, chain, COL, hex, fmt0, fmtF, fmtBar, fmtG, board, panelBg, title, text, hbar,
  makeRotor, cutX, slab, iron, steel, rubber, cutMat, fluidMat, shade, framer, fitView, fitNarrow, rows, inReel,
} from '../brake.js';

const AY = 5.4, K = 34, PIV = [-7.6, 6.9], TH0 = -0.343, XR = 6.6, RR = 2.3, CY = 3.95, GAP = 0.12;
const get = (s) => chain(s.F, { vac: s.vac, fail: s.fail });
const span = (m, a, b) => { m.scale.x = Math.max(0.001, b - a); m.position.x = (a + b) / 2; };
const logK = (v) => clamp(Math.log10(Math.max(v, 10) / 10) / 4, 0, 1);   // 10 N … 100 kN

export default {
  id: 'chain',
  short: 'Foot to wheel',
  title: 'From your foot to the wheel',
  subtitle: 'A lever, a vacuum helper and Pascal\'s law turn a 100 N push into 7 kN of squeeze.',
  view: { pos: [1.5, 6.5, 26], target: [0, 5.2, 0] },
  learn: `<p>Follow a 100 N push, about the weight of a 10 kg bag resting on your foot.</p>
    <p><b>1. The pedal is a lever.</b> Your foot is four times further from the pivot than the pushrod is, so the pushrod gets <b>400 N</b>.</p>
    <p><b>2. The vacuum servo helps.</b> A rubber diaphragm sits between two chambers, both emptied by the engine's intake. As you press, a valve lets outside air into the chamber behind the diaphragm. Air pressure now pushes with you, and 400 N becomes <b>1,200 N</b>. Switch the engine off and the help is gone: the pedal feels like a brick.</p>
    <p><b>3. The master cylinder makes pressure.</b> 1,200 N on a 22 mm piston (3.87 cm²) gives <b>31 bar</b>. There are two pistons in one bore, one behind the other, each sealing its own circuit. The second one floats, so both circuits get the same pressure. If one circuit leaks, its piston runs on to a stop and the other still works.</p>
    <p><b>4. Pascal's law does the rest.</b> Pressure in a trapped fluid is the same everywhere, so 31 bar arrives at the caliper. Its piston is 54 mm across: 22.9 cm², about six times the area. Force = pressure × area = <b>7.1 kN</b>, the weight of 720 kg, on each pad. The price is distance: the pads move a fraction of a millimetre. <a href="https://glassbox.how/pascalclear/">PascalClear</a> shows why.</p>
    <p class="tip"><b>Try it:</b> press harder until the servo runs out of help. Then switch the engine off and see how hard you must push for the same squeeze.</p>`,
  terms: [
    { t: 'Pedal ratio', d: 'How many times the pedal lever multiplies your foot\'s force. About 4 on most cars.' },
    { t: 'Vacuum servo (booster)', d: 'A diaphragm with engine vacuum on one side. Letting air in behind it adds to the push on the master cylinder.' },
    { t: 'Tandem master cylinder', d: 'Two pistons in one bore, each feeding its own brake circuit.' },
    { t: 'Pascal\'s law', d: 'Pressure put on a trapped fluid reaches every part of it equally.' },
    { t: 'Pressure', d: 'Force spread over an area. 1 bar is 100,000 N on each square metre, or 10 N on each square centimetre.' },
    { t: 'Floating caliper', d: 'A caliper with a piston on one side only. Its body slides so both pads squeeze the disc equally.' },
  ],
  defaults: { F: 100, vac: true, fail: 'none', look: 'all' },
  controls: [
    { key: 'F', type: 'range', label: 'Push on the pedal', min: 0, max: 400, step: 5, ends: ['0', '400 N'], fmt: (v) => `${fmt0(v)} N (${(v / G).toFixed(0)} kg)` },
    { key: 'vac', type: 'toggle', label: 'Engine running', hint: 'The servo needs the engine\'s vacuum. Off: your foot works alone.' },
    { key: 'fail', type: 'seg', label: 'Burst a pipe', options: [{ v: 'none', label: 'Both fine' }, { v: 'c1', label: 'Circuit 1 empty' }, { v: 'c2', label: 'Circuit 2 empty' }] },
    { key: 'look', type: 'seg', label: 'Look at', options: [{ v: 'all', label: 'Whole chain' }, { v: 'servo', label: 'Servo and master' }, { v: 'cal', label: 'Caliper' }] },
  ],
  quiz: [
    { q: 'The caliper piston has six times the area of the master piston. What does it get?', options: ['Six times the pressure', 'The same pressure, so six times the force', 'One sixth of the force', 'Six times the travel'], answer: 1, why: 'Pascal\'s law: the pressure is the same everywhere. Force = pressure × area, so six times the area gives six times the force, and one sixth of the movement.' },
    { q: 'What does the vacuum servo use to add to your push?', options: ['A small electric motor', 'Pressure from the exhaust', 'Outside air pressing on a diaphragm that has engine vacuum on its other side', 'Brake fluid from the reservoir'], answer: 2, why: 'Letting air into one chamber while the other stays at vacuum gives a pressure difference across a big diaphragm.' },
    { q: 'One of the two circuits loses all its fluid. What happens when you press?', options: ['No brakes at all', 'The pedal goes further, then the other circuit works as normal', 'The servo makes up the difference', 'Both circuits lose pressure'], answer: 1, why: 'The empty circuit\'s piston travels until it hits a stop. After that the good circuit builds pressure as usual.' },
  ],
  reel: [
    { ms: 5400, caption: 'The pedal is a 4 to 1 lever, and a vacuum servo triples the push again.', set: { vac: true, fail: 'none', look: 'servo' }, anim: { F: [0, 160] }, spin: 0 },
    { ms: 5600, caption: 'Pascal\'s law: the same pressure on a piston six times bigger gives six times the force.', set: { vac: true, fail: 'none', look: 'cal' }, anim: { F: [10, 220] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const body = iron(0x8e949e), cut = cutMat(0xc9a34d), cutSteel = cutMat(0xdfe3ea), cutDark = cutMat(0x40444d);
    // ================================================================ pedal
    const pedal = new THREE.Group(); pedal.position.set(PIV[0], PIV[1], 0); root.add(pedal);
    pedal.add(shade(beam([0, 0, 0], [0, -6, 0], 0.11, steel(0x9aa1ad))));
    const footPad = box(0.9, 0.16, 0.9, rubber()); footPad.position.set(-0.12, -6.0, 0); footPad.rotation.z = 1.2; pedal.add(footPad);
    const piv = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 20), steel(0x6d7380)); piv.rotation.x = Math.PI / 2; piv.position.set(PIV[0], PIV[1], 0); root.add(piv);
    root.add(shade(beam([PIV[0], PIV[1], -0.2], [PIV[0] + 0.5, PIV[1] + 1.4, -0.2], 0.1, M.matte(0x2a2e37))));
    const pushRod = shade(beam([0, 0, 0], [1, 0, 0], 0.07, steel())); root.add(pushRod);
    const aFoot = arrow(hex(COL.force), 1, 0.3, 0.07); aFoot.rotation.z = -Math.PI / 2; root.add(aFoot);
    // ================================================================ everything on the servo / master-cylinder axis
    const ax = new THREE.Group(); ax.position.y = AY; root.add(ax);
    // ---- servo shell (back half), diaphragm, chambers
    ax.add(cutX([[-6.2, 0.4], [-6.2, 1.6], [-5.6, 2.2], [-4.3, 2.2], [-3.6, 1.5], [-3.6, 0.6], [-3.68, 0.6], [-3.68, 1.46], [-4.33, 2.12], [-5.57, 2.12], [-6.12, 1.56], [-6.12, 0.4]], M.matte(0x2b2f37), cutDark));
    const dia = new THREE.Group(); ax.add(dia);
    dia.add(cutX([[-0.04, 0.2], [-0.04, 2.08], [0.04, 2.08], [0.04, 0.2]], rubber(0x101216), cutMat(0x16181c)));
    dia.add(cutX([[0.04, 0.2], [0.04, 1.5], [0.12, 1.5], [0.12, 0.2]], steel(0xaab0bb), cutSteel));
    dia.add(shade(rod(-0.5, 2.5, 0.09, 0.09, steel())));                                   // input plunger and output rod
    const servoSpring = spring(0, 1, 0.9, 0.035, 5, steel(0x8a909c)); ax.add(servoSpring);
    const airBack = rod(0, 1, 1.5, 1.5, M.ghost(hex(COL.air), 0.0), 32); ax.add(airBack);        // the chamber air fills
    const dotG = new THREE.SphereGeometry(0.035, 6, 5);
    const mkDots = (n, col) => { const m = new THREE.InstancedMesh(dotG, new THREE.MeshBasicMaterial({ color: col, toneMapped: false }), n); m.frustumCulled = false; ax.add(m); return m; };
    const NA = 150, airDots = mkDots(NA * 2, hex(COL.air)), o3 = new THREE.Object3D();
    const seed = Array.from({ length: NA * 2 }, (_, i) => { const r = Math.sqrt(((i * 0.618034) % 1)) * 1.75, a = Math.PI * (0.03 + 0.94 * ((i * 0.754877) % 1)); return { u: (i * 0.569840) % 1, y: r * Math.cos(a), z: -r * Math.sin(a) * 0.9, ph: i * 1.7 }; });
    const aAir = [-1.2, 0, 1.2].map((y) => { const a = arrow(hex(COL.air), 0.5, 0.2, 0.05); a.rotation.z = -Math.PI / 2; a.position.y = y; ax.add(a); return a; });
    // vacuum hose to the engine, with its one-way valve
    root.add(tube([[-4.0, AY + 1.95, -0.3], [-3.9, AY + 2.9, -0.4], [-3.0, AY + 3.4, -0.6], [-1.6, AY + 3.5, -0.8]], 0.12, rubber(0x1b1d22), false, 40));
    const chk = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), steel(0xc0a060)); chk.position.set(-3.6, AY + 3.15, -0.47); root.add(chk);
    // ---- tandem master cylinder
    ax.add(cutX([[-3.3, 0.5], [-3.3, 0.8], [1.5, 0.8], [1.5, 0], [1.25, 0], [1.25, 0.5]], body, cut));
    const pistM = steel(0xd5d9e0);
    const mkPiston = (nose) => { const g = new THREE.Group(); g.add(shade(rod(0, 0.7, 0.485, 0.485, pistM))); g.add(shade(rod(0.7, 0.7 + nose, 0.14, 0.14, pistM))); for (const x of [0.08, 0.62]) { const sl = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.05, 8, 28), rubber()); sl.rotation.y = Math.PI / 2; sl.position.x = x; g.add(sl); } ax.add(g); return g; };
    const pP = mkPiston(1.49), pS = mkPiston(0.44);
    const f1 = fluidMat(hex(COL.c1), 0.55), f2 = fluidMat(hex(COL.c2), 0.55), amber = fluidMat(0xe0b23a, 0.6);
    const ch1 = rod(0, 1, 0.47, 0.47, f1, 28), ch2 = rod(0, 1, 0.47, 0.47, f2, 28); ax.add(ch1, ch2);
    const sp1 = spring(0, 1, 0.33, 0.03, 6, steel(0x8a909c)), sp2 = spring(0, 1, 0.33, 0.03, 4, steel(0x8a909c)); ax.add(sp1, sp2);
    // reservoir with two compartments, and the two ports
    const resv = new THREE.Group(); resv.position.set(-0.8, 1.45, -0.5); ax.add(resv);
    resv.add(box(3.6, 1.2, 1.0, M.clear(0xfff2c4, 0.22)));
    const rf1 = box(1.72, 0.7, 0.92, amber), rf2 = box(1.72, 0.7, 0.92, amber); rf1.position.set(-0.9, -0.22, 0); rf2.position.set(0.9, -0.22, 0); resv.add(rf1, rf2);
    resv.add(box(0.06, 1.1, 0.96, M.matte(0x8d8366)));
    const cap = box(1.0, 0.16, 0.8, M.matte(0x1b1d22)); cap.position.y = 0.68; resv.add(cap);
    const port1 = box(0.1, 0.36, 0.1, amber), port2 = box(0.1, 0.36, 0.1, amber); port1.position.set(-2.2, 0.66, -0.2); port2.position.set(0.5, 0.66, -0.2); ax.add(port1, port2);
    // ================================================================ pipes
    const c1Pts = [[-0.7, AY - 0.75, -0.1], [-0.7, 3.9, -0.1], [0.3, 3.1, -0.1], [2.2, 3.0, -0.1], [3.4, 3.5, -0.1], [4.3, CY, -0.1]].map((p) => new THREE.Vector3(...p));
    const c1Curve = new THREE.CatmullRomCurve3(c1Pts);
    root.add(new THREE.Mesh(new THREE.TubeGeometry(c1Curve, 90, 0.13, 10), M.clear(0xcfe8ff, 0.22)));
    const c1Fluid = new THREE.Mesh(new THREE.TubeGeometry(c1Curve, 90, 0.085, 8), f1); root.add(c1Fluid);
    const c2Pts = [[1.05, AY, -0.75], [1.2, AY + 0.1, -1.5], [1.9, AY + 0.5, -2.6], [3.0, AY + 1.0, -3.6], [4.4, AY + 1.3, -4.2]].map((p) => new THREE.Vector3(...p));
    const c2Curve = new THREE.CatmullRomCurve3(c2Pts);
    root.add(new THREE.Mesh(new THREE.TubeGeometry(c2Curve, 60, 0.13, 10), M.clear(0xcfe8ff, 0.22)));
    const c2Fluid = new THREE.Mesh(new THREE.TubeGeometry(c2Curve, 60, 0.085, 8), f2); root.add(c2Fluid);
    const ND = 26, pd1 = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), M.glow(0xfff3d6), ND), pd2 = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), M.glow(0xe6f6ff), ND);
    pd1.frustumCulled = pd2.frustumCulled = false; root.add(pd1, pd2);
    const drip = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), M.glow(hex(COL.c1)), 8); drip.frustumCulled = false; root.add(drip);
    // ================================================================ disc, floating caliper (cut through the middle)
    const rotor = makeRotor(RR); rotor.rotation.y = Math.PI / 2; rotor.position.set(XR, RR, 0); root.add(rotor);
    const hub = shade(rod(XR - 0.9, XR + 1.1, 0.5, 0.5, iron(0x5d626b), 24)); hub.position.y = RR; root.add(hub);
    const carrier = slab([[4.5, 2.2], [4.5, 2.75], [5.7, 2.75], [5.7, 2.2]], 1.3, M.matte(0x2a2e37), -0.05); root.add(carrier);
    root.add(shade(beam([5.1, 2.2, -0.7], [XR - 0.9, RR + 0.2, -0.7], 0.14, M.matte(0x2a2e37))));
    const calBody = new THREE.Group(); root.add(calBody);
    const calM = M.plastic(0xc8343a, { roughness: 0.5, metalness: 0.15 }), calCut = cutMat(0xe86a5f);
    const housing = cutX([[4.3, 0], [4.3, 0.95], [5.78, 0.95], [5.78, 0.57], [4.55, 0.57], [4.55, 0]], calM, calCut); housing.position.y = CY; calBody.add(housing);
    calBody.add(slab([[4.3, CY + 0.9], [4.3, CY + 1.38], [7.56, CY + 1.38], [7.56, 3.2], [7.24, 3.2], [7.24, CY + 0.9]], 1.15, calM, 0));
    const lug = slab([[4.75, 2.75], [4.75, CY - 0.9], [5.45, CY - 0.9], [5.45, 2.75]], 0.5, calM, -0.3); calBody.add(lug);
    const seal = cutX([[5.5, 0.555], [5.5, 0.68], [5.64, 0.68], [5.64, 0.555]], rubber(0x0d0e11), cutMat(0x0d0e11)); seal.position.y = CY; calBody.add(seal);
    const pin = shade(rod(4.3, 5.9, 0.09, 0.09, steel())); pin.position.set(pin.position.x, 3.05, -0.55); root.add(pin);
    const calPiston = cutX([[0, 0], [0, 0.55], [0.95, 0.55], [0.95, 0.4], [0.16, 0.4], [0.16, 0]], steel(0xd5d9e0), cutSteel, { full: true }); calPiston.position.y = CY; root.add(calPiston);
    const calFluid = rod(0, 1, 0.53, 0.53, f1, 28); calFluid.position.y = CY; root.add(calFluid);
    const padM = M.matte(0x4a3b2c), backM = steel(0x7d838e);
    const mkPad = (sgn) => { const g = new THREE.Group(); const fr = box(0.24, 1.38, 1.5, padM); fr.position.x = sgn * 0.12; const bk = box(0.08, 1.5, 1.6, backM); bk.position.x = sgn * 0.28; g.add(fr, bk); g.position.y = 3.9; root.add(shade(g)); return g; };
    const padIn = mkPad(-1), padOut = mkPad(1);
    const aIn = arrow(hex(COL.out), 1, 0.3, 0.08), aOut = arrow(hex(COL.out), 1, 0.3, 0.08); aIn.rotation.z = -Math.PI / 2; aOut.rotation.z = Math.PI / 2; root.add(aIn, aOut);
    // ================================================================ labels and the force ladder
    const L = (t, p, cls, col) => { const l = stage.label(t, p, root, cls); if (col) l.element.style.setProperty('--c', col); return l; };
    const lb = {
      foot: L('', [-9.6, 1.9, 0.6], 'hot', COL.force), pedal: L('Pedal: 4 to 1 lever', [-7.6, 3.4, 0.4]), rodIn: L('', [-6.9, AY - 0.75, 0.6], 'hot', COL.force),
      servo: L('Vacuum servo', [-4.6, AY - 2.75, 0.4]), vac: L('', [-4.0, AY + 2.75, 0.5]), air: L('', [-5.75, AY - 1.5, 0.5]), eng: L('to the engine\'s intake', [-1.6, AY + 3.9, -0.8]),
      mc: L('Tandem master cylinder', [-1.0, AY - 1.3, 0.8]), res: L('Fluid reservoir', [-0.8, AY + 2.45, 0]), p: L('', [1.9, AY + 0.1, 0.8], 'hot', COL.P),
      c1: L('', [1.3, 2.35, 0.3], 'hot', COL.c1), c2: L('', [4.6, AY + 1.9, -4.2], 'hot', COL.c2),
      cal: L('', [5.9, CY + 1.9, 0.3], 'hot', COL.out), pist: L('Caliper piston', [4.2, CY - 1.55, 0.6]), rot: L('Ventilated disc', [XR + 0.6, 0.55, 1.2]), pads: L('Pads', [XR, 2.85, 1.0]),
    };
    let S = { F: 100, vac: true, fail: 'none' };
    const bd = board(root, 7.6, 5.6, 760, 560, (g, w, h) => {
      panelBg(g, w, h);
      const c = get(S), x0 = 268, x1 = w - 30, fr = c.w.fl.P > 0 ? c.w.fl : c.w.fr;
      title(g, 'The push, step by step', 'force on a log scale: each tick is ×10', 28);
      const list = [
        ['Your foot', c.F, COL.force], ['After the pedal ×4', c.rodIn, COL.force], [S.vac ? 'After the servo' : 'Servo: no vacuum', c.rodOut, COL.force],
        ['Squeeze on each pad', fr.clampF, COL.out], ['Friction on the disc', fr.drag, COL.out], ['Grip at one tyre', fr.road, COL.w],
      ];
      list.forEach(([name, v, col], i) => hbar(g, x0, x1, 96 + i * 56, 40, logK(v), col, name, fmtF(v), 22));
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
      for (let d = 1; d < 4; d++) { const x = x0 + (x1 - x0) * d / 4; g.beginPath(); g.moveTo(x, 92); g.lineTo(x, 428); g.stroke(); }
      text(g, `Line pressure ${fmtBar(c.P)}`, 26, 472, COL.P, 'bold 26px sans-serif');
      text(g, `= ${fmtF(c.rodOut)} ÷ ${(A_M * 1e4).toFixed(2)} cm²`, 300, 472, COL.muted, '22px sans-serif');
      text(g, `× ${(A_C * 1e4).toFixed(1)} cm² at the caliper: ${(A_C / A_M).toFixed(1)} times the area`, 26, 514, COL.muted, '22px sans-serif');
    }, [5.2, 10.4, -1]);
    const V = {
      wide: { all: [[-0.4, 8.4, 0], 27.5], servo: [[-3.9, 6.5, 0], 18.5], cal: [[5.0, 6.8, 0], 15] },
      narrow: { all: [[-0.5, 6.4, 0], 33], servo: [[-3.4, 7.2, 0], 20], cal: [[5.4, 5.6, 0], 15] },
      tall: { all: [[-0.5, 8.6, 0], 44], servo: [[-3.9, 8.6, 0], 27], cal: [[5.2, 7.0, 0], 20] },
    };
    const frame = framer(stage, (mode, key) => { const [t, D] = V[mode][key] || V[mode].all; return fitView(stage, t, [0.05, 0.1, 1], D); });
    let Fs = 0, t = 0, key = '', gap = GAP, vacK = 1;
    const tmp = new THREE.Vector3();
    return {
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt); S = s; t += dt;
        const mode = frame(s.look);
        fitNarrow(stage, [lb.pedal, lb.eng, lb.res, lb.pist, lb.rot, lb.pads, lb.vac, lb.air, lb.rodIn, lb.c2]);
        if (mode === 'tall') { if (s.look === 'cal') bd.put([5.0, 11.0, 0], 1.0); else if (s.look === 'servo') bd.put([-3.9, 14.2, 0], 1.4); else bd.put([-0.5, 15.5, 0], 2.2); }
        else if (mode === 'narrow') bd.put([0, -30, 0], 1);
        else if (s.look === 'servo') bd.put([0.6, 11.6, -1], 0.6); else if (s.look === 'cal') bd.put([7.6, 10.2, -1], 0.52); else bd.put([5.6, 13.6, -1], 1);
        Fs = approach(Fs, s.F, 9, dt);
        const c = chain(Fs, { vac: s.vac, fail: s.fail });
        vacK = approach(vacK, s.vac ? 1 : 0, 3, dt);
        // ---- pedal and pushrod
        const Sp = clamp(K * c.stroke, 0, 0.98), dead = s.fail === 'none' ? 0 : K * HYD.deadStroke * smooth(Fs / 30);
        const Ss = s.fail === 'none' ? Sp / 2 : s.fail === 'c2' ? Math.min(dead, Sp) : Math.max(0, Sp - dead);
        const th = Math.asin(clamp(Math.sin(TH0) + Sp / 1.5, -1, 1)); pedal.rotation.z = th;
        const clev = [PIV[0] + 1.5 * Math.sin(th), PIV[1] - 1.5 * Math.cos(th)], xd = -5.35 + Sp;
        tmp.set(xd - 0.5 - clev[0], AY - clev[1], 0);
        pushRod.scale.y = tmp.length(); pushRod.position.set((clev[0] + xd - 0.5) / 2, (clev[1] + AY) / 2, 0); pushRod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp.normalize());
        const padX = PIV[0] + 6 * Math.sin(th), padY = PIV[1] - 6 * Math.cos(th), la = 0.5 + 2.2 * logK(Fs * 10) * 0.6;
        aFoot.position.set(padX - 0.45 - la, padY + 0.1, 0); aFoot.set(la); aFoot.visible = Fs > 2;
        // ---- servo
        dia.position.x = xd;
        span(servoSpring, xd + 0.14, -3.7);
        const help = c.assistMax > 0 ? c.assist / c.assistMax : 0;        // 0…1: how full of air the working chamber is
        const pBack = s.vac ? 0.3 + 0.7 * help : 1, pFront = 0.3 + 0.7 * (1 - vacK);
        span(airBack, -6.1, xd - 0.05); airBack.material.opacity = 0.05 + 0.16 * (pBack - 0.3) / 0.7;
        for (let i = 0; i < NA * 2; i++) {
          const q = seed[i], back = i < NA, lo = back ? -6.05 : xd + 0.2, hi = back ? xd - 0.1 : -3.75, show = q.u * 0 + ((i % NA) / NA) < (back ? pBack : pFront);
          const rr = Math.hypot(q.y, q.z), lim = back ? 1.5 + 0.55 * clamp((lo + (hi - lo) * q.u + 6.2) / 0.6, 0, 1) : 1.4 + 0.65 * clamp((-3.6 - (lo + (hi - lo) * q.u)) / 0.7, 0, 1), kk = rr > lim ? lim / rr : 1;
          o3.position.set(lo + (hi - lo) * q.u + 0.03 * Math.sin(t * 3 + q.ph), q.y * kk + 0.03 * Math.cos(t * 2.3 + q.ph), q.z * kk);
          o3.scale.setScalar(show ? 1 : 0.0001); o3.updateMatrix(); airDots.setMatrixAt(i, o3.matrix);
        }
        airDots.instanceMatrix.needsUpdate = true;
        aAir.forEach((a) => { const L2 = 0.2 + 0.9 * help; a.position.x = xd - 0.1 - L2; a.set(L2); a.visible = help > 0.02; });
        lb.air.element.textContent = `behind: ${pBack.toFixed(2)} bar`; lb.vac.element.textContent = `in front: ${pFront.toFixed(2)} bar`;
        lb.air.position.x = -6.3; lb.vac.position.x = -4.6;
        // ---- master cylinder
        const xp = -3.1 + Sp, xs = -0.4 + Ss;
        pP.position.x = xp; pS.position.x = xs;
        span(ch1, xp + 0.7, xs); span(ch2, xs + 0.7, 1.25); span(sp1, xp + 0.72, xs); span(sp2, xs + 0.72, 1.25);
        const e1 = s.fail === 'c1', e2 = s.fail === 'c2', pk = clamp(c.P / (80 * BAR), 0, 1);
        f1.opacity = e1 ? 0.1 : 0.55; f2.opacity = e2 ? 0.1 : 0.55;
        f1.emissiveIntensity = e1 ? 0 : 0.2 + 0.7 * pk; f2.emissiveIntensity = e2 ? 0 : 0.2 + 0.7 * pk;
        port1.material.opacity = 0.6; port1.visible = xp + 0.62 < -2.25; port2.visible = xs + 0.62 < 0.45;
        rf1.scale.y = e1 ? 0.12 : 1; rf1.position.y = e1 ? -0.53 : -0.22; rf2.scale.y = e2 ? 0.12 : 1; rf2.position.y = e2 ? -0.53 : -0.22;
        // ---- fluid in the pipes: it shifts towards the wheels by the volume the pistons displace
        const sh1 = e1 ? (t * 0.25 * Math.min(1, Fs / 40)) % 1 : (Sp - Ss) * 0.08, sh2 = e2 ? (t * 0.25 * Math.min(1, Fs / 40)) % 1 : Ss * 0.16;
        for (let i = 0; i < ND; i++) {
          let u = (i / ND + sh1) % 1; const p = c1Curve.getPointAt(clamp(u, 0, 1)), cutAt = e1 ? 0.62 : 2;
          o3.position.set(p.x, p.y, p.z + 0.05); o3.scale.setScalar(u > cutAt ? 0.0001 : 0.6 + 0.6 * (e1 ? 0.2 : pk)); o3.updateMatrix(); pd1.setMatrixAt(i, o3.matrix);
          u = (i / ND + sh2) % 1; const q = c2Curve.getPointAt(clamp(u, 0, 1));
          o3.position.set(q.x, q.y, q.z + 0.05); o3.scale.setScalar(e2 && u > 0.55 ? 0.0001 : 0.6 + 0.6 * (e2 ? 0.2 : pk)); o3.updateMatrix(); pd2.setMatrixAt(i, o3.matrix);
        }
        pd1.instanceMatrix.needsUpdate = pd2.instanceMatrix.needsUpdate = true;
        const leakP = e1 ? c1Curve.getPointAt(0.62) : e2 ? c2Curve.getPointAt(0.55) : null;
        drip.material.color.set(e2 ? COL.c2 : COL.c1);
        for (let i = 0; i < 8; i++) { const u = (t * 0.9 + i / 8) % 1; if (leakP && Fs > 3) { o3.position.set(leakP.x + 0.1 * Math.sin(i * 2.1), leakP.y - u * u * leakP.y, leakP.z + 0.1 * Math.cos(i * 1.3)); o3.scale.setScalar(1); } else o3.scale.setScalar(0.0001); o3.updateMatrix(); drip.setMatrixAt(i, o3.matrix); }
        drip.instanceMatrix.needsUpdate = true;
        // ---- caliper: the gap closes first, then force builds
        const live = !e1, clampF = live ? c.w.fl.clampF : 0;
        gap = approach(gap, live ? GAP * (1 - Math.min(1, Fs / 14)) : GAP, 12, dt);
        const d = GAP - gap;
        calBody.position.x = -d;
        padIn.position.x = XR - 0.2 - gap; padOut.position.x = XR + 0.2 + gap;
        const pFront2 = XR - 0.2 - gap - 0.32;
        calPiston.position.x = pFront2 - 0.95;
        span(calFluid, 4.55 - d, pFront2 - 0.95); calFluid.visible = live;
        const la2 = 0.35 + 1.5 * logK(clampF) * (clampF > 20 ? 1 : 0);
        aIn.position.set(pFront2 - 1.0 - la2 - 0.5, CY, 0.9); aIn.set(la2); aOut.position.set(XR + 0.52 + gap + 0.36 + la2 + 0.1, CY - 0.4, 0.9); aOut.set(la2);
        aIn.visible = aOut.visible = clampF > 20;
        rotor.rotation.z -= dt * 5 * (1 - clamp(clampF / 9000, 0, 0.93));
        
        // ---- labels
        lb.foot.element.innerHTML = `Foot: <b>${fmtF(Fs)}</b>`; lb.foot.position.set(padX + 0.3, padY - 0.85, 0.6);
        lb.rodIn.element.innerHTML = `pushrod: <b>${fmtF(c.rodIn)}</b>`;
        lb.p.element.innerHTML = `${s.fail === 'none' ? 'both circuits' : 'the good circuit'}: <b>${fmtBar(c.P)}</b>`;
        lb.c1.element.innerHTML = e1 ? 'Circuit 1: <b>empty</b>' : `Circuit 1: <b>${fmtBar(c.P1)}</b>`;
        lb.c2.element.innerHTML = e2 ? 'Circuit 2: <b>empty</b>' : `Circuit 2, to two other brakes: <b>${fmtBar(c.P2)}</b>`;
        lb.cal.element.innerHTML = live ? `each pad squeezed with <b>${fmtF(clampF)}</b>` : 'no pressure here';
        lb.servo.element.textContent = !s.vac ? 'Vacuum servo: no vacuum, no help' : c.saturated ? 'Vacuum servo: giving all it has' : 'Vacuum servo';
        const kk = `${Math.round(Fs)}|${s.vac}|${s.fail}`; if (kk !== key) { key = kk; bd.redraw(); }
      },
      readout(s) {
        const c = get(s), fr = c.w.fl.P > 0 ? c.w.fl : c.w.fr;
        return rows(`${fmtF(c.F)} becomes ${fmtF(fr.clampF)}`, [
          ['Pedal lever × 4', fmtF(c.rodIn), COL.force],
          [s.vac ? 'Servo adds' : 'Servo adds (engine off)', '+ ' + fmtF(c.assist), COL.force],
          ['Pressure = force ÷ 3.87 cm²', fmtBar(c.P), COL.P],
          ['Squeeze = pressure × 22.9 cm²', fmtF(fr.clampF), COL.out],
          ['The car slows at', fmtG(Math.min(c.a, 1.0 * G)), COL.out],
          ['Pedal travel', (c.travel * 1000).toFixed(0) + ' mm', COL.d],
        ], c.saturated ? `The servo is giving all it can (${fmtF(c.assistMax)}). Past ${fmt0(c.knee)} N of foot, extra push is yours alone.` : s.fail !== 'none' ? 'One circuit is empty: half the braking, and a longer pedal.' : 'Typical small-car sizes. Pad friction 0.38.', 4);
      },
    };
  },
};
