// Chapter 6: brakes that do not use fluid, or do not use friction.
// Air brake (trucks and buses), 1 scene unit = 5 cm: a "type 30/30" spring brake chamber cut in
//   half. Front part, the service chamber: air behind a rubber diaphragm pushes the pushrod
//   (pressure × 193.5 cm²). Rear part, the spring chamber: a strong spring (about 8 kN) is held
//   squashed by tank air; let that air out, or lose it, and the spring pushes the same pushrod. The
//   pushrod turns a 150 mm slack adjuster, which turns the S-cam that spreads two shoes in a drum.
//   Numbers from airBrake() in brake.js.
// Regenerative braking (electric car), 1 scene unit = 25 cm: the motor is driven by the wheels and
//   works as a generator. It can take up to 45 kW and 0.25 g, and fades out below 10 km/h; the
//   friction brakes add whatever else the driver asks for. Numbers from regenSplit() and
//   regenStop() in brake.js.
import { THREE, M, box, rod, beam, tube, spring, arrow, approach, clamp, smooth } from '../kit.js';
import {
  G, KMH, BAR, AIR, EV, airBrake, regenSplit, regenStop, keJ, COL, hex, fmt0, fmtF, fmtE, fmtG, board, panelBg, title, text, axes, line, dot, hbar,
  makeRotor, makeTyre, cutX, slab, ringZ, iron, steel, rubber, cutMat, shade, framer, fitView, fitNarrow, rows, TAU,
} from '../brake.js';

const AY = 7.6, CAM = [4.2, 4.6], LEV = 3.0, A0 = -0.22, STROKE = 0.9;
const air = (s) => airBrake(s.sysP, s.pedal / 100);

export default {
  id: 'others',
  short: 'Air and regen',
  title: 'Air, springs and motors',
  subtitle: 'A truck\'s brakes come on by themselves if the air is lost. An electric car brakes with its motor.',
  view: { pos: [2, 8, 26], target: [1, 6.5, 0] },
  learn: `<p>A loaded truck weighs as much as thirty cars, far too much for a foot and some fluid. Trucks, buses and trains use <b>compressed air</b>. An engine-driven compressor fills tanks to about 8 bar. The pedal is just a valve: it lets air into a <b>brake chamber</b> at each wheel, where a diaphragm shoves a pushrod. A lever turns an <b>S-shaped cam</b> that spreads the shoes in a big drum.</p>
    <p>Air can leak away, so the design is turned upside down for safety. Behind each rear chamber sits a powerful <b>spring</b> that is always trying to apply the brake. Tank air holds it back. Lose the air, and the springs put the brakes <b>on</b>. That is the hiss you hear when a bus parks: the driver lets the air out and the springs clamp. George Westinghouse built the same idea into trains in the 1870s: a broken hose stops the train.</p>
    <p>An <b>electric car</b> has a brake with no friction at all. Lift off, and the motor is driven by the wheels and works as a <b>generator</b>, pushing charge back into the battery: <b>regenerative braking</b>. It cannot do everything. It is limited by the motor's power, it fades away at walking pace, and a full battery cannot take more. So the car quietly <b>blends</b> in the friction brakes for the rest. See <a href="https://glassbox.how/carclear/">CarClear</a>.</p>
    <p>There are more. A bicycle squeezes its rim or a small disc (<a href="https://glassbox.how/cycleclear/">CycleClear</a>). A motorcycle has a separate brake for each wheel, sometimes linked (<a href="https://glassbox.how/motorcycleclear/">MotorcycleClear</a>). Trucks add an <b>exhaust brake</b> that chokes the engine so it holds the load back downhill. And an automatic gearbox has a <b>parking pawl</b>, a steel tooth that locks its output shaft.</p>
    <p class="tip"><b>Try it:</b> break the air line and watch the spring take over as the pressure falls past 4 bar. Then switch to the electric car and brake gently, then hard.</p>`,
  terms: [
    { t: 'Brake chamber', d: 'A round can at each wheel of a truck. Air pressing on its diaphragm pushes the rod that applies the brake.' },
    { t: 'Spring brake', d: 'A strong spring that applies the brake unless air pressure holds it off. It parks the truck and stops it if the air fails.' },
    { t: 'S-cam', d: 'An S-shaped cam between the shoe tips. Turning it wedges the shoes out against the drum.' },
    { t: 'Fail-safe', d: 'Built so that a failure leaves things in the safe state. Here: no air means brakes on.' },
    { t: 'Regenerative braking', d: 'Slowing a vehicle by using its motor as a generator and storing the electricity.' },
    { t: 'Blending', d: 'Sharing a stop between the motor and the friction brakes so the driver feels one smooth brake.' },
  ],
  defaults: { kind: 'air', sysP: 8, pedal: 0, evSpeed: 80, ask: 0.2, regen: true },
  controls: [
    { key: 'kind', type: 'seg', label: 'Look at', options: [{ v: 'air', label: 'Truck air brake' }, { v: 'regen', label: 'Electric car' }] },
    { key: 'pedal', type: 'range', label: 'Truck: brake pedal', min: 0, max: 100, step: 1, ends: ['off', 'full'], fmt: (v, s) => (Math.min(s.sysP, (v / 100) * 8)).toFixed(1) + ' bar to the chamber' },
    { key: 'sysP', type: 'range', label: 'Truck: air in the tanks', min: 0, max: 8.5, step: 0.1, fmt: (v) => v.toFixed(1) + ' bar' },
    { key: 'line', type: 'buttons', label: 'Truck', items: [{ label: 'Air line breaks', act: (s) => { s.sysP = 0; } }, { label: 'Compressor refills', act: (s) => { s.sysP = 8; } }] },
    { key: 'ask', type: 'range', label: 'Electric car: how hard you brake', min: 0.05, max: 0.8, step: 0.01, fmt: (v) => v.toFixed(2) + ' g' },
    { key: 'evSpeed', type: 'range', label: 'Electric car: speed', min: 5, max: 120, step: 1, fmt: (v) => v + ' km/h' },
    { key: 'regen', type: 'toggle', label: 'Electric car: regeneration on', hint: 'Off: as with a full battery, friction does it all.' },
  ],
  quiz: [
    { q: 'A truck\'s air line breaks and the pressure falls to zero. What do the spring brakes do?', options: ['Release, so the truck rolls freely', 'Apply, because nothing holds the springs back any more', 'Nothing', 'Work only if the engine is running'], answer: 1, why: 'Air pressure holds the springs off. Lose the air and the springs push the brakes on: the system fails safe.' },
    { q: 'What is the hiss when a bus or truck parks?', options: ['Brake fluid boiling', 'Air being let out of the spring chambers so the springs apply the brakes', 'The tyres deflating', 'The engine cooling'], answer: 1, why: 'The parking valve vents the air that was holding the springs back.' },
    { q: 'Why does an electric car still need friction brakes?', options: ['It does not', 'Regeneration is limited by the motor and battery, and fades at very low speed', 'Motors cannot run backwards', 'The law requires drums'], answer: 1, why: 'A hard stop needs more power than the motor can take in, and at walking pace the motor makes too little voltage to charge with.' },
  ],
  reel: [
    { ms: 5800, caption: 'Truck brakes fail safe: lose the air, and a strong spring in each chamber puts the brakes on.', set: { kind: 'air', pedal: 0 }, anim: { sysP: [8, 0] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const L = (t, p, parent, cls, col) => { const l = stage.label(t, p, parent, cls); if (col) l.element.style.setProperty('--c', col); return l; };
    // ================================================================ AIR BRAKE
    const A = new THREE.Group(); root.add(A);
    const ax = new THREE.Group(); ax.position.y = AY; A.add(ax);
    const shellM = M.matte(0x30343c), cutD = cutMat(0x575c66);
    // spring chamber x −7.6…−3.6, dividing wall at −3.6, service chamber −3.6…−0.4
    ax.add(cutX([[-7.6, 0], [-7.6, 2.2], [-3.5, 2.2], [-3.5, 0.3], [-3.7, 0.3], [-3.7, 2.05], [-7.45, 2.05], [-7.45, 0]], shellM, cutD));
    ax.add(cutX([[-3.5, 2.2], [-2.2, 2.2], [-0.4, 1.5], [-0.4, 0.25], [-0.55, 0.25], [-0.55, 1.42], [-2.25, 2.05], [-3.5, 2.05]], shellM, cutD));
    const band = cutX([[-3.75, 2.2], [-3.75, 2.36], [-3.25, 2.36], [-3.25, 2.2]], steel(0x9aa1ad), cutMat(0xc9ced8)); ax.add(band);
    const pp = new THREE.Group(); ax.add(pp);                                   // spring-brake piston and its push tube
    pp.add(cutX([[-0.1, 0.2], [-0.1, 2.0], [0.1, 2.0], [0.1, 0.2]], steel(0xaab0bb), cutMat(0xdfe3ea)));
    pp.add(shade(rod(0, 2.2, 0.22, 0.22, steel())));
    const power = spring(0, 1, 1.45, 0.11, 6, steel(0xd08a3a)); ax.add(power);
    const sd = new THREE.Group(); ax.add(sd);                                   // service diaphragm, plate and pushrod
    sd.add(cutX([[-0.05, 0], [-0.05, 2.0], [0.05, 2.0], [0.05, 0]], rubber(0x0f1114), cutMat(0x15171b)));
    sd.add(cutX([[0.05, 0], [0.05, 1.3], [0.2, 1.3], [0.2, 0]], steel(0xaab0bb), cutMat(0xdfe3ea)));
    const pushrod = shade(rod(0, 1, 0.14, 0.14, steel())); ax.add(pushrod);
    const retS = spring(0, 1, 0.75, 0.05, 5, steel(0x8a909c)); ax.add(retS);
    const airS = rod(0, 1, 1.9, 1.9, M.ghost(hex(COL.air), 0), 28), airP = rod(0, 1, 1.9, 1.9, M.ghost(hex(COL.air), 0), 28); ax.add(airS, airP);
    const NA = 110, dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: hex(COL.air), toneMapped: false }), NA * 2); dots.frustumCulled = false; ax.add(dots);
    const seed = Array.from({ length: NA * 2 }, (_, i) => { const r = Math.sqrt((i * 0.618034) % 1) * 1.8, a = Math.PI * (0.04 + 0.92 * ((i * 0.754877) % 1)); return { u: (i * 0.56984) % 1, y: r * Math.cos(a), z: -r * Math.sin(a) * 0.9, ph: i * 1.3 }; });
    const o3 = new THREE.Object3D();
    // air lines and the tank
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(1.0, 3.4, 8, 20), M.matte(0x3a3f48)); tank.rotation.z = Math.PI / 2; tank.position.set(-6.0, 1.3, -0.6); A.add(shade(tank));
    A.add(tube([[-5.0, 2.3, -0.4], [-5.0, 3.6, -0.4], [-5.4, AY - 2.3, -0.3]], 0.1, M.plastic(0xd08a3a), false, 30));
    A.add(tube([[-3.6, 2.2, -0.4], [-2.6, 3.4, -0.4], [-2.9, AY - 2.3, -0.3]], 0.1, M.plastic(hex(COL.c2)), false, 30));
    const valve = box(0.8, 0.6, 0.6, steel(0x9aa1ad)); valve.position.set(-2.9, 3.2, -0.4); A.add(shade(valve));
    // slack adjuster, S-cam, shoes and drum
    const slack = new THREE.Group(); slack.position.set(CAM[0], CAM[1], 0.3); A.add(slack);
    slack.add(shade(beam([0, 0, 0], [0, LEV, 0], 0.2, steel(0x7d838e))));
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.6, 20), steel(0x6d7380)); boss.rotation.x = Math.PI / 2; slack.add(boss);
    const camShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.6, 16), steel()); camShaft.rotation.x = Math.PI / 2; camShaft.position.set(CAM[0], CAM[1], -1.0); A.add(camShaft);
    const DR = [8.6, CAM[1]], RD = 4.3;
    const drumG = new THREE.Group(); drumG.position.set(DR[0], DR[1], -2.2); A.add(drumG);
    drumG.add(ringZ(RD, RD + 0.45, -0.9, 0.9, iron(0x6a6f78)));
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(RD + 0.5, RD + 0.5, 0.12, 48), M.matte(0x3a3f48)); plate.rotation.x = Math.PI / 2; plate.position.z = -1.0; drumG.add(plate);
    const scam = new THREE.Group(); scam.position.set(CAM[0] - DR[0], 0, 0.1); drumG.add(scam);
    const sPts = []; for (let i = 0; i <= 20; i++) { const a = (i / 20) * Math.PI; sPts.push([0.28 * Math.cos(a) + 0.28, 0.2 + 0.62 * Math.sin(a) * 0.9 + 0.0]); }
    const lobe = [[-0.1, -0.25], [0.56, -0.25], ...sPts.map(([x, y]) => [x, y])];
    scam.add(slab(lobe, 0.8, steel(0xc0a060), 0.4)); const lobe2 = slab(lobe, 0.8, steel(0xc0a060), 0.4); lobe2.rotation.z = Math.PI; scam.add(lobe2);
    const mkShoe = (sg) => {                                                    // pivots at the far (right) side of the drum
      const piv = new THREE.Group(); piv.position.set(RD - 0.9, sg * 0.5, 0); drumG.add(piv);
      const g = new THREE.Group(); g.position.set(-(RD - 0.9), -sg * 0.5, 0); piv.add(g);
      const st = sg > 0 ? 0.12 : Math.PI + 0.12, ln = Math.PI - 0.34;
      const arc = (r0, r1, z0, z1, mat) => { const m = ringZ(r0, r1, z0, z1, mat, { phiStart: 0, phiLength: ln, seg: 36 }); m.rotation.z = st + Math.PI / 2; m.material.side = THREE.DoubleSide; return m; };
      g.add(arc(RD - 0.55, RD - 0.38, -0.7, 0.7, steel(0x8a909c)), arc(RD - 1.3, RD - 0.5, -0.1, 0.1, steel(0x767c87)), arc(RD - 0.38, RD - 0.1, -0.68, 0.68, M.matte(0x4a3b2c)));
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.8, 16), steel()); roller.rotation.x = Math.PI / 2; roller.position.set(CAM[0] - DR[0] + 0.25, sg * 0.75, 0.1); g.add(roller);
      return { piv, sg };
    };
    const shoesA = [mkShoe(1), mkShoe(-1)];
    const aRod = arrow(hex(COL.force), 1, 0.45, 0.12); aRod.rotation.z = -Math.PI / 2; A.add(aRod);
    const la = {
      spring: L('', [-5.6, AY + 2.9, 0.5], A, 'hot', COL.force), serv: L('', [-1.9, AY + 2.9, 0.5], A, 'hot', COL.c2), rod: L('', [2.0, AY + 1.1, 0.5], A, 'hot', COL.out),
      tank: L('', [-6.0, 0.05, 0.6], A, 'hot', COL.air), slack: L('Slack adjuster: a 150 mm lever', [CAM[0] - 1.7, CAM[1] + 1.2, 0.8], A), cam: L('S-cam spreads the shoes', [CAM[0] + 0.6, CAM[1] - 1.5, 0.8], A),
      drum: L('Drum and shoes', [DR[0] + 1, DR[1] - RD - 0.9, -1], A), pedal: L('Pedal valve', [-2.9, 2.3, 0.4], A),
    };
    // ================================================================ ELECTRIC CAR
    const E = new THREE.Group(); root.add(E);
    const pack = box(8.4, 0.6, 4.4, M.plastic(0x1f2a24, { roughness: 0.5 })); pack.position.set(0, 1.25, 0); E.add(shade(pack));
    const cells = []; for (let i = 0; i < 12; i++) { const c = box(0.55, 0.12, 4.0, M.glow(hex(COL.regen))); c.position.set(-3.85 + i * 0.7, 1.62, 0); E.add(c); cells.push(c); }
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.7, 28), steel(0x9aa1ad)); motor.rotation.x = Math.PI / 2; motor.position.set(5.6, 1.5, 0); E.add(shade(motor));
    const inv = box(1.4, 0.6, 1.4, M.matte(0x2a2e37)); inv.position.set(5.6, 2.7, 0); E.add(shade(inv));
    const axleF = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 12), steel()); axleF.rotation.x = Math.PI / 2; axleF.position.set(5.6, 1.2, 0); E.add(axleF);
    const axleR = axleF.clone(); axleR.position.x = -5.2; E.add(axleR);
    const cableC = new THREE.CatmullRomCurve3([[5.6, 3.0, 0], [5.0, 3.5, 0], [4.2, 2.6, 0], [3.6, 1.7, 0]].map((p) => new THREE.Vector3(...p)));
    E.add(new THREE.Mesh(new THREE.TubeGeometry(cableC, 40, 0.13, 8), M.plastic(0xff8a1f)));
    const NF = 16, flow = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 8, 6), M.glow(hex(COL.regen)), NF); flow.frustumCulled = false; E.add(flow);
    const evW = [];
    for (const x of [5.6, -5.2]) for (const z of [-3, 3]) {
      const g = new THREE.Group(); g.position.set(x, 1.2, z); E.add(g);
      const tyre = makeTyre(1.2, 0.76, { ghost: true }); g.add(tyre);
      const sp = new THREE.Group(); g.add(sp); const rot = makeRotor(0.75); rot.rotation.y = z > 0 ? 0 : Math.PI; sp.add(rot);
      evW.push({ sp, hot: rot.hot });
    }
    const shellPts = [[-7.4, 1.3], [-7.6, 3.2], [-6.9, 5.2], [-5.4, 5.9], [-1.0, 6.0], [2.2, 5.7], [4.4, 4.0], [7.9, 3.4], [8.3, 2.5], [8.3, 1.3]];
    const shell = slab(shellPts, 6.2, M.ghost(0x9fc4ff, 0.045), 3.1); shell.castShadow = false; E.add(shell);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry, 20), new THREE.LineBasicMaterial({ color: 0x8fb4e8, transparent: true, opacity: 0.35 })); edges.position.copy(shell.position); E.add(edges);
    const le = {
      motor: L('', [5.6, 4.0, 0], E, 'hot', COL.regen), batt: L('', [-0.5, 2.6, 0], E, 'hot', COL.regen), fric: L('', [5.6, 3.0, 3.4], E, 'hot', COL.heat), car: L('', [0, 7.0, 0], E),
    };
    let S = { kind: 'air', sysP: 8, pedal: 0, ask: 0.2, evSpeed: 80, regen: true };
    const bd = board(root, 7.6, 5.2, 760, 520, (g, w, h) => {
      panelBg(g, w, h);
      const s = S;
      if (s.kind === 'air') {
        const r = air(s);
        title(g, 'What pushes the brake on', 'force on the pushrod', 27);
        hbar(g, 250, w - 30, 110, 44, r.service / 16000, COL.c2, 'Air from the pedal', fmtF(r.service), 22);
        hbar(g, 250, w - 30, 172, 44, r.springF / 16000, COL.force, 'The parking spring', fmtF(r.springF), 22);
        hbar(g, 250, w - 30, 234, 44, r.rodF / 16000, COL.out, 'Pushrod gets', fmtF(r.rodF), 22);
        text(g, 'Air in the tanks', 26, 330, COL.muted, '22px sans-serif');
        g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(250, 304, w - 280, 40); g.fillStyle = s.sysP * BAR < AIR.warn ? COL.bad : COL.air; g.fillRect(250, 304, (w - 280) * clamp(s.sysP / 8.5, 0, 1), 40);
        const xw = 250 + (w - 280) * (4.1 / 8.5); g.strokeStyle = COL.bad; g.lineWidth = 3; g.beginPath(); g.moveTo(xw, 296); g.lineTo(xw, 352); g.stroke();
        text(g, 'below 4.1 bar the spring starts to win', xw + 10, 378, COL.bad, '20px sans-serif');
        text(g, s.sysP.toFixed(1) + ' bar', 262, 332, '#0b0d12', 'bold 22px sans-serif');
        text(g, r.released ? (r.service > 100 ? 'Service brake on: air does the work.' : 'Released: air is holding the spring back.') : r.springF >= AIR.spring - 50 ? 'No air: the spring holds the brake fully on.' : 'Low air: the spring is coming on by itself.', 26, 450, r.released ? COL.text : COL.bad, '23px sans-serif');
        text(g, 'Chamber: 193.5 cm² each side. Spring: 8 kN.', 26, 490, COL.muted, '20px sans-serif');
      } else {
        const v0 = s.evSpeed, st = regenStop(v0, s.ask * G, s.regen);
        title(g, `Stopping from ${v0} km/h at ${s.ask.toFixed(2)} g`, 'who does the braking as the car slows', 27);
        const A2 = axes(g, w, h, { xMin: 0, xMax: Math.max(20, v0), yMax: 0.8, y0: h - 150, y1: 110, xTicks: [0, Math.round(v0 / 2), v0], yTicks: [0, 0.2, 0.4, 0.6, 0.8], xFmt: (x) => x + ' km/h', yFmt: (y) => y.toFixed(1) + ' g', font: 20 });
        const xs = Array.from({ length: 61 }, (_, i) => (v0 * i) / 60), rg = xs.map((x) => regenSplit(s.ask * G, x / KMH, s.regen).aRegen / G);
        g.fillStyle = 'rgba(255,90,42,.75)'; g.beginPath(); g.moveTo(A2.X(0), A2.Y(0)); xs.forEach((x) => g.lineTo(A2.X(x), A2.Y(s.ask))); g.lineTo(A2.X(v0), A2.Y(0)); g.fill();
        g.fillStyle = 'rgba(123,224,123,.9)'; g.beginPath(); g.moveTo(A2.X(0), A2.Y(0)); xs.forEach((x, i) => g.lineTo(A2.X(x), A2.Y(rg[i]))); g.lineTo(A2.X(v0), A2.Y(0)); g.fill();
        text(g, 'motor (regeneration)', A2.x0 + 14, A2.y0 - 12, '#0b0d12', 'bold 20px sans-serif'); text(g, 'friction brakes', A2.x1 - 10, A2.Y(s.ask) + 26, '#fff', 'bold 20px sans-serif', 'right');
        hbar(g, 250, w - 30, h - 96, 34, st.eB / st.total, COL.regen, 'Back in the battery', `${fmtE(st.eB)} (${Math.round(100 * st.eB / st.total)}%)`, 21);
        hbar(g, 250, w - 30, h - 52, 34, st.eH / st.total, COL.heat, 'Lost as heat', `${fmtE(st.eH)} (${Math.round(100 * st.eH / st.total)}%)`, 21);
      }
    }, [6, 12.4, -1]);
    const V = { wide: { air: [[1.9, 8.6, 0], 31], regen: [[0.5, 6.4, 0], 27] }, narrow: { air: [[0.6, 7.6, 0], 36], regen: [[0.4, 4.4, 0], 36] }, tall: { air: [[1.2, 11.4, 0], 44], regen: [[0.4, 8.6, 0], 42] } };
    const frame = framer(stage, (mode, key) => { const [t, D] = V[mode][key]; return fitView(stage, t, key === 'air' ? [0.1, 0.08, 1] : [0.45, 0.5, 1], D); });
    let Ps = 8, Pd = 0, key = '', t = 0, spinE = 0;
    return {
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt); S = s; t += dt;
        const mode = frame(s.kind), isAir = s.kind === 'air';
        fitNarrow(stage, [la.slack, la.cam, la.drum, la.pedal, la.tank, le.car]);
        A.visible = isAir; E.visible = !isAir;
        Object.values(la).forEach((l) => { l.element.style.display = isAir ? '' : 'none'; }); Object.values(le).forEach((l) => { l.element.style.display = isAir ? 'none' : ''; });
        if (mode === 'tall') bd.put(isAir ? [1.2, 17.2, 0] : [0.4, 14.6, 0], 2.2); else if (mode === 'narrow') bd.put([0, -50, 0], 1); else bd.put(isAir ? [7.6, 15.2, -1] : [5.6, 11.4, -4], isAir ? 1 : 1, isAir ? 0 : 0.3);
        if (isAir) {
          Ps = approach(Ps, s.sysP, 1.6, dt); Pd = approach(Pd, s.pedal, 7, dt);
          const r = airBrake(Ps, Pd / 100);
          const sSpring = STROKE * smooth(r.springF / 2600), sServ = STROKE * smooth(r.service / 2600), st = Math.max(sSpring, sServ);
          // spring piston: held back at x = −6.4 when the air wins; the spring pushes it forward
          const xpp = -6.4 + sSpring + 0.9 * clamp(r.springF / AIR.spring, 0, 1);
          pp.position.x = xpp; power.scale.x = Math.max(0.2, xpp + 7.4); power.position.x = -7.45;
          const xsd = -3.3 + st; sd.position.x = xsd;
          const ang = Math.asin(clamp(Math.sin(A0) + st / LEV, -1, 1)); slack.rotation.z = -ang;
          const clev = CAM[0] + LEV * Math.sin(ang);
          pushrod.scale.x = clev - (xsd + 0.2); pushrod.position.x = (clev + xsd + 0.2) / 2;
          retS.scale.x = Math.max(0.1, -0.6 - xsd - 0.2); retS.position.x = xsd + 0.2;
          airS.scale.x = Math.max(0.01, xsd + 3.5); airS.position.x = (xsd - 3.5) / 2; airS.material.opacity = 0.2 * clamp(r.Pserv / AIR.sys, 0, 1);
          airP.scale.x = Math.max(0.01, -3.7 - xpp); airP.position.x = (-3.7 + xpp) / 2; airP.material.opacity = 0.2 * clamp(r.Psys / AIR.sys, 0, 1);
          for (let i = 0; i < NA * 2; i++) {
            const q = seed[i], park = i < NA, lo = park ? xpp + 0.2 : -3.4, hi = park ? -3.8 : xsd - 0.1, show = (i % NA) / NA < (park ? r.Psys : r.Pserv) / AIR.sys && hi - lo > 0.1;
            o3.position.set(lo + (hi - lo) * q.u + 0.04 * Math.sin(t * 3 + q.ph), q.y + 0.04 * Math.cos(t * 2.1 + q.ph), q.z); o3.scale.setScalar(show ? 1 : 0.0001); o3.updateMatrix(); dots.setMatrixAt(i, o3.matrix);
          }
          dots.instanceMatrix.needsUpdate = true;
          scam.rotation.z = (st / STROKE) * 0.5; shoesA.forEach((sh) => { sh.piv.rotation.z = -sh.sg * (st / STROKE) * 0.035; });
          const lr = 0.5 + 2.4 * clamp(r.rodF / 16000, 0, 1); aRod.position.set(0.2, AY + 0.55, 0.4); aRod.set(lr); aRod.visible = r.rodF > 200;
          la.spring.element.innerHTML = r.released ? 'Spring held back by air' : `Spring pushing: <b>${fmtF(r.springF)}</b>`;
          la.serv.element.innerHTML = `Service chamber: <b>${(r.Pserv / BAR).toFixed(1)} bar</b>`;
          la.rod.element.innerHTML = `Pushrod: <b>${fmtF(r.rodF)}</b>`;
          la.tank.element.innerHTML = `Air tank: <b>${Ps.toFixed(1)} bar</b>` + (Ps * BAR < AIR.warn ? ' · LOW AIR' : '');
        } else {
          const v = s.evSpeed / KMH, r = regenSplit(s.ask * G, v, s.regen), Pm = EV.m * r.aRegen * v, Pf = EV.m * r.aFric * v;
          spinE -= (v / 0.3) * dt * 0.2; evW.forEach((w2) => { w2.sp.rotation.z = spinE; w2.hot.emissive.setRGB(1, 0.3, 0.06); w2.hot.emissiveIntensity = clamp(Pf / 150e3, 0, 1.2); });
          for (let i = 0; i < NF; i++) { const u = (t * 0.9 + i / NF) % 1, p = cableC.getPointAt(u); o3.position.copy(p); o3.scale.setScalar(Pm > 200 ? 0.5 + 0.8 * clamp(Pm / EV.Pmax, 0, 1) : 0.0001); o3.updateMatrix(); flow.setMatrixAt(i, o3.matrix); }
          flow.instanceMatrix.needsUpdate = true;
          cells.forEach((c, i) => { c.material.color.set(Pm > 200 && ((t * 6 + i) % 12) < 3 ? '#d6ffd6' : COL.regen); });
          le.motor.element.innerHTML = Pm > 200 ? `Motor as generator: <b>${(Pm / 1000).toFixed(0)} kW</b>` : 'Motor: not regenerating';
          le.batt.element.innerHTML = `Battery takes in <b>${(Pm * EV.eff / 1000).toFixed(0)} kW</b>`;
          le.fric.element.innerHTML = `Friction brakes: <b>${(Pf / 1000).toFixed(0)} kW</b> of heat`;
          le.car.element.textContent = `${s.evSpeed} km/h, braking at ${s.ask.toFixed(2)} g`;
        }
        const kk = isAir ? `a|${Math.round(Ps * 20)}|${Math.round(Pd)}` : `e|${s.ask}|${s.evSpeed}|${s.regen}`; if (kk !== key) { key = kk; bd.redraw(); }
      },
      readout(s) {
        if (s.kind === 'air') {
          const r = air(s);
          return rows(`Pushrod: ${fmtF(r.rodF)}`, [
            ['Air in the tanks', s.sysP.toFixed(1) + ' bar', s.sysP * BAR < AIR.warn ? COL.bad : COL.air],
            ['Pedal air × 193.5 cm²', fmtF(r.service), COL.c2],
            ['Parking spring pushes', fmtF(r.springF), COL.force],
            ['Torque on the S-cam shaft', fmt0(r.camT) + ' N·m', COL.out],
            ['Brake state', r.rodF < 200 ? 'released' : r.springF > r.service ? 'on by spring' : 'on by air', r.springF > 1 ? COL.bad : COL.text],
          ], 'A type 30/30 chamber. The spring comes on as tank air falls below 4.1 bar.', 4);
        }
        const v = s.evSpeed / KMH, r = regenSplit(s.ask * G, v, s.regen), st = regenStop(s.evSpeed, s.ask * G, s.regen);
        return rows(`Motor ${Math.round(100 * r.aRegen / (s.ask * G))}%, friction ${Math.round(100 * r.aFric / (s.ask * G))}%`, [
          ['Motor brakes at', fmtG(r.aRegen), COL.regen],
          ['Friction brakes add', fmtG(r.aFric), COL.heat],
          [`A full stop from ${s.evSpeed} km/h holds`, fmtE(st.total), COL.w],
          ['Back into the battery', fmtE(st.eB) + ` (${Math.round(100 * st.eB / st.total)}%)`, COL.regen],
          ['Turned to heat', fmtE(st.eH), COL.heat],
        ], 'A 1,400 kg electric car: motor limit 45 kW and 0.25 g, 80% of that reaches the battery.', 4);
      },
    };
  },
};
