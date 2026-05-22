import axios, { type AxiosInstance } from 'axios';

/** Build an axios client bound to the AWS endpoint + device bearer token. */
export function makeClient(baseURL: string, deviceToken: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 20000,
    headers: {
      Authorization: `Bearer ${deviceToken}`,
      'Content-Type': 'application/json',
    },
  });
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
