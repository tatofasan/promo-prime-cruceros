// Disposición de lo estático en la cubierta (mundo). Arriba a la izquierda y abajo a la izquierda quedan libres
// (lockup y chip de TYPE): ahí solo hay teca y una palmera que asoma por el borde.
import { PAL } from '../../engine/color.js';
import { SKIN, HAIR } from './pool-pal.js';

const TOP_Y = 78, BOT_Y = 1024;
const W2 = ['#FFFFFF'];
export const LOUNGERS = [
  { x: 752, y: TOP_Y, rot: 0, towel: [PAL.coral, W2[0]], props: [['hat', 2, -40, 0.3], ['glasses', -4, 26, -0.4]] },
  { x: 842, y: TOP_Y, rot: 0, towel: [PAL.brandCyan, W2[0]], person: { kind: 'bikini', skin: SKIN[2], hair: HAIR[3], hairStyle: 'bun', suit: PAL.coral, trim: PAL.gold, pose: { aL: [0.25, 0.1], aR: [1.6, 2.3], lL: [0.05, 0], lR: [0.25, 0.5] } } },
  { x: 1002, y: TOP_Y, rot: 0, towel: [PAL.gold, PAL.navy700], props: [['book', 0, -10, 0.15], ['phone', 12, 52, 0.4]] },
  { x: 1092, y: TOP_Y, rot: 0, towel: [PAL.navy600, W2[0]], person: { kind: 'trunks', skin: SKIN[0], hair: HAIR[2], hairStyle: 'short', suit: PAL.brandCyan, pose: { aL: [2.5, 0.6], aR: [2.6, 0.5], lL: [0.04, 0], lR: [0.08, 0] } } },
  { x: 1252, y: TOP_Y, rot: 0, towel: [PAL.coral, W2[0]], props: [['glasses', 6, 10, 0.5]] },
  { x: 1342, y: TOP_Y, rot: 0, towel: [PAL.brandCyan, W2[0]] },
  { x: 752, y: BOT_Y, rot: Math.PI, towel: [PAL.navy600, W2[0]] },
  { x: 842, y: BOT_Y, rot: Math.PI, towel: [PAL.gold, PAL.navy700], person: { kind: 'one', skin: SKIN[1], hair: HAIR[1], hairStyle: 'long', suit: PAL.gold, trim: PAL.navy700, pose: { aL: [0.3, 0.1], aR: [0.2, 0.05], lL: [0.06, 0], lR: [0.2, 0.45] } } },
  { x: 1002, y: BOT_Y, rot: Math.PI, towel: [PAL.coral, W2[0]], props: [['hat', 0, 20, 1.2]] },
  { x: 1092, y: BOT_Y, rot: Math.PI, towel: [PAL.brandCyan, W2[0]] },
];
// sombrillas a la altura de las cabeceras (dan sombra a las caras, dejan ver toallas y gente)
export const UMBRELLAS = [
  { x: 922, y: 150, scheme: 'coral', rot: 0.1 },
  { x: 1172, y: 152, scheme: 'navy', rot: 0.3 },
  { x: 922, y: 952, scheme: 'cyan', rot: 0.2 },
];
// mesitas y ojotas sueltas en la cubierta
export const DECK_PROPS = [
  ['drink', 922, 60, 0], ['flip', 1172, 52, 0.3], ['drink', 1422, 70, 0], ['flip', 690, 960, 2.6], ['drink', 922, 1060, 0],
];
