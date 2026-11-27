import { useEffect, useMemo, useState } from 'react';
import { ARCHIVED_ISS_CATALOG, MAX_ELEMENT_AGE_MS, readIssFeed, readSatelliteCatalog, sampleSatellite, sampleSatellitePaths, satelliteEpoch, satellitePeriodMinutes, type SatelliteCatalog } from '../../physics/satellites';
import { SatelliteGlobe } from './SatelliteGlobe';
import { useCatalogPoints } from './useCatalogPoints';

const satelliteGroups = [
  { id: 'iss', label: 'International Space Station', distance: 4.2 },
  { id: 'starlink', label: 'Starlink', distance: 4.5 },
  { id: 'oneweb', label: 'OneWeb', distance: 5.0 },
  { id: 'gps-ops', label: 'GPS', distance: 12 },
  { id: 'galileo', label: 'Galileo', distance: 13.5 },
  { id: 'glo-ops', label: 'GLONASS', distance: 12 },
  { id: 'weather', label: 'Weather satellites', distance: 19 },
] as const;
const debrisGroups = [
  { id: 'fengyun-1c-debris', label: 'Fengyun-1C debris', distance: 5.3 },
  { id: 'iridium-33-debris', label: 'Iridium 33 debris', distance: 5.3 },
  { id: 'cosmos-2251-debris', label: 'Cosmos 2251 debris', distance: 5.3 },
] as const;
const groups = [...satelliteGroups, ...debrisGroups] as const;
type Group = typeof groups[number];
const CACHE_KEY = 'astrosim.satellite-catalogs.v1';
const EMPTY_CATALOG: SatelliteCatalog = { satellites: [] };
const formatUtc = (time: number) => new Date(time).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

function parseCatalog(body: unknown, group: Group): SatelliteCatalog | undefined {
  if (group.id !== 'iss') return readSatelliteCatalog(body);
  const feed = readIssFeed(body);
  if (!feed) return;
  return {
    satellites: [{ id: '25544', name: 'International Space Station', record: feed.record }],
    fetchedAt: feed.fetchedAt,
  };
}

export function SatelliteView() {
  const [group, setGroup] = useState<Group>(groups[0]);
  return <CatalogView key={group.id} group={group} selectGroup={setGroup} />;
}

function CatalogView({ group, selectGroup }: { group: Group; selectGroup: (group: Group) => void }) {
  const isIss = group.id === 'iss';
  const isDebris = debrisGroups.some(option => option.id === group.id);
  const [catalog, setCatalog] = useState(isIss ? ARCHIVED_ISS_CATALOG : EMPTY_CATALOG);
  const [source, setSource] = useState(isIss ? 'Archived ISS example' : '');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(isIss ? '25544' : '');
  const [query, setQuery] = useState('');
  const [time, setTime] = useState(() => isIss ? satelliteEpoch(ARCHIVED_ISS_CATALOG.satellites[0].record) : Date.now());
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState(1);
  const [follow, setFollow] = useState(isIss);
  const [showOrbit, setShowOrbit] = useState(true);
  const [showGroundTrack, setShowGroundTrack] = useState(true);
  const selected = useMemo(() => catalog.satellites.find(satellite => satellite.id === selectedId), [catalog, selectedId]);
  const matches = useMemo(() => {
    const search = query.trim().toLowerCase();
    return catalog.satellites.filter(satellite => satellite.name.toLowerCase().includes(search) || satellite.id.includes(search));
  }, [catalog, query]);
  const record = selected?.record;
  const epoch = record ? satelliteEpoch(record) : undefined;
  const outsideWindow = epoch !== undefined && Math.abs(time - epoch) > MAX_ELEMENT_AGE_MS;
  const sample = useMemo(() => record && !outsideWindow ? sampleSatellite(record, time) : undefined, [record, time, outsideWindow]);
  const paths = useMemo(() => record && sample ? sampleSatellitePaths(record, time) : { orbit: [], ground: [] }, [record, time, sample]);
  const points = useCatalogPoints(isIss ? EMPTY_CATALOG.satellites : catalog.satellites, time);

  useEffect(() => {
    const controller = new AbortController();
    const url = isIss ? '/api/iss' : `/api/satellite-catalog?group=${group.id}`;

    function applyCatalog(next: SatelliteCatalog, cached: boolean) {
      if (controller.signal.aborted) return;
      setCatalog(next);
      setSource(cached ? 'Cached CelesTrak elements' : 'CelesTrak');
      const records = next.satellites;
      const now = Date.now();
      const first = satelliteEpoch(records[0].record);
      if (!records.some(satellite => Math.abs(now - satelliteEpoch(satellite.record)) <= MAX_ELEMENT_AGE_MS)) {
        setTime(first);
      } else {
        setTime(now);
      }
    }

    async function load() {
      let cache: Cache | undefined;
      try {
        cache = await window.caches?.open(CACHE_KEY);
        const cached = await cache?.match(url);
        const body: unknown = cached ? await cached.json() : isIss ? JSON.parse(localStorage.getItem('astrosim.iss-elements') ?? 'null') : null;
        const saved = parseCatalog(body, group);
        if (saved) applyCatalog(saved, true);
      } catch {
        // Cached data is optional.
      }

      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return;
        const body: unknown = await response.clone().json();
        const next = parseCatalog(body, group);
        if (!next || controller.signal.aborted) return;
        applyCatalog(next, false);
        await cache?.put(url, response);
      } catch {
        // Leave the cached or archived data active.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [group, isIss]);

  useEffect(() => {
    if (!playing || (isIss && outsideWindow)) return;
    let last = performance.now();
    const handle = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - last;
      last = now;
      setTime(previous => previous + elapsed * rate);
    }, 250);
    return () => window.clearInterval(handle);
  }, [playing, rate, isIss, outsideWindow]);

  return (
    <section className="absolute inset-0 pt-16" aria-label="Earth Satellites">
      <SatelliteGlobe sample={sample} paths={paths} points={points} overviewDistance={group.distance} pointColor={isDebris ? '#f6a557' : '#71c5f5'} follow={follow} showOrbit={showOrbit} showGroundTrack={showGroundTrack} />
      <aside className="absolute left-3 top-20 max-h-[calc(100%-9rem)] w-[min(19rem,calc(100%-1.5rem))] space-y-3 overflow-auto rounded-xl border border-slate-700 bg-slate-950/90 p-3 text-xs shadow-xl sm:left-5">
        <label className="grid gap-1 font-semibold text-sky-200">
          Satellite group
          <select value={group.id} className="rounded bg-slate-800 px-2 py-1.5" onChange={event => {
            const next = groups.find(option => option.id === event.target.value);
            if (next) selectGroup(next);
          }}>
            <optgroup label="Satellites">
              {satelliteGroups.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </optgroup>
            <optgroup label="Orbital debris">
              {debrisGroups.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </optgroup>
          </select>
        </label>
        {!isIss && catalog.satellites.length > 0 && (
          <div className="grid gap-1.5">
            <label className="grid gap-1">
              Find by name or NORAD ID
              <input className="rounded bg-slate-800 px-2 py-1.5" type="search" value={query} onChange={event => setQuery(event.target.value)} />
            </label>
            <label className="grid gap-1">
              {isDebris ? 'Selected fragment' : 'Selected satellite'}
              <select className="rounded bg-slate-800 px-2 py-1.5" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
                <option value="">{isDebris ? 'Debris overview' : 'Constellation overview'}</option>
                {selected && !matches.slice(0, 100).includes(selected) && <option value={selected.id}>{selected.name} · {selected.id}</option>}
                {matches.slice(0, 100).map(satellite => <option key={satellite.id} value={satellite.id}>{satellite.name} · {satellite.id}</option>)}
              </select>
            </label>
            {matches.length > 100 && <p className="text-slate-400">Showing 100 choices. Search to narrow the list.</p>}
            {!matches.length && <p className="text-slate-400">No matching objects.</p>}
          </div>
        )}
        {selected && <h2 className="text-sm font-semibold text-sky-200">{selected.name}</h2>}
        {source && <p className="text-slate-300">{source}{selected && ` · NORAD ${selected.id}`}</p>}
        {!isIss && catalog.satellites.length > 0 && <p className="text-slate-300">{points.length / 3} of {catalog.satellites.length} {isDebris ? 'debris objects' : 'satellites'} plotted</p>}
        <div className="space-y-1 text-slate-400" aria-live="polite">
          {epoch !== undefined && <p>Element epoch <span className="font-mono text-slate-200">{formatUtc(epoch)}</span></p>}
          {catalog.fetchedAt && <p>Fetched <span className="font-mono text-slate-200">{formatUtc(Date.parse(catalog.fetchedAt))}</span></p>}
          {loading && <p>Checking for current orbital elements…</p>}
          {!loading && !catalog.fetchedAt && (
            <p className="text-amber-200">{isIss ? 'Live feed unavailable. Showing an archived orbit from 2019.' : 'Live feed unavailable. No cached catalog for this group.'}</p>
          )}
          {outsideWindow && <p className="text-amber-200">Selected time is more than 7 days from the element epoch. Use Element epoch to resume tracking.</p>}
          {selected && !outsideWindow && !sample && <p className="text-amber-200">No valid position is available for this time.</p>}
        </div>
        {sample && record && (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-slate-200">
            <dt>Altitude</dt><dd>{sample.altitude.toFixed(1)} km</dd>
            <dt>Inertial speed</dt><dd>{sample.speed.toFixed(2)} km/s</dd>
            <dt>Period</dt><dd>{satellitePeriodMinutes(record).toFixed(1)} min</dd>
            <dt>Latitude</dt><dd>{sample.latitude.toFixed(2)}°</dd>
            <dt>Longitude</dt><dd>{sample.longitude.toFixed(2)}°</dd>
          </dl>
        )}
        {selected && <div className="grid gap-1.5 border-t border-slate-800 pt-2">
          <label><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)} /> {isIss ? 'Follow ISS' : isDebris ? 'Follow fragment' : 'Follow satellite'}</label>
          <label className="text-sky-300"><input type="checkbox" checked={showOrbit} onChange={event => setShowOrbit(event.target.checked)} /> Next orbit</label>
          <label className="text-amber-200"><input type="checkbox" checked={showGroundTrack} onChange={event => setShowGroundTrack(event.target.checked)} /> Ground track</label>
        </div>}
      </aside>
      <div className="absolute inset-x-3 bottom-4 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/90 p-2 text-xs shadow-xl">
        <time className="px-1 font-mono text-sky-200">{formatUtc(time)}</time>
        <button className="rounded bg-slate-800 px-2 py-1.5" onClick={() => setPlaying(value => !value)}>{playing ? 'Pause' : 'Play'}</button>
        <button className="rounded bg-slate-800 px-2 py-1.5" onClick={() => setTime(Date.now())}>Now</button>
        {epoch !== undefined && <button className="rounded bg-slate-800 px-2 py-1.5" onClick={() => setTime(epoch)}>Element epoch</button>}
        <button className="rounded bg-slate-800 px-2 py-1.5" onClick={() => setTime(value => value - 600_000)}>−10 min</button>
        <button className="rounded bg-slate-800 px-2 py-1.5" onClick={() => setTime(value => value + 600_000)}>+10 min</button>
        <select aria-label="Satellite playback speed" className="rounded bg-slate-800 px-2 py-1.5" value={rate} onChange={event => setRate(Number(event.target.value))}>
          <option value={1}>1×</option><option value={10}>10×</option><option value={60}>60×</option>
        </select>
      </div>
    </section>
  );
}
