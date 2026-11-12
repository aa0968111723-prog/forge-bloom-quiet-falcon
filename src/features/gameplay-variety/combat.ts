import { ENEMY_TYPES } from "../../game/rpg/data.ts";
import { cellPoint, damageInShape, sameCell, shapeContains } from "./shapes.ts";
import type { Caps, Cell, CombatAction, CombatKind, CombatState, Shape } from "./types.ts";

const SPAN = 5;

function interruptWindow(caps: Caps) {
  return caps.skillRank >= 2 ? 2 : 1;
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
    enemyHp: ENEMY_TYPES[kind].hp,
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
    const window = interruptWindow(caps);
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
    log: playerHit > 0 ? "預警範圍打中了。" : "你不在預警形狀裡。",
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
  return quizEnemy(state);
}

function finish(state: CombatState): CombatState {
  if (state.outcome !== "ongoing") return state;
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
