import {stats, type Screen} from './project.ts';

type Point = {x: number; y: number};
export type CentreGuides = {x: number | null; y: number | null};

export function screenCentreOffset(screen: Screen): Point {
 if (screen.removed.length && screen.removed.length < screen.cols * screen.rows) {
  const active = stats(screen);
  return {
   x: active.left * screen.panel.widthM + active.width / 2,
   y: active.top * screen.panel.heightM + active.height / 2
  };
 }
 return {x: screen.cols * screen.panel.widthM / 2, y: screen.rows * screen.panel.heightM / 2};
}

export function snapScreenPosition(raw: Point, offset: Point, targets: Point[], tolerance: Point, held?: CentreGuides) {
 function snapAxis(axis: keyof Point) {
  const centre = raw[axis] + offset[axis];
  const previous = held?.[axis];
  if (previous != null && Math.abs(previous - centre) <= tolerance[axis] * 1.5) {
   return {coordinate: previous - offset[axis], guide: previous};
  }
  let nearest: number | null = null;
  let shortest = Infinity;
  for (const target of targets) {
   const distance = Math.abs(target[axis] - centre);
   if (distance <= tolerance[axis] && distance < shortest && Math.abs(target[axis] - offset[axis]) <= 1000) {
    nearest = target[axis];
    shortest = distance;
   }
  }
  const grid = Math.max(-1000, Math.min(1000, Math.round(raw[axis] * 10) / 10));
  return {coordinate: nearest === null ? grid : nearest - offset[axis], guide: nearest};
 }
 const x = snapAxis('x');
 const y = snapAxis('y');
 return {x: x.coordinate, y: y.coordinate, guides: {x: x.guide, y: y.guide}};
}
