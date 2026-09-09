// Shared by the simulation and the development editor. Keep operational data JSON-compatible.
export const DEFAULT_BALANCE = Object.freeze({
  initialGold: 260,
  enemyBaseHp: 100,
  enemyHpPerWave: 32,
  bossHpMultiplier: 5,
  killGold: 10,
  bossGold: 50,
  waveGold: 30,
  arrowDamage: 32,
  frostDamage: 20,
  emberDamage: 68,
  damagePerLevel: 2.1,
});
export type Balance = { -readonly [K in keyof typeof DEFAULT_BALANCE]: number };
export const BALANCE_FIELDS: Record<
  keyof Balance,
  {
    label: string;
    min: number;
    max: number;
    step: number;
  }
> = {
  initialGold: { label: '开局金币（重开生效）', min: 0, max: 2000, step: 10 },
  enemyBaseHp: { label: '小兵基础生命', min: 1, max: 1000, step: 1 },
  enemyHpPerWave: { label: '每波生命增量', min: 0, max: 200, step: 1 },
  bossHpMultiplier: { label: '首领生命倍率', min: 1, max: 20, step: 0.1 },
  killGold: { label: '普通击杀金币', min: 0, max: 100, step: 1 },
  bossGold: { label: '首领击杀金币', min: 0, max: 500, step: 1 },
  waveGold: { label: '过波金币', min: 0, max: 500, step: 1 },
  arrowDamage: { label: '弓手基础伤害', min: 1, max: 300, step: 1 },
  frostDamage: { label: '冰塔基础伤害', min: 1, max: 300, step: 1 },
  emberDamage: { label: '火炮基础伤害', min: 1, max: 500, step: 1 },
  damagePerLevel: { label: '每级伤害倍率', min: 1, max: 3, step: 0.05 },
};
export const BALANCE_KEYS = Object.keys(DEFAULT_BALANCE) as (keyof Balance)[];
export const BALANCE_STORAGE_KEY = 'moonwood-balance-v1';

export function parseBalance(input: unknown): Balance {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('配置必须是 JSON 对象');
  const data = input as Record<string, unknown>;
  if (
    Object.keys(data).length !== BALANCE_KEYS.length ||
    Object.keys(data).some((key) => !Object.hasOwn(DEFAULT_BALANCE, key))
  )
    throw new Error('配置字段不匹配，请使用当前版本导出的配置');
  const result: Balance = { ...DEFAULT_BALANCE };
  for (const key of BALANCE_KEYS) {
    const value = data[key],
      { label, min, max, step } = BALANCE_FIELDS[key];
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      Math.abs((value - min) / step - Math.round((value - min) / step)) > 1e-7
    )
      throw new Error(
        `${label}：请输入 ${min}–${max} 之间、步长为 ${step} 的数值`,
      );
    result[key] = value;
  }
  return result;
}

export function enemyHealth(balance: Balance, wave: number, boss = false) {
  return Math.round(
    (balance.enemyBaseHp + wave * balance.enemyHpPerWave) *
      (boss ? balance.bossHpMultiplier : 1),
  );
}
