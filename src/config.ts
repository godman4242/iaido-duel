// src/config.ts — back-compat re-export. Stage size now lives in config/layout.ts (spec §3).
export { GAME_W, GAME_H } from './config/layout';
export const DEV = import.meta.env?.DEV ?? false;
