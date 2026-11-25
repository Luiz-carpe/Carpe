import json, subprocess, os, sys, hashlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

D = os.path.dirname(os.path.abspath(__file__))
VO = os.path.join(D, 'vo2'); os.makedirs(VO, exist_ok=True)
MODEL = os.path.join(D, '..', 'voices', 'pt-br-edresson-low.onnx')
SR = 44100
FPS = 30

SPK = {
 'MAE':       dict(pitch=1.30, ls=0.92, f='highpass=f=230,lowpass=f=4200,volume=1.25'),
 'HOUSTON':   dict(pitch=0.94, ls=0.82, f='highpass=f=450,lowpass=f=2800,acrusher=bits=8:mix=0.25,volume=1.6'),
 'TIAGO':     dict(pitch=1.0,  ls=0.95, f='volume=1.2'),
 'COSTA':     dict(pitch=1.10, ls=0.80, f='volume=1.3'),
 'LUCAS':     dict(pitch=1.14, ls=0.82, f='volume=1.3'),
 'GLORP':     dict(pitch=1.55, ls=0.85, f='vibrato=f=11:d=0.5,aecho=0.6:0.6:12:0.5,volume=1.3'),
 'IGNACIO':   dict(pitch=0.66, ls=1.05, f='aecho=0.8:0.7:60:0.25,volume=1.5'),
 'CAVALEIRO': dict(pitch=0.90, ls=0.95, f='aecho=0.8:0.5:40:0.2,volume=1.2'),
 'TRICO':     dict(pitch=1.22, ls=0.85, f='volume=1.2'),
 'ANCESTRAL': dict(pitch=1.85, ls=0.85, f='volume=1.1'),
}
FX = {'whisper': 'highpass=f=600,volume=0.7', 'cold': 'aecho=0.8:0.8:180:0.35,volume=1.3'}

def synth(who, say, fx=None):
    s = SPK[who]
    key = hashlib.md5(json.dumps([who, say, fx, s]).encode()).hexdigest()[:10]
    out = os.path.join(VO, f'{who}_{key}.wav')
    if not os.path.exists(out):
        raw = out + '.raw.wav'
        subprocess.run([sys.executable, '-m', 'piper', '-m', MODEL, '-f', raw, '--length-scale', str(round(s['ls']*0.82,3))],
                       input=say.encode(), check=True, capture_output=True)
        filt = f"aresample={SR},rubberband=pitch={s['pitch']}," + s['f']
        if fx: filt += ',' + FX[fx]
        filt += ',silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', filt, '-ac', '1', '-ar', str(SR), out], check=True)
        os.remove(raw)
    sr, a = wavfile.read(out)
    a = a.astype(np.float32) / 32768.0
    return a

beats = json.load(open(os.path.join(D, 'beats.json')))
t = 0.0
GAP = 0.06
timeline = {'fps': FPS, 'scenes': [], 'lines': []}
voice_track = []
for sc in beats['scenes']:
    s0 = t
    marks = {}
    for b in sc['beats']:
        if 'mark' in b: marks[b['mark']] = round(t, 3)
        elif 'pause' in b: t += b['pause']
        else:
            a = synth(b['who'], b['say'], b.get('fx'))
            dur = len(a) / SR
            hop = SR // FPS
            env = [float(np.sqrt(np.mean(a[i:i+hop]**2))) for i in range(0, len(a), hop)]
            m = max(env) or 1
            env = [round(min(1, e / m * 1.3), 2) for e in env]
            timeline['lines'].append(dict(who=b['who'], cap=b['cap'], start=round(t, 3), end=round(t + dur, 3), env=env, scene=sc['id']))
            voice_track.append((t, a))
            t += dur + GAP
    timeline['scenes'].append(dict(id=sc['id'], chapter=sc['chapter'], start=round(s0, 3), end=round(t, 3), marks=marks))
TOTAL = t
timeline['total'] = round(TOTAL, 3)
json.dump(timeline, open(os.path.join(D, 'timeline.json'), 'w'))
print('TOTAL', round(TOTAL, 2))
for s in timeline['scenes']: print(s['id'], s['start'], s['end'], round(s['end'] - s['start'], 2))

# ---------------- SFX ----------------
N = int((TOTAL + 0.5) * SR)
vo = np.zeros(N, np.float32); sfx = np.zeros(N, np.float32); mus = np.zeros(N, np.float32)
rng = np.random.default_rng(7)
def add(buf, t0, a, g=1.0):
    i = int(t0 * SR); j = min(N, i + len(a))
    if j > i: buf[i:j] += a[:j - i] * g
def tt(d): return np.arange(int(d * SR)) / SR
def lp(a, fc, order=2): return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), a).astype(np.float32)
def hp(a, fc, order=2): return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), a).astype(np.float32)
def bp(a, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), a).astype(np.float32)
def noise(d): return rng.standard_normal(int(d * SR)).astype(np.float32)
def env_ad(n, a=0.005, d=None):
    x = np.arange(n) / SR
    e = np.minimum(1, x / a)
    if d: e *= np.exp(-x / d)
    return e.astype(np.float32)
def note(f, d, dec=0.25, harm=(1, 0.3, 0.12)):
    x = tt(d); s = sum(h * np.sin(2 * np.pi * f * (k + 1) * x) for k, h in enumerate(harm))
    return (s * env_ad(len(x), 0.004, dec)).astype(np.float32)

# The ringtone motif (same in every scene)
RING = np.zeros(int(1.3 * SR), np.float32)
for i, (f, st) in enumerate([(1318.5, 0), (1568, .13), (2093, .26), (1568, .39), (1318.5, .62), (1568, .75), (2093, .88)]):
    n = note(f, 0.4, 0.12, (1, 0.25, 0.05)); RING[int(st * SR):int(st * SR) + len(n)] += n * 0.5
def ring(t0, t1, g=0.55):
    x = t0
    while x < t1 - 0.2:
        seg = RING[:int(min(1.3, t1 - x) * SR)].copy()
        seg[-200:] *= np.linspace(1, 0, 200)
        add(sfx, x, seg, g); x += 1.45
def whoosh(t0, d=0.45, g=0.35):
    n = noise(d); x = tt(d)
    # sweep via varying lowpass approximation: mix of two filtered bands with envelope
    e = np.sin(np.pi * x / d) ** 2
    a = bp(n, 300, 3000) * e
    add(sfx, t0 - d * 0.5, a, g)
def boom(t0, d=2.5, g=1.0):
    x = tt(d)
    s = np.sin(2 * np.pi * (55 * np.exp(-x * 1.5) + 25) * x) * np.exp(-x * 1.6)
    s += lp(noise(d), 500) * np.exp(-x * 1.2) * 0.8
    add(sfx, t0, s.astype(np.float32), g)
def beep(t0, f=880, d=0.12, g=0.25):
    add(sfx, t0, note(f, d, 0.08, (1, 0.1)), g)
def buzz(t0, t1, g=0.4):
    x = t0
    while x < t1:
        d = 0.35; xx = tt(d)
        s = np.sign(np.sin(2 * np.pi * 150 * xx)) * 0.3
        add(sfx, x, lp(s.astype(np.float32), 400) * np.sin(np.pi * xx / d), g); x += 0.6
def bed(t0, t1, kind, g):
    d = t1 - t0
    if d <= 0: return
    n = noise(d); x = tt(d)
    if kind == 'fire': a = lp(n, 700) * (0.7 + 0.3 * np.sin(2 * np.pi * 3 * x)) + hp(n, 3000) * (rng.random(len(n)) > 0.9985) * 4
    elif kind == 'waves': a = lp(n, 900) * (0.45 + 0.55 * np.sin(2 * np.pi * x / 4.0) ** 2)
    elif kind == 'hum': a = lp(np.sign(np.sin(2 * np.pi * (70 + 8 * np.sin(2 * np.pi * 2 * x)) * x)).astype(np.float32) * 0.6, 500) + 0.2 * np.sin(2 * np.pi * 420 * x * (1 + 0.02 * np.sin(2 * np.pi * 5 * x)))
    elif kind == 'crickets': a = bp(n, 4000, 5500) * (np.sin(2 * np.pi * 30 * x) > 0.6) * (np.sin(2 * np.pi * 0.8 * x) > 0)
    elif kind == 'space': a = lp(n, 200) * 0.6
    elif kind == 'room': a = lp(n, 150) * 0.5
    elif kind == 'jungle':
        a = lp(n, 300) * 0.3
        for k in range(int(d * 2)):
            st = rng.uniform(0, max(0.01, d - 0.3)); f0 = rng.uniform(2500, 4200)
            xx = tt(0.18); ch = np.sin(2 * np.pi * (f0 + 900 * np.sin(2 * np.pi * 14 * xx)) * xx) * np.sin(np.pi * xx / 0.18) * 0.25
            i = int(st * SR); a[i:i + len(ch)] += ch[:len(a) - i]
    elif kind == 'rise':
        a = bp(n, 200, 6000) * (x / d) ** 2 * 0.8 + np.sin(2 * np.pi * (60 + 200 * (x / d) ** 2) * x) * (x / d) * 0.5
    fade = np.minimum(1, np.minimum(x / 0.15, (d - x) / 0.15))
    add(sfx, t0, (a * fade).astype(np.float32), g)

# music bed: quirky pizzicato loop
def music(t0, t1, g=0.16, bpm=112):
    beat = 60 / bpm
    prog = [(261.6, 329.6, 392.0), (220.0, 261.6, 329.6), (174.6, 220.0, 261.6), (196.0, 246.9, 293.7)]
    x = t0; k = 0
    while x < t1 - beat:
        ch = prog[(k // 8) % 4]
        if k % 2 == 0: add(mus, x, note(ch[0] / 2, 0.5, 0.18, (1, 0.5, 0.2)), g * 1.2)
        add(mus, x + beat * 0.5, note(ch[(k * 2 + 1) % 3] * 2, 0.25, 0.07, (1, 0.2)), g * 0.6)
        if k % 4 == 2: add(mus, x, lp(noise(0.08), 3000) * env_ad(int(0.08 * SR), 0.001, 0.02), g * 0.8)
        x += beat; k += 1

for (t0, a) in voice_track: add(vo, t0, a, 1.0)
S = {s['id']: s for s in timeline['scenes']}
def M(sid, k): return S[sid]['marks'][k]
def L(sid, i): return [l for l in timeline['lines'] if l['scene'] == sid][i]

for s in timeline['scenes'][1:]: whoosh(s['start'])
# 1 space
sp = S['space']; bed(sp['start'], sp['end'], 'space', 0.25)
ring(0, M('space', 'answer'))
for k in np.arange(0.2, M('space', 'answer'), 0.7): beep(k, 988, 0.15, 0.12)
add(sfx, L('space', 0)['start'] - 0.05, lp(noise(0.12), 4000) * 0.5, 0.4)
music(M('space', 'answer'), S['shark']['end'], 0.11)
# 2 bomb
bo = S['bomb']; bed(bo['start'], bo['end'], 'room', 0.3)
for k in np.arange(bo['start'] + 0.1, M('bomb', 'cut'), 1.0): beep(k, 1760, 0.07, 0.18)
buzz(M('bomb', 'ring'), M('bomb', 'answer')); ring(M('bomb', 'ring'), M('bomb', 'answer'), 0.45)
add(sfx, M('bomb', 'cut') + 0.05, hp(noise(0.04), 2500) * env_ad(int(0.04 * SR), 0.001, 0.01), 0.9)
# 3 ufo
uf = S['ufo']; bed(uf['start'], M('ufo', 'kitchen'), 'crickets', 0.10)
bed(uf['start'], M('ufo', 'drop') + 0.4, 'hum', 0.22)
ring(uf['start'], L('ufo', 0)['start'] + 0.1)
ring(M('ufo', 'cockpit'), L('ufo', 4)['start'], 0.4)
add(sfx, M('ufo', 'drop') + 0.55, lp(noise(0.3), 800) * env_ad(int(0.3 * SR), 0.005, 0.08), 0.8)
whoosh(M('ufo', 'drop') + 0.8, 0.5, 0.4)
whoosh(M('ufo', 'cockpit'), 0.35, 0.25); whoosh(M('ufo', 'kitchen'), 0.35, 0.25)
# 4 dragon
dr = S['dragon']; bed(dr['start'], M('dragon', 'swallow') + 0.2, 'fire', 0.35)
ring(M('dragon', 'ring'), L('dragon', 0)['start'])
add(sfx, M('dragon', 'swallow'), lp(noise(0.25), 300) * env_ad(int(0.25 * SR), 0.01, 0.1), 1.0)
add(sfx, M('dragon', 'swallow') + 0.3, bp(noise(0.4), 800, 3000) * env_ad(int(0.4 * SR), 0.05, 0.15), 0.3)
# 5 shark
sh = S['shark']; bed(sh['start'], sh['end'], 'waves', 0.28)
ring(M('shark', 'ring'), L('shark', 0)['start'])
whoosh(M('shark', 'beach'), 0.35, 0.25)
# 6 dino
dn = S['dino']
bed(M('dino', 'jungle'), M('dino', 'silence'), 'jungle', 0.35)
music(M('dino', 'jungle'), M('dino', 'count'), 0.07, 90)
boom(M('dino', 'jungle'), 1.6, 0.5)
ring(M('dino', 'ring'), M('dino', 'audio'))
add(sfx, M('dino', 'audio'), note(1046, 0.15, 0.1), 0.3)
for k in range(4): add(sfx, M('dino', 'flee') + k * 0.12, lp(noise(0.06), 300), 0.5)
bed(M('dino', 'meteor') - 0.2, M('dino', 'meteor') + 1.8, 'rise', 0.5)
boom(M('dino', 'meteor') + 1.75, 3.0, 1.0)
ring(M('dino', 'final') + 0.6, dn['end'] + 0.4, 0.5)

# duck music during the "silence" & mix
mix = vo * 1.0 + sfx * 0.9 + mus
sil0, sil1 = M('dino', 'silence'), M('dino', 'meteor')
mix[int(sil0 * SR):int(sil1 * SR)] = vo[int(sil0 * SR):int(sil1 * SR)]
mx = np.max(np.abs(mix)); mix = mix / mx * 0.9
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
wavfile.write(os.path.join(D, 'audio.wav'), SR, (mix * 32767).astype(np.int16))
print('audio ok')
