import { describe, it, expect } from 'vitest';
import {
  CRIT_MULT,
  HEAVY_DEF_PENALTY,
  CHI_PUNCH_DMG_L1,
  SPAWN_INVULN_S,
  STANCE_DAMAGE_CAP,
  ELEMENTAL_SKILL_DMG_MAX,
  CHI_SKILL_DMG_MAX,
} from '../combat';
import { STANCE_TABLE, STANCE_MASTERY, STANCE_BEATS, LAUNCH_UNLOCK_LEVEL } from '../stances';
import {
  LEVEL_UP_REWARD,
  FIRST_RUN_SP_CAP,
  MAX_DAN_RANK,
  STANCE_MASTERY_CAP,
  CHI_SKILL_UNLOCK_STEP,
  NINJA_SKILL_UNLOCK_FROM,
  REBIRTH,
  WAR_ROOM,
  EQUIPMENT_SLOTS,
  INVENTORY_MAX_STACK,
  MERCHANT_TOP_ITEM_COINS,
  MERCHANT_FLOOR_RARITY,
  NINJA_STAT_TRANSFER_GOLD,
  NINJA_RARE_OUTFIT_GOLD,
  DUEL_TOKEN_TIERS,
} from '../economy';

// Spec §E/§G.a: these CONTRACT values are frozen. Calibration may NOT mutate them; if footage
// contradicts one, the contract wins and the contradiction is logged in DIVERGENCES.md.
describe('CONTRACT numeric audits', () => {
  it('critical multiplier is 3x (fixes the prior 1.3x build divergence)', () => {
    expect(CRIT_MULT).toBe(3);
  });

  it('Light slash SPEED is 1.4 — the only published timing constant / reference unit', () => {
    expect(STANCE_TABLE.light.speed).toBe(1.4);
  });

  it('stance damage cap is x1.4', () => {
    expect(STANCE_DAMAGE_CAP).toBe(1.4);
  });

  it('stance triangle: Light > Heavy > Balanced > Light', () => {
    expect(STANCE_BEATS).toEqual({ light: 'heavy', heavy: 'balanced', balanced: 'light' });
  });

  it('level-up reward is exactly +1 SP, +3 stat, full refill', () => {
    expect(LEVEL_UP_REWARD.skillPoints).toBe(1);
    expect(LEVEL_UP_REWARD.statPoints).toBe(3);
    expect(LEVEL_UP_REWARD.fullRefill).toBe(true);
  });

  it('Heavy stance defense penalty is -20% (=> takes 25% more damage)', () => {
    expect(HEAVY_DEF_PENALTY).toBe(0.2);
    expect(STANCE_TABLE.heavy.damageTakenMult).toBe(1.25);
  });

  it('Chi Punch is 10 flat at L1', () => {
    expect(CHI_PUNCH_DMG_L1).toBe(10);
  });

  it('skill damage references: elemental max 300, chi maxed 100', () => {
    expect(ELEMENTAL_SKILL_DMG_MAX).toBe(300);
    expect(CHI_SKILL_DMG_MAX).toBe(100);
  });

  it('stance mastery dmg ranges: light 0.5->0.9, balanced 1.0->1.2, heavy 1.4 (no gain)', () => {
    expect([STANCE_MASTERY.light.dmgMultMin, STANCE_MASTERY.light.dmgMultMax]).toEqual([0.5, 0.9]);
    expect([STANCE_MASTERY.balanced.dmgMultMin, STANCE_MASTERY.balanced.dmgMultMax]).toEqual([1.0, 1.2]);
    expect([STANCE_MASTERY.heavy.dmgMultMin, STANCE_MASTERY.heavy.dmgMultMax]).toEqual([1.4, 1.4]);
  });

  it('skill unlock cadence: Chi at levels ending in 5, Ninja from level 10', () => {
    expect(CHI_SKILL_UNLOCK_STEP).toBe(5);
    expect(NINJA_SKILL_UNLOCK_FROM).toBe(10);
  });

  it('rebirth payout schedule (1-9 / 10th / 11th+) and +10 attack per rebirth', () => {
    expect(REBIRTH.earlyGold).toBe(25);
    expect(REBIRTH.earlyElement).toBe(10);
    expect(REBIRTH.tenthGold).toBe(100);
    expect(REBIRTH.tenthElement).toBe(20);
    expect(REBIRTH.lateGold).toBe(25);
    expect(REBIRTH.attackBonusPerRebirth).toBe(10);
  });

  it('first-run SP cap 80; max dan rank 5 (kyudan); stance mastery cap 9', () => {
    expect(FIRST_RUN_SP_CAP).toBe(80);
    expect(MAX_DAN_RANK).toBe(5);
    expect(STANCE_MASTERY_CAP).toBe(9);
  });

  it('launch unlock by stance level: Light 3, others 5', () => {
    expect(LAUNCH_UNLOCK_LEVEL.light).toBe(3);
    expect(LAUNCH_UNLOCK_LEVEL.balanced).toBe(5);
    expect(LAUNCH_UNLOCK_LEVEL.heavy).toBe(5);
  });

  it('spawn invuln is 5 seconds', () => {
    expect(SPAWN_INVULN_S).toBe(5);
  });

  it('equipment economy: 5 slots incl pants, stack 99, merchant green/8000, ninja transfer 10g', () => {
    expect(EQUIPMENT_SLOTS.length).toBe(5);
    expect(EQUIPMENT_SLOTS).toContain('pants');
    expect(INVENTORY_MAX_STACK).toBe(99);
    expect(MERCHANT_FLOOR_RARITY).toBe('green');
    expect(MERCHANT_TOP_ITEM_COINS).toBe(8000);
    expect(NINJA_STAT_TRANSFER_GOLD).toBe(10);
  });

  it('ninja shop: rare outfits 15g; duel tokens +10/+25/+40 for 5/10/15 gold', () => {
    expect(NINJA_RARE_OUTFIT_GOLD).toBe(15);
    expect(DUEL_TOKEN_TIERS).toEqual([
      { duels: 10, gold: 5 },
      { duels: 25, gold: 10 },
      { duels: 40, gold: 15 },
    ]);
  });

  it('War Room documented numbers (§A.4)', () => {
    expect(WAR_ROOM.unlockLevel).toBe(10);
    expect(WAR_ROOM.killCap).toBe(350);
    expect(WAR_ROOM.buildDonationCap).toBe(500);
    expect(WAR_ROOM.deployMods).toEqual({ fieldToMountain: 60, mountainToMountain: 100, fieldToForest: 75 });
    expect(WAR_ROOM.controlPointFlagBonus).toBe(1.2);
    expect(WAR_ROOM.forwardBase).toBe(10000);
    expect(WAR_ROOM.barricades).toBe(10000);
    expect(WAR_ROOM.tunnels).toBe(5000);
    expect(WAR_ROOM.hqsPerClan).toBe(3);
    expect(WAR_ROOM.conquestTickHours).toBe(24);
    expect(WAR_ROOM.movesPerHourBase).toBe(3);
  });
});
