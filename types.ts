export type DrawMode =
  | 'wave'
  | 'bars'
  | 'scope'
  | 'particle_burst'
  | 'wave_grid'
  | 'audio_tunnel'
  | 'fractal_bloom'
  | 'text_reactive'
  | 'kaleidoscope'
  | 'fluid_flow'
  | 'silk_flow'
  | 'spectrogram_tunnel';

export type WaveformStyle = 'line' | 'ribbon' | 'spline';
export type BarsPattern = 'linear' | 'circular' | 'spiral' | 'square';
export type BarsShape = 'line' | 'square' | 'star' | 'heart';
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay';
export type ThemeName = 'custom' | 'neon' | 'sunset' | 'ice' | 'monogold';
export type CompressionMode = 'none' | 'log' | 'pow';
export type GradientMode = 'none' | 'amplitude' | 'frequency';
export type AspectRatio = '16:9' | '9:16' | '4:3' | '3:4' | '1:1';
export type Resolution = '360p' | '480p' | '720p' | '1080p';
export type FPS = 24 | 30 | 60;

export interface ColorStop {
  color: string;
  position: number; // 0 to 1
}

export interface RecordingSettings {
  aspectRatio: AspectRatio;
  resolution: Resolution;
  fps: FPS;
}

export interface VisualizationSettings {
  mode: DrawMode;
  fftSize: number;
  bands: number;
  analyserSmoothing: number;
  emaSmoothing: number; 

  compression: {
    mode: CompressionMode;
    k: number; // For log compression
    gamma: number; // For pow compression
  };

  waveform: {
    style: WaveformStyle;
    dual: boolean;
    thickness: number;
    amplitude: number;
  };
  
  bars: {
    pattern: BarsPattern;
    shape: BarsShape;
    mirror: boolean;
    peakHold: boolean;
    peakDecay: number; // Subtractive decay value
    squareSize: number;
    spring: { 
      enabled: boolean; 
      k: number;
      damp: number;
    };
  };

  radial: {
    innerRadius: number;
    barMaxRadius: number;
    rotationSpeed: number;
  };
  
  particleBurst: {
    count: number;
    decay: number;
    bassEnabled: boolean;
    midEnabled: boolean;
    highEnabled: boolean;
    bassThreshold: number;
    midThreshold: number;
    highThreshold: number;
  };

  waveGrid: {
    density: number;
    scale: number;
  };

  audioTunnel: {
    depth: number;
    speed: number;
  };

  fractalBloom: {
    depth: number;
    angle: number;
    leafSize: number;
  };
  
  kaleidoscope: {
    segments: number;
    rotationSpeed: number;
    waveHeight: number;
  };
  
  fluidFlow: {
    viscosity: number;
    threshold: number;
  };

  silkFlow: {
    numLines: number;
    lineWidth: number;
    speed: number;
    noiseScale: number;
    amplitude: number;
    fov: number;
  };

  spectrogramTunnel: {
    style: 'bars' | 'surface';
    historyDepth: number;
    scrollSpeed: number;
    fov: number;
    verticalOffset: number;
    direction: 'in' | 'out';
    cameraHeight: number;
  };

  pulse: { 
    enabled: boolean;
    attack: number; // ms
    decay: number; // ms
    scaleMin: number;
    scaleMax: number;
    threshold: number;
  };

  noise: { 
    enabled: boolean;
    speed: number;
    intensity: number;
  };

  glow: { 
    enabled: boolean;
    shadowBlur: number;
  };

  trailsOpacity: number;
  scanlines: boolean;
  grain: boolean;

  glitch: { 
    enabled: boolean;
    intensity: number;
  };

  posterize: {
    enabled: boolean;
    levels: number;
  };

  color: {
    theme: ThemeName;
    backgroundColor: string;
    stops: ColorStop[];
    gradient: GradientMode;
  };

  overlay: {
    logoUrl?: string;
    mask: boolean;
    alpha: number;
    x: number; // 0-1, center is 0.5
    y: number; // 0-1, center is 0.5
    scale: number; // 0-1, relative to canvas smaller dimension
  };
  
  backdrop: {
    url?: string;
    type: 'none' | 'image' | 'video';
    blendMode: BlendMode;
  };

  typography: {
    text: string;
    beatReactive: boolean;
  };

  recording: RecordingSettings;
}


export interface Theme {
  name: ThemeName;
  settings: {
    backgroundColor: string;
    stops: ColorStop[];
    gradient: GradientMode;
  };
}

export type StereoAudioData = {
  timeDomainDataL: Float32Array;
  timeDomainDataR: Float32Array;
  frequencyData: Uint8Array;
  rms: number;
  isBeat: boolean;
  onsetEnvelope: number;
};