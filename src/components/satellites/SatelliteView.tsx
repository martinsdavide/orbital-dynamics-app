import { useEffect, useMemo, useState } from 'react';
import { archivedIss, MAX_ELEMENT_AGE_MS, readIssFeed, sampleSatellite, sampleSatellitePaths, satelliteEpoch, satellitePeriodMinutes } from '../../physics/satellites';
import { SatelliteGlobe } from './SatelliteGlobe';

const CACHE_KEY = 'astrosim.iss-elements';
const formatUtc = (time: number) => new Date(time).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

function initialTime(record: typeof archivedIss) {
  const now = Date.now();
  const epoch = satelliteEpoch(record);
  return Math.abs(now - epoch) <= MAX_ELEMENT_AGE_MS ? now : epoch;
}

function cachedFeed() {
  try {
    return readIssFeed(JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null'));
  } catch {
    return undefined;
  }
}

export function SatelliteView() {
  const [cached] = useState(cachedFeed);
  const [feed, setFeed] = useState(cached);
  const [source, setSource] = useState(cached ? 'Cached CelesTrak elements' : 'Archived ISS example');
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(() => initialTime(cached?.record ?? archivedIss));
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState(1);
  const [follow, setFollow] = useState(true);
  const [showOrbit, setShowOrbit] = useState(true);
  const [showGroundTrack, setShowGroundTrack] = useState(true);
  const record = feed?.record ?? archivedIss;
  const epoch = satelliteEpoch(record);
  const outsideWindow = Math.abs(time - epoch) > MAX_ELEMENT_AGE_MS;
  const sample = useMemo(() => outsideWindow ? undefined : sampleSatellite(record, time), [record, time, outsideWindow]);
  const paths = useMemo(() => sample ? sampleSatellitePaths(record, time) : { orbit: [], ground: [] }, [record, time, sample]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/iss', { signal: controller.signal });
        if (!response.ok) return;
        const body: unknown = await response.json();
        const next = readIssFeed(body);
        if (!next || controller.signal.aborted) return;
        setFeed(next);
        setSource('CelesTrak');
        setTime(initialTime(next.record));
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(body));
        } catch {
          // The current session can use the feed even if storage is unavailable.
        }
      } catch {
        // Leave the cached or archived elements active.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!playing || outsideWindow) return;
    let last = performance.now();
    const handle = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - last;
      last = now;
      setTime(previous => previous + elapsed * rate);
    }, 250);
    return () => window.clearInterval(handle);
  }, [playing, rate, outsideWindow]);

  return (
    <section className="absolute inset-0 pt-16" aria-label="Earth Satellites">
      <SatelliteGlobe sample={sample} paths={paths} follow={follow} showOrbit={showOrbit} showGroundTrack={showGroundTrack} />
      <aside className="absolute left-3 top-20 max-h-[calc(100%-9rem)] w-[min(19rem,calc(100%-1.5rem))] space-y-3 overflow-auto rounded-xl border border-slate-700 bg-slate-950/90 p-3 text-xs shadow-xl sm:left-5">
        <h2 className="text-sm font-semibold text-sky-200">International Space Station</h2>
        <p className="text-slate-300">{source} · NORAD 25544</p>
        <div className="space-y-1 text-slate-400">
          <p>Element epoch <span className="font-mono text-slate-200">{formatUtc(epoch)}</span></p>
          {feed && <p>Fetched <span className="font-mono text-slate-200">{formatUtc(Date.parse(feed.fetchedAt))}</span></p>}
          {loading && <p>Checking for current orbital elements…</p>}
          {!loading && !feed && <p className="text-amber-200">Live feed unavailable. Showing an archived orbit from 2019.</p>}
          {outsideWindow && <p className="text-amber-200">Selected time is more than 7 days from the element epoch. Use Element epoch to resume tracking.</p>}
          {!outsideWindow && !sample && <p className="text-amber-200">No valid position is available for this time.</p>}
        </div>
        {sample && (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-slate-200">
            <dt>Altitude</dt><dd>{sample.altitude.toFixed(1)} km</dd>
            <dt>Inertial speed</dt><dd>{sample.speed.toFixed(2)} km/s</dd>
            <dt>Period</dt><dd>{satellitePeriodMinutes(record).toFixed(1)} min</dd>
            <dt>Latitude</dt><dd>{sample.latitude.toFixed(2)}°</dd>
            <dt>Longitude</dt><dd>{sample.longitude.toFixed(2)}°</dd>
          </dl>
        )}
        <div className="grid gap-1.5 border-t border-slate-800 pt-2">
          <label><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)} /> Follow ISS</label>
          <label className="text-sky-300"><input type="checkbox" checked={showOrbit} onChange={event => setShowOrbit(event.target.checked)} /> Next orbit</label>
          <label className="text-amber-200"><input type="checkbox" checked={showGroundTrack} onChange={event => setShowGroundTrack(event.target.checked)} /> Ground track</label>
        </div>
      </aside>
      <div className="absolute inset-x-3 bottom-4 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/90 p-2 text-xs shadow-xl">
        <time className="px-1 font-mono text-sky-200">{formatUtc(time)}</time>
        <button className="rounded bg-slate-800 px-2 py-1.5" onClick={() => setPlaying(value => !value)}>{playing ? 'Pause' : 'Play'}</button>
        <button className="rounded bg-slate-800 px-2 py-1.5" onClick={() => setTime(Date.now())}>Now</button>
        <button className="rounded bg-slate-800 px-2 py-1.5" onClick={() => setTime(epoch)}>Element epoch</button>
        <button className="rounded bg-slate-800 px-2 py-1.5" onClick={() => setTime(value => value - 600_000)}>−10 min</button>
        <button className="rounded bg-slate-800 px-2 py-1.5" onClick={() => setTime(value => value + 600_000)}>+10 min</button>
        <select aria-label="Satellite playback speed" className="rounded bg-slate-800 px-2 py-1.5" value={rate} onChange={event => setRate(Number(event.target.value))}>
          <option value={1}>1×</option><option value={10}>10×</option><option value={60}>60×</option>
        </select>
      </div>
    </section>
  );
}
