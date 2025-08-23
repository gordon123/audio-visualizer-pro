import { useState, useRef, useCallback, useEffect } from 'react';
import { downloadFile } from '../utils/download';
import type { RecordingSettings } from '../types';

export const useRecorder = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  audioMediaStream: MediaStream | null,
  settings: RecordingSettings
) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !audioMediaStream || isRecording) {
      console.error("Recording prerequisites not met. Is an audio file loaded and playing?");
      if (!audioMediaStream) alert("Please load and play an audio file before recording.");
      return;
    }

    try {
      const canvasStream = canvas.captureStream(settings.fps);
      
      // Clone the audio tracks to create an independent stream for the recorder.
      // This is the definitive fix for the browser resource conflict that pauses the animation.
      const clonedAudioTracks = audioMediaStream.getAudioTracks().map(track => track.clone());

      if (clonedAudioTracks.length === 0) {
        alert("The audio source doesn't seem to contain an audio track. The recording will be silent.");
      }

      const tracks = [...canvasStream.getVideoTracks(), ...clonedAudioTracks];
      const combinedStream = new MediaStream(tracks);
      combinedStreamRef.current = combinedStream;

      const MimeType = { MP4: 'video/mp4', WEBM: 'video/webm' };
      const Codecs = { MP4: 'avc1,mp4a', WEBM: 'vp9,opus' };
      const supportedMimeTypes = [
        `${MimeType.MP4}; codecs=${Codecs.MP4}`,
        MimeType.MP4,
        `${MimeType.WEBM}; codecs=${Codecs.WEBM}`,
        MimeType.WEBM,
      ];
      const selectedMimeType = supportedMimeTypes.find(type => MediaRecorder.isTypeSupported(type));

      if (!selectedMimeType) {
        console.error("No supported MIME type for recording found.");
        alert("Your browser does not support the required video recording formats (MP4 or WebM).");
        return;
      }
      
      const fileExtension = selectedMimeType.startsWith(MimeType.MP4) ? 'mp4' : 'webm';
      const options = {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 12 * 1000000,
        audioBitsPerSecond: 192 * 1000,
      };
      mediaRecorderRef.current = new MediaRecorder(combinedStream, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: selectedMimeType });
        downloadFile(blob, `visualizer-recording-${new Date().toISOString()}.${fileExtension}`);
        recordedChunksRef.current = [];
        combinedStreamRef.current?.getTracks().forEach(track => track.stop());
        combinedStreamRef.current = null;
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (e) {
      console.error("Error starting recording:", e);
      alert("Failed to start recording. See console for details.");
    }

  }, [canvasRef, audioMediaStream, isRecording, settings]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, [isRecording]);
  
  // Cleanup effect in case component unmounts while recording
  useEffect(() => {
    return () => {
        if (isRecording) {
            stopRecording();
        }
    }
  }, [isRecording, stopRecording]);

  return { isRecording, recordingTime, startRecording, stopRecording };
};