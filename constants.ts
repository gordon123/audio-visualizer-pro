import type { Theme, VisualizationSettings, AspectRatio, Resolution, FPS } from './types';

export const DEFAULT_SETTINGS: VisualizationSettings = {
  mode: 'wave',
  fftSize: 4096,
  bands: 96,
  analyserSmoothing: 0.8,
  emaSmoothing: 0.4, // Increased for better responsiveness

  compression: {
    mode: 'log',
    k: 3.0,
    gamma: 0.5,
  },

  waveform: {
    style: 'ribbon',
    dual: true,
    thickness: 10,
    amplitude: 1.0,
  },

  bars: {
    pattern: 'linear',
    shape: 'line',
    mirror: true,
    peakHold: true,
    peakDecay: 0.01,
    squareSize: 0.5,
    spring: {
      enabled: true,
      k: 0.12,
      damp: 0.82,
    },
  },

  radial: {
    innerRadius: 120,
    barMaxRadius: 280,
    rotationSpeed: 0.2,
  },
  
  particleBurst: {
    count: 80, // Performance-friendly default
    decay: 0.98,
    bassEnabled: true,
    midEnabled: true,
    highEnabled: true,
    bassThreshold: 140, // Lowered significantly for more bass reactivity
    midThreshold: 110, // Lowered for more mid reactivity
    highThreshold: 100, // This value works well for highs
  },

  waveGrid: {
    density: 20,
    scale: 1.5,
  },

  audioTunnel: {
    depth: 8,
    speed: 2,
  },

  fractalBloom: {
    depth: 4,
    angle: 30,
    leafSize: 5,
  },

  kaleidoscope: {
    segments: 2,
    rotationSpeed: 1,
    waveHeight: 0.5,
  },

  fluidFlow: {
    viscosity: 1, // blur amount, lowered dramatically for performance
    threshold: 128, // 0-255, adjusted for sharper edges with low viscosity
  },

  silkFlow: {
    numLines: 80,
    lineWidth: 1.5,
    speed: 0.8,
    noiseScale: 0.005,
    amplitude: 150,
    fov: 400,
  },

  spectrogramTunnel: {
    style: 'surface',
    historyDepth: 100,
    scrollSpeed: 1,
    fov: 300,
    verticalOffset: 0.5,
    direction: 'in',
    cameraHeight: 0,
  },

  pulse: {
    enabled: true,
    attack: 0.03, // 30ms
    decay: 0.12,  // 120ms
    scaleMin: 0.9,
    scaleMax: 1.2,
    threshold: 1.3,
  },

  noise: {
    enabled: false,
    speed: 0.1,
    intensity: 2,
  },

  glow: {
    enabled: true,
    shadowBlur: 8, // Reduced for better performance
  },
  trailsOpacity: 0.06,
  scanlines: false,
  grain: false,
  glitch: {
    enabled: false,
    intensity: 5,
  },
  posterize: {
    enabled: false,
    levels: 4,
  },

  color: {
    theme: 'neon',
    backgroundColor: '#0a0a0f',
    stops: [
      { color: '#00FFFF', position: 0 },
      { color: '#FF00FF', position: 1 },
    ],
    gradient: 'frequency',
  },
  
  overlay: {
    logoUrl: '',
    mask: false,
    alpha: 0.8,
    x: 0.5,
    y: 0.5,
    scale: 0.4,
  },
  
  backdrop: {
    url: '',
    type: 'none',
    blendMode: 'normal',
  },

  typography: {
    text: 'Audio Visualizer',
    beatReactive: false,
  },

  recording: {
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: 60,
  }
};

export const THEMES: Theme[] = [
  {
    name: 'neon',
    settings: {
      backgroundColor: '#0a0a0f',
      stops: [
        { color: '#00FFFF', position: 0 },
        { color: '#FF00FF', position: 1 },
      ],
      gradient: 'frequency',
    },
  },
  {
    name: 'sunset',
    settings: {
      backgroundColor: '#1b0e17',
      stops: [
        { color: '#FF8A00', position: 0 },
        { color: '#FF2D55', position: 1 },
      ],
      gradient: 'frequency',
    },
  },
  {
    name: 'ice',
    settings: {
      backgroundColor: '#0b1c26',
      stops: [
        { color: '#B3E5FC', position: 0 },
        { color: '#81D4FA', position: 1 },
      ],
      gradient: 'amplitude',
    },
  },
  {
    name: 'monogold',
    settings: {
      backgroundColor: '#000000',
      stops: [
        { color: '#F8E16A', position: 0 },
        { color: '#F8E16A', position: 1 },
      ],
      gradient: 'none',
    },
  },
];

export const FFT_SIZES = [512, 1024, 2048, 4096, 8192];
export const BAND_COUNTS = [32, 64, 96, 128, 256];

export const ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16', '4:3', '3:4', '1:1'];
export const RESOLUTIONS: Resolution[] = ['360p', '480p', '720p', '1080p'];
export const FPS_OPTIONS: FPS[] = [24, 30, 60];