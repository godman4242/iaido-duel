import Phaser from 'phaser';
import { HUD_EXPLORE, HUD_COMBAT } from '../../config/layout';
import { COL } from '../../palette';
import { FONT_DISPLAY, FONT_BODY, FONT_SIZE, TEXT_OUTLINE } from '../../config/typography';
import {
  hexCss,
  HUD_DEPTH,
  HUD_COL,
  HUD_CHROME,
  HUD_PLATE,
  HUD_TEXT,
  HUD_BARS,
  HUD_XP,
  HUD_MINIMAP,
  HUD_BUST,
  HUD_GLYPH,
  HUD_COMBAT_STYLE,
  HUD_FAKE,
  SKILL_SLOTS,
  SKILL_SLOT_RECTS,
  HUD_CRIT_BAR,
  HUD_SHUNPO_BAR,
  STANCE_PORTRAIT_HIT,
  HUD_STANCE_COLORS,
  HUD_STANCE_MARK,
  HUD_INTERACT,
  HUD_SKILL_GLYPH,
  type SkillId,
} from '../../config/hud-extra';
import { CRITICAL_MAX } from '../../config/combat';
import { SHUNPO_MAX } from '../../config/combat-sim';
import { Focus, FOCUS_MAX } from '../../core/focus';
import { Fighter } from '../fighter/Fighter';
import { NameLabel, NameLabelKind, NameLabelOpts } from './NameLabel';

const HALF = 1 / 2;

export type HudMode = 'explore' | 'combat';

/** Legacy wiring (DuelScene): the HUD pulls HP/Chi/stance from these every frame. */
type HudOpts = { player: Fighter; enemy: Fighter; focus: Focus };

/** Per-slot visual state, index-aligned with SKILL_SLOTS (data passed in — sim is authority). */
export type HudSkillView = { enabled: boolean; cooldownFrac: number };

/**
 * Polled duel snapshot (M2 port contract: meters are polled state, not events).
 * The integrator maps `sim.player` fields into this each frame via setDuelSource;
 * maxes for focus/critical/shunpo are the config caps (FOCUS/CRITICAL/SHUNPO_MAX).
 */
export type HudDuelView = {
  hp: number;
  hpMax: number;
  focus: number; // 0..FOCUS_MAX
  critical: number; // 0..CRITICAL_MAX
  critReady: boolean; // full bar ⇒ next landed hit is the 3× crit (Tell 7 glow)
  shunpo: number; // 0..SHUNPO_MAX
  shunpoActive: boolean;
  stance: string;
  stanceLocked: boolean; // renders the red CANNOT CHANGE STANCE caps
  combo: number;
  skills?: readonly HudSkillView[]; // omitted ⇒ all slots ready
};

export type SkillSlotHandler = (id: SkillId, slot: number) => void;

type TextOpts = {
  family?: string;
  color?: number;
  ox?: number;
  oy?: number;
  stroke?: number;
  bold?: boolean;
  align?: string;
};

/**
 * ART_DIRECTION §5/§6 HUD — "corners are load-bearing" (tell #6).
 * EXPLORE: coins/gold plates + location banner + quest tracker TOP-LEFT; XP badge/bar +
 * ornate minimap TOP-RIGHT; portrait + HP/Chi bars + stance caps BOTTOM-LEFT; round-slot
 * hotbar (ending in a gear) along the BOTTOM.
 * COMBAT: AUTO SLASH pill + chat bubble TOP-LEFT; pause + red brush combo TOP-RIGHT;
 * portrait/bars stay; red CANNOT CHANGE STANCE caps; 3 gold-numbered skill slots + gold
 * flee arrow BOTTOM-RIGHT. Floating name labels via attachNameLabel (§3, tell #7).
 */
export class Hud {
  private scene: Phaser.Scene;
  /** Static per-mode chrome — rebuilt only when mode/data change. */
  private chrome: Phaser.GameObjects.Graphics;
  /** Per-frame layer (bar fills). */
  private dyn: Phaser.GameObjects.Graphics;
  private chromeTexts: Phaser.GameObjects.Text[] = [];
  private labels: NameLabel[] = [];
  private mode: HudMode = 'combat';
  private dirty = true;

  // dynamic text objects (created once, repositioned/toggled per mode)
  private hpText: Phaser.GameObjects.Text;
  private chiText: Phaser.GameObjects.Text;
  private stanceText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private buffText: Phaser.GameObjects.Text;
  private comboText: Phaser.GameObjects.Text;
  private comboLabel: Phaser.GameObjects.Text;
  private critLabel: Phaser.GameObjects.Text;
  private lastCombo = 0;

  // M2 combat pieces (§3.8 + 23*): duel poll-source, callbacks, interactive state.
  private duelSource: (() => HudDuelView) | null = null;
  private stanceSwapCb: (() => void) | null = null;
  private skillSlotCb: SkillSlotHandler | null = null;
  /** Zones consume clicks ONLY while true — the integrator arms this when combat is LIVE
   *  (FIGHT! landed) and disarms it on the kill beat. While false, a click over a zone falls
   *  through to scene-level listeners (intro skip / GestureInput) instead of being swallowed
   *  by stopPropagation. Defaults false; the legacy Fighter/Focus wiring arms it itself. */
  private interactiveEnabled = false;
  private skillViews: readonly HudSkillView[] | null = null;
  private zones: Phaser.GameObjects.Zone[] = [];
  private portraitHover = false;
  private slotHover = -1;
  private portraitFlashUntil = 0;
  private slotFlashUntil: number[] = SKILL_SLOTS.map(() => 0);
  private lastStanceDrawn: string | null = null;

  private data = {
    hpCur: HUD_FAKE.hpCur as number,
    hpMax: HUD_FAKE.hpMax as number,
    chiCur: HUD_FAKE.chiCur as number,
    chiMax: HUD_FAKE.chiMax as number,
    stance: HUD_FAKE.stance as string,
    stanceLocked: false,
    crit: false,
    critCur: 0,
    critReady: false,
    shunpoCur: SHUNPO_MAX as number, // meter starts full (sim contract)
    shunpoActive: false,
    combo: 0,
    coins: HUD_FAKE.coins as number,
    gold: HUD_FAKE.gold as number,
    xpCur: HUD_FAKE.xpCur as number,
    xpMax: HUD_FAKE.xpMax as number,
    level: HUD_FAKE.level as number,
    location: HUD_FAKE.location as string,
    quest: [HUD_FAKE.quest] as string[],
    territory: HUD_FAKE.territory as string,
    sector: HUD_FAKE.sector as string,
    damageBuff: null as string | null,
  };

  constructor(
    scene: Phaser.Scene,
    private opts?: HudOpts,
  ) {
    this.scene = scene;
    this.chrome = scene.add.graphics().setDepth(HUD_DEPTH.gfx);
    this.dyn = scene.add.graphics().setDepth(HUD_DEPTH.gfx);

    const bars = HUD_EXPLORE.bars;
    const barCx = bars.x + bars.w * HALF;
    this.hpText = this.mkText(barCx, bars.y + bars.h * HALF, '', FONT_SIZE.hudNumeral, {
      color: HUD_COL.white,
      ox: HALF,
      oy: HALF,
      stroke: TEXT_OUTLINE.body,
      bold: true,
    });
    this.chiText = this.mkText(
      barCx,
      bars.y + bars.h + bars.gap + bars.h * HALF,
      '',
      FONT_SIZE.hudNumeral,
      { color: HUD_COL.white, ox: HALF, oy: HALF, stroke: TEXT_OUTLINE.body, bold: true },
    );
    this.stanceText = this.mkText(
      HUD_EXPLORE.stanceLabel.x,
      HUD_EXPLORE.stanceLabel.y,
      '',
      HUD_TEXT.stance,
      { color: COL.chromeCream, oy: HALF, stroke: TEXT_OUTLINE.body },
    );
    this.statusText = this.mkText(
      HUD_COMBAT.statusText.x,
      HUD_COMBAT.statusText.y,
      'CANNOT CHANGE STANCE',
      HUD_TEXT.status,
      { color: COL.nameRed, oy: HALF, stroke: TEXT_OUTLINE.body, bold: true },
    ).setVisible(false);
    this.buffText = this.mkText(
      HUD_COMBAT.damageBuffText.x,
      HUD_COMBAT.damageBuffText.y,
      '',
      HUD_TEXT.buff,
      { color: COL.nameGold, ox: 1, oy: HALF, stroke: TEXT_OUTLINE.body, bold: true },
    ).setVisible(false);
    this.comboText = this.mkText(
      HUD_COMBAT.comboCounter.x,
      HUD_COMBAT.comboCounter.y,
      '',
      FONT_SIZE.comboNumeral,
      { family: FONT_DISPLAY, color: COL.winRed, ox: HALF, stroke: TEXT_OUTLINE.display },
    );
    this.comboLabel = this.mkText(
      HUD_COMBAT.comboCounter.x,
      HUD_COMBAT.comboCounter.y + FONT_SIZE.comboNumeral + HUD_COMBAT.comboCounter.labelGap,
      'HIT COMBO',
      FONT_SIZE.comboLabel,
      { color: HUD_COL.white, ox: HALF, stroke: TEXT_OUTLINE.body, bold: true },
    ).setVisible(false);
    this.critLabel = this.mkText(
      HUD_CRIT_BAR.x + HUD_CRIT_BAR.w + HUD_CRIT_BAR.labelDx,
      HUD_CRIT_BAR.y + HUD_CRIT_BAR.h * HALF,
      'CRITICAL',
      HUD_TEXT.small,
      { color: COL.nameGold, oy: HALF, stroke: TEXT_OUTLINE.body, bold: true },
    ).setVisible(false);

    this.buildInteractiveZones();

    // Legacy DuelScene wiring: combat mode + YOU/RONIN floating labels (§3 colors).
    if (opts) {
      this.mode = 'combat';
      this.interactiveEnabled = true; // the legacy path has no intro — zones are hot at once
      this.attachNameLabel(opts.player, 'YOU', 'player');
      this.attachNameLabel(opts.enemy, 'RONIN', 'hostile', {
        hp: () => (opts.enemy.maxHealth > 0 ? opts.enemy.health / opts.enemy.maxHealth : 0),
      });
    }
  }

  // ————————————————————————————————————————————————— public API —————

  setMode(mode: HudMode): void {
    if (this.mode !== mode) {
      this.mode = mode;
      this.dirty = true;
    }
  }

  /**
   * Arm/disarm the interactive zones (portrait + skill slots). While DISARMED a pointerdown
   * over a zone neither fires the handler NOR calls stopPropagation, so the click falls
   * through to scene-level listeners — the DuelIntro skip click works over HUD rects, and a
   * dead post-duel HUD cannot swallow result-screen clicks. Arm on FIGHT!, disarm on kill.
   */
  setInteractiveEnabled(on: boolean): this {
    this.interactiveEnabled = on === true;
    return this;
  }

  /**
   * Duel poll-source (sim port contract: meters are polled, not evented). When set it
   * overrides the legacy Fighter/Focus wiring; pass null to detach. The integrator maps
   * sim.player into a HudDuelView each frame.
   */
  setDuelSource(get: (() => HudDuelView) | null): this {
    this.duelSource = get;
    return this;
  }

  /** Stance-swap request handler (portrait click; integrator also routes Space here — Tell 8/23*). */
  onStanceSwap(cb: (() => void) | null): this {
    this.stanceSwapCb = cb;
    return this;
  }

  /** Skill-slot handler — receives the config-mapped skill id (measure: press 1 → 'chiPunch'). */
  onSkillSlot(cb: SkillSlotHandler | null): this {
    this.skillSlotCb = cb;
    return this;
  }

  /** One shared press path for portrait click AND the Space key: flash + callback. */
  requestStanceSwap(): void {
    this.portraitFlashUntil = this.now() + HUD_INTERACT.pressFlashMs;
    this.stanceSwapCb?.();
  }

  /**
   * Fire skill slot 1..N (HUD click or keys 1/2/3 — the integrator's key handler calls
   * this so both inputs share one path). Returns the config skill id, or null on a
   * hostile/invalid slot (non-integer, out of range) — never throws.
   */
  fireSkillSlot(slot: number): SkillId | null {
    if (!Number.isInteger(slot) || slot < 1 || slot > SKILL_SLOTS.length) return null;
    const idx = slot - 1;
    this.slotFlashUntil[idx] = this.now() + HUD_INTERACT.pressFlashMs;
    const id = SKILL_SLOTS[idx].id;
    this.skillSlotCb?.(id, slot);
    return id;
  }

  setHp(cur: number, max: number): void {
    this.data.hpCur = cur;
    this.data.hpMax = max;
  }

  setChi(cur: number, max: number): void {
    this.data.chiCur = cur;
    this.data.chiMax = max;
  }

  /** `stance` is the bare word ("HEAVY") — rendered as "HEAVY STANCE" caps. */
  setStance(stance: string, locked = false, crit = false): void {
    this.data.stance = stance;
    this.data.stanceLocked = locked;
    this.data.crit = crit;
  }

  setCombo(n: number): void {
    this.data.combo = n;
  }

  setCoins(n: number): void {
    this.data.coins = n;
    this.dirty = true;
  }

  setGold(n: number): void {
    this.data.gold = n;
    this.dirty = true;
  }

  setXp(cur: number, max: number, level: number): void {
    this.data.xpCur = cur;
    this.data.xpMax = max;
    this.data.level = level;
    this.dirty = true;
  }

  setLocation(name: string): void {
    this.data.location = name;
    this.dirty = true;
  }

  /** Quest-tracker strips; a `HEAD:` prefix in a line renders gold, the rest cream (§5). */
  setQuest(lines: string[]): void {
    this.data.quest = lines;
    this.dirty = true;
  }

  setMapInfo(territory: string, sector: string): void {
    this.data.territory = territory;
    this.data.sector = sector;
    this.dirty = true;
  }

  /** e.g. "150% DAMAGE 01:32" — gold caps above the skill slots (§4/§6); null hides it. */
  setDamageBuff(label: string | null): void {
    this.data.damageBuff = label;
    this.buffText.setText(label ?? '');
  }

  /** Floating §3 name label that follows `target` (anything with x/y) every update(). */
  attachNameLabel(
    target: { x: number; y: number },
    name: string,
    kind: NameLabelKind,
    opts: NameLabelOpts = {},
  ): NameLabel {
    const label = new NameLabel(this.scene, target, name, kind, opts);
    this.labels.push(label);
    return label;
  }

  /** Call once per frame. `comboCount` kept for the legacy DuelScene call signature. */
  update(comboCount?: number): void {
    if (comboCount !== undefined) this.data.combo = comboCount;
    if (this.duelSource) this.syncDuel(this.duelSource());
    else this.syncLegacy();
    // stance changes retint the portrait rim/tab, which live in the static chrome
    if (this.data.stance !== this.lastStanceDrawn) {
      this.lastStanceDrawn = this.data.stance;
      this.dirty = true;
    }
    if (this.dirty) this.rebuild();
    this.drawDynamic();
    for (const l of this.labels) l.update();
  }

  destroy(): void {
    this.chrome.destroy();
    this.dyn.destroy();
    for (const t of this.chromeTexts) t.destroy();
    for (const t of [
      this.hpText,
      this.chiText,
      this.stanceText,
      this.statusText,
      this.buffText,
      this.comboText,
      this.comboLabel,
      this.critLabel,
    ])
      t.destroy();
    for (const z of this.zones) z.destroy();
    this.zones = [];
    for (const l of this.labels) l.destroy();
    this.labels = [];
    this.duelSource = null;
    this.stanceSwapCb = null;
    this.skillSlotCb = null;
  }

  // ——————————————————————————————————————————— per-frame layer —————

  /** Legacy DuelScene mode: mirror fighter/focus state into the HUD data each frame. */
  private syncLegacy(): void {
    if (!this.opts) return;
    const { player, focus } = this.opts;
    this.data.hpCur = player.health;
    this.data.hpMax = player.maxHealth;
    this.data.chiCur = focus.value;
    this.data.chiMax = FOCUS_MAX;
    this.data.stance = player.stanceId;
    this.data.stanceLocked = !focus.canSwitch();
    this.data.crit = focus.isCrit();
  }

  /** Sim-port mode: mirror the polled duel snapshot; hostile values are neutralized. */
  private syncDuel(v: HudDuelView): void {
    const d = this.data;
    d.hpCur = v.hp;
    d.hpMax = v.hpMax;
    d.chiCur = v.focus;
    d.chiMax = FOCUS_MAX;
    d.critCur = v.critical;
    d.critReady = v.critReady === true;
    d.shunpoCur = v.shunpo;
    d.shunpoActive = v.shunpoActive === true;
    d.stance = typeof v.stance === 'string' ? v.stance : '';
    d.stanceLocked = v.stanceLocked === true;
    d.crit = d.critReady; // legacy ⚡ affordance now follows the Critical meter
    if (Number.isFinite(v.combo)) d.combo = v.combo;
    this.skillViews = v.skills ?? null;
  }

  private drawDynamic(): void {
    const d = this.data;
    const bars = HUD_EXPLORE.bars;
    this.dyn.clear();
    this.bar(this.dyn, bars.x, bars.y, bars.w, bars.h, this.frac(d.hpCur, d.hpMax), COL.healthGreen);
    this.bar(
      this.dyn,
      bars.x,
      bars.y + bars.h + bars.gap,
      bars.w,
      bars.h,
      this.frac(d.chiCur, d.chiMax),
      COL.focusBlue,
    );
    this.hpText.setText(`${Math.round(d.hpCur)} / ${Math.round(d.hpMax)}`);
    this.chiText.setText(`${Math.round(d.chiCur)} / ${Math.round(d.chiMax)}`);
    this.stanceText.setText(`${String(d.stance ?? '').toUpperCase()} STANCE${d.crit ? '  ⚡' : ''}`);
    this.statusText.setVisible(this.mode === 'combat' && d.stanceLocked);
    this.buffText.setVisible(this.mode === 'combat' && d.damageBuff !== null);
    this.critLabel.setVisible(this.mode === 'combat');
    if (this.mode === 'combat') this.drawCombatMeters();

    // combat combo counter (§4/§6): big red brush numeral, pulses when it climbs
    const showCombo = this.mode === 'combat' && d.combo >= 2;
    this.comboText.setText(showCombo ? String(d.combo) : '');
    this.comboLabel.setVisible(showCombo);
    if (showCombo && d.combo > this.lastCombo) {
      this.comboText.setScale(HUD_COMBAT_STYLE.comboPulseScale);
      this.scene.tweens.add({
        targets: this.comboText,
        scale: 1,
        duration: HUD_COMBAT_STYLE.comboPulseMs,
        ease: 'Quad.easeOut',
      });
    }
    this.lastCombo = d.combo;
  }

  /** Combat-only layer: Critical + Shunpo meters and the interactive overlays (§3.8/23*). */
  private drawCombatMeters(): void {
    const d = this.data;
    const g = this.dyn;
    const t = this.now();

    // Critical bar (Tell 7): gold fill; near-white + pulsing gold ring once crit-ready.
    const cb = HUD_CRIT_BAR;
    this.bar(g, cb.x, cb.y, cb.w, cb.h, this.frac(d.critCur, CRITICAL_MAX), d.critReady ? cb.readyFill : cb.fill);
    if (d.critReady) {
      const ph = (Math.sin((t / cb.readyPulseMs) * Math.PI * 2) + 1) * HALF;
      g.lineStyle(HUD_INTERACT.ringW, cb.glowColor, cb.glowAlphaMin + (cb.glowAlphaMax - cb.glowAlphaMin) * ph).strokeRect(
        cb.x - cb.glowPad,
        cb.y - cb.glowPad,
        cb.w + cb.glowPad * 2,
        cb.h + cb.glowPad * 2,
      );
    }

    // Shunpo power strip (Tell 16): teal, brighter while the slow-mo burst is active.
    const sb = HUD_SHUNPO_BAR;
    this.bar(g, sb.x, sb.y, sb.w, sb.h, this.frac(d.shunpoCur, SHUNPO_MAX), d.shunpoActive ? sb.activeFill : sb.fill);

    // Skill slots: cooldown wipe (top-down), disabled dim, hover/press rings.
    const pad = HUD_BARS.pad;
    SKILL_SLOT_RECTS.forEach((r, i) => {
      const sv = this.skillViews?.[i];
      const cd = this.frac(sv ? sv.cooldownFrac : 0, 1);
      if (cd > 0)
        g.fillStyle(COL.vignetteBlack, HUD_INTERACT.cooldownAlpha).fillRect(
          r.x + pad,
          r.y + pad,
          r.w - pad * 2,
          (r.h - pad * 2) * cd,
        );
      if (sv && sv.enabled !== true)
        g.fillStyle(COL.vignetteBlack, HUD_INTERACT.disabledAlpha).fillRect(
          r.x + pad,
          r.y + pad,
          r.w - pad * 2,
          r.h - pad * 2,
        );
      const pressed = t < this.slotFlashUntil[i];
      if (pressed || this.slotHover === i)
        g.lineStyle(
          HUD_INTERACT.ringW,
          COL.goldTrim,
          pressed ? HUD_INTERACT.pressAlpha : HUD_INTERACT.hoverAlpha,
        ).strokeRoundedRect(
          r.x - HUD_INTERACT.ringPad,
          r.y - HUD_INTERACT.ringPad,
          r.w + HUD_INTERACT.ringPad * 2,
          r.h + HUD_INTERACT.ringPad * 2,
          HUD_COMBAT_STYLE.slotRadius,
        );
    });

    // Portrait hover/press ring — the click-to-swap affordance (Tell 8/23*).
    const hz = STANCE_PORTRAIT_HIT;
    const pPressed = t < this.portraitFlashUntil;
    if (pPressed || this.portraitHover)
      g.lineStyle(
        HUD_INTERACT.ringW,
        COL.goldTrim,
        pPressed ? HUD_INTERACT.pressAlpha : HUD_INTERACT.hoverAlpha,
      ).strokeRoundedRect(
        hz.x - HUD_INTERACT.ringPad,
        hz.y - HUD_INTERACT.ringPad,
        hz.w + HUD_INTERACT.ringPad * 2,
        hz.h + HUD_INTERACT.ringPad * 2,
        HUD_CHROME.radius,
      );
  }

  /** Clamped 0..1 fill fraction; NaN/Infinity/negative inputs collapse to 0 (chaos guard). */
  private frac(cur: number, max: number): number {
    const f = max > 0 ? cur / max : 0;
    return Number.isFinite(f) ? Math.max(0, Math.min(1, f)) : 0;
  }

  /** Scene clock, hardened to a finite number (drives press flashes + the ready pulse). */
  private now(): number {
    const t = this.scene.time?.now;
    return typeof t === 'number' && Number.isFinite(t) ? t : 0;
  }

  // ————————————————————————————————— interactive zones (combat) —————

  /** Portrait click-to-swap + 3 clickable skill slots; handlers only fire in combat mode. */
  private buildInteractiveZones(): void {
    this.addZone(
      STANCE_PORTRAIT_HIT,
      (h) => (this.portraitHover = h),
      () => this.requestStanceSwap(),
    );
    SKILL_SLOT_RECTS.forEach((r, i) => {
      this.addZone(
        r,
        (h) => (this.slotHover = h ? i : this.slotHover === i ? -1 : this.slotHover),
        () => this.fireSkillSlot(i + 1),
      );
    });
  }

  private addZone(
    r: { x: number; y: number; w: number; h: number },
    hover: (over: boolean) => void,
    down: () => void,
  ): void {
    const z = this.scene.add
      .zone(r.x, r.y, r.w, r.h)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    z.on('pointerover', () => hover(true));
    z.on('pointerout', () => hover(false));
    z.on(
      'pointerdown',
      (_p: unknown, _lx: unknown, _ly: unknown, ev?: { stopPropagation?: () => void }) => {
        // return BEFORE stopPropagation while disarmed/non-combat — the click must fall
        // through to the scene (intro fast-forward, GestureInput) instead of dying here
        if (this.mode !== 'combat' || !this.interactiveEnabled) return;
        ev?.stopPropagation?.(); // keep live-combat HUD clicks from also starting a slash stroke
        down();
      },
    );
    this.zones.push(z);
  }

  // ——————————————————————————————————————— static chrome rebuild —————

  private rebuild(): void {
    this.dirty = false;
    this.chrome.clear();
    for (const t of this.chromeTexts) t.destroy();
    this.chromeTexts = [];

    this.drawPortrait();
    if (this.mode === 'explore') {
      this.drawTopLeftPlates();
      this.drawLocationAndQuests();
      this.drawXp();
      this.drawMinimap();
      this.drawHotbar();
    } else {
      this.drawAutoSlashPill();
      this.drawPause();
      this.drawSkillSlots();
      this.drawFleeArrow();
    }
  }

  // ————— shared helpers —————

  private mkText(
    x: number,
    y: number,
    str: string,
    size: number,
    o: TextOpts = {},
  ): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(x, y, str, {
        fontFamily: o.family ?? FONT_BODY,
        fontSize: `${size}px`,
        fontStyle: o.bold ? 'bold' : undefined,
        color: hexCss(o.color ?? COL.chromeCream),
        align: o.align,
      })
      .setOrigin(o.ox ?? 0, o.oy ?? 0)
      .setDepth(HUD_DEPTH.text);
    if (o.stroke) t.setStroke(hexCss(COL.outline), o.stroke);
    return t;
  }

  private chromeText(
    x: number,
    y: number,
    str: string,
    size: number,
    o: TextOpts = {},
  ): Phaser.GameObjects.Text {
    const t = this.mkText(x, y, str, size, o);
    this.chromeTexts.push(t);
    return t;
  }

  /** Dark rounded plate with a thin gold border (§5 plate chrome). */
  private plate(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: number = COL.panelInk,
  ): void {
    g.fillStyle(fill, HUD_CHROME.plateAlpha).fillRoundedRect(x, y, w, h, HUD_CHROME.radius);
    g.lineStyle(HUD_CHROME.borderW, COL.goldTrim, HUD_CHROME.borderAlpha).strokeRoundedRect(
      x,
      y,
      w,
      h,
      HUD_CHROME.radius,
    );
  }

  /** Outlined inset bar (same anatomy as the pre-overhaul build). */
  private bar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    frac: number,
    color: number,
  ): void {
    const p = HUD_BARS.pad;
    g.fillStyle(COL.outline, HUD_BARS.outlineAlpha).fillRect(x - p, y - p, w + p * 2, h + p * 2);
    g.fillStyle(HUD_COL.barBack, 1).fillRect(x, y, w, h);
    g.fillStyle(color, 1).fillRect(x, y, Math.max(0, w * frac), h);
  }

  // ————— bottom-left portrait (both modes) —————

  private drawPortrait(): void {
    const g = this.chrome;
    const p = HUD_EXPLORE.portrait;
    const cx = p.x + p.w * HALF;
    const cy = p.y + p.h * HALF;
    const b = HUD_BUST;
    // dark gold-trimmed rounded frame
    this.plate(g, p.x, p.y, p.w, p.h);
    g.fillStyle(HUD_COL.bustBg, 1).fillRoundedRect(
      p.x + b.inset,
      p.y + b.inset,
      p.w - b.inset * 2,
      p.h - b.inset * 2,
      HUD_CHROME.radius - HUD_BARS.pad,
    );
    // painted-bust placeholder: shoulders, head, kasa (§5)
    g.fillStyle(COL.kimono, 1).fillEllipse(cx, cy + b.shoulderDy, b.shoulderW, b.shoulderH);
    g.fillStyle(COL.kimonoShade, 1).fillEllipse(
      cx,
      cy + b.shoulderDy + b.inset,
      b.shoulderW,
      b.shoulderH * HALF,
    );
    g.fillStyle(COL.skin, 1).fillCircle(cx, cy + b.headDy, b.headR);
    g.fillStyle(COL.hatShade, 1).fillEllipse(cx, cy + b.hatDy, b.hatW, b.hatH);
    g.fillStyle(COL.hatStraw, 1).fillTriangle(
      cx - b.hatW * HALF,
      cy + b.hatDy,
      cx + b.hatW * HALF,
      cy + b.hatDy,
      cx,
      cy + b.hatDy - b.hatRise,
    );
    // inner gold trim line
    g.lineStyle(1, COL.goldTrim, HALF).strokeRoundedRect(
      p.x + b.inset,
      p.y + b.inset,
      p.w - b.inset * 2,
      p.h - b.inset * 2,
      HUD_CHROME.radius - HUD_BARS.pad,
    );
    // stance identity (Tell 8/23*): colored inner rim + bottom tab — the clickable
    // portrait visibly reflects the current stance (light/balanced/heavy coding).
    const sc =
      (HUD_STANCE_COLORS as Record<string, number>)[String(this.data.stance ?? '').toLowerCase()] ??
      COL.goldTrim;
    g.lineStyle(HUD_STANCE_MARK.rimW, sc, HUD_STANCE_MARK.rimAlpha).strokeRoundedRect(
      p.x + b.inset,
      p.y + b.inset,
      p.w - b.inset * 2,
      p.h - b.inset * 2,
      HUD_CHROME.radius - HUD_BARS.pad,
    );
    g.fillStyle(sc, HUD_STANCE_MARK.tabAlpha).fillRoundedRect(
      p.x + b.inset,
      p.y + p.h - b.inset - HUD_STANCE_MARK.tabH,
      p.w - b.inset * 2,
      HUD_STANCE_MARK.tabH,
      HUD_STANCE_MARK.tabH * HALF,
    );
  }

  // ————— explore: top-left plates —————

  private drawTopLeftPlates(): void {
    const g = this.chrome;
    const c = HUD_EXPLORE.coinsPlate;
    const go = HUD_EXPLORE.goldPlate;
    const s = HUD_EXPLORE.goldSlot;

    // coins plate: mallet icon + count + tiny COINS caps
    this.plate(g, c.x, c.y, c.w, c.h);
    const mx = c.x + HUD_PLATE.iconCx;
    const my = c.y + c.h * HALF;
    g.fillStyle(COL.mineProp, 1).fillRect(
      mx - 1,
      my - HUD_PLATE.malletH * HALF,
      HUD_BARS.pad,
      HUD_PLATE.malletHandle,
    );
    g.fillStyle(COL.blade, 1).fillRoundedRect(
      mx - HUD_PLATE.malletW * HALF,
      my - HUD_PLATE.malletH,
      HUD_PLATE.malletW,
      HUD_PLATE.malletH,
      HUD_BARS.pad,
    );
    this.chromeText(c.x + HUD_PLATE.valueX, c.y + HUD_PLATE.valueDy, String(this.data.coins), HUD_TEXT.plateValue, {
      color: HUD_COL.white,
      oy: HALF,
      stroke: TEXT_OUTLINE.body,
      bold: true,
    });
    this.chromeText(c.x + HUD_PLATE.valueX, c.y + HUD_PLATE.labelDy, 'COINS', HUD_TEXT.small, {
      oy: HALF,
    });

    // gold plate: coin icon + count + GOLD caps
    this.plate(g, go.x, go.y, go.w, go.h);
    const gx = go.x + HUD_PLATE.iconCx;
    g.fillStyle(COL.coinGold, 1).fillCircle(gx, my, HUD_PLATE.coinR);
    g.lineStyle(1, COL.obiShade, 1).strokeCircle(gx, my, HUD_PLATE.coinR - HUD_BARS.pad);
    this.chromeText(go.x + HUD_PLATE.valueX, go.y + HUD_PLATE.valueDy, String(this.data.gold), HUD_TEXT.plateValue, {
      color: HUD_COL.white,
      oy: HALF,
      stroke: TEXT_OUTLINE.body,
      bold: true,
    });
    this.chromeText(go.x + HUD_PLATE.valueX, go.y + HUD_PLATE.labelDy, 'GOLD', HUD_TEXT.small, {
      oy: HALF,
    });

    // small red slot — repurposed earn-only gold (§5 note)
    this.plate(g, s.x, s.y, s.w, s.h, COL.buttonRed);
    this.chromeText(s.x + s.w * HALF, s.y + s.h * HALF, 'EARN\nGOLD', HUD_TEXT.small, {
      ox: HALF,
      oy: HALF,
      align: 'center',
      bold: true,
    });
  }

  // ————— explore: location banner + quest tracker —————

  private drawLocationAndQuests(): void {
    const g = this.chrome;
    const b = HUD_EXPLORE.locationBanner;
    // black rounded bar, DOUBLE gold outline, cream brush caps (§5)
    this.plate(g, b.x, b.y, b.w, b.h);
    const i = HUD_CHROME.bannerInnerInset;
    g.lineStyle(1, COL.goldTrim, HUD_CHROME.borderAlpha).strokeRoundedRect(
      b.x + i,
      b.y + i,
      b.w - i * 2,
      b.h - i * 2,
      HUD_CHROME.radius - i,
    );
    this.chromeText(
      b.x + b.w * HALF,
      b.y + b.h * HALF,
      this.data.location.toUpperCase(),
      FONT_SIZE.banner,
      { family: FONT_DISPLAY, color: COL.chromeCream, ox: HALF, oy: HALF, stroke: TEXT_OUTLINE.body },
    );

    // quest tracker: translucent dark strips, gold `HEAD:` + cream text (§5)
    const q = HUD_EXPLORE.questTracker;
    this.data.quest.forEach((line, n) => {
      const y = q.y + n * (q.lineH + HUD_TEXT.questGap);
      const cyLine = y + q.lineH * HALF;
      const split = line.indexOf(':');
      const head = split >= 0 ? line.slice(0, split + 1) : '';
      const tail = split >= 0 ? line.slice(split + 1).trim() : line;
      let x = q.x + HUD_CHROME.textPad;
      let width = HUD_CHROME.textPad * 2;
      if (head) {
        const ht = this.chromeText(x, cyLine, head.toUpperCase(), FONT_SIZE.comboLabel, {
          color: COL.nameGold,
          oy: HALF,
          stroke: TEXT_OUTLINE.body,
          bold: true,
        });
        x += ht.width + HUD_CHROME.textPad * HALF;
        width += ht.width + HUD_CHROME.textPad * HALF;
      }
      const tt = this.chromeText(x, cyLine, tail.toUpperCase(), FONT_SIZE.comboLabel, {
        oy: HALF,
        stroke: TEXT_OUTLINE.body,
      });
      width += tt.width;
      g.fillStyle(COL.vignetteBlack, HUD_CHROME.stripAlpha).fillRoundedRect(
        q.x,
        y,
        Math.max(q.w * HALF, width),
        q.lineH,
        HUD_CHROME.radius * HALF,
      );
    });
  }

  // ————— explore: XP badge + bar (top-right) —————

  private drawXp(): void {
    const g = this.chrome;
    const bar = HUD_EXPLORE.xpBar;
    const badge = HUD_EXPLORE.levelBadge;

    this.plate(g, bar.x, bar.y, bar.w, bar.h);
    const fi = HUD_XP.fillInset;
    g.fillStyle(COL.gold, 1).fillRect(
      bar.x + fi,
      bar.y + fi,
      Math.max(0, (bar.w - fi * 2) * this.frac(this.data.xpCur, this.data.xpMax)),
      bar.h - fi * 2,
    );
    this.chromeText(
      bar.x + bar.w * HALF,
      bar.y + bar.h * HALF,
      `${Math.round(this.data.xpCur)} / ${Math.round(this.data.xpMax)}`,
      FONT_SIZE.hudNumeral,
      { color: HUD_COL.white, ox: HALF, oy: HALF, stroke: TEXT_OUTLINE.body, bold: true },
    );
    this.chromeText(
      bar.x + bar.w * HALF,
      bar.y + bar.h + HUD_XP.labelDy,
      'EXPERIENCE POINTS',
      HUD_TEXT.small,
      { ox: HALF },
    );

    // gold shield level badge
    const pts = HUD_XP.shieldPts.map(
      ([fx, fy]) => new Phaser.Geom.Point(badge.x + fx * badge.size, badge.y + fy * badge.size),
    );
    g.fillStyle(COL.goldTrim, 1).fillPoints(pts, true);
    g.lineStyle(HUD_CHROME.borderW, COL.outline, 1).strokePoints(pts, true, true);
    this.chromeText(
      badge.x + badge.size * HALF,
      badge.y + badge.size * HUD_XP.shieldNumFrac,
      String(this.data.level),
      HUD_TEXT.level,
      { family: FONT_DISPLAY, color: COL.panelInk, ox: HALF, oy: HALF },
    );
  }

  // ————— explore: ornate minimap panel + TERRITORY/SECTOR plates —————

  private drawMinimap(): void {
    const g = this.chrome;
    const m = HUD_EXPLORE.minimap;
    const mm = HUD_MINIMAP;

    // panel + ornate double gold frame with corner/edge knobs
    g.fillStyle(COL.panelInk, 1).fillRoundedRect(m.x, m.y, m.w, m.h, HUD_CHROME.radius);
    g.lineStyle(mm.rimW, COL.goldTrim, 1).strokeRoundedRect(m.x, m.y, m.w, m.h, HUD_CHROME.radius);
    g.lineStyle(1, COL.goldTrim, HUD_CHROME.borderAlpha).strokeRoundedRect(
      m.x + mm.rimInset,
      m.y + mm.rimInset,
      m.w - mm.rimInset * 2,
      m.h - mm.rimInset * 2,
      HUD_CHROME.radius - HUD_BARS.pad,
    );
    g.fillStyle(COL.goldTrim, 1);
    for (const fx of [0, HALF, 1]) {
      for (const fy of [0, HALF, 1]) {
        if (fx === HALF && fy === HALF) continue;
        g.fillCircle(m.x + fx * m.w, m.y + fy * m.h, mm.knobR);
      }
    }

    // compass letters on the rim (§5)
    const cxm = m.x + m.w * HALF;
    const cym = m.y + m.h * HALF;
    const comp: Array<[string, number, number]> = [
      ['N', cxm, m.y + mm.compassInset],
      ['S', cxm, m.y + m.h - mm.compassInset],
      ['W', m.x + mm.compassInset, cym],
      ['E', m.x + m.w - mm.compassInset, cym],
    ];
    for (const [ch, x, y] of comp)
      this.chromeText(x, y, ch, HUD_TEXT.compass, {
        color: COL.goldTrim,
        ox: HALF,
        oy: HALF,
        bold: true,
      });

    // dark sector-grid field with stub icons + gold highlight cell (fake data for now)
    const fx0 = m.x + mm.fieldInset;
    const fy0 = m.y + mm.fieldInset;
    const fw = m.w - mm.fieldInset * 2;
    const fh = m.h - mm.fieldInset * 2;
    g.fillStyle(HUD_COL.mapField, 1).fillRect(fx0, fy0, fw, fh);
    const cw = fw / mm.cols;
    const ch = fh / mm.rows;
    g.lineStyle(1, HUD_COL.mapGrid, mm.gridAlpha);
    for (let c = 1; c < mm.cols; c++) g.lineBetween(fx0 + c * cw, fy0, fx0 + c * cw, fy0 + fh);
    for (let r = 1; r < mm.rows; r++) g.lineBetween(fx0, fy0 + r * ch, fx0 + fw, fy0 + r * ch);
    for (let c = 0; c < mm.cols; c++) {
      for (let r = 0; r < mm.rows; r++) {
        const k = (c * mm.iconSeedA + r * mm.iconSeedB) % mm.iconMod;
        const ix = fx0 + c * cw + mm.iconPad;
        const iy = fy0 + r * ch + mm.iconPad;
        const iw = cw - mm.iconPad * 2;
        const ih = ch - mm.iconPad * 2;
        if (k === 0) {
          g.fillStyle(COL.chromeCream, mm.gridAlpha).fillRect(ix, iy, iw, ih);
        } else if (k === 1) {
          g.fillStyle(COL.goldTrim, HALF).fillCircle(ix + iw * HALF, iy + ih * HALF, mm.knobR);
        } else if (k === 2 && (c + r) % 2 === 0) {
          g.lineStyle(HUD_BARS.pad, COL.nameRed, HALF);
          g.lineBetween(ix, iy, ix + iw, iy + ih);
          g.lineBetween(ix + iw, iy, ix, iy + ih);
        }
      }
    }
    const hx = fx0 + mm.highlightC * cw;
    const hy = fy0 + mm.highlightR * ch;
    g.fillStyle(COL.goldTrim, mm.highlightAlpha).fillRect(hx, hy, cw, ch);
    g.lineStyle(HUD_CHROME.borderW, COL.goldTrim, 1).strokeRect(hx, hy, cw, ch);
    g.fillStyle(COL.goldTrim, 1).fillTriangle(
      hx + cw * HALF - mm.markerR,
      hy + ch * HALF - mm.markerR,
      hx + cw * HALF - mm.markerR,
      hy + ch * HALF + mm.markerR,
      hx + cw * HALF + mm.markerR,
      hy + ch * HALF,
    );

    // TERRITORY / SECTOR plates beneath (§5)
    const lb = HUD_EXPLORE.minimapLabels;
    const rows: Array<[string, number]> = [
      [`TERRITORY (${this.data.territory})`, lb.y],
      [`SECTOR (${this.data.sector})`, lb.y + lb.h + lb.gap],
    ];
    for (const [label, y] of rows) {
      g.fillStyle(COL.vignetteBlack, HUD_CHROME.stripAlpha).fillRoundedRect(
        lb.x,
        y,
        lb.w,
        lb.h,
        HUD_CHROME.radius * HALF,
      );
      this.chromeText(lb.x + lb.w * HALF, y + lb.h * HALF, label, HUD_TEXT.mapLabel, {
        ox: HALF,
        oy: HALF,
        stroke: TEXT_OUTLINE.body,
      });
    }
  }

  // ————— explore: bottom hotbar of round slots ending in a gear —————

  private drawHotbar(): void {
    const g = this.chrome;
    const hb = HUD_EXPLORE.hotbar;
    const r = hb.slotSize * HALF;
    const step = (hb.endX - hb.startX) / (hb.slotCount - 1);
    for (let i = 0; i < hb.slotCount; i++) {
      const cx = hb.startX + i * step;
      g.fillStyle(HUD_COL.slotFill, 1).fillCircle(cx, hb.y, r);
      g.fillStyle(HUD_COL.slotShade, 1).fillCircle(cx, hb.y + HUD_BARS.pad, r - HUD_BARS.pad * 2);
      g.lineStyle(HUD_GLYPH.slotRingW, HUD_COL.slotRing, 1).strokeCircle(cx, hb.y, r);
      this.slotGlyph(g, i, hb.slotCount, cx, hb.y);
    }
  }

  /** Simple vector glyphs per slot; the LAST slot is always the settings gear (§5). */
  private slotGlyph(
    g: Phaser.GameObjects.Graphics,
    i: number,
    count: number,
    cx: number,
    cy: number,
  ): void {
    const gl = HUD_GLYPH;
    const order = ['chat', 'food', 'yinyang', 'rack', 'scroll', 'stones', 'mask', 'envelope'];
    const kind = i === count - 1 ? 'gear' : order[i % order.length];
    switch (kind) {
      case 'gear':
        g.fillStyle(COL.blade, 1);
        for (let t = 0; t < gl.gearTeeth; t++) {
          const a = (t / gl.gearTeeth) * Math.PI * 2;
          g.fillCircle(cx + Math.cos(a) * gl.gearR, cy + Math.sin(a) * gl.gearR, gl.gearToothR);
        }
        g.fillCircle(cx, cy, gl.gearR);
        g.fillStyle(HUD_COL.slotShade, 1).fillCircle(cx, cy, gl.gearHoleR);
        break;
      case 'chat':
        g.fillStyle(COL.chromeCream, 1);
        for (let d = 0; d < gl.chatDots; d++)
          g.fillCircle(cx + (d - 1) * gl.chatDotGap, cy, gl.chatDotR);
        break;
      case 'food':
        g.fillStyle(COL.mineProp, 1).fillEllipse(cx, cy, gl.bunW, gl.bunH);
        g.fillStyle(COL.hatStraw, 1).fillEllipse(cx, cy - gl.bunH * HALF * HALF, gl.bunW, gl.bunH * HALF);
        break;
      case 'yinyang':
        g.fillStyle(COL.chromeCream, 1).fillCircle(cx, cy, gl.yinR);
        g.fillStyle(COL.panelInk, 1)
          .slice(cx, cy, gl.yinR, Math.PI * HALF, Math.PI + Math.PI * HALF)
          .fillPath();
        g.fillStyle(COL.chromeCream, 1).fillCircle(cx, cy - gl.yinDotOff, gl.yinDotR);
        g.fillStyle(COL.panelInk, 1).fillCircle(cx, cy + gl.yinDotOff, gl.yinDotR);
        break;
      case 'rack':
        g.fillStyle(COL.mineProp, 1);
        g.fillRect(cx - gl.rackW * HALF, cy - gl.rackH * HALF, gl.rackBarH, gl.rackH);
        g.fillRect(cx + gl.rackW * HALF - gl.rackBarH, cy - gl.rackH * HALF, gl.rackBarH, gl.rackH);
        g.fillRect(cx - gl.rackW * HALF, cy - gl.rackH * HALF, gl.rackW, gl.rackBarH);
        g.fillRect(cx - gl.rackW * HALF, cy, gl.rackW, gl.rackBarH);
        break;
      case 'scroll':
        g.fillStyle(COL.chromeCream, 1).fillRect(
          cx - gl.scrollW * HALF,
          cy - gl.scrollH * HALF,
          gl.scrollW,
          gl.scrollH,
        );
        g.fillStyle(COL.mineProp, 1);
        g.fillCircle(cx - gl.scrollW * HALF, cy, gl.scrollEndR);
        g.fillCircle(cx + gl.scrollW * HALF, cy, gl.scrollEndR);
        break;
      case 'stones':
        g.fillStyle(COL.paleRock, 1);
        for (let s = 0; s < gl.stoneCount; s++)
          g.fillCircle(cx + (s - 1) * gl.stoneSpread, cy + (s % 2) * gl.stoneR - gl.stoneR * HALF, gl.stoneR);
        break;
      case 'mask':
        g.fillStyle(COL.panelInk, 1).fillRoundedRect(
          cx - gl.maskW * HALF,
          cy - gl.maskH * HALF,
          gl.maskW,
          gl.maskH,
          gl.maskEyeH,
        );
        g.fillStyle(COL.chromeCream, 1);
        g.fillRect(cx - gl.maskEyeW - 1, cy - gl.maskEyeH, gl.maskEyeW, gl.maskEyeH);
        g.fillRect(cx + 1, cy - gl.maskEyeH, gl.maskEyeW, gl.maskEyeH);
        break;
      default:
        // red envelope
        g.fillStyle(COL.buttonRed, 1).fillRoundedRect(
          cx - gl.envW * HALF,
          cy - gl.envH * HALF,
          gl.envW,
          gl.envH,
          HUD_BARS.pad,
        );
        g.lineStyle(1, COL.goldTrim, 1);
        g.lineBetween(cx - gl.envW * HALF, cy - gl.envH * HALF, cx, cy);
        g.lineBetween(cx + gl.envW * HALF, cy - gl.envH * HALF, cx, cy);
    }
  }

  // ————— combat: top-left AUTO SLASH pill + chat bubble —————

  private drawAutoSlashPill(): void {
    const g = this.chrome;
    const p = HUD_COMBAT.autoSlashPill;
    g.fillStyle(COL.buttonRed, 1).fillRoundedRect(p.x, p.y, p.w, p.h, p.h * HALF);
    g.lineStyle(1, COL.goldTrim, HUD_CHROME.borderAlpha).strokeRoundedRect(
      p.x,
      p.y,
      p.w,
      p.h,
      p.h * HALF,
    );
    this.chromeText(p.x + p.w * HALF, p.y + p.h * HALF, 'AUTO SLASH OFF', HUD_TEXT.stance, {
      ox: HALF,
      oy: HALF,
      stroke: TEXT_OUTLINE.body,
      bold: true,
    });

    const cb = HUD_COMBAT.chatButton;
    const cs = HUD_COMBAT_STYLE;
    g.fillStyle(COL.chromeCream, 1).fillRoundedRect(cb.x, cb.y, cb.size, cb.size, HUD_CHROME.radius);
    g.fillStyle(COL.chromeCream, 1).fillTriangle(
      cb.x + cs.bubbleTail,
      cb.y + cb.size - 1,
      cb.x + cs.bubbleTail * 2,
      cb.y + cb.size - 1,
      cb.x + cs.bubbleTail,
      cb.y + cb.size + cs.bubbleTail,
    );
    g.fillStyle(COL.panelInk, 1);
    for (let d = 0; d < HUD_GLYPH.chatDots; d++)
      g.fillCircle(cb.x + cb.size * HALF + (d - 1) * (cs.bubbleDotR * 2 + HUD_BARS.pad), cb.y + cb.size * HALF, cs.bubbleDotR);
  }

  // ————— combat: top-right pause icon (combo texts are dynamic) —————

  private drawPause(): void {
    const g = this.chrome;
    const p = HUD_COMBAT.pauseButton;
    const cs = HUD_COMBAT_STYLE;
    const cx = p.x + p.size * HALF;
    const cy = p.y + p.size * HALF;
    g.fillStyle(HUD_COL.white, HUD_CHROME.borderAlpha);
    g.fillRoundedRect(cx - cs.pauseBarGap * HALF - cs.pauseBarW, cy - cs.pauseBarH * HALF, cs.pauseBarW, cs.pauseBarH, 1);
    g.fillRoundedRect(cx + cs.pauseBarGap * HALF, cy - cs.pauseBarH * HALF, cs.pauseBarW, cs.pauseBarH, 1);
  }

  // ————— combat: bottom-right skill slots + flee arrow —————

  /** 3 numbered slots (§6): geometry + key hints + skill ids all from SKILL_SLOTS config. */
  private drawSkillSlots(): void {
    const g = this.chrome;
    const cs = HUD_COMBAT_STYLE;
    SKILL_SLOT_RECTS.forEach((r, i) => {
      g.fillStyle(HUD_COL.slotFill, 1).fillRoundedRect(r.x, r.y, r.w, r.h, cs.slotRadius);
      g.fillStyle(HUD_COL.slotShade, 1).fillRoundedRect(
        r.x + HUD_BARS.pad,
        r.y + HUD_BARS.pad,
        r.w - HUD_BARS.pad * 2,
        r.h - HUD_BARS.pad * 2,
        cs.slotRadius - HUD_BARS.pad,
      );
      g.lineStyle(HUD_GLYPH.slotRingW, HUD_COL.slotRing, 1).strokeRoundedRect(
        r.x,
        r.y,
        r.w,
        r.h,
        cs.slotRadius,
      );
      this.skillGlyph(g, SKILL_SLOTS[i].id, r.x + r.w * HALF, r.y + r.h * HALF);
      this.chromeText(r.x + r.w, r.y - cs.slotNumDy, SKILL_SLOTS[i].key, HUD_TEXT.slotNumber, {
        color: COL.nameGold,
        ox: 1,
        oy: 1,
        stroke: TEXT_OUTLINE.body,
        bold: true,
      });
    });
  }

  /** Own-expression vector icons per skill id (chi burst / smoke puff / downward stab). */
  private skillGlyph(g: Phaser.GameObjects.Graphics, id: SkillId, cx: number, cy: number): void {
    const gl = HUD_SKILL_GLYPH;
    switch (id) {
      case 'chiPunch':
        g.fillStyle(gl.chiColor, gl.alpha).fillCircle(cx, cy, gl.chiCoreR);
        g.lineStyle(HUD_INTERACT.ringW, gl.chiColor, gl.alpha * HALF).strokeCircle(cx, cy, gl.chiRingR);
        break;
      case 'smokeBomb':
        g.fillStyle(gl.smokeColor, gl.alpha);
        g.fillCircle(cx - gl.puffDx, cy + gl.puffDy * HALF, gl.puffR);
        g.fillCircle(cx + gl.puffDx, cy + gl.puffDy * HALF, gl.puffR);
        g.fillCircle(cx, cy - gl.puffDy, gl.puffR);
        break;
      default: // 'stab' — downward blade over a gold crossguard
        g.fillStyle(gl.stabColor, gl.alpha).fillTriangle(
          cx - gl.bladeW * HALF,
          cy - gl.bladeH * HALF,
          cx + gl.bladeW * HALF,
          cy - gl.bladeH * HALF,
          cx,
          cy + gl.bladeH * HALF,
        );
        g.fillStyle(gl.guardColor, gl.alpha).fillRect(
          cx - gl.guardW * HALF,
          cy - gl.bladeH * HALF - gl.guardH,
          gl.guardW,
          gl.guardH,
        );
    }
  }

  private drawFleeArrow(): void {
    const g = this.chrome;
    const f = HUD_COMBAT.fleeArrow;
    const cs = HUD_COMBAT_STYLE;
    g.fillStyle(HUD_COL.slotFill, 1).fillRoundedRect(f.x, f.y, f.w, f.h, cs.slotRadius);
    g.lineStyle(HUD_GLYPH.slotRingW, COL.goldTrim, 1).strokeRoundedRect(f.x, f.y, f.w, f.h, cs.slotRadius);
    const cx = f.x + f.w * HALF;
    const topY = f.y + (f.h - cs.arrowHeadH - cs.arrowStemH) * HALF;
    g.fillStyle(COL.goldTrim, 1);
    g.fillTriangle(
      cx - cs.arrowHeadW * HALF,
      topY + cs.arrowHeadH,
      cx + cs.arrowHeadW * HALF,
      topY + cs.arrowHeadH,
      cx,
      topY,
    );
    g.fillRect(cx - cs.arrowStemW * HALF, topY + cs.arrowHeadH, cs.arrowStemW, cs.arrowStemH);
  }
}
