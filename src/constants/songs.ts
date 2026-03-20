export interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  moods: string[];
  genre: 'Pop Gospel' | 'R&B Gospel' | 'Country Gospel' | 'Worship / Praise';
  coverUrl: string;
}

export const WORSHIP_SONGS: Song[] = [
  {
    id: '1',
    title: 'Jireh',
    artist: 'Maverick City Music',
    // Modern Worship - Atmospheric, powerful
    url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3', 
    moods: ['HOPEFUL', 'GRATEFUL'],
    genre: 'Worship / Praise',
    coverUrl: 'https://picsum.photos/seed/jireh/300/300'
  },
  {
    id: '2',
    title: 'Love Theory',
    artist: 'Kirk Franklin',
    // R&B Gospel - Upbeat, rhythmic
    url: 'https://cdn.pixabay.com/audio/2022/10/14/audio_9939716c1d.mp3',
    moods: ['GRATEFUL', 'HOPEFUL'],
    genre: 'R&B Gospel',
    coverUrl: 'https://picsum.photos/seed/lovetheory/300/300'
  },
  {
    id: '3',
    title: 'Cycles',
    artist: 'Jonathan McReynolds',
    // R&B Gospel - Soulful, reflective
    url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73084.mp3',
    moods: ['ANXIOUS', 'SAD'],
    genre: 'R&B Gospel',
    coverUrl: 'https://picsum.photos/seed/cycles/300/300'
  },
  {
    id: '4',
    title: 'Old Church Choir',
    artist: 'Zach Williams',
    // Country Gospel - Upbeat, folk/country
    url: 'https://cdn.pixabay.com/audio/2022/08/04/audio_2d6108473c.mp3',
    moods: ['GRATEFUL', 'HOPEFUL'],
    genre: 'Country Gospel',
    coverUrl: 'https://picsum.photos/seed/choir/300/300'
  },
  {
    id: '5',
    title: 'Something in the Water',
    artist: 'Carrie Underwood',
    // Country Gospel - Inspiring, acoustic
    url: 'https://cdn.pixabay.com/audio/2021/11/25/audio_91b32e02f9.mp3',
    moods: ['HOPEFUL', 'GRATEFUL'],
    genre: 'Country Gospel',
    coverUrl: 'https://picsum.photos/seed/water/300/300'
  },
  {
    id: '6',
    title: 'You Know My Name',
    artist: 'Tasha Cobbs Leonard',
    // Modern Worship - Deep, emotional
    url: 'https://cdn.pixabay.com/audio/2022/01/26/audio_d0c6b1330d.mp3',
    moods: ['LONELY', 'ANXIOUS'],
    genre: 'Worship / Praise',
    coverUrl: 'https://picsum.photos/seed/name/300/300'
  },
  {
    id: '7',
    title: 'Believe For It',
    artist: 'CeCe Winans',
    // Modern Worship - Grand, cinematic
    url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_783ed5a0f0.mp3',
    moods: ['HOPEFUL', 'ANXIOUS'],
    genre: 'Worship / Praise',
    coverUrl: 'https://picsum.photos/seed/believe/300/300'
  },
  {
    id: '8',
    title: 'Keep Me In The Moment',
    artist: 'Jeremy Camp',
    // Pop Gospel - Contemporary, driving
    url: 'https://cdn.pixabay.com/audio/2022/05/17/audio_1997aed91f.mp3',
    moods: ['ANXIOUS', 'GRATEFUL'],
    genre: 'Pop Gospel',
    coverUrl: 'https://picsum.photos/seed/moment/300/300'
  },
  {
    id: '9',
    title: 'Hold On To Me',
    artist: 'Lauren Daigle',
    // Pop Gospel - Soft, piano-led
    url: 'https://cdn.pixabay.com/audio/2021/08/09/audio_8816222b4d.mp3',
    moods: ['LONELY', 'SAD'],
    genre: 'Pop Gospel',
    coverUrl: 'https://picsum.photos/seed/holdon/300/300'
  }
];
