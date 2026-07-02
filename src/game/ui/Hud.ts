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
} from '../../config/hud-extra';
import { Focus, FOCUS_MAX } from '../../core/focus';
import { Fighter } from '../fighter/Fighter';
import { NameLabel, NameLabelKind, NameLabelOpts } from './NameLabel';

const HALF = 1 / 2;

export type HudMode = 'explore' | 'combat';

/** Legacy wiring (DuelScene): the HUD pulls HP/Chi/stance from these every frame. */
type HudOpts = { player: Fighter; enemy: Fighter; focus: Focus };

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
  private lastCombo = 0;

  private data = {
    hpCur: HUD_FAKE.hpCur as number,
    hpMax: HUD_FAKE.hpMax as number,
    chiCur: HUD_FAKE.chiCur as number,
    chiMax: HUD_FAKE.chiMax as number,
    stance: HUD_FAKE.stance as string,
    stanceLocked: false,
    crit: false,
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

    // Legacy DuelScene wiring: combat mode + YOU/RONIN floating labels (§3 colors).
    if (opts) {
      this.mode = 'combat';
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
    this.syncLegacy();
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
    ])
      t.destroy();
    for (const l of this.labels) l.destroy();
    this.labels = [];
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
    this.stanceText.setText(`${d.stance.toUpperCase()} STANCE${d.crit ? '  ⚡' : ''}`);
    this.statusText.setVisible(this.mode === 'combat' && d.stanceLocked);
    this.buffText.setVisible(this.mode === 'combat' && d.damageBuff !== null);

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

  private frac(cur: number, max: number): number {
    return max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
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

  private drawSkillSlots(): void {
    const g = this.chrome;
    const ss = HUD_COMBAT.skillSlots;
    const cs = HUD_COMBAT_STYLE;
    for (let i = 0; i < ss.count; i++) {
      const x = ss.endX - (ss.count - i) * ss.size - (ss.count - 1 - i) * ss.gap;
      g.fillStyle(HUD_COL.slotFill, 1).fillRoundedRect(x, ss.y, ss.size, ss.size, cs.slotRadius);
      g.fillStyle(HUD_COL.slotShade, 1).fillRoundedRect(
        x + HUD_BARS.pad,
        ss.y + HUD_BARS.pad,
        ss.size - HUD_BARS.pad * 2,
        ss.size - HUD_BARS.pad * 2,
        cs.slotRadius - HUD_BARS.pad,
      );
      g.lineStyle(HUD_GLYPH.slotRingW, HUD_COL.slotRing, 1).strokeRoundedRect(
        x,
        ss.y,
        ss.size,
        ss.size,
        cs.slotRadius,
      );
      this.chromeText(x + ss.size, ss.y - cs.slotNumDy, String(i + 1), HUD_TEXT.slotNumber, {
        color: COL.nameGold,
        ox: 1,
        oy: 1,
        stroke: TEXT_OUTLINE.body,
        bold: true,
      });
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
