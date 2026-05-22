# react-native-offline-face-auth

Offline facial recognition + liveness detection for React Native, built for **field-personnel attendance**
on mid-range phones. Fully on-device matching, open-source models, and an AWS **sync-and-purge** pipeline.

- **Offline-first** — enrollment templates are provisioned from the server while online, then all
  recognition + liveness runs with **no network connection**.
- **Hybrid liveness** — passive anti-spoof (MiniFASNet) on every frame **+** a randomized active challenge
  (blink / smile / turn head) to defeat photo and screen-replay fraud.
- **Lightweight** — TFLite models on the XNNPACK CPU delegate; **no GPU required**.
- **Open-source only** — no proprietary SDKs, no per-seat license fees.

## Requirements

- Android **8.0+** (API 26), iOS **12+**, **≥ 3 GB RAM**.
- Host app installs these peer dependencies:
  `react-native-vision-camera`, `react-native-worklets-core`, `react-native-fast-tflite`,
  `vision-camera-resize-plugin`, `react-native-mmkv`, `react-native-keychain`,
  `@react-native-community/netinfo` (and `react-native-get-random-values` to back the key CSPRNG).

## Install

```sh
npm install react-native-offline-face-auth \
  react-native-vision-camera react-native-worklets-core react-native-fast-tflite \
  vision-camera-resize-plugin react-native-mmkv react-native-keychain \
  @react-native-community/netinfo react-native-get-random-values
cd ios && pod install
```

The camera pipeline runs on the JS thread: a Vision Camera worklet uses
`vision-camera-resize-plugin` to extract a downscaled RGB buffer, then BlazeFace + Face Mesh + the
TFLite models run via `react-native-fast-tflite`. No platform-specific native module is required.

Add camera permission strings (`NSCameraUsageDescription` on iOS, `CAMERA` on Android) and enable the
VisionCamera frame-processor / worklets setup per their docs.

## Usage

```tsx
import { FaceAuth, FaceAuthView } from 'react-native-offline-face-auth';

// 1. Once at startup (opens encrypted stores, starts the reconnect watcher)
await FaceAuth.init({ awsSyncUrl: 'https://api.example.com/face-auth', deviceToken, deviceId });

// 2. While online — pull the device's enrolled templates
await FaceAuth.provision();

// 3. Authenticate (fully offline). Attendance is recorded automatically.
<FaceAuthView
  mode="identify"
  models={models}                 // TFLite models loaded via fast-tflite
  onResult={(r) => console.log(r.ok, r.personnelId, r.matchScore)}
  onGuidance={(g) => setHint(g.message)}
/>

// 4. Flush attendance to AWS (also auto-fires on network reconnect)
await FaceAuth.syncNow();
```

See [`example/App.tsx`](./example/App.tsx) for a complete reference host (model loading included).

## API

### `FaceAuth`
| Method | Description |
|--------|-------------|
| `init(config)` | Open encrypted stores, derive the hardware key, verify model integrity (when `readModelBytes` + manifest are supplied), start the network watcher. |
| `provision({ full? })` | Online: attest the device, pull templates (**incremental** by default, or `full`), apply server thresholds, cache the signed manifest, advance the resume cursor. |
| `needsReprovision()` | `true` if templates were never synced or are older than `templateTtlMs`. |
| `recordAttendance(result)` | Append a signed, hash-chained attendance event (auto-called by the view/hook). |
| `probeTransform(embedding)` | The device's cancelable transform — applied to a probe before matching. |
| `syncNow()` | Push queued events to AWS; purge acked ones. |
| `getPendingCount()` / `getTemplateCount()` | Local queue / roster sizes. |
| `onSyncStatus(cb)` | Subscribe to `SyncStatus`; returns an unsubscribe fn. |
| `dispose()` | Stop the watcher and release resources. |

### Components
- **`<FaceAuthView mode models onResult onGuidance />`** — camera surface that runs a full session.
- **`useFaceAuth({ mode, models, onResult })`** — headless driver (`start`/`cancel`/`feed`) for custom UIs.

### `FaceAuthConfig`
`awsSyncUrl`, `deviceToken`, `deviceId`, optional `thresholds`, `challenges`, `syncIntervalMs`,
`purgeAfterSync`, `cancelableKey`, `cancelableDims`, `getAttestationToken`.

## Server contract (AWS)

| Endpoint | Body | Response |
|----------|------|----------|
| `POST /provision` | `{ attestation, since }` | `full`: `{ mode:'full', templates:[{personnelId, embedding}], thresholds?, manifest?, syncedAt }`  ·  `delta`: `{ mode:'delta', upserts:[{personnelId, embeddings[]}], removals:[id], thresholds?, manifest?, syncedAt }` |
| `POST /attendance` | `{ events: StoredEvent[] }` | `{ acked: string[] /* event ids */ }` |

`since` is the device's last `syncedAt` (0 on first / forced-full sync); reply with a `full` roster or a
`delta`. `embedding`/`embeddings` are base64 little-endian float32 from the **same** MobileFaceNet model +
preprocessing as the device (see [`models/README.md`](./models/README.md)). `thresholds` lets you tighten
liveness/match remotely; `manifest` is the signed model manifest cached for the next boot integrity check.
Only acked attendance events are purged locally, so the server must de-duplicate on the event `id`.

See [`PLAN.md`](./PLAN.md) for the full architecture and phase breakdown.

## License

MIT. Bundled models are Apache-2.0 / MIT — see [`models/README.md`](./models/README.md).
