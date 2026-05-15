# Zazzy Mobile — React Native POS

Waitstaff mobile POS for tableside ordering. Companion to the Zazzy POS desktop app.

## Tech Stack

| Layer | Package |
|-------|---------|
| Framework | Expo SDK 54 + Development Build |
| Routing | expo-router v6 |
| Local DB | WatermelonDB v0.28 |
| API | TanStack Query v5 + Axios |
| UI | NativeWind v4 (Tailwind CSS) |
| Cart state | Zustand |
| Secure storage | react-native-mmkv |
| Location | react-native-background-geolocation v5 |
| Camera/Scan | react-native-vision-camera v5 |

## Setup

### 1. Prerequisites

- Node.js 18+
- Android Studio (for Android dev build) or Xcode (iOS)
- Java 17 (for Android)

### 2. Environment

```bash
cp .env.example .env
# Add your BACKGROUND_GEOLOCATION_LICENSE key
```

### 3. Install & Build

```bash
cd mobile-app
npm install --legacy-peer-deps

# Android (physical device or emulator)
npm run android    # runs: expo run:android

# iOS (Mac only)
npm run ios        # runs: expo run:ios
```

> **Note:** This app requires a Development Build — it cannot run in Expo Go due to native modules (WatermelonDB, VisionCamera, Background Geolocation).

### 4. First run

1. Launch the app on device
2. On the Login screen, set the **Server URL** to your Laravel API (e.g. `http://192.168.1.x:8000`)
3. Sign in with your Zazzy POS credentials
4. Tables and items sync automatically on first load

## Features

- **Floor plan & table selection** — tap a table or scan its QR code
- **Item grid with search & category filter** — tap to add to cart
- **Barcode scanning** — scan item barcode to add to cart
- **KOT (Kitchen Order Ticket)** — send unsent items to kitchen
- **Checkout** — confirm payment, table clears automatically
- **Hold order** — pause and resume later
- **Location tracking** — every 10 min, skips if < 50 m moved (device-local, not synced)
- **Offline-first** — all operations write to local WatermelonDB first, sync to server asynchronously

## Architecture Notes

- `newArchEnabled: false` — required for WatermelonDB JSI compatibility with RN 0.81
- Location logs are **device-local only** — the `synced` field is always `false`
- Cart state (Zustand) is in-memory; order persistence only happens on KOT send / checkout
- Pull sync never overwrites local orders with `sync_status: 'pending'`

## react-native-background-geolocation License

This package requires a paid license from [Transistor Software](https://www.transistorsoft.com/shop/products/react-native-background-geolocation). Add your key to `.env` as `BACKGROUND_GEOLOCATION_LICENSE`.
