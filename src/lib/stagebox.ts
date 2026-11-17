import type {Screen} from './project.ts';
import {defaultPowerSettings, powerPlan, powerPlanIssue, type PowerSettings} from './power.ts';

export const outletLimitW = 3600;
export const outletsPerPhase = 2;
export const phaseLimitW = outletsPerPhase * outletLimitW;
export const phaseNames = ['L1', 'L2', 'L3'] as const;

export function stageboxPowerSettings(screen: Screen): PowerSettings {
 const settings = screen.powerRouting ?? defaultPowerSettings;
 return {...settings, limitW: Math.min(outletLimitW, settings.limitW)};
}

interface Phase {
 name: typeof phaseNames[number];
 watts: number;
 outlets: number;
}

interface Feed {
 number: number;
 boxCount: number;
 phases: Phase[];
}

export interface OutletAssignment {
 feed: number;
 box: number;
 phase: Phase['name'];
 outlet: number;
}

function newFeed(number: number): Feed {
 return {number, boxCount: 1, phases: phaseNames.map(name => ({name, watts: 0, outlets: 0}))};
}

export function stageboxOutlet(assignment: OutletAssignment) {
 return `Įv. ${assignment.feed} · SB${assignment.box} · ${assignment.phase}.${assignment.outlet}`;
}

export function stageboxPlan(screens: Screen[]) {
 const screenPlans = screens.map(screen => ({
  screen, plan: powerPlan(screen, stageboxPowerSettings(screen))
 }));
 const circuits = screenPlans.flatMap(({screen, plan}) =>
  plan.ports.map(port => ({screenId: screen.id, number: port.number, watts: port.watts})));
 circuits.sort((a, b) => b.watts - a.watts);
 const feeds: Feed[] = [];
 const assignments = new Map<string, Map<number, OutletAssignment>>();
 for (const circuit of circuits) {
  // Heavier circuits go first. Linked boxes add sockets, sharing the feed's phase budget.
  let feed = feeds.find(candidate => candidate.phases.some(phase => phase.watts + circuit.watts <= phaseLimitW));
  if (!feed) {
   feed = newFeed(feeds.length + 1);
   feeds.push(feed);
  }
  const available = feed.phases.filter(phase => phase.watts + circuit.watts <= phaseLimitW);
  const freeOutlet = (phase: Phase) => phase.outlets < feed.boxCount * outletsPerPhase;
  available.sort((a, b) => Number(freeOutlet(b)) - Number(freeOutlet(a)) || a.watts - b.watts || a.outlets - b.outlets);
  const phase = available[0];
  const box = Math.floor(phase.outlets / outletsPerPhase) + 1;
  const outlet = phase.outlets % outletsPerPhase + 1;
  phase.watts += circuit.watts;
  phase.outlets++;
  feed.boxCount = Math.max(feed.boxCount, box);
  const screenAssignments = assignments.get(circuit.screenId) ?? new Map<number, OutletAssignment>();
  screenAssignments.set(circuit.number, {feed: feed.number, box, phase: phase.name, outlet});
  assignments.set(circuit.screenId, screenAssignments);
 }
 return {
  screenPlans,
  feeds,
  assignments,
  boxCount: feeds.reduce((sum, feed) => sum + feed.boxCount, 0),
  incomplete: screenPlans.some(({plan}) => plan.cells.length > 0 && powerPlanIssue(plan) !== null)
 };
}

export type StageboxPlan = ReturnType<typeof stageboxPlan>;
