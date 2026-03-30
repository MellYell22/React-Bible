import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Song, WORSHIP_SONGS } from './constants/songs';

interface MusicContextType {
  currentSong: Song | null;
  playSong: (song: Song) => void;
  stopSong: () => void;
  nextSong: () => void;
  prevSong: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);

  const playSong = (song: Song) => {
    setCurrentSong(song);
  };

  const stopSong = () => {
    setCurrentSong(null);
  };

  const nextSong = () => {
    if (!currentSong) return;
    const currentIndex = WORSHIP_SONGS.findIndex(s => s.id === currentSong.id);
    const nextIndex = (currentIndex + 1) % WORSHIP_SONGS.length;
    setCurrentSong(WORSHIP_SONGS[nextIndex]);
  };

  const prevSong = () => {
    if (!currentSong) return;
    const currentIndex = WORSHIP_SONGS.findIndex(s => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + WORSHIP_SONGS.length) % WORSHIP_SONGS.length;
    setCurrentSong(WORSHIP_SONGS[prevIndex]);
  };

  return (
    <MusicContext.Provider value={{ currentSong, playSong, stopSong, nextSong, prevSong }}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};
