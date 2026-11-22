import { GameEngine } from '../../src/game/GameEngine';
const container = document.getElementById('game')!;
const log: string[] = [];
const engine = new GameEngine(container, {
  onHudUpdate: (s: any) => { (window as any).__hud = s; }, onToast: (m: string) => log.push(m), onLoreOpen: () => {},
  onPlayerDown: () => {}, onGameOver: () => {}, onVictory: () => {}, onEvolutionUnlocked: () => {},
} as any, 'battle-render-check');
(window as any).engine = engine;
(window as any).toasts = log;
engine.startNewGame();
import * as THREE from 'three';
(window as unknown as { THREE: unknown }).THREE = THREE;
