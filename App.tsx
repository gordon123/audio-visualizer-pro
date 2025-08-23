import React, { useState, useEffect, useRef, useCallback } from 'react';
import ControlsPanel from './components/ControlsPanel';
import CanvasVisualizer from './components/CanvasVisualizer';
import TransportBar from './components/TransportBar';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useRecorder } from './hooks/useRecorder';
import type { VisualizationSettings, AspectRatio } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { downloadCanvasAsPNG } from './utils/download';
import { produce } from 'immer';

const App: React.FC = () => {
  const [settings, setSettings] = useState<VisualizationSettings>(DEFAULT_SETTINGS);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadedFileNames, setLoadedFileNames] = useState({
    audio: '',
    backdrop: '',
    logo: '',
  });
  const [isRecordingPending, setIsRecordingPending] = useState(false);
  const canvasVisualizerRef = useRef<HTMLCanvasElement>(null);
  const backdropVideoRef = useRef<HTMLVideoElement>(null);


  const {
    loadAudio,
    play,
    pause,
    seek,
    setAudioVolume,
    getAudioData,
    isPlaying,
    duration,
    currentTime,
    volume,
    error,
    recordingAudioStream, // Use the new, isolated stream for recording
  } = useAudioEngine(settings.fftSize, settings.analyserSmoothing);

  const handleSettingsChange = useCallback((newSettings: Partial<VisualizationSettings>) => {
    setSettings(produce(settings, draft => {
        for (const key in newSettings) {
            const k = key as keyof VisualizationSettings;
            if (typeof newSettings[k] === 'object' && newSettings[k] !== null && !Array.isArray(newSettings[k])) {
                // @ts-ignore
                Object.assign(draft[k], newSettings[k]);
            } else {
                // @ts-ignore
                draft[k] = newSettings[k];
            }
        }
        if (newSettings.color && !newSettings.color.theme) {
            draft.color.theme = 'custom';
        }
    }));
  }, [settings]);
  
  const handleFileLoad = (file: File, type: 'audio' | 'backdrop' | 'logo') => {
    // Revoke old blob URLs to prevent memory leaks
    if (type === 'audio' && audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (type === 'backdrop' && settings.backdrop.url?.startsWith('blob:')) {
      URL.revokeObjectURL(settings.backdrop.url);
    }
    if (type === 'logo' && settings.overlay.logoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(settings.overlay.logoUrl);
    }
  
    const fileUrl = URL.createObjectURL(file);
    const fileName = file.name;
  
    if (type === 'audio') {
      setAudioUrl(fileUrl);
      loadAudio(fileUrl);
      setLoadedFileNames(prev => ({ ...prev, audio: fileName }));
    } else if (type === 'backdrop') {
      const backdropType = file.type.startsWith('video') ? 'video' : 'image';
      handleSettingsChange({ backdrop: { ...settings.backdrop, url: fileUrl, type: backdropType } });
      setLoadedFileNames(prev => ({ ...prev, backdrop: fileName }));
    } else if (type === 'logo') {
      handleSettingsChange({ overlay: { ...settings.overlay, logoUrl: fileUrl } });
      setLoadedFileNames(prev => ({ ...prev, logo: fileName }));
    }
  };
  
  const handleRemoveFile = (type: 'audio' | 'backdrop' | 'logo') => {
    if (type === 'audio') {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioUrl(null);
      loadAudio(null); // Signal to unload
      setLoadedFileNames(prev => ({ ...prev, audio: '' }));
    } else if (type === 'backdrop') {
      if (settings.backdrop.url?.startsWith('blob:')) {
        URL.revokeObjectURL(settings.backdrop.url);
      }
      handleSettingsChange({ backdrop: { ...settings.backdrop, url: '', type: 'none' } });
      setLoadedFileNames(prev => ({ ...prev, backdrop: '' }));
    } else if (type === 'logo') {
      if (settings.overlay.logoUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(settings.overlay.logoUrl);
      }
      handleSettingsChange({ overlay: { ...settings.overlay, logoUrl: '' } });
      setLoadedFileNames(prev => ({ ...prev, logo: '' }));
    }
  };

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      pause();
      backdropVideoRef.current?.pause();
    } else {
      await play();
      try {
        await backdropVideoRef.current?.play();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // This is an expected interruption for the video.
        } else {
          console.error("Error playing backdrop video:", err);
        }
      }
    }
  }, [isPlaying, pause, play]);
  
  const handleExportPNG = () => {
    if (canvasVisualizerRef.current) {
      downloadCanvasAsPNG(canvasVisualizerRef.current, `visualizer-frame-${new Date().toISOString()}.png`);
    }
  };

  const { isRecording, recordingTime, startRecording, stopRecording } = useRecorder(
    canvasVisualizerRef,
    recordingAudioStream, // Pass the new, safe stream to the recorder
    settings.recording
  );
  
  const handleReadyToRecord = useCallback(() => {
    startRecording();
    setIsRecordingPending(false);
  }, [startRecording]);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      pause();
    } else if (audioUrl) {
        setIsRecordingPending(true);
        if (!isPlaying) {
            await play();
        }
    } else {
        alert("Please load an audio file before recording.");
    }
  }, [isRecording, isPlaying, audioUrl, play, pause, stopRecording]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName.match(/INPUT|SELECT|TEXTAREA/)) return;
      if (e.code === 'Space' && !isRecording) { // Disable spacebar during recording
        e.preventDefault();
        handlePlayPause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, isRecording]);

  return (
    <div className="w-screen h-screen overflow-hidden font-sans bg-black flex justify-center items-center">
      {settings.backdrop.url && settings.backdrop.type === 'image' && (
        <div 
          className="absolute top-0 left-0 w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url(${settings.backdrop.url})`, zIndex: 0 }}
        />
      )}
       {settings.backdrop.url && settings.backdrop.type === 'video' && (
        <video
          ref={backdropVideoRef}
          src={settings.backdrop.url}
          loop
          muted
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        />
      )}
      
      <div className="w-full h-full flex justify-center items-center p-4">
          <div className="w-full h-full relative">
            <CanvasVisualizer
              ref={canvasVisualizerRef}
              settings={settings}
              getAudioData={getAudioData}
              isPlaying={isPlaying}
              isRecording={isRecording}
              isRecordingPending={isRecordingPending}
              onReadyToRecord={handleReadyToRecord}
            />
          </div>
      </div>


      {settings.scanlines && <div className="scanlines-overlay" />}
      {settings.grain && <div className="grain-overlay" />}

      <ControlsPanel
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onFileLoad={handleFileLoad}
        onRemoveFile={handleRemoveFile}
        loadedFileNames={loadedFileNames}
        isRecording={isRecording}
        error={error}
      />
      <TransportBar
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onSeek={(time) => {
            seek(time);
            if (backdropVideoRef.current) backdropVideoRef.current.currentTime = time;
        }}
        onVolumeChange={setAudioVolume}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        onExportPNG={handleExportPNG}
        onToggleRecording={handleToggleRecording}
        isRecording={isRecording}
        recordingTime={recordingTime}
      />
    </div>
  );
};

export default App;