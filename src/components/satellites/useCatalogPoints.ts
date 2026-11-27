import { useEffect, useRef, useState } from 'react';
import type { CatalogSatellite } from '../../physics/satellites';
import type { PositionsRequest } from './satellitePositions.worker';

const EMPTY = new Float32Array();

export function useCatalogPoints(satellites: CatalogSatellite[], time: number) {
  const [points, setPoints] = useState(EMPTY);
  const latestTime = useRef(time);

  useEffect(() => {
    latestTime.current = time;
  }, [time]);

  useEffect(() => {
    if (satellites.length === 0) return;
    const worker = new Worker(new URL('./satellitePositions.worker.ts', import.meta.url), { type: 'module' });
    let sentTime: number | undefined;
    let pending = false;
    const send = (message: PositionsRequest) => worker.postMessage(message);

    const request = () => {
      const nextTime = latestTime.current;
      if (pending || nextTime === sentTime) return;
      pending = true;
      sentTime = nextTime;
      send({ time: nextTime });
    };
    worker.onmessage = ({ data }: MessageEvent<Float32Array<ArrayBuffer>>) => {
      pending = false;
      setPoints(data);
    };
    send({ records: satellites.map(satellite => satellite.record) });
    request();
    const timer = window.setInterval(request, 600);

    return () => {
      window.clearInterval(timer);
      worker.terminate();
    };
  }, [satellites]);

  return satellites.length > 0 ? points : EMPTY;
}
