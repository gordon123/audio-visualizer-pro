import type { ColorStop } from "../types";

export function posterizeChannel(channel: number, levels: number): number {
  if (levels <= 1) return 128;
  const step = 255 / (levels - 1);
  return Math.round(Math.round(channel / step) * step);
}

export function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function parseColor(color: string): { r: number, g: number, b: number } | null {
    if (color.startsWith('#')) {
        return hexToRgb(color);
    }
    if (color.startsWith('rgb')) {
        const result = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(color);
        return result ? {
            r: parseInt(result[1], 10),
            g: parseInt(result[2], 10),
            b: parseInt(result[3], 10)
        } : null;
    }
    return null;
}

export function colorStringToRgba(color: string, alpha: number): string {
    const rgb = parseColor(color);
    if (!rgb) {
        return `rgba(255, 255, 255, ${alpha})`;
    }
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Samples a color from a gradient defined by color stops at a specific position.
 * @param stops Array of color stops, which will be sorted internally.
 * @param position The point along the gradient to sample (0 to 1).
 * @returns An RGB color string, e.g., 'rgb(255,0,0)'.
 */
export function getColorFromStops(stops: ColorStop[], position: number): string {
  if (stops.length === 0) return 'rgb(255,255,255)';
  if (stops.length === 1) return stops[0].color;
  
  const sortedStops = [...stops].sort((a, b) => a.position - b.position);

  // Handle positions outside the defined range
  if (position <= sortedStops[0].position) {
    return sortedStops[0].color;
  }
  if (position >= sortedStops[sortedStops.length - 1].position) {
    return sortedStops[sortedStops.length - 1].color;
  }

  // Find the two stops the position is between
  let startStop = sortedStops[0];
  let endStop = sortedStops[sortedStops.length - 1];

  for (let i = 0; i < sortedStops.length - 1; i++) {
    if (position >= sortedStops[i].position && position <= sortedStops[i+1].position) {
      startStop = sortedStops[i];
      endStop = sortedStops[i+1];
      break;
    }
  }

  const startRgb = hexToRgb(startStop.color);
  const endRgb = hexToRgb(endStop.color);

  if (!startRgb || !endRgb) {
    return 'rgb(255,255,255)'; // Fallback for invalid hex
  }
  
  const range = endStop.position - startStop.position;
  // Avoid division by zero if stops have the same position
  const relativePos = (range === 0) ? 0 : (position - startStop.position) / range;

  const r = Math.round(startRgb.r + (endRgb.r - startRgb.r) * relativePos);
  const g = Math.round(startRgb.g + (endRgb.g - startRgb.g) * relativePos);
  const b = Math.round(startRgb.b + (endRgb.b - startRgb.b) * relativePos);

  return `rgb(${r},${g},${b})`;
}

export function createGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stops: ColorStop[],
  mode: 'amplitude' | 'frequency'
): CanvasGradient {
  let gradient: CanvasGradient;
  if (mode === 'amplitude') {
    // Vertical gradient for amplitude mapping
    gradient = ctx.createLinearGradient(0, height, 0, 0);
  } else {
    // Horizontal gradient for frequency mapping
    gradient = ctx.createLinearGradient(0, 0, width, 0);
  }
  
  // Sort stops by position to ensure correct gradient rendering
  const sortedStops = [...stops].sort((a, b) => a.position - b.position);

  sortedStops.forEach(stop => {
    gradient.addColorStop(stop.position, stop.color);
  });
  
  return gradient;
}