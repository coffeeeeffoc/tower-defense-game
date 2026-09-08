'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowUp,
  ArrowRight,
  Check,
  CircleHelp,
  Coins,
  FastForward,
  Heart,
  Leaf,
  Maximize,
  Minimize,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Snowflake,
  Sparkles,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import GameSprite from '@/components/game-sprite';
import {
  TYPES,
  KINDS,
  PATH,
  SLOTS,
  position,
  project,
  boardFit,
  newGame,
  build,
  upgrade,
  sell,
  startWave,
  cast,
  step,
  shotPosition,
  type TowerKind,
  type Point,
} from '@/lib/game';
const ROW = { arrow: 0, ember: 1, frost: 2 };
const FEARS = { arrow: '怕扎', frost: '怕冷', ember: '怕炸' };
const CRIES = {
  arrow: ['哎哟！', '别扎我！'],
  frost: ['好冷！', '阿嚏——'],
  ember: ['什么动静？', '快跑啊！'],
};
export default function Home() {
  const live = useRef(newGame());
  const [game, setGame] = useState(live.current);
  const [selected, setSelected] = useState<number | null>(null);
  const [kind, setKind] = useState<TowerKind>('arrow');
  const [help, setHelp] = useState(false);
  const [sound, setSound] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState(
    '先选空地，再安排守卫。每只哥布林都有弱点。',
  );
  const viewport = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ width: 480, height: 600, wide: false });
  const audio = useRef<AudioContext | null>(null);
  const soundOn = useRef(false);
  function sync() {
    setGame({ ...live.current });
  }
  function playSound(k: TowerKind) {
    if (!soundOn.current) return;
    try {
      const a = (audio.current ??= new AudioContext());
      const osc = a.createOscillator(),
        gain = a.createGain();
      osc.type =
        k === 'ember' ? 'sawtooth' : k === 'frost' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(
        k === 'ember' ? 100 : k === 'frost' ? 1350 : 760,
        a.currentTime,
      );
      osc.frequency.exponentialRampToValueAtTime(
        k === 'ember' ? 32 : k === 'frost' ? 2200 : 170,
        a.currentTime + 0.22,
      );
      gain.gain.setValueAtTime(k === 'ember' ? 0.055 : 0.035, a.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(a.destination);
      osc.start();
      osc.stop(a.currentTime + 0.26);
    } catch {
      soundOn.current = false;
      setSound(false);
    }
  }
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setView({
        width: Math.max(1, width - 20),
        height: Math.max(1, height - 64),
        wide: width > height * 1.12,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let last = performance.now(),
      frame = 0,
      paint = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.06);
      last = now;
      step(live.current, dt * live.current.speed);
      for (const k of live.current.sounds.splice(0)) playSound(k);
      if (now - paint > 30) {
        setGame({ ...live.current });
        paint = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => {
      if (document.hidden && live.current.status === 'battle') {
        live.current.paused = true;
        setGame({ ...live.current });
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', hide);
      void audio.current?.close();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    const snapshot = () => ({
      gold: live.current.gold,
      lives: live.current.lives,
      wave: live.current.wave,
      status: live.current.status,
      slots: SLOTS.map((p, slot) => ({
        slot,
        position: p,
        occupied: live.current.towers.some((t) => t.slot === slot),
      })),
      towers: live.current.towers.map(({ slot, kind, level, phase }) => ({
        slot,
        kind,
        level,
        phase,
      })),
      enemies: live.current.enemies.map(
        ({ id, afraid, reaction, retreat, hp }) => ({
          id,
          afraid,
          reaction,
          retreat,
          hp,
        }),
      ),
    });
    const register = (tool: unknown) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(console.error);
      } catch (e) {
        console.error(e);
      }
    };
    register({
      name: 'read_defense',
      description:
        'Read defense slots, resources, tower animation phases and enemy weaknesses.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: snapshot,
    });
    register({
      name: 'command_defense',
      description: `Build one tower at a zero-based slot (0–${SLOTS.length - 1}), or start the next wave. Uses visible game rules.`,
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['build', 'start'] },
          slot: { type: 'integer', minimum: 0, maximum: SLOTS.length - 1 },
          kind: { type: 'string', enum: KINDS },
        },
        required: ['action'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input: unknown) => {
        if (!input || typeof input !== 'object')
          throw new Error('Expected an object');
        const p = input as Record<string, unknown>;
        if (Object.keys(p).some((k) => !['action', 'slot', 'kind'].includes(k)))
          throw new Error('Unknown field');
        let ok = false;
        if (
          p.action === 'start' &&
          p.slot === undefined &&
          p.kind === undefined
        )
          ok = startWave(live.current);
        else if (
          p.action === 'build' &&
          typeof p.slot === 'number' &&
          Number.isInteger(p.slot) &&
          typeof p.kind === 'string' &&
          Object.hasOwn(TYPES, p.kind)
        )
          ok = build(live.current, p.slot, p.kind as TowerKind);
        else throw new Error('Invalid action, slot or kind');
        if (!ok) throw new Error('Check gold, occupied slots or wave status');
        flushSync(() => setGame({ ...live.current }));
        return snapshot();
      },
    });
    return () => lifecycle.abort();
  }, []);
  const tower = game.towers.find((t) => t.slot === selected),
    ended = game.status === 'won' || game.status === 'lost';
  const fit = boardFit(view.width, view.height, view.wide, zoom);
  const point = (p: Point) => project(p, view.wide);
  const enemyCount = game.left + game.enemies.filter((e) => e.hp > 0).length;
  function place() {
    if (selected === null) return;
    if (build(live.current, selected, kind)) {
      playSound(kind);
      setMessage(`${TYPES[kind].name}就位！${TYPES[kind].detail}`);
      setSelected(null);
      sync();
    } else setMessage('金币不足，击退来敌后再增援。');
  }
  function reset() {
    live.current = newGame();
    setSelected(null);
    setMessage('新的守护开始了。试试在转角交叉布防。');
    sync();
  }
  function begin() {
    if (startWave(live.current)) {
      setSelected(null);
      setMessage(
        live.current.wave % 4 === 0
          ? '首领来了！重甲能抵抗大部分击退。'
          : '看准弱点：怕扎、怕冷、怕炸，吓它们一跳！',
      );
      sync();
    }
  }
  const [coreX, coreY] = point([396, 575]);
  return (
    <main className={`app-shell ${expanded ? 'expanded' : ''}`}>
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          <div>
            月森守卫<small>小兵有脾气 · 守卫有绝活</small>
          </div>
        </div>
        <div className="header-right">
          <span className="edition">萤火之森 / {SLOTS.length} 处阵地</span>
          <button
            className="icon-button"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? '退出专注战场' : '专注战场'}
          >
            {expanded ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <button
            className="icon-button"
            onClick={() => {
              if (game.status === 'battle') live.current.paused = true;
              setHelp(true);
              sync();
            }}
            aria-label="玩法说明"
          >
            <CircleHelp size={20} />
          </button>
        </div>
      </header>
      <section className="game-console" aria-label="塔防战场">
        <div className="hud">
          <div>
            <Heart className="heart" size={19} />
            <b>
              {game.lives}
              <small>/20</small>
            </b>
          </div>
          <div>
            <Coins className="gold" size={20} />
            <b>{game.gold}</b>
          </div>
          <div>
            <Swords size={19} />
            <b>
              {String(game.wave).padStart(2, '0')}
              <small>/08</small>
            </b>
          </div>
          <div className="hud-actions">
            <button
              className="icon-button"
              onClick={() => {
                const next = !soundOn.current;
                soundOn.current = next;
                setSound(next);
                if (next) {
                  audio.current ??= new AudioContext();
                  void audio.current.resume();
                  playSound('arrow');
                }
              }}
              aria-label={sound ? '关闭音效' : '开启音效'}
            >
              {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              className="icon-button"
              disabled={game.status !== 'battle'}
              onClick={() => {
                live.current.paused = !game.paused;
                sync();
              }}
              aria-label={game.paused ? '继续游戏' : '暂停游戏'}
            >
              {game.paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
          </div>
        </div>
        <div className="map-viewport" ref={viewport}>
          <div className="map-scroller">
            <div
              className="world"
              style={{
                width: fit.width * fit.scale,
                height: fit.height * fit.scale,
              }}
            >
              <div
                className="battlefield"
                style={
                  {
                    width: fit.width,
                    height: fit.height,
                    transform: `scale(${fit.scale})`,
                    '--tap-size': `${Math.max(52, 40 / fit.scale)}px`,
                  } as CSSProperties
                }
              >
                <div
                  className="board-scene"
                  style={{
                    transform:
                      game.shake > 0
                        ? `translate(${Math.sin(game.time * 95) * 2.5}px,${Math.cos(game.time * 80) * 1.5}px)`
                        : undefined,
                  }}
                >
                  <svg
                    className="map-svg"
                    viewBox={`0 0 ${fit.width} ${fit.height}`}
                    aria-hidden="true"
                  >
                    <polyline
                      points={PATH.map((p) => point(p).join(',')).join(' ')}
                      fill="none"
                      stroke="#11221c"
                      strokeWidth="43"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points={PATH.map((p) => point(p).join(',')).join(' ')}
                      fill="none"
                      stroke="#8a8165"
                      strokeWidth="33"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points={PATH.map((p) => point(p).join(',')).join(' ')}
                      fill="none"
                      stroke="#ded0a8"
                      opacity=".26"
                      strokeWidth="23"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points={PATH.map((p) => point(p).join(',')).join(' ')}
                      fill="none"
                      stroke="#eee0b5"
                      opacity=".38"
                      strokeDasharray="2 17"
                      strokeWidth="2"
                    />
                    {selected !== null && (
                      <circle
                        cx={point(SLOTS[selected])[0]}
                        cy={point(SLOTS[selected])[1]}
                        r={
                          TYPES[tower?.kind ?? kind].range +
                          (tower ? (tower.level - 1) * 14 : 0)
                        }
                        fill="#c5edac13"
                        stroke="#d7f4bba0"
                        strokeDasharray="5 7"
                      />
                    )}
                  </svg>
                  <div className="core" style={{ left: coreX, top: coreY }}>
                    <Shield size={30} />
                    <span>月光核心</span>
                  </div>
                  {SLOTS.map((p, i) => {
                    const [x, y] = point(p),
                      t = game.towers.find((t) => t.slot === i),
                      aim = t ? point(t.aim) : [x + 1, y],
                      face = aim[0] >= x ? 1 : -1,
                      frame = t
                        ? t.phase === 'aim'
                          ? 1
                          : t.phase === 'recover'
                            ? t.phaseTime < 0.24
                              ? 2
                              : 3
                            : 0
                        : 0;
                    return (
                      <button
                        key={i}
                        className={`plot ${t ? 'built ' + t.kind : ''} ${selected === i ? 'selected' : ''}`}
                        style={{
                          left: x,
                          top: y,
                          zIndex: t ? Math.round(y) + 20 : 1,
                        }}
                        disabled={ended}
                        data-phase={t?.phase}
                        onClick={() => {
                          setSelected(selected === i ? null : i);
                          if (t) setKind(t.kind);
                        }}
                        aria-label={
                          t
                            ? `${TYPES[t.kind].name}，${t.level}级，查看升级`
                            : `空地 ${i + 1}，建造防御塔`
                        }
                      >
                        {t ? (
                          <>
                            <span
                              className={`tower-body ${t.phase}`}
                              style={{
                                transform: `scaleX(${face}) translateX(${t.phase === 'recover' ? -Math.max(0, 1 - t.phaseTime / 0.65) * (t.kind === 'ember' ? 9 : 3) : 0}px)`,
                                filter:
                                  t.kind === 'frost' && t.phase === 'aim'
                                    ? `drop-shadow(0 0 ${4 + t.phaseTime * 12}px #6adfff)`
                                    : undefined,
                              }}
                            >
                              <GameSprite row={ROW[t.kind]} frame={frame} />
                            </span>
                            <span className="level">{'•'.repeat(t.level)}</span>
                            {t.phase === 'aim' && (
                              <span className="charge">
                                <i
                                  style={{
                                    width: `${(t.phaseTime / TYPES[t.kind].windup) * 100}%`,
                                    background: TYPES[t.kind].color,
                                  }}
                                />
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <Plus size={18} />
                            <span className="slot-number">{i + 1}</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                  {game.enemies.map((e) => {
                    const [x, y] = point(position(e.distance)),
                      ahead = point(position(e.distance + 2)),
                      face = ahead[0] >= x ? 1 : -1,
                      isDead = e.hp <= 0,
                      react = e.hurt > 0 || e.panic > 0;
                    const row =
                      isDead && !e.boss
                        ? 1
                        : e.boss
                          ? 2
                          : react || e.slow > 0
                            ? 1
                            : 0;
                    const frame =
                      isDead && !e.boss
                        ? 3
                        : e.boss
                          ? Math.floor(game.time * 4 + e.id) % 4
                          : react
                            ? e.reaction === 'arrow'
                              ? 0
                              : e.reaction === 'ember'
                                ? 1
                                : 2
                            : e.slow > 0
                              ? 2
                              : Math.floor(game.time * 4 + e.id) % 4;
                    const shiver =
                        e.slow > 0 ? Math.sin(game.time * 50 + e.id) * 2 : 0,
                      bob =
                        react || e.slow > 0
                          ? 0
                          : Math.sin(e.distance * 0.4) * 2.5;
                    return (
                      <div
                        key={e.id}
                        className={`enemy ${e.boss ? 'boss' : ''} ${e.slow > 0 ? 'frozen' : ''} ${isDead ? 'fallen' : ''}`}
                        style={{
                          left: x,
                          top: y,
                          zIndex: Math.round(y) + 25,
                          opacity: isDead ? Math.min(1, e.fall * 2) : 1,
                        }}
                        data-reaction={e.reaction}
                        role="img"
                        aria-label={`${e.boss ? '重甲首领' : '哥布林'}，${FEARS[e.afraid]}，生命${Math.max(0, Math.ceil(e.hp))}`}
                      >
                        <div
                          className="enemy-body"
                          style={{
                            transform: `translate(${shiver}px,${bob}px) scaleX(${face}) rotate(${isDead && e.boss ? -65 : react && e.reaction === 'ember' ? -8 : 0}deg)`,
                          }}
                        >
                          <GameSprite sheet="enemies" row={row} frame={frame} />
                        </div>
                        {!isDead && (
                          <>
                            <div className="enemy-health">
                              <i
                                style={{
                                  width: `${Math.max(0, e.hp / e.maxHp) * 100}%`,
                                }}
                              />
                            </div>
                            {react && e.reaction ? (
                              <span className={`cry ${e.reaction}`}>
                                {
                                  CRIES[e.reaction][
                                    e.afraid === e.reaction ? 1 : 0
                                  ]
                                }
                              </span>
                            ) : (
                              <span className={`weakness ${e.afraid}`}>
                                {e.boss ? '首领 · ' : ''}
                                {FEARS[e.afraid]}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                  <svg
                    className="projectiles"
                    viewBox={`0 0 ${fit.width} ${fit.height}`}
                    aria-hidden="true"
                  >
                    {game.shots.map((s) => {
                      const [x, y] = shotPosition(s, view.wide),
                        to = shotPosition(
                          { ...s, elapsed: s.duration },
                          view.wide,
                        ),
                        from = shotPosition({ ...s, elapsed: 0 }, view.wide),
                        angle =
                          (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) /
                          Math.PI;
                      return (
                        <g
                          key={s.id}
                          transform={`translate(${x} ${y}) rotate(${angle})`}
                        >
                          {s.kind === 'ember' ? (
                            <>
                              <circle r="8" fill="#f9be63" />
                              <circle r="4.5" fill="#47362c" />
                              <path d="M-7 0 -22 -3 -17 3Z" fill="#ff963577" />
                            </>
                          ) : s.kind === 'frost' ? (
                            <>
                              <path
                                d="M-18 0 -2 -5 10 0 -2 5Z"
                                fill="#d5faff"
                                stroke="#70d6ff"
                              />
                              <line
                                x1="-35"
                                x2="-15"
                                stroke="#9ce5ff66"
                                strokeWidth="3"
                              />
                            </>
                          ) : (
                            <>
                              <line
                                x1="-25"
                                x2="7"
                                stroke="#e1cd95"
                                strokeWidth="2.7"
                              />
                              <path
                                d="M10 0 1-4 1 4ZM-24 0-29-5-20-3ZM-24 0-29 5-20 3Z"
                                fill="#e7ebc5"
                              />
                            </>
                          )}
                        </g>
                      );
                    })}
                    {game.impacts.map((fx) => {
                      const [x, y] = point(fx.at),
                        t = 1 - fx.life / 0.85;
                      return (
                        <g
                          key={fx.id}
                          transform={`translate(${x} ${y})`}
                          opacity={Math.min(1, fx.life * 2)}
                        >
                          <circle
                            r={5 + t * (fx.kind === 'ember' ? 48 : 23)}
                            fill={fx.kind === 'ember' ? '#ffa44330' : 'none'}
                            stroke={TYPES[fx.kind].color}
                            strokeWidth={fx.kind === 'ember' ? 4 : 2}
                            strokeDasharray={
                              fx.kind === 'frost' ? '3 7' : undefined
                            }
                          />
                          <text
                            y={-35 - t * 25}
                            textAnchor="middle"
                            fill={fx.weak ? '#fff0a9' : TYPES[fx.kind].color}
                            fontSize={fx.weak ? 20 : 17}
                            fontWeight="bold"
                            stroke="#18251c"
                            strokeWidth="3"
                            paintOrder="stroke"
                          >
                            {fx.kill
                              ? '+金币'
                              : `−${fx.damage}${fx.weak ? '!' : ''}`}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  {game.flash > 0 && (
                    <div
                      className="spell-flash"
                      style={{ opacity: game.flash / 0.7 }}
                    >
                      <Snowflake size={150} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="map-tools">
            <span className="battle-status">
              <i />
              {game.status === 'battle'
                ? game.paused
                  ? '已暂停'
                  : `第 ${game.wave} 波 · ${enemyCount} 只来敌`
                : ended
                  ? '挑战结束'
                  : '布防时间'}
              {game.wave > 0 && game.wave % 4 === 0 && game.status === 'battle'
                ? ' · 首领出没'
                : ''}
            </span>
            <div>
              <button
                className="icon-button"
                aria-label="缩小战场"
                disabled={zoom <= 1}
                onClick={() => setZoom(Math.max(1, zoom - 0.4))}
              >
                <ZoomOut size={18} />
              </button>
              <button
                className="zoom-reset"
                onClick={() => setZoom(1)}
                aria-label="恢复完整战场"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                className="icon-button"
                aria-label="放大战场，可滑动查看"
                disabled={zoom >= 1.8}
                onClick={() => setZoom(Math.min(1.8, zoom + 0.4))}
              >
                <ZoomIn size={18} />
              </button>
            </div>
          </div>
          {zoom > 1 && (
            <div className="pan-hint">滑动战场查看 · 点百分比还原</div>
          )}
          {game.paused && game.status === 'battle' && (
            <div className="game-overlay">
              <Pause size={36} />
              <h2>先喘口气</h2>
              <p>小兵和飞行中的炮弹都已暂停。</p>
              <button
                className="primary"
                onClick={() => {
                  live.current.paused = false;
                  sync();
                }}
              >
                <Play size={17} />
                继续守护
              </button>
            </div>
          )}
          {ended && (
            <div className="game-overlay result">
              <Trophy size={45} />
              <h2>
                {game.status === 'won'
                  ? '这群家伙，吓跑了！'
                  : '下次让它们更害怕'}
              </h2>
              <p>
                第 {game.wave} 波 · 击退 {game.kills} 只 · 剩余生命 {game.lives}
              </p>
              <button className="primary" onClick={reset}>
                <RotateCcw size={17} />
                再来一局
              </button>
            </div>
          )}
        </div>
        <aside className="control-deck">
          <div className="deck-heading">
            <span className="eyebrow">MOONWOOD / 守卫营地</span>
            <h1>
              让小兵
              <br />
              <em>闻风丧胆。</em>
            </h1>
            <p>
              箭尖、冰刺、炮口。
              <br />
              每一种害怕，都有对应的办法。
            </p>
          </div>
          <div className="deck-label">
            <span>
              {selected !== null
                ? `阵地 ${selected + 1} · ${tower ? '守卫详情' : '部署守卫'}`
                : '选择你的防御小队'}
            </span>
            {selected !== null ? (
              <button
                className="icon-button"
                aria-label="取消选择"
                onClick={() => setSelected(null)}
              >
                <X size={17} />
              </button>
            ) : (
              <span>
                {game.towers.length}/{SLOTS.length}
              </span>
            )}
          </div>
          {tower ? (
            <div className="upgrade-panel">
              <GameSprite
                row={ROW[tower.kind]}
                frame={
                  tower.phase === 'aim' ? 1 : tower.phase === 'recover' ? 2 : 0
                }
              />
              <div>
                <b>{TYPES[tower.kind].name}</b>
                <span>等级 {tower.level} / 3</span>
                <small>{TYPES[tower.kind].detail}</small>
              </div>
              <button
                className="upgrade"
                disabled={
                  tower.level >= 3 || game.gold < tower.level * 50 || ended
                }
                onClick={() => {
                  if (upgrade(live.current, tower.slot)) {
                    playSound(tower.kind);
                    sync();
                  }
                }}
              >
                <ArrowUp size={17} />
                {tower.level === 3 ? '满级' : `${tower.level * 50}`}
              </button>
              <button
                className="sell"
                disabled={ended}
                onClick={() => {
                  sell(live.current, tower.slot);
                  setSelected(null);
                  sync();
                }}
              >
                回收 +{Math.floor(tower.spent * 0.7)} 金币
              </button>
            </div>
          ) : (
            <div className="tower-cards">
              {KINDS.map((k) => (
                <button
                  key={k}
                  className={`tower-card ${k} ${kind === k ? 'active' : ''}`}
                  aria-pressed={kind === k}
                  onClick={() => {
                    setKind(k);
                    if (selected === null)
                      setMessage('选择战场上的 ＋ 空地，就能部署这位守卫。');
                  }}
                >
                  <GameSprite row={ROW[k]} />
                  <div>
                    <b>{TYPES[k].name}</b>
                    <small>{TYPES[k].detail}</small>
                  </div>
                  <span className="price">
                    <Coins size={13} />
                    {TYPES[k].cost}
                  </span>
                  {kind === k && <Check className="card-check" size={13} />}
                </button>
              ))}
            </div>
          )}
          <div className="tactical-note">
            <span>打它的弱点</span>
            <div>
              <b className="arrow">怕扎 → 弓手</b>
              <b className="frost">怕冷 → 冰塔</b>
              <b className="ember">怕炸 → 火炮</b>
            </div>
            <p>弱点命中伤害 +20%，惊退更远。首领不容易被吓退。</p>
          </div>
          <div className="battle-actions">
            <button
              className="spell"
              disabled={
                game.status !== 'battle' ||
                game.spell > 0 ||
                game.paused ||
                !game.enemies.some((e) => e.hp > 0)
              }
              onClick={() => {
                if (cast(live.current)) sync();
              }}
              aria-label="释放月霜，全场伤害、击退并减速"
            >
              <Snowflake size={23} />
              <span>
                {game.spell > 0 ? `${Math.ceil(game.spell)}s` : '月霜'}
              </span>
            </button>
            {selected !== null && !tower ? (
              <button
                className="primary"
                disabled={game.gold < TYPES[kind].cost || ended}
                onClick={place}
              >
                <Plus size={18} />
                部署 · {TYPES[kind].cost}
                <Coins size={15} />
              </button>
            ) : (
              <button
                className="primary"
                disabled={game.status !== 'ready'}
                onClick={begin}
              >
                {game.status === 'battle' ? (
                  <Swords size={18} />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
                {game.status === 'battle'
                  ? `来敌 ${enemyCount} 只`
                  : ended
                    ? '挑战结束'
                    : game.wave
                      ? `迎接第 ${game.wave + 1} 波`
                      : '放马过来'}
                {game.status === 'ready' && <ArrowRight size={18} />}
              </button>
            )}
            <button
              className="speed"
              aria-label={`切换速度，当前${game.speed}倍`}
              onClick={() => {
                live.current.speed = game.speed === 1 ? 2 : 1;
                sync();
              }}
            >
              <FastForward size={20} />
              <span>{game.speed}×</span>
            </button>
          </div>
          <p className="hint" role="status">
            <Sparkles size={14} />
            {message}
          </p>
        </aside>
      </section>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="help-dialog">
          <DialogTitle>小兵有脾气，守卫有绝活</DialogTitle>
          <DialogDescription>
            布置防线，守住八波来敌。慢一点，看清每一次拉弓和惊退。
          </DialogDescription>
          <ol>
            <li>{SLOTS.length} 个布防位置。先点空地，再选守卫并部署。</li>
            <li>
              游侠拉弓点射、冰塔蓄力减速、火炮范围轰击。弹药飞到才造成伤害。
            </li>
            <li>
              小兵各有「怕扎 / 怕冷 / 怕炸」弱点，命中弱点多造成 20%
              伤害，惊退更远。
            </li>
            <li>
              所有武器都能击退。冰箭让小兵哆嗦，火炮让它们倒退逃跑；重甲首领更难被击退。
            </li>
            <li>点击已有守卫升级或回收。月霜全场冻结，冷却 22 秒。</li>
            <li>
              战场随横竖屏等比适配。用右上角 ＋ 放大后滑动查看，百分比按钮还原。
            </li>
          </ol>
          <button className="primary" onClick={() => setHelp(false)}>
            明白了，安排它们！
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
