/**
 * Settings panel (extracted from App.tsx 2026-08-09, pure move — JSX and
 * handlers identical). Left/right hand harmony/expression modes, arp/bass
 * extras, visual atmosphere sliders, and the no-camera keyboard toggle.
 *
 * Pure presentation: every state access and side effect flows through
 * props (synthState/setters + callback handlers); App keeps the business
 * logic (persistence, mode lifecycle).
 */

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { ArpSpeed, LeftHandMode, RightHandMode, SynthState } from '../types';
import { CHORD_STYLE_OPTIONS, type ChordStyle } from '../chords';
import { trackProGateClicked, trackProGateSeen, trackSettingChanged } from '../analytics';
import { ACTION_META, ACTION_ORDER, DEFAULT_KEYMAP, KEYMAP_PRESETS, displayKey, isAssignableKey, matchingPresetId, type KbAction } from '../input/keymap';

export interface SettingsPanelProps {
  onClose: () => void;
  synthState: SynthState;
  setSynthState: Dispatch<SetStateAction<SynthState>>;
  vignetteStrength: number;
  setVignetteStrength: (v: number) => void;
  scanlinesStrength: number;
  setScanlinesStrength: (v: number) => void;
  isMobile: boolean;
  keyboardMode: boolean;
  isRunning: boolean;
  /** Keyboard-mode checkbox toggle — App decides what to start/stop. */
  onKeyboardToggle: (on: boolean) => void;
  /** Current player-customizable key bindings (see input/keymap.ts). */
  keymap: Record<KbAction, string>;
  onKeymapChange: (map: Record<KbAction, string>) => void;
  /** Opens the real-keyboard overlay (KbGuide) so the player can see where
   *  every action currently lives before/while rebinding. */
  onOpenGuide: () => void;
}

export function SettingsPanel({
  onClose,
  synthState,
  setSynthState,
  vignetteStrength,
  setVignetteStrength,
  scanlinesStrength,
  setScanlinesStrength,
  isMobile,
  keyboardMode,
  isRunning,
  onKeyboardToggle,
  keymap,
  onKeymapChange,
  onOpenGuide,
}: SettingsPanelProps) {
  // Rebind capture: which action is armed to receive the next keypress.
  const [listeningFor, setListeningFor] = useState<KbAction | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  // Pro-gate probe: seen = panel open (mount is the open signal — App
  // conditionally renders the panel).
  useEffect(() => { trackProGateSeen('settings'); }, []);

  useEffect(() => {
    if (!listeningFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      e.preventDefault();
      if (e.key === 'Escape') {
        setListeningFor(null);
        setConflictMsg(null);
        return;
      }
      if (!isAssignableKey(e.key)) {
        setConflictMsg(`「${displayKey(e.key)}」是保留鍵`);
        return;
      }
      const takenBy = ACTION_ORDER.find((a) => a !== listeningFor && keymap[a] === e.key);
      if (takenBy) {
        setConflictMsg(`已被「${ACTION_META[takenBy].label}」使用`);
        return;
      }
      onKeymapChange({ ...keymap, [listeningFor]: e.key });
      setListeningFor(null);
      setConflictMsg(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listeningFor, keymap, onKeymapChange]);

  const renderKeyRow = (action: KbAction) => {
    const meta = ACTION_META[action];
    const isListening = listeningFor === action;
    return (
      <div key={action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>{meta.label}</span>
        <button
          onClick={() => { setListeningFor(action); setConflictMsg(null); }}
          style={{
            fontSize: '0.6rem',
            padding: '2px 8px',
            minWidth: '64px',
            borderRadius: '4px',
            border: `1px solid ${isListening ? 'var(--neon-magenta)' : 'rgba(0, 0, 0, 0.15)'}`,
            background: isListening ? 'rgba(0, 153, 255,0.1)' : 'transparent',
            color: isListening ? 'var(--neon-magenta)' : 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          {isListening ? '請按一個鍵…' : displayKey(keymap[action])}
        </button>
      </div>
    );
  };
  return (
    <div className="frost-panel" style={{ flexDirection: 'column', gap: '10px', padding: '16px 18px', maxWidth: '700px', fontSize: '0.65rem' }}>
      {/* Direct child of camera-stage (moved 2026-09-21): .frost-panel's own
          absolute top/z35 applies against the stage, above the landing brand
          (placeholder z30). Keep only layout overrides, no position ones. */}
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: '6px', right: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer', padding: '4px' }}
        data-tip="關閉設定"
      >✕</button>
      {/* Performance settings (wraps on narrow screens) */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', flexWrap: 'wrap' }}>
      {/* Left Hand */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
        <label style={{ color: 'var(--neon-cyan)', fontWeight: 600 }}>左手 — 和聲</label>
        <select value={synthState.leftHandMode} onChange={(e) => { trackSettingChanged('left_hand_mode', e.target.value); setSynthState(prev => ({ ...prev, leftHandMode: e.target.value as LeftHandMode })); }}>
          <option value="scaleTilt">音階 + 傾斜切換大小調</option>
          <option value="scaleLocked">只用音階（鎖定調式）</option>
        </select>
        {synthState.leftHandMode === 'scaleTilt' ? (
          <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', margin: 0 }}>手指選音級；手腕傾斜切換大調 ↔ 小調。</p>
        ) : (
          <>
            <select value={synthState.lockedMode ?? 'major'} onChange={(e) => { trackSettingChanged('locked_mode', e.target.value); setSynthState(prev => ({ ...prev, lockedMode: e.target.value as 'major' | 'minor' | 'diatonicMajor' | 'diatonicMinor' })); }}>
              <option value="major">全部大調</option>
              <option value="minor">全部小調</option>
              <option value="diatonicMajor">自然大調（I/IV/V 大、ii/iii/vi 小、vii° 減）</option>
              <option value="diatonicMinor">自然小調（i/iv/v 小、III/VI/VII 大、ii° 減）</option>
            </select>
            <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', margin: 0 }}>
              {synthState.lockedMode === 'diatonicMajor' || synthState.lockedMode === 'diatonicMinor'
                ? '每個音級保持原本的和弦性質 — 不強制大小調。'
                : '手指只選音級，調式由上方鎖定。'}
            </p>
          </>
        )}
      </div>

      <span className="divider" style={{ height: 'auto', alignSelf: 'stretch' }} />

      {/* Right Hand */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
        <label style={{ color: 'var(--neon-magenta)', fontWeight: 600 }}>右手 — 表情</label>
        <select value={synthState.rightHandMode} onChange={(e) => { trackSettingChanged('right_hand_mode', e.target.value); setSynthState(prev => ({ ...prev, rightHandMode: e.target.value as RightHandMode })); }}>
          <option value="fingerLayout">手指排列 = 和弦風格</option>
          <option value="fixedChordStyle">固定和弦風格</option>
        </select>
        {synthState.rightHandMode === 'fingerLayout' ? (
          <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', margin: 0 }}>1–4 指設定三和弦／轉位／七和弦。高度 = 音量，傾斜 = 音色。</p>
        ) : (
          <>
            <select value={synthState.lockedChordStyle ?? 'majorTriad'} onChange={(e) => { trackSettingChanged('chord_style', e.target.value); setSynthState(prev => ({ ...prev, lockedChordStyle: e.target.value as ChordStyle })); }}>
              {CHORD_STYLE_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
            </select>
            <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', margin: 0 }}>和弦風格已鎖定，右手仍控制音量與音色。</p>
          </>
        )}
      </div>

      {/* Arp / Bass extras */}
      {(synthState.arpeggiate || synthState.autoBass) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
          {synthState.arpeggiate && (
            <div>
              <label style={{ color: 'var(--neon-purple)', fontWeight: 600 }}>琶音</label>
              <select value={synthState.arpSpeed} onChange={(e) => { trackSettingChanged('arp_speed', e.target.value); setSynthState(prev => ({ ...prev, arpSpeed: e.target.value as ArpSpeed })); }} style={{ width: '100%' }}>
                <option value="slow">慢（120ms）</option>
                <option value="normal">一般（80ms）</option>
                <option value="fast">快（50ms）</option>
              </select>
            </div>
          )}
          {synthState.autoBass && (
            <div>
              <label style={{ color: 'var(--neon-amber)', fontWeight: 600 }}>低音音量</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="range" min="0" max="1" step="0.05" value={synthState.bassVolume} onChange={(e) => { trackSettingChanged('bass_volume', e.target.value); setSynthState(prev => ({ ...prev, bassVolume: parseFloat(e.target.value) })); }} style={{ flex: 1, accentColor: 'var(--neon-cyan)' }} />
                <span style={{ fontSize: '0.6rem', width: '24px' }}>{Math.round(synthState.bassVolume * 100)}%</span>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Visual atmosphere — stage lighting, WYSIWYG with the live
          view and the recording window (window only; design bands
          stay clean). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid rgba(0, 0, 0, 0.08)', paddingTop: '10px', flexWrap: 'wrap' }}>
        <label style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>視覺 — 氛圍</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: vignetteStrength > 0 ? 'var(--neon-cyan)' : 'var(--text-muted)', fontSize: '0.6rem', width: '62px' }}>暗角</span>
            <input
              type="range" min="0" max="100" step="5" value={vignetteStrength}
              onChange={(e) => { trackSettingChanged('vignette', e.target.value); setVignetteStrength(Number(e.target.value)); }}
              style={{ width: '90px', accentColor: 'var(--neon-cyan)' }}
            />
            <span style={{ fontSize: '0.6rem', width: '26px', color: 'var(--text-muted)' }}>{vignetteStrength}%</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: scanlinesStrength > 0 ? 'var(--neon-cyan)' : 'var(--text-muted)', fontSize: '0.6rem', width: '62px' }}>掃描線</span>
            <input
              type="range" min="0" max="100" step="5" value={scanlinesStrength}
              onChange={(e) => { trackSettingChanged('scanlines', e.target.value); setScanlinesStrength(Number(e.target.value)); }}
              style={{ width: '90px', accentColor: 'var(--neon-cyan)' }}
            />
            <span style={{ fontSize: '0.6rem', width: '26px', color: 'var(--text-muted)' }}>{scanlinesStrength}%</span>
          </label>
        </div>
      </div>
      {/* No-camera mode — keyboard drives the same pipeline.
          Desktop only: phones have no physical keyboard (soft
          keyboards cover the screen; Shift/arrow keys are unusable). */}
      {!isMobile && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid rgba(0, 0, 0, 0.08)', paddingTop: '10px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={keyboardMode}
            onChange={(e) => onKeyboardToggle(e.target.checked)}
            style={{ accentColor: 'var(--neon-cyan)' }}
          />
          <span style={{ color: keyboardMode ? 'var(--neon-cyan)' : 'var(--text-secondary)', fontSize: '0.68rem', fontWeight: 600 }}>
            沒有相機？用鍵盤模式（桌機）
          </span>
        </label>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
          — 也可以隨時用上方工具列的 ⌨ 鍵盤／📷 相機 按鈕切換
        </span>
      </div>
      )}
      {/* Customize Keys — rebind any keyboard-mode action (2026-08-10:
          '[' / ']' minor/major sit behind AltGr on German QWERTZ, hard to
          reach mid-play). Escape cancels a pending rebind; Space can't be
          reassigned (reserved for stop-all). */}
      {!isMobile && keyboardMode && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(0, 0, 0, 0.08)', paddingTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
          <label style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.68rem' }}>自訂按鍵</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              value={matchingPresetId(keymap)}
              onChange={(e) => {
                const preset = KEYMAP_PRESETS.find((p) => p.id === e.target.value);
                if (preset) { trackSettingChanged('keymap_preset', preset.id); onKeymapChange({ ...preset.map }); setListeningFor(null); setConflictMsg(null); }
              }}
              style={{ fontSize: '0.58rem', padding: '2px 4px' }}
              data-tip="配置預設 — 只是起點，下方仍可重新綁定"
            >
              {KEYMAP_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              {!KEYMAP_PRESETS.some((p) => p.id === matchingPresetId(keymap)) && <option value="custom">自訂</option>}
            </select>
            <button
              onClick={onOpenGuide}
              style={{ fontSize: '0.58rem', padding: '2px 6px', background: 'none', border: '1px solid rgba(0, 0, 0, 0.15)', borderRadius: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}
              data-tip="顯示實體鍵盤與目前所有綁定"
            >
              查看鍵盤配置
            </button>
            <button
              onClick={() => { onKeymapChange({ ...DEFAULT_KEYMAP }); setListeningFor(null); setConflictMsg(null); }}
              style={{ fontSize: '0.58rem', padding: '2px 6px', background: 'none', border: '1px solid rgba(0, 0, 0, 0.15)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              恢復預設
            </button>
          </div>
        </div>
        {conflictMsg && (
          <p style={{ fontSize: '0.58rem', color: 'var(--neon-magenta)', margin: 0 }}>{conflictMsg} — 請按其他鍵，或按 Esc 取消。</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '180px' }}>
            <span style={{ fontSize: '0.58rem', color: 'var(--neon-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>和聲</span>
            {ACTION_ORDER.filter((a) => ACTION_META[a].group === 'harmony').map(renderKeyRow)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '180px' }}>
            <span style={{ fontSize: '0.58rem', color: 'var(--neon-magenta)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>表情</span>
            {ACTION_ORDER.filter((a) => ACTION_META[a].group === 'expression').map(renderKeyRow)}
          </div>
        </div>
      </div>
      )}
      {/* Pro-gate probe: advertises the Pro boundary without gating
          anything — clicks = paid-intent signal (no payment involved). */}
      <div
        className="pro-teaser"
        role="button"
        tabIndex={0}
        onClick={() => trackProGateClicked('settings')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trackProGateClicked('settings'); } }}
      >
        🔒 <strong>Pro</strong>（即將推出）：更多樂器 · 無限錄製 · 無浮水印
      </div>
    </div>
  );
}
