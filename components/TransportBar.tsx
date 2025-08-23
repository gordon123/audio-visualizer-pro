
import React from 'react';
import { PlayIcon, PauseIcon, RecordIcon } from './icons';

interface TransportBarProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  currentTime: number;
  duration: number;
  volume: number;
  onExportPNG: () => void;
  onToggleRecording: () => void;
  isRecording: boolean;
  recordingTime: number;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const TransportBar: React.FC<TransportBarProps> = ({
  isPlaying,
  onPlayPause,
  onSeek,
  onVolumeChange,
  currentTime,
  duration,
  volume,
  onExportPNG,
  onToggleRecording,
  isRecording,
  recordingTime,
}) => {
  const seekbarValue = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800/80 backdrop-blur-sm p-4 z-20">
      <div className="flex items-center gap-4 max-w-5xl mx-auto">
        {/* Play/Pause */}
        <button
          onClick={onPlayPause}
          className="p-2 rounded-full bg-cyan-500 text-white hover:bg-cyan-400 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          disabled={isRecording}
        >
          {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
        </button>

        {/* Time and Seek */}
        <span className="text-sm text-gray-300 w-12 text-center">{formatTime(currentTime)}</span>
        <input
          type="range"
          min="0"
          max="100"
          value={seekbarValue}
          onChange={(e) => onSeek((parseFloat(e.target.value) / 100) * duration)}
          className="flex-grow h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm"
          disabled={!duration}
        />
        <span className="text-sm text-gray-300 w-12 text-center">{formatTime(duration)}</span>

        {/* Volume */}
        <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a1 1 0 00-2 0v12a1 1 0 102 0V4zM13 4a1 1 0 10-2 0v12a1 1 0 102 0V4z"/></svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm"
              aria-label="Volume"
            />
        </div>
        
        {/* Export and Record */}
        <div className="flex items-center gap-2 border-l border-gray-600 pl-4">
            <button onClick={onExportPNG} className="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-md transition-colors">Save PNG</button>
            <button 
                onClick={onToggleRecording} 
                className={`px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${isRecording ? 'bg-red-600 hover:bg-red-500' : 'bg-red-800 hover:bg-red-700'}`}
            >
                <RecordIcon className="w-4 h-4" isRecording={isRecording} />
                <span>{isRecording ? formatTime(recordingTime) : 'Record'}</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default TransportBar;
