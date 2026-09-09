'use client';
import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowRight,
  RefreshCw,
  ShoppingBag,
  Warehouse,
  Combine,
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
import GameSprite, { GuardSprite } from '@/components/game-sprite';
import BalancePanel from '@/components/balance-panel';
import type { Balance } from '@/lib/balance';
import {
  TYPES,
  PATH,
  SLOTS,
  position,
  project,
  boardFit,
  newGame,
  applyBalance,
  buy,
  refreshShop,
  moveGuardian,
  moveProblem,
  locate,
  unitAt,
  canMerge,
  benchDestination,
  saleValue,
  towerDamage,
  MAX_LEVEL,
  BENCH_SIZE,
  REFRESH_COST,
  RANKS,
  type Location,
  sell,
  startWave,
  cast,
  step,
  shotPosition,
  type TowerKind,
  type Point,
} from '@/lib/game';
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

  const [help, setHelp] = useState(false);
  const [sound, setSound] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState(
    '守卫厅已有援军：拖到战场，或拖向同种同级守卫合成。',
  );
  const viewport = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ width: 480, height: 600, wide: false });
  const audio = useRef<AudioContext | null>(null);
  const soundOn = useRef(false);
  useEffect(() => {
    if (selected === null) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      setSelected(null);
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [selected]);
  function sync() {
    setGame({ ...live.current });
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
      return true;
    }
    return false;
  }
  const updateBalance = useCallback((balance: Balance) => {
    applyBalance(live.current, balance);
    setGame({ ...live.current });
  }, []);
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
      if (document.hidden) {
        cancelDrag();
        if (live.current.status === 'battle') live.current.paused = true;
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
      bench: live.current.bench,
      shop: live.current.shop,
      towers: live.current.towers.map(({ id, slot, kind, level, phase }) => ({
        id,
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
      description:
        'Buy into the six-slot hall or refresh for 15 gold. During battle (including paused), only deploy hall guardians onto empty field slots. Field relocation, recall, all merges and sales require ready status. Matching kind and level merge up to level 4.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['buy', 'refresh', 'move', 'sell', 'start'],
          },
          id: { type: 'integer' },
          zone: { type: 'string', enum: ['bench', 'field'] },
          slot: { type: 'integer', minimum: 0, maximum: SLOTS.length - 1 },
        },
        required: ['action'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input: unknown) => {
        if (!input || typeof input !== 'object')
          throw new Error('Expected an object');
        const p = input as Record<string, unknown>;
        const fields: Record<string, string[]> = {
          buy: ['action', 'id'],
          refresh: ['action'],
          move: ['action', 'id', 'zone', 'slot'],
          sell: ['action', 'id'],
          start: ['action'],
        };
        if (
          typeof p.action !== 'string' ||
          !Object.hasOwn(fields, p.action) ||
          Object.keys(p).some((k) => !fields[p.action as string].includes(k))
        )
          throw new Error('Invalid action or fields');
        let ok = false;
        if (p.action === 'start') ok = begin();
        else if (p.action === 'refresh') ok = refreshShop(live.current);
        else if (typeof p.id === 'number' && Number.isInteger(p.id)) {
          if (p.action === 'buy') ok = buy(live.current, p.id);
          else if (p.action === 'sell') ok = sell(live.current, p.id);
          else if (
            p.action === 'move' &&
            (p.zone === 'bench' || p.zone === 'field') &&
            typeof p.slot === 'number'
          )
            ok = moveGuardian(live.current, p.id, {
              zone: p.zone,
              slot: p.slot,
            });
        }
        if (!ok)
          throw new Error(
            'Action unavailable: during battle only hall-to-empty-field deployment is allowed; check gold, hall space, guardian IDs and matching levels',
          );
        flushSync(() => setGame({ ...live.current }));
        return snapshot();
      },
    });
    return () => lifecycle.abort();
  }, []);
  const chosen = selected === null ? undefined : locate(game, selected);
  const tower =
    chosen?.at.zone === 'field'
      ? game.towers.find((t) => t.id === selected)
      : undefined;
  const ended = game.status === 'won' || game.status === 'lost';
  const canArrange = game.status === 'ready';
  const [dragPreview, setDragPreview] = useState<{
    id: number;
    x: number;
    y: number;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<Location | null>(null);
  const [mergePulse, setMergePulse] = useState<number | null>(null);
  const drag = useRef<{
    id: number;
    pointer: number;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const suppressClick = useRef(0);
  useEffect(() => {
    if (mergePulse === null) return;
    const timer = setTimeout(() => setMergePulse(null), 700);
    return () => clearTimeout(timer);
  }, [mergePulse]);
  const kind = chosen?.unit.kind ?? 'arrow';
  const rangeSlot =
    dropTarget?.zone === 'field' ? dropTarget.slot : tower?.slot;
  const fit = boardFit(view.width, view.height, view.wide, zoom);
  const point = (p: Point) => project(p, view.wide);
  const enemyCount = game.left + game.enemies.filter((e) => e.hp > 0).length;
  function transfer(id: number, to: Location) {
    const problem = moveProblem(live.current, id, to);
    if (problem) {
      setMessage(problem);
      return;
    }
    const merging = !!unitAt(live.current, to);
    if (moveGuardian(live.current, id, to)) {
      const unit = unitAt(live.current, to)!;
      setSelected(unit.id);
      if (merging) {
        setMergePulse(unit.id);
        playSound(unit.kind);
      }
      setMessage(
        merging
          ? TYPES[unit.kind].name +
              ' → ' +
              unit.level +
              ' 级' +
              (unit.level === MAX_LEVEL ? ' · 已达顶级！' : '！')
          : to.zone === 'bench'
            ? '已回到守卫厅，可以观望或继续合成。'
            : live.current.status === 'ready'
              ? '守卫已部署。也可以拖回守卫厅待命。'
              : '援军已上阵，本波结束前不能换位或回收。',
      );
      sync();
    }
  }
  function clickPlace(to: Location) {
    if (performance.now() < suppressClick.current) return;
    const target = unitAt(live.current, to);
    if (target && target.id !== selected) {
      setSelected(target.id);
      setMessage(
        '已选中 ' +
          TYPES[target.kind].name +
          ' ' +
          target.level +
          (live.current.status === 'ready'
            ? ' 级：拖动换位，拖到同种同级守卫上合成。'
            : to.zone === 'bench'
              ? ' 级：可拖到战场空阵地增援。'
              : ' 级：阵地已锁定，本波结束后可调整。'),
      );
    } else setSelected(null);
  }
  function dropAt(x: number, y: number, id: number): Location | null {
    const element = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>('[data-drop-zone]');
    if (!element) return null;
    const zone = element.dataset.dropZone;
    if (zone === 'bench-auto') return benchDestination(live.current, id);
    const slot = Number(element.dataset.dropSlot);
    return (zone === 'bench' || zone === 'field') && Number.isInteger(slot)
      ? { zone, slot }
      : null;
  }
  function cancelDrag() {
    drag.current = null;
    setDragPreview(null);
    setDropTarget(null);
  }
  function dragProps(id: number) {
    const movable = () =>
      live.current.status === 'ready' ||
      (live.current.status === 'battle' &&
        locate(live.current, id)?.at.zone === 'bench');
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
        if (!e.isPrimary || e.button !== 0 || !movable()) return;
        suppressClick.current = 0;
        drag.current = {
          id,
          pointer: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          active: false,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => {
        if (!movable()) {
          cancelDrag();
          return;
        }
        const d = drag.current;
        if (!d || d.pointer !== e.pointerId) return;
        if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8)
          return;
        d.active = true;
        setDragPreview({ id: d.id, x: e.clientX, y: e.clientY });
        setDropTarget(dropAt(e.clientX, e.clientY, d.id));
      },
      onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
        const d = drag.current;
        if (!d || d.pointer !== e.pointerId) return;
        if (d.active) {
          suppressClick.current = performance.now() + 400;
          const to = dropAt(e.clientX, e.clientY, d.id);
          if (to) transfer(d.id, to);
          else setMessage('未放入目标区域，守卫保留在原位。');
        }
        cancelDrag();
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      },
      onPointerCancel: cancelDrag,
      onLostPointerCapture: cancelDrag,
    };
  }
  function targetClass(to: Location) {
    const id = dragPreview?.id ?? selected;
    if (id === null || id === undefined) return '';
    const target = unitAt(game, to),
      source = locate(game, id);
    if (!source) return '';
    const hover = dropTarget?.zone === to.zone && dropTarget.slot === to.slot;
    return (
      (canArrange && target && canMerge(source.unit, target)
        ? ' merge-ready'
        : '') +
      (hover
        ? moveProblem(game, id, to)
          ? ' drop-invalid'
          : ' drop-valid'
        : '')
    );
  }
  function mergeSelected() {
    if (!chosen) return;
    const partner = [...game.bench, ...game.towers].find(
      (u) => u && canMerge(u, chosen.unit),
    );
    if (partner) transfer(partner.id, chosen.at);
  }
  const partner = chosen
    ? [...game.bench, ...game.towers].find((u) => u && canMerge(u, chosen.unit))
    : undefined;
  function reset() {
    cancelDrag();
    live.current = newGame(live.current.balance);
    setSelected(null);
    setMessage('新的守护开始了。试试在转角交叉布防。');
    sync();
  }
  const [coreX, coreY] = point([396, 575]);
  return (
    <main
      className={`app-shell ${expanded ? 'expanded' : ''}`}
      data-arranging={canArrange}
    >
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
          {process.env.NODE_ENV === 'development' && (
            <BalancePanel
              balance={game.balance}
              onApply={updateBalance}
              onRestart={reset}
            />
          )}
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
      <section className="game-console play-console" aria-label="塔防战场">
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
        <div className="battle-actions top-actions" aria-label="波次与战斗操作">
          {game.status === 'battle' && (
            <div className="wave-progress">
              <span>
                第 {game.wave} 波 · 剩余 {enemyCount} 只
              </span>
              <progress
                aria-label="本波击退进度"
                max={6 + game.wave * 2}
                value={6 + game.wave * 2 - enemyCount}
              />
            </div>
          )}
          {game.status === 'battle' && (
            <>
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
                aria-label="释放月霜"
              >
                <Snowflake size={23} />
                <span>
                  {game.spell > 0 ? Math.ceil(game.spell) + 's' : '月霜'}
                </span>
              </button>
            </>
          )}
          {game.status !== 'battle' && (
            <button
              className="primary"
              disabled={game.status !== 'ready'}
              onClick={begin}
            >
              <Play size={18} fill="currentColor" />
              {ended
                ? '挑战结束'
                : game.wave
                  ? '迎接第 ' + (game.wave + 1) + ' 波'
                  : '放马过来'}
              {game.status === 'ready' && <ArrowRight size={18} />}
            </button>
          )}
          <button
            className="speed"
            aria-label={'切换速度，当前' + game.speed + '倍'}
            onClick={() => {
              live.current.speed = game.speed === 1 ? 2 : 1;
              sync();
            }}
          >
            <FastForward size={20} />
            <span>{game.speed}×</span>
          </button>
        </div>
        <div className="map-viewport" ref={viewport}>
          <div className="map-scroller">
            <div
              className="world"
              style={{
                width: fit.width * fit.scale,
                height: fit.renderHeight * fit.scale,
              }}
            >
              <div
                className="battlefield"
                style={
                  {
                    width: fit.width,
                    height: fit.renderHeight,
                    transform: `scale(${fit.scale})`,
                    '--tap-size': `${Math.max(52, 40 / fit.scale)}px`,
                  } as CSSProperties
                }
              >
                <div
                  className="board-scene"
                  style={{
                    top: fit.topPadding,
                    height: fit.height,
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
                    {rangeSlot !== undefined && (
                      <circle
                        cx={point(SLOTS[rangeSlot])[0]}
                        cy={point(SLOTS[rangeSlot])[1]}
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
                        className={`plot ${t ? 'built ' + t.kind : ''} ${selected === t?.id ? 'selected' : ''} ${targetClass({ zone: 'field', slot: i })} ${mergePulse === t?.id ? 'merge-pop' : ''}`}
                        style={{
                          left: x,
                          top: y,
                          zIndex: t ? Math.round(y) + 20 : 1,
                        }}
                        disabled={ended}
                        data-phase={t?.phase}
                        data-drop-zone="field"
                        data-drop-slot={i}
                        {...(t ? dragProps(t.id) : {})}
                        onClick={() => clickPlace({ zone: 'field', slot: i })}
                        aria-label={
                          t
                            ? `${TYPES[t.kind].name}，${t.level}级，查看详情`
                            : `空地 ${i + 1}，可部署守卫`
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
                              <GuardSprite
                                kind={t.kind}
                                level={t.level}
                                frame={frame}
                              />
                            </span>
                            <span className="level" data-level={t.level}>
                              Lv.{t.level}
                              {t.level === MAX_LEVEL ? ' MAX' : ''}
                            </span>
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
                  : '布防时间 · 可调整阵容'}
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
          {game.paused && game.status === 'battle' && !dragPreview && (
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
        <aside className="control-deck camp-deck compact-deck">
          <section id="guard-shop" className="guard-shop" aria-label="守卫商店">
            <div className="camp-heading">
              <h2>
                <ShoppingBag size={17} />
                守卫商店
              </h2>
              <button
                className="refresh-shop"
                disabled={ended || game.gold < REFRESH_COST}
                onClick={() => {
                  if (refreshShop(live.current)) {
                    setMessage('商店已刷新，购买的守卫会进入守卫厅。');
                    sync();
                  }
                }}
              >
                <RefreshCw size={15} />
                刷新 <Coins size={12} />
                {REFRESH_COST}
              </button>
            </div>
            <div className="shop-offers">
              {game.shop.map((offer, index) =>
                offer ? (
                  <button
                    key={offer.id}
                    className={'shop-offer ' + offer.kind}
                    disabled={
                      ended ||
                      game.gold < offer.price ||
                      game.bench.every(Boolean)
                    }
                    onClick={() => {
                      if (buy(live.current, offer.id)) {
                        playSound(offer.kind);
                        setMessage(
                          TYPES[offer.kind].name +
                            (live.current.status === 'ready'
                              ? '已加入守卫厅。可以保留、上阵或合成。'
                              : '已加入守卫厅，可拖到战场空阵地增援。'),
                        );
                        sync();
                      }
                    }}
                    aria-label={
                      '购买1级' +
                      TYPES[offer.kind].name +
                      '，' +
                      offer.price +
                      '金币'
                    }
                  >
                    <GuardSprite kind={offer.kind} level={1} />
                    <b>{TYPES[offer.kind].name}</b>
                    <span className="offer-price">
                      <Coins size={12} />
                      {offer.price}
                      <small>Lv.1</small>
                    </span>
                  </button>
                ) : (
                  <div key={'sold-' + index} className="offer-sold">
                    <ShoppingBag size={22} />
                    <span>已招募</span>
                  </div>
                ),
              )}
            </div>
          </section>
          <section
            id="guard-hall"
            className="guard-hall"

            data-drop-zone="bench-auto"
            aria-label="守卫厅"
          >
            <div className="camp-heading">
              <h2>
                <Warehouse size={17} />
                守卫厅{' '}
                <small>
                  {game.bench.filter(Boolean).length}/{BENCH_SIZE}
                </small>
              </h2>
              <span>
                {!canArrange
                  ? '可拖入空阵地增援'
                  : game.bench.every(Boolean)
                    ? '已满 · 合成或出售'
                    : '待命不自动上阵'}
              </span>
            </div>
            <div className="bench-slots">
              {game.bench.map((unit, index) => (
                <button
                  key={index}
                  className={
                    'bench-slot ' +
                    (unit ? unit.kind : 'empty') +
                    (selected === unit?.id ? ' selected' : '') +
                    targetClass({ zone: 'bench', slot: index }) +
                    (mergePulse === unit?.id ? ' merge-pop' : '')
                  }
                  data-drop-zone="bench"
                  data-drop-slot={index}
                  {...(unit ? dragProps(unit.id) : {})}
                  disabled={ended}
                  onClick={() => clickPlace({ zone: 'bench', slot: index })}
                  aria-label={
                    unit
                      ? '守卫厅' +
                        (index + 1) +
                        '，' +
                        TYPES[unit.kind].name +
                        '，' +
                        unit.level +
                        '级'
                      : '守卫厅空位' + (index + 1)
                  }
                >
                  {unit ? (
                    <>
                      <GuardSprite kind={unit.kind} level={unit.level} />
                      <span className="bench-level" data-level={unit.level}>
                        Lv.{unit.level}
                        {unit.level === MAX_LEVEL ? ' MAX' : ''}
                      </span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <small>{index + 1}</small>
                    </>
                  )}
                </button>
              ))}
            </div>
          </section>
          <div className="selection-bar" hidden={!chosen || !!dragPreview}>
            {chosen ? (
              <>
                <div>
                  <b>
                    {TYPES[chosen.unit.kind].name} · Lv.{chosen.unit.level}
                  </b>
                  <span>
                    {RANKS[chosen.unit.level - 1]} · 伤害{' '}
                    {Math.round(
                      towerDamage(
                        chosen.unit.kind,
                        chosen.unit.level,
                        game.balance,
                      ),
                    )}
                    {!canArrange &&
                      (chosen.at.zone === 'bench'
                        ? ' · 可上阵'
                        : ' · 阵地锁定')}
                  </span>
                </div>
                <button
                  className="merge-button"
                  hidden={!canArrange}
                  disabled={!partner || ended}
                  onClick={mergeSelected}
                >
                  <Combine size={15} />
                  {chosen.unit.level === MAX_LEVEL ? '顶级' : '合成'}
                </button>
                <button
                  className="sell-unit"
                  hidden={!canArrange}
                  disabled={ended}
                  onClick={() => {
                    if (sell(live.current, chosen.unit.id)) {
                      setSelected(null);
                      setMessage('已出售，返还少量金币。');
                      sync();
                    }
                  }}
                >
                  卖 +{saleValue(chosen.unit)}
                </button>
                <button
                  className="clear-choice"
                  onClick={() => setSelected(null)}
                  aria-label="取消选择"
                >
                  <X size={15} />
                </button>
              </>
            ) : null}
          </div>

          <output
            key={message}
            className={'hint camp-notice' + (!chosen ? ' visible' : '')}
          >
            <Sparkles size={14} />
            {message}
          </output>
        </aside>
      </section>
      {!ended && dragPreview && locate(game, dragPreview.id) && (
        <div
          className="drag-ghost"
          style={{ left: dragPreview.x, top: dragPreview.y }}
        >
          <GuardSprite
            kind={locate(game, dragPreview.id)!.unit.kind}
            level={locate(game, dragPreview.id)!.unit.level}
          />
          <b>Lv.{locate(game, dragPreview.id)!.unit.level}</b>
        </div>
      )}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="help-dialog">
          <DialogTitle>小兵有脾气，守卫有绝活</DialogTitle>
          <DialogDescription>
            布置防线，守住八波来敌。慢一点，看清每一次拉弓和惊退。
          </DialogDescription>
          <ol>
            <li>
              战斗中可把守卫厅援军拖到空阵地。已上阵守卫不能换位或回收；合成和出售仅在布防阶段允许，暂停也遵守这些规则。
            </li>
            <li>
              商店有 3 个货位，刷新花费 {REFRESH_COST} 金币，购买后进入守卫厅。
              战斗中仍可购买，并从守卫厅拖到空阵地即时增援。
            </li>
            <li>
              守卫厅有 {BENCH_SIZE}{' '}
              格。可以暂时保留守卫，满员时先合成、上阵或出售。
            </li>
            <li>
              拖到空格即可移动；拖到同种同级守卫上即可二合一，最高 {MAX_LEVEL}{' '}
              级，不额外收费。
            </li>
            <li>
              守卫厅与战场之间可以双向拖动合成，也可以在各自区域内合成。不同种类、不同等级或顶级不会合成。
            </li>
            <li>
              点击守卫查看详情，拖动才能换位；“合成”按钮会寻找同种同级伙伴并合入当前守卫。
            </li>
            <li>
              选中守卫可出售，返还其累计购买价格的 25%。取消拖动不会丢失守卫。
            </li>
            <li>
              等级越高，伤害、射程、体积与阶级装饰越强。保留拉弓、炮击、冰冻、弱点及惊退机制。
            </li>
            <li>战场可放大滑动；月霜冷却 22 秒。切出页面自动暂停。</li>
          </ol>
          <button className="primary" onClick={() => setHelp(false)}>
            明白了，安排它们！
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
