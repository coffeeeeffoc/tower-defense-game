'use client';
import { useEffect, useState } from 'react';
import {
  BALANCE_FIELDS,
  BALANCE_KEYS,
  BALANCE_STORAGE_KEY,
  DEFAULT_BALANCE,
  enemyHealth,
  parseBalance,
  type Balance,
} from '@/lib/balance';

export default function BalancePanel({
  balance,
  onApply,
  onRestart,
}: {
  balance: Balance;
  onApply: (balance: Balance) => void;
  onRestart: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState('');
  const [notice, setNotice] = useState(
    '自动恢复本地有效配置；修改后自动保存到本浏览器。',
  );
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BALANCE_STORAGE_KEY);
      if (saved) {
        onApply(parseBalance(JSON.parse(saved)));
      }
    } catch {
      // Unavailable storage or stale/invalid data leaves the validated preset in place.
    }
  }, [onApply]);
  function apply(input: unknown) {
    try {
      const next = parseBalance(input);
      onApply(next);
      try {
        localStorage.setItem(BALANCE_STORAGE_KEY, JSON.stringify(next));
        setNotice('已实时应用并保存到本浏览器。');
      } catch {
        setNotice('已实时应用，但浏览器无法保存；刷新后会丢失。');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '配置无效');
    }
  }
  const hp = enemyHealth(balance, 1);
  return (
    <>
      <button
        className="balance-toggle"
        role="switch"
        aria-checked={open}
        aria-controls="balance-panel"
        onClick={() => setOpen(!open)}
      >
        开发调参 {open ? '开' : '关'}
      </button>
      {open && (
        <aside
          id="balance-panel"
          className="balance-panel"
          aria-label="开发数值调参"
        >
          <div className="camp-heading">
            <h2>数值调参</h2>
            <button onClick={() => setOpen(false)} aria-label="关闭调参面板">
              关闭
            </button>
          </div>
          <p>
            关闭只收起面板。生命按剩余比例即时更新；伤害从下一发弹药生效；奖励从下一次结算生效。开局金币重开生效。
          </p>
          <p>
            首波 {hp} 血 · 1 级弓手约 {Math.ceil(hp / balance.arrowDamage)}{' '}
            箭击败（无弱点） · 全灭收入{' '}
            {8 * balance.killGold + balance.waveGold} 金币
          </p>
          {BALANCE_KEYS.map((key) => {
            const field = BALANCE_FIELDS[key];
            return (
              <label
                className="balance-field"
                key={key}
                htmlFor={`balance-${key}`}
              >
                <span>
                  {field.label}
                  <output>{balance[key]}</output>
                </span>
                <input
                  id={`balance-${key}`}
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={balance[key]}
                  onChange={(event) =>
                    apply({ ...balance, [key]: Number(event.target.value) })
                  }
                />
              </label>
            );
          })}
          <div className="balance-actions">
            <button onClick={() => apply(DEFAULT_BALANCE)}>恢复预设</button>
            <button onClick={onRestart}>按当前配置重开</button>
          </div>
          <div className="balance-actions">
            <button onClick={() => setJson(JSON.stringify(balance, null, 2))}>
              导出到文本框
            </button>
          </div>
          <label className="balance-field">
            配置 JSON（可复制交给运营）
            <textarea
              rows={5}
              value={json}
              onChange={(event) => setJson(event.target.value)}
              spellCheck={false}
            />
          </label>
          <button
            onClick={() => {
              try {
                apply(JSON.parse(json));
              } catch {
                setNotice('JSON 格式不正确，当前配置未更改。');
              }
            }}
          >
            导入并应用
          </button>
          <output className="balance-notice" aria-live="polite">
            {notice}
          </output>
        </aside>
      )}
    </>
  );
}
