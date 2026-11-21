import type {DrawingPoint as Point} from './drawing-project.ts';
import type {Screen} from './project.ts';
import {screenCentreOffset} from './screen-alignment.ts';

type Axis = keyof Point;
type Box = Point & {width: number; height: number};
type Item = {id: string; box: Box; offset: Point; pin: Point};
type Separation = {before: Item; after: Item; axis: Axis; requiredScale: number};

const drawingGap = 1; // Free space in metres for names and dimension lines in schematic layouts.
const limit = 1000; // Project files support origins from −1000 m to +1000 m.
const epsilon = 1e-8;
const size = (box: Box, axis: Axis) => axis === 'x' ? box.width : box.height;

function separation(a: Item, b: Item, axis: Axis, gap: number): Separation {
 const [before, after] = a.pin[axis] < b.pin[axis] || (a.pin[axis] === b.pin[axis] && a.id < b.id) ? [a,b] : [b,a];
 const needed = size(before.box, axis) - before.offset[axis] + gap + after.offset[axis];
 const delta = after.pin[axis] - before.pin[axis];
 return {before, after, axis, requiredScale: delta > 0 ? needed / delta : Infinity};
}

function projectPins(items: Item[], constraints: Separation[], scale: number, gap: number) {
 const boxes = new Map<string, Box>();
 for (const item of items) {
  boxes.set(item.id, {...item.box, x: item.pin.x * scale - item.offset.x, y: item.pin.y * scale - item.offset.y});
 }
 // Near-coincident pins need local clearance. Process each axis in picture order so
 // moving a screen cannot undo the clearance already left for its predecessors.
 for (const axis of ['x','y'] as const) {
  const order = [...items].sort((a,b) => a.pin[axis] - b.pin[axis] || (a.id < b.id ? -1 : 1));
  const rank = new Map(order.map((item,index) => [item.id,index]));
  const edges = constraints.filter(edge => edge.axis === axis)
   .sort((a,b) => rank.get(a.after.id)! - rank.get(b.after.id)!);
  for (const edge of edges) {
   const before = boxes.get(edge.before.id)!, after = boxes.get(edge.after.id)!;
   after[axis] = Math.max(after[axis], before[axis] + size(before, axis) + gap);
  }
 }
 const left = Math.min(...Array.from(boxes.values(), box => box.x));
 const top = Math.min(...Array.from(boxes.values(), box => box.y));
 for (const box of boxes.values()) {
  box.x -= left;
  box.y -= top;
 }
 return boxes;
}

function placeGroup(boxes: Box[], fixed: Box[], preferred: Point, gap: number): Point | undefined {
 const choices = (axis: Axis) => {
  const reach = Math.max(...boxes.map(box => box[axis]));
  if (!Number.isFinite(reach) || reach > limit * 2) return [];
  const clamp = (value: number) => Math.min(limit - reach, Math.max(-limit, value));
  const extent = Math.max(...boxes.map(box => box[axis] + size(box, axis)));
  const values = [preferred[axis], -limit, limit];
  for (const other of fixed) values.push(other[axis] - extent - gap, other[axis] + size(other, axis) + gap);
  return [...new Set(values.map(clamp))];
 };
 const xs = choices('x'), ys = choices('y');
 const candidates = xs.flatMap(x => ys.map(y => ({x, y})));
 const distance = (p: Point) => Math.hypot(p.x - preferred.x, p.y - preferred.y);
 candidates.sort((a,b) => distance(a) - distance(b));
 return candidates.find(({x,y}) => boxes.every(box => fixed.every(other =>
  x + box.x + box.width + gap <= other.x + epsilon || x + box.x >= other.x + other.width + gap - epsilon ||
  y + box.y + box.height + gap <= other.y + epsilon || y + box.y >= other.y + other.height + gap - epsilon
 )));
}

/** Convert normalized drawing centres to project origins in metres. Pins are keyed by project screen ID.
 * A calibrated plan supplies its physical image height, preserving scale on both axes.
 */
export function layoutFromDrawing(screens: readonly Screen[], pins: ReadonlyMap<string, Point>, aspect: number,
 metresPerImageHeight?: number): Map<string, Point> {
 const result = new Map<string, Point>();
 if (!Number.isFinite(aspect) || aspect <= 0) return result;
 const items: Item[] = [], fixed: Box[] = [];
 for (const screen of screens) {
  const box = {x: screen.x, y: screen.y, width: screen.cols * screen.panel.widthM, height: screen.rows * screen.panel.heightM};
  const pin = pins.get(screen.id);
  if (pin && pin.x >= 0 && pin.x <= 1 && pin.y >= 0 && pin.y <= 1) {
   items.push({id: screen.id, box, offset: screenCentreOffset(screen), pin: {x: pin.x * aspect, y: pin.y}});
  } else fixed.push(box);
 }
 if (!items.length) return result;
 const calibrated = metresPerImageHeight !== undefined && Number.isFinite(metresPerImageHeight) && metresPerImageHeight > 0;
 const gap = calibrated ? 0 : drawingGap;
 const constraints: Separation[] = [];
 let scale = 0;
 for (let i = 0; i < items.length; i++) {
  for (let j = i + 1; j < items.length; j++) {
   const horizontal = separation(items[i], items[j], 'x', gap);
   const vertical = separation(items[i], items[j], 'y', gap);
   const edge = horizontal.requiredScale <= vertical.requiredScale ? horizontal : vertical;
   constraints.push(edge);
   if (Number.isFinite(edge.requiredScale)) scale = Math.max(scale, edge.requiredScale);
  }
 }
 if (calibrated) {
  scale = metresPerImageHeight;
 } else {
  // One misplaced or duplicate pin should not push the rest of a schematic stage kilometres apart.
  const xs = items.map(item => item.pin.x), ys = items.map(item => item.pin.y);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const extent = items.reduce((sum,item) => sum + Math.max(item.box.width,item.box.height) + gap, 0);
  if (span > 0) scale = Math.min(scale, 2 * Math.min(extent,limit) / span);
 }

 const boxes = projectPins(items, constraints, scale, gap);
 const preferred = {x: Math.min(...items.map(item => item.box.x)), y: Math.min(...items.map(item => item.box.y))};
 const origin = placeGroup([...boxes.values()], fixed, preferred, gap);
 if (!origin) return result;
 for (const [id,box] of boxes) result.set(id, {x: origin.x + box.x, y: origin.y + box.y});
 return result;
}
