const SVG_NS = 'http://www.w3.org/2000/svg';
const TL_MARGIN = 40;
const TL_HEIGHT = 250;
const TL_HANDLE_RADIUS = 6;

const SIDE_COLOR_LEFT = '#0000ff';
const SIDE_COLOR_RIGHT = '#ff0000';
const COLOR_IDENTICAL = '#00b400';

const TL_COLORS = { left: SIDE_COLOR_LEFT, right: SIDE_COLOR_RIGHT };

function getSideColor(side) {
  return TL_COLORS[side] || TL_COLORS.left;
}

// Coordinate mapping — shared between timeline editors and charts
function timeToX(time, maxTime, plotWidth) {
  return TL_MARGIN + (time / maxTime) * plotWidth;
}

function brightnessToY(brightness, plotHeight) {
  return TL_MARGIN + (1 - brightness / 100) * plotHeight;
}

function xToTime(x, maxTime, plotWidth) {
  return ((x - TL_MARGIN) / plotWidth) * maxTime;
}

function yToBrightness(y, plotHeight) {
  return (1 - (y - TL_MARGIN) / plotHeight) * 100;
}

// SVG element creation helpers
function createSVGGroup(parent, className) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', className);
  parent.appendChild(g);
  return g;
}

function appendSVGLine(group, x1, y1, x2, y2, stroke, strokeWidth) {
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', stroke);
  line.setAttribute('stroke-width', strokeWidth);
  group.appendChild(line);
  return line;
}

function appendSVGText(group, x, y, text, anchor, fontSize, fill) {
  const el = document.createElementNS(SVG_NS, 'text');
  el.setAttribute('x', x);
  el.setAttribute('y', y);
  el.setAttribute('text-anchor', anchor);
  el.setAttribute('font-size', fontSize);
  el.setAttribute('fill', fill);
  el.textContent = text;
  group.appendChild(el);
  return el;
}

// Shared chart/timeline rendering helpers
function drawFillPolygon(group, points, maxTime, plotWidth, plotHeight, color, fillOpacity) {
  if (points.length < 2) return;

  const polyPoints = [];
  for (const point of points) {
    polyPoints.push(`${timeToX(point.t, maxTime, plotWidth)},${brightnessToY(point.b, plotHeight)}`);
  }
  polyPoints.push(`${timeToX(points[points.length - 1].t, maxTime, plotWidth)},${TL_MARGIN + plotHeight}`);
  polyPoints.push(`${timeToX(points[0].t, maxTime, plotWidth)},${TL_MARGIN + plotHeight}`);

  const polygon = document.createElementNS(SVG_NS, 'polygon');
  polygon.setAttribute('points', polyPoints.join(' '));
  polygon.setAttribute('fill', color);
  polygon.setAttribute('fill-opacity', fillOpacity);
  polygon.setAttribute('stroke', 'none');
  group.appendChild(polygon);
  return polygon;
}

function drawCurvePolyline(group, points, maxTime, plotWidth, plotHeight, color, strokeWidth) {
  if (points.length < 2) return;

  const linePoints = points.map(point =>
    `${timeToX(point.t, maxTime, plotWidth)},${brightnessToY(point.b, plotHeight)}`
  ).join(' ');

  const polyline = document.createElementNS(SVG_NS, 'polyline');
  polyline.setAttribute('points', linePoints);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', color);
  polyline.setAttribute('stroke-width', strokeWidth);
  polyline.setAttribute('stroke-linejoin', 'round');
  group.appendChild(polyline);
  return polyline;
}

function drawHandle(group, point, index, side, seqIndex, maxTime, plotWidth, plotHeight, color) {
  const cx = timeToX(point.t, maxTime, plotWidth);
  const cy = brightnessToY(point.b, plotHeight);

  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', cx);
  circle.setAttribute('cy', cy);
  circle.setAttribute('data-point-index', index);
  circle.setAttribute('data-side', side);
  circle.setAttribute('data-seq-index', seqIndex);

  if (index === 0) {
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', '#999');
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '1');
    circle.classList.add('tl-origin');
  } else {
    circle.setAttribute('r', TL_HANDLE_RADIUS);
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '2');
    circle.classList.add('tl-handle');
  }

  group.appendChild(circle);
  return circle;
}
