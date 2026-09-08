import type { CSSProperties } from 'react';
import { Shield, Gem, Crown } from 'lucide-react';
import type { TowerKind } from '@/lib/game';

export function GuardSprite({
  kind,
  level,
  frame = 0,
}: {
  kind: TowerKind;
  level: number;
  frame?: number;
}) {
  const Badge = level === 4 ? Crown : level === 3 ? Gem : Shield;
  return (
    <span
      className={'guard-art ' + kind}
      data-level={level}
      style={{ '--rank-scale': 1 + (level - 1) * 0.065 } as CSSProperties}
    >
      <GameSprite row={{ arrow: 0, ember: 1, frost: 2 }[kind]} frame={frame} />
      {level > 1 && <Badge className="rank-emblem" aria-hidden="true" />}
    </span>
  );
}
// Authored atlas frames have uneven gutters: crop by inspected bounds, keep feet anchored.
const DEFENDERS = [
  [
    [0, 0, 358, 398, 170],
    [370, 0, 350, 398, 530],
    [732, 0, 404, 398, 890],
    [1140, 0, 308, 398, 1290],
  ],
  [
    [0, 402, 360, 294, 168],
    [370, 402, 350, 294, 526],
    [722, 402, 425, 294, 866],
    [0, 402, 360, 294, 168],
  ],
  [
    [0, 696, 350, 390, 157],
    [366, 696, 349, 390, 510],
    [730, 696, 412, 390, 866],
    [0, 696, 350, 390, 157],
  ],
];
const ENEMIES = [
  [
    [0, 0, 358, 350, 182],
    [382, 0, 362, 350, 550],
    [754, 0, 326, 350, 914],
    [1090, 0, 358, 350, 1260],
  ],
  [
    [0, 355, 360, 335, 180],
    [382, 355, 358, 335, 558],
    [758, 355, 316, 335, 916],
    [1090, 355, 358, 335, 1265],
  ],
  [
    [0, 690, 360, 396, 180],
    [380, 690, 362, 396, 560],
    [750, 690, 330, 396, 914],
    [1090, 690, 358, 396, 1270],
  ],
];
export default function GameSprite({
  sheet = 'defenders',
  row = 0,
  frame = 0,
  className = '',
  style,
}: {
  sheet?: 'defenders' | 'enemies';
  row?: number;
  frame?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const [x, y, w, h, anchor] = (sheet === 'defenders' ? DEFENDERS : ENEMIES)[
    row
  ][frame];
  return (
    <svg
      className={`game-sprite ${className}`}
      style={style}
      viewBox="0 0 440 440"
      aria-hidden="true"
    >
      <svg
        x={220 - (anchor - x)}
        y={430 - h}
        width={w}
        height={h}
        viewBox={`${x} ${y} ${w} ${h}`}
        overflow="hidden"
      >
        <image href={`./${sheet}-v2.png`} width="1448" height="1086" />
      </svg>
    </svg>
  );
}
