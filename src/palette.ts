// Exact eyedropped fidelity targets from the reference pack (0xRRGGBB).
// These are OUR palette for OUR re-created art — see docs/superpowers/specs.
export const COL = {
  skyTop: 0xd8dbf1,
  skyLow: 0xeceffe,
  forestBright: 0x49a431,
  forestMid: 0x2e922e,
  forestMid2: 0x31a030,
  forestShadow: 0x1d7330,
  forestDark: 0x173012,
  sage: 0x62905e,
  sage2: 0x78a760,
  kimono: 0xf4f3ec, // brighter off-white
  kimono2: 0xe9eddb,
  kimonoShade: 0xccd0c6, // cool grey fold shadow (cel second tone)
  haori: 0x2b3b5e, // navy hooded jacket
  haoriShade: 0x1a2742,
  haoriTrim: 0xb5392f, // red inner lining accent
  obi: 0xd9a93a, // gold sash
  obiShade: 0xa97c22,
  hair: 0x241f1b,
  hatStraw: 0xbb9450, // tan woven kasa
  hatShade: 0x7c5c28,
  wood: 0x794702,
  outline: 0x040304,
  blood: 0xa50103,
  bloodDark: 0x950202,
  cream: 0xefedc2,
  gold: 0xe8a83a,
  healthGreen: 0x5bbf2e,
  focusBlue: 0x3a7fd5,
  skin: 0xe6c2a0,
  skinShade: 0xc79b76,
  blade: 0xcfd6da,
  bladeEdge: 0xeef3f6,
  bladeChi: 0x6fc3e8, // blue chi glow on the katana (from the videos)
  // forest depth eyedropped from the real gameplay frame (teal mist + yellow-green canopy)
  mistTeal: 0x4ba1a4,
  mistTealDeep: 0x337077,
  mistTealDark: 0x143a40,
  canopy: 0x7da443,
  canopyBright: 0x9bc24a,
  trunk: 0x0a2228,
  winRed: 0xc01f29,
  winRedDeep: 0x7e1018,
  haoriEnemy: 0x6b2030, // oxblood haori — the RONIN, distinct from the player's navy
  haoriEnemyShade: 0x47131f,
} as const;
