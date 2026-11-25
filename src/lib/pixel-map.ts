import type {Screen} from './project.ts';
import {cabinetPositions} from './mixed-panels.ts';

export type PixelMapFormat = 'png' | 'jpg';

export function pixelMapDimensions(screen: Screen) {
 return {width: screen.cols * screen.panel.resX, height: screen.rows * screen.panel.resY};
}

function drawPixelMap(ctx: CanvasRenderingContext2D, screen: Screen, width: number, height: number) {
 const {resX, resY} = screen.panel;
 const cellSize = Math.min(resX, resY);
 const cabinets = cabinetPositions(screen);
 const grid = cellSize >= 3 ? Math.max(1, Math.round(cellSize / 50)) : 0;

 ctx.fillStyle = '#000';
 ctx.fillRect(0, 0, width, height);
 // The grid also covers empty slots. Paint each wide cabinet over its centre
 // seam, so the test pattern shows only physical cabinet boundaries.
 if (grid) {
  ctx.fillStyle = '#fff';
  for (let x = 0; x < width; x += resX) ctx.fillRect(x, 0, grid, height);
  for (let y = 0; y < height; y += resY) ctx.fillRect(0, y, width, grid);
  ctx.fillRect(width - grid, 0, grid, height);
  ctx.fillRect(0, height - grid, width, grid);
 }
 let previousRow=-1, joinedInRow=0;
 for (const {c,r,span,panel} of cabinets) {
  if (r !== previousRow) joinedInRow=0;
  const x=c*resX, y=r*resY;
  const rightBorder=c+span===screen.cols?grid:0;
  const bottomBorder=r+1===screen.rows?grid:0;
  ctx.fillStyle=(r+c-joinedInRow)%2===0?'#3b06f4':'#bc5928';
  ctx.fillRect(x+grid,y+grid,panel.resX-grid-rightBorder,panel.resY-grid-bottomBorder);
  joinedInRow+=span-1;
  previousRow=r;
 }

 const shortSide = Math.min(width, height);
 if (shortSide < 16) return;
 ctx.strokeStyle = '#fff';
 ctx.lineWidth = Math.max(1, Math.round(cellSize / 100));
 ctx.beginPath();
 ctx.moveTo(0.5, 0.5);
 ctx.lineTo(width - 0.5, height - 0.5);
 ctx.moveTo(width - 0.5, 0.5);
 ctx.lineTo(0.5, height - 0.5);
 ctx.stroke();
 ctx.beginPath();
 ctx.arc(width / 2, height / 2, shortSide / 4, 0, 2 * Math.PI);
 ctx.stroke();

 const fontSize = Math.round(Math.min(72, Math.max(12, cellSize * 0.24), shortSide / 8));
 const padding = Math.max(2, Math.round(fontSize / 4));
 const labelHeight = fontSize + 2 * padding;
 ctx.font = `${fontSize}px Arial, sans-serif`;
 ctx.textBaseline = 'middle';
 function label(text: string, x: number, y: number) {
  ctx.fillStyle = '#161616';
  ctx.fillRect(x, y, Math.ceil(ctx.measureText(text).width) + 2 * padding, labelHeight);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x + padding, y + labelHeight / 2);
 }
 const resolution = `${width} × ${height} px`;
 const resolutionWidth = Math.ceil(ctx.measureText(resolution).width) + 2 * padding;
 if (ctx.measureText('X 0  Y 0').width + 3 * padding <= width) label('X 0  Y 0', padding, padding);
 if (resolutionWidth <= width) label(resolution, Math.floor((width - resolutionWidth) / 2), Math.floor(height / 2) + padding);
}

export async function createPixelMap(screen: Screen, format: PixelMapFormat) {
 const {width, height} = pixelMapDimensions(screen);
 const canvas = document.createElement('canvas');
 canvas.width = width;
 canvas.height = height;
 try {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Nepavyko sukurti pikselių žemėlapio.');
  drawPixelMap(ctx, screen, width, height);
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob>((resolve, reject) => {
   canvas.toBlob(image => {
    if (image?.size && image.type === mime) resolve(image);
    else reject(Error('Nepavyko išsaugoti pikselių žemėlapio pasirinktu formatu.'));
   }, mime, format === 'jpg' ? 1 : undefined);
  });
  const name = screen.name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 90) || 'Ekranas';
  return {blob, filename: `${name}-${width}x${height}.${format}`};
 } finally {
  canvas.width = 0;
  canvas.height = 0;
 }
}
