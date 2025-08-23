
import { useState, useRef, useCallback, useEffect } from 'react';
import { BeatDetector } from '../utils/beat';
import type { StereoAudioData } from '../types';

export const useAudioEngine = (fftSize: number, smoothingTimeConstant: number) => {
  const audioElRef = useRef<HTMLAudioElement>(new Audio());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const isGraphSetupRef = useRef(false);

  const beatDetectorRef = useRef<BeatDetector>(new BeatDetector());
  const lastTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [recordingAudioStream, setRecordingAudioStream] = useState<MediaStream | null>(null);

  // Update analyser settings when they change from UI
  useEffect(() => {
    if (analyserLRef.current) analyserLRef.current.fftSize = fftSize;
    if (analyserRRef.current) analyserRRef.current.fftSize = fftSize;
  }, [fftSize]);

  useEffect(() => {
    if (analyserLRef.current) analyserLRef.current.smoothingTimeConstant = smoothingTimeConstant;
    if (analyserRRef.current) analyserRRef.current.smoothingTimeConstant = smoothingTimeConstant;
  }, [smoothingTimeConstant]);


  const loadAudio = useCallback((sourceUrl: string | null) => {
    const audio = audioElRef.current;
    if (sourceUrl) {
      // The audio graph setup will be triggered by the 'playing' event later
      // if it hasn't been set up already.
      audio.pause();
      audio.crossOrigin = "anonymous";
      audio.src = sourceUrl;
      audio.load();
      setError(null);
      setCurrentTime(0);
    } else { // Unload action
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, []);

  // Main effect for handling audio element events and connecting the graph
  useEffect(() => {
    const audio = audioElRef.current;

    const setupAudioGraph = () => {
      if (isGraphSetupRef.current || !audioContextRef.current) return;
      
      const audioContext = audioContextRef.current;

      try {
        const source = audioContext.createMediaElementSource(audio);
        const splitter = audioContext.createChannelSplitter(2);
        const merger = audioContext.createChannelMerger(2);
        const recordingDestination = audioContext.createMediaStreamDestination();
        
        analyserLRef.current = audioContext.createAnalyser();
        analyserRRef.current = audioContext.createAnalyser();

        analyserLRef.current.fftSize = fftSize;
        analyserRRef.current.fftSize = fftSize;
        analyserLRef.current.smoothingTimeConstant = smoothingTimeConstant;
        analyserRRef.current.smoothingTimeConstant = smoothingTimeConstant;
        
        // --- THE FIX: Classic Serial Audio Graph ---
        // This is a more conventional and widely supported setup. It ensures that if
        // audio is playing, it MUST pass through the analysers, fixing the "no data" bug.
        
        // 1. Source splits into two channels
        source.connect(splitter);
        
        // 2. Each channel goes through its own analyser
        splitter.connect(analyserLRef.current, 0); // Left channel
        splitter.connect(analyserRRef.current, 1); // Right channel
        
        // 3. The analysed signals are re-merged back into a stereo signal
        analyserLRef.current.connect(merger, 0, 0);
        analyserRRef.current.connect(merger, 0, 1);
        
        // 4. The final merged signal is sent to two places:
        //    a) The speakers for playback
        merger.connect(audioContext.destination);
        //    b) The recording stream, which captures the final output
        merger.connect(recordingDestination);
        setRecordingAudioStream(recordingDestination.stream);

        isGraphSetupRef.current = true; // Lock the graph, it's now permanent.
        
      } catch (e) {
          console.error("Error setting up audio graph:", e);
          setError("Failed to initialize audio. Please try reloading. If using an audio file from a URL, it may be CORS-protected.");
      }
    };
    
    const handlePlaying = async () => {
      if (!audioContextRef.current) {
        try {
          const context = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = context;
        } catch (e) {
          setError("Web Audio API is not supported in this browser.");
          return;
        }
      }

      if (audioContextRef.current.state === 'suspended') {
        try {
            await audioContextRef.current.resume();
        } catch (e) {
            console.error("Failed to resume AudioContext:", e);
            setError("Could not start audio playback. Please interact with the page and try again.");
            return;
        }
      }
      
      setupAudioGraph();
      setIsPlaying(true);
      lastTimeRef.current = performance.now();
    };
    
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => setError(`Error loading audio. If from a URL, check CORS policy.`);

    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []); // <-- This MUST be empty to ensure event listeners are setup only once.

  const play = useCallback(async () => {
    try {
      await audioElRef.current.play();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Expected interruption.
      } else {
        console.error("Error playing audio:", err);
        setError("An error occurred during playback.");
      }
    }
  }, [setError]);
  const pause = useCallback(() => audioElRef.current.pause(), []);
  const seek = useCallback((time: number) => { audioElRef.current.currentTime = time; }, []);
  
  const setAudioVolume = useCallback((vol: number) => {
    audioElRef.current.volume = vol;
    setVolume(vol);
  }, []);
  
  const getAudioData = useCallback((pulseSettings: any): StereoAudioData | null => {
    const analyserL = analyserLRef.current;
    if (!analyserL || !isGraphSetupRef.current) return null;

    const frequencyBufferLength = analyserL.frequencyBinCount;
    const frequencyData = new Uint8Array(frequencyBufferLength);
    analyserL.getByteFrequencyData(frequencyData);

    const timeDomainBufferLength = analyserL.fftSize;
    const timeDomainDataL = new Float32Array(timeDomainBufferLength);
    const timeDomainDataR = new Float32Array(timeDomainBufferLength);
    analyserL.getFloatTimeDomainData(timeDomainDataL);
    analyserRRef.current?.getFloatTimeDomainData(timeDomainDataR);

    let sumSquares = 0.0;
    for (const amplitude of timeDomainDataL) {
      sumSquares += amplitude * amplitude;
    }
    const rms = Math.sqrt(sumSquares / timeDomainBufferLength);

    const now = performance.now();
    const deltaTime = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;

    const { isBeat, envelope } = beatDetectorRef.current.update(rms, deltaTime, pulseSettings);

    return { 
        timeDomainDataL, 
        timeDomainDataR,
        frequencyData, 
        rms,
        isBeat,
        onsetEnvelope: envelope
    };
  }, []);

  return {
    audioContext: audioContextRef.current,
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
    recordingAudioStream,
  };
};
