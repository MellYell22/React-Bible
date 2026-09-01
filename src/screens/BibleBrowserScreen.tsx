import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { motion } from 'motion/react';
import { ChevronRight, ChevronLeft, BookOpen, Bookmark, Check } from 'lucide-react';

const MotionView = motion(View);
import { supabase, saveScripture } from '../services/supabase';
import { Profile } from '../types';

const BIBLE_BOOKS = [
  { name: 'Genesis', chapters: 50 }, { name: 'Exodus', chapters: 40 }, { name: 'Leviticus', chapters: 27 },
  { name: 'Numbers', chapters: 36 }, { name: 'Deuteronomy', chapters: 34 }, { name: 'Joshua', chapters: 24 },
  { name: 'Judges', chapters: 21 }, { name: 'Ruth', chapters: 4 }, { name: '1 Samuel', chapters: 31 },
  { name: '2 Samuel', chapters: 24 }, { name: '1 Kings', chapters: 22 }, { name: '2 Kings', chapters: 25 },
  { name: '1 Chronicles', chapters: 29 }, { name: '2 Chronicles', chapters: 36 }, { name: 'Ezra', chapters: 10 },
  { name: 'Nehemiah', chapters: 13 }, { name: 'Esther', chapters: 10 }, { name: 'Job', chapters: 42 },
  { name: 'Psalms', chapters: 150 }, { name: 'Proverbs', chapters: 31 }, { name: 'Ecclesiastes', chapters: 12 },
  { name: 'Song of Solomon', chapters: 8 }, { name: 'Isaiah', chapters: 66 }, { name: 'Jeremiah', chapters: 52 },
  { name: 'Lamentations', chapters: 5 }, { name: 'Ezekiel', chapters: 48 }, { name: 'Daniel', chapters: 12 },
  { name: 'Hosea', chapters: 14 }, { name: 'Joel', chapters: 3 }, { name: 'Amos', chapters: 9 },
  { name: 'Obadiah', chapters: 1 }, { name: 'Jonah', chapters: 4 }, { name: 'Micah', chapters: 7 },
  { name: 'Nahum', chapters: 3 }, { name: 'Habakkuk', chapters: 3 }, { name: 'Zephaniah', chapters: 3 },
  { name: 'Haggai', chapters: 2 }, { name: 'Zechariah', chapters: 14 }, { name: 'Malachi', chapters: 4 },
  { name: 'Matthew', chapters: 28 }, { name: 'Mark', chapters: 16 }, { name: 'Luke', chapters: 24 },
  { name: 'John', chapters: 21 }, { name: 'Acts', chapters: 28 }, { name: 'Romans', chapters: 16 },
  { name: '1 Corinthians', chapters: 16 }, { name: '2 Corinthians', chapters: 13 }, { name: 'Galatians', chapters: 6 },
  { name: 'Ephesians', chapters: 6 }, { name: 'Philippians', chapters: 4 }, { name: 'Colossians', chapters: 4 },
  { name: '1 Thessalonians', chapters: 5 }, { name: '2 Thessalonians', chapters: 3 }, { name: '1 Timothy', chapters: 6 },
  { name: '2 Timothy', chapters: 4 }, { name: 'Titus', chapters: 3 }, { name: 'Philemon', chapters: 1 },
  { name: 'Hebrews', chapters: 13 }, { name: 'James', chapters: 5 }, { name: '1 Peter', chapters: 5 },
  { name: '2 Peter', chapters: 3 }, { name: '1 John', chapters: 5 }, { name: '2 John', chapters: 1 },
  { name: '3 John', chapters: 1 }, { name: 'Jude', chapters: 1 }, { name: 'Revelation', chapters: 22 }
];

type BibleApiVerse = {
  book_id: string;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
};

type BibleApiResponse = {
  reference?: string;
  verses?: BibleApiVerse[];
  text?: string;
  translation_id?: string;
  translation_name?: string;
  error?: string;
};

const BIBLE_API_BASE = 'https://dailybible.ca/api';

export default function BibleBrowserScreen() {
  const [view, setView] = useState<'books' | 'chapters' | 'verses' | 'content'>('books');
  const [selectedBook, setSelectedBook] = useState<typeof BIBLE_BOOKS[0] | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [chapterVerses, setChapterVerses] = useState<BibleApiVerse[]>([]);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);

  useEffect(() => {
    void fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data);
    }
  };

  const preferredTranslation = profile?.preferred_translation || 'KJV';
  const readerTranslation = 'KJV';
  const isUsingKjvFallback = preferredTranslation !== 'KJV';

  const selectedVerseData = useMemo(
    () => chapterVerses.find(item => item.verse === selectedVerse) || null,
    [chapterVerses, selectedVerse],
  );

  const fetchChapter = async (bookName: string, chapter: number) => {
    setChapterLoading(true);
    setChapterError(null);
    setChapterVerses([]);

    try {
      const reference = `${bookName} ${chapter}`;
      const response = await fetch(`${BIBLE_API_BASE}/${encodeURIComponent(reference)}?translation=kjv`, {
        headers: { Accept: 'application/json' },
      });

      const data = await response.json() as BibleApiResponse;
      if (!response.ok || data.error) {
        throw new Error(data.error || `Bible service returned ${response.status}.`);
      }

      const verses = Array.isArray(data.verses) ? data.verses : [];
      if (!verses.length) {
        throw new Error('No scripture text was returned for this chapter.');
      }

      setChapterVerses(verses);
    } catch (error: any) {
      console.error('[BibleBrowser] Could not load chapter:', error);
      setChapterError(
        error?.message || 'The Bible text could not load right now. Please try again.'
      );
    } finally {
      setChapterLoading(false);
    }
  };

  const handleBookSelect = (book: typeof BIBLE_BOOKS[0]) => {
    setSelectedBook(book);
    setSelectedChapter(null);
    setSelectedVerse(null);
    setChapterVerses([]);
    setChapterError(null);
    setView('chapters');
    setHasSaved(false);
  };

  const handleChapterSelect = (chapter: number) => {
    if (!selectedBook) return;
    setSelectedChapter(chapter);
    setSelectedVerse(null);
    setView('verses');
    setHasSaved(false);
    void fetchChapter(selectedBook.name, chapter);
  };

  const handleVerseSelect = (verse: number) => {
    setSelectedVerse(verse);
    setView('content');
    setHasSaved(false);
  };

  const handleSave = async () => {
    if (!profile || !selectedBook || !selectedChapter || !selectedVerseData || isSaving || hasSaved) return;

    setIsSaving(true);
    try {
      const scripture = {
        verse: selectedVerseData.text.trim(),
        reference: `${selectedBook.name} ${selectedChapter}:${selectedVerseData.verse}`,
        explanation: `Reading from the ${readerTranslation} translation.`
      };

      await saveScripture(
        profile.id,
        scripture,
        readerTranslation,
        `Bible Browse: ${selectedBook.name}`
      );
      setHasSaved(true);
    } catch (error) {
      console.error('Error saving scripture:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const goBack = () => {
    if (view === 'chapters') setView('books');
    else if (view === 'verses') setView('chapters');
    else if (view === 'content') setView('verses');
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {view !== 'books' && (
        <TouchableOpacity role="button" aria-label="Back" onPress={goBack} style={styles.backButton}>
          <ChevronLeft color="#d4af37" size={24} />
        </TouchableOpacity>
      )}
      <View style={styles.headerTextWrap}>
        <Text style={styles.headerTitle} role="heading" aria-level={1}>
          {view === 'books' ? 'Select Book' :
           view === 'chapters' ? selectedBook?.name :
           view === 'verses' ? `${selectedBook?.name} ${selectedChapter}` :
           `${selectedBook?.name} ${selectedChapter}:${selectedVerse}`}
        </Text>
        <Text style={styles.translationLabel}>{readerTranslation} READER</Text>
      </View>
    </View>
  );

  const renderTranslationNotice = () => isUsingKjvFallback ? (
    <View style={styles.translationNotice}>
      <Text style={styles.translationNoticeText}>
        Your preferred translation is {preferredTranslation}. Full-text {preferredTranslation} licensing is not connected yet, so the Bible reader is showing the public-domain KJV for now.
      </Text>
    </View>
  ) : null;

  const renderBooks = () => (
    <FlatList
      data={BIBLE_BOOKS}
      keyExtractor={(item) => item.name}
      ListHeaderComponent={renderTranslationNotice}
      renderItem={({ item }) => (
        <TouchableOpacity role="button" style={styles.listItem} onPress={() => handleBookSelect(item)}>
          <Text style={styles.listItemText}>{item.name}</Text>
          <ChevronRight color="rgba(212, 175, 55, 0.3)" size={20} />
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.listContent}
    />
  );

  const renderChapters = () => {
    if (!selectedBook) return null;
    const chapters = Array.from({ length: selectedBook.chapters }, (_, i) => i + 1);
    return (
      <FlatList
        data={chapters}
        numColumns={5}
        keyExtractor={(item) => item.toString()}
        renderItem={({ item }) => (
          <MotionView
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(212, 175, 55, 0.1)' }}
            whileTap={{ scale: 0.95 }}
            style={{ flex: 1, margin: 6 }}
          >
            <TouchableOpacity role="button" style={[styles.gridItem, { margin: 0 }]} onPress={() => handleChapterSelect(item)}>
              <Text style={styles.gridItemText}>{item}</Text>
            </TouchableOpacity>
          </MotionView>
        )}
        contentContainerStyle={styles.gridContent}
      />
    );
  };

  const renderVerses = () => {
    if (chapterLoading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator color="#d4af37" size="large" />
          <Text style={styles.centerStateText}>Loading {selectedBook?.name} {selectedChapter}…</Text>
        </View>
      );
    }

    if (chapterError) {
      return (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{chapterError}</Text>
          <TouchableOpacity role="button"
            style={styles.retryButton}
            onPress={() => selectedBook && selectedChapter && void fetchChapter(selectedBook.name, selectedChapter)}
          >
            <Text style={styles.retryButtonText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // The chapter text is already in `chapterVerses`; this view used to render
    // only a grid of verse numbers and drop `item.text` entirely, so opening a
    // chapter showed an empty page. Render the scripture, with each verse
    // tappable to open it on its own.
    return (
      <FlatList
        data={chapterVerses}
        keyExtractor={(item) => `${item.chapter}-${item.verse}`}
        renderItem={({ item }) => (
          <TouchableOpacity
            role="button"
            aria-label={`${selectedBook?.name} ${item.chapter}:${item.verse}`}
            style={styles.verseRow}
            onPress={() => handleVerseSelect(item.verse)}
            activeOpacity={0.7}
          >
            <Text style={styles.verseNumber}>{item.verse}</Text>
            <Text style={styles.verseText}>{item.text.trim()}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.chapterContent}
      />
    );
  };

  const renderContent = () => (
    <ScrollView style={styles.contentContainer} contentContainerStyle={styles.contentScroll}>
      <View style={styles.contentCard}>
        <BookOpen color="#d4af37" size={32} style={{ alignSelf: 'center', marginBottom: 20 }} />
        <Text style={styles.referenceText}>
          {selectedBook?.name} {selectedChapter}:{selectedVerse} ({readerTranslation})
        </Text>

        {selectedVerseData ? (
          <Text style={styles.verseBody}>“{selectedVerseData.text.trim()}”</Text>
        ) : (
          <Text style={styles.errorText}>That verse could not be found. Go back and choose it again.</Text>
        )}

        <TouchableOpacity role="button"
          style={[
            styles.actionButton,
            styles.saveButton,
            hasSaved && { opacity: 0.7 },
            !selectedVerseData && { opacity: 0.45 },
          ]}
          onPress={handleSave}
          disabled={isSaving || hasSaved || !selectedVerseData}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#d4af37" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {hasSaved ? <Check size={18} color="#d4af37" /> : <Bookmark size={18} color="#d4af37" />}
              <Text style={[styles.actionButtonText, { color: '#d4af37' }]}>
                {hasSaved ? 'SAVED TO MY LIST' : 'SAVE TO MY LIST'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity role="button" style={styles.actionButton} onPress={() => setView('books')}>
          <Text style={styles.actionButtonText}>BROWSE MORE</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      <View style={styles.main}>
        {view === 'books' && renderBooks()}
        {view === 'chapters' && renderChapters()}
        {view === 'verses' && renderVerses()}
        {view === 'content' && renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(11, 30, 61, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
  },
  backButton: {
    marginRight: 15,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d4af37',
    fontFamily: 'Playfair Display',
  },
  translationLabel: {
    marginTop: 4,
    color: 'rgba(245, 215, 122, 0.55)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  main: {
    flex: 1,
  },
  translationNotice: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  translationNoticeText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontFamily: 'Playfair Display',
    fontSize: 13,
    lineHeight: 20,
  },
  listContent: {
    padding: 20,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.1)',
  },
  listItemText: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Playfair Display',
  },
  gridContent: {
    padding: 12,
  },
  gridItem: {
    aspectRatio: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  chapterContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },

  verseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 12,
  },

  verseNumber: {
    fontFamily: 'Cinzel',
    fontSize: 12,
    fontWeight: '700',
    color: '#d4af37',
    minWidth: 26,
    paddingTop: 4,
    textAlign: 'right',
  },

  verseText: {
    flex: 1,
    fontFamily: 'Playfair Display',
    fontSize: 17,
    lineHeight: 28,
    color: '#f4efe4',
  },

  gridItemSmall: {
    aspectRatio: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  gridItemText: {
    fontSize: 16,
    color: '#d4af37',
    fontWeight: '600',
    fontFamily: 'Playfair Display',
  },
  gridItemTextSmall: {
    fontSize: 13,
    color: '#f5d77a',
    fontWeight: '500',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  centerStateText: {
    marginTop: 14,
    color: 'rgba(255, 255, 255, 0.68)',
    fontFamily: 'Playfair Display',
    fontSize: 14,
  },
  errorText: {
    color: '#ffb4b4',
    fontFamily: 'Playfair Display',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 18,
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d4af37',
  },
  retryButtonText: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  contentContainer: {
    flex: 1,
  },
  contentScroll: {
    padding: 20,
  },
  contentCard: {
    backgroundColor: 'rgba(13, 34, 61, 0.66)',
    borderRadius: 24,
    padding: 30,
    borderWidth: 1,
    borderColor: '#d4af37',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  referenceText: {
    fontSize: 14,
    color: '#d4af37',
    fontFamily: 'Cinzel',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 20,
  },
  verseBody: {
    fontSize: 18,
    color: '#ffffff',
    lineHeight: 30,
    textAlign: 'center',
    fontFamily: 'Playfair Display',
    fontStyle: 'italic',
    marginBottom: 30,
  },
  actionButton: {
    backgroundColor: '#d4af37',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.5)',
    marginBottom: 15,
  },
  actionButtonText: {
    color: '#0b1e3d',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
  }
});
