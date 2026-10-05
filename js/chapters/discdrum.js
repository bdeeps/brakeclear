// Chapter 3: the two brakes at the wheels, each in cut-away. 1 scene unit = 20 mm, true to scale
// except the running clearances, which are drawn about 8 times too big so they can be seen.
// Disc: a 256 × 22 mm ventilated rotor and a floating caliper with one 54 mm piston, cut through
//   the piston's axis. Squeeze F = P × A; drag = 2 μ F (two rubbing faces); torque = drag × 105 mm.
//   The square-section seal sits in a groove in the bore. When the piston moves out it drags the
//   seal's inner edge with it; when pressure is let go the seal springs straight and pulls the
//   piston back about 0.3 mm. As the lining wears (10 mm new, 2 mm at the limit) the piston
//   slips through the seal and stays further out, so the gap adjusts itself; the fluid that fills
//   the space behind it comes from the reservoir (piston area × travel).
// Drum: 200 mm drum, 19 mm wheel cylinder, leading and trailing shoe on a fixed anchor. Shoe
//   factors from shoeFactors() in brake.js. The drum turns anticlockwise here when the car drives
//   forward, so the left shoe (rotation runs from its pushed tip towards its anchor) is leading.
//   Handbrake: 200 N of pull on a 7 : 1 lever, shared by two drums, then a 5 : 1 lever inside
//   each drum (typical ratios), spreads the shoes with 3,500 N. UN Regulation 13-H asks the
//   parking brake to hold the loaded car on a 20% slope.
import { THREE, M, box, rod, beam, spring, arrow, approach, clamp } from '../kit.js';
import {
  G, BAR, HYD, A_C, A_W, CAR, SHOE, shoeFactors, COL, hex, fmt0, fmtF, fmtBar, board, panelBg, title, text, axes, line, dot,
  makeRotor, cutX, slab, latheZ, ringZ, iron, steel, rubber, cutMat, fluidMat, shade, framer, fitView, fitNarrow, rows, TAU,
} from '../brake.js';

const U = 0.02;                                   // metres per scene unit
const GAP = 0.12, LIN = 0.5, HT = 0.55, CY = 0.95, RC = -4.2;
const HAND = { pull: 200, lever: 7, inner: 5 };
function disc(s) {
  const P = s.P * BAR, F = P * A_C, drag = 2 * s.mu * F, T = drag * HYD.rEff;
  const left = 10 - 8 * s.wear, out = 2 * (10 - left);              // mm of lining left; mm the piston has moved out of the bore
  return { P, F, drag, T, road: T / CAR.rTyre, left, out, vol: A_C * (out / 1000) * 1e6, factor: 2 * s.mu };
}
function drum(s) {
  const sf = shoeFactors(s.mu), hand = s.hand ? (HAND.pull * HAND.lever / 2) * HAND.inner : 0;
  const F = Math.max(s.P * BAR * A_W, hand);
  const lead = Math.min(sf.lead, 30) * F, trail = sf.trail * F, T = (lead + trail) * HYD.rDrum;
  const hold = (2 * T / CAR.rTyre) / (CAR.m * G);                    // both rear drums against the car's weight along the slope
  return { F, sf, lead, trail, T, road: T / CAR.rTyre, hand, slope: Math.tan(Math.asin(Math.min(0.6, hold))) * 100 };
}

export default {
  id: 'discdrum',
  short: 'Disc and drum',
  title: 'Disc and drum: two ways to grip',
  subtitle: 'A caliper pinches a disc from both sides. Shoes push out against the inside of a drum.',
  view: { pos: [2, 3, 18], target: [0, 1, 0] },
  learn: `<p>A <b>disc brake</b> pinches. Fluid pushes the caliper's <b>piston</b>, which presses the inner <b>pad</b> on the disc. The same pressure pushes the caliper body the other way: it slides on pins and pulls the outer pad in. Both faces of the disc are gripped, so the drag is 2 × friction × squeeze.</p>
    <p>Nothing pulls the pads back except one clever part. A <b>square rubber seal</b> grips the piston. It twists as the piston moves out, and untwists when you lift off, drawing the piston back a third of a millimetre. As the pads wear, the piston slips through the seal and stays further out. The brake <b>adjusts itself</b>, and the fluid level in the reservoir slowly drops.</p>
    <p>A <b>drum brake</b> pushes outwards. A <b>wheel cylinder</b> spreads two curved <b>shoes</b> against the inside of a spinning drum. On the <b>leading shoe</b> the drum's drag pulls the shoe harder into the drum, so it grips more than you paid for: <b>self-servo</b>. On the <b>trailing shoe</b> the drag pushes it off.</p>
    <p>That free help has a cost. If the lining's friction falls a little when hot, a drum loses much more grip than a disc does. A drum also traps its heat inside. That is why cars put discs at the front, where most of the work is, and why <a href="https://glassbox.how/motorcycleclear/">motorcycles</a> and <a href="https://glassbox.how/cycleclear/">bicycles</a> moved to discs too. Drums stay on rear wheels and trucks: they are cheap, sealed from dirt, and make a good <b>handbrake</b>.</p>
    <p class="tip"><b>Try it:</b> in the drum, drop the lining friction from 0.4 to 0.3 and compare the loss with the disc's on the chart. Then wear the disc pads down and watch the piston follow.</p>`,
  terms: [
    { t: 'Caliper', d: 'The clamp that straddles the disc and holds the piston and pads.' },
    { t: 'Pad', d: 'A steel plate faced with friction material that rubs on the disc.' },
    { t: 'Seal roll-back', d: 'The piston seal twisting and springing back, which pulls the pads just clear of the disc.' },
    { t: 'Leading shoe', d: 'A drum shoe that the drum\'s rotation drags into harder contact. It helps itself.' },
    { t: 'Trailing shoe', d: 'A drum shoe that the drum\'s rotation pushes away. It grips less.' },
    { t: 'Brake factor', d: 'Drag at the rubbing surface divided by the force that applies the brake. For a disc it is 2 × friction.' },
  ],
  defaults: { kind: 'disc', P: 31, mu: 0.38, wear: 0, dir: 'fwd', hand: false },
  controls: [
    { key: 'kind', type: 'seg', label: 'Brake', options: [{ v: 'disc', label: 'Disc and caliper' }, { v: 'drum', label: 'Drum and shoes' }] },
    { key: 'P', type: 'range', label: 'Fluid pressure', min: 0, max: 80, step: 1, fmt: (v) => v + ' bar' },
    { key: 'mu', type: 'range', label: 'Lining friction', min: 0.2, max: 0.6, step: 0.01, ends: ['hot, faded', 'grippy'], fmt: (v) => 'μ = ' + v.toFixed(2) },
    { key: 'wear', type: 'range', label: 'Disc pad wear', min: 0, max: 1, step: 0.01, ends: ['new, 10 mm', 'worn, 2 mm'], fmt: (v) => (10 - 8 * v).toFixed(1) + ' mm left' },
    { key: 'dir', type: 'seg', label: 'Drum turns', options: [{ v: 'fwd', label: 'Forwards' }, { v: 'rev', label: 'Reversing' }] },
    { key: 'hand', type: 'toggle', label: 'Drum: handbrake on', hint: 'A cable and lever spread the shoes. No fluid needed.' },
  ],
  quiz: [
    { q: 'What pulls a disc brake\'s pads back off the disc when you lift your foot?', options: ['A big return spring', 'The square piston seal untwisting', 'Suction from the master cylinder', 'The spinning disc throws them off'], answer: 1, why: 'The seal grips the piston, twists as it moves out, and springs straight again, drawing it back about 0.3 mm.' },
    { q: 'On a leading shoe, what does the drum\'s drag do?', options: ['Pushes the shoe away from the drum', 'Pulls the shoe harder into the drum', 'Nothing', 'Turns the wheel cylinder'], answer: 1, why: 'The drag turns the shoe about its anchor in the same direction as the wheel cylinder pushes it, so the shoe wedges in: self-servo.' },
    { q: 'The linings get hot and their friction falls by a fifth. Which brake loses more of its grip?', options: ['The disc', 'The drum', 'Both lose exactly a fifth', 'Neither'], answer: 1, why: 'A disc\'s drag is simply 2 × friction × squeeze. A drum leans on self-servo, which collapses faster than the friction itself.' },
  ],
  reel: [
    { ms: 5400, caption: 'A floating caliper has one piston, yet squeezes the disc from both sides with equal force.', set: { kind: 'disc', mu: 0.38, wear: 0 }, anim: { P: [0, 60] }, spin: 0 },
    { ms: 5600, caption: 'In a drum, the leading shoe is dragged into the drum and grips itself harder.', set: { kind: 'drum', mu: 0.38, dir: 'fwd', hand: false }, anim: { P: [0, 60] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const L = (t, p, parent, cls, col) => { const l = stage.label(t, p, parent, cls); if (col) l.element.style.setProperty('--c', col); return l; };
    // ================================================================ DISC (origin: top of the rotor's rubbing band)
    const D = new THREE.Group(); D.position.y = 5.2; root.add(D);
    const rotor = makeRotor(6.4); rotor.rotation.y = Math.PI / 2; rotor.position.set(0, RC, 0); D.add(rotor);
    const hub = shade(rod(-1.6, 2.6, 1.3, 1.3, iron(0x5d626b), 28)); hub.position.y = RC; D.add(hub);
    const calM = M.plastic(0xc8343a, { roughness: 0.5, metalness: 0.15 }), calCut = cutMat(0xe86a5f);
    const bodyG = new THREE.Group(); D.add(bodyG);
    // at rest: inner backing plate's back face is at x = −(HT + GAP + LIN + 0.25) = −1.42; piston 2.2 long behind it
    const X_BORE0 = -4.35, X_MOUTH = -1.75, X_FING = HT + GAP + LIN + 0.25;
    const housing = cutX([[X_BORE0 - 0.5, 0], [X_BORE0 - 0.5, 1.9], [X_MOUTH, 1.9], [X_MOUTH, 1.37], [-2.2, 1.37], [-2.2, 1.56], [-2.42, 1.56], [-2.42, 1.37], [X_BORE0, 1.37], [X_BORE0, 0]], calM, calCut); housing.position.y = CY; bodyG.add(housing);
    bodyG.add(slab([[X_BORE0 - 0.5, CY + 1.8], [X_BORE0 - 0.5, CY + 2.75], [X_FING + 0.62, CY + 2.75], [X_FING + 0.62, -0.2], [X_FING, -0.2], [X_FING, CY + 1.95], [X_MOUTH, CY + 1.95], [X_MOUTH, CY + 1.8]], 2.6, calM, 0));
    const inlet = shade(rod(X_BORE0 - 1.6, X_BORE0 - 0.5, 0.2, 0.2, steel(0xc0a060))); inlet.position.y = CY; bodyG.add(inlet);
    // the seal: its back half as a ring, and its cut faces as two little squares that shear
    const sealRing = cutX([[-2.4, 1.37], [-2.4, 1.55], [-2.22, 1.55], [-2.22, 1.37]], rubber(0x0c0d10), null); sealRing.position.y = CY; bodyG.add(sealRing);
    const sealCaps = [1, -1].map((sg) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0x111317 })); m.matrixAutoUpdate = false; m.userData.sg = sg; bodyG.add(m); return m; });
    const sealGlow = [1, -1].map((sg) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 20), M.glow(hex(COL.force))); m.position.set(-2.31, CY + sg * 1.46, 0.02); bodyG.add(m); return m; });
    // slide pin on the fixed carrier
    const carrier = slab([[-4.6, -1.9], [-4.6, -1.2], [-1.9, -1.2], [-1.9, -1.9]], 2.6, M.matte(0x2a2e37), -0.2); D.add(carrier);
    const pinD = shade(rod(-4.9, -0.9, 0.17, 0.17, steel())); pinD.position.set(pinD.position.x, -1.0, -1.3); D.add(pinD);
    bodyG.add(slab([[-3.9, -1.25], [-3.9, CY - 1.85], [-2.9, CY - 1.85], [-2.9, -1.25]], 0.9, calM, -0.85));
    const piston = cutX([[0, 0], [0, 1.35], [2.2, 1.35], [2.2, 1.1], [0.3, 1.1], [0.3, 0]], steel(0xd5d9e0), cutMat(0xe6e9ef)); piston.position.y = CY; D.add(piston);
    const fl = fluidMat(0xe0b23a, 0.6), fluid = rod(0, 1, 1.33, 1.33, fl, 32); fluid.position.y = CY; D.add(fluid);
    const padM = M.matte(0x4a3b2c), backM = steel(0x7d838e);
    const mkPad = (sgn) => { const g = new THREE.Group(); const lin = box(1, 2.5, 3.6, padM); const bk = box(0.25, 2.7, 3.8, backM); g.add(lin, bk); g.lin = lin; g.bk = bk; g.sgn = sgn; g.position.y = 0.95; D.add(shade(g)); return g; };
    const padIn = mkPad(-1), padOut = mkPad(1);
    const aIn = arrow(hex(COL.out), 1, 0.45, 0.12), aOut = arrow(hex(COL.out), 1, 0.45, 0.12), aBody = arrow(hex(COL.force), 1, 0.35, 0.09); aIn.rotation.z = -Math.PI / 2; aOut.rotation.z = Math.PI / 2; aBody.rotation.z = Math.PI / 2; D.add(aIn, aOut, aBody);
    const ld = {
      seal: L('Square seal', [-2.3, CY + 2.0, 0.5], bodyG, 'hot', COL.force), pist: L('Piston, 54 mm', [-3.0, CY - 0.2, 1.5], D), body: L('Caliper body slides', [-1.5, CY + 3.3, 0], bodyG),
      pads: L('', [0, -1.0, 2.2], D), rot: L('Ventilated disc', [0.3, -2.6, 3.4], D), pin: L('Slide pin on the fixed carrier', [-3.5, -2.5, 0], D), sq: L('', [2.2, CY + 3.9, 0], D, 'hot', COL.out),
      fluid: L('Fluid in', [X_BORE0 - 1.9, CY + 0.7, 0], bodyG),
    };
    // ================================================================ DRUM (seen from outside, its face cut away)
    const R = new THREE.Group(); R.position.y = 6.2; root.add(R);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(5.7, 5.7, 0.16, 48), M.matte(0x23262c)); plate.rotation.x = Math.PI / 2; plate.position.z = -1.0; R.add(plate);
    const drumG = new THREE.Group(); R.add(drumG);
    const drumM = iron(0x7c818b, { emissive: 0x000000 });
    drumG.add(ringZ(5.0, 5.55, -0.85, 0.85, drumM));
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, f = box(0.34, 0.16, 1.7, iron(0x62676f)); f.position.set(Math.cos(a) * 5.62, Math.sin(a) * 5.62, 0); f.rotation.z = a; drumG.add(f); }
    const hubD = new THREE.Group(); R.add(hubD);
    hubD.add(latheZ([[-0.9, 0], [-0.9, 1.5], [0.5, 1.5], [0.5, 0.7], [1.1, 0.7], [1.1, 0]], iron(0x5d626b)));
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.5, st = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 10), steel()); st.rotation.x = Math.PI / 2; st.position.set(Math.cos(a) * 1.1, Math.sin(a) * 1.1, 0.75); hubD.add(st); }
    // anchor block at the bottom, wheel cylinder at the top
    const PIVY = -4.0, CYL_Y = 4.0;
    const anchor = box(2.4, 0.9, 1.4, iron(0x4d5159)); anchor.position.set(0, PIVY, -0.2); R.add(anchor);
    const wc = new THREE.Group(); wc.position.set(0, CYL_Y, 0); R.add(wc);
    wc.add(cutX([[-1.1, 0.42], [-1.1, 0.72], [1.1, 0.72], [1.1, 0.42]], iron(0x8e949e), cutMat(0xc9a34d)));
    const wcFluid = rod(0, 1, 0.4, 0.4, fluidMat(0xe0b23a, 0.6), 20); wc.add(wcFluid);
    const wcP = [-1, 1].map((sg) => { const p = shade(rod(0, 0.55, 0.41, 0.41, steel(0xd5d9e0), 20)); p.userData.sg = sg; wc.add(p); const pr = shade(rod(0, 0.5, 0.1, 0.1, steel())); p.userData.pr = pr; wc.add(pr); return p; });
    // shoes: a T-section rim with its lining, pivoting about the anchor
    const mkShoe = (sg) => {
      const piv = new THREE.Group(); piv.position.set(sg * 0.75, PIVY, 0); R.add(piv);
      const g = new THREE.Group(); g.position.set(-sg * 0.75, -PIVY, 0); piv.add(g);
      const a0 = sg < 0 ? Math.PI * 0.63 : -Math.PI * 0.37, len = Math.PI * 0.74;   // the arc this shoe covers
      const o = { phiStart: a0 + Math.PI / 2, phiLength: len, seg: 40 };
      // latheZ sweeps from +y by phi towards +x after its turn; we want plain angles, so build and spin
      const arc = (r0, r1, z0, z1, mat, st = a0, ln = len) => { const m = ringZ(r0, r1, z0, z1, mat, { phiStart: 0, phiLength: ln, seg: 40 }); m.rotation.z = st + Math.PI / 2; m.material.side = THREE.DoubleSide; return m; };
      void o;
      g.add(arc(4.55, 4.74, -0.62, 0.62, steel(0x8a909c)), arc(3.75, 4.56, -0.09, 0.09, steel(0x767c87)));
      const lining = arc(4.74, 4.99 - 0.1, -0.6, 0.6, M.matte(0x4a3b2c), a0 + 0.14, len - 0.28); g.add(lining);
      return { piv, g, sg };
    };
    const shoes = [mkShoe(-1), mkShoe(1)];
    const retSpring = spring(0, 1, 0.16, 0.035, 9, steel(0x9aa1ad)); retSpring.position.y = 3.0; retSpring.position.z = 0.35; R.add(retSpring);
    const strut = shade(rod(-3.3, 3.3, 0.12, 0.12, steel(0x6d7380))); strut.position.y = 2.2; strut.position.z = -0.35; R.add(strut);
    const hbPiv = new THREE.Group(); hbPiv.position.set(3.3, 2.9, -0.45); R.add(hbPiv);
    hbPiv.add(shade(beam([0, 0, 0], [-0.5, -5.2, 0], 0.13, steel(0xc0a060))));
    const cable = shade(beam([0, 0, 0], [1, 0, 0], 0.06, M.matte(0x9aa1ad))); R.add(cable);
    const mkA = (col, r = 0.11) => { const a = arrow(hex(col), 1, 0.45, r); R.add(a); return a; };
    const aTip = [mkA(COL.force), mkA(COL.force)], aDrag = [mkA(COL.out, 0.14), mkA(COL.out, 0.14)], aSpin = mkA(COL.d, 0.07);
    const spinArc = new THREE.Mesh(new THREE.TorusGeometry(6.35, 0.07, 6, 40, 0.9), M.glow(hex(COL.d))); spinArc.position.z = 0.2; R.add(spinArc);
    const lr = {
      s0: L('', [-6.3, -1.2, 0.8], R, 'hot', COL.out), s1: L('', [6.3, 1.0, 0.8], R, 'hot', COL.out), wc: L('', [0, CYL_Y + 1.35, 0.5], R, 'hot', COL.force),
      anchor: L('Anchor: the shoes pivot here', [0, PIVY - 1.0, 0.8], R), drum: L('Drum turns with the wheel', [7.2, 3.6, 0.9], R), spring: L('Return spring', [0, 3.0 - 0.75, 0.8], R),
      hb: L('Handbrake lever and cable', [3.9, -1.9, 0.3], R),
    };
    // ================================================================ chart: brake factor against friction
    let S = { kind: 'disc', P: 31, mu: 0.38, hand: false };
    const bd = board(root, 7.4, 5.4, 740, 540, (g, w, h) => {
      panelBg(g, w, h);
      title(g, 'Drag you get per newton of push', 'brake factor against lining friction', 27);
      const A = axes(g, w, h, { xMin: 0.2, xMax: 0.6, yMax: 5, xTicks: [0.2, 0.3, 0.4, 0.5, 0.6], yTicks: [0, 1, 2, 3, 4, 5], xLabel: 'friction of the lining, μ', y1: 110, font: 21 });
      const xs = Array.from({ length: 41 }, (_, i) => 0.2 + i * 0.01);
      line(g, xs.map((m) => [m, 2 * m]), A.X, A.Y, COL.d, 5);
      line(g, xs.map((m) => [m, Math.min(5.2, shoeFactors(m).total)]), A.X, A.Y, COL.P, 5);
      text(g, 'disc: 2μ', A.X(0.47), A.Y(0.62), COL.d, 'bold 22px sans-serif'); text(g, 'drum', A.X(0.4), A.Y(2.75), COL.P, 'bold 22px sans-serif');
      const m = S.mu, fd = 2 * m, fr = shoeFactors(m).total;
      dot(g, A.X(m), A.Y(fd), COL.d, 10); dot(g, A.X(m), A.Y(Math.min(5, fr)), COL.P, 10);
      const m2 = m * 0.8, lossD = 20, lossR = Math.round(100 * (1 - shoeFactors(m2).total / fr));
      text(g, `Friction down a fifth: disc −${lossD}%, drum −${lossR}%`, 26, h - 14, COL.text, '21px sans-serif');
    }, [8.2, 9.2, -1]);
    const V = {
      wide: { disc: [[0.6, 9.0, 0], 25], drum: [[0.6, 10.2, 0], 29] },
      narrow: { disc: [[-0.6, 7.2, 0], 30], drum: [[0, 7.8, 0], 35] },
      tall: { disc: [[-0.5, 9.3, 0], 38], drum: [[0, 10.6, 0], 40] },
    };
    const frame = framer(stage, (mode, key) => { const [t, DD] = V[mode][key]; return fitView(stage, t, key === 'disc' ? [0.14, 0.16, 1] : [0.12, 0.1, 1], DD); });
    let Ps = 0, gap = GAP, twist = 0, key = '', ang = 0, hbA = 0, t = 0, wearS = 0;
    const m4 = new THREE.Matrix4();
    const setArrow = (a, x, y, dx, dy, len) => { a.position.set(x, y, 1.1); a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, 0).normalize()); a.set(len); a.visible = len > 0.12; };
    return {
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt); S = s; t += dt;
        const mode = frame(s.kind), isDisc = s.kind === 'disc';
        fitNarrow(stage, [ld.pin, ld.rot, ld.body, ld.fluid, ld.pist, lr.anchor, lr.drum, lr.spring, lr.hb]);
        D.visible = isDisc; R.visible = !isDisc;
        Object.values(ld).forEach((l) => { l.element.style.display = isDisc ? '' : 'none'; }); Object.values(lr).forEach((l) => { l.element.style.display = isDisc ? 'none' : ''; });
        if (mode === 'tall') bd.put(isDisc ? [-0.5, 16.2, 0] : [0, 18.4, 0], 1.75); else if (mode === 'narrow') bd.put([0, -40, 0], 1); else bd.put(isDisc ? [6.6, 14.0, -2] : [7.4, 16.6, -2], 0.9);
        Ps = approach(Ps, s.P, 9, dt); wearS = approach(wearS, s.wear, 6, dt);
        if (isDisc) {
          const r = disc({ ...s, P: Ps }), on = Ps > 0.5;
          gap = approach(gap, on ? 0 : GAP, 12, dt);
          const lin = LIN * (1 - 0.8 * wearS), w = LIN - lin, d = GAP - gap;
          // pads: lining faces the disc, backing behind it
          for (const p of [padIn, padOut]) { const sg = p.sgn; p.lin.scale.x = lin; p.lin.position.x = sg * (HT + gap + lin / 2); p.bk.position.x = sg * (HT + gap + lin + 0.125); }
          const pistFront = -(HT + gap + lin + 0.25);
          piston.position.x = pistFront - 2.2;
          bodyG.position.x = -(w + d);                                       // the body follows the outer pad
          const bore0 = X_BORE0 + bodyG.position.x;
          fluid.scale.x = Math.max(0.01, piston.position.x - bore0); fluid.position.x = (piston.position.x + bore0) / 2;
          fl.emissiveIntensity = 0.2 + 0.8 * clamp(Ps / 80, 0, 1);
          // seal twist: its inner edge follows the piston for the first 0.3 mm, then the piston slips through
          twist = approach(twist, on ? 1 : 0, 12, dt);
          sealCaps.forEach((m) => { const sg = m.userData.sg; m4.set(1, -sg * 0.75 * twist, 0, -2.31, 0, 1, 0, CY + sg * 1.46, 0, 0, 1, 0.012, 0, 0, 0, 1); m.matrix.copy(m4); });
          sealGlow.forEach((m) => { m.material.opacity = 1; m.visible = true; });
          const la = 0.5 + 2.2 * clamp(r.F / 18000, 0, 1);
          aIn.position.set(pistFront - 2.4 - la - 2.6, CY, 1.9); aIn.set(la); aOut.position.set(X_FING + 0.62 + bodyG.position.x + la + 0.3, CY, 1.9); aOut.set(la);
          aBody.position.set(X_BORE0 - 0.5 + bodyG.position.x - 0.2, CY + 2.3, 1.5); aBody.set(0.4 + la * 0.5);
          aIn.visible = aOut.visible = aBody.visible = r.F > 200;
          rotor.rotation.z -= dt * 4 * (1 - clamp(r.T / 900, 0, 0.94));
          
          ld.pads.element.innerHTML = `Pads: <b>${r.left.toFixed(1)} mm</b> of lining left`;
          ld.sq.element.innerHTML = on ? `Each pad pressed with <b>${fmtF(r.F)}</b>` : 'Released: pads 0.3 mm clear';
          ld.seal.element.textContent = on ? 'Square seal: twisted' : 'Square seal: pulls the piston back';
        } else {
          const r = drum({ ...s, P: Ps }), on = r.F > 30, fwd = s.dir === 'fwd';
          gap = approach(gap, on ? 0 : GAP, 12, dt);
          const phi = (GAP - gap) / 8 + 0.004;
          shoes.forEach((sh) => { sh.piv.rotation.z = -sh.sg * phi; });
          const tipX = 1.35 + (GAP - gap) * 1.0;
          wcP.forEach((p) => { const sg = p.userData.sg; p.position.x = sg > 0 ? tipX - 0.95 : -(tipX - 0.95) - 0.55; p.userData.pr.position.x = sg > 0 ? tipX - 0.4 : -(tipX - 0.4) - 0.5; });
          wcFluid.scale.x = Math.max(0.01, 2 * (tipX - 0.95)); wcFluid.position.x = 0;
          wcFluid.material.emissiveIntensity = 0.2 + 0.8 * clamp(Ps / 80, 0, 1);
          retSpring.scale.x = 2 * (tipX + 0.75); retSpring.position.x = -(tipX + 0.75);
          hbA = approach(hbA, s.hand ? 0.09 : 0, 8, dt); hbPiv.rotation.z = -hbA;
          const cx = 3.3 - 0.5 * Math.cos(hbA) - 5.2 * Math.sin(hbA), cyy = 2.9 - 5.2 * Math.cos(hbA) + 0.5 * Math.sin(hbA);
          cable.position.set((cx - 6.5) / 2 + 0, cyy, -0.45); cable.scale.y = Math.abs(cx + 6.5); cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0));
          const sp = (fwd ? 1 : -1) * 3.2 * (1 - clamp(r.T / 700, 0, 1));
          ang += sp * dt; drumG.rotation.z = ang; hubD.rotation.z = ang;
          spinArc.rotation.z = fwd ? 0.35 : 0.35; aSpin.visible = true;
          const ea = fwd ? 0.35 + 0.9 : 0.35, ex = Math.cos(ea) * 6.35, ey = Math.sin(ea) * 6.35;
          setArrow(aSpin, ex, ey, fwd ? -Math.sin(ea) : Math.sin(ea), fwd ? Math.cos(ea) : -Math.cos(ea), 0.6); aSpin.position.z = 0.2;
          // forces: the wheel cylinder pushes both tips out; the drum drags each shoe the way it turns
          const lt = 0.4 + 1.6 * clamp(r.F / 4000, 0, 1);
          setArrow(aTip[0], -1.6, CYL_Y + 0.9, -1, 0, on ? lt : 0); setArrow(aTip[1], 1.6, CYL_Y + 0.9, 1, 0, on ? lt : 0);
          const dragL = fwd ? r.lead : r.trail, dragR = fwd ? r.trail : r.lead, kd = (v) => (on ? 0.5 + 3.4 * clamp(v / 6000, 0, 1) : 0);
          const dir = fwd ? 1 : -1;
          setArrow(aDrag[0], -5.9, dir * kd(dragL) / 2, 0, -dir, kd(dragL)); setArrow(aDrag[1], 5.9, -dir * kd(dragR) / 2, 0, dir, kd(dragR));
          
          const nameL = fwd ? 'Leading' : 'Trailing', nameR = fwd ? 'Trailing' : 'Leading';
          const fx = (v) => (isFinite(v) && v < 25 ? '× ' + v.toFixed(2) : 'locks');
          lr.s0.element.innerHTML = `${nameL} shoe: drag <b>${fmtF(dragL)}</b> (${fx(fwd ? r.sf.lead : r.sf.trail)})`;
          lr.s1.element.innerHTML = `${nameR} shoe: drag <b>${fmtF(dragR)}</b> (${fx(fwd ? r.sf.trail : r.sf.lead)})`;
          lr.wc.element.innerHTML = s.hand && r.hand >= s.P * BAR * A_W ? `Handbrake lever spreads the shoes: <b>${fmtF(r.F)}</b> each` : `Wheel cylinder pushes each tip with <b>${fmtF(r.F)}</b>`;
        }
        const kk = `${s.kind}|${s.mu}|${mode}`; if (kk !== key) { key = kk; bd.redraw(); }
      },
      readout(s) {
        if (s.kind === 'disc') {
          const r = disc(s);
          return rows(`${s.P} bar squeezes with ${fmtF(r.F)}`, [
            ['Drag on the disc, 2 × μ × squeeze', fmtF(r.drag), COL.out],
            ['Braking torque (at 105 mm)', fmt0(r.T) + ' N·m', COL.out],
            ['Brake factor, 2μ', r.factor.toFixed(2), COL.d],
            ['Lining left', r.left.toFixed(1) + ' mm', r.left < 3 ? COL.bad : COL.text],
            ['Piston out, fluid taken in', r.out.toFixed(0) + ' mm, ' + r.vol.toFixed(0) + ' cm³'],
          ], s.wear > 0.85 ? 'At about 2 mm the pads are due: many have a metal tab that squeals on the disc as a warning.' : 'One front brake. The pad gap is drawn 8 times too big.', 3);
        }
        const r = drum(s), lock = !isFinite(r.sf.lead) || r.sf.lead > 25;
        return rows(lock ? 'The leading shoe jams' : `Drum drag: ${fmtF(r.lead + r.trail)}`, [
          ['Push on each shoe tip', fmtF(r.F), COL.force],
          ['Leading shoe multiplies by', lock ? 'no limit' : r.sf.lead.toFixed(2), COL.out],
          ['Trailing shoe multiplies by', r.sf.trail.toFixed(2), COL.out],
          ['Brake factor (disc at this μ: ' + (2 * s.mu).toFixed(2) + ')', lock ? 'runaway' : r.sf.total.toFixed(2), COL.P],
          ['Braking torque', fmt0(r.T) + ' N·m'],
          ...(s.hand ? [['Handbrake holds the car on up to', fmt0(Math.min(r.slope, 60)) + '% slope', COL.d]] : []),
        ], s.hand ? '200 N on the lever, 7 : 1, shared by two drums, then 5 : 1 inside each, if the tyres grip. The rule for cars asks for a 20% slope.' : 'One rear brake. Leading shoe: μh ÷ (a − μc). Trailing: μh ÷ (a + μc).', 4);
      },
    };
  },
};
