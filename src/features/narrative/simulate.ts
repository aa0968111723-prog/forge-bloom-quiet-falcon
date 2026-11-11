import { acknowledge, arrive, choose, createPlay, setClock, talk } from "./play.ts";
import type { Catalog, Play } from "./types.ts";

const TOUR: {
  placeId: string;
  choiceId: string;
  time?: "morning" | "evening";
  weather?: "clear" | "rain";
}[] = [
  { placeId: "main-gate", choiceId: "gate-ask-map" },
  { placeId: "palace", choiceId: "palace-library" },
  { placeId: "library", choiceId: "library-compare" },
  { placeId: "palace", choiceId: "deadline-calm", time: "evening" },
  { placeId: "engineering", choiceId: "lab-honest", time: "morning", weather: "clear" },
  { placeId: "business", choiceId: "shift-swap" },
  { placeId: "foreign", choiceId: "lang-ask" },
  { placeId: "museum", choiceId: "caption-report" },
  { placeId: "track", choiceId: "rain-indoor", weather: "rain" },
  { placeId: "sungtao-2", choiceId: "meal-tea", weather: "clear" },
];

export function playSteps(
  catalog: Catalog,
  seed: string,
  steps: readonly {
    placeId: string;
    choiceId: string;
    time?: "morning" | "evening";
    weather?: "clear" | "rain";
  }[],
): Play {
  let play = createPlay(seed);
  for (const step of steps) {
    if (step.time || step.weather) {
      play = setClock(
        play,
        step.time ?? play.session.timeOfDay,
        step.weather ?? play.session.weather,
      );
    }
    play = arrive(catalog, play, step.placeId);
    play = talk(catalog, play);
    const result = choose(catalog, play, step.choiceId);
    if (!result.ok) return result.play;
    play = acknowledge(result.play);
  }
  return play;
}

export function runTour(catalog: Catalog, seed: string): Play {
  return playSteps(catalog, seed, TOUR);
}

export function runChain(catalog: Catalog, seed: string, libraryFirst: boolean): Play {
  return playSteps(catalog, seed, [
    { placeId: "main-gate", choiceId: "gate-ask-map" },
    { placeId: "palace", choiceId: libraryFirst ? "palace-library" : "palace-stay" },
    { placeId: "library", choiceId: libraryFirst ? "library-compare" : "library-split" },
    { placeId: "palace", choiceId: "deadline-calm", time: "evening" },
  ]);
}

/** Fixed seeds. Coverage here is what these walks actually hit, not a proof that nothing else is wrong. */
export function simulateSeeds(catalog: Catalog, seeds: readonly string[]) {
  return seeds.map((seed) => {
    const tour = runTour(catalog, seed);
    const repeat = runTour(catalog, seed);
    return {
      seed,
      xp: tour.growth.xp,
      notes: tour.growth.materials.notes,
      credit: tour.growth.materials.credit,
      fired: tour.session.fired,
      sameAsRepeat:
        tour.growth.xp === repeat.growth.xp &&
        tour.session.fired.join() === repeat.session.fired.join(),
    };
  });
}
