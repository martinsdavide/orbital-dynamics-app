import { useState, type FormEvent } from 'react';
import {
  estimateMarsCaptureDeltaV, SECONDS_PER_DAY, solveMarsTransfer, type MarsTransfer,
} from '../../physics/marsTransfer.ts';

interface Props {
  mission: MarsTransfer;
  progress: number;
  playing: boolean;
  collapsed: boolean;
  onCollapse: () => void;
  onSolve: (mission: MarsTransfer) => void;
  onScrub: (progress: number) => void;
  onTogglePlay: () => void;
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' });
const field = 'min-w-0 w-full rounded-lg border border-gray-700 bg-gray-950 px-2 py-2 text-gray-100';
const smallButton = 'rounded-lg border border-gray-700 bg-gray-900 px-2.5 py-1.5 hover:border-amber-400';

export function MarsMissionControls({
  mission, progress, playing, collapsed, onCollapse, onSolve, onScrub, onTogglePlay,
}: Props) {
  const [departure, setDeparture] = useState(mission.departureDate);
  const [arrival, setArrival] = useState(mission.arrivalDate);
  const [profile, setProfile] = useState('orbit');
  const [altitude, setAltitude] = useState(300);
  const [error, setError] = useState('');
  const days = mission.duration / SECONDS_PER_DAY;
  const date = dateFormat.format(mission.departureEpoch + mission.duration * progress * 1000);
  const capture = estimateMarsCaptureDeltaV(mission.marsArrivalSpeed, altitude) / 1000;

  const calculate = (event: FormEvent) => {
    event.preventDefault();
    try {
      onSolve(solveMarsTransfer(departure, arrival));
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to solve this transfer.');
    }
  };

  return (
    <>
      <section aria-label="Earth–Mars mission planner" className="absolute left-3 top-16 z-20 max-h-[calc(100dvh-13rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-gray-800 bg-gray-950/95 p-3 text-xs text-gray-200 shadow-xl">
        <button type="button" onClick={onCollapse} aria-expanded={!collapsed} className="flex w-full items-center justify-between gap-4 text-left font-semibold text-amber-200">
          <span>Earth–Mars Mission</span><span aria-hidden="true">{collapsed ? '+' : '−'}</span>
        </button>
        {!collapsed && (
          <>
            <form onSubmit={calculate} className="mt-3 space-y-2">
              <label className="block space-y-1">
                <span>Departure (UTC)</span>
                <input className={field} type="date" min="1900-01-01" max="2050-01-01" required value={departure} onChange={event => setDeparture(event.target.value)} />
              </label>
              <label className="block space-y-1">
                <span>Arrival (UTC)</span>
                <input className={field} type="date" min="1900-01-01" max="2050-01-01" required value={arrival} onChange={event => setArrival(event.target.value)} />
              </label>
              <button type="submit" className="w-full rounded-lg bg-amber-400 py-2 font-semibold text-gray-950 hover:bg-amber-300">Calculate transfer</button>
              {error && <p role="alert" className="text-red-300">{error} Showing the last valid transfer.</p>}
            </form>

            <label className="mt-3 block space-y-1">
              <span>Mars encounter</span>
              <select className={field} value={profile} onChange={event => setProfile(event.target.value)}>
                <option value="orbit">Orbital insertion</option>
                <option value="flyby">Flyby</option>
              </select>
            </label>
            {profile === 'orbit' && (
              <label className="mt-2 block space-y-1">
                <span>Circular Mars orbit</span>
                <select className={field} value={altitude} onChange={event => setAltitude(Number(event.target.value))}>
                  {[200, 300, 500, 1000].map(value => <option key={value} value={value}>{value} km altitude</option>)}
                </select>
              </label>
            )}

            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 font-mono">
              <dt>Transfer duration</dt><dd>{days.toFixed(0)} days</dd>
              <dt>Earth departure C3</dt><dd>{mission.c3.toFixed(2)} km²/s²</dd>
              <dt>Mars arrival v∞</dt><dd>{(mission.marsArrivalSpeed / 1000).toFixed(2)} km/s</dd>
              {profile === 'orbit' && <><dt>Estimated capture Δv</dt><dd>{capture.toFixed(2)} km/s</dd></>}
            </dl>
            <p className="mt-3 leading-relaxed text-gray-400">The plotted leg ends at Mars encounter. Body sizes are exaggerated. Capture Δv assumes a single impulsive burn at the selected altitude.</p>
          </>
        )}
      </section>

      <section aria-label="Mars mission timeline" className="absolute bottom-4 left-3 right-16 z-20 mx-auto max-w-xl space-y-2 rounded-xl border border-gray-800 bg-gray-950/95 p-3 text-xs text-gray-100 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={onTogglePlay} className={smallButton}>{playing ? 'Pause' : 'Play'}</button>
          <output aria-label="Current mission date" className="font-mono">{date}</output>
          <span className="text-gray-400">Day {(progress * days).toFixed(0)} / {days.toFixed(0)}</span>
        </div>
        <input aria-label="Mars mission progress" type="range" min={0} max={1} step={0.001} value={progress} onChange={event => onScrub(Number(event.target.value))} className="w-full accent-amber-400" />
        <div className="flex justify-between gap-1">
          <button type="button" onClick={() => onScrub(0)} className={smallButton}>Earth departure</button>
          <button type="button" onClick={() => onScrub(0.5)} className={smallButton}>Mid-course</button>
          <button type="button" onClick={() => onScrub(1)} className={smallButton}>Mars encounter</button>
        </div>
      </section>
    </>
  );
}
