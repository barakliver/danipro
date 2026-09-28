#!/usr/bin/env python3
"""
Intro soundtrack (8.0 s, 48 kHz stereo), synthesised from scratch — no samples.

  0.00–4.16  "Here Comes the Bride" (Wagner, Bridal Chorus, 1850 — public domain)
             on a church-style organ, slow and regal.
  ~4.0       the organ tape-stops as the shoe winds up …
  4.16       … and the glass smash lands where "white" should be: BEAT DROP.
  4.16–7.52  125 bpm bouncy, cheeky beat. The pluck lead replays the bridal
             melody in double time; the sticker slap (6.08) lands on a clap.
  7.52       "white" finally arrives on the last hit, then a reverb tail.

Sync points match CONFIG.introTimeline in animation.js.
Deterministic: fixed random seed, identical output on every run.

Usage:  python3 tools/make_soundtrack.py      → export/intro-soundtrack.wav (+ .m4a)
Needs:  numpy, scipy  (ffmpeg for the .m4a)
"""
import os
import subprocess
import wave

import numpy as np
from scipy.signal import butter, lfilter, fftconvolve

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "export", "intro-soundtrack.wav")

SR = 48000
LENGTH = 8.0
DROP = 4.16                  # glass impact = beat drop (animation: introTimeline.impact)
BPM = 125
BEAT = 60 / BPM              # 0.48 s
STEP = BEAT / 4              # 16th note
FINAL = DROP + 7 * BEAT      # 7.52 s, last hit
rng = np.random.default_rng(1850)

N = int(SR * LENGTH)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tvec(dur):
    return np.arange(int(dur * SR)) / SR


def env_adsr(n, a, r, sustain_len=None):
    e = np.ones(n)
    na = max(1, int(a * SR))
    nr = max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def place(buf, start, sig, pan=0.0, gain=1.0):
    """Add mono sig into stereo buf at time start with equal-power pan."""
    i = int(round(start * SR))
    if i >= buf.shape[1]:
        return
    sig = sig[: buf.shape[1] - i]
    lg = np.cos((pan + 1) * np.pi / 4) * gain
    rg = np.sin((pan + 1) * np.pi / 4) * gain
    buf[0, i:i + len(sig)] += sig * lg
    buf[1, i:i + len(sig)] += sig * rg


def filt(x, kind, f, order=2):
    if isinstance(f, (list, tuple)):
        b, a = butter(order, [f[0] / (SR / 2), f[1] / (SR / 2)], btype=kind)
    else:
        b, a = butter(order, f / (SR / 2), btype=kind)
    return lfilter(b, a, x)


def reverb_ir(seconds, decay, seed):
    r = np.random.default_rng(seed)
    t = tvec(seconds)
    ir = r.standard_normal((2, len(t))) * np.exp(-t / decay)
    ir[:, : int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    ir = np.stack([filt(ir[0], "low", 6000), filt(ir[1], "low", 6000)])
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))


def reverb(x, ir, wet):
    y = np.stack([fftconvolve(x[0], ir[0])[: x.shape[1]], fftconvolve(x[1], ir[1])[: x.shape[1]]])
    return x * (1 - wet * 0.5) + y * wet


# ------------------------------------------------------------------ organ
ORGAN_HARM = [(1, 1.0), (2, 0.55), (3, 0.30), (4, 0.28), (5, 0.10), (6, 0.12), (8, 0.10), (0.5, 0.35)]


def organ(freq, dur, bright=1.0):
    t = tvec(dur + 0.15)
    s = np.zeros_like(t)
    for h, w in ORGAN_HARM:
        if freq * h > 9000:
            continue
        w = w * (bright if h >= 3 else 1)
        s += w * np.sin(2 * np.pi * freq * h * t)
        s += 0.5 * w * np.sin(2 * np.pi * freq * h * 1.0017 * t + 1.3)   # chorus rank
    return s * env_adsr(len(t), 0.045, 0.16) / 3.5


def classical():
    q = 60 / 92
    bus = np.zeros((2, int(SR * (DROP + 0.4))))
    # melody: Here comes the bride / all dressed in (white → smashed)
    mel = [(0.25, q, 67), (0.25 + q, 0.75 * q, 72), (0.25 + 1.75 * q, 0.25 * q, 72),
           (0.25 + 2 * q, 2 * q, 72), (0.25 + 4 * q, q, 67), (0.25 + 5 * q, 0.75 * q, 74),
           (0.25 + 5.75 * q, 0.40, 71)]
    for st, d, m in mel:
        place(bus, st, organ(midi(m), d * 0.96, bright=1.25), pan=0.0, gain=0.9)
    # harmony: pedal + chords
    chords = [(0.25, q, [55]),                                  # pickup, low G
              (0.25 + q, 3 * q, [36, 48, 52, 55, 60]),          # C major
              (0.25 + 4 * q, q, [43, 48, 52, 55]),              # C/G
              (0.25 + 5 * q, 1.2, [43, 47, 50, 53, 55])]        # G7
    for st, d, notes in chords:
        for k, m in enumerate(notes):
            place(bus, st, organ(midi(m), d, bright=0.8), pan=(-0.35 if k % 2 else 0.35), gain=0.42)
    return bus


def tape_stop(bus, start, end):
    """Slow the organ down to a halt between start and end (vinyl/tape stop)."""
    i0, i1 = int(start * SR), int(end * SR)
    n = i1 - i0
    k = np.linspace(0, 1, n)
    rate = (1 - k) ** 1.6                       # playback speed 1 → 0
    pos = i0 + np.cumsum(rate)
    out = bus.copy()
    for c in range(2):
        out[c, i0:i1] = np.interp(pos, np.arange(bus.shape[1]), bus[c]) * (1 - k ** 3)
    out[:, i1:] = 0
    return out


# ------------------------------------------------------------------ drums
def kick(big=False):
    t = tvec(0.45)
    f = 48 + 120 * np.exp(-t / 0.028)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / (0.32 if big else 0.2))
    click = rng.standard_normal(len(t)) * np.exp(-t / 0.002) * 0.3
    return np.tanh(1.6 * (s + click)) * 0.9


def clap(big=False):
    t = tvec(0.35)
    n = rng.standard_normal(len(t))
    e = np.zeros_like(t)
    for off in (0.0, 0.011, 0.022):
        tt = np.clip(t - off, 0, None)
        e += (t >= off) * np.exp(-tt / (0.009 if off < 0.02 else (0.16 if big else 0.1)))
    return filt(n * e, "band", [900, 3200 if not big else 4500]) * (0.9 if big else 0.6)


def hat(open_=False):
    t = tvec(0.25 if open_ else 0.06)
    return filt(rng.standard_normal(len(t)), "high", 7500) * np.exp(-t / (0.09 if open_ else 0.018)) * 0.35


def crash():
    t = tvec(2.2)
    return filt(rng.standard_normal(len(t)), "high", 4500) * np.exp(-t / 0.7) * 0.28


def glass_smash():
    t = tvec(1.2)
    crack = filt(rng.standard_normal(len(t)), "high", 2500) * np.exp(-t / 0.05) * 0.9
    tinkle = np.zeros_like(t)
    for _ in range(14):
        f = rng.uniform(2800, 7800)
        d = rng.uniform(0.0, 0.35)
        tt = np.clip(t - d, 0, None)
        tinkle += (t >= d) * np.sin(2 * np.pi * f * tt) * np.exp(-tt / rng.uniform(0.04, 0.2)) * rng.uniform(0.05, 0.14)
    return crack + tinkle


def riser(dur):
    t = tvec(dur)
    n = rng.standard_normal(len(t))
    out = np.zeros_like(t)
    # sweep a band-pass upward in chunks
    chunks = 24
    L = len(t) // chunks
    for c in range(chunks):
        seg = n[c * L:(c + 1) * L]
        fc = 600 * (12 ** (c / chunks))
        out[c * L:(c + 1) * L] = filt(seg, "band", [fc * 0.7, min(fc * 1.4, 20000)])
    return out * (t / dur) ** 2 * 0.25


# ------------------------------------------------------------------ synths
def saw(freq, dur, detune=0.0):
    t = tvec(dur)
    s = 2 * ((freq * (1 + detune) * t) % 1.0) - 1
    return s


def bass(m, dur):
    t = tvec(dur)
    s = saw(midi(m), dur) + 0.6 * np.sin(2 * np.pi * midi(m) * t)
    s = filt(s, "low", 900)
    s = np.tanh(2.2 * s) * np.exp(-t / 0.22) * env_adsr(len(t), 0.004, 0.03)
    return s * 0.55


def pluck(m, dur=0.22, bright=5500):
    t = tvec(dur)
    f = midi(m)
    s = 0.6 * saw(f, dur) + 0.5 * np.sign(np.sin(2 * np.pi * f * t)) * 0.5
    s = filt(s, "low", bright)
    return s * np.exp(-t / 0.075) * env_adsr(len(t), 0.002, 0.03) * 0.42


def stab(notes, dur=0.16):
    t = tvec(dur)
    out = np.zeros((2, len(t)))
    for m in notes:
        for c, dt in enumerate((-0.006, 0.006)):
            out[c] += saw(midi(m), dur, dt)
    out = np.stack([filt(out[0], "low", 3200), filt(out[1], "low", 3200)])
    return out * np.exp(-t / 0.06) * env_adsr(len(t), 0.002, 0.02) * 0.12


def main():
    mix = np.zeros((2, N))
    drums = np.zeros((2, N))
    music = np.zeros((2, N))        # sidechained

    # ---- classical opening + tape stop into the smash
    cl = classical()
    cl = tape_stop(cl, DROP - 0.20, DROP)
    cl = reverb(cl, reverb_ir(2.6, 0.75, 7), 0.55)
    tail = int(DROP * SR)
    fade = np.ones(cl.shape[1])
    fade[tail:] = np.exp(-np.arange(cl.shape[1] - tail) / (0.12 * SR)) * 0.5
    cl *= fade
    mix[:, : cl.shape[1]] += cl[:, :N] * 0.45

    place(mix, DROP - 0.62, riser(0.62), gain=1.0)

    # ---- the drop
    place(mix, DROP, glass_smash(), pan=0.0, gain=1.0)
    place(drums, DROP, crash(), pan=0.25)
    place(drums, FINAL, crash(), pan=-0.25)

    kicks = []
    for b in range(8):
        tb = DROP + b * BEAT
        if tb > FINAL + 1e-6:
            break
        place(drums, tb, kick(big=(b == 0 or tb >= FINAL - 1e-6)), gain=1.0)
        kicks.append(tb)
        if b % 2 == 1:
            big = abs(tb - (DROP + 3 * BEAT)) < 1e-6           # sticker slap at 6.08
            place(drums, tb, clap(big=big), pan=0.05, gain=1.3 if big else 1.0)
    for s16 in range(28):                                        # hats up to the final hit
        ts = DROP + s16 * STEP
        if s16 % 4 == 2:
            place(drums, ts, hat(True), pan=0.3, gain=0.5)
        elif s16 % 4 != 0:
            place(drums, ts, hat(False), pan=-0.3, gain=0.45 if s16 % 2 else 0.3)
    place(drums, DROP + 6.5 * BEAT, kick(), gain=0.55)              # pickup into the last hit

    # bass: C → Am | F → G, bouncy octave pattern
    roots = [36, 33, 29, 31]
    for half, r in enumerate(roots):
        base = DROP + half * 2 * BEAT
        for st, o in ((0, 0), (3, 12), (6, 0)):
            if half == 3 and st == 6:
                continue
            place(music, base + st * STEP, bass(r + o, STEP * 2.6), gain=1.0)
    place(music, FINAL, bass(36, 0.5), gain=1.2)

    # chord stabs on the off-beats
    chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]
    for half, ch in enumerate(chords):
        base = DROP + half * 2 * BEAT
        for st in (2, 6):
            if half == 3 and st == 6:
                continue
            sb = stab(ch)
            i = int((base + st * STEP) * SR)
            music[:, i:i + sb.shape[1]] += sb[:, : N - i]

    # lead: the bridal melody, double time and cheeky
    lead = [(0, 67), (3, 72), (4, 72), (6, 72), (8, 67), (11, 74), (12, 71), (14, 72),
            (16, 79), (19, 84), (20, 84), (22, 84), (24, 79), (26, 86), (27, 83)]
    for st, m in lead:
        place(music, DROP + st * STEP, pluck(m), pan=0.12, gain=0.9)
    # "white" finally lands: full C major on the final hit
    for m, p in ((48, 0), (60, -0.3), (64, 0.3), (67, -0.2), (72, 0.2), (84, 0)):
        place(music, FINAL, pluck(m, 0.6, 7000), pan=p, gain=0.55)
    place(music, FINAL, glass_smash() * 0.35, gain=1.0)

    # sidechain: duck music under every kick
    duck = np.ones(N)
    for tk in kicks:
        i = int(tk * SR)
        t = np.arange(min(N - i, int(0.3 * SR))) / SR
        duck[i:i + len(t)] = np.minimum(duck[i:i + len(t)], 1 - 0.6 * np.exp(-t / 0.09))
    music *= duck

    beat_bus = reverb(music + drums * 0.15, reverb_ir(1.6, 0.35, 11), 0.18) + drums * 0.85
    mix += beat_bus

    # final fade & master
    fo = int((LENGTH - 0.25) * SR)
    mix[:, fo:] *= np.linspace(1, 0, N - fo) ** 2
    mix = np.tanh(mix * 0.9) / np.tanh(0.9)
    mix *= 0.89 / np.max(np.abs(mix))                                # peak ≈ -1 dBFS

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    pcm = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
    with wave.open(OUT, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    m4a = OUT[:-4] + ".m4a"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", OUT, "-c:a", "aac", "-b:a", "256k", m4a], check=True)
    print("wrote", os.path.relpath(OUT, ROOT), "and", os.path.relpath(m4a, ROOT))


if __name__ == "__main__":
    main()
