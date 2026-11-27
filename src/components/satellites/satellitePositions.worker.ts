import type { SatRec } from 'satellite.js';
import { sampleCatalogPoints } from '../../physics/satellites';

export type PositionsRequest = { records: SatRec[] } | { time: number };

let records: SatRec[] = [];
self.onmessage = ({ data }: MessageEvent<PositionsRequest>) => {
  if ('records' in data) {
    records = data.records;
    return;
  }
  const points = sampleCatalogPoints(records, data.time);
  self.postMessage(points, { transfer: [points.buffer] });
};
