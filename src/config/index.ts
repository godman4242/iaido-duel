// config/index.ts — barrel for the central config (spec §3). Import gameplay constants from
// here (or a specific module); never hard-code a gameplay-affecting literal in core/ or game/.
export * from './layout';
export * from './palette';
export * from './stances';
export * from './combat';
export * from './timing';
export * from './ai';
export * from './economy';
export * from './audio';
