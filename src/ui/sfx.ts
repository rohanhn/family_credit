// Hiệu ứng âm thanh tổng hợp bằng Web Audio API (design D6, docs/design/README.md §5).
// Không dùng file âm thanh. Mọi lỗi Web Audio đều bị nuốt: âm thanh không bao giờ làm hỏng luồng nghiệp vụ.

export type SfxName = "reward" | "penalty" | "pop" | "coin";

type Note = readonly [freq: number, start: number, duration: number];

export type SfxDef = { type: OscillatorType; gain: number; notes: readonly Note[] };

export const SFX: Record<SfxName, SfxDef> = {
  reward: { type: "triangle", gain: 0.18, notes: [[523.25, 0, 0.16], [659.25, 0.09, 0.16], [783.99, 0.18, 0.16], [1046.5, 0.27, 0.4]] },
  penalty: { type: "sine", gain: 0.16, notes: [[392, 0, 0.28], [293.66, 0.22, 0.45]] },
  pop: { type: "sine", gain: 0.14, notes: [[660, 0, 0.07], [990, 0.06, 0.09]] },
  coin: { type: "square", gain: 0.06, notes: [[987.77, 0, 0.08], [1318.51, 0.08, 0.3]] },
};

// Đường bao âm lượng của một nốt (change lengthen-sound-effects, design D1):
// tăng tới đỉnh trong ATTACK_S, giữ đỉnh tới HOLD_RATIO độ dài nốt, rồi giảm theo hàm mũ về ENVELOPE_FLOOR lúc hết nốt.
export const ATTACK_S = 0.015;
export const HOLD_RATIO = 0.6;
export const ENVELOPE_FLOOR = 0.0001;

/** Các mốc thời gian (giây) của đường bao một nốt; `playSfx` và các hàm đo dùng chung. */
export function noteEnvelope(start: number, duration: number): { start: number; attackEnd: number; holdEnd: number; end: number } {
  const attackEnd = start + ATTACK_S;
  return { start, attackEnd, holdEnd: Math.max(attackEnd, start + duration * HOLD_RATIO), end: start + duration };
}

/** Ngưỡng "nghe rõ": biên độ từ −30 dBFS trở lên (spec ui-theme "Thời gian nghe rõ của âm thanh phản hồi"). */
export const AUDIBLE_AMPLITUDE = 10 ** (-30 / 20);

/** Tổng độ dài của một âm (giây): lúc nốt cuối cùng kết thúc. */
export function sfxDuration(def: SfxDef): number {
  return Math.max(0, ...def.notes.map(([, start, duration]) => start + duration));
}

/** Thời gian nghe rõ của một âm (giây): hợp các khoảng mà đường bao của ít nhất một nốt đạt từ ngưỡng trở lên. */
export function sfxAudibleDuration(def: SfxDef, threshold: number = AUDIBLE_AMPLITUDE): number {
  if (def.gain < threshold) return 0;
  // Trên đoạn hàm mũ giữa ENVELOPE_FLOOR và đỉnh, tỷ lệ thời gian để đi từ sàn tới ngưỡng.
  const ratio = Math.log(threshold / ENVELOPE_FLOOR) / Math.log(def.gain / ENVELOPE_FLOOR);
  const spans = def.notes
    .map(([, start, duration]) => {
      const env = noteEnvelope(start, duration);
      const from = env.start + (env.attackEnd - env.start) * ratio;
      const to = env.holdEnd + (env.end - env.holdEnd) * (1 - ratio);
      return [from, to] as const;
    })
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let covered = -Infinity;
  for (const [from, to] of spans) {
    if (to <= covered) continue;
    total += to - Math.max(from, covered);
    covered = to;
  }
  return total;
}

/** Âm thanh chỉ phát khi gia đình bật **và** thiết bị không tắt loa (spec ui-theme "Âm thanh phản hồi"). */
export function shouldPlay(opts: { familyEnabled: boolean; deviceMuted: boolean }): boolean {
  return opts.familyEnabled && !opts.deviceMuted;
}

/** Khóa localStorage cho cờ tắt loa của thiết bị (giữ qua các lần đăng nhập). */
export const DEVICE_MUTED_KEY = "mc:sound-muted";

let ctx: AudioContext | null = null;
let resumeArmed = false;

function audioContext(): AudioContext | null {
  if (ctx) return ctx;
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  const Ctor = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/** Trình duyệt chặn phát âm khi người dùng chưa thao tác: thử resume() ở lần chạm kế tiếp. */
function armResumeOnNextGesture(c: AudioContext) {
  if (resumeArmed) return;
  resumeArmed = true;
  const resume = () => {
    resumeArmed = false;
    window.removeEventListener("pointerdown", resume, true);
    window.removeEventListener("keydown", resume, true);
    c.resume().catch(() => {});
  };
  window.addEventListener("pointerdown", resume, true);
  window.addEventListener("keydown", resume, true);
}

/** Phát một âm. Không bao giờ ném lỗi. */
export function playSfx(name: SfxName): void {
  try {
    const c = audioContext();
    if (!c) return;
    if (c.state === "suspended") {
      c.resume().catch(() => {});
      armResumeOnNextGesture(c);
    }
    const s = SFX[name];
    const now = c.currentTime;
    for (const [freq, start, duration] of s.notes) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = s.type;
      o.frequency.value = freq;
      const env = noteEnvelope(start, duration);
      g.gain.setValueAtTime(ENVELOPE_FLOOR, now + env.start);
      g.gain.exponentialRampToValueAtTime(s.gain, now + env.attackEnd);
      g.gain.setValueAtTime(s.gain, now + env.holdEnd);
      g.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, now + env.end);
      o.connect(g);
      g.connect(c.destination);
      o.start(now + start);
      o.stop(now + start + duration + 0.05);
    }
  } catch {
    // Bỏ qua lặng lẽ.
  }
}
