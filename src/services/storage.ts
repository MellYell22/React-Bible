
export const DOWNLOADS_KEY = 'bible_mood_search_downloads';

export const getDownloadedSongs = (): string[] => {
  const stored = localStorage.getItem(DOWNLOADS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse downloads', e);
    return [];
  }
};

export const toggleDownload = (songId: string): boolean => {
  const downloads = getDownloadedSongs();
  const index = downloads.indexOf(songId);
  let isDownloaded = false;
  
  if (index === -1) {
    downloads.push(songId);
    isDownloaded = true;
  } else {
    downloads.splice(index, 1);
    isDownloaded = false;
  }
  
  localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
  return isDownloaded;
};

export const isSongDownloaded = (songId: string): boolean => {
  const downloads = getDownloadedSongs();
  return downloads.includes(songId);
};
