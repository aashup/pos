import BackgroundGeolocation from 'react-native-background-geolocation';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import { haversineDistance } from './utils';
import type LocationLog from '@/db/models/LocationLog';

async function getLastLog(): Promise<LocationLog | null> {
  const results = await database
    .get<LocationLog>('location_logs')
    .query(Q.sortBy('recorded_at', Q.desc))
    .fetch();
  return results[0] ?? null;
}

async function writeLog(lat: number, lng: number, accuracy: number | null) {
  await database.write(async () => {
    await database.get<LocationLog>('location_logs').create((r) => {
      r.latitude = lat;
      r.longitude = lng;
      r.accuracy = accuracy;
      r.recordedAt = Date.now();
      r.synced = false; // no server endpoint — always false
    });
  });
}

export async function startLocationTracking(): Promise<void> {
  await BackgroundGeolocation.ready({
    desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
    distanceFilter: 50, // primary 50 m guard at native layer
    heartbeatInterval: 600, // 10-minute heartbeat on iOS background fetch
    stopOnTerminate: false,
    startOnBoot: true,
    foregroundService: true, // Android foreground service
    notification: {
      title: 'Zazzy Mobile',
      text: 'Location tracking active during shift',
      smallIcon: 'mipmap/ic_launcher',
    },
    logLevel: BackgroundGeolocation.LOG_LEVEL_OFF,
  });

  BackgroundGeolocation.onLocation(async (location) => {
    const { latitude, longitude, accuracy } = location.coords;
    const last = await getLastLog();

    if (last) {
      const dist = haversineDistance(
        { latitude: last.latitude, longitude: last.longitude },
        { latitude, longitude },
      );
      if (dist < 50) return; // JS secondary guard — skip if < 50 m moved
    }

    await writeLog(latitude, longitude, accuracy ?? null);
  });

  BackgroundGeolocation.onHeartbeat(async (event) => {
    // iOS: heartbeat fires every heartbeatInterval seconds in background
    const { latitude, longitude } = event.location.coords;
    const last = await getLastLog();

    if (last) {
      const dist = haversineDistance(
        { latitude: last.latitude, longitude: last.longitude },
        { latitude, longitude },
      );
      if (dist < 50) return;
    }

    await writeLog(latitude, longitude, null);
  });

  await BackgroundGeolocation.start();
}

export async function stopLocationTracking(): Promise<void> {
  await BackgroundGeolocation.stop();
  BackgroundGeolocation.removeListeners();
}
