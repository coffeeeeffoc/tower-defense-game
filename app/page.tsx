'use client';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowUp,
  ArrowRight,
  Bug,
  Check,
  ChevronRight,
  CircleHelp,
  Coins,
  Crosshair,
  FastForward,
  Flag,
  Flame,
  Heart,
  Leaf,
  Moon,
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
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  TYPES,
  PATH,
  SLOTS,
  position,
  newGame,
  build,
  upgrade,
  sell,
  startWave,
  cast,
  step,
  type TowerKind,
} from '@/lib/game';
const towerIcons = { arrow: Crosshair, frost: Snowflake, ember: Flame };
export default function Home() {
  const live = useRef(newGame());
  const [game, setGame] = useState(live.current);
  const [selected, setSelected] = useState<number | null>(null);
  const [kind, setKind] = useState<TowerKind>('arrow');
  const [help, setHelp] = useState(false);
  const [sound, setSound] = useState(false);
  const [message, setMessage] = useState('点击发光的空地，布置你的第一道防线');
  const audio = useRef<AudioContext | null>(null);
  function sync() {
    setGame({ ...live.current });
  }
  function beep() {
    if (!sound) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const o = audio.current.createOscillator(),
        v = audio.current.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(650, audio.current.currentTime);
      o.frequency.exponentialRampToValueAtTime(
        330,
        audio.current.currentTime + 0.1,
      );
      v.gain.setValueAtTime(0.06, audio.current.currentTime);
      v.gain.exponentialRampToValueAtTime(
        0.001,
        audio.current.currentTime + 0.12,
      );
      o.connect(v);
      v.connect(audio.current.destination);
      o.start();
      o.stop(audio.current.currentTime + 0.13);
    } catch {
      setSound(false);
    }
  }
  useEffect(() => {
    let last = performance.now(),
      frame = 0,
      paint = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.06);
      last = now;
      step(live.current, dt * live.current.speed);
      if (now - paint > 32) {
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
      towers: live.current.towers.map(({ slot, kind, level }) => ({
        slot,
        kind,
        level,
      })),
    });
    const register = (tool: unknown) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(console.error);
      } catch (error) {
        console.error(error);
      }
    };
    register({
      name: 'read_defense',
      description:
        'Read the current forest defense, tower slots, resources and wave.',
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
        'Build one tower at a zero-based slot (0–7), or start the next wave. Uses the same rules as the game controls.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['build', 'start'] },
          slot: { type: 'integer', minimum: 0, maximum: 7 },
          kind: { type: 'string', enum: ['arrow', 'frost', 'ember'] },
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
          throw new Error('Unknown input field');
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
        else throw new Error('Invalid action, slot or tower kind');
        if (!ok)
          throw new Error(
            'Action unavailable: check gold, occupied slots or wave status',
          );
        flushSync(() => setGame({ ...live.current }));
        return snapshot();
      },
    });
    return () => lifecycle.abort();
  }, []);
  const tower = game.towers.find((t) => t.slot === selected);
  const ended = game.status === 'won' || game.status === 'lost';
  function place() {
    if (selected === null) return;
    if (build(live.current, selected, kind)) {
      beep();
      setMessage(`${TYPES[kind].name}已就位，准备迎敌`);
      setSelected(null);
      sync();
    } else setMessage('金币不足，消灭小怪可以获得金币');
  }
  function reset() {
    live.current = newGame();
    setSelected(null);
    setMessage('新的守护开始了，先布置防线吧');
    sync();
  }
  return (
    <main className="app-shell">
      <header className="masthead">
        <a href="/" className="brand" aria-label="月森守卫首页">
          <span className="brand-mark">
            <Leaf size={24} />
          </span>
          <span>
            月森守卫<small>MOONWOOD GUARDIANS</small>
          </span>
        </a>
        <div className="header-right">
          <span className="edition">口袋里的小小冒险</span>
          <button
            className="icon-button"
            onClick={() => {
              if (live.current.status === 'battle') live.current.paused = true;
              setHelp(true);
              sync();
            }}
            aria-label="玩法说明"
          >
            <CircleHelp size={21} />
          </button>
        </div>
      </header>
      <div className="game-layout">
        <section className="intro">
          <div className="eyebrow">
            <span /> FOREST DEFENSE · 01
          </div>
          <h1>
            夜幕降临。
            <br />
            森林，由你守护<span>。</span>
          </h1>
          <p>筑起小小防线，守住最后一束月光。</p>
          <div className="chapter">
            <span className="chapter-icon">
              <Moon />
            </span>
            <div>
              <small>第一章</small>
              <h2>萤火之森</h2>
            </div>
            <span className="difficulty">轻策略</span>
          </div>
          <div className="mission">
            <Shield size={17} />
            <span>守护月光核心</span>
            <b>8 波挑战</b>
          </div>
          <div className="desktop-guide">
            <span className="guide-number">01</span>
            <p>
              <b>落下一座塔</b>
              <span>点击战场上的 ＋ 选择防御塔</span>
            </p>
            <span className="guide-number">02</span>
            <p>
              <b>找到你的组合</b>
              <span>弩箭输出、寒冰减速、火焰破阵</span>
            </p>
            <span className="guide-number">03</span>
            <p>
              <b>让森林重归宁静</b>
              <span>升级防线，迎接最后一波来敌</span>
            </p>
          </div>
          <div className="side-footer">
            <Leaf size={15} />
            <span>慢一点，策略会发光。</span>
          </div>
        </section>
        <section className="game-console" aria-label="塔防战场">
          <div className="console-top">
            <span>
              <span className="live-dot" />
              萤火之森
            </span>
            <div>
              <button
                className="icon-button"
                onClick={() => setSound(!sound)}
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
          <div className="hud">
            <div>
              <Heart className="heart" size={19} />
              <b>
                {game.lives}
                <small>/20</small>
              </b>
              <span>核心生命</span>
            </div>
            <div>
              <Coins className="gold" size={20} />
              <b>{game.gold}</b>
              <span>森林金币</span>
            </div>
            <div>
              <Swords className="mint" size={19} />
              <b>
                {String(game.wave).padStart(2, '0')}
                <small>/08</small>
              </b>
              <span>当前波次</span>
            </div>
          </div>
          <div className="battlefield">
            <div className="map-heading">
              <span>
                <Flag size={12} /> 林间小径
              </span>
              <span>
                {game.status === 'battle'
                  ? game.paused
                    ? '已暂停'
                    : '守护进行中'
                  : ended
                    ? '挑战结束'
                    : '准备阶段'}
              </span>
            </div>
            <svg
              className="map-svg"
              viewBox="0 0 360 440"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline
                points={PATH.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke="#101f1e"
                strokeWidth="41"
                strokeLinejoin="round"
              />
              <polyline
                points={PATH.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke="#797863"
                strokeWidth="29"
                strokeLinejoin="round"
              />
              <polyline
                points={PATH.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke="#c0af80"
                opacity=".19"
                strokeWidth="23"
                strokeLinejoin="round"
              />
              <polyline
                points={PATH.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke="#dfd3a7"
                opacity=".35"
                strokeDasharray="2 13"
                strokeWidth="2"
              />
              {selected !== null && (
                <circle
                  cx={SLOTS[selected][0]}
                  cy={SLOTS[selected][1]}
                  r={
                    tower
                      ? TYPES[tower.kind].range + (tower.level - 1) * 12
                      : TYPES[kind].range
                  }
                  fill="#b4eccb12"
                  stroke="#b4eccb88"
                  strokeDasharray="4 5"
                />
              )}
              {game.shots.map((s, i) => (
                <line
                  key={i}
                  x1={s.from[0]}
                  y1={s.from[1]}
                  x2={s.to[0]}
                  y2={s.to[1]}
                  stroke={s.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              ))}
            </svg>
            <div className="entry" style={{ left: '11.1%', top: '9%' }}>
              <ChevronRight size={19} />
            </div>
            <div className="core" style={{ left: '86.1%', top: '93.6%' }}>
              <Shield size={25} />
              <span>月光核心</span>
            </div>
            {SLOTS.map(([x, y], i) => {
              const t = game.towers.find((t) => t.slot === i),
                Icon = t ? towerIcons[t.kind] : Plus;
              return (
                <button
                  key={i}
                  className={`plot ${t ? 'built ' + t.kind : ''} ${selected === i ? 'selected' : ''}`}
                  style={{ left: `${x / 3.6}%`, top: `${y / 4.4}%` }}
                  disabled={ended}
                  onClick={() => {
                    setSelected(selected === i ? null : i);
                    beep();
                  }}
                  aria-label={
                    t
                      ? `${TYPES[t.kind].name}，${t.level}级，查看升级`
                      : `空地 ${i + 1}，建造防御塔`
                  }
                >
                  <Icon size={t ? 27 : 22} />
                  {t && <span className="level">{'•'.repeat(t.level)}</span>}
                </button>
              );
            })}
            {game.enemies.map((e) => {
              const [x, y] = position(e.distance);
              return (
                <div
                  key={e.id}
                  className={`enemy ${e.boss ? 'boss' : ''} ${e.slow ? 'frozen' : ''}`}
                  style={{ left: `${x / 3.6}%`, top: `${y / 4.4}%` }}
                >
                  <div className="enemy-health">
                    <i
                      style={{ width: `${Math.max(0, e.hp / e.maxHp) * 100}%` }}
                    />
                  </div>
                  <Bug size={e.boss ? 30 : 21} />
                </div>
              );
            })}
            {game.flash > 0 && (
              <div className="spell-flash">
                <Snowflake size={100} />
              </div>
            )}
            {game.paused && game.status === 'battle' && (
              <div className="game-overlay">
                <Pause size={34} />
                <h2>森林稍作休息</h2>
                <button
                  className="primary"
                  onClick={() => {
                    live.current.paused = false;
                    sync();
                  }}
                >
                  <Play size={16} />
                  继续守护
                </button>
              </div>
            )}
            {ended && (
              <div className="game-overlay result">
                {game.status === 'won' ? (
                  <Trophy size={48} />
                ) : (
                  <Moon size={48} />
                )}
                <small>
                  {game.status === 'won'
                    ? 'FOREST PROTECTED'
                    : 'A NEW DAWN AWAITS'}
                </small>
                <h2>
                  {game.status === 'won' ? '月光，守住了！' : '再筑一道防线'}
                </h2>
                <p>
                  抵达第 {game.wave} 波 · 击退 {game.kills} 只小怪
                </p>
                <button className="primary" onClick={reset}>
                  <RotateCcw size={17} />
                  再玩一次
                </button>
              </div>
            )}
          </div>
          <div className="control-deck">
            <div className="deck-label">
              <span>
                {selected !== null
                  ? `阵地 ${selected + 1} · ${tower ? '防御塔详情' : '选择防御塔'}`
                  : '你的防御小队'}
              </span>
              {selected !== null ? (
                <button aria-label="取消选择" onClick={() => setSelected(null)}>
                  <X size={16} />
                </button>
              ) : (
                <span>
                  点击空地建造 <Plus size={13} />
                </span>
              )}
            </div>
            {tower ? (
              <div className="upgrade-panel">
                <div className={`tower-emblem ${tower.kind}`}>
                  {(() => {
                    const Icon = towerIcons[tower.kind];
                    return <Icon size={29} />;
                  })()}
                </div>
                <div>
                  <b>{TYPES[tower.kind].name}</b>
                  <span>
                    等级 {tower.level} / 3 · 伤害{' '}
                    {Math.round(
                      TYPES[tower.kind].damage * (1 + (tower.level - 1) * 0.7),
                    )}
                  </span>
                </div>
                <button
                  className="upgrade"
                  disabled={
                    tower.level >= 3 || game.gold < tower.level * 50 || ended
                  }
                  onClick={() => {
                    if (upgrade(live.current, tower.slot)) {
                      beep();
                      sync();
                    }
                  }}
                >
                  <ArrowUp size={16} />
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
                  回收 +{Math.floor(tower.spent * 0.7)}
                </button>
              </div>
            ) : (
              <div className="tower-cards">
                {(Object.keys(TYPES) as TowerKind[]).map((k) => {
                  const Icon = towerIcons[k];
                  return (
                    <button
                      key={k}
                      className={`tower-card ${k} ${kind === k ? 'active' : ''}`}
                      onClick={() => {
                        setKind(k);
                        if (selected === null)
                          setMessage('再点击战场上的 ＋，选择建造位置');
                      }}
                      aria-pressed={kind === k}
                    >
                      <span className="tower-emblem">
                        <Icon size={27} />
                      </span>
                      <b>{TYPES[k].name}</b>
                      <small>
                        {k === 'arrow'
                          ? '快速单体'
                          : k === 'frost'
                            ? '寒冰减速'
                            : '范围爆破'}
                      </small>
                      <span className="price">
                        <Coins size={12} />
                        {TYPES[k].cost}
                      </span>
                      {kind === k && <Check className="card-check" size={12} />}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="battle-actions">
              <button
                className="spell"
                onClick={() => {
                  if (cast(live.current)) {
                    beep();
                    sync();
                  }
                }}
                disabled={
                  game.status !== 'battle' || game.spell > 0 || game.paused
                }
                aria-label="释放月霜，全场伤害并减速"
              >
                <Snowflake size={21} />
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
                  建造 · {TYPES[kind].cost}
                  <Coins size={15} />
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={game.status !== 'ready'}
                  onClick={() => {
                    if (startWave(live.current)) {
                      setSelected(null);
                      setMessage('守护核心！点击已有防御塔可升级');
                      beep();
                      sync();
                    }
                  }}
                >
                  {game.status === 'battle' ? (
                    <Swords size={18} />
                  ) : (
                    <Play size={18} fill="currentColor" />
                  )}
                  {game.status === 'battle'
                    ? `第 ${game.wave} 波 · 余敌 ${game.left + game.enemies.length}`
                    : ended
                      ? '挑战结束'
                      : game.wave
                        ? `迎接第 ${game.wave + 1} 波`
                        : '开始守护'}
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
                <FastForward size={19} />
                <span>{game.speed}×</span>
              </button>
            </div>
            <p className="hint" role="status">
              <Sparkles size={13} />
              {message}
            </p>
          </div>
        </section>
      </div>
      <footer className="page-footer">
        <span>一片小森林，一场小冒险。</span>
        <span>专注策略 · 轻触即玩</span>
      </footer>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="help-dialog">
          <DialogTitle>成为月森守卫</DialogTitle>
          <DialogDescription>守住 8 波来敌，保护月光核心。</DialogDescription>
          <ol>
            <li>点击 ＋ 空地，选择弩塔、冰塔或炮塔后建造。</li>
            <li>点击「开始守护」，防御塔会自动攻击射程内的小怪。</li>
            <li>击退小怪获得金币；点击已有塔升级或回收。</li>
            <li>使用「月霜」造成全场伤害并减速，冷却 18 秒。</li>
            <li>每 4 波出现首领。漏过普通怪扣 1 生命，首领扣 5。</li>
          </ol>
          <p>试试冰塔搭配炮塔，或打开 2 倍速加快战斗。</p>
          <button className="primary" onClick={() => setHelp(false)}>
            知道了，开始布防
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
