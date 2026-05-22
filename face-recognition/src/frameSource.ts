import { useCallback, useRef } from 'react';
import { useFrameProcessor, type Frame } from 'react-native-vision-camera';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core'; // 👈 1. Import useSharedValue
import { useResizePlugin } from 'vision-camera-resize-plugin';

import type { RgbFrame } from './detector';

export const FRAME_SIZE = 256;

export interface FrameSourceOptions {
  onRgbFrame: (frame: RgbFrame) => void | Promise<void>;
  minIntervalMs?: number;
  size?: number;
}

export function useFrameSource(opts: FrameSourceOptions) {
  const { resize } = useResizePlugin();
  const size = opts.size ?? FRAME_SIZE;
  const minInterval = opts.minIntervalMs ?? 200;

  const cbRef = useRef(opts.onRgbFrame);
  cbRef.current = opts.onRgbFrame;

  // 2. Replace useRef with useSharedValue for thread-safe cross-communication
  const isBusy = useSharedValue(false);
  const lastRunTime = useSharedValue(0);

  // 3. The JS receiver now only handles execution and unlocking
  const deliver = useRunOnJS(
    async (data: Uint8Array, width: number, height: number) => {
      try {
        await cbRef.current({ data, width, height });
      } finally {
        // 4. Unlock the worklet thread ONLY after JS finishes inference
        isBusy.value = false;
      }
    },
    [isBusy]
  );

  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      'worklet';
      
      // 5. THE CRITICAL FIX: Guard checks happen ON THE NATIVE THREAD
      if (isBusy.value) return; 
      
      const now = Date.now();
      if (now - lastRunTime.value < minInterval) return;

      // Lock the elevator immediately so subsequent frames are dropped
      isBusy.value = true;
      lastRunTime.value = now;

      // 6. NOW we do the heavy downsampling (only ~5 times a second instead of 30!)
      const resized = resize(frame, {
        scale: { width: size, height: size },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });
      
      deliver(resized as unknown as Uint8Array, size, size);
    },
    [resize, deliver, size, minInterval, isBusy, lastRunTime]
  );

  const setBusy = useCallback((b: boolean) => {
    isBusy.value = b;
  }, [isBusy]);

  return { frameProcessor, setBusy };
}