#!/usr/bin/env python3
"""
Podcast opening jingle for חתונה בלי פילטרים (8.0 s, 48 kHz stereo), written
note-for-note against the animation. Synthesised from scratch, no samples.

124 bpm throughout. Every sound has a picture:

  0.25  "Here comes the bride" on organ (Wagner 1850, public domain)
        — each of the four notes draws a part of the wedding glass
  2.19  "all dressed in…" + snare roll — the groom's shoe comes down
  3.15  smash instead of "white" — glass breaks, BEAT DROPS
  3.5   whoosh as the shards fly back … glass "ting" when חתונה locks (4.60)
  5.09  paper slap — בלי פילטרים sticker lands (bar 2, beat 1)
  6.06  sparkle — host names appear (bar 2, beat 3)
  7.02  "white" finally resolves on C major — the logo pops, then holds

Markers go to export/jingle-markers.json and match CONFIG.introTimeline.

Usage:  python3 tools/make_soundtrack.py   → export/podcast-jingle.{wav,m4a,mp3}
Needs:  numpy, scipy (and ffmpeg for m4a/mp3). Deterministic (fixed seed).
"""
import json
import os
import subprocess
import wave

import numpy as np
from scipy.signal import butter, lfilter, fftconvolve

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "export", "podcast-jingle.wav")

SR = 48000
BPM = 124
B = 60 / BPM                 # one beat
STEP = B / 4                 # 16th
LEAD_IN = 0.25
DROP = LEAD_IN + 6 * B       # glass smash / beat drop (3.153 s)
FINAL = DROP + 8 * B         # last hit, 2 bars after the drop (7.024 s)
LENGTH = 8.0
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



def snare_roll(dur):
    """16th → 32nd roll with a crescendo, for the last beat before the drop."""
    t_total = tvec(dur)
    out = np.zeros_like(t_total)
    hits = list(np.arange(0, dur * 0.5, STEP)) + list(np.arange(dur * 0.5, dur - 1e-6, STEP / 2))
    for h in hits:
        c = clap() * (0.25 + 0.75 * (h / dur) ** 1.5)
        i = int(h * SR)
        out[i:i + len(c)] += c[: len(out) - i]
    return out


def organ_bus(melody, chords, length, mel_gain=0.9, ch_gain=0.42):
    bus = np.zeros((2, int(SR * length)))
    for st, d, m in melody:
        place(bus, st, organ(midi(m), d, bright=1.25), gain=mel_gain)
    for st, d, notes in chords:
        for k, m in enumerate(notes):
            place(bus, st, organ(midi(m), d, bright=0.8), pan=(-0.35 if k % 2 else 0.35), gain=ch_gain)
    return bus


def chime(dur=1.2):
    """Bright glass 'ting' — the word locking into place."""
    t = tvec(dur)
    out = np.zeros_like(t)
    for f, a, d in ((2093, 0.5, 0.5), (3136, 0.3, 0.35), (4186, 0.22, 0.25), (6272, 0.12, 0.15)):
        out += a * np.sin(2 * np.pi * f * t) * np.exp(-t / d)
    return out * env_adsr(len(t), 0.002, 0.05) * 0.35


def sparkle(dur=0.6):
    """Quick rising glitter — names reveal."""
    out = np.zeros(int(dur * SR))
    for k, m in enumerate((84, 88, 91, 96, 100)):
        c = np.sin(2 * np.pi * midi(m) * tvec(0.5)) * np.exp(-tvec(0.5) / 0.12) * 0.12
        i = int(k * 0.035 * SR)
        out[i:i + len(c)] += c[: len(out) - i]
    return out


def whoosh(dur):
    """Air swelling toward the chime as the shards travel."""
    t = tvec(dur)
    n = filt(rng.standard_normal(len(t)), "band", [1500, 7000])
    return n * np.sin(np.pi * np.clip(t / dur, 0, 1) * 0.5) ** 3 * 0.18


def slap():
    """Paper sticker slap."""
    t = tvec(0.25)
    n = filt(rng.standard_normal(len(t)), "band", [500, 5000]) * np.exp(-t / 0.025)
    thump = np.sin(2 * np.pi * 110 * t) * np.exp(-t / 0.05)
    return (n * 0.9 + thump * 0.6)


def main():
    mix = np.zeros((2, N))
    drums = np.zeros((2, N))
    music = np.zeros((2, N))        # sidechained to the kick
    L = LEAD_IN
    at = lambda beats: L + beats * B

    # ---------------- A: organ ----------------
    melody = [(at(0), B, 67), (at(1), 0.75 * B, 72), (at(1.75), 0.25 * B, 72), (at(2), 2 * B, 72),
              (at(4), B, 67), (at(5), 0.75 * B, 74), (at(5.75), 0.22 * B, 71)]
    chords = [(at(0), B, [55]),
              (at(1), 3 * B, [36, 48, 52, 55, 60]),        # C
              (at(4), B, [43, 48, 52, 55]),                # C/G
              (at(5), 0.95 * B, [43, 47, 50, 53, 55])]     # G7 … breath
    org = organ_bus(melody, chords, DROP + 0.3)
    org[:, int((DROP - 0.05) * SR):] *= 0
    org = reverb(org, reverb_ir(2.2, 0.6, 7), 0.5)
    tail = int(DROP * SR)
    org[:, tail:] *= np.exp(-np.arange(org.shape[1] - tail) / (0.10 * SR))[None, :] * 0.4
    mix[:, : org.shape[1]] += org[:, :N] * 0.5

    # build-up under "all dressed in…"
    place(drums, at(4), filt(kick() * 0.35, "low", 180) * 0.6)
    place(drums, at(4.5), filt(kick() * 0.35, "low", 180) * 0.8)
    place(mix, at(4), riser(2 * B), gain=0.9)
    place(drums, at(5), snare_roll(B * 0.92), pan=0.05, gain=0.55)

    # ---------------- drop ----------------
    place(mix, DROP, glass_smash(), gain=1.0)
    place(drums, DROP, crash(), pan=0.25)
    WORD = DROP + 3 * B            # word locks
    STICKER = DROP + 4 * B         # bar 2 beat 1
    NAMES = DROP + 6 * B           # bar 2 beat 3
    place(mix, DROP + 0.38, whoosh(WORD - DROP - 0.38), pan=0.0)
    place(mix, WORD, chime(), gain=0.9)
    place(mix, STICKER, slap(), gain=0.8)
    place(mix, NAMES, sparkle(), pan=0.1, gain=1.0)

    kicks = []
    for bt in range(8):
        tb = DROP + bt * B
        place(drums, tb, kick(big=(bt == 0)), gain=1.0)
        kicks.append(tb)
        if bt % 2 == 1 and bt != 7:
            place(drums, tb, clap(), pan=0.05)
    for s16 in range(28):
        ts = DROP + s16 * STEP
        if s16 % 4 == 2:
            place(drums, ts, hat(True), pan=0.3, gain=0.5)
        elif s16 % 4 != 0:
            place(drums, ts, hat(False), pan=-0.3, gain=0.45 if s16 % 2 else 0.3)
    place(drums, DROP + 7 * B, snare_roll(B * 0.95), pan=-0.05, gain=0.7)

    # C → Am | F → G, two beats each
    prog = [(36, [60, 64, 67]), (33, [57, 60, 64]), (29, [53, 57, 60]), (31, [55, 59, 62])]
    for half, (root, ch) in enumerate(prog):
        base = DROP + half * 2 * B
        for st, o in ((0, 0), (3, 12), (6, 0)):
            if half == 3 and st == 6:
                continue
            place(music, base + st * STEP, bass(root + o, STEP * 2.6))
        for st in (2, 6):
            if half == 3 and st == 6:
                continue
            sb = stab(ch)
            i = int((base + st * STEP) * SR)
            music[:, i:i + sb.shape[1]] += sb[:, : N - i]

    # lead: the bridal melody in double time, answered an octave up; "white" waits for the final hit
    lead = [(0, 67), (3, 72), (4, 72), (6, 72), (8, 67), (11, 74), (12, 71), (14, 72),
            (16, 79), (19, 84), (20, 84), (22, 84), (24, 79), (26, 86), (27, 83)]
    for st, m in lead:
        place(music, DROP + st * STEP, pluck(m), pan=0.12, gain=0.9)
    # organ returns in bar 2 (classical meets the beat)
    org2 = organ_bus([], [(STICKER, 2 * B, [53, 57, 60, 65]), (STICKER + 2 * B, 1.9 * B, [55, 59, 62, 67])],
                     LENGTH, ch_gain=0.22)
    music += org2[:, :N]

    # ---------------- final hit ----------------
    place(drums, FINAL, kick(big=True), gain=1.0)
    place(drums, FINAL, crash(), pan=-0.25)
    place(music, FINAL, bass(36, 0.8), gain=1.2)
    for m, p in ((48, 0), (60, -0.3), (64, 0.3), (67, -0.2), (72, 0.2), (84, 0)):
        place(music, FINAL, pluck(m, 0.8, 7000), pan=p, gain=0.55)
    fin = organ_bus([(FINAL, 0.8, 72)], [(FINAL, 0.9, [36, 48, 52, 55, 60])], LENGTH - FINAL + 0.2,
                    mel_gain=0.5, ch_gain=0.25)
    place(mix, FINAL, fin[0], pan=-0.4)
    place(mix, FINAL, fin[1], pan=0.4)
    place(mix, FINAL, chime() * 0.6)

    duck = np.ones(N)
    for tk in kicks:
        i = int(tk * SR)
        t = np.arange(min(N - i, int(0.3 * SR))) / SR
        duck[i:i + len(t)] = np.minimum(duck[i:i + len(t)], 1 - 0.6 * np.exp(-t / 0.09))
    music *= duck

    mix += reverb(music + drums * 0.15, reverb_ir(1.8, 0.4, 11), 0.2) + drums * 0.85

    fo = int((LENGTH - 0.45) * SR)
    mix[:, fo:] *= np.linspace(1, 0, N - fo)[None, :] ** 2
    mix = np.tanh(mix * 0.9) / np.tanh(0.9)
    mix *= 0.89 / np.max(np.abs(mix))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    pcm = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
    with wave.open(OUT, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    base = OUT[:-4]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", OUT, "-c:a", "aac", "-b:a", "256k", base + ".m4a"], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", OUT, "-c:a", "libmp3lame", "-b:a", "320k", base + ".mp3"], check=True)

    r = lambda v: round(v, 3)
    markers = {"length": LENGTH, "bpm": BPM, "beat": round(B, 5),
               "organNotes": [r(m[0]) for m in melody], "drop": r(DROP), "wordLock": r(WORD),
               "stickerSlap": r(STICKER), "namesSparkle": r(NAMES), "finalHit": r(FINAL)}
    with open(os.path.join(ROOT, "export", "jingle-markers.json"), "w") as f:
        json.dump(markers, f, indent=2)
    print(json.dumps(markers))


if __name__ == "__main__":
    main()
