// Hiệu ứng âm thanh tổng hợp bằng Web Audio API (design D6, docs/design/README.md §5).
// Không dùng file âm thanh. Mọi lỗi Web Audio đều bị nuốt: âm thanh không bao giờ làm hỏng luồng nghiệp vụ.

export type SfxName = "reward" | "penalty" | "pop" | "coin";

type Note = readonly [freq: number, start: number, duration: number];

export const SFX: Record<SfxName, { type: OscillatorType; gain: number; notes: readonly Note[] }> = {
  reward: { type: "triangle", gain: 0.18, notes: [[523.25, 0, 0.16], [659.25, 0.09, 0.16], [783.99, 0.18, 0.16], [1046.5, 0.27, 0.4]] },
  penalty: { type: "sine", gain: 0.16, notes: [[392, 0, 0.28], [293.66, 0.22, 0.45]] },
  pop: { type: "sine", gain: 0.14, notes: [[660, 0, 0.07], [990, 0.06, 0.09]] },
  coin: { type: "square", gain: 0.06, notes: [[987.77, 0, 0.08], [1318.51, 0.08, 0.3]] },
};

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
      // Envelope: tăng trong 15ms rồi giảm theo hàm mũ về 0.0001 (README §5).
      g.gain.setValueAtTime(0.0001, now + start);
      g.gain.exponentialRampToValueAtTime(s.gain, now + start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      o.connect(g);
      g.connect(c.destination);
      o.start(now + start);
      o.stop(now + start + duration + 0.05);
    }
  } catch {
    // Bỏ qua lặng lẽ.
  }
}
