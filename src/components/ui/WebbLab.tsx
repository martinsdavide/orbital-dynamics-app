import { WEBB_LAB_DAYS, WEBB_PATH_MAGNIFICATION, webbSampleIndex, type WebbExperiment, type WebbOffset, type WebbPoint, type WebbSceneState } from '../../physics/webbLab';
import { LAGRANGE_POINT_NAMES } from '../../physics/orbitalMechanics';

interface WebbLabProps {
  scene: WebbSceneState;
  experiment: WebbExperiment;
  offset: WebbOffset;
  nudge: number;
  playing: boolean;
  prediction: string;
  onExperiment: (experiment: WebbExperiment) => void;
  onOffset: (offset: WebbOffset) => void;
  onNudge: (nudge: number) => void;
  onFocus: (point: WebbPoint) => void;
  onDay: (day: number) => void;
  onPlay: () => void;
  onReset: () => void;
  onPrediction: (prediction: string) => void;
  onClose: () => void;
}

const formatDistance = (km: number) => km.toLocaleString(undefined, { maximumFractionDigits: 1 });
const selectClass = 'min-w-0 rounded bg-slate-800 px-2 py-1.5 text-slate-100';
const buttonClass = 'rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 hover:bg-slate-700';

export function WebbLab(props: WebbLabProps) {
  const { scene, experiment, offset, nudge, playing, prediction } = props;
  const compare = experiment === 'compare';
  const fullDistance = Math.max(100, ...scene.runs.map(run => run.samples.reduce((max, sample) => Math.max(max, sample.distanceKm), 0)));
  const chartY = (km: number) => 85 - 72 * Math.log1p(km) / Math.log1p(fullDistance);
  const chartX = (day: number) => 19 + 270 * day / WEBB_LAB_DAYS;

  return (
    <aside aria-label="Webb Lagrange lab" className="absolute left-3 top-20 z-20 max-h-[calc(100%-6rem)] w-[min(22rem,calc(100%-1.5rem))] space-y-3 overflow-auto rounded-xl border border-slate-700 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-xl sm:left-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-amber-200">Why does Webb orbit L2?</h2>
        <button type="button" onClick={props.onClose} className={buttonClass}>Close</button>
      </div>
      <p>Release a virtual Webb in the rotating Sun–Earth frame. The spacecraft starts at rest in that frame.</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">Experiment
          <select className={selectClass} value={experiment} onChange={event => props.onExperiment(event.target.value as WebbExperiment)}>
            <option value="compare">Compare L2 and L4</option>
            {LAGRANGE_POINT_NAMES.map(point => <option value={point} key={point}>Place at {point}</option>)}
          </select>
        </label>
        <label className="grid gap-1">Initial nudge
          <select className={selectClass} value={nudge} onChange={event => props.onNudge(Number(event.target.value))}>
            <option value={0}>None</option><option value={10}>10 km</option><option value={100}>100 km</option><option value={1000}>1,000 km</option>
          </select>
        </label>
        <label className="grid gap-1">Nudge direction
          <select className={selectClass} value={offset} onChange={event => props.onOffset(event.target.value as WebbOffset)}>
            <option value="radial">Along Sun–Earth line</option><option value="along-track">Along Earth’s orbit</option>
          </select>
        </label>
        {compare && <label className="grid gap-1">Camera focus
          <select className={selectClass} value={scene.focus} onChange={event => props.onFocus(event.target.value as WebbPoint)}>
            <option value="L2">L2</option><option value="L4">L4</option>
          </select>
        </label>}
      </div>
      {compare && nudge > 0 && (
        <label className="grid gap-1">Which spacecraft will stay closer?
          <select className={selectClass} value={prediction} onChange={event => props.onPrediction(event.target.value)}>
            <option value="">Make a prediction</option><option value="L2">L2</option><option value="L4">L4</option><option value="same">About the same</option>
          </select>
        </label>
      )}
      <div className="flex items-center gap-2">
        <button type="button" onClick={props.onPlay} className="rounded bg-sky-700 px-3 py-1.5 font-semibold hover:bg-sky-600">{playing ? 'Pause' : scene.day >= WEBB_LAB_DAYS ? 'Run again' : 'Run'}</button>
        <button type="button" onClick={props.onReset} className={buttonClass}>Reset</button>
        <span className="ml-auto font-mono">Day {scene.day.toFixed(1)} / {WEBB_LAB_DAYS}</span>
      </div>
      <label className="grid gap-1">Experiment day
        <input type="range" min={0} max={WEBB_LAB_DAYS} step={0.5} value={scene.day} onChange={event => props.onDay(Number(event.target.value))} />
      </label>
      <figure className="rounded bg-slate-900 p-2">
        <figcaption>Distance from equilibrium (km, log scale)</figcaption>
        <svg viewBox="0 0 300 100" role="img" aria-label="Distance from each equilibrium over time" className="w-full">
          <path d="M19 9V85H290" fill="none" stroke="#64748b" />
          <text x="18" y="97" fill="#cbd5e1" fontSize="9">0</text>
          <text x="258" y="97" fill="#cbd5e1" fontSize="9">180 days</text>
          <text x="23" y="12" fill="#cbd5e1" fontSize="9">{formatDistance(fullDistance)} km</text>
          {scene.runs.map(run => {
            const index = webbSampleIndex(run, scene.day);
            const points = run.samples.slice(0, index + 1).filter((_, i) => i % 15 === 0 || i === index)
              .map(sample => `${chartX(sample.day)},${chartY(sample.distanceKm)}`).join(' ');
            const latest = run.samples[index];
            const color = run.point === 'L4' || run.point === 'L5' ? '#34d399' : '#fbbf24';
            return <g key={run.point}>
              <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" />
              <circle cx={chartX(latest.day)} cy={chartY(latest.distanceKm)} r="2.5" fill={color} />
            </g>;
          })}
        </svg>
        <div className="flex flex-wrap gap-3 font-mono">
          {scene.runs.map(run => <span key={run.point} className={run.point === 'L4' || run.point === 'L5' ? 'text-emerald-300' : 'text-amber-300'}>
            {run.point} {formatDistance(run.samples[webbSampleIndex(run, scene.day)].distanceKm)} km
            {run.impact && scene.day >= run.samples.at(-1)!.day ? ` · hit ${run.impact}` : ''}
          </span>)}
        </div>
      </figure>
      {scene.day >= WEBB_LAB_DAYS && (
        <p className="text-sky-200">{nudge === 0
          ? 'At the exact equilibrium, the virtual Webb stays in place. Try a small nudge to test its stability.'
          : compare ? `${prediction === 'L4' ? 'Your prediction matched the experiment. ' : prediction ? 'Compare your prediction with the two traces. ' : ''}L4 stays much closer in this run. Small disturbances near L2 can grow.`
          : 'Try the same nudge at another point and compare how far Webb moves over the same time.'}</p>
      )}
      <details className="rounded border border-slate-800 p-2">
        <summary className="cursor-pointer font-semibold text-sky-200">Why choose L2 if L4 is stable?</summary>
        <p className="mt-2">Near L2, the Sun, Earth, and Moon stay in the same general direction. Webb’s sunshield can keep them on its warm side while the telescope observes from its cold side. Webb uses occasional corrections to maintain its halo orbit.</p>
        <a className="mt-1 inline-block text-sky-300 underline" href="https://science.nasa.gov/mission/webb/orbit/" target="_blank" rel="noreferrer">NASA’s Webb orbit overview</a>
      </details>
      <p className="text-slate-400">Idealized experiment. Motion is magnified {WEBB_PATH_MAGNIFICATION}× in the view. The chart shows modeled distances. The real Webb follows a 3D halo orbit around L2.</p>
    </aside>
  );
}
