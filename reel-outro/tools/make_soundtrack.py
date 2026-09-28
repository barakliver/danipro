#!/usr/bin/env python3
"""
Podcast opening jingle for חתונה בלי פילטרים (~15.4 s, 48 kHz stereo).
Synthesised from scratch — no samples, no recordings.

One tempo throughout (124 bpm) so the two worlds flow into each other:

  A  0.35–6.16  "Here Comes the Bride" (Wagner, 1850 — public domain) on organ,
                in half-time of the beat. Under "all dressed in…" a heartbeat
                kick, a rising sweep and a snare roll build up, then a breath.
  ↓  6.16       "white" is replaced by a glass smash: the beat drops.
  B  bars 1–4   bouncy beat (C · Am · F · G). A pluck replays the bridal melody;
                the organ chords come back in bars 3–4 to tie both halves together.
  ✓  13.90      "white" finally resolves on C major, then a reverb tail.

Also drives the intro video: CONFIG.introTimeline in animation.js uses the
same markers (written to export/jingle-markers.json).

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
LEAD_IN = 0.35
DROP = LEAD_IN + 12 * B      # glass smash / beat drop
FINAL = DROP + 16 * B        # last hit, 4 bars after the drop
LENGTH = round(FINAL + 1.5, 2)
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


def main():
    mix = np.zeros((2, N))
    drums = np.zeros((2, N))
    music = np.zeros((2, N))        # sidechained to the kick
    L = LEAD_IN
    at = lambda beats: L + beats * B

    # ---------------- A: organ, half-time ----------------
    melody = [(at(0), 2 * B, 67), (at(2), 1.5 * B, 72), (at(3.5), 0.5 * B, 72), (at(4), 4 * B, 72),
              (at(8), 2 * B, 67), (at(10), 1.5 * B, 74), (at(11.5), 0.4 * B, 71)]
    chords = [(at(0), 2 * B, [55]),
              (at(2), 6 * B, [36, 48, 52, 55, 60]),        # C
              (at(8), 2 * B, [43, 48, 52, 55]),            # C/G
              (at(10), 1.9 * B, [43, 47, 50, 53, 55])]     # G7 … breath
    org = organ_bus(melody, chords, DROP + 0.3)
    org[:, int((DROP - 0.06) * SR):] *= 0                   # the breath before the drop
    org = reverb(org, reverb_ir(2.6, 0.75, 7), 0.55)
    tail = int(DROP * SR)
    org[:, tail:] *= np.exp(-np.arange(org.shape[1] - tail) / (0.10 * SR))[None, :] * 0.4
    mix[:, : org.shape[1]] += org[:, :N] * 0.5

    # build-up under "all dressed in…"
    for k in range(4):
        hb = kick() * 0.35
        place(drums, at(8 + k), filt(hb, "low", 180) * (0.5 + 0.17 * k), gain=1.0)
    place(mix, at(8), riser(4 * B), gain=0.9)
    place(drums, at(11), snare_roll(B * 0.92), pan=0.05, gain=0.55)

    # ---------------- drop ----------------
    place(mix, DROP, glass_smash(), gain=1.0)
    place(drums, DROP, crash(), pan=0.25)

    kicks = []
    for bt in range(16):
        tb = DROP + bt * B
        place(drums, tb, kick(big=(bt == 0)), gain=1.0)
        kicks.append(tb)
        if bt % 2 == 1 and bt != 15:
            big = bt in (3, 7)                        # sticker slap, names reveal pick-ups
            place(drums, tb, clap(big=big), pan=0.05, gain=1.2 if big else 1.0)
    for s16 in range(60):
        ts = DROP + s16 * STEP
        if s16 % 4 == 2:
            place(drums, ts, hat(True), pan=0.3, gain=0.5)
        elif s16 % 4 != 0:
            place(drums, ts, hat(False), pan=-0.3, gain=0.45 if s16 % 2 else 0.3)
    # fill into the final hit
    place(drums, DROP + 15 * B, snare_roll(B * 0.95), pan=-0.05, gain=0.7)
    place(mix, DROP + 13 * B, riser(3 * B), gain=0.6)

    # bass, one chord per bar
    prog = [(36, [60, 64, 67]), (33, [57, 60, 64]), (29, [53, 57, 60]), (31, [55, 59, 62])]
    for bar, (root, ch) in enumerate(prog):
        base = DROP + bar * 4 * B
        for st, o in ((0, 0), (3, 12), (6, 0), (8, 0), (11, 12), (14, 0)):
            if bar == 3 and st >= 12:
                continue
            place(music, base + st * STEP, bass(root + o, STEP * 2.6))
        for st in (2, 6, 10, 14):
            if bar == 3 and st == 14:
                continue
            sb = stab(ch)
            i = int((base + st * STEP) * SR)
            music[:, i:i + sb.shape[1]] += sb[:, : N - i]

    # lead: the bridal melody, double time — answers an octave up in bars 3–4
    motif_a = [(0, 67), (3, 72), (4, 72), (6, 72)]
    motif_b = [(0, 67), (3, 74), (4, 71), (6, 72)]
    lead = ([(s, m) for s, m in motif_a] + [(16 + s, m) for s, m in motif_b] +
            [(32 + s, m + 12) for s, m in motif_a] + [(48 + s, m + 12) for s, m in motif_b[:3]])
    for st, m in lead:
        place(music, DROP + st * STEP, pluck(m), pan=0.12, gain=0.9)

    # organ returns under bars 3–4 (the classical side, now on the beat)
    org2 = organ_bus([], [(DROP + 8 * B, 4 * B, [53, 57, 60, 65]),
                          (DROP + 12 * B, 3.6 * B, [55, 59, 62, 67])], LENGTH, ch_gain=0.22)
    music += org2[:, :N]

    # ---------------- final hit: "white" resolves on C ----------------
    place(drums, FINAL, kick(big=True), gain=1.0)
    place(drums, FINAL, crash(), pan=-0.25)
    place(music, FINAL, bass(36, 0.8), gain=1.2)
    for m, p in ((48, 0), (60, -0.3), (64, 0.3), (67, -0.2), (72, 0.2), (84, 0)):
        place(music, FINAL, pluck(m, 0.8, 7000), pan=p, gain=0.55)
    fin = organ_bus([(FINAL, 1.1, 72)], [(FINAL, 1.2, [36, 48, 52, 55, 60])], LENGTH - FINAL + 0.2,
                    mel_gain=0.5, ch_gain=0.25)
    place(mix, FINAL, fin[0], pan=-0.4)
    place(mix, FINAL, fin[1], pan=0.4)
    place(mix, FINAL, glass_smash() * 0.3)

    duck = np.ones(N)
    for tk in kicks:
        i = int(tk * SR)
        t = np.arange(min(N - i, int(0.3 * SR))) / SR
        duck[i:i + len(t)] = np.minimum(duck[i:i + len(t)], 1 - 0.6 * np.exp(-t / 0.09))
    music *= duck

    mix += reverb(music + drums * 0.15, reverb_ir(1.8, 0.4, 11), 0.2) + drums * 0.85

    fo = int((LENGTH - 0.6) * SR)
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

    markers = {"length": LENGTH, "bpm": BPM, "beat": round(B, 5), "leadIn": LEAD_IN,
               "phrase2": round(at(8), 3), "drop": round(DROP, 3),
               "bar2": round(DROP + 4 * B, 3), "bar3": round(DROP + 8 * B, 3),
               "bar4": round(DROP + 12 * B, 3), "finalHit": round(FINAL, 3)}
    with open(os.path.join(ROOT, "export", "jingle-markers.json"), "w") as f:
        json.dump(markers, f, indent=2)
    print(json.dumps(markers))


if __name__ == "__main__":
    main()
