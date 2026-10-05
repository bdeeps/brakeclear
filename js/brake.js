// Shared parts for BrakeClear: the car and its hydraulic numbers, the foot-to-pad force chain, drum
// shoe factors, brake heat, brake fluid, the tyre slip curve and the ABS wheel simulation, plus the
// 3D pieces (rotor, drum, caliper, wheel, cut-away lathes), chart boards and layout helpers.
// Scene axes: +x is the way the car drives, +y is up, +z is the car's right-hand side.
import { THREE, M, box, clamp, lerp, smooth, approach } from './kit.js';

export const G = 9.81, KMH = 3.6, BAR = 1e5, TAU = Math.PI * 2;
export const areaD = (d) => (Math.PI * d * d) / 4;

// ---------------------------------------------------------------- the car
// A generic small hatchback, the kind most common on Indian roads (no one model): 1,200 kg with
// people in it, wheelbase 2.45 m, centre of mass 0.55 m above the road, 60% of the weight on the
// front axle at rest (front engine, front-wheel drive), tyre rolling radius 0.30 m.
// Drag area CdA 0.65 m² and rolling resistance 0.012 are typical small-car values (Bosch
// Automotive Handbook, "Motor-vehicle dynamics").
export const CAR = { m: 1200, L: 2.45, h: 0.55, front: 0.6, rTyre: 0.3, CdA: 0.65, crr: 0.012, track: 1.5 };
// Tyre-to-road grip used for whole-car stopping distances: the round figures of road-safety texts
// (dry asphalt about 0.8, wet 0.5, loose gravel 0.35). FrictionClear uses the same ones.
export const ROAD = { dry: { name: 'Dry', mu: 0.8 }, wet: { name: 'Wet', mu: 0.5 }, gravel: { name: 'Gravel', mu: 0.35 } };

export const keJ = (m, kmh) => 0.5 * m * (kmh / KMH) ** 2;                 // kinetic energy, joules
export const brakeDist = (kmh, a) => (kmh / KMH) ** 2 / (2 * Math.max(a, 1e-6)); // v² ÷ 2a, metres
// Weight transfer: braking at a (m/s²) moves m·a·h ÷ L of load from the rear axle to the front.
// Front share of the weight = static share + (a ÷ g)(h ÷ L).
export const frontShare = (a) => clamp(CAR.front + (a / G) * (CAR.h / CAR.L), 0, 1);
// UK Highway Code, Rule 126 "typical stopping distances": thinking distance is 1 foot per mph and
// braking distance mph² ÷ 20 feet (20 mph: 6 m + 6 m; 70 mph: 21 m + 75 m). That is a 0.68 s
// thinking time and a steady 6.6 m/s² on a dry road.
export function highwayCode(kmh) {
  const mph = kmh / 1.609344;
  return { think: mph * 0.3048, brake: (mph * mph / 20) * 0.3048 };
}
export const T_THINK = 0.68;

// ---------------------------------------------------------------- foot to pad
// Typical small-car sizes (maker service data and brake-design texts: Limpert, "Brake Design and
// Safety"; Bosch Automotive Handbook; they vary by model):
//   pedal lever 4 : 1; single-diaphragm 8-inch vacuum servo, boost ratio 3 (output ÷ input), working
//   area about 280 cm², engine vacuum about 0.7 bar below the air outside, so it can add at most
//   0.7 bar × 280 cm² = 1,960 N (its "knee point"); tandem master cylinder 22.2 mm (7/8 in);
//   front: floating caliper, one 54 mm piston, pads at 105 mm effective radius, pad friction 0.38;
//   rear: 200 mm drum, 19.05 mm (3/4 in) wheel cylinder, leading and trailing shoe.
// Return springs and seal friction (a few tens of newtons) are left out.
export const HYD = {
  pedal: 4, boost: 3, aServo: 0.028, vac: 0.7 * BAR,
  dMaster: 0.0222, dCal: 0.054, rEff: 0.105, mu: 0.38,
  dWheel: 0.01905, rDrum: 0.1,
  takeUp: 2.3e-6,          // m³ of fluid to close the pad and shoe clearances (0.3 mm at the pads, 1 mm at the shoes)
  comply: 0.035e-6,        // m³ per bar: hoses swell, seals and calipers flex (about 3.5 cm³ at 100 bar)
  deadStroke: 0.015,       // m of master-cylinder travel lost when one circuit is empty
};
export const A_M = areaD(HYD.dMaster), A_C = areaD(HYD.dCal), A_W = areaD(HYD.dWheel);

// Drum brake, leading and trailing shoe (the lumped textbook model: Heisler, "Advanced Vehicle
// Technology"; Limpert). Each shoe pivots on an anchor. The wheel cylinder pushes its tip with force
// F at height h above the pivot. The drum presses back with N at arm a, and the drag μN acts at arm
// c. Moments about the pivot: leading shoe N·a = F·h + μN·c (the drag pulls it in harder);
// trailing shoe N·a = F·h − μN·c (the drag pushes it off). Shoe factor = drag ÷ F.
// For a 200 mm drum: h = 160 mm, a = 80 mm, c = 90 mm.
export const SHOE = { h: 0.16, a: 0.08, c: 0.09 };
export function shoeFactors(mu) {
  const d = SHOE.a - mu * SHOE.c;
  const lead = d <= 0.004 ? Infinity : (mu * SHOE.h) / d, trail = (mu * SHOE.h) / (SHOE.a + mu * SHOE.c);
  return { lead, trail, total: lead + trail, lock: SHOE.a / SHOE.c };
}

// The whole chain. F: foot force (N). vac: is the servo fed with vacuum. fail: 'none' | 'c1' | 'c2'.
// Circuits are split diagonally: circuit 1 feeds front-left and rear-right, circuit 2 front-right and rear-left.
export function chain(F, { vac = true, fail = 'none', mu = HYD.mu, vacLevel = HYD.vac } = {}) {
  const rodIn = F * HYD.pedal;
  const assistMax = vac ? vacLevel * HYD.aServo : 0;
  const assist = Math.min((HYD.boost - 1) * rodIn, assistMax);
  const rodOut = rodIn + assist;
  const P = rodOut / A_M;                                   // the secondary piston floats, so both circuits see the same pressure
  const P1 = fail === 'c1' ? 0 : P, P2 = fail === 'c2' ? 0 : P;
  const sf = shoeFactors(mu);
  const front = (p) => { const clampF = p * A_C, drag = 2 * mu * clampF, torque = drag * HYD.rEff; return { P: p, clampF, drag, torque, road: torque / CAR.rTyre }; };
  const rear = (p) => { const shoe = p * A_W, drag = Math.min(sf.total, 12) * shoe, torque = drag * HYD.rDrum; return { P: p, shoe, drag, torque, road: torque / CAR.rTyre }; };
  const w = { fl: front(P1), rr: rear(P1), fr: front(P2), rl: rear(P2) };
  const frontF = w.fl.road + w.fr.road, rearF = w.rl.road + w.rr.road, total = frontF + rearF;
  const vol = F > 0 ? (HYD.takeUp + HYD.comply * (P / BAR)) * (fail === 'none' ? 1 : 0.5) : 0;
  const stroke = vol / A_M + (fail !== 'none' && F > 0 ? HYD.deadStroke * smooth(F / 30) : 0);
  return { F, rodIn, assist, assistMax, rodOut, P, P1, P2, w, frontF, rearF, total, a: total / CAR.m, knee: assistMax / ((HYD.boost - 1) * HYD.pedal), stroke, travel: stroke * HYD.pedal, saturated: vac && assist >= assistMax - 1e-6 && F > 0, sf };
}
// The foot force needed for a given deceleration (inverse of chain, by bisection).
export function footFor(a, o = {}) {
  let lo = 0, hi = 2500;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (chain(m, o).a < a) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------- heat
// Front rotor: ventilated cast iron, 256 mm across and 22 mm thick, about 5.0 kg; specific heat of
// grey cast iron about 500 J/kg·K (460 to 540 over the working range). About 90% of the heat made at a disc
// brake goes into the rotor and 10% into the pads (Limpert). One front brake takes its share of the
// fixed hydraulic split (39% of the car's braking each, see chain()).
// Cooling, a simple lumped model: moving air carries away (3 + 0.9 v) W per kelvin (v in m/s), which
// gives a cooling time constant of about 2.5 minutes at 60 km/h, as brake-test cool-down curves
// show; plus radiation ε σ A (T⁴ − Tair⁴) with ε = 0.55 (machined then rusted iron) and A = 0.1 m².
export const ROTOR = { m: 5.0, c: 500, toRotor: 0.9, eps: 0.55, A: 0.1 };
export const SIGMA = 5.67e-8;
export const coolW = (T, Tair, v) => (3 + 0.9 * v) * (T - Tair) + ROTOR.eps * SIGMA * ROTOR.A * ((T + 273.15) ** 4 - (Tair + 273.15) ** 4);
export function frontBrakeShare() { const c = chain(100); return c.w.fl.road / c.total; }
// Pad friction against temperature: a typical organic (NAO) road pad holds about 0.38 to 0.42 up to
// roughly 300 °C, then the resin binder starts to break down and gas, and μ falls ("fade"). The
// curve is a simple fit to published fade-test shapes (SAE J661 style charts), not one maker's pad.
export function padMu(T) {
  const pts = [[0, 0.38], [150, 0.41], [300, 0.4], [380, 0.34], [450, 0.28], [550, 0.21], [700, 0.15]];
  if (T <= 0) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (T <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((y1 - y0) * (T - x0)) / (x1 - x0); }
  return 0.15;
}
// Brake fluid: minimum boiling points from US standard FMVSS 116 (49 CFR 571.116), the "DOT" grades.
// Dry: fresh from a sealed tin. Wet: after it has soaked up about 3.7% water, as glycol fluid does
// over a couple of years through hoses and seals.
export const FLUID = {
  dot3: { name: 'DOT 3', dry: 205, wet: 140 },
  dot4: { name: 'DOT 4', dry: 230, wet: 155 },
  dot51: { name: 'DOT 5.1', dry: 260, wet: 180 },
};
// The fluid in the caliper runs far cooler than the rotor: heat reaches it through the pad, its
// backing plate and the piston. We take 30% of the rotor's rise above the air, lagging by about
// two minutes (a rough allowance; mountain-descent tests show caliper fluid at 150 to 200 °C with
// rotors at 500 to 600 °C).
export const FLUID_SHARE = 0.3, FLUID_LAG = 120;
// Engine braking with the throttle shut: the engine is driven by the wheels and soaks up power as
// friction and pumping. Motored mean effective pressure of a small petrol engine: about
// (1.5 + 0.4 × rpm ÷ 1000) bar (Heywood, "Internal Combustion Engine Fundamentals", ch. 13).
// Torque = MEP × swept volume ÷ 4π. A 1.2 litre engine; a typical 5-speed box (3.55, 1.90, 1.28,
// 0.97, 0.76) with a 4.1 final drive.
export const GEARS = { 0: 0, 2: 1.9, 3: 1.28, 5: 0.76 }, FINAL = 4.1, ENGINE_L = 1.2e-3;
export function engineBrake(gear, v) {
  const ratio = (GEARS[gear] || 0) * FINAL;
  if (!ratio) return { rpm: 800, F: 0, P: 0 };
  const rpm = (v / (TAU * CAR.rTyre)) * 60 * ratio;
  const mep = (1.5 + 0.4 * rpm / 1000) * BAR, T = (mep * ENGINE_L) / (4 * Math.PI);
  const F = (T * ratio) / CAR.rTyre;
  return { rpm, F, P: F * v };
}
// Power the brakes must turn into heat to hold a steady speed down a slope (watts).
export function descentPower(m, slopePct, v, gear) {
  const th = Math.atan(slopePct / 100);
  const grav = m * G * Math.sin(th) * v, roll = CAR.crr * m * G * Math.cos(th) * v, aero = 0.5 * 1.2 * CAR.CdA * v ** 3;
  const eng = engineBrake(gear, v);
  return { grav, roll, aero, eng: eng.P, rpm: eng.rpm, brakes: Math.max(0, grav - roll - aero - eng.P) };
}

// ---------------------------------------------------------------- tyre grip and ABS
// Tyre friction against slip: Burckhardt's model μ(s) = c1 (1 − e^(−c2 s)) − c3 s, with his
// published coefficients (M. Burckhardt, "Fahrwerktechnik: Radschlupf-Regelsysteme", 1993; as tabled
// in Kiencke and Nielsen, "Automotive Control Systems"). Slip s = (car speed − wheel rim speed) ÷ car
// speed: 0 is rolling freely, 1 is locked.
export const SURF = {
  dry: { name: 'Dry asphalt', c: [1.2801, 23.99, 0.52] },
  wet: { name: 'Wet asphalt', c: [0.857, 33.822, 0.347] },
  snow: { name: 'Snow', c: [0.1946, 94.129, 0.0646] },
};
export const muSlip = (s, surf) => { const [c1, c2, c3] = SURF[surf].c; return Math.max(0, c1 * (1 - Math.exp(-c2 * s)) - c3 * s); };
export function muPeak(surf) { let best = { s: 0, mu: 0 }; for (let s = 0; s <= 1; s += 0.002) { const m = muSlip(s, surf); if (m > best.mu) best = { s, mu: m }; } return best; }
// One wheel carrying a quarter of the car: 300 kg, so 2,943 N on the tyre (weight transfer left
// out). Wheel, tyre and rotor together: moment of inertia about 1.0 kg·m². Brake torque per pascal
// from the front brake above: 2 μ A_c r_eff. The driver stamps on the pedal: line pressure ramps to
// 120 bar at 600 bar/s. Steering turns the wheel by a small angle δ (at most 5°, steered towards
// the next lane, starting 0.3 s after the brakes go on). The contact patch then slides over the road at (v − ωr) along the car and
// (v_y − ωr δ) across it, and friction μ(s_total) N pushes straight against that sliding. A locked
// wheel (ω = 0) slides exactly the way the car is moving whatever δ is: no steering force at all.
// ABS logic (after Bosch's published description of the control cycle, much simplified): hold
// the pressure when slip passes 14%, release it when slip passes 20%, hold again once the wheel
// spins back up, then re-apply in steps. Real units estimate the car's speed from all four wheel
// sensors; this model is told it. ABS stops regulating below about 7 km/h.
export const WHEEL = { m: 300, J: 1.0, r: CAR.rTyre, Kb: 2 * HYD.mu * A_C * HYD.rEff, Pmax: 120 * BAR, ramp: 600 * BAR };
export const ABSC = { hold: 0.14, release: 0.2, recover: 0.07, dump: 1400 * BAR, build: 260 * BAR, vMin: 2 };
export function makeAbs({ kmh = 80, surf = 'wet', abs = true, steer = false } = {}) {
  const N = WHEEL.m * G;
  const st = { t: 0, v: kmh / KMH, w: kmh / KMH / WHEEL.r, P: 0, x: 0, y: 0, vy: 0, phase: 'apply', slip: 0, mu: 0, Fx: 0, Fy: 0, alpha: 0, cycles: 0, lockT: 0, done: false, v0: kmh / KMH, surf, abs, steer, cut: false };
  const sub = (dt) => {
    if (st.done) return;
    const r = WHEEL.r;
    if (st.v <= 0.05) { st.v = 0; st.w = 0; st.done = true; st.Fx = st.Fy = 0; st.slip = 0; return; }
    const lam = clamp((st.v - st.w * r) / st.v, 0, 1);
    // steering demand: move one lane (3.5 m) sideways, then straighten
    st.alpha = st.steer && st.t > 0.3 ? clamp(0.07 * (3.5 - st.y) - 0.035 * st.vy, -0.09, 0.09) : 0;   // the driver turns the wheel 0.3 s after braking
    // the contact patch slides at (v − ωr, vy − ωr·δ): friction pushes straight against that
    const sy = (st.vy - st.w * r * st.alpha) / st.v, stot = Math.hypot(lam, sy);
    const mu = muSlip(stot, st.surf);
    st.Fx = stot > 1e-6 ? (N * mu * lam) / stot : 0;
    st.Fy = stot > 1e-6 ? (-N * mu * sy) / stot : 0;
    st.slip = lam; st.mu = mu;
    // pressure: the driver's ramp, cut back by the ABS valves
    const drv = Math.min(WHEEL.Pmax, WHEEL.ramp * st.t);
    if (st.abs && st.v > ABSC.vMin) {
      if (st.phase === 'apply') { st.P = Math.min(drv, st.P + (st.cycles ? ABSC.build : WHEEL.ramp) * dt); if (lam > ABSC.hold) st.phase = 'hold'; }
      else if (st.phase === 'hold') { if (lam > ABSC.release) { st.phase = 'release'; st.cycles++; } else if (lam < ABSC.recover) st.phase = 'apply'; }
      else { st.P = Math.max(0, st.P - ABSC.dump * dt); if (lam < ABSC.hold && st.w * r > st.wPrev * r) st.phase = 'hold'; }
    } else { st.P = Math.min(drv, st.P + WHEEL.ramp * dt); st.phase = 'apply'; st.cut = st.abs; }
    st.wPrev = st.w;
    // wheel: road force spins it up, brake torque slows it (a stopped wheel is held by the pads)
    const Tb = WHEEL.Kb * st.P, Troad = st.Fx * r;
    if (st.w <= 0 && Tb >= Troad) st.w = 0; else st.w = Math.max(0, st.w + ((Troad - Tb) / WHEEL.J) * dt);
    if (st.w * r > st.v) st.w = st.v / r;
    if (st.w <= 0.01) st.lockT += dt;
    st.v -= (st.Fx / WHEEL.m) * dt; st.vy += (st.Fy / WHEEL.m) * dt;
    st.x += Math.max(0, st.v) * dt; st.y += st.vy * dt; st.t += dt;
  };
  st.step = (dt) => { let left = dt; while (left > 1e-9 && !st.done) { const h = Math.min(left, 2e-4); sub(h); left -= h; } };
  return st;
}
// Run a whole stop at once and report it.
const runCache = new Map();
export function absRun(o) {
  const key = `${o.kmh}|${o.surf}|${o.abs}|${o.steer}`;
  if (runCache.has(key)) return runCache.get(key);
  const st = makeAbs(o);
  while (!st.done && st.t < 40) st.step(0.02);
  const res = { d: st.x, t: st.t, y: st.y, cycles: st.cycles, hz: st.cycles / Math.max(0.1, st.t), lockT: st.lockT, a: st.v0 ** 2 / (2 * Math.max(st.x, 0.01)) };
  if (runCache.size > 200) runCache.clear();
  runCache.set(key, res);
  return res;
}

// ---------------------------------------------------------------- air brakes and regeneration
// Truck air brake, a "type 30/30" double chamber (30 square inches = 193.5 cm² each side): the
// service chamber's diaphragm pushes the pushrod with pressure × area. Behind it, a strong spring
// (about 8 kN) is held squashed by air on a second diaphragm; it starts to come on when that air
// falls below 8,000 N ÷ 193.5 cm² = 4.1 bar (60 psi) and is fully on with the air gone. A slack
// adjuster 150 mm long turns the push into torque on the S-cam shaft. System pressure about 8 bar.
// (Sizes: the standard North American chamber types; US FMVSS 121 asks for a low-pressure warning
// at 60 psi. Typical figures, not one maker's.)
export const AIR = { A: 0.01935, spring: 8000, slack: 0.15, sys: 8 * BAR, warn: 4.1 * BAR };
export function airBrake(sysBar, pedal) {
  const Psys = sysBar * BAR, Pserv = Math.min(Psys, pedal * AIR.sys);
  const service = Pserv * AIR.A;
  const hold = Math.min(AIR.spring, Psys * AIR.A);          // how much of the spring the air is holding back
  const springF = AIR.spring - hold;
  const rodF = Math.max(service, springF);                  // an anti-compounding valve stops the two adding up
  return { Psys, Pserv, service, springF, rodF, camT: rodF * AIR.slack, released: springF <= 1 };
}
// Regenerative braking, a small electric car: the motor can brake with up to 45 kW and up to
// 0.25 g of deceleration (its torque limit), fades out below 10 km/h (too little voltage to
// charge with) and passes about 80% of what it takes to the battery (motor, inverter and battery
// losses). Friction brakes make up the rest of what the driver asks for ("blending").
export const EV = { m: 1400, Pmax: 45e3, aMax: 0.25 * G, vFade: 10 / KMH, eff: 0.8 };
export function regenSplit(aAsk, v, regenOn = true) {
  const fade = clamp(v / EV.vFade, 0, 1);
  const aMotor = regenOn ? Math.min(EV.aMax, v > 0.1 ? EV.Pmax / (EV.m * v) : EV.aMax) * fade : 0;
  const aRegen = Math.min(aAsk, aMotor);
  return { aRegen, aFric: aAsk - aRegen };
}
// A whole stop from kmh at a steady deceleration: joules to the battery and to heat.
export function regenStop(kmh, aAsk, regenOn = true) {
  let v = kmh / KMH, eB = 0, eH = 0, x = 0; const dt = 0.01;
  while (v > 0) { const r = regenSplit(aAsk, v, regenOn); eB += EV.m * r.aRegen * v * dt * EV.eff; eH += EV.m * (r.aFric * v + r.aRegen * v * (1 - EV.eff)) * dt; x += v * dt; v -= aAsk * dt; }
  return { eB, eH, x, total: keJ(EV.m, kmh) };
}

// ---------------------------------------------------------------- formats
export const fmt0 = (v) => Math.round(v).toLocaleString('en-IN');
export const fmt = (v, d = 1) => (Math.abs(v) >= 1000 ? fmt0(v) : v.toFixed(d));
export const fmtF = (f) => { const a = Math.abs(f); return a < 1000 ? fmt0(f) + ' N' : (f / 1000).toFixed(a < 10e3 ? 2 : 1) + ' kN'; };
export const fmtBar = (p) => { const b = p / BAR; return (b < 10 ? b.toFixed(1) : b.toFixed(0)) + ' bar'; };
export const fmtE = (j) => (j >= 1e6 ? (j / 1e6).toFixed(2) + ' MJ' : j >= 1000 ? fmt0(j / 1000) + ' kJ' : fmt0(j) + ' J');
export const fmtM = (m) => (m < 10 ? m.toFixed(1) : fmt0(m)) + ' m';
export const fmtG = (a) => (a / G).toFixed(2) + ' g';

export const COL = {
  force: '#ffb547', out: '#5ce1a9', P: '#ff7a59', c1: '#ff9a3d', c2: '#49c6ff', heat: '#ff5a2a', air: '#bfe0ff',
  grip: '#5ce1a9', bad: '#ff6b6b', good: '#5ce1a9', text: '#e8eef8', muted: 'rgba(255,255,255,.62)', regen: '#7be07b', d: '#6fb6ff', w: '#c49bff',
};
export const hex = (c) => new THREE.Color(c).getHex();

// ---------------------------------------------------------------- layout
export const inReel = () => document.body.classList.contains('gb-reel');
export const narrowScreen = () => window.innerWidth < 560 && !inReel();
export const aspectK = (stage) => Math.min(2.5, Math.max(1, 1.45 / Math.max(0.3, stage.camera.aspect)));
// A camera position that ends up at distance D from target along dir on any screen shape
// (stage.setView backs off on narrow stages; this undoes it so each layout picks its own distance).
export function fitView(stage, target, dir, D) {
  const k = aspectK(stage), d = new THREE.Vector3(...dir).normalize().multiplyScalar(D / k);
  return { pos: [target[0] + d.x, target[1] + d.y, target[2] + d.z], target };
}
// Picks the view for the screen shape: 'wide' (desktop and the 16:9 video), 'narrow' (a phone, with
// the readout over the top left) or 'tall' (the upright video). Call it every frame with a key.
export function framer(stage, pick) {
  let last = null;
  return (key = '') => {
    const mode = stage.host.clientWidth < 560 && !inReel() ? 'narrow' : stage.camera.aspect < 0.9 ? 'tall' : 'wide';
    const id = mode + '|' + key;
    if (id === last) return mode;
    const first = last === null; last = id;
    const v = pick(mode, key);
    if (v && (!stage.moved || !first)) stage.setView(v.pos, v.target, first ? 0.4 : 0.9);
    return mode;
  };
}
// On a phone: hide minor labels and slide the picture down, clear of the readout.
export function fitNarrow(stage, minor = [], y = -0.13) {
  const narrow = stage.host.clientWidth < 560 && !inReel();
  minor.forEach((l) => { if (l) l.visible = !narrow; });
  const sy = narrow ? y : 0;
  if (!stage.shift || stage.shift[1] !== sy) stage.setShift(0, sy);
  return narrow;
}
// A compact readout: a headline, rows, a note. On a phone only the first `keep` rows show.
export function rows(head, list, note = '', keep = 3, width = 300) {
  const nar = narrowScreen();
  return `<div style="max-width:${width}px"><div class="big">${head}</div>` + (nar ? list.slice(0, keep) : list).map(([a, b, col]) => `<div class="row"><span>${a}</span><b${col ? ` style="color:${col}"` : ''}>${b}</b></div>`).join('') + (note && !nar ? `<small>${note}</small>` : '') + '</div>';
}

// ---------------------------------------------------------------- boards (live charts in 3D)
export function panelBg(g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(8,10,16,.92)'; g.beginPath(); g.roundRect(0, 0, w, h, 22); g.fill(); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; g.stroke(); }
export function board(root, w, h, pxW, pxH, draw, pos, rotY = 0) {
  const c = document.createElement('canvas'); c.width = pxW; c.height = pxH;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const redraw = () => { draw(g, pxW, pxH); tex.needsUpdate = true; };
  redraw();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  mesh.position.set(...pos); mesh.rotation.y = rotY; mesh.renderOrder = 5; root.add(mesh);
  const b = { mesh, redraw };
  // put([x, y, z], scale, rotY): move the board for the current layout
  b.put = (p, s = 1, r = 0) => { mesh.position.set(...p); mesh.scale.setScalar(s); mesh.rotation.y = r; };
  return b;
}
export function title(g, text, sub = '', size = 30) {
  g.fillStyle = COL.text; g.font = `bold ${size}px sans-serif`; g.textAlign = 'left'; g.fillText(text, 26, size + 14);
  if (sub) { g.font = `${Math.round(size * 0.66)}px sans-serif`; g.fillStyle = COL.muted; g.fillText(sub, 26, size * 2 + 14); }
}
export function axes(g, w, h, { x0 = 96, x1 = w - 34, y0 = h - 74, y1 = 96, xMin = 0, xMax, yMin = 0, yMax, xTicks = [], yTicks = [], xFmt = String, yFmt = String, xLabel = '', yLabel = '', font = 22 }) {
  const X = (x) => x0 + ((x - xMin) / (xMax - xMin)) * (x1 - x0), Y = (y) => y0 - ((y - yMin) / (yMax - yMin)) * (y0 - y1);
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.fillStyle = 'rgba(255,255,255,.65)'; g.font = `${font}px sans-serif`; g.textAlign = 'left';
  for (const t of xTicks) { g.beginPath(); g.moveTo(X(t), y1); g.lineTo(X(t), y0); g.stroke(); const s = xFmt(t); g.fillText(s, X(t) - g.measureText(s).width / 2, y0 + font + 8); }
  for (const t of yTicks) { g.beginPath(); g.moveTo(x0, Y(t)); g.lineTo(x1, Y(t)); g.stroke(); const s = yFmt(t); g.fillText(s, x0 - 10 - g.measureText(s).width, Y(t) + font / 3); }
  g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0); g.lineTo(x1, y0); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.8)';
  if (xLabel) g.fillText(xLabel, x1 - g.measureText(xLabel).width, y0 + font * 2 + 14);
  if (yLabel) g.fillText(yLabel, x0 + 10, y1 - 12);
  return { X, Y, x0, x1, y0, y1 };
}
export function line(g, pts, X, Y, col, wdt = 5, dash = null) {
  if (pts.length < 2) return;
  g.strokeStyle = col; g.lineWidth = wdt; g.setLineDash(dash || []); g.lineJoin = 'round'; g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
  g.stroke(); g.setLineDash([]);
}
export function dot(g, x, y, col, r = 11) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); }
export function text(g, s, x, y, col = COL.text, font = '22px sans-serif', align = 'left') { g.fillStyle = col; g.font = font; g.textAlign = align; g.fillText(s, x, y); g.textAlign = 'left'; }
// A horizontal bar: label on the left, value text after the bar. k is 0…1 of the track.
export function hbar(g, x0, x1, y, hgt, k, col, label, value, font = 22) {
  g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x0, y, x1 - x0, hgt);
  g.fillStyle = col; g.fillRect(x0, y, Math.max(3, (x1 - x0) * clamp(k, 0, 1)), hgt);
  g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `${font}px sans-serif`; g.textAlign = 'left'; g.fillText(label, 26, y + hgt * 0.5 + font * 0.36);
  g.fillStyle = '#fff'; g.font = `bold ${font}px sans-serif`;
  const tw = g.measureText(value).width, tx = x0 + (x1 - x0) * clamp(k, 0, 1) + 10;
  g.fillText(value, tx + tw > x1 ? Math.max(x0 + 6, x0 + (x1 - x0) * clamp(k, 0, 1) - tw - 10) : tx, y + hgt * 0.5 + font * 0.36);
}
// A scrolling time series.
export function trace(max = 1400) {
  const T = [], V = [];
  return { T, V, push(t, ...v) { T.push(t); V.push(v); if (T.length > max) { T.shift(); V.shift(); } }, clear() { T.length = 0; V.length = 0; } };
}

// ---------------------------------------------------------------- 3D pieces
const DS = THREE.DoubleSide;
export const iron = (color = 0x8d929c, o = {}) => M.metal(color, { roughness: 0.5, metalness: 0.75, ...o });
export const steel = (color = 0xc9ced8, o = {}) => M.metal(color, { roughness: 0.3, ...o });
export const rubber = (color = 0x17191d) => M.matte(color);
export const cutMat = (color = 0xd9a441) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, side: DS });
export const fluidMat = (color = 0xe0b23a, opacity = 0.6) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.15, metalness: 0, depthWrite: false, emissive: color, emissiveIntensity: 0.25, side: DS });
export const shade = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

// Lathe about the Z axis from [z, r] pairs (a wheel's axle runs along z).
export function latheZ(profile, mat, { seg = 64, phiStart = 0, phiLength = TAU } = {}) {
  const g = new THREE.LatheGeometry(profile.map(([z, r]) => new THREE.Vector2(Math.max(0, r), z)), seg, phiStart, phiLength);
  g.rotateX(Math.PI / 2); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
  return m;
}
// A ring (washer) about Z: inner radius r0, outer r1, from z0 to z1.
export const ringZ = (r0, r1, z0, z1, mat, o) => latheZ([[z0, r0], [z0, r1], [z1, r1], [z1, r0], [z0, r0]], mat, o);
// A cut-away part turned about the X axis: the back half (z < 0) of the closed profile [x, r]…,
// with flat cut faces in the z = 0 plane so the wall thickness shows.
export function cutX(profile, mat, capMat, { seg = 40, full = false } = {}) {
  const grp = new THREE.Group();
  const g = new THREE.LatheGeometry(profile.map(([x, r]) => new THREE.Vector2(Math.max(0, r), x)), seg, full ? 0 : Math.PI / 2, full ? TAU : Math.PI);
  g.rotateZ(-Math.PI / 2); g.computeVertexNormals();
  const body = new THREE.Mesh(g, mat); body.material.side = DS; body.castShadow = true; body.receiveShadow = true; grp.add(body);
  if (!full && capMat) {
    for (const sgn of [1, -1]) {
      const sh = new THREE.Shape(profile.map(([x, r]) => new THREE.Vector2(x, sgn * Math.max(0, r))));
      const cap = new THREE.Mesh(new THREE.ShapeGeometry(sh), capMat); cap.position.z = 0.002; grp.add(cap);
    }
  }
  return grp;
}
// A flat extruded shape in the x–y plane from [x, y] points, depth d going back from z0.
export function slab(pts, d, mat, z0 = 0) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
  const m = new THREE.Mesh(g, mat); m.position.z = z0 - d; m.castShadow = true; m.receiveShadow = true;
  return m;
}
// A ventilated brake rotor, axle along Z, outer radius R: two friction rings joined by radial
// vanes, and a "hat" that bolts to the hub. rotor.hot is the friction-ring material (tint it).
export function makeRotor(R, { vent = true, vanes = 30, t = 0.17 } = {}) {
  const g = new THREE.Group(), T = R * t, hot = iron(0xa4a9b3, { roughness: 0.4, emissive: 0x000000 });
  const r0 = R * 0.56;
  if (vent) {
    g.add(ringZ(r0, R, -T / 2, -T / 2 + T * 0.3, hot), ringZ(r0, R, T / 2 - T * 0.3, T / 2, hot));
    const vm = iron(0x6f747d);
    for (let i = 0; i < vanes; i++) { const a = (i / vanes) * TAU, v = box((R - r0) * 0.96, R * 0.022, T * 0.42, vm); v.position.set(Math.cos(a) * (R + r0) / 2, Math.sin(a) * (R + r0) / 2, 0); v.rotation.z = a; g.add(v); }
  } else g.add(ringZ(r0, R, -T * 0.3, T * 0.3, hot));
  const hatM = iron(0x5d626b);
  g.add(latheZ([[T / 2, r0 + R * 0.04], [T / 2, r0 - R * 0.04], [T / 2 + R * 0.26, r0 - R * 0.06], [T / 2 + R * 0.26, R * 0.2], [T / 2 + R * 0.32, R * 0.2], [T / 2 + R * 0.32, r0 + R * 0.0], [T / 2 + R * 0.06, r0 + R * 0.04]], hatM));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4, s = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.035, R * 0.035, R * 0.12, 10), steel(0xd8dce4)); s.rotation.x = Math.PI / 2; s.position.set(Math.cos(a) * R * 0.33, Math.sin(a) * R * 0.33, T / 2 + R * 0.36); g.add(s); }
  g.hot = hot; g.T = T;
  return g;
}
// A simple outside view of a floating caliper sitting over the rotor's rim at angle ang (about Z).
export function makeCaliper(R, T, color = 0xd8343a, ang = 0) {
  const g = new THREE.Group(), m = M.plastic(color, { roughness: 0.45, metalness: 0.2 });
  const w = R * 0.62, hgt = R * 0.46, d = T + R * 0.5;
  const body = box(hgt, w, d * 0.42, m); body.position.set(R * 0.83, 0, -T / 2 - d * 0.21 - R * 0.02); g.add(body);        // piston side (inboard)
  const bridge = box(R * 0.14, w, d, m); bridge.position.set(R * 1.07, 0, -R * 0.08); g.add(bridge);
  const fing = box(hgt * 0.8, w * 0.8, R * 0.09, m); fing.position.set(R * 0.87, 0, T / 2 + R * 0.12); g.add(fing);
  const padM = M.matte(0x3a3027);
  for (const s of [-1, 1]) { const p = box(hgt * 0.8, w * 0.78, R * 0.07, padM); p.position.set(R * 0.8, 0, s * (T / 2 + R * 0.045)); g.add(p); }
  g.rotation.z = ang;
  return shade(g);
}
// A brake drum seen from outside, axle along Z, radius R.
export function makeDrumShell(R, mat = iron(0x6a6f78)) {
  const g = new THREE.Group();
  g.add(latheZ([[-R * 0.5, R * 0.9], [-R * 0.5, R], [R * 0.12, R], [R * 0.2, R * 0.45], [R * 0.2, R * 0.2], [R * 0.12, R * 0.2], [R * 0.1, R * 0.9]], mat));
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, f = box(R * 0.06, R * 0.03, R * 0.5, mat); f.position.set(Math.cos(a) * R * 1.01, Math.sin(a) * R * 1.01, -R * 0.2); f.rotation.z = a; g.add(f); }
  return g;
}
// A tyre and wheel rim, axle along Z. ghost: see-through.
export function makeTyre(r, width, { ghost = false, treads = 28 } = {}) {
  const g = new THREE.Group();
  const tm = ghost ? M.ghost(0x9fb6d6, 0.1) : rubber();
  const rr = r * 0.62;
  g.add(latheZ([[-width / 2, rr], [-width / 2, r * 0.93], [-width * 0.36, r], [width * 0.36, r], [width / 2, r * 0.93], [width / 2, rr], [-width / 2, rr]], tm, { seg: 48 }));
  if (!ghost) {
    const mk = M.matte(0x2c3038);
    for (let i = 0; i < treads; i++) { const a = (i / treads) * TAU, b = box(r * 0.012, r * 0.05, width * 0.7, mk); b.position.set(Math.cos(a) * r * 1.002, Math.sin(a) * r * 1.002, 0); b.rotation.z = a; g.add(b); }
    const rim = steel(0xaeb4bf, { roughness: 0.35 });
    g.add(latheZ([[-width / 2, rr], [-width / 2, rr * 0.93], [width * 0.3, rr * 0.93], [width * 0.3, rr], [width / 2, rr]], rim, { seg: 48 }));
  }
  return g;
}
export const arrowTo = (a, from, dir, len) => { a.position.set(...from); a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize()); a.set(len); };
export { THREE, M, clamp, lerp, smooth, approach };
