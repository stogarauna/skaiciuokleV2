import type {Screen} from './project.ts';
import {rectangularRoutes, type BlockRoutingSettings} from './signal.ts';

export interface PowerSettings {
 limitW: number;
 direction: 'rows' | 'columns';
 edge: 'left' | 'right' | 'top' | 'bottom';
}

export const defaultPowerSettings: Readonly<PowerSettings> = {limitW: 3600, direction: 'rows', edge: 'left'};

export function validPowerLimit(value: unknown): value is number {
 return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function validatePowerSettings(value: unknown): value is PowerSettings {
 if (!value || typeof value !== 'object') return false;
 const {limitW, direction, edge} = value as PowerSettings;
 return validPowerLimit(limitW) && (
  (direction === 'rows' && (edge === 'left' || edge === 'right'))
  || (direction === 'columns' && (edge === 'top' || edge === 'bottom'))
 );
}

export function powerPlan(screen: Screen, settings = screen.powerRouting ?? defaultPowerSettings) {
 const panelWatts = screen.panel.power && screen.panel.power > 0 ? screen.panel.power : null;
 const panelsPerCircuit = panelWatts === null ? 0 : Math.floor(settings.limitW / panelWatts);
 const corners: Record<PowerSettings['edge'], BlockRoutingSettings['corner']> = {
  left: 'top-left', right: 'top-right', top: 'top-left', bottom: 'bottom-left'
 };
 const routes = rectangularRoutes(screen, {
  direction: settings.direction, entryEdge: settings.edge, corner: corners[settings.edge], maxTracksPerPort: 1
 }, panelsPerCircuit);
 return {
  ...routes, panelWatts, panelsPerCircuit,
  totalWatts: panelWatts === null ? null : panelWatts * routes.cells.length,
  ports: routes.ports.map(port => {
   const watts = port.cells.length * panelWatts!;
   return {...port, watts, remaining: Math.max(0, settings.limitW - watts)};
  })
 };
}

export function powerPlanIssue(plan: ReturnType<typeof powerPlan>) {
 if (!plan.cells.length) return 'Aktyvių panelių nėra.';
 if (plan.panelWatts === null) return 'Nenurodyta panelės galia. Įrašykite ją panelių kataloge.';
 if (!plan.panelsPerCircuit) return 'Grandinės W riba mažesnė už vienos panelės galią.';
 if (plan.issue === 'gap') return 'Nuo pasirinktos kraštinės dėl tarpų nepavyksta sudaryti tiesių grandinių.';
 if (plan.issue === 'depth') return 'Visa eilė arba stulpelis viršija grandinės W ribą. Pakeiskite kryptį.';
 return null;
}
