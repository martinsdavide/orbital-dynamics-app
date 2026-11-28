import type { useHalleyLab } from './useHalleyLab';

const titles = ['Far from the Sun', 'Closest to the Sun', 'Heading away'];
const button = 'rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 hover:bg-slate-800';
const primary = 'rounded-lg bg-sky-600 px-3 py-2 font-semibold text-white hover:bg-sky-500 disabled:opacity-40';

export function HalleyLab({ lab }: { lab: ReturnType<typeof useHalleyLab> }) {
  return (
    <aside aria-label="Halley’s Big Trip" className="absolute bottom-3 left-3 z-20 max-h-[55vh] w-[min(20rem,calc(100%-1rem))] space-y-3 overflow-auto rounded-xl border border-sky-900 bg-slate-950/95 p-3 text-sm text-slate-100 shadow-xl sm:bottom-auto sm:left-4 sm:top-20 sm:max-h-[calc(100%-6rem)]">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-sky-200">Halley’s Big Trip</h2>
        <button type="button" onClick={lab.close} className="rounded px-1.5 text-slate-300 hover:text-white">Close</button>
      </div>
      <p className="text-xs text-sky-300">Stop {lab.stop + 1} of 3</p>
      <h3 className="font-semibold">{lab.travelling ? (lab.stop === 1 ? 'Flying toward the Sun' : 'Flying away from the Sun') : titles[lab.stop]}</h3>

      {lab.travelling ? (
        <div className="space-y-3">
          <p>{lab.stop === 1 ? 'Watch what happens as Halley warms up.' : 'Watch Halley turn and head back out.'}</p>
          <button type="button" className={button} onClick={lab.togglePause}>{lab.paused ? 'Keep going' : 'Pause'}</button>
        </div>
      ) : lab.stop === 0 ? (
        <div className="space-y-3">
          <p>Halley is a ball of ice, rock, and dust. What will happen to its tails as it gets closer to the Sun?</p>
          <div className="grid gap-1.5" aria-label="Your guess">
            {['They grow', 'They shrink', 'They stay the same'].map(guess => (
              <button type="button" key={guess} aria-pressed={lab.growthGuess === guess} className={`${button} text-left aria-pressed:border-sky-400 aria-pressed:bg-sky-950`} onClick={() => lab.setGrowthGuess(guess)}>{guess}</button>
            ))}
          </div>
          <button type="button" className={primary} disabled={!lab.growthGuess} onClick={lab.next}>Follow Halley</button>
        </div>
      ) : lab.stop === 1 ? (
        <div className="space-y-3">
          <p>{lab.growthGuess === 'They grow' ? 'You guessed it! ' : 'Look how much the tails grew! '}The Sun warms Halley, and gas and dust escape from its icy surface.</p>
          <p><span className="text-sky-300">Blue tail</span> is made of gas. <span className="text-amber-200">Golden tail</span> is made of dust.</p>
          <button type="button" className={primary} onClick={lab.next}>Next</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p>Halley is heading away from the Sun. Which way does its blue tail point?</p>
          <div className="grid gap-1.5" aria-label="Guess the blue tail direction">
            {['Toward the Sun', 'Away from the Sun'].map(guess => (
              <button type="button" key={guess} aria-pressed={lab.directionGuess === guess} className={`${button} text-left aria-pressed:border-sky-400 aria-pressed:bg-sky-950`} onClick={() => lab.setDirectionGuess(guess)}>{guess}</button>
            ))}
          </div>
          {lab.showArrows && (
            <>
              <p>{lab.directionGuess === 'Away from the Sun' ? 'You got it! ' : 'Look at the blue arrow. '}The Sun sends out a stream of tiny particles that pushes the gas away.</p>
              <ul className="space-y-1">
                <li className="text-sky-300">Blue arrow · away from the Sun</li>
                <li className="text-emerald-300">Green arrow · Halley’s direction of travel</li>
              </ul>
              <button type="button" className={primary} onClick={lab.restart}>Play again</button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
