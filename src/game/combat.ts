/**
 * Exam / report / anomaly combat. Pure functions over HP numbers so node:test
 * can drive attack, incoming damage and defeat from an empty start state.
 */

import { skillModifiers } from "./departments.ts";

export const ENEMY_KINDS = ["exam", "report", "anomaly"] as const;
export type EnemyKind = (typeof ENEMY_KINDS)[number];

export const ENEMY_LABEL: Record<EnemyKind, string> = {
  exam: "考試",
  report: "報告",
  anomaly: "異象",
};

export const BASE_PLAYER_MAX_HP = 40;
export const BASE_PLAYER_ATTACK = 8;
export const BASE_HEAL = 8;

export const ENEMY_STATS: Record<EnemyKind, { maxHp: number; attack: number }> = {
  exam: { maxHp: 24, attack: 6 },
  report: { maxHp: 20, attack: 5 },
  anomaly: { maxHp: 32, attack: 8 },
};

export function isEnemyKind(value: unknown): value is EnemyKind {
  return typeof value === "string" && (ENEMY_KINDS as readonly string[]).includes(value);
}

export function playerMaxHp(departmentId: string | null | undefined): number {
  return BASE_PLAYER_MAX_HP + skillModifiers(departmentId).maxHpBonus;
}

export function attackDamage(kind: EnemyKind, departmentId: string | null | undefined): number {
  const m = skillModifiers(departmentId);
  let dmg = BASE_PLAYER_ATTACK + m.attackBonus;
  if (kind === "exam") dmg += m.examAttackBonus;
  if (kind === "report") dmg += m.reportAttackBonus;
  if (kind === "anomaly") dmg += m.anomalyAttackBonus;
  return Math.max(1, dmg);
}

export function incomingDamage(kind: EnemyKind, departmentId: string | null | undefined): number {
  const m = skillModifiers(departmentId);
  return Math.max(1, ENEMY_STATS[kind].attack - m.defenseBonus);
}

export function applyDamage(hp: number, damage: number): number {
  return Math.max(0, hp - Math.max(0, damage));
}

export function isDefeated(hp: number): boolean {
  return hp <= 0;
}

export type StrikeResult = { hp: number; defeated: boolean; damage: number };

/** Player hits an enemy of `kind`. HP is the enemy's current HP. */
export function strikeEnemy(
  enemyHp: number,
  kind: EnemyKind,
  departmentId: string | null | undefined,
): StrikeResult {
  const damage = attackDamage(kind, departmentId);
  const hp = applyDamage(enemyHp, damage);
  return { hp, defeated: isDefeated(hp), damage };
}

/** Enemy of `kind` hits the player. HP is the player's current HP. */
export function strikePlayer(
  playerHp: number,
  kind: EnemyKind,
  departmentId: string | null | undefined,
): StrikeResult {
  const damage = incomingDamage(kind, departmentId);
  const hp = applyDamage(playerHp, damage);
  return { hp, defeated: isDefeated(hp), damage };
}

export function healAmount(departmentId: string | null | undefined): number {
  return BASE_HEAL + skillModifiers(departmentId).healOnUse;
}

export function applyHeal(hp: number, maxHp: number, amount: number): number {
  return Math.min(maxHp, Math.max(0, hp) + Math.max(0, amount));
}

export function createEnemyHp(kind: EnemyKind): number {
  return ENEMY_STATS[kind].maxHp;
}
