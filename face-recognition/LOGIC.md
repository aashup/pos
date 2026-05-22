# react-native-offline-face-auth — Logic & Architecture

> Complete walkthrough of every file and how they connect.

---

## Package Structure

```
react-native-offline-face-auth/
├── src/
│   ├── index.ts                    ← Public API barrel
│   ├── FaceAuthView.tsx            ← Camera UI component
│   ├── FaceAuthModal.tsx           ← Modal wrapper
│   ├── FaceMaskOverlay.tsx         ← SVG oval cutout overlay
│   ├── useFaceAuth.ts              ← Headless hook
│   ├── faceAuth.ts                 ← SDK class (init/provision/sync)
│   ├── frameSource.ts              ← Camera frame → RGB bytes
│   ├── detector.ts                 ← Face detection (BlazeFace + FaceMesh)
│   ├── qualityGate.ts              ← Frame quality checker
│   ├── liveness.ts                 ← Passive anti-spoof (MiniFASNet)
│   ├── activeChallenge.ts          ← Blink/smile/turn state machine
│   ├── embeddings.ts               ← Face → 512-d vector (FaceNet)
│   ├── matcher.ts                  ← Cosine similarity matcher
│   ├── pipeline.ts                 ← Orchestrates all steps
│   ├── config.ts                   ← Thresholds & config types
│   ├── runtime.ts                  ← Global config store
│   ├── types.ts                    ← All shared TypeScript types
│   ├── secure/
│   │   ├── sha256.ts               ← Pure-JS HMAC-SHA256
│   │   ├── secureKv.ts             ← Encrypted key-value store
│   │   ├── keystore.ts             ← Hardware-backed key management
│   │   ├── templateStore.ts        ← Enrolled face templates CRUD
│   │   ├── cancelable.ts           ← Revocable template transform
│   │   └── auditLog.ts             ← Hash-chained attendance log
│   └── sync/
│       ├── provisioning.ts         ← Pull templates from server
│       ├── attendanceSync.ts       ← Push events to AWS + purge
│       ├── netStatus.ts            ← Network watcher
│       ├── modelIntegrity.ts       ← TFLite file SHA-256 check
│       └── http.ts                 ← Axios HTTP client
├── models/
│   ├── blazeface.tflite            ← Face detector (~0.5 MB)
│   ├── face_mesh.tflite            ← 468-landmark model (~3 MB)
│   ├── facenet_512.tflite          ← Embedding model (~4 MB)
│   ├── spoof_2_7.tflite            ← Anti-spoof branch 1 (~1 MB)
│   ├── spoof_4_0.tflite            ← Anti-spoof branch 2 (~1 MB)
│   └── manifest.json               ← SHA-256 digests (integrity check)
└── example/
    ├── App.tsx                     ← Demo host app
    ├── metro.config.js             ← Metro bundler config
    └── android/                    ← Runnable Android project
```

---

## The Full Authentication Flow

```
📷 Camera Frame (30 fps)
        │
        ▼
   frameSource.ts        ← Worklet: downsample to 256×256 RGB, drop if busy
        │
        ▼
   detector.ts           ← BlazeFace: find face bbox
                         ← FaceMesh: 468 landmarks + head pose
        │
        ▼
   pipeline.ts           ← Orchestrates stages below
   ┌─────────────────────────────────────────────┐
   │  Stage 1: GATING                            │
   │  qualityGate.ts → check blur, brightness,   │
   │  face size, centering, head angle, 1-face   │
   │  → fail: show guidance hint, stay in gate   │
   │  → pass: move to CHALLENGE stage            │
   ├─────────────────────────────────────────────┤
   │  Stage 2: CHALLENGE (active liveness)       │
   │  activeChallenge.ts → pick random task:     │
   │    BLINK  → EAR dip below 0.18, then rise  │
   │    SMILE  → mouth width/height ratio ≥ 0.72 │
   │    TURN   → yaw > 15°, then back < 5°      │
   │  → timeout/fail: REJECT (challenge_failed)  │
   │  → pass: move to ANALYZING stage            │
   ├─────────────────────────────────────────────┤
   │  Stage 3: ANALYZING (collect N frames)      │
   │  liveness.ts → MiniFASNet TFLite:           │
   │    2 branches (scale 2.7 + 4.0) → avg score │
   │    score < threshold → REJECT (liveness)    │
   │  embeddings.ts → FaceNet TFLite:            │
   │    crop + align face → 512-d L2 vector      │
   │  Average N embeddings for stability         │
   ├─────────────────────────────────────────────┤
   │  Stage 4: MATCH                             │
   │  matcher.ts → cosine similarity:            │
   │    identify: compare vs ALL templates        │
   │    verify:   compare vs ONE personnel        │
   │    score ≥ 0.65 → AUTHENTICATED             │
   │    score < 0.65 → REJECT (no_match)         │
   └─────────────────────────────────────────────┘
        │
        ▼
   auditLog.ts           ← Append signed, hash-chained event
        │
        ▼
   AuthResult            ← { ok, personnelId, matchScore,
                              livenessScore, challengePassed }
```

---

## File-by-File Explanation

### Camera Layer

#### `frameSource.ts`
- Uses `react-native-vision-camera` frame processor (runs on native thread).
- Calls `vision-camera-resize-plugin` to downsample each frame to 256×256 RGB bytes.
- Uses `useSharedValue(isBusy)` — if the previous frame is still being processed, the
  new frame is dropped immediately on the native thread (no queue buildup).
- Uses `useRunOnJS` to marshal the RGB buffer to the JS thread where TFLite runs.
- Effective rate: ~5 fps on 3 GB devices instead of 30 fps.

#### `FaceMaskOverlay.tsx`
- SVG oval cutout using `react-native-svg`.
- Dark semi-transparent overlay with an ellipse punched out using an SVG `<Mask>`.
- Guides the user where to position their face in the frame.
- `pointerEvents="none"` so it never blocks touch events beneath it.

#### `FaceAuthView.tsx`
- Top-level camera component the host app renders.
- Wires `useFrameSource` → `detectFace` → `useFaceAuth.feed` on every processed frame.
- Shows a guidance hint bar at the bottom and a challenge instruction card at the top.
- FaceMesh landmarks (heavy model, ~30 ms) only run during `challenge` and `analyzing`
  stages. BlazeFace (light, ~5 ms) runs every frame for fast face tracking.
- Guards: requires camera permission, front camera presence, and `FaceAuth.init()` called.

---

### Detection Layer

#### `detector.ts`
```
RgbFrame (256×256)
    → resampleToSquare(128×128) → BlazeFace TFLite → bbox + confidence score
    → if withLandmarks:
        crop face region → resampleToSquare(192×192)
        → FaceMesh TFLite → 468 landmark (x, y) points
        → computeHeadPose() → yaw / pitch / roll in degrees
```
- `LANDMARK` constants map named indices to specific facial points
  (eye corners, mouth corners, nose tip, chin, etc.).
- Head pose is computed from 6 stable landmark points using a simplified
  Perspective-n-Point (PnP) approach.

#### `qualityGate.ts`
Checks in order, fails fast on the first issue:

| Check | Condition | Guidance shown |
|---|---|---|
| `no_face` | No detection | "Position your face in the frame" |
| `multiple_faces` | More than 1 bbox | "Only one person at a time" |
| `too_small` | Face area < 8% of frame | "Move closer" |
| `off_center` | Face center > 25% from frame center | "Center your face" |
| `pose` | Yaw/pitch/roll outside ±20°/±15°/±15° | "Look straight ahead" |
| `low_brightness` | Mean pixel value < 40 | "Move to better lighting" |
| `blur` | Laplacian variance < threshold | "Hold still" |

Returns `{ ok, issue, guidance }` with a human-readable hint for each failure.

---

### Pipeline Orchestration

#### `pipeline.ts` — `FaceAuthSession` class

Stage machine with four states:

```
'gating'    → qualityGate must pass for N consecutive frames (default 3)
'challenge' → ActiveChallenge runs until passed or timed out
'analyzing' → collect liveness + embedding for M frames (default 3)
'done'      → emit AuthResult and stop
```

- Each call to `process(frame, faces, now)` advances the machine by one step.
- `cancel()` immediately emits `{ failureReason: 'cancelled' }` and sets done.
- All tick results are typed: `Tick = { done, result?, guidance? }`.

#### `activeChallenge.ts` — `ActiveChallenge` class

```
constructor:
  randomly picks one challenge from the configured pool

feed(face, now):
  if now - startMs > timeoutMs  → status = 'failed'
  if face === null               → status = 'failed' (lost tracking)

  blink:  EAR < 0.18 (eyes closed), then EAR ≥ 0.22 (eyes open) → 'passed'
  smile:  mouth_width / mouth_height ≥ 0.72                       → 'passed'
  turn:   |yaw| > 15° (turned), then |yaw| < 5° (returned)       → 'passed'
```

Eye Aspect Ratio (EAR) uses 6 landmark points per eye — the standard
Soukupová & Čech formula:

```
EAR = (|p1−p5| + |p2−p4|) / (2 × |p0−p3|)
```

---

### ML Inference

#### `liveness.ts`
```
face bbox
  → crop at 2.7× scale → resize 80×80 → MiniFASNet branch 1 → [spoof_score, live_score]
  → crop at 4.0× scale → resize 80×80 → MiniFASNet branch 2 → [spoof_score, live_score]
  → average both live_scores
  → isLive = avg_score ≥ threshold (default 0.55)
```

Two-scale approach: the 2.7× crop captures texture-level artifacts (print attacks),
while the 4.0× crop captures geometry-level cues (3D masks, screen replays).

#### `embeddings.ts`
```
face bbox
  → align using eye landmark midpoints (rotation + scale normalisation)
  → crop 112×112 pixels
  → normalize pixel values to [-1.0, 1.0]
  → FaceNet TFLite (XNNPACK CPU delegate) → raw 512-d float vector
  → L2 normalize → unit-length embedding
```

L2 normalization means cosine similarity equals a plain dot product,
making matching fast and numerically stable.

#### `matcher.ts`
```
identify(probe, templates):
  for each template:
    score = dot(probe, template.embedding)   // cosine similarity
  best = argmax(scores)
  if best.score ≥ threshold (0.65):
    return { ok: true, personnelId: best.id, matchScore: best.score }
  else:
    return { ok: false, failureReason: 'no_match' }

verify(probe, personnelId, templates):
  template = find(templates, id === personnelId)
  if not found → { ok: false, failureReason: 'no_template' }
  score = dot(probe, template.embedding)
  return { ok: score ≥ threshold, matchScore: score }
```

---

### Security Layer

#### `sha256.ts`
- Pure JavaScript implementation of SHA-256 and HMAC-SHA256.
- Zero native dependencies — works in any JS environment including Hermes.
- Used by `secureKv.ts` for the keystream cipher and by `auditLog.ts` for chain hashing.

#### `keystore.ts`
- Uses `react-native-keychain` to create and retrieve a random 32-byte AES key.
- **Android**: Android Keystore (StrongBox / hardware-backed if available, standard Keystore otherwise).
- **iOS**: Keychain Services (Secure Enclave if available).
- Key is stored as a base64 string under service name `react-native-offline-face-auth.dek`.
- The key never leaves the secure element — it is never exported or logged.

#### `secureKv.ts` — `SecureKV` class
```
Storage backend: AsyncStorage (persistent, cross-reboot)
Encryption:      HMAC-SHA256 keystream cipher

encrypt(plaintext):
  nonce  = 8 random bytes (crypto.getRandomValues)
  for each 32-byte block needed:
    keystream_block = HMAC(hardwareKey, nonce ‖ counter_BE32)
  ciphertext = plaintext XOR keystream
  stored value = base64(nonce ‖ ciphertext)

decrypt(stored):
  nonce      = first 8 bytes of decoded base64
  ciphertext = remaining bytes
  keystream  = re-derive with same nonce + counter
  plaintext  = ciphertext XOR keystream

open():
  read all keys from AsyncStorage → decrypt each → populate in-memory Map
getString(key):  sync read from Map  (no await)
set(key, value): update Map + async write encrypted to AsyncStorage
delete(key):     remove from Map + async remove from AsyncStorage
```

Sync reads mean no await anywhere in hot paths. Encryption is at-rest only;
data is plaintext in memory during a session.

#### `templateStore.ts`
- Wraps `SecureKV` with typed CRUD for `Template[]`.
- A `Template` is `{ personnelId: string, embedding: Float32Array }`.
- `save(templates)`: serialize embeddings to JSON → encrypt → store under key `templates`.
- `load()`: read → decrypt → deserialize → return array.
- Raw face images are **never** stored — only the 512-d float vectors.

#### `cancelable.ts`
Biohashing — revocable template transform:

```
transform(embedding, tenantKey):
  seed   = HMAC(tenantKey, "biohash-seed")
  matrix = seeded random projection (512 → 256 dimensions)
  projected = matrix × embedding
  binarized = projected.map(x => x ≥ 0 ? 1 : 0)  // 256-bit binary code
  return binarized
```

- If a transformed template is stolen, it is useless without the tenant key.
- Key rotation: generate a new tenant key → all old transformed templates are invalidated,
  new ones are issued from the same raw embeddings.

#### `auditLog.ts`
Each attendance event:

```typescript
{
  id:               string,       // UUID
  ts:               number,       // Unix ms
  ok:               boolean,      // auth succeeded?
  matchScore:       number,
  livenessScore:    number,
  challengePassed:  boolean,
  deviceId:         string,
  prevHash:         string,       // hash of previous event ('GENESIS' for first)
  hash:             string,       // SHA256(prevHash ‖ JSON(event fields))
  sig:              string,       // HMAC(deviceKey, hash)
}
```

```
append(event) → compute hash → store in SecureKV
pending()     → return all unsynced events, sorted oldest-first
purge(ids)    → delete acknowledged events from SecureKV
verifyChain() → re-compute all hashes → confirm chain is unbroken
```

Tamper-evident: modifying any field in any event breaks every subsequent hash,
making offline tampering immediately detectable when the chain is verified.

---

### Sync Layer

#### `provisioning.ts`
```
provision():
  1. POST /provision/attest  (Play Integrity / App Attest token)
  2. GET  /provision/templates  (with device auth token from step 1)
  3. Receive encrypted roster of { personnelId, embedding } pairs
  4. Decrypt with hardware-backed device key
  5. templateStore.save(templates)
  6. Also pulls: threshold config + signed model manifest
```

The server generates embeddings from enrollment photos using the **identical**
FaceNet model and preprocessing pipeline. Vector parity is the critical
invariant — without it, match scores would be meaningless.

#### `attendanceSync.ts`
```
syncAttendance():
  guard: if already syncing → return (re-entrancy protection)
  1. events = auditLog.pending()
  2. if empty → return
  3. POST /attendance { events: [...] }  (TLS, device auth header)
  4. on 2xx + { ackedIds: [...] }:
       auditLog.purge(ackedIds)          ← only purge what server confirmed
  5. on network error / 5xx:
       keep events, schedule retry with backoff
```

- Each event has a UUID `id` — the server uses it as an idempotency key,
  so retrying a batch never creates duplicate attendance records.
- Local data is purged **only** after server confirmation.

#### `netStatus.ts`
- Subscribes to `@react-native-community/netinfo`.
- On `isConnected` transition `false → true`: triggers `syncAttendance()`.
- Also runs a configurable periodic timer (default 5 minutes) as a fallback.

#### `modelIntegrity.ts`
```
On every boot (inside FaceAuth.init):
  for each model file (blazeface, face_mesh, facenet_512, spoof_2_7, spoof_4_0):
    actual_hash   = SHA256(file bytes)
    expected_hash = manifest.json[modelName].sha256
    if actual_hash !== expected_hash:
      throw Error('Model integrity check failed: ' + modelName)
```

Prevents a tampered TFLite model from producing crafted embeddings that
bypass matching or liveness checks.

#### `http.ts`
- Thin axios wrapper with device auth token injected as a request header.
- Configures base URL, timeout, and JSON content-type defaults.
- Used by both `provisioning.ts` and `attendanceSync.ts`.

---

### Public SDK

#### `faceAuth.ts` — `FaceAuth` static class

```
FaceAuth.init(config):
  1. Store config in runtime.ts global (thresholds, endpoints, challenge pool)
  2. keystore.getOrCreateKey()         ← hardware AES key
  3. templateStore.open()              ← decrypt + load templates into memory
  4. auditLog.open()                   ← load pending events into memory
  5. modelIntegrity.verify()           ← SHA-256 all .tflite files
  6. netStatus.start()                 ← watch connectivity + auto-sync

FaceAuth.provision()         → provisioning.syncTemplates()
FaceAuth.syncNow()           → attendanceSync.syncAttendance()
FaceAuth.getPendingCount()   → auditLog.pendingCount()
FaceAuth.onSyncStatus(cb)    → subscribe to SyncStatus changes
FaceAuth.dispose()           → netStatus.stop(), flush in-flight writes
```

#### `useFaceAuth.ts` — React hook

```typescript
const { start, cancel, feed, active, stageRef } = useFaceAuth({
  mode,          // 'identify' | 'verify'
  personnelId,   // required for verify
  models,        // { embedding, liveness }
  onResult,      // (AuthResult) => void
  onGuidance,    // (Guidance) => void
})

start()              → creates a new FaceAuthSession
feed(frame, faces)   → session.process() → fires onGuidance / onResult
cancel()             → session.cancel()  → fires onResult with 'cancelled'
```

- One `FaceAuthSession` per auth attempt — stateful, not reused.
- `stageRef` is read by `FaceAuthView` each frame to decide whether to run
  the expensive FaceMesh model or just the cheap BlazeFace detector.

#### `config.ts` + `runtime.ts`
- `FaceAuthConfig` — full configuration type (thresholds, endpoints, challenge pool, etc.).
- `DEFAULT_THRESHOLDS` — sensible defaults for all numeric thresholds.
- `runtime.ts` — module-level singleton; `setConfig` / `getConfig` so all internal
  modules share one live config without prop-drilling.

#### `types.ts`
All shared TypeScript types exported publicly:

| Type | Description |
|---|---|
| `AuthMode` | `'identify'` or `'verify'` |
| `AuthResult` | Final outcome of one auth session |
| `Challenge` | `'blink'`, `'smile'`, or `'turn_head'` |
| `DetectedFace` | Bbox + landmarks + headPose |
| `Guidance` | `{ message, challenge? }` shown to the user |
| `QualityIssue` | Enum of quality gate failure reasons |
| `SyncStatus` | Current state of the AWS sync process |
| `Template` | `{ personnelId, embedding }` |
| `BoundingBox` | `{ x, y, width, height }` normalised 0–1 |
| `HeadPose` | `{ yaw, pitch, roll }` in degrees |
| `Point` | `{ x, y }` |

---

## How the Host App Uses the Package

```tsx
// App.tsx — one-time setup
import { FaceAuth, FaceAuthView } from 'react-native-offline-face-auth';
import { useTensorflowModel } from 'react-native-fast-tflite';

// 1. Initialize once (App startup)
useEffect(() => {
  FaceAuth.init({
    awsSyncUrl:  'https://api.example.com',
    deviceToken: 'abc123',
    thresholds:  { matchScore: 0.65, livenessScore: 0.55 },
    challenges:  ['blink', 'smile', 'turn_head'],
  });
  FaceAuth.provision(); // pull enrolled templates while online
}, []);

// 2. Load TFLite models (fast-tflite)
const blazeface = useTensorflowModel(require('../models/blazeface.tflite'));
const faceMesh  = useTensorflowModel(require('../models/face_mesh.tflite'));
const facenet   = useTensorflowModel(require('../models/facenet_512.tflite'));
const spoof27   = useTensorflowModel(require('../models/spoof_2_7.tflite'));
const spoof40   = useTensorflowModel(require('../models/spoof_4_0.tflite'));

// 3. Render the auth view
<FaceAuthView
  mode="identify"
  models={{
    blazeface,
    faceMesh,
    embedding: facenet,
    liveness: { branches: [spoof27, spoof40] },
  }}
  onResult={(r) => {
    if (r.ok) console.log('Authenticated:', r.personnelId, r.matchScore);
    else      console.log('Failed:', r.failureReason);
  }}
  onGuidance={(g) => console.log(g.message)}
  onClose={() => navigation.goBack()}
/>
// Everything else is fully automatic:
// liveness check, challenge, matching, attendance recording, AWS sync + purge
```

---

## Performance Targets (CPU-only, 3 GB device)

| Stage | Model | Target latency |
|---|---|---|
| Face detect | BlazeFace (128×128) | < 25 ms |
| Landmark detection | FaceMesh (192×192) | < 40 ms |
| Passive liveness | MiniFASNet ×2 (80×80) | < 40 ms |
| Face embedding | FaceNet 512-d (112×112) | < 80 ms |
| Active challenge | User-paced (blink/smile/turn) | 1.5 – 3 s |
| End-to-end decision | Gate + challenge + analyze + match | < 4 s |
| Total model footprint | All 5 TFLite files combined | < 10 MB |

---

## Security Properties

| Property | Mechanism |
|---|---|
| No raw images stored | Only 512-d float embeddings written to disk |
| Hardware-backed key | Android Keystore / iOS Keychain (StrongBox / Secure Enclave) |
| Encrypted at rest | HMAC-SHA256 keystream cipher per SecureKV entry |
| Template cancelability | Biohashing with per-tenant key; rotate key to revoke all |
| Tamper-evident log | SHA-256 hash chain + HMAC signature per event |
| Model integrity | SHA-256 of every .tflite verified against signed manifest on boot |
| Anti-spoofing (passive) | MiniFASNet two-scale; defeats print, screen, and replay attacks |
| Anti-spoofing (active) | Random blink/smile/turn challenge; defeats static-photo fraud |
| Offline-first | Full auth pipeline runs with zero network; sync when reconnected |
| Purge on sync | Local attendance events deleted only after server acknowledgement |
