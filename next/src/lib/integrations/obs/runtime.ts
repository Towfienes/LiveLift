import { ObsBridge } from "./bridge";

// ponytail: one OBS connection per Node process; run one process per OBS installation.
const state = globalThis as typeof globalThis & { liveLiftObsBridge?: ObsBridge };
export function getObsBridge(): ObsBridge {
  state.liveLiftObsBridge ??= new ObsBridge();
  state.liveLiftObsBridge.start();
  return state.liveLiftObsBridge;
}
