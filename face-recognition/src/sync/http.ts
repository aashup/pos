import axios, { type AxiosInstance } from 'axios';

/** Build an axios client bound to the AWS endpoint + device bearer token. */
export function makeClient(baseURL: string, deviceToken: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 20000,
    headers: {
      Authorization: `Bearer ${deviceToken}`,
      'Content-Type': 'application/json',
    },
  });

  // ── Request interceptor ────────────────────────────────────────────────────
  client.interceptors.request.use(
    (config) => {
      const url  = (config.baseURL ?? '') + (config.url ?? '');
      const body = config.data !== undefined
        ? JSON.stringify(config.data).slice(0, 500)  // cap at 500 chars
        : '(none)';
      console.log(
        `[HTTP] → ${(config.method ?? 'GET').toUpperCase()} ${url}\n` +
        `[HTTP]   headers: ${JSON.stringify(config.headers)}\n` +
        `[HTTP]   body:    ${body}`,
      );
      return config;
    },
    (error) => {
      console.error('[HTTP] Request setup error:', error?.message ?? error);
      return Promise.reject(error);
    },
  );

  // ── Response interceptor ───────────────────────────────────────────────────
  client.interceptors.response.use(
    (response) => {
      const body = JSON.stringify(response.data).slice(0, 500);
      console.log(
        `[HTTP] ← ${response.status} ${response.config?.url ?? ''}\n` +
        `[HTTP]   response: ${body}`,
      );
      return response;
    },
    (error) => {
      if (error?.response) {
        // Server replied with a non-2xx status
        const { status, data, config } = error.response;
        console.error(
          `[HTTP] ✗ ${status} ${config?.url ?? ''}\n` +
          `[HTTP]   baseURL:  ${config?.baseURL ?? ''}\n` +
          `[HTTP]   headers:  ${JSON.stringify(config?.headers)}\n` +
          `[HTTP]   req body: ${config?.data ? String(config.data).slice(0, 500) : '(none)'}\n` +
          `[HTTP]   res body: ${JSON.stringify(data).slice(0, 500)}`,
        );
      } else if (error?.request) {
        // Request was made but no response received (network error / timeout)
        console.error(
          `[HTTP] ✗ No response received\n` +
          `[HTTP]   url:     ${error.config?.baseURL ?? ''}${error.config?.url ?? ''}\n` +
          `[HTTP]   message: ${error?.message ?? 'unknown'}`,
        );
      } else {
        console.error('[HTTP] ✗ Unexpected error:', error?.message ?? error);
      }
      return Promise.reject(error);
    },
  );

  return client;
}

/** Decode a base64 little-endian float32 vector (server template wire format). */
export function base64ToFloat32(b64: string): Float32Array {
  const bin = globalThis.atob
    ? globalThis.atob(b64)
    : (globalThis as any).Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
}
