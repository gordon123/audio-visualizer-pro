import React from 'react';

type IconProps = {
  className?: string;
};

interface RecordIconProps extends IconProps {
  isRecording?: boolean;
}

export const PlayIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const PauseIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

export const RecordIcon: React.FC<RecordIconProps> = ({ className, isRecording = false }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    {isRecording ? (
       <path d="M6 6h12v12H6z" />
    ) : (
       <circle cx="12" cy="12" r="8" />
    )}
  </svg>
);
