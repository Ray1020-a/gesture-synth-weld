/**
 * Recording UI sheet (extracted from App.tsx Render 2026-08-09, pure
 * move): 3-2-1 countdown + wrap-up overlays, the mode/ratio/mic chooser,
 * and the result panel (in-page preview, download, share).
 *
 * Pure presentation — every value comes from useRecording's returned
 * surface (the App passes the same object it destructured), so the sheet
 * never touches recording internals.
 */

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { RecMode, RecPhase, RecRatio } from '../types';
import type { VocalPolish } from '../audioEngine';
import type { StoredWork } from '../works/workStore';
import {
  trackDownload,
  trackMicToggled,
  trackProGateClicked,
  trackProGateSeen,
  trackRecordingModeChanged,
  trackSettingChanged,
  trackWorkDeleted,
  trackWorkDownloaded,
  trackWorkReplayed,
  trackWorksListSeen,
} from '../analytics';
import { REC_RATIO_HINTS, REC_SVG_PREVIEWS, VIDEO_REC_SUPPORTED } from './constants';
import { POST_CAPTION } from './useRecording';

/** sessionStorage guard shared with WorksPanel (same key) - whichever
 *  works list the player meets first in a session wins (2026-08-18). */
const WORKS_SEEN_GUARD = 'gsw-works-seen-sent';

export interface RecSheetProps {
  recPhase: RecPhase;
  setRecPhase: Dispatch<SetStateAction<RecPhase>>;
  recCount: number;
  endCount: number | null;
  recMode: RecMode;
  setRecMode: Dispatch<SetStateAction<RecMode>>;
  recRatio: RecRatio;
  setRecRatio: Dispatch<SetStateAction<RecRatio>>;
  savedRecModeExists: boolean;
  keyboardMode: boolean;
  // mic (sing-along)
  micStreamRef: { current: MediaStream | null };
  micOn: boolean;
  setMicOn: (v: boolean) => void;
  micLevel: number;
  micPermState: 'unknown' | 'granted' | 'denied' | 'prompt';
  micDevices: MediaDeviceInfo[];
  micDeviceId: string;
  recVoice: number;
  setRecVoice: (v: number) => void;
  recPolish: VocalPolish;
  setRecPolish: (v: VocalPolish) => void;
  requestMic: () => Promise<boolean>;
  switchMicDevice: (deviceId: string) => void;
  // result
  recBlob: { blob: Blob; filename: string } | null;
  recPreviewUrl: string | null;
  shareFailed: boolean;
  canFileShare: boolean;
  /** Desktop share path (2026-10-07): copies the post caption; the flag
   *  drives the "✓ copied" feedback line. */
  copyCaption: () => void;
  captionCopied: boolean;
  downloadRec: () => void;
  shareRec: () => void;
  handleStartRecording: () => void;
  // local recordings library (shared with the landing, 2026-08-18): the
  // history list below the preview - deleting here syncs everywhere.
  works: StoredWork[] | null;
  onDeleteWork: (id: string) => void;
}

export function RecSheet(props: RecSheetProps) {
  const {
    recPhase, setRecPhase, recCount, endCount,
    recMode, setRecMode, recRatio, setRecRatio, savedRecModeExists, keyboardMode,
    micStreamRef, micOn, setMicOn, micLevel, micPermState, micDevices, micDeviceId,
    recVoice, setRecVoice, recPolish, setRecPolish, requestMic, switchMicDevice,
    recBlob, recPreviewUrl, shareFailed, canFileShare, copyCaption, captionCopied, downloadRec, shareRec,
    handleStartRecording, works, onDeleteWork,
  } = props;

  // Result-panel preview switching (2026-08-18): the player defaults to
  // THIS take (recPreviewUrl); clicking a history row swaps it to that
  // work's blob. Local UI state only - recording domain is untouched.
  const [histUrl, setHistUrl] = useState<string | null>(null);
  const histUrlRef = useRef<string | null>(null);
  const [histId, setHistId] = useState<string | null>(null);

  // New take ready (or panel closed) -> back to THIS recording.
  useEffect(() => {
    setHistUrl(null);
    setHistId(null);
  }, [recBlob, recPhase]);

  // The history work currently previewed (null = playing THIS take).
  // The player element must follow the SELECTED work's type, not the
  // current recording's mode (bug 2026-08-18: video works previewed in an
  // audio result played as <audio>).
  const histWork = histId ? (works ?? []).find((w) => w.id === histId) ?? null : null;
  const previewIsVideo = histUrl ? (histWork?.type === 'video') : recMode !== 'audio';

  // Revoke preview object URLs on unmount.
  useEffect(() => () => {
    if (histUrlRef.current) URL.revokeObjectURL(histUrlRef.current);
  }, []);

  // Pro-gate probe: the teaser is visible exactly while its section is —
  // seen fires once per open (phase changes are the open/close signals).
  useEffect(() => {
    if (recPhase === 'choosing') trackProGateSeen('rec_chooser');
    if (recPhase === 'result') trackProGateSeen('rec_result');
  }, [recPhase]);

  // works_list_seen (2026-08-18, session guard): the result panel's
  // history list is ALSO a works-list sighting. Fires once per session on
  // whichever list the player meets first (result panel or landing modal)
  // - the seen denominator must match the two replayed sources.
  useEffect(() => {
    if (recPhase === 'result' && works && works.length > 0 && !sessionStorage.getItem(WORKS_SEEN_GUARD)) {
      sessionStorage.setItem(WORKS_SEEN_GUARD, '1');
      trackWorksListSeen(works.length);
    }
  }, [recPhase, works]);

  return (
    <>
      {/* 3-2-1 countdown overlay */}
      {recPhase === 'countdown' && (
        <div className="countdown-overlay">
          <div className="countdown-hint">準備好</div>
          <div key={recCount} className="countdown-num">{recCount}</div>
        </div>
      )}

      {/* Wrap-up 3-2-1 during the last 3s — same language as the opening,
          lighter dim so the hands stay visible; DOM-only, never in the video */}
      {endCount !== null && (
        <div className="countdown-overlay" style={{ background: 'rgba(255, 255, 255, 0.42)' }}>
          <div className="countdown-hint">即將結束</div>
          <div key={endCount} className="countdown-num wrap-up">{endCount}</div>
        </div>
      )}

      {/* Mode + ratio chooser (bottom sheet on mobile, card on desktop) */}
      {recPhase === 'choosing' && (
        <div className="rec-sheet">
          <div className="rec-body">
            <div className="rec-sheet-title">錄製演奏</div>
            <div className="rec-sheet-sub">
              {keyboardMode
                ? '鍵盤模式只錄音訊 — 沒有相機畫面可錄'
                : '要錄下什麼內容？'}
            </div>
            <div className="rec-options">
              {((keyboardMode ? ['audio'] : ['video', 'skeleton', 'audio']) as RecMode[]).map((id) => (
                <button
                  key={id}
                  className={`rec-option ${recMode === id ? 'active' : ''} ${id !== 'audio' && !VIDEO_REC_SUPPORTED ? 'disabled' : ''}`}
                  onClick={() => { if ((id === 'audio' || VIDEO_REC_SUPPORTED) && id !== recMode) { trackRecordingModeChanged(recMode, id); setRecMode(id); } }}
                >
                  {REC_SVG_PREVIEWS[id]}
                  <span>
                    <strong>
                      {id === 'video' ? '完整畫面' : id === 'skeleton' ? '骨架' : '只錄音訊'}
                      {/* "default" only makes sense for first-time choosers —
                          returning players see their own saved choice */}
                      {id === 'skeleton' && !savedRecModeExists && <span className="rec-default-tag">預設</span>}
                    </strong>
                    {/* Intent labels — kept short enough to fit ONE line
                        on mobile buttons (~160px), so the chooser doesn't
                        grow rows. */}
                    <em>{id === 'video' ? '真人入鏡 — 最適合分享' : id === 'skeleton' ? '保護隱私' : '只有聲音'}</em>
                  </span>
                </button>
              ))}
            </div>
            {recMode !== 'audio' && (
              <>
                <div className="rec-sheet-sub">畫面比例</div>
                <div className="rec-ratios">
                  {(['9:16', '16:9', '1:1'] as RecRatio[]).map((r) => (
                    <button key={r} className={`rec-ratio-btn ${recRatio === r ? 'active' : ''}`} onClick={() => setRecRatio(r)}>{r}</button>
                  ))}
                </div>
                <div className="rec-ratio-hint">{REC_RATIO_HINTS[recRatio]}</div>
              </>
            )}
            {recMode !== 'audio' && !VIDEO_REC_SUPPORTED && (
              <div className="rec-warn">此瀏覽器不支援錄影 — 請選擇「只錄音訊」。</div>
            )}
            {/* Mic section: ALWAYS visible so users know the sing-along
                feature exists — grayed out until the mic is enabled */}
            <div className={`rec-mic-section ${micStreamRef.current ? '' : 'disabled'}`}>
              <label className="rec-mic-toggle">
                <input type="checkbox" checked={micOn} onChange={(e) => { trackMicToggled(e.target.checked); setMicOn(e.target.checked); }} disabled={!micStreamRef.current} />
                <span>🎤 加入我的聲音 — 跟著和弦一起唱</span>
              </label>
              {micStreamRef.current ? (
                <>
                  {/* Liquid-glass mic level meter */}
                  <div className="rec-mic-meter" title="麥克風音量 — 說話測試看看">
                    {Array.from({ length: 14 }, (_, i) => {
                      const h = micLevel > 0.02 ? Math.max(14, Math.min(100, micLevel * 100 * (0.55 + 0.45 * ((i % 3) / 2)))) : 5;
                      return <span key={i} style={{ height: `${h}%`, opacity: micLevel > 0.02 ? 1 : 0.25 }} />;
                    })}
                  </div>
                  {micDevices.length > 1 && (
                    <>
                      <div className="rec-sheet-sub">麥克風</div>
                      <select className="rec-device-select" value={micDeviceId} onChange={(e) => switchMicDevice(e.target.value)}>
                        {micDevices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label || '麥克風'}</option>
                        ))}
                      </select>
                    </>
                  )}
                  <div className="rec-sheet-sub">錄音混音 <span className="rec-mix-desc">— 調整人聲與和弦的平衡</span></div>
                  <div className="rec-mix-row">
                    <span>人聲</span>
                    <input type="range" min={50} max={200} value={Math.round(recVoice * 100)} onChange={(e) => setRecVoice(Number(e.target.value) / 100)} className="rec-mix-slider" />
                    <span>和弦</span>
                  </div>
                  <div className="rec-mix-value">成品中人聲 {Math.round(recVoice * 100)}%</div>
                  <div className="rec-sheet-sub">人聲修飾 <span className="rec-mix-desc">— 錄音中的人聲效果</span></div>
                  <select
                    className="rec-device-select"
                    value={recPolish}
                    onChange={(e) => { trackSettingChanged('vocal_polish', e.target.value); setRecPolish(e.target.value as VocalPolish); }}
                  >
                    <option value="off">關閉 — 原音</option>
                    <option value="light">輕度 — 細微</option>
                    <option value="standard">標準 — 推薦</option>
                    <option value="strong">強烈 — 空間感</option>
                  </select>
                </>
              ) : micPermState === 'denied' ? (
                <div className="rec-mic-notice">
                  <strong>想一起唱嗎？</strong>你可以在和弦上錄下自己的聲音 — 但此網站的
                  麥克風<strong>已被封鎖</strong>。請點網址列的 <strong>🔒 鎖頭圖示</strong>
                  → 網站設定 → 麥克風 → <strong>允許</strong>，再回到這裡。
                </div>
              ) : (
                <>
                  <div className="rec-mic-notice">
                    <strong>想一起唱嗎？</strong>你可以在和弦上錄下自己的聲音 — 但
                    麥克風尚未開啟。
                  </div>
                  <button className="rec-mic-enable-btn" onClick={() => requestMic()}>🎤 開啟麥克風</button>
                </>
              )}
            </div>
          </div>
          {/* Pro-gate probe: advertises the Pro boundary without gating
              anything — clicks = paid-intent signal (no payment involved). */}
          <div
            className="pro-teaser"
            role="button"
            tabIndex={0}
            onClick={() => trackProGateClicked('rec_chooser')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trackProGateClicked('rec_chooser'); } }}
          >
            🔒 <strong>Pro</strong>（即將推出）：無限錄製 · 無浮水印 · 更多樂器
          </div>
          <div className="rec-actions">
            <button className="rec-btn" onClick={() => setRecPhase('idle')}>取消</button>
            <button className="rec-btn primary" onClick={handleStartRecording}>開始 · 倒數 3 秒</button>
          </div>
        </div>
      )}

      {/* Result panel: download (all), share (mobile via Web Share API) */}
      {recPhase === 'result' && recBlob && (
        <div className="rec-sheet">
          <div className="rec-sheet-title">✓ 錄製完成</div>
          <div className="rec-sheet-sub">{recBlob.filename} · {(recBlob.blob.size / 1048576).toFixed(1)} MB</div>
          {/* In-page playback of the take — video plays immediately
              (muted for autoplay policy; tap the controls for sound).
              WYSIWYG: atmosphere, crop and watermarks all visible here.
              Audio-only takes get an <audio> player (no autoplay —
              playing sound unprompted is rude). */}
                    {(() => {
            const playerSrc = histUrl ?? recPreviewUrl;
            if (!playerSrc) return null;
            const withList = works && works.length > 0 ? ' rec-preview--with-list' : '';
            return !previewIsVideo ? (
              <audio src={playerSrc} className={`rec-preview rec-preview-audio${withList}`} controls />
            ) : (
              <video
                src={playerSrc}
                className={`rec-preview${withList}`}
                autoPlay
                muted
                playsInline
                controls
              />
            );
          })()}
          {/* Previewing an earlier recording - say so (default = THIS recording). */}
          {histUrl && (
            <div className="rec-previewing">▶ 正在預覽較早的錄音 — 下方按鈕仍作用於這次的錄音</div>
          )}
          {/* History list (2026-08-18, feedback - full version): the recordings
              from this browser, newest first (the just-saved one on top,
              matching the default preview). Click a row to preview it;
              per-row re-download or delete. Fixed height + scroll so the
              mobile sheet stays bounded; delete syncs to the landing via
              App's shared works state. */}
          {works && works.length > 0 && (
            <>
              <div className="rec-works-title">我的錄音（{works.length}）</div>
              <ul className="rec-works-list">
                {works.map((w) => (
                  <li key={w.id} className={`rec-works-item${histId === w.id ? ' active' : ''}`}>
                    <button
                      className="rec-works-play"
                      onClick={() => {
                        if (histUrlRef.current) URL.revokeObjectURL(histUrlRef.current);
                        const url = URL.createObjectURL(w.blob);
                        histUrlRef.current = url;
                        setHistUrl(url);
                        setHistId(w.id);
                        trackWorkReplayed();
                      }}
                      title="預覽這段錄音"
                    >{histId === w.id ? '■' : '▶'}</button>
                    <span className="rec-works-icon">{w.type === 'audio' ? '🎵' : '🎬'}</span>
                    <span className="rec-works-date">
                      {new Date(w.createdAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })} {new Date(w.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="rec-works-dur">{Math.floor(w.durationSec / 60)}:{String(w.durationSec % 60).padStart(2, '0')}</span>
                    <button
                      className="works-btn"
                      onClick={() => { trackWorkDownloaded(); const u = URL.createObjectURL(w.blob); const a = document.createElement('a'); a.href = u; a.download = w.filename; a.click(); URL.revokeObjectURL(u); }}
                      title="下載"
                    >💾</button>
                    <button
                      className="works-btn"
                      onClick={() => { trackWorkDeleted('result_panel'); onDeleteWork(w.id); if (histId === w.id) { setHistId(null); setHistUrl(null); } }}
                      title="刪除"
                    >🗑</button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="rec-actions">
            <button className="rec-btn" onClick={() => setRecPhase('idle')}>關閉</button>
            <button className="rec-btn primary" onClick={() => { trackDownload(); downloadRec(); }}>💾 下載</button>
            {/* Share: mobile gets the Web Share sheet; desktop has no
                Web Share API — the caption button opens that loop
                (2026-10-07; before this, desktop had NO share path). */}
            {canFileShare
              ? <button className="rec-btn primary" onClick={shareRec}>📤 分享</button>
              : <button className="rec-btn primary" onClick={copyCaption}>📋 複製文案</button>}
          </div>
          {canFileShare ? (
            <div className="rec-sheet-sub" style={{ marginTop: 10, lineHeight: 1.6 }}>
              直接分享：WhatsApp · WeChat · Telegram<br />
              TikTok · Instagram · 抖音：先存到相簿，再到 App 內上傳
            </div>
          ) : (
            <div className="rec-sheet-sub" style={{ marginTop: 10, lineHeight: 1.6 }}>
              發布方式：先下載，上傳到 TikTok · Instagram · YouTube Shorts，再貼上文案：<br />
              {captionCopied
                ? <span style={{ color: 'var(--neon-cyan)' }}>✓ 文案已複製 — 可以貼上了</span>
                : <em style={{ color: 'var(--text-muted)' }}>{POST_CAPTION}</em>}
            </div>
          )}
          {shareFailed && (
            <div className="rec-warn" style={{ marginTop: 8 }}>此瀏覽器無法分享 — 請改用下載。</div>
          )}
          {/* Local recordings library discoverability: the recording was auto-saved
              to this browser - tell the player they have a reason to come
              back (2026-08-17 retention experiment). */}
          <div className="rec-sheet-sub" style={{ marginTop: 8 }}>
            ✓ 已自動存到此瀏覽器 — 下次造訪時，「我的錄音」會出現在開始按鈕下方
          </div>
          {/* Pro-gate probe (result panel): the "keep the recording" moment —
              the most natural place to test paid-intent for removal of
              limits/watermark. Click = signal, never a paywall. */}
          <div
            className="pro-teaser"
            role="button"
            tabIndex={0}
            onClick={() => trackProGateClicked('rec_result')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trackProGateClicked('rec_result'); } }}
          >
            🔒 <strong>Pro</strong>（即將推出）：無限錄製 · 無浮水印 · 更多樂器
          </div>
        </div>
      )}
    </>
  );
}
