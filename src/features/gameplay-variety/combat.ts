import { ENEMY_TYPES } from "../../game/rpg/data.ts";
import { cellPoint, cellsInShape, damageInShape, sameCell, shapeContains, telegraphLabel } from "./shapes.ts";
import type { Caps, Cell, CombatAction, CombatKind, CombatState, Shape } from "./types.ts";

const SPAN = 5;

function foeStats(kind: CombatKind) {
  if (kind === "quiz" || kind === "report" || kind === "exam" || kind === "final") {
    return { hp: ENEMY_TYPES[kind].hp, damage: ENEMY_TYPES[kind].damage };
  }
  if (kind === "rollcall" || kind === "rollcall-late") return { hp: 90, damage: 14 };
  if (kind === "downpour" || kind === "downpour-slow") return { hp: 90, damage: 16 };
  return { hp: 70, damage: 11 };
}

function interruptWindow(skillRank: number) {
  return skillRank >= 2 ? 2 : 1;
}

export function interruptReady(state: CombatState, skillRank: number) {
  return Boolean(state.telegraph && state.windup > 0 && state.windup <= interruptWindow(skillRank));
}

export function combatCue(state: CombatState, skillRank: number) {
  const parts = [`生命 ${state.playerHp}`, `異象 ${state.enemyHp}`];
  if (state.deskHp != null) parts.push(`桌子 ${state.deskHp}`);
  if (state.windup > 0) {
    parts.push(
      interruptReady(state, skillRank)
        ? `前搖剩 ${state.windup} 拍，現在可以打斷`
        : `前搖剩 ${state.windup} 拍，還沒到能打斷的節拍`,
    );
  } else if (state.commit > 0) {
    parts.push(`長條還有 ${state.commit} 拍`);
  }
  if (state.combat.startsWith("flyer")) {
    parts.push(state.lit.some(Boolean) ? "已經進門" : "走到標著門的那格再觀察");
  } else if (state.nodes.length > 0) {
    const left = state.nodes.length - state.lit.filter(Boolean).length;
    parts.push(left === 0 ? "結界都亮了" : `還有 ${left} 處結界沒亮`);
  }
  if (state.seats) parts.push(`應到 ${state.seatIndex}/${state.seats.length}，錯過 ${state.misses}`);
  if (state.water != null) parts.push(`積水 ${state.water} 排`);
  if (state.shelter && !state.lit[0]) parts.push("屋簷在標著簷的那格");
  parts.push(telegraphLabel(state.telegraph));
  if (state.log) parts.push(state.log.replace(/。$/u, ""));
  return `${parts.join("。")}。`;
}

export function combatCellText(state: CombatState, cell: Cell) {
  const shaped = state.telegraph ? cellsInShape(state.telegraph).some((item) => sameCell(item, cell)) : false;
  const marks: string[] = [];
  if (sameCell(cell, state.player)) marks.push("你");
  if (sameCell(cell, state.enemy)) marks.push("異");
  if (state.desk && sameCell(cell, state.desk)) marks.push("桌");
  const node = state.nodes.findIndex((item) => sameCell(item, cell));
  if (node >= 0) {
    if (state.combat.startsWith("flyer")) marks.push(state.lit[node] ? "進" : "門");
    else marks.push(state.lit[node] ? "亮" : "結");
  }
  if (state.shelter && sameCell(state.shelter, cell)) marks.push("簷");
  if (shaped) marks.push(state.telegraph?.kind === "arc" ? "扇" : "條");
  return marks.join("");
}

function inBounds(cell: Cell) {
  return cell.x >= 0 && cell.y >= 0 && cell.x < SPAN && cell.y < SPAN;
}

function chebyshev(a: Cell, b: Cell) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function stepToward(from: Cell, to: Cell): Cell {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  if (dx !== 0) return { x: from.x + dx, y: from.y };
  if (dy !== 0) return { x: from.x, y: from.y + dy };
  return from;
}

function arcAt(origin: Cell, facing: number, radius: number, half: number): Shape {
  const point = cellPoint(origin);
  return { kind: "arc", x: point.x, z: point.z, facing, radius, half };
}

function rowRect(y: number): Shape {
  return { kind: "rect", x: 2.5, z: y + 0.5, yaw: 0, length: 1, width: 5 };
}

function columnRect(x: number): Shape {
  return { kind: "rect", x: x + 0.5, z: 2.5, yaw: 0, length: 5, width: 1 };
}

function blank(kind: CombatKind, extra: Partial<CombatState>): CombatState {
  return {
    board: "combat",
    combat: kind,
    player: { x: 0, y: 2 },
    playerHp: 100,
    enemy: { x: 4, y: 2 },
    enemyHp: foeStats(kind).hp,
    facing: -Math.PI / 2,
    windup: 0,
    telegraph: null,
    commit: 0,
    laneY: null,
    stun: 0,
    step: 0,
    retargets: 0,
    desk: null,
    deskHp: null,
    nodes: [],
    lit: [],
    seats: null,
    seatIndex: 0,
    misses: 0,
    water: null,
    shelter: null,
    patrol: null,
    patrolAt: 0,
    guard: false,
    lastPlayerHit: 0,
    lastEnemyHit: 0,
    lastShape: null,
    outcome: "ongoing",
    log: "先看預警的形狀，再決定要進、擋或打斷。",
    ...extra,
  };
}

export function createCombat(kind: CombatKind): CombatState {
  if (kind === "report") return blank(kind, { player: { x: 0, y: 1 }, enemy: { x: 4, y: 1 } });
  if (kind === "exam") return blank(kind, { player: { x: 2, y: 2 }, enemy: { x: 3, y: 2 } });
  if (kind === "final") {
    return blank(kind, {
      player: { x: 1, y: 2 },
      desk: { x: 2, y: 4 },
      deskHp: 40,
      nodes: [
        { x: 0, y: 0 },
        { x: 0, y: 4 },
      ],
      lit: [false, false],
      log: "長條會打向要保護的桌子。站上兩處結界可以解除，不必打完。",
    });
  }
  if (kind === "rollcall" || kind === "rollcall-late") {
    return blank(kind, {
      player: { x: 2, y: 4 },
      enemy: { x: 2, y: 0 },
      seats:
        kind === "rollcall"
          ? [
              { x: 1, y: 3 },
              { x: 3, y: 2 },
            ]
          : [
              { x: 4, y: 3 },
              { x: 2, y: 1 },
              { x: 0, y: 3 },
            ],
      log: "助教不會追你。被點到的那一格要有人，連續錯過兩次就失敗。",
    });
  }
  if (kind === "downpour" || kind === "downpour-slow") {
    return blank(kind, {
      player: { x: 2, y: 4 },
      enemy: { x: 0, y: 4 },
      water: 0,
      shelter: { x: 2, y: 0 },
      lit: [false],
      log: "雨沿坡往上淹，不會跟著你拐彎。走到簷下再觀察。",
    });
  }
  if (kind === "flyer" || kind === "flyer-wide") {
    const vertical = [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 2, y: 4 },
      { x: 2, y: 3 },
      { x: 2, y: 2 },
      { x: 2, y: 1 },
    ];
    const wide = [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ];
    const patrol = kind === "flyer" ? vertical : wide;
    return blank(kind, {
      player: kind === "flyer" ? { x: 0, y: 2 } : { x: 0, y: 4 },
      enemy: patrol[0],
      patrol,
      nodes: [kind === "flyer" ? { x: 4, y: 2 } : { x: 4, y: 0 }],
      lit: [false],
      log: "發傳單的人走固定路線，不會追你。走到門再觀察就能進去。",
    });
  }
  return blank(kind, {});
}

export function withCombat(state: CombatState, patch: Partial<CombatState>): CombatState {
  return { ...state, ...patch };
}

function moved(cell: Cell, action: CombatAction): Cell {
  if (action === "north") return { x: cell.x, y: cell.y - 1 };
  if (action === "south") return { x: cell.x, y: cell.y + 1 };
  if (action === "west") return { x: cell.x - 1, y: cell.y };
  if (action === "east") return { x: cell.x + 1, y: cell.y };
  return cell;
}

function strikeAmount(state: CombatState, caps: Caps) {
  const amount = 10 + (caps.equipped ? 5 : 0);
  if (state.combat === "exam") {
    const weak = arcAt(state.enemy, state.facing, 1.7, 0.55);
    const point = cellPoint(state.player);
    return damageInShape(weak, point.x, point.z, amount);
  }
  return chebyshev(state.player, state.enemy) <= 1 ? amount : 0;
}

function applyPlayer(state: CombatState, action: CombatAction, caps: Caps): CombatState {
  const next: CombatState = { ...state, lastPlayerHit: 0 };
  if (action === "north" || action === "south" || action === "west" || action === "east") {
    const target = moved(state.player, action);
    if (!inBounds(target) || sameCell(target, state.enemy)) return { ...next, log: "這一步走不了。" };
    return { ...next, player: target, log: "你移動了。" };
  }
  if (action === "guard") return { ...next, guard: true, log: "你舉著筆記擋了一下。" };
  if (action === "strike") {
    if (state.combat.startsWith("rollcall") || state.combat.startsWith("downpour")) {
      return {
        ...next,
        log: state.combat.startsWith("downpour") ? "雨不是能打散的。" : "點名打不掉，要站到被點的那一格。",
      };
    }
    const dealt = strikeAmount(state, caps);
    const blocked = state.combat === "exam" && dealt === 0 && chebyshev(state.player, state.enemy) <= 1;
    return {
      ...next,
      enemyHp: state.enemyHp - dealt,
      lastPlayerHit: dealt,
      log: blocked ? "護盾側面沒有打進去。" : dealt > 0 ? "打中正面。" : "距離不夠。",
    };
  }
  if (action === "skill") {
    const window = interruptWindow(caps.skillRank);
    if (state.telegraph && state.windup > 0 && state.windup <= window) {
      return {
        ...next,
        telegraph: null,
        windup: 0,
        stun: 2,
        log: "你打斷了前搖。",
      };
    }
    return { ...next, log: "這個節拍打不斷。" };
  }
  if (action === "dispel") {
    const index = state.nodes.findIndex((node) => sameCell(node, state.player));
    if (index < 0) return { ...next, log: "要站在結界上才能解除。" };
    const lit = state.lit.map((value, at) => (at === index ? true : value));
    return { ...next, lit, log: "結界點亮了。" };
  }
  if (state.shelter && sameCell(state.player, state.shelter)) {
    return { ...next, lit: [true], log: "你站到屋簷下。" };
  }
  if (state.combat.startsWith("flyer")) {
    const index = state.nodes.findIndex((node) => sameCell(node, state.player));
    if (index >= 0) {
      const lit = state.lit.map((value, at) => (at === index ? true : value));
      return { ...next, lit, log: "你進門了，不必把傳單接完。" };
    }
  }
  return { ...next, log: "你停著看預警。" };
}

function resolveStrike(state: CombatState, shape: Shape, amount: number): CombatState {
  const point = cellPoint(state.player);
  let playerHit = damageInShape(shape, point.x, point.z, amount);
  if (state.guard) playerHit = Math.floor(playerHit / 2);
  let deskHp = state.deskHp;
  if (state.desk && deskHp != null && shapeContains(shape, cellPoint(state.desk).x, cellPoint(state.desk).z)) {
    if (!sameCell(state.player, state.desk)) deskHp -= amount;
  }
  return {
    ...state,
    playerHp: state.playerHp - playerHit,
    deskHp,
    telegraph: null,
    windup: 0,
    commit: 0,
    guard: false,
    lastShape: shape,
    lastEnemyHit: playerHit,
    step: state.step + 1,
    log: playerHit > 0 ? (state.guard ? "筆記擋掉一半，預警仍打中。" : "預警範圍打中了。") : "你不在預警形狀裡。",
  };
}

function quizEnemy(state: CombatState): CombatState {
  if (state.windup === 1 && state.telegraph) return resolveStrike(state, state.telegraph, ENEMY_TYPES.quiz.damage);
  if (state.windup > 1) {
    return { ...state, windup: state.windup - 1, step: state.step + 1, guard: false, lastEnemyHit: 0, lastShape: state.telegraph };
  }
  if (chebyshev(state.player, state.enemy) <= 1) {
    const facing = Math.atan2(state.player.x - state.enemy.x, state.player.y - state.enemy.y);
    const telegraph = arcAt(state.enemy, facing, 1.25, 0.5);
    return {
      ...state,
      facing,
      windup: 2,
      telegraph,
      retargets: state.retargets + 1,
      step: state.step + 1,
      guard: false,
      lastEnemyHit: 0,
      lastShape: telegraph,
      log: "扇形預警。",
    };
  }
  return {
    ...state,
    enemy: stepToward(state.enemy, state.player),
    retargets: state.retargets + 1,
    step: state.step + 1,
    guard: false,
    lastEnemyHit: 0,
    log: "突擊小考改追你。",
  };
}

function reportEnemy(state: CombatState): CombatState {
  if (state.telegraph && state.commit === 1) return resolveStrike(state, state.telegraph, ENEMY_TYPES.report.damage);
  if (state.commit > 1) {
    return {
      ...state,
      commit: state.commit - 1,
      step: state.step + 1,
      guard: false,
      lastEnemyHit: 0,
      lastShape: state.telegraph,
      log: "長條預警還停在原位。",
    };
  }
  const telegraph = rowRect(state.player.y);
  return {
    ...state,
    laneY: state.player.y,
    commit: 3,
    telegraph,
    retargets: state.retargets + 1,
    step: state.step + 1,
    guard: false,
    lastEnemyHit: 0,
    lastShape: telegraph,
    log: "長條預警。",
  };
}

function examEnemy(state: CombatState): CombatState {
  if (state.windup === 1 && state.telegraph) return resolveStrike(state, state.telegraph, ENEMY_TYPES.exam.damage);
  if (state.windup > 1) {
    return { ...state, windup: state.windup - 1, step: state.step + 1, guard: false, lastEnemyHit: 0, lastShape: state.telegraph };
  }
  if (state.step % 2 === 1) {
    return { ...state, step: state.step + 1, guard: false, lastEnemyHit: 0, log: "監考者這拍不轉身。" };
  }
  if (chebyshev(state.player, state.enemy) <= 1) {
    const facing = Math.atan2(state.player.x - state.enemy.x, state.player.y - state.enemy.y);
    const telegraph = arcAt(state.enemy, facing, 1.7, 0.55);
    return {
      ...state,
      facing,
      windup: 3,
      telegraph,
      retargets: state.retargets + 1,
      step: state.step + 1,
      guard: false,
      lastEnemyHit: 0,
      lastShape: telegraph,
      log: "扇形預警，側面有護盾。",
    };
  }
  const enemy = stepToward(state.enemy, state.player);
  return {
    ...state,
    enemy,
    facing: Math.atan2(state.player.x - enemy.x, state.player.y - enemy.y),
    retargets: state.retargets + 1,
    step: state.step + 1,
    guard: false,
    lastEnemyHit: 0,
    log: "監考者慢慢轉身。",
  };
}

function finalEnemy(state: CombatState): CombatState {
  if (state.windup === 1 && state.telegraph) return resolveStrike(state, state.telegraph, ENEMY_TYPES.final.damage);
  if (state.windup > 1) {
    return { ...state, windup: state.windup - 1, step: state.step + 1, guard: false, lastEnemyHit: 0, lastShape: state.telegraph };
  }
  const slam = Math.floor(state.step / 2) % 2 === 0;
  if (!slam) {
    return {
      ...state,
      telegraph: null,
      step: state.step + 1,
      guard: false,
      lastEnemyHit: 0,
      log: "這拍可以解除異象。",
    };
  }
  const telegraph = columnRect(state.desk?.x ?? 2);
  return {
    ...state,
    telegraph,
    windup: 4,
    retargets: state.retargets + 1,
    step: state.step + 1,
    guard: false,
    lastEnemyHit: 0,
    lastShape: telegraph,
    log: "長條預警打向要保護的目標。",
  };
}

function cellRect(cell: Cell): Shape {
  return { kind: "rect", x: cell.x + 0.5, z: cell.y + 0.5, yaw: 0, length: 0.9, width: 0.9 };
}

function rollcallEnemy(state: CombatState): CombatState {
  const seats = state.seats ?? [];
  if (state.windup === 1 && state.telegraph) {
    const point = cellPoint(state.player);
    const hit = shapeContains(state.telegraph, point.x, point.z);
    const struck = resolveStrike(state, state.telegraph, hit ? 0 : foeStats(state.combat).damage);
    return {
      ...struck,
      seatIndex: hit ? state.seatIndex + 1 : state.seatIndex,
      misses: hit ? state.misses : state.misses + 1,
      enemy: state.enemy,
      retargets: state.retargets,
      log: hit ? "這格有應到。" : "這格沒有人。",
    };
  }
  if (state.windup > 1) {
    return { ...state, windup: state.windup - 1, step: state.step + 1, guard: false, lastEnemyHit: 0, log: "點名還在等這一格。" };
  }
  const seat = seats[state.seatIndex];
  if (!seat) return { ...state, step: state.step + 1, log: "點名結束了。" };
  return {
    ...state,
    telegraph: cellRect(seat),
    windup: state.combat === "rollcall-late" ? 5 : 4,
    step: state.step + 1,
    guard: false,
    lastEnemyHit: 0,
    log: "助教點到這一格。",
  };
}

function downpourEnemy(state: CombatState): CombatState {
  if (state.windup === 1 && state.telegraph) {
    const struck = resolveStrike(state, state.telegraph, foeStats(state.combat).damage);
    return {
      ...struck,
      water: (state.water ?? 0) + 1,
      enemy: state.enemy,
      retargets: state.retargets,
      log: struck.lastEnemyHit > 0 ? "積水淹到你站的這一排。" : "這一排積水了，你不在裡面。",
    };
  }
  if (state.windup > 1) {
    return { ...state, windup: state.windup - 1, step: state.step + 1, guard: false, lastEnemyHit: 0, log: "積水還在漲。" };
  }
  const nextRow = 4 - (state.water ?? 0);
  if (nextRow < 0) return { ...state, step: state.step + 1, log: "整段坡都積水了。" };
  return {
    ...state,
    telegraph: rowRect(nextRow),
    windup: state.combat === "downpour-slow" ? 2 : 1,
    step: state.step + 1,
    guard: false,
    lastEnemyHit: 0,
    enemy: state.enemy,
    log: "下一排要積水了。",
  };
}

function flyerEnemy(state: CombatState): CombatState {
  const loop = state.patrol ?? [];
  if (state.windup === 1 && state.telegraph) {
    const struck = resolveStrike(state, state.telegraph, foeStats(state.combat).damage);
    return {
      ...struck,
      enemy: state.enemy,
      patrolAt: state.patrolAt,
      retargets: state.retargets,
      log: struck.lastEnemyHit > 0 ? "傳單掃到你。" : "傳單從旁邊過去。",
    };
  }
  if (state.windup > 1) {
    return { ...state, windup: state.windup - 1, step: state.step + 1, guard: false, lastEnemyHit: 0, log: "他還舉著傳單。" };
  }
  const nextAt = loop.length ? (state.patrolAt + 1) % loop.length : state.patrolAt;
  const next = loop[nextAt] ?? state.enemy;
  const facing = Math.atan2(next.x - state.enemy.x, next.y - state.enemy.y);
  if (state.step % 2 === 0) {
    return {
      ...state,
      enemy: next,
      patrolAt: nextAt,
      facing,
      telegraph: null,
      step: state.step + 1,
      guard: false,
      lastEnemyHit: 0,
      log: "發傳單的人沿固定路線走，沒有轉向你。",
    };
  }
  return {
    ...state,
    telegraph: arcAt(state.enemy, state.facing, state.combat === "flyer-wide" ? 1.6 : 1.15, 0.6),
    windup: 1,
    step: state.step + 1,
    guard: false,
    lastEnemyHit: 0,
    log: "他停下來把傳單往前遞。",
  };
}

function enemyPhase(state: CombatState): CombatState {
  if (state.stun > 0) {
    return {
      ...state,
      stun: state.stun - 1,
      telegraph: null,
      windup: 0,
      guard: false,
      step: state.step + 1,
      lastEnemyHit: 0,
      log: "前搖被打斷。",
    };
  }
  if (state.combat === "report") return reportEnemy(state);
  if (state.combat === "exam") return examEnemy(state);
  if (state.combat === "final") return finalEnemy(state);
  if (state.combat.startsWith("rollcall")) return rollcallEnemy(state);
  if (state.combat.startsWith("downpour")) return downpourEnemy(state);
  if (state.combat.startsWith("flyer")) return flyerEnemy(state);
  return quizEnemy(state);
}

function finish(state: CombatState): CombatState {
  if (state.outcome !== "ongoing") return state;
  if (state.seats && state.seatIndex >= state.seats.length) return { ...state, outcome: "win", log: "點到名了。" };
  if (state.seats && state.misses >= 2) return { ...state, outcome: "lose", log: "連續兩次沒應到。" };
  if (state.shelter && state.lit[0]) return { ...state, outcome: "win", log: "躲進屋簷了，雨還在下。" };
  if (state.water != null && state.water >= 5 && !(state.shelter && sameCell(state.player, state.shelter))) {
    return { ...state, outcome: "lose", log: "積水蓋過這段坡。" };
  }
  if (state.combat.startsWith("flyer") && state.nodes.length > 0 && state.lit.length === state.nodes.length && state.lit.every(Boolean)) {
    return { ...state, outcome: "win", log: "進門了，不用把傳單打完。" };
  }
  if (state.nodes.length > 0 && state.lit.length === state.nodes.length && state.lit.every(Boolean)) {
    return { ...state, outcome: "win", log: "異象被解除了。" };
  }
  if (state.enemyHp <= 0) return { ...state, outcome: "win", log: "異象散開了。" };
  if (state.playerHp <= 0) return { ...state, outcome: "lose", log: "你被打中了。" };
  if (state.deskHp != null && state.deskHp <= 0) return { ...state, outcome: "lose", log: "要保護的目標壞了。" };
  return state;
}

export function stepCombat(state: CombatState, action: CombatAction, caps: Caps): CombatState {
  if (state.outcome !== "ongoing") return state;
  const acted = finish(applyPlayer(state, action, caps));
  if (acted.outcome !== "ongoing") return acted;
  return finish(enemyPhase(acted));
}
