// Template registry. Each template names the physical model a problem belongs to, the
// roles its given quantities can play, and (for implemented templates) how to turn the
// role assignment into solver parameters. English descriptions are sent to Jev; Chinese
// ones are shown to teachers.

import { solvePursuit, pursuitChecks, pursuitScript } from './solvers/pursuit.js';
import { solveHelix, helixChecks, helixScript } from './solvers/helix.js';

export const ROLES = {
  lead_speed: { dim: 'velocity', en: 'constant speed of the object being chased (the one ahead)', zh: '被追者的匀速速度' },
  chaser_accel: { dim: 'acceleration', en: 'acceleration of the chasing object that starts from rest', zh: '追赶者的加速度' },
  reaction_delay: { dim: 'time', en: 'delay / reaction time before the chaser starts moving', zh: '追赶者的反应（延迟）时间' },
  chaser_vmax: { dim: 'velocity', en: 'maximum (limit) speed of the chasing object', zh: '追赶者的最大速度（限速）' },
  field_B: { dim: 'magnetic_field', en: 'magnetic flux density B of the field', zh: '磁感应强度 B' },
  particle_speed: { dim: 'velocity', en: 'speed of the charged particle', zh: '带电粒子的速率' },
  angle_v_B: { dim: 'angle', en: 'angle between the particle velocity and the magnetic field', zh: '速度与磁场的夹角' },
  charge_mass_ratio: { dim: 'charge_mass', en: 'charge-to-mass ratio q/m of the particle', zh: '比荷 q/m' },
  particle_charge: { dim: 'charge', en: 'electric charge q of the particle', zh: '粒子电荷量 q' },
  particle_mass: { dim: 'mass', en: 'mass m of the particle', zh: '粒子质量 m' },
  screen_distance: { dim: 'length', en: 'distance from the source to a screen along the field direction', zh: '屏到出发点的距离 L' },
  other: { dim: null, en: 'none of the above / not used by the model / a value asked for, not given', zh: '其他（与模型无关或为待求量）' },
};

export const TEMPLATES = {
  pursuit: {
    ready: true,
    zh: '追及问题：静止（可有反应时间）匀加速追匀速，可能有最大速度',
    en: 'Pursuit on a straight road: one object moves at constant speed and passes a second object at rest; after an optional reaction delay the second object accelerates uniformly from rest (possibly up to a maximum speed) to catch the first. Asks for the maximum gap and/or catch-up time.',
    roles: ['lead_speed', 'chaser_accel', 'reaction_delay', 'chaser_vmax'],
    required: ['lead_speed', 'chaser_accel'],
    conditions: {
      start_same_point: 'The chasing object starts from rest at the same position where the other object passes it (they are side by side when the clock starts).',
    },
    objects: {
      lead: { truck: '货车 truck / lorry', car: '汽车 car / sedan', bike: '自行车 bicycle / cyclist', person: '人 person walking or running', other: null },
      chaser: { police: '警车 police car', car: '汽车 car / sedan', motorbike: '摩托车 motorcycle', person: '人 person', other: null },
    },
    build(r) {
      return { v1: r.lead_speed, a: r.chaser_accel, delay: r.reaction_delay ?? 0, vmax: r.chaser_vmax ?? null };
    },
    solve: solvePursuit,
    checks: pursuitChecks,
    script: pursuitScript,
  },
  magnetic_helix: {
    ready: true,
    zh: '带电粒子在匀强磁场中的螺旋线运动（速度与 B 斜交）',
    en: 'A charged particle moves in a uniform magnetic field with its velocity at an oblique angle (not 0 or 90 degrees) to B, giving a helix: find radius, period, pitch, magnetic focusing, or where it hits a screen.',
    roles: ['field_B', 'particle_speed', 'angle_v_B', 'charge_mass_ratio', 'particle_charge', 'particle_mass', 'screen_distance'],
    required: ['field_B', 'particle_speed', 'angle_v_B'],
    conditions: {
      oblique_velocity: 'The particle velocity is neither parallel nor perpendicular to the magnetic field.',
    },
    objects: {
      particle: { proton: '质子 proton', electron: '电子 electron', alpha: 'α粒子 alpha particle', positive: 'unnamed positively charged particle', negative: 'unnamed negatively charged particle' },
    },
    build(r, obj) {
      return {
        B: r.field_B, v: r.particle_speed, theta: r.angle_v_B,
        qm: r.charge_mass_ratio ?? null, q: r.particle_charge, m: r.particle_mass,
        L: r.screen_distance ?? null, particle: obj.particle || 'positive',
      };
    },
    solve: solveHelix,
    checks: helixChecks,
    script: helixScript,
  },
  // Recognised but not yet implemented: these route to the LLM fallback / teacher review.
  pursuit_decel: { zh: '追及问题（前车刹车减速 / 相遇问题）', en: 'Pursuit or meeting problem where an object decelerates (brakes to a stop) or both move toward each other.' },
  projectile: { zh: '平抛 / 斜抛运动', en: 'Projectile motion: horizontal or oblique throw under gravity.' },
  incline_friction: { zh: '斜面 / 摩擦力 / 牛顿第二定律', en: 'Block on an incline or rough surface, friction, Newton second law.' },
  connected_bodies: { zh: '连接体 / 板块模型 / 传送带', en: 'Connected bodies, block-on-board, pulleys, or conveyor belt.' },
  vertical_circle: { zh: '竖直面圆周运动 / 天体运动', en: 'Circular motion in a vertical plane, or satellites and planetary orbits.' },
  spring_energy: { zh: '功能关系 / 机械能守恒 / 弹簧', en: 'Work-energy theorem, mechanical energy conservation, springs.' },
  collision_momentum: { zh: '动量守恒 / 碰撞', en: 'Momentum conservation, collisions, recoil.' },
  efield_deflection: { zh: '带电粒子在电场中加速 / 偏转', en: 'Charged particle accelerated or deflected in a uniform electric field (e.g. between plates).' },
  bfield_circle_boundary: { zh: '带电粒子在有界磁场中的匀速圆周运动', en: 'Charged particle entering a bounded magnetic field perpendicular to B, uniform circular motion, boundary geometry.' },
  composite_field: { zh: '复合场 / 组合场（速度选择器、质谱仪、回旋加速器）', en: 'Combined or successive electric and magnetic fields: velocity selector, mass spectrometer, cyclotron.' },
  em_induction_rod: { zh: '电磁感应：导体棒切割 / 线框', en: 'Electromagnetic induction: rod sliding on rails or loop entering a field.' },
  ac_transformer: { zh: '交流电 / 变压器 / 远距离输电', en: 'Alternating current, transformers, power transmission.' },
  other: { zh: '其他（非上述模型或非物理题）', en: 'Anything else, including non-physics text or a physics model not listed.' },
};

export const templateIds = () => Object.keys(TEMPLATES);
export const readyTemplates = () => Object.entries(TEMPLATES).filter(([, t]) => t.ready).map(([id]) => id);
