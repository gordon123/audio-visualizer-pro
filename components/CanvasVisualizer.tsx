import React, { useRef, useLayoutEffect, forwardRef } from 'react';
import type { VisualizationSettings, StereoAudioData, RecordingSettings, AspectRatio, Resolution, BarsShape } from '../types';
import { createGradient, posterizeChannel, hexToRgb, getColorFromStops, colorStringToRgba } from '../utils/colors';
import { PerlinNoise } from '../utils/noise';

interface CanvasVisualizerProps {
  settings: VisualizationSettings;
  getAudioData: (pulseSettings: any) => StereoAudioData | null;
  isPlaying: boolean;
  isRecording: boolean;
  isRecordingPending: boolean; // New prop for handshake
  onReadyToRecord: () => void; // New prop for handshake
}

type ParticleShape = 'circle' | 'square' | 'triangle';
type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number; shape: ParticleShape; color: string; };
type Leaf = { x: number; y: number; vx: number; vy: number; age: number; maxAge: number; size: number; state: 'growing' | 'falling'; color: string; };
type SilkParticle = { x: number; y: number; z: number; };

// Performance constants
const MAX_CANVAS_WIDTH = 1920; // Cap internal resolution for performance
const FLUID_FLOW_RESOLUTION_SCALE = 0.25; // Render metaballs at 1/4 resolution
const MAX_SILK_Z = 1000;


// --- Helper Pure Functions ---

const getRecordingDimensions = (settings: RecordingSettings): { width: number, height: number } => {
  const height = parseInt(settings.resolution.replace('p', ''));
  const ratioParts = settings.aspectRatio.split(':').map(Number);
  const ratio = ratioParts[0] / ratioParts[1];
  const width = Math.round(height * ratio);
  return { width, height };
};


const applyGlow = (ctx: CanvasRenderingContext2D, settings: VisualizationSettings['glow'], color: string) => {
  if (settings.enabled && settings.shadowBlur > 0) {
    ctx.shadowBlur = settings.shadowBlur;
    ctx.shadowColor = color;
  }
};

const compressMagnitude = (mag: number, compression: VisualizationSettings['compression']): number => {
    const normalizedMag = mag / 255;
    let compressedMag: number;
    switch(compression.mode) {
        case 'log':
            compressedMag = Math.log10(1 + compression.k * normalizedMag) / Math.log10(1 + compression.k);
            break;
        case 'pow':
            compressedMag = Math.pow(normalizedMag, compression.gamma);
            break;
        default:
            compressedMag = normalizedMag;
    }
    return Math.max(0, Math.min(1, compressedMag));
};

// --- Drawing Implementations ---

const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
};

const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
    ctx.beginPath();
    const topCurveHeight = height * 0.3;
    ctx.moveTo(x, y + topCurveHeight);
    ctx.bezierCurveTo(x, y, x - width / 2, y, x - width / 2, y + topCurveHeight);
    ctx.bezierCurveTo(x - width / 2, y + (height + topCurveHeight) / 2, x, y + (height + topCurveHeight) / 2, x, y + height);
    ctx.bezierCurveTo(x, y + (height + topCurveHeight) / 2, x + width / 2, y + (height + topCurveHeight) / 2, x + width / 2, y + topCurveHeight);
    ctx.bezierCurveTo(x + width / 2, y, x, y, x, y + topCurveHeight);
    ctx.closePath();
    ctx.fill();
};

const drawShape = (ctx: CanvasRenderingContext2D, shape: BarsShape, x: number, y: number, size: number) => {
    switch(shape) {
        case 'square':
            ctx.fillRect(x - size / 2, y - size / 2, size, size);
            break;
        case 'star':
            drawStar(ctx, x, y, 5, size / 2, size / 4);
            break;
        case 'heart':
            drawHeart(ctx, x, y - size / 2, size, size);
            break;
        case 'line':
        default:
             // Should be handled by specific line-drawing logic, but this is a fallback.
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
            ctx.fill();
            break;
    }
};

const drawWaveform = (ctx: CanvasRenderingContext2D, data: Float32Array, settings: VisualizationSettings, pulseScale: number, isDual = false) => {
    const { width, height } = ctx.canvas;
    const { style, thickness, amplitude } = settings.waveform;
    const bufferLength = data.length;
    const sliceWidth = width / bufferLength;

    ctx.lineWidth = (isDual ? thickness / 3 : thickness) * pulseScale;
    ctx.beginPath();
    let x = 0;

    if (style === 'ribbon') {
        const halfHeight = height / 2;
        ctx.moveTo(0, halfHeight);
        for (let i = 0; i < bufferLength; i++) {
            const v = data[i] * halfHeight * amplitude;
            ctx.lineTo(x, halfHeight + v);
            x += sliceWidth;
        }
        ctx.lineTo(width, halfHeight);
        ctx.closePath();
        isDual ? ctx.stroke() : ctx.fill();

    } else if (style === 'spline') {
        const step = Math.floor(bufferLength / (width / 5)); // Resample for smoother curve
        const points: {x: number, y: number}[] = [];
        for (let i = 0; i < bufferLength; i+=step) {
            points.push({ x: i * sliceWidth, y: height/2 + data[i] * height/2 * amplitude });
        }
        if(points.length < 2) return;
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        ctx.quadraticCurveTo(points[points.length-1].x, points[points.length-1].y, points[points.length-1].x, points[points.length-1].y);
        ctx.stroke();

    } else { // 'line'
        ctx.moveTo(0, height / 2);
        for (let i = 0; i < bufferLength; i++) {
            const v = data[i] * height/2 * amplitude;
            const y = height/2 + v;
            ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.stroke();
    }
};

const drawBars = (ctx: CanvasRenderingContext2D, mags: number[], settings: VisualizationSettings, pulseScale: number, state: any) => {
    const { width, height } = ctx.canvas;
    const { pattern, shape, mirror, peakHold } = settings.bars;
    const barCount = mags.length;
    const { gradient: gradientMode, stops: colorStops } = settings.color;
    const sortedColorStops = [...colorStops].sort((a, b) => a.position - b.position);

    const centerX = width / 2;
    const centerY = height / 2;

    if (pattern === 'linear') {
        const barWidth = (width / barCount) * 0.8;
        const barSpacing = width / barCount - barWidth;
        const shapeSize = barWidth; // Use bar width as the size for shapes
        let x = 0;
        
        // For linear, the global amplitude gradient works perfectly, so no per-bar logic is needed.
        for (let i = 0; i < barCount; i++) {
            const barHeight = mags[i] * height * pulseScale;
            const peakHeight = state.peakHeights[i] * height * pulseScale;
            
            if (shape === 'line') {
                if (mirror) {
                    const mirroredHeight = barHeight / 2;
                    ctx.fillRect(x, centerY - mirroredHeight, barWidth, mirroredHeight);
                    ctx.fillRect(x, centerY, barWidth, mirroredHeight);
                    if (peakHold) {
                        ctx.fillRect(x, centerY - peakHeight / 2, barWidth, 2);
                        ctx.fillRect(x, centerY + peakHeight / 2 - 2, barWidth, 2);
                    }
                } else {
                    ctx.fillRect(x, height - barHeight, barWidth, barHeight);
                    if (peakHold) ctx.fillRect(x, height - peakHeight, barWidth, 2);
                }
            } else { // Handle shapes for linear pattern
                const numShapes = Math.max(1, Math.floor(barHeight / shapeSize));
                for (let j = 0; j < numShapes; j++) {
                    const yPos = j * shapeSize + shapeSize / 2;
                    if (mirror) {
                        if (yPos < barHeight / 2) {
                             drawShape(ctx, shape, x + barWidth / 2, centerY - yPos, shapeSize * 0.9);
                             drawShape(ctx, shape, x + barWidth / 2, centerY + yPos, shapeSize * 0.9);
                        }
                    } else {
                        drawShape(ctx, shape, x + barWidth / 2, height - yPos, shapeSize * 0.9);
                    }
                }
                 if (peakHold) { // Simplified peak hold for shapes
                    if (mirror) {
                        drawShape(ctx, shape, x + barWidth/2, centerY - peakHeight/2, shapeSize * 0.5);
                        drawShape(ctx, shape, x + barWidth/2, centerY + peakHeight/2, shapeSize * 0.5);
                    } else {
                        drawShape(ctx, shape, x + barWidth/2, height - peakHeight, shapeSize * 0.5);
                    }
                }
            }
            x += barWidth + barSpacing;
        }

    } else if (pattern === 'square') {
        const squareBaseSize = Math.min(width, height) * settings.bars.squareSize;
        const halfSize = squareBaseSize / 2;
        const barLengthMultiplier = Math.min(width, height) * 0.25;
        const barsPerSide = Math.floor(barCount / 4);
        if (barsPerSide <= 0) return; // Avoid division by zero
        const step = squareBaseSize / barsPerSide;
        const shapeSize = step * 0.9;
        
        let barIndex = 0;

        // [side config: startX, startY, dX/bar, dY/bar, rotation in radians]
        const sides = [
            { x: -halfSize, y: -halfSize, dx: step, dy: 0, angle: 0 },         // Top
            { x: halfSize, y: -halfSize, dx: 0, dy: step, angle: Math.PI / 2 }, // Right
            { x: halfSize, y: halfSize, dx: -step, dy: 0, angle: Math.PI },    // Bottom
            { x: -halfSize, y: halfSize, dx: 0, dy: -step, angle: -Math.PI/2 }, // Left
        ];

        ctx.save();
        ctx.translate(centerX, centerY); // Move origin to canvas center

        sides.forEach((side) => {
            for (let i = 0; i < barsPerSide; i++) {
                if (barIndex >= barCount) break;
                
                const mag = mags[barIndex] * barLengthMultiplier * pulseScale;
                const peakMag = state.peakHeights[barIndex] * barLengthMultiplier * pulseScale;
                
                const currentX = side.x + i * side.dx + side.dx * 0.5; // Center bar on step
                const currentY = side.y + i * side.dy + side.dy * 0.5;

                ctx.save();
                ctx.translate(currentX, currentY);
                ctx.rotate(side.angle);

                // Per-bar gradient/color logic for non-linear patterns
                if (gradientMode === 'amplitude') {
                    const grad = ctx.createLinearGradient(0, 0, 0, -barLengthMultiplier);
                    sortedColorStops.forEach(s => grad.addColorStop(s.position, s.color));
                    ctx.strokeStyle = grad;
                    ctx.fillStyle = grad;
                } else if (gradientMode === 'frequency') {
                    const color = getColorFromStops(sortedColorStops, barIndex / barCount);
                    ctx.strokeStyle = color;
                    ctx.fillStyle = color;
                }

                if (shape === 'line') {
                    ctx.lineWidth = shapeSize;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, -mag); // Draw outwards
                    ctx.stroke();
                    if (peakHold) {
                        ctx.fillRect(-shapeSize / 2, -peakMag - 2, shapeSize, 2); // Outwards peak
                    }
                } else { // Shapes
                    const numShapes = Math.max(1, Math.floor(mag / shapeSize));
                    for (let j = 0; j < numShapes; j++) {
                        // The shape is drawn from its center. We offset it along the bar's direction.
                        drawShape(ctx, shape, 0, -(j * shapeSize + shapeSize / 2), shapeSize); // Draw outwards
                    }
                    if (peakHold) {
                        drawShape(ctx, shape, 0, -peakMag, shapeSize * 0.5); // Outwards peak
                    }
                }
                
                ctx.restore();
                barIndex++;
            }
        });

        ctx.restore();

    } else { // Radial patterns: circular, spiral
        const maxRadius = Math.min(width, height) / 2 * 0.9;
        const innerRadius = settings.radial.innerRadius;
        if (pattern === 'spiral') state.spiralAngle += settings.radial.rotationSpeed * 0.005;
        
        const baseShapeSize = ((2 * Math.PI * Math.max(50, innerRadius)) / barCount) * 0.7;

        for (let i = 0; i < barCount; i++) {
            const angle = (i / barCount) * 2 * Math.PI + (pattern === 'spiral' ? state.spiralAngle : 0);
            const barLength = mags[i] * (maxRadius - innerRadius) * pulseScale;
            const rOffset = pattern === 'spiral' ? (i / barCount) * (maxRadius - innerRadius) * 0.2 : 0;
            
            ctx.save(); // Isolate state changes for each bar
            
            // Per-bar gradient/color logic for non-linear patterns
            if (gradientMode === 'amplitude') {
                const startX = centerX + Math.cos(angle) * (innerRadius + rOffset);
                const startY = centerY + Math.sin(angle) * (innerRadius + rOffset);
                const endX = centerX + Math.cos(angle) * (innerRadius + rOffset + (maxRadius - innerRadius));
                const endY = centerY + Math.sin(angle) * (innerRadius + rOffset + (maxRadius - innerRadius));
                const grad = ctx.createLinearGradient(startX, startY, endX, endY);
                sortedColorStops.forEach(s => grad.addColorStop(s.position, s.color));
                ctx.strokeStyle = grad;
                ctx.fillStyle = grad;
            } else if (gradientMode === 'frequency') {
                const color = getColorFromStops(sortedColorStops, i / barCount);
                ctx.strokeStyle = color;
                ctx.fillStyle = color;
            }

            if (shape === 'line') {
                ctx.lineWidth = baseShapeSize;
                const startX = centerX + Math.cos(angle) * (innerRadius + rOffset);
                const startY = centerY + Math.sin(angle) * (innerRadius + rOffset);
                const endX = centerX + Math.cos(angle) * (innerRadius + rOffset + barLength);
                const endY = centerY + Math.sin(angle) * (innerRadius + rOffset + barLength);
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            } else { // Handle shapes for radial patterns
                 const numShapes = Math.max(1, Math.floor(barLength / baseShapeSize));
                 for (let j=0; j < numShapes; j++) {
                     const r = innerRadius + rOffset + j * baseShapeSize + baseShapeSize / 2;
                     const posX = centerX + Math.cos(angle) * r;
                     const posY = centerY + Math.sin(angle) * r;
                     
                     ctx.save();
                     ctx.translate(posX, posY);
                     ctx.rotate(angle + Math.PI / 2); // Orient shapes outwards
                     drawShape(ctx, shape, 0, 0, baseShapeSize * 0.9);
                     ctx.restore();
                 }
            }

            // --- Draw peak hold element (universal for all radial) ---
            if (peakHold) {
                const peakL = state.peakHeights[i] * (maxRadius - innerRadius) * pulseScale;
                const peakRadius = innerRadius + rOffset + peakL;
                const peakX = centerX + Math.cos(angle) * peakRadius;
                const peakY = centerY + Math.sin(angle) * peakRadius;
                const peakDotSize = (shape === 'line') ? ctx.lineWidth / 2 : 3;
                
                ctx.beginPath();
                ctx.arc(peakX, peakY, peakDotSize, 0, 2 * Math.PI);
                ctx.fill();
            }

            ctx.restore(); // Restore to global context state for the next bar
        }
    }
};

const drawLissajous = (ctx: CanvasRenderingContext2D, dataL: Float32Array, dataR: Float32Array, settings: VisualizationSettings) => {
    const { width, height } = ctx.canvas;
    const bufferLength = Math.min(dataL.length, dataR.length);
    ctx.lineWidth = settings.waveform.thickness / 2;
    ctx.beginPath();
    for(let i=0; i < bufferLength; i++) {
        const x = width/2 + dataL[i] * width/2;
        const y = height/2 + dataR[i] * height/2;
        if (i === 0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
    }
    ctx.stroke();
};

const drawParticleBurst = (ctx: CanvasRenderingContext2D, audioData: StereoAudioData, settings: VisualizationSettings, state: any, mainFill: string | CanvasGradient) => {
    const { width, height } = ctx.canvas;
    const { count, decay, bassEnabled, midEnabled, highEnabled, bassThreshold, midThreshold, highThreshold } = settings.particleBurst;
    const { frequencyData } = audioData;
    
    // Define frequency ranges based on musical instrument fundamentals.
    // The Web Audio API provides frequency data linearly, so we define index ranges.
    // Assuming 44.1kHz sample rate and 4096 FFT size, each bin is ~10.77Hz.
    const bassRange = [2, 24];      // ~20Hz - 250Hz (Kick, Bass)
    const midRange = [30, 200];     // ~320Hz - 2.1kHz (Vocals, Guitar)
    const highRange = [500, 1500];  // ~5.4kHz - 16.1kHz (Cymbals, Hi-hats)

    const getAverage = (data: Uint8Array, start: number, end: number): number => {
        if (start >= end || start >= data.length) return 0;
        const realEnd = Math.min(end, data.length);
        let sum = 0;
        for (let i = start; i < realEnd; i++) {
            sum += data[i];
        }
        return sum / (realEnd - start);
    };

    const bassAvg = getAverage(frequencyData, bassRange[0], bassRange[1]);
    const midAvg = getAverage(frequencyData, midRange[0], midRange[1]);
    const highAvg = getAverage(frequencyData, highRange[0], highRange[1]);
    
    const spawnParticles = (num: number, shape: ParticleShape, color?: string) => {
      for(let i=0; i < num; i++) {
          if (state.particles.length >= count) return;
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 5 + 2;
          state.particles.push({
              x: width/2, y: height/2,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1.0,
              size: Math.random() * 5 + 3,
              shape,
              color: color || `hsl(${Math.random() * 360}, 100%, 60%)`
          });
      }
    }

    if (bassEnabled && bassAvg > bassThreshold) spawnParticles(3, 'square');
    if (midEnabled && midAvg > midThreshold) spawnParticles(2, 'circle', 'main');
    if (highEnabled && highAvg > highThreshold) spawnParticles(1, 'triangle', 'main');

    
    ctx.globalCompositeOperation = 'lighter';
    // Update and draw particles
    state.particles.forEach((p: Particle) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02; // gravity
        p.life *= decay;
        
        if(p.life > 0.01) {
            ctx.beginPath();
            ctx.fillStyle = p.color === 'main' ? mainFill : p.color;
            ctx.globalAlpha = p.life;
            const size = p.size * p.life;
            switch(p.shape) {
                case 'circle':
                    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                    break;
                case 'square':
                    ctx.rect(p.x - size, p.y - size, size * 2, size * 2);
                    break;
                case 'triangle':
                    ctx.moveTo(p.x, p.y - size);
                    ctx.lineTo(p.x + size, p.y + size);
                    ctx.lineTo(p.x - size, p.y + size);
                    ctx.closePath();
                    break;
            }
            ctx.fill();
        }
    });

    // Efficiently remove dead particles
    state.particles = state.particles.filter((p: Particle) => p.life > 0.01);
    
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
};

const drawWaveGrid = (ctx: CanvasRenderingContext2D, mags: number[], settings: VisualizationSettings, pulseScale: number) => {
    const { width, height } = ctx.canvas;
    const { density, scale } = settings.waveGrid;
    const rows = density;
    const cols = Math.floor(density * (width/height));
    
    ctx.lineWidth = 1.5 * pulseScale;
    for (let i = 0; i < rows; i++) {
        ctx.beginPath();
        const y = (i/rows) * height;
        ctx.moveTo(0, y);
        for(let j=0; j < cols; j++) {
            const x = (j/cols) * width;
            const magIndex = Math.floor((j/cols) * mags.length);
            const displacement = mags[magIndex] * 50 * scale * pulseScale;
            ctx.lineTo(x, y - displacement);
        }
        ctx.stroke();
    }
};

const drawAudioTunnel = (ctx: CanvasRenderingContext2D, mags: number[], settings: VisualizationSettings, state: any, pulseScale: number, audioData: StereoAudioData) => {
    const { width, height } = ctx.canvas;
    const { depth, speed } = settings.audioTunnel;
    const centerX = width/2;
    const centerY = height/2;
    const maxRadius = Math.min(width, height) * 0.7;
    
    if (state.tunnelRings.length !== depth) {
        state.tunnelRings = Array.from({length: depth}, (_, i) => ({
            z: i / depth, // 0 (far) to 1 (near)
        }));
    }
    
    ctx.lineWidth = 2 * pulseScale;
    state.tunnelRings.forEach((ring: { z: number }) => {
        ring.z += 0.001 * speed;
        if (ring.z > 1) ring.z -= 1;

        const radius = ring.z * maxRadius;
        const points = settings.bands;
        const bandWidth = Math.floor(mags.length/points);
        
        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
            const index = i % points;
            const mag = mags[index * bandWidth] || 0;
            const angle = (i/points) * Math.PI * 2;
            const r = radius + mag * 100 * pulseScale * (0.5 + audioData.onsetEnvelope*0.5);
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x,y);
            else ctx.lineTo(x,y);
        }
        ctx.globalAlpha = ring.z;
        ctx.stroke();
    });
    ctx.globalAlpha = 1.0;
};

const drawFractalBloom = (ctx: CanvasRenderingContext2D, mags: number[], settings: VisualizationSettings, state: { leaves: Leaf[] }, pulseScale: number, audioData: StereoAudioData) => {
    const { width, height } = ctx.canvas;
    const { depth, angle, leafSize } = settings.fractalBloom;
    const { onsetEnvelope } = audioData;

    const soilLevel = height / 2;
    const avgMag = mags.reduce((a, b) => a + b, 0) / mags.length;
    const baseLength = (avgMag * height * 0.15 + onsetEnvelope * height * 0.05) * pulseScale;
    
    // --- 1. Draw Ground ---
    ctx.save();
    ctx.strokeStyle = '#966F33'; // Wood brown
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, soilLevel);
    ctx.lineTo(width, soilLevel);
    ctx.stroke();
    ctx.restore();

    // --- 2. Update and Draw Leaves ---
    const updatedLeaves: Leaf[] = [];
    state.leaves.forEach((leaf: Leaf) => {
        let keep = true;

        if (leaf.state === 'falling') {
            leaf.y += leaf.vy;
            leaf.x += leaf.vx;
            leaf.vy += 0.05; // gravity
            if (leaf.y > soilLevel) {
                keep = false; // Leaf touched the ground
            }
        } else { // 'growing'
            leaf.age++;
            const lifeRatio = leaf.age / leaf.maxAge;
            
            if (lifeRatio < 0.6) { // Green -> Yellow
                const hue = 120 - 60 * (lifeRatio / 0.6);
                leaf.color = `hsl(${hue}, 80%, 50%)`;
            } else { // Yellow -> Brown
                const brownRatio = (lifeRatio - 0.6) / 0.4;
                const hue = 60 - 30 * brownRatio;
                const saturation = 80 - 20 * brownRatio;
                const lightness = 50 - 20 * brownRatio;
                leaf.color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            }

            if (leaf.age > leaf.maxAge) {
                leaf.state = 'falling';
            }
        }

        if (keep) {
            ctx.fillStyle = leaf.color;
            ctx.beginPath();
            ctx.arc(leaf.x, leaf.y, leaf.size * pulseScale, 0, Math.PI * 2);
            ctx.fill();
            updatedLeaves.push(leaf);
        }
    });
    state.leaves = updatedLeaves;

    // --- 3. Draw Tree and Spawn New Leaves ---
    const drawBranch = (x: number, y: number, len: number, ang: number, d: number) => {
        if (d === 0 || len < 1) return;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        const newX = x + len * Math.cos(ang * Math.PI / 180);
        const newY = y + len * Math.sin(ang * Math.PI / 180);
        ctx.lineTo(newX, newY);
        ctx.stroke();

        if (d <= 2 && state.leaves.length < 250) { // Spawn leaves on the last two levels of branches
            const spawnChance = Math.random();
            const spawnThreshold = 0.97 - avgMag * 0.5; // Higher audio makes it easier to spawn
            if (spawnChance > spawnThreshold) {
                state.leaves.push({
                    x: newX, y: newY,
                    vx: (Math.random() - 0.5) * 0.3, // gentle wind
                    vy: 0.1,
                    age: 0,
                    maxAge: 200 + Math.random() * 200, // 3-6 seconds at 60fps
                    size: Math.random() * (leafSize / 2) + leafSize / 2,
                    state: 'growing',
                    color: 'hsl(120, 80%, 50%)', // Start green
                });
            }
        }

        const bandIndex = Math.min(mags.length - 1, Math.floor((d / depth) * mags.length));
        const mag = mags[bandIndex];
        const lengthMultiplier = 0.6 + mag * 0.4 + onsetEnvelope * 0.2;

        drawBranch(newX, newY, len * lengthMultiplier, ang - angle, d - 1);
        drawBranch(newX, newY, len * lengthMultiplier, ang + angle, d - 1);
    };

    ctx.lineWidth = 1;
    drawBranch(width / 2, soilLevel, baseLength, -90, depth);
};

const drawTextReactive = (ctx: CanvasRenderingContext2D, audioData: StereoAudioData, settings: VisualizationSettings) => {
    if (!settings.typography.text) return;
    const { width, height } = ctx.canvas;
    const { onsetEnvelope } = audioData;
    const scale = 1 + onsetEnvelope * 0.2;
    const blur = onsetEnvelope * 5;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = Math.min(width, height) / 10;
    ctx.font = `bold ${fontSize}px sans-serif`;

    const metrics = ctx.measureText(settings.typography.text);
    const textWidth = metrics.width;
    const textHeight = fontSize; // Approximation for vertical gradient

    // Move origin to the center of the canvas BEFORE creating the gradient
    ctx.translate(width / 2, height / 2);

    // Create a new gradient sized specifically to the text
    const { stops, gradient: gradientMode } = settings.color;
    let textFillStyle: string | CanvasGradient;

    if (gradientMode === 'none' || stops.length < 1) {
        textFillStyle = stops[0]?.color || '#FFFFFF';
    } else {
        let gradient: CanvasGradient;
        if (gradientMode === 'amplitude') {
            // Vertical gradient from bottom to top of the text
            gradient = ctx.createLinearGradient(0, textHeight / 2, 0, -textHeight / 2);
        } else { // 'frequency'
            // Horizontal gradient from left to right of the text
            gradient = ctx.createLinearGradient(-textWidth / 2, 0, textWidth / 2, 0);
        }
        
        const sortedStops = [...stops].sort((a, b) => a.position - b.position);
        sortedStops.forEach(stop => {
            gradient.addColorStop(stop.position, stop.color);
        });
        textFillStyle = gradient;
    }
    
    ctx.fillStyle = textFillStyle;
    
    if (settings.glow.enabled) {
        ctx.shadowBlur = settings.glow.shadowBlur + onsetEnvelope * 15;
        // Use a solid color for the shadow as gradients are not supported
        ctx.shadowColor = stops[0]?.color || '#FFFFFF';
    }

    ctx.filter = `blur(${blur}px)`;
    
    // The translation is done, now scale and draw at the new origin (0,0)
    ctx.scale(scale, scale);
    ctx.fillText(settings.typography.text, 0, 0);
    ctx.restore();
};

const drawKaleidoscope = (ctx: CanvasRenderingContext2D, offscreen: HTMLCanvasElement, mags: number[], settings: VisualizationSettings, state: any, pulseScale: number, onset: number) => {
    const { width, height } = ctx.canvas;
    const { segments, rotationSpeed, waveHeight } = settings.kaleidoscope;
    const offscreenCtx = offscreen.getContext('2d');
    if (!offscreenCtx) return;

    // --- Render the base pattern to the offscreen canvas ---
    offscreenCtx.clearRect(0, 0, width, height);

    // Color each bar based on its frequency, creating a gradient along the wave
    const sortedStops = [...settings.color.stops].sort((a, b) => a.position - b.position);
    const barWidth = width / mags.length;

    for (let i = 0; i < mags.length; i++) {
        offscreenCtx.fillStyle = getColorFromStops(sortedStops, i / mags.length);
        const h = mags[i] * (height / 2) * waveHeight * pulseScale;
        offscreenCtx.fillRect(i * barWidth, height / 2 - h, barWidth, h * 2);
    }
    
    // --- Composite the pattern onto the main canvas ---
    state.kaleidoscopeAngle += rotationSpeed * 0.01;
    const sliceAngle = (Math.PI * 2) / segments;
    const zoom = 1 + onset * 0.2;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.rotate(state.kaleidoscopeAngle);
    
    for (let i = 0; i < segments; i++) {
        ctx.rotate(sliceAngle);
        ctx.save();
        // Use 'screen' for a less blown-out additive effect compared to 'lighter'
        ctx.globalCompositeOperation = 'screen'; 
        if (i % 2 === 1) { // Mirror every other slice for a true kaleidoscope effect
            ctx.scale(1, -1);
        }
        ctx.drawImage(offscreen, -width / 2, -height / 2);
        ctx.restore();
    }
    ctx.restore();
};


const drawFluidFlow = (ctx: CanvasRenderingContext2D, offscreen: HTMLCanvasElement, mags: number[], settings: VisualizationSettings, mainFill: string | CanvasGradient) => {
    const { width: mainWidth, height: mainHeight } = ctx.canvas;
    const { width: offscreenW, height: offscreenH } = offscreen;
    const { viscosity, threshold } = settings.fluidFlow;
    const offscreenCtx = offscreen.getContext('2d');
    if (!offscreenCtx) return;

    // 1. Draw blurred white blobs on the smaller offscreen canvas to create the mask
    offscreenCtx.clearRect(0,0,offscreenW,offscreenH);
    offscreenCtx.fillStyle = 'white';
    offscreenCtx.filter = `blur(${viscosity * FLUID_FLOW_RESOLUTION_SCALE}px)`;
    const barCount = mags.length;
    const barWidth = offscreenW/barCount;
    for(let i=0; i<barCount; i++) {
        const h = mags[i] * offscreenH * 1.2;
        offscreenCtx.beginPath();
        offscreenCtx.arc(i*barWidth + barWidth/2, offscreenH - h, h/3, 0, Math.PI * 2);
        offscreenCtx.fill();
    }
    offscreenCtx.filter = 'none'; // Reset filter
    
    // 2. Apply threshold to sharpen the mask
    const imageData = offscreenCtx.getImageData(0,0,offscreenW,offscreenH);
    const data = imageData.data;
    for(let i=0; i<data.length; i+=4) {
        data[i+3] = data[i] > threshold ? 255 : 0; // Use alpha channel for mask
    }
    offscreenCtx.putImageData(imageData, 0, 0);

    // 3. Fill the main canvas with the desired color/gradient
    ctx.fillStyle = mainFill;
    ctx.fillRect(0, 0, mainWidth, mainHeight);
    
    // 4. Use the mask to clip the filled canvas
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(offscreen, 0, 0, mainWidth, mainHeight);

    // 5. Reset composite operation for subsequent draws
    ctx.globalCompositeOperation = 'source-over';
};

const drawSilkFlow = (ctx: CanvasRenderingContext2D, mags: number[], settings: VisualizationSettings, state: any, audioData: StereoAudioData) => {
    const { width, height } = ctx.canvas;
    const { numLines, lineWidth, speed, noiseScale, fov } = settings.silkFlow;
    const { stops: colorStops, gradient: gradientMode } = settings.color;
    
    // Setup gradient or solid color for the entire effect
    const sortedColorStops = [...colorStops].sort((a, b) => a.position - b.position);
    if (gradientMode !== 'none' && sortedColorStops.length > 1) {
        let gradient: CanvasGradient;
        if (gradientMode === 'amplitude') {
            // A more centered vertical gradient
            gradient = ctx.createLinearGradient(0, height * 0.2, 0, height * 0.8); 
        } else { // 'frequency' mode
            gradient = ctx.createLinearGradient(0, 0, width, 0);
        }
        sortedColorStops.forEach(stop => {
            gradient.addColorStop(stop.position, stop.color);
        });
        ctx.strokeStyle = gradient;
    } else {
        ctx.strokeStyle = sortedColorStops[0]?.color || '#FFFFFF';
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const avgMag = mags.reduce((a, b) => a + b, 0) / mags.length;
    const { onsetEnvelope } = audioData;

    // Update and draw lines
    for (let i = 0; i < state.silkLines.length; i++) {
        const line = state.silkLines[i] as SilkParticle[];
        
        // Add a new particle at the "back" on a horizontal line, respecting perspective
        const worldWidthAtBack = (width * (fov + MAX_SILK_Z)) / fov;
        const horizontalSpread = worldWidthAtBack * 0.8;

        // Each line gets a fixed horizontal slot.
        const lineX = numLines > 1 ? (i / (numLines - 1) - 0.5) * horizontalSpread : 0;

        line.push({
            x: lineX + (Math.random() - 0.5) * (horizontalSpread / numLines),
            y: 0, // Spawn particles on the center horizontal axis
            z: MAX_SILK_Z
        });

        ctx.beginPath();
        let isFirstPoint = true;

        for (let j = line.length - 1; j >= 0; j--) {
            const p = line[j];
            
            // Update position with audio reactivity
            const forwardSpeed = speed + onsetEnvelope * speed * 2;
            const swayMagnitude = 2 + avgMag * 10;
            // Evolve noise pattern over Z-axis to create a "tunneling" flow effect
            const noiseAngle = state.noise.noise(p.x * noiseScale, p.y * noiseScale + p.z * 0.0005) * Math.PI * 4;

            p.x += Math.cos(noiseAngle) * swayMagnitude;
            p.y += Math.sin(noiseAngle) * swayMagnitude;
            p.z -= forwardSpeed;

            // Cull if behind camera to avoid division by zero or weird projection
            if (p.z <= -fov) continue;

            // Perspective projection
            const scale = fov / (fov + p.z);
            
            // --- Soft Boundary Logic ---
            // Check projected screen coordinates against an 80% canvas area
            const screenX_check = p.x * scale + centerX;
            const screenY_check = p.y * scale + centerY;
            
            const marginX = width * 0.1;
            const marginY = height * 0.1;
            const boundaryStrength = 0.1; // How strongly it pushes back

            // If a particle is outside the margin, apply a corrective force to its world position.
            // The force is proportional to the error and is scaled back from screen space to world space.
            if (screenX_check < marginX) {
                const error = marginX - screenX_check;
                p.x += (error * boundaryStrength) / scale;
            } else if (screenX_check > width - marginX) {
                const error = (width - marginX) - screenX_check;
                p.x += (error * boundaryStrength) / scale;
            }
            
            if (screenY_check < marginY) {
                const error = marginY - screenY_check;
                p.y += (error * boundaryStrength) / scale;
            } else if (screenY_check > height - marginY) {
                const error = (height - marginY) - screenY_check;
                p.y += (error * boundaryStrength) / scale;
            }
            
            // Final projection for drawing after potential correction
            const screenX = p.x * scale + centerX;
            const screenY = p.y * scale + centerY;
            
            if (isFirstPoint) {
                ctx.moveTo(screenX, screenY);
                isFirstPoint = false;
            } else {
                ctx.lineTo(screenX, screenY);
            }
        }

        // Remove particles that are too close
        state.silkLines[i] = line.filter((p: SilkParticle) => p.z > 0);

        if (line.length > 1) {
            const alpha = Math.min(1, (1 - line[0].z / MAX_SILK_Z) * 2);
            ctx.globalAlpha = alpha;
            // The strokeStyle is now set globally with the gradient
            const p_first = line[line.length - 1];
            const first_scale = fov / (fov + p_first.z);
            ctx.lineWidth = Math.max(0.1, lineWidth * first_scale);
            ctx.stroke();
        }
    }
     ctx.globalAlpha = 1;
};

const drawSpectrogramTunnel = (ctx: CanvasRenderingContext2D, mags: number[], settings: VisualizationSettings, state: any) => {
    const { width, height } = ctx.canvas;
    const { style, historyDepth, scrollSpeed, fov, verticalOffset, direction, cameraHeight } = settings.spectrogramTunnel;
    const { stops: colorStops } = settings.color;
    const sortedColorStops = [...colorStops].sort((a, b) => a.position - b.position);
    
    state.spectrogramHistory.unshift([...mags]);
    while (state.spectrogramHistory.length > historyDepth) {
        state.spectrogramHistory.pop();
    }
    
    const history = state.spectrogramHistory;
    if (history.length < 2) return;

    const centerX = width / 2;
    const centerY = height * verticalOffset;
    const numBands = mags.length;
    const zSpacing = 5 * scrollSpeed;

    const project = (x_percent: number, y_percent: number, z_index: number): { x: number, y: number, scale: number } => {
        const worldX = (x_percent - 0.5) * width * 1.5;
        const worldY = y_percent * height * 0.7;
        const effective_z_index = direction === 'out' ? (history.length - 1 - z_index) : z_index;
        const worldZ = effective_z_index * zSpacing;
        const scale = fov / (fov + worldZ);
        const screenX = worldX * scale + centerX;
        const birdEyeOffset = (effective_z_index / history.length) * height * cameraHeight;
        const screenY = centerY - worldY * scale - birdEyeOffset;
        return { x: screenX, y: screenY, scale };
    };

    if (style === 'surface') {
        // Draw from front to back for correct layering
        for (let j = history.length - 2; j >= 0; j--) {
            const currentSlice = history[j];
            const nextSlice = history[j+1];

            for (let i = 0; i < numBands - 1; i++) {
                const baseColor = getColorFromStops(sortedColorStops, i / (numBands - 1));

                const p1 = project(i / numBands, currentSlice[i], j);
                const p2 = project((i + 1) / numBands, currentSlice[i + 1], j);
                const p3 = project((i + 1) / numBands, nextSlice[i + 1], j + 1);
                const p4 = project(i / numBands, nextSlice[i], j + 1);
                
                const p1_base = project(i / numBands, 0, j);
                const p2_base = project((i + 1) / numBands, 0, j);
                const p3_base = project((i + 1) / numBands, 0, j + 1);
                const p4_base = project(i / numBands, 0, j + 1);

                if (p1.scale < 0 || p3.scale < 0) continue;

                // 1. Draw transparent floor
                ctx.fillStyle = colorStringToRgba(baseColor, 0.2);
                ctx.beginPath();
                ctx.moveTo(p1_base.x, p1_base.y);
                ctx.lineTo(p2_base.x, p2_base.y);
                ctx.lineTo(p3_base.x, p3_base.y);
                ctx.lineTo(p4_base.x, p4_base.y);
                ctx.closePath();
                ctx.fill();
                
                // 2. Draw opaque peak surface
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.lineTo(p4.x, p4.y);
                ctx.closePath();
                ctx.fill();
            }
        }
    } else { // 'bars' style
        ctx.lineWidth = 2;
        // Draw from front to back
        for (let j = history.length - 1; j >= 0; j--) {
            const slice = history[j];
            for (let i = 0; i < numBands; i++) {
                const mag = slice[i];
                if (mag <= 0.01) continue;

                const p_top = project(i / numBands, mag, j);
                const p_bottom = project(i / numBands, 0, j);

                if (p_top.scale < 0) continue;

                const baseColor = getColorFromStops(sortedColorStops, i / (numBands - 1));
                
                const grad = ctx.createLinearGradient(p_bottom.x, p_bottom.y, p_top.x, p_top.y);
                grad.addColorStop(0, baseColor);
                grad.addColorStop(1, colorStringToRgba(baseColor, 0));

                ctx.strokeStyle = grad;
                ctx.lineWidth = Math.max(0.5, 3 * p_top.scale);

                ctx.beginPath();
                ctx.moveTo(p_bottom.x, p_bottom.y);
                ctx.lineTo(p_top.x, p_top.y);
                ctx.stroke();
            }
        }
    }
};


// --- Component ---

const CanvasVisualizer = forwardRef<HTMLCanvasElement, CanvasVisualizerProps>(({ settings, getAudioData, isPlaying, isRecording, isRecordingPending, onReadyToRecord }, ref) => {
  const state = useRef({
    barMags: [] as number[],
    barVelocities: [] as number[],
    peakHeights: [] as number[],
    glitchFrames: 0,
    spiralAngle: 0,
    kaleidoscopeAngle: 0,
    smoothedTimeDomain: null as Float32Array | null,
    logoImage: null as HTMLImageElement | null,
    particles: [] as Particle[],
    leaves: [] as Leaf[],
    tunnelRings: [] as {z: number}[],
    silkLines: [] as SilkParticle[][],
    noise: new PerlinNoise(),
    gradientCache: { gradient: null as CanvasGradient | null, key: '' },
    spectrogramHistory: [] as number[][],
  }).current;
  
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load logo image
  useLayoutEffect(() => {
    if (settings.overlay.logoUrl) {
      const img = new Image();
      img.onload = () => state.logoImage = img;
      img.src = settings.overlay.logoUrl;
    } else {
      state.logoImage = null;
    }
  }, [settings.overlay.logoUrl, state]);

  useLayoutEffect(() => {
    const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
    }
    const offscreenCanvas = offscreenCanvasRef.current;

    // --- THE DEFINITIVE FIX FOR THE "BLANK CANVAS" BUG ---
    // The resize logic is re-architected to be robust against race conditions.
    const handleResize = (entries?: ResizeObserverEntry[]) => {
      const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
      if (!canvas) return;

      if (isRecording || isRecordingPending) {
        // Recording uses fixed dimensions from settings, not the observer.
        const dims = getRecordingDimensions(settings.recording);
        canvas.width = dims.width;
        canvas.height = dims.height;
      } else {
        // Live preview uses the observer data, which is guaranteed to be stable.
        let containerWidth: number;
        let containerHeight: number;

        if (entries && entries[0]) {
          // Use the reliable size from the ResizeObserverEntry.
          const contentRect = entries[0].contentRect;
          containerWidth = contentRect.width;
          containerHeight = contentRect.height;
        } else {
          // Fallback for initial render before observer fires.
          const rect = canvas.parentElement?.getBoundingClientRect();
          containerWidth = rect?.width ?? 300;
          containerHeight = rect?.height ?? 150;
        }
        
        // Safeguard against resizing to zero, which makes the canvas unusable.
        if (containerWidth === 0 || containerHeight === 0) return;

        const dpr = window.devicePixelRatio || 1;
        let newWidth = containerWidth * dpr;
        let newHeight = containerHeight * dpr;

        if (newWidth > MAX_CANVAS_WIDTH) {
            const ratio = MAX_CANVAS_WIDTH / newWidth;
            newWidth = MAX_CANVAS_WIDTH;
            newHeight *= ratio;
        }
        
        canvas.width = Math.round(newWidth);
        canvas.height = Math.round(newHeight);
      }
      
      // Resize offscreen canvas to match
      offscreenCanvas.width = canvas.width;
      offscreenCanvas.height = canvas.height;
      
      if(settings.mode === 'fluid_flow') {
        offscreenCanvas.width = canvas.width * FLUID_FLOW_RESOLUTION_SCALE;
        offscreenCanvas.height = canvas.height * FLUID_FLOW_RESOLUTION_SCALE;
      }
    };

    handleResize(); // Initial resize
    
    const resizeObserver = new ResizeObserver(handleResize);
    const parentElement = canvas.parentElement;
    if (parentElement && !isRecording && !isRecordingPending) {
      resizeObserver.observe(parentElement);
    }
    
    // Initialize arrays
    if (state.barMags.length !== settings.bands) {
        state.barMags = new Array(settings.bands).fill(0);
        state.barVelocities = new Array(settings.bands).fill(0);
        state.peakHeights = new Array(settings.bands).fill(0);
        state.spectrogramHistory = [];
    }

    if (settings.mode === 'silk_flow' && state.silkLines.length !== settings.silkFlow.numLines) {
        state.silkLines = Array.from({ length: settings.silkFlow.numLines }, () => []);
    }
    
    let animationFrameId: number;
    const renderLoop = () => {
      animationFrameId = requestAnimationFrame(renderLoop);
      
      // Handshake for recording: signal readiness on the first painted frame after pending.
      if (isRecordingPending) {
        onReadyToRecord();
      }
      
      const audioData = getAudioData(settings.pulse);
      if (!audioData) return;
      
      const { width, height } = canvas;
      const pulseScale = settings.pulse.enabled ? (settings.pulse.scaleMin + (audioData.onsetEnvelope * (settings.pulse.scaleMax - settings.pulse.scaleMin))) : 1;
      
      // --- Clear and Setup ---
      ctx.save();
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;

      // After-image trails
      if (settings.trailsOpacity > 0 && isPlaying) {
        ctx.fillStyle = `rgba(0, 0, 0, ${settings.trailsOpacity})`;
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.fillStyle = settings.color.backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }
      
      // --- Glitch Effect ---
      if (settings.glitch.enabled && audioData.isBeat) state.glitchFrames = 3;
      if (state.glitchFrames > 0) {
          const intensity = settings.glitch.intensity;
          const y = Math.random() * height;
          const h = Math.random() * 50 + 10;
          const xOffset = (Math.random() - 0.5) * intensity * 2;
          ctx.drawImage(canvas, 0, y, width, h, xOffset, y, width, h);
          state.glitchFrames--;
      }

      // --- Style Setup ---
      let primaryColor = settings.color.stops[0]?.color || '#FFFFFF';
      if (settings.posterize.enabled) {
          const rgb = hexToRgb(primaryColor);
          if (rgb) {
              const p = posterizeChannel;
              const l = settings.posterize.levels;
              primaryColor = `rgb(${p(rgb.r,l)}, ${p(rgb.g,l)}, ${p(rgb.b,l)})`;
          }
      }
      applyGlow(ctx, settings.glow, primaryColor);

      let strokeOrFill: string | CanvasGradient;
      const { stops, gradient: gradientMode } = settings.color;
      const gradientKey = `${width}x${height}:${stops.map(s => s.color+s.position).join('-')}:${gradientMode}`;
      if (gradientMode !== 'none' && state.gradientCache.key !== gradientKey) {
        state.gradientCache.gradient = createGradient(ctx, width, height, stops, gradientMode);
        state.gradientCache.key = gradientKey;
      }
      strokeOrFill = gradientMode !== 'none' ? state.gradientCache.gradient! : primaryColor;
      
      ctx.strokeStyle = strokeOrFill;
      ctx.fillStyle = strokeOrFill;

      // Pre-calculate bar magnitudes for relevant modes
      if (['bars', 'wave_grid', 'audio_tunnel', 'fractal_bloom', 'kaleidoscope', 'fluid_flow', 'silk_flow', 'spectrogram_tunnel'].includes(settings.mode)) {
          const { frequencyData } = audioData;
          const dataPoints = Math.floor(frequencyData.length * 0.8); // Use upper 80% of spectrum
          for (let i = 0; i < settings.bands; i++) {
              const dataIndex = Math.floor(i * (dataPoints / settings.bands));
              const rawMag = compressMagnitude(frequencyData[dataIndex], settings.compression);
              const targetMag = settings.emaSmoothing * rawMag + (1 - settings.emaSmoothing) * state.barMags[i];

              if (settings.bars.spring.enabled && settings.mode === 'bars') {
                  const spring = (targetMag - state.barMags[i]) * settings.bars.spring.k;
                  state.barVelocities[i] += spring;
                  state.barVelocities[i] *= settings.bars.spring.damp;
                  state.barMags[i] += state.barVelocities[i];
              } else {
                  state.barMags[i] = targetMag;
              }
              if (state.barMags[i] < 0) state.barMags[i] = 0;
              
              if (settings.bars.peakHold) {
                  state.peakHeights[i] = Math.max(state.peakHeights[i] - settings.bars.peakDecay, state.barMags[i]);
              }
          }
      }

      // --- Drawing Logic ---
      switch (settings.mode) {
        case 'wave':
            if (!state.smoothedTimeDomain || state.smoothedTimeDomain.length !== audioData.timeDomainDataL.length) {
                state.smoothedTimeDomain = new Float32Array(audioData.timeDomainDataL.length);
            }
            // EMA smooth the secondary waveform
            for(let i=0; i < audioData.timeDomainDataL.length; i++) {
                state.smoothedTimeDomain[i] = 0.5 * audioData.timeDomainDataL[i] + (1 - 0.5) * state.smoothedTimeDomain[i];
            }
            if (settings.waveform.dual) {
                drawWaveform(ctx, state.smoothedTimeDomain, settings, pulseScale, true);
            }
            drawWaveform(ctx, audioData.timeDomainDataL, settings, pulseScale);
            break;
        case 'bars':
            drawBars(ctx, state.barMags, settings, pulseScale, state);
            break;
        case 'scope':
            drawLissajous(ctx, audioData.timeDomainDataL, audioData.timeDomainDataR, settings);
            break;
        case 'particle_burst':
            drawParticleBurst(ctx, audioData, settings, state, strokeOrFill);
            break;
        case 'wave_grid':
            drawWaveGrid(ctx, state.barMags, settings, pulseScale);
            break;
        case 'audio_tunnel':
            drawAudioTunnel(ctx, state.barMags, settings, state, pulseScale, audioData);
            break;
        case 'fractal_bloom':
            drawFractalBloom(ctx, state.barMags, settings, state, pulseScale, audioData);
            break;
        case 'text_reactive':
            drawTextReactive(ctx, audioData, settings);
            break;
        case 'kaleidoscope':
            drawKaleidoscope(ctx, offscreenCanvas, state.barMags, settings, state, pulseScale, audioData.onsetEnvelope);
            break;
        case 'fluid_flow':
            drawFluidFlow(ctx, offscreenCanvas, state.barMags, settings, strokeOrFill);
            break;
        case 'silk_flow':
            drawSilkFlow(ctx, state.barMags, settings, state, audioData);
            break;
        case 'spectrogram_tunnel':
            drawSpectrogramTunnel(ctx, state.barMags, settings, state);
            break;
      }

      // --- Compositing ---
      if (state.logoImage && settings.overlay.logoUrl) {
          const { x, y, scale, alpha, mask } = settings.overlay;
          const aspect = state.logoImage.width / state.logoImage.height;
          const baseSize = Math.min(width, height) * scale;
          
          let w, h;
          if (aspect > 1) { // Wider than tall
              w = baseSize;
              h = baseSize / aspect;
          } else { // Taller than wide or square
              h = baseSize;
              w = baseSize * aspect;
          }

          const dx = (width * x) - (w / 2);
          const dy = (height * y) - (h / 2);
          ctx.globalAlpha = alpha;
          if (mask) ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(state.logoImage, dx, dy, w, h);
      }

      ctx.restore();
    };

    if (isPlaying || isRecordingPending) {
      renderLoop();
    } else {
        // Draw a single frame when paused
        ctx.fillStyle = settings.color.backgroundColor;
        ctx.fillRect(0,0, canvas.width, canvas.height);
    }

    return () => {
      if (parentElement) {
        resizeObserver.unobserve(parentElement);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [ref, settings, isPlaying, getAudioData, state, isRecording, isRecordingPending, onReadyToRecord]);

  return <canvas ref={ref} className="absolute top-0 left-0 w-full h-full" style={{ zIndex: 1, mixBlendMode: settings.backdrop.blendMode }} />;
});

export default CanvasVisualizer;