import React, { useState, useCallback } from 'react';
import type { VisualizationSettings, DrawMode, WaveformStyle, BarsPattern, BarsShape, BlendMode, CompressionMode, GradientMode, ColorStop, AspectRatio, Resolution, FPS } from '../types';
import ThemePicker from './ThemePicker';
import { FFT_SIZES, BAND_COUNTS, ASPECT_RATIOS, RESOLUTIONS, FPS_OPTIONS } from '../constants';

interface ControlsPanelProps {
  settings: VisualizationSettings;
  onSettingsChange: (newSettings: Partial<VisualizationSettings>) => void;
  onFileLoad: (file: File, type: 'audio' | 'backdrop' | 'logo') => void;
  onRemoveFile: (type: 'audio' | 'backdrop' | 'logo') => void;
  loadedFileNames: { audio: string; backdrop: string; logo: string; };
  isRecording: boolean;
  error: string | null;
}

type Tab = 'source' | 'style' | 'motion' | 'fx' | 'color' | 'layout' | 'recording';

const ControlWrapper: React.FC<{ label: string; children: React.ReactNode; hint?: string; className?: string }> = ({ label, children, hint, className = '' }) => (
  <div className={`mb-4 ${className}`}>
    <label className="block text-sm font-medium text-gray-400 mb-2">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-500 mt-1.5">{hint}</p>}
  </div>
);

const Toggle: React.FC<{ checked: boolean, onChange: (checked: boolean) => void, disabled?: boolean }> = ({ checked, onChange, disabled = false }) => (
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-5 h-5 rounded text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500 disabled:opacity-50" disabled={disabled} />
);

const Slider: React.FC<{ value: number, onChange: (value: number) => void, min?: number, max?: number, step?: number, disabled?: boolean }> = ({ onChange, disabled = false, ...rest }) => (
    <input type="range" {...rest} onChange={e => onChange(+e.target.value)} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50" disabled={disabled} />
);

const Select: React.FC<{ value: string|number, onChange: (value: string) => void, children: React.ReactNode, disabled?: boolean }> = ({ onChange, children, disabled = false, ...rest }) => (
    <select {...rest} onChange={e => onChange(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-sm disabled:opacity-50" disabled={disabled}>
        {children}
    </select>
);

const FileInput: React.FC<{
  label: string;
  accept: string;
  fileName: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  hint?: string;
}> = ({ label, accept, fileName, onFileChange, onRemove, hint }) => {
  return (
    <ControlWrapper label={label} hint={hint}>
      {fileName ? (
        <div className="flex items-center justify-between bg-gray-800 p-2 rounded-md">
          <span className="text-sm text-gray-300 truncate" title={fileName}>{fileName}</span>
          <button onClick={onRemove} className="ml-2 px-2 py-1 text-xs bg-red-800 hover:bg-red-700 rounded-md transition-colors">Remove</button>
        </div>
      ) : (
        <input 
          type="file" 
          accept={accept} 
          onChange={onFileChange} 
          className="text-sm w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500" 
        />
      )}
    </ControlWrapper>
  );
};


const ControlsPanel: React.FC<ControlsPanelProps> = ({ settings, onSettingsChange, onFileLoad, onRemoveFile, loadedFileNames, isRecording, error }) => {
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('style');
  
  const handleSetting = <T extends keyof VisualizationSettings>(key: T, value: VisualizationSettings[T]) => {
      onSettingsChange({ [key]: value } as Partial<VisualizationSettings>);
  };

  const handleNestedSetting = <T extends keyof VisualizationSettings, K extends keyof VisualizationSettings[T]>(group: T, key: K, value: VisualizationSettings[T][K]) => {
    onSettingsChange({ [group]: { ...(settings[group] as object), [key]: value } } as any);
  };
  
  const handleColorStopsChange = (newStops: ColorStop[]) => {
    onSettingsChange({ color: { ...settings.color, stops: newStops }});
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'audio' | 'backdrop' | 'logo') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onFileLoad(file, type);
    }
    // Reset input value to allow re-uploading the same file
    e.target.value = '';
  };


  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/')) onFileLoad(file, 'audio');
    }
  }, [onFileLoad]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };

  const TabButton: React.FC<{ tab: Tab; children: React.ReactNode }> = ({ tab, children }) => (
    <button onClick={() => setActiveTab(tab)} className={`px-3 py-1 text-sm rounded-md transition ${activeTab === tab ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'}`}>{children}</button>
  );

  return (
    <>
      <button onClick={() => setIsPanelVisible(!isPanelVisible)} className="fixed top-4 left-4 z-30 p-2 bg-gray-800/80 rounded-md backdrop-blur-sm hover:bg-gray-700 transition-colors" aria-label="Toggle Controls Panel">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      <div onDrop={handleDrop} onDragOver={handleDragOver} className={`fixed top-0 left-0 h-full z-20 bg-gray-900/80 backdrop-blur-sm p-4 pt-16 pb-24 transition-transform transform ${isPanelVisible ? 'translate-x-0' : '-translate-x-full'} w-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800`}>
        <h2 className="text-xl font-bold mb-4">Controls</h2>

        <div className="grid grid-cols-3 gap-1 bg-gray-800 p-1 rounded-lg mb-4">
          <TabButton tab="source">Source</TabButton>
          <TabButton tab="style">Style</TabButton>
          <TabButton tab="motion">Motion</TabButton>
          <TabButton tab="fx">FX</TabButton>
          <TabButton tab="color">Color</TabButton>
          <TabButton tab="layout">Layout</TabButton>
          <TabButton tab="recording">Recording</TabButton>
        </div>
        
        {/* SOURCE TAB */}
        {activeTab === 'source' && (<div className="space-y-4">
            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Audio Source</h3>
            <FileInput
              label="Upload Audio File"
              accept="audio/*"
              fileName={loadedFileNames.audio}
              onFileChange={(e) => handleFileChange(e, 'audio')}
              onRemove={() => onRemoveFile('audio')}
              hint="MP3, WAV, FLAC, etc."
            />
            <p className="text-center text-gray-500 my-2">or drop anywhere</p>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            
            <h3 className="text-lg font-semibold text-cyan-400 my-3">Audio Processing</h3>
            <ControlWrapper label={`FFT Size: ${settings.fftSize}`} hint="Resolution of the frequency analysis. Higher is more detailed but costs more CPU.">
              <Select value={settings.fftSize} onChange={v => handleSetting('fftSize', +v)}>{FFT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}</Select>
            </ControlWrapper>
            <ControlWrapper label={`Bands: ${settings.bands}`} hint="How many visual bars to display. More bands give finer detail.">
              <Select value={settings.bands} onChange={v => handleSetting('bands', +v)}>{BAND_COUNTS.map(s => <option key={s} value={s}>{s}</option>)}</Select>
            </ControlWrapper>
            <ControlWrapper label={`Analyser Smoothing: ${settings.analyserSmoothing}`} hint="Hardware smoothing from the Web Audio API. Smooths values over time.">
              <Slider value={settings.analyserSmoothing} onChange={v => handleSetting('analyserSmoothing', v)} min={0} max={0.99} step={0.01} />
            </ControlWrapper>
            <ControlWrapper label={`EMA Smoothing (α): ${settings.emaSmoothing}`} hint="Software smoothing. Higher values are more responsive, lower values are smoother.">
              <Slider value={settings.emaSmoothing} onChange={v => handleSetting('emaSmoothing', v)} min={0} max={1} step={0.01} />
            </ControlWrapper>
            <ControlWrapper label="Dynamic Range Compression" hint="Compresses loud and quiet parts to make the visual more consistently active.">
               <Select value={settings.compression.mode} onChange={v => handleNestedSetting('compression', 'mode', v as CompressionMode)}>
                    <option value="none">None</option>
                    <option value="log">Logarithmic</option>
                    <option value="pow">Power (gamma)</option>
               </Select>
            </ControlWrapper>
        </div>)}

        {/* STYLE TAB */}
        {activeTab === 'style' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Visual Mode</h3>
            <Select value={settings.mode} onChange={v => handleSetting('mode', v as DrawMode)}>
                <option value="wave">Waveform</option>
                <option value="bars">Bars</option>
                <option value="scope">Lissajous (Scope)</option>
                <option value="particle_burst">Particle Burst</option>
                <option value="wave_grid">Wave Grid</option>
                <option value="audio_tunnel">Audio Tunnel</option>
                <option value="fractal_bloom">Fractal Bloom</option>
                <option value="text_reactive">Text Reactive</option>
                <option value="kaleidoscope">Kaleidoscope</option>
                <option value="fluid_flow">Fluid Flow</option>
                <option value="silk_flow">Silk Flow</option>
                <option value="spectrogram_tunnel">Spectrogram Tunnel</option>
            </Select>

            {settings.mode === 'wave' && <>
              <h4 className="text-md font-semibold text-gray-300 mt-4 mb-3">Waveform Style</h4>
              <ControlWrapper label="Style" hint="Visual style of the waveform."><Select value={settings.waveform.style} onChange={v => handleNestedSetting('waveform', 'style', v as WaveformStyle)}><option value="line">Line</option><option value="ribbon">Ribbon</option><option value="spline">Spline</option></Select></ControlWrapper>
              <ControlWrapper label={`Thickness: ${settings.waveform.thickness}`} hint="Line or ribbon thickness."><Slider value={settings.waveform.thickness} onChange={v => handleNestedSetting('waveform', 'thickness', v)} min={1} max={20} /></ControlWrapper>
              <ControlWrapper label="Dual Wave" hint="Draws a smoother, slower background wave."><Toggle checked={settings.waveform.dual} onChange={v => handleNestedSetting('waveform', 'dual', v)}/></ControlWrapper>
              <ControlWrapper label={`Amplitude: ${settings.waveform.amplitude.toFixed(2)}`} hint="The vertical scale of the waveform.">
                <Slider value={settings.waveform.amplitude} onChange={v => handleNestedSetting('waveform', 'amplitude', v)} min={0.1} max={2} step={0.05} />
              </ControlWrapper>
            </>}

            {settings.mode === 'bars' && <>
              <h4 className="text-md font-semibold text-gray-300 mt-4 mb-3">Bars Style</h4>
              <ControlWrapper label="Pattern" hint="The overall layout of the bars.">
                <Select value={settings.bars.pattern} onChange={v => handleNestedSetting('bars', 'pattern', v as BarsPattern)}>
                  <option value="linear">Linear</option>
                  <option value="circular">Circular</option>
                  <option value="spiral">Spiral</option>
                  <option value="square">Square</option>
                </Select>
              </ControlWrapper>
              <ControlWrapper label="Shape" hint="The shape of each individual bar segment.">
                <Select value={settings.bars.shape} onChange={v => handleNestedSetting('bars', 'shape', v as BarsShape)}>
                  <option value="line">Line</option>
                  <option value="square">Square</option>
                  <option value="star">Star</option>
                  <option value="heart">Heart</option>
                </Select>
              </ControlWrapper>
              {settings.bars.pattern === 'linear' && <ControlWrapper label="Mirror" hint="Mirrors the bars across the vertical center."><Toggle checked={settings.bars.mirror} onChange={v => handleNestedSetting('bars', 'mirror', v)} /></ControlWrapper>}
              {settings.bars.pattern === 'square' &&
                <ControlWrapper label={`Square Size: ${settings.bars.squareSize.toFixed(2)}`} hint="Adjusts the size of the square layout.">
                    <Slider value={settings.bars.squareSize} onChange={v => handleNestedSetting('bars', 'squareSize', v)} min={0.1} max={1.0} step={0.01} />
                </ControlWrapper>
              }
              <ControlWrapper label="Peak Hold" hint="Shows a cap on each bar that slowly falls."><Toggle checked={settings.bars.peakHold} onChange={v => handleNestedSetting('bars', 'peakHold', v)} /></ControlWrapper>
              {settings.bars.peakHold && <ControlWrapper label={`Peak Decay: ${settings.bars.peakDecay}`} hint="How fast the peak caps fall."><Slider value={settings.bars.peakDecay} onChange={v => handleNestedSetting('bars', 'peakDecay', v)} min={0.001} max={0.05} step={0.001} /></ControlWrapper>}
            </>}
             {(settings.mode === 'bars' && (settings.bars.pattern === 'circular' || settings.bars.pattern === 'spiral')) && <>
                <h4 className="text-md font-semibold text-gray-300 mt-4 mb-3">Radial Style</h4>
                <ControlWrapper label={`Inner Radius: ${settings.radial.innerRadius}`} hint="The size of the empty circle in the center."><Slider value={settings.radial.innerRadius} onChange={v => handleNestedSetting('radial', 'innerRadius', v)} min={0} max={500} /></ControlWrapper>
             </>}

             {settings.mode === 'particle_burst' && <>
                <h4 className="text-md font-semibold text-gray-300 mt-4 mb-3">Particle Burst Style</h4>
                <ControlWrapper label={`Count: ${settings.particleBurst.count}`} hint="Max particles on screen. High values may impact performance."><Slider value={settings.particleBurst.count} onChange={v => handleNestedSetting('particleBurst', 'count', v)} min={10} max={500} step={10}/></ControlWrapper>
                <ControlWrapper label={`Decay: ${settings.particleBurst.decay}`} hint="How quickly particles fade. Higher is longer."><Slider value={settings.particleBurst.decay} onChange={v => handleNestedSetting('particleBurst', 'decay', v)} min={0.9} max={0.999} step={0.001}/></ControlWrapper>
                <h5 className="text-sm font-semibold text-gray-300 mt-4 mb-3">Instrument Reactivity</h5>
                <ControlWrapper label="Bass/Drums (Squares)" hint="React to low frequencies."><Toggle checked={settings.particleBurst.bassEnabled} onChange={v => handleNestedSetting('particleBurst', 'bassEnabled', v)} /></ControlWrapper>
                <ControlWrapper label="Vocals/Mids (Orbs)" hint="React to mid-range frequencies."><Toggle checked={settings.particleBurst.midEnabled} onChange={v => handleNestedSetting('particleBurst', 'midEnabled', v)} /></ControlWrapper>
                <ControlWrapper label="Cymbals/Highs (Triangles)" hint="React to high frequencies."><Toggle checked={settings.particleBurst.highEnabled} onChange={v => handleNestedSetting('particleBurst', 'highEnabled', v)} /></ControlWrapper>
             </>}

             {settings.mode === 'wave_grid' && <>
                <h4 className="text-md font-semibold text-gray-300 mt-4 mb-3">Wave Grid Style</h4>
                <ControlWrapper label={`Density: ${settings.waveGrid.density}`} hint="Number of lines in the grid."><Slider value={settings.waveGrid.density} onChange={v => handleNestedSetting('waveGrid', 'density', v)} min={5} max={50} step={1}/></ControlWrapper>
                <ControlWrapper label={`Scale: ${settings.waveGrid.scale}`} hint="How much the lines are displaced by audio."><Slider value={settings.waveGrid.scale} onChange={v => handleNestedSetting('waveGrid', 'scale', v)} min={0.5} max={5} step={0.1}/></ControlWrapper>
             </>}

             {settings.mode === 'audio_tunnel' && <>
                <h4 className="text-md font-semibold text-gray-300 mt-4 mb-3">Audio Tunnel Style</h4>
                <ControlWrapper label={`Layers: ${settings.audioTunnel.depth}`} hint="Number of concentric rings."><Slider value={settings.audioTunnel.depth} onChange={v => handleNestedSetting('audioTunnel', 'depth', v)} min={3} max={20} step={1}/></ControlWrapper>
                <ControlWrapper label={`Speed: ${settings.audioTunnel.speed}`} hint="How fast the tunnel appears to move."><Slider value={settings.audioTunnel.speed} onChange={v => handleNestedSetting('audioTunnel', 'speed', v)} min={0.5} max={10} step={0.5}/></ControlWrapper>
             </>}

             {settings.mode === 'fractal_bloom' && <>
                <h4 className="text-md font-semibold text-gray-300 mt-4 mb-3">Fractal Bloom Style</h4>
                <ControlWrapper label={`Depth: ${settings.fractalBloom.depth}`} hint="Recursion depth. High values are very slow!"><Slider value={settings.fractalBloom.depth} onChange={v => handleNestedSetting('fractalBloom', 'depth', v)} min={1} max={8} step={1}/></ControlWrapper>
                <ControlWrapper label={`Angle: ${settings.fractalBloom.angle}`} hint="Angle of the fractal branches."><Slider value={settings.fractalBloom.angle} onChange={v => handleNestedSetting('fractalBloom', 'angle', v)} min={10} max={90} step={1}/></ControlWrapper>
                <ControlWrapper label={`Leaf Size: ${settings.fractalBloom.leafSize}`} hint="The size of the leaves."><Slider value={settings.fractalBloom.leafSize} onChange={v => handleNestedSetting('fractalBloom', 'leafSize', v)} min={1} max={15} step={1}/></ControlWrapper>
             </>}
             
             {settings.mode === 'text_reactive' && <>
                <h4 className="text-md font-semibold text-gray-300 mt-4 mb-3">Text Reactive Style</h4>
                <ControlWrapper label="Text" hint="The text to display on screen."><input type="text" value={settings.typography.text} onChange={e => handleNestedSetting('typography', 'text', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-sm"/></ControlWrapper>
             </>}

             {settings.mode === 'kaleidoscope' && <>
                <h4 className="text-md font-semibold text-gray-300 mt-4 mb-3">Kaleidoscope Style</h4>
                <ControlWrapper label={`Segments: ${settings.kaleidoscope.segments}`} hint="Number of mirrored slices."><Slider value={settings.kaleidoscope.segments} onChange={v => handleNestedSetting('kaleidoscope', 'segments', v)} min={2} max={24} step={2}/></ControlWrapper>
                <ControlWrapper label={`Rotation: ${settings.kaleidoscope.rotationSpeed.toFixed(2)}`} hint="Speed of the rotation effect."><Slider value={settings.kaleidoscope.rotationSpeed} onChange={v => handleNestedSetting('kaleidoscope', 'rotationSpeed', v)} min={0} max={1} step={0.05}/></ControlWrapper>
                <ControlWrapper label={`Wave Height: ${settings.kaleidoscope.waveHeight.toFixed(2)}`} hint="Adjusts the amplitude of the visual pattern."><Slider value={settings.kaleidoscope.waveHeight} onChange={v => handleNestedSetting('kaleidoscope', 'waveHeight', v)} min={0.1} max={1.5} step={0.05}/></ControlWrapper>
             </>}

             {settings.mode === 'fluid_flow' && <>
                <h4 className="text-md font-semibold text-gray-300 mt-4 mb-3">Fluid Flow Style</h4>
                <ControlWrapper label={`Viscosity (Blur): ${settings.fluidFlow.viscosity}px`} hint="Blurs blobs to merge them. High values can be slow."><Slider value={settings.fluidFlow.viscosity} onChange={v => handleNestedSetting('fluidFlow', 'viscosity', v)} min={1} max={50} step={1}/></ControlWrapper>
                <ControlWrapper label={`Threshold: ${settings.fluidFlow.threshold}`} hint="Controls how 'thick' the fluid appears after blurring."><Slider value={settings.fluidFlow.threshold} onChange={v => handleNestedSetting('fluidFlow', 'threshold', v)} min={1} max={254} step={1}/></ControlWrapper>
             </>}

             {settings.mode === 'silk_flow' && <>
                <h4 className="text-md font-semibold text-gray-300 mt-4 mb-3">Silk Flow Style</h4>
                <ControlWrapper label={`Lines: ${settings.silkFlow.numLines}`} hint="Number of flowing silk lines."><Slider value={settings.silkFlow.numLines} onChange={v => handleNestedSetting('silkFlow', 'numLines', v)} min={1} max={200} step={1}/></ControlWrapper>
                <ControlWrapper label={`Line Width: ${settings.silkFlow.lineWidth.toFixed(1)}`} hint="Base thickness of the lines."><Slider value={settings.silkFlow.lineWidth} onChange={v => handleNestedSetting('silkFlow', 'lineWidth', v)} min={0.5} max={10} step={0.1}/></ControlWrapper>
                <ControlWrapper label={`Flow Speed: ${settings.silkFlow.speed.toFixed(2)}`} hint="How fast the lines move towards the camera."><Slider value={settings.silkFlow.speed} onChange={v => handleNestedSetting('silkFlow', 'speed', v)} min={0.1} max={5} step={0.1}/></ControlWrapper>
                <ControlWrapper label={`Noise Scale: ${settings.silkFlow.noiseScale.toFixed(4)}`} hint="Zoom level of the flow pattern. Smaller is smoother."><Slider value={settings.silkFlow.noiseScale} onChange={v => handleNestedSetting('silkFlow', 'noiseScale', v)} min={0.0001} max={0.02} step={0.0001}/></ControlWrapper>
                <ControlWrapper label={`Field of View: ${settings.silkFlow.fov}`} hint="The perspective effect. Smaller is more extreme."><Slider value={settings.silkFlow.fov} onChange={v => handleNestedSetting('silkFlow', 'fov', v)} min={50} max={1000} step={10}/></ControlWrapper>
             </>}

             {settings.mode === 'spectrogram_tunnel' && <>
                <h4 className="text-md font-semibold text-gray-300 mt-4 mb-3">Spectrogram Tunnel Style</h4>
                <ControlWrapper label="Style" hint="Visual style of the tunnel.">
                  <Select value={settings.spectrogramTunnel.style} onChange={v => handleNestedSetting('spectrogramTunnel', 'style', v as 'bars' | 'surface')}>
                    <option value="bars">Bars</option>
                    <option value="surface">Surface</option>
                  </Select>
                </ControlWrapper>
                <ControlWrapper label="Direction" hint="The direction the tunnel moves.">
                  <Select value={settings.spectrogramTunnel.direction} onChange={v => handleNestedSetting('spectrogramTunnel', 'direction', v as 'in' | 'out')}>
                    <option value="in">Fly In</option>
                    <option value="out">Fly Out</option>
                  </Select>
                </ControlWrapper>
                <ControlWrapper label={`History Depth: ${settings.spectrogramTunnel.historyDepth}`} hint="How many frames deep the tunnel is.">
                  <Slider value={settings.spectrogramTunnel.historyDepth} onChange={v => handleNestedSetting('spectrogramTunnel', 'historyDepth', v)} min={20} max={300} step={1}/>
                </ControlWrapper>
                <ControlWrapper label={`Scroll Speed: ${settings.spectrogramTunnel.scrollSpeed.toFixed(1)}`} hint="How fast you fly through the tunnel.">
                  <Slider value={settings.spectrogramTunnel.scrollSpeed} onChange={v => handleNestedSetting('spectrogramTunnel', 'scrollSpeed', v)} min={0.2} max={5} step={0.1}/>
                </ControlWrapper>
                <ControlWrapper label={`Field of View: ${settings.spectrogramTunnel.fov}`} hint="The perspective effect. Smaller is more extreme.">
                  <Slider value={settings.spectrogramTunnel.fov} onChange={v => handleNestedSetting('spectrogramTunnel', 'fov', v)} min={50} max={1000} step={10}/>
                </ControlWrapper>
                <ControlWrapper label={`Horizon Position: ${settings.spectrogramTunnel.verticalOffset.toFixed(2)}`} hint="Adjusts the vertical vanishing point of the tunnel.">
                  <Slider value={settings.spectrogramTunnel.verticalOffset} onChange={v => handleNestedSetting('spectrogramTunnel', 'verticalOffset', v)} min={0} max={1} step={0.01}/>
                </ControlWrapper>
                <ControlWrapper label={`Bird's Eye Angle: ${settings.spectrogramTunnel.cameraHeight.toFixed(2)}`} hint="Tilts the tunnel for a view from above.">
                  <Slider value={settings.spectrogramTunnel.cameraHeight} onChange={v => handleNestedSetting('spectrogramTunnel', 'cameraHeight', v)} min={0} max={1} step={0.01}/>
                </ControlWrapper>
             </>}

          </div>
        )}
        
        {/* MOTION TAB */}
        {activeTab === 'motion' && (<div className="space-y-4">
            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Beat Pulse</h3>
            <ControlWrapper label="Enable" hint="Globally enables beat-reactive scaling and motion."><Toggle checked={settings.pulse.enabled} onChange={v => handleNestedSetting('pulse', 'enabled', v)}/></ControlWrapper>
            {settings.pulse.enabled && <>
                <ControlWrapper label={`Attack: ${Math.round(settings.pulse.attack*1000)}ms`} hint="How quickly the pulse reacts to a beat (not used)."><Slider value={settings.pulse.attack} onChange={v => handleNestedSetting('pulse', 'attack', v)} min={0.01} max={0.2} step={0.01} /></ControlWrapper>
                <ControlWrapper label={`Decay: ${Math.round(settings.pulse.decay*1000)}ms`} hint="How quickly the pulse effect fades after a beat."><Slider value={settings.pulse.decay} onChange={v => handleNestedSetting('pulse', 'decay', v)} min={0.05} max={0.5} step={0.01} /></ControlWrapper>
                <ControlWrapper label={`Scale Min: ${settings.pulse.scaleMin}`} hint="The smallest size the visual will shrink to."><Slider value={settings.pulse.scaleMin} onChange={v => handleNestedSetting('pulse', 'scaleMin', v)} min={0.5} max={1.5} step={0.05} /></ControlWrapper>
                <ControlWrapper label={`Scale Max: ${settings.pulse.scaleMax}`} hint="The largest size the visual will expand to on a beat."><Slider value={settings.pulse.scaleMax} onChange={v => handleNestedSetting('pulse', 'scaleMax', v)} min={1} max={2} step={0.05} /></ControlWrapper>
                <ControlWrapper label={`Threshold: ${settings.pulse.threshold}`} hint="Sensitivity of the beat detector. Higher is less sensitive."><Slider value={settings.pulse.threshold} onChange={v => handleNestedSetting('pulse', 'threshold', v)} min={1.0} max={2.0} step={0.05} /></ControlWrapper>
            </>}
            {settings.mode === 'bars' && <>
                <h3 className="text-lg font-semibold text-cyan-400 mt-4 mb-3">Bar Physics (Spring)</h3>
                <ControlWrapper label="Enable" hint="Gives bars a bouncy, spring-like motion."><Toggle checked={settings.bars.spring.enabled} onChange={v => handleNestedSetting('bars', 'spring', {...settings.bars.spring, enabled: v})} /></ControlWrapper>
                {settings.bars.spring.enabled && <>
                    <ControlWrapper label={`Stiffness (k): ${settings.bars.spring.k}`} hint="How strong the spring is. Higher is bouncier."><Slider value={settings.bars.spring.k} onChange={v => handleNestedSetting('bars', 'spring', {...settings.bars.spring, k:v})} min={0.01} max={0.3} step={0.01} /></ControlWrapper>
                    <ControlWrapper label={`Damping: ${settings.bars.spring.damp}`} hint="How quickly the spring motion slows down."><Slider value={settings.bars.spring.damp} onChange={v => handleNestedSetting('bars', 'spring', {...settings.bars.spring, damp:v})} min={0.6} max={0.99} step={0.01} /></ControlWrapper>
                </>}
            </>}
        </div>)}

        {/* FX TAB */}
        {activeTab === 'fx' && (<div className="space-y-4">
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">Shading & FX</h3>
              <ControlWrapper label="Glow" hint="Adds a glowing effect. Can be performance-intensive."><Toggle checked={settings.glow.enabled} onChange={v => handleNestedSetting('glow', 'enabled', v)}/></ControlWrapper>
              {settings.glow.enabled && <ControlWrapper label={`Glow Amount: ${settings.glow.shadowBlur}`} hint="Blur radius of the glow. Higher values are slower.">
                  <Slider value={settings.glow.shadowBlur} onChange={v => handleNestedSetting('glow', 'shadowBlur', v)} min={0} max={32} />
              </ControlWrapper>}

              <ControlWrapper label={`After-image Trails: ${settings.trailsOpacity}`} hint="Fades the previous frame instead of clearing, creating trails.">
                  <Slider value={settings.trailsOpacity} onChange={v => handleSetting('trailsOpacity', v)} min={0} max={0.5} step={0.01} />
              </ControlWrapper>
              <ControlWrapper label="Scanlines" hint="Overlays a retro scanline effect."><Toggle checked={settings.scanlines} onChange={v => handleSetting('scanlines', v)}/></ControlWrapper>
              <ControlWrapper label="Grain" hint="Overlays a film grain texture."><Toggle checked={settings.grain} onChange={v => handleSetting('grain', v)}/></ControlWrapper>
              <ControlWrapper label="Glitch on Beat" hint="Randomly shifts parts of the screen on beats."><Toggle checked={settings.glitch.enabled} onChange={v => handleNestedSetting('glitch', 'enabled', v)}/></ControlWrapper>
              <ControlWrapper label="Posterize (Neon Clip)" hint="Reduces color levels for a hard, neon-like effect."><Toggle checked={settings.posterize.enabled} onChange={v => handleNestedSetting('posterize', 'enabled', v)}/></ControlWrapper>
              {settings.posterize.enabled && <ControlWrapper label={`Levels: ${settings.posterize.levels}`} hint="Number of color levels per channel.">
                <Slider value={settings.posterize.levels} onChange={v => handleNestedSetting('posterize', 'levels', v)} min={2} max={8} step={1}/>
              </ControlWrapper>}
        </div>)}

        {/* COLOR TAB */}
        {activeTab === 'color' && (<div className="space-y-4">
            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Color Themes</h3>
            <ThemePicker onThemeSelect={(themeSettings) => onSettingsChange({ color: { ...settings.color, ...themeSettings } })} />
            
            <h3 className="text-lg font-semibold text-cyan-400 my-3">Custom Colors</h3>
            <ControlWrapper label="Background" hint="The solid background color.">
                <input type="color" value={settings.color.backgroundColor} onChange={e => handleNestedSetting('color', 'backgroundColor', e.target.value)} className="w-full h-10 p-0 border-none rounded-md cursor-pointer" />
            </ControlWrapper>
            
            <ControlWrapper label="Gradient Mode" hint="How the gradient is applied to the visuals.">
                <Select value={settings.color.gradient} onChange={v => handleNestedSetting('color', 'gradient', v as GradientMode)}>
                    <option value="none">None (Solid Color)</option>
                    <option value="frequency">Frequency (Horizontal)</option>
                    <option value="amplitude">Amplitude (Vertical)</option>
                </Select>
            </ControlWrapper>
            
            <div className="space-y-3">
              {settings.color.stops.map((stop, index) => (
                <div key={index} className="flex items-center gap-2 bg-gray-800 p-2 rounded-md">
                   <input type="color" value={stop.color} onChange={e => {
                       const newStops = [...settings.color.stops];
                       newStops[index] = {...newStops[index], color: e.target.value};
                       handleColorStopsChange(newStops);
                   }} className="w-10 h-10 p-0 border-none rounded-md cursor-pointer" />
                   <div className="flex-grow">
                        <Slider value={stop.position} onChange={v => {
                            const newStops = [...settings.color.stops];
                            newStops[index] = {...newStops[index], position: v};
                            handleColorStopsChange(newStops);
                        }} min={0} max={1} step={0.01} />
                        <span className="text-xs text-gray-500">Position: {stop.position.toFixed(2)}</span>
                   </div>
                   <button onClick={() => {
                       if (settings.color.stops.length > 1) {
                           handleColorStopsChange(settings.color.stops.filter((_, i) => i !== index));
                       }
                   }} disabled={settings.color.stops.length <= 1} className="p-1 text-red-400 hover:text-red-300 disabled:text-gray-600">
                     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                   </button>
                </div>
              ))}
            </div>
            <button onClick={() => {
                const lastStop = settings.color.stops[settings.color.stops.length-1] || {position: 0.5, color: '#ffffff'};
                const newStop: ColorStop = { color: lastStop.color, position: Math.min(1, lastStop.position + 0.2) };
                handleColorStopsChange([...settings.color.stops, newStop]);
            }} className="w-full mt-2 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-md transition-colors">
              Add Color Stop
            </button>
        </div>)}
        
        {/* LAYOUT TAB */}
        {activeTab === 'layout' && (<div className="space-y-4">
            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Backdrop</h3>
            <FileInput
              label="Upload Image/Video"
              accept="image/*,video/*"
              fileName={loadedFileNames.backdrop}
              onFileChange={(e) => handleFileChange(e, 'backdrop')}
              onRemove={() => onRemoveFile('backdrop')}
              hint="Adds a background behind the visualizer."
            />
            <ControlWrapper label="Blend Mode" hint="How the visualizer blends with the backdrop.">
                <Select value={settings.backdrop.blendMode} onChange={v => handleNestedSetting('backdrop', 'blendMode', v as BlendMode)}>
                    <option value="normal">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option>
                </Select>
            </ControlWrapper>

            <h3 className="text-lg font-semibold text-cyan-400 my-3">Logo Overlay</h3>
            <FileInput
              label="Upload Logo (PNG/SVG)"
              accept="image/png,image/svg+xml"
              fileName={loadedFileNames.logo}
              onFileChange={(e) => handleFileChange(e, 'logo')}
              onRemove={() => onRemoveFile('logo')}
              hint="Displays an image on top of the visualizer."
            />
            {settings.overlay.logoUrl && (
              <>
                <ControlWrapper label="Use as Mask" hint="Reveals the visualizer only inside the logo shape.">
                  <Toggle checked={settings.overlay.mask} onChange={v => handleNestedSetting('overlay', 'mask', v)}/>
                </ControlWrapper>
                <ControlWrapper label={`Opacity: ${settings.overlay.alpha.toFixed(2)}`} hint="The transparency of the logo overlay.">
                  <Slider value={settings.overlay.alpha} onChange={v => handleNestedSetting('overlay', 'alpha', v)} min={0} max={1} step={0.05}/>
                </ControlWrapper>
                <ControlWrapper label={`Scale: ${settings.overlay.scale.toFixed(2)}`} hint="Resizes the logo.">
                  <Slider value={settings.overlay.scale} onChange={v => handleNestedSetting('overlay', 'scale', v)} min={0.05} max={1.5} step={0.01}/>
                </ControlWrapper>
                <ControlWrapper label={`X Position: ${settings.overlay.x.toFixed(2)}`} hint="Moves the logo horizontally.">
                  <Slider value={settings.overlay.x} onChange={v => handleNestedSetting('overlay', 'x', v)} min={0} max={1} step={0.01}/>
                </ControlWrapper>
                <ControlWrapper label={`Y Position: ${settings.overlay.y.toFixed(2)}`} hint="Moves the logo vertically.">
                  <Slider value={settings.overlay.y} onChange={v => handleNestedSetting('overlay', 'y', v)} min={0} max={1} step={0.01}/>
                </ControlWrapper>
              </>
            )}

            <h3 className="text-lg font-semibold text-cyan-400 my-3">Typography</h3>
            <ControlWrapper label="Headline Text" hint="Text for the 'Text Reactive' mode."><input type="text" value={settings.typography.text} onChange={e => handleNestedSetting('typography', 'text', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-sm"/></ControlWrapper>
        </div>)}

        {/* RECORDING TAB */}
        {activeTab === 'recording' && (<div className="space-y-4">
            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Video Export Settings</h3>
            <ControlWrapper label="Aspect Ratio" hint="Sets the shape of the video frame.">
              <Select value={settings.recording.aspectRatio} onChange={v => handleNestedSetting('recording', 'aspectRatio', v as AspectRatio)} disabled={isRecording}>
                {ASPECT_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </ControlWrapper>
            <ControlWrapper label="Resolution" hint="The vertical resolution of the video.">
              <Select value={settings.recording.resolution} onChange={v => handleNestedSetting('recording', 'resolution', v as Resolution)} disabled={isRecording}>
                {RESOLUTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </ControlWrapper>
            <ControlWrapper label="Frame Rate" hint="Frames per second. 60fps is smoother but more demanding.">
              <Select value={settings.recording.fps} onChange={v => handleNestedSetting('recording', 'fps', +v as FPS)} disabled={isRecording}>
                {FPS_OPTIONS.map(f => <option key={f} value={f}>{f} fps</option>)}
              </Select>
            </ControlWrapper>
        </div>)}

      </div>
    </>
  );
};

export default ControlsPanel;