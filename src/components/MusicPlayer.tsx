import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Play, Pause, SkipBack, SkipForward, Volume2, Download, CheckCircle2 } from 'lucide-react';
import { Song } from '../constants/songs';
import { isSongDownloaded, toggleDownload } from '../services/storage';

interface MusicPlayerProps {
  song: Song;
  onNext?: () => void;
  onPrev?: () => void;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({ song, onNext, onPrev }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setIsDownloaded(isSongDownloaded(song.id));
  }, [song.id]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
      audioRef.current.preload = "auto";
    }
    
    const audio = audioRef.current;
    
    // Reset state for new song
    setIsLoading(true);
    setProgress(0);
    setDuration(0);

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const onCanPlay = () => {
      setIsLoading(false);
    };

    const onTimeUpdate = () => {
      setProgress(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      if (onNext) onNext();
    };

    const onError = (e: any) => {
      console.error("Audio playback error:", e);
      setIsLoading(false);
      setIsPlaying(false);
      // The error "The element has no supported sources" often happens if the URL is invalid or blocked
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    // Set source and load
    if (song.url) {
      // Clear previous source to avoid "no supported sources" error on source change
      audio.pause();
      audio.src = "";
      
      audio.src = song.url;
      audio.load();

      if (isPlaying) {
        audio.play().catch(e => {
          console.error("Playback failed", e);
          setIsPlaying(false);
        });
      }
    }

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [song]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    const status = toggleDownload(song.id);
    setIsDownloaded(status);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.songInfo}>
          <Text style={styles.title}>{song.title}</Text>
          <Text style={styles.artist}>{song.artist}</Text>
        </View>
        <TouchableOpacity onPress={handleDownload} style={styles.downloadButton}>
          {isDownloaded ? (
            <CheckCircle2 size={20} color="#d4af37" />
          ) : (
            <Download size={20} color="rgba(212, 175, 55, 0.4)" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(progress / duration) * 100}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(progress)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity onPress={onPrev} style={styles.controlButton}>
          <SkipBack size={24} color="#d4af37" />
        </TouchableOpacity>

        <TouchableOpacity onPress={togglePlay} style={styles.playButton}>
          {isLoading ? (
            <ActivityIndicator color="#0b1e3d" />
          ) : isPlaying ? (
            <Pause size={32} color="#0b1e3d" fill="#0b1e3d" />
          ) : (
            <Play size={32} color="#0b1e3d" fill="#0b1e3d" />
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onNext} style={styles.controlButton}>
          <SkipForward size={24} color="#d4af37" />
        </TouchableOpacity>
      </View>

      <View style={styles.volumeContainer}>
        <Volume2 size={18} color="#d4af37" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          style={{
            flex: 1,
            height: 4,
            appearance: 'none',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 2,
            outline: 'none',
            cursor: 'pointer',
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(15, 42, 82, 0.8)',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  songInfo: {
    flex: 1,
    alignItems: 'center',
    marginLeft: 20, // Offset for the download button on the right
  },
  downloadButton: {
    padding: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Playfair Display',
    textAlign: 'center',
  },
  artist: {
    color: '#d4af37',
    fontSize: 14,
    marginTop: 4,
    opacity: 0.8,
    letterSpacing: 1,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#d4af37',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 30,
  },
  controlButton: {
    padding: 10,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 25,
    gap: 12,
    paddingHorizontal: 10,
  },
});

