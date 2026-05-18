/**
 * Stub for react-native-ping.
 * The thermal printer library imports this for network host discovery,
 * but we connect directly by IP:port so the ping check is never needed.
 * The real native module crashes on Android 14+ (FLAG_MUTABLE PendingIntent).
 */
class Ping {
  static async start(_ipAddress, _option) {
    // Always resolve — we skip the ping and connect directly
    return 0;
  }
  static async getTrafficStats() {
    return {rxBytes: 0, txBytes: 0};
  }
}

export default Ping;
