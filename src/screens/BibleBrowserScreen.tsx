import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Book, BookOpen, Bookmark, Check, ChevronLeft, Search } from 'lucide-react';
import { supabase, saveScripture } from '../services/supabase';
import { Profile } from '../types';
import { APP_COLORS, APP_FONTS } from '../designSystem';

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
  { name: '3 John', chapters: 1 }, { name: 'Jude', chapters: 1 }, { name: 'Revelation', chapters: 22 },
];

const FEATURED_BOOKS = ['Genesis', 'Exodus', 'Psalms', 'Proverbs', 'Isaiah', 'Matthew'];

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
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const [view, setView] = useState<'books' | 'chapters' | 'verses' | 'content'>('books');
  const [selectedBook, setSelectedBook] = useState<(typeof BIBLE_BOOKS)[0] | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [query, setQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [chapterVerses, setChapterVerses] = useState<BibleApiVerse[]>([]);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data);
    })();
  }, []);

  const filteredBooks = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return BIBLE_BOOKS.filter((book) => FEATURED_BOOKS.includes(book.name));
    return BIBLE_BOOKS.filter((book) => book.name.toLowerCase().includes(trimmed));
  }, [query]);

  const preferredTranslation = profile?.preferred_translation || 'KJV';
  const readerTranslation = 'KJV';
  const isUsingKjvFallback = preferredTranslation !== 'KJV';

  const selectedVerseData = useMemo(
    () => chapterVerses.find((item) => item.verse === selectedVerse) || null,
    [chapterVerses, selectedVerse],
  );

  const fetchChapter = async (bookName: string, chapter: number) => {
    setChapterLoading(true);
    setChapterError(null);
    setChapterVerses([]);
    try {
      const reference = `${bookName} ${chapter}`;
      const response = await fetch(`${BIBLE_API_BASE}/${encodeURIComponent(reference)}?translation=kjv`, { headers: { Accept: 'application/json' } });
      const data = await response.json() as BibleApiResponse;
      if (!response.ok || data.error) throw new Error(data.error || `Bible service returned ${response.status}.`);
      const verses = Array.isArray(data.verses) ? data.verses : [];
      if (!verses.length) throw new Error('No scripture text was returned for this chapter.');
      setChapterVerses(verses);
    } catch (error: any) {
      console.error('[BibleBrowser] Could not load chapter:', error);
      setChapterError(error?.message || 'The Bible text could not load right now. Please try again.');
    } finally {
      setChapterLoading(false);
    }
  };

  const handleBookSelect = (book: (typeof BIBLE_BOOKS)[0]) => { setSelectedBook(book); setSelectedChapter(null); setSelectedVerse(null); setChapterVerses([]); setChapterError(null); setHasSaved(false); setView('chapters'); };
  const handleChapterSelect = (chapter: number) => { if (!selectedBook) return; setSelectedChapter(chapter); setSelectedVerse(null); setHasSaved(false); setView('verses'); void fetchChapter(selectedBook.name, chapter); };
  const handleVerseSelect = (verse: number) => { setSelectedVerse(verse); setHasSaved(false); setView('content'); };
  const goBack = () => { if (view === 'chapters') setView('books'); else if (view === 'verses') setView('chapters'); else if (view === 'content') setView('verses'); };

  const handleSave = async () => {
    if (!profile || !selectedBook || !selectedChapter || !selectedVerseData || isSaving || hasSaved) return;
    setIsSaving(true);
    try {
      await saveScripture(profile.id, {
        verse: selectedVerseData.text.trim(),
        reference: `${selectedBook.name} ${selectedChapter}:${selectedVerseData.verse}`,
        explanation: `Reading from the ${readerTranslation} translation.`,
      }, readerTranslation, `Bible Browse: ${selectedBook.name}`);
      setHasSaved(true);
    } catch (error) {
      console.error('Error saving scripture:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderBooks = () => (
    <ScrollView contentContainerStyle={styles.booksContent}>
      <View style={styles.headingBlock}>
        <Text style={styles.title}>EXPLORE SCRIPTURE</Text>
      </View>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={18} color={APP_COLORS.gold} />
          <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search by book, topic, or keyword..." placeholderTextColor="rgba(255,248,231,0.48)" />
        </View>
        <TouchableOpacity style={styles.searchButton}><Text style={styles.searchButtonText}>SEARCH</Text></TouchableOpacity>
      </View>

      {isUsingKjvFallback && (
        <View style={styles.translationNotice}>
          <Text style={styles.translationNoticeText}>Your preferred translation is {preferredTranslation}. The Bible reader is showing the public-domain KJV until full-text licensing is connected.</Text>
        </View>
      )}

      <View style={styles.bookGrid}>
        {filteredBooks.map((book) => (
          <TouchableOpacity key={book.name} style={[styles.bookTile, compact && styles.bookTileCompact]} onPress={() => handleBookSelect(book)}>
            <BookOpen size={27} color={APP_COLORS.gold} strokeWidth={1.6} />
            <Text style={styles.bookTileText}>{book.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!query && <Image source={{ uri: '/design/bible-banner.png' }} style={styles.banner} resizeMode="cover" />}
      {!!query && filteredBooks.length === 0 && <Text style={styles.emptyText}>No Bible books match that search.</Text>}
    </ScrollView>
  );

  const renderChapters = () => {
    const chapters = selectedBook ? Array.from({ length: selectedBook.chapters }, (_, i) => i + 1) : [];
    return (
      <View style={styles.browserView}>
        <View style={styles.subHeader}><TouchableOpacity onPress={goBack}><ChevronLeft size={23} color={APP_COLORS.gold} /></TouchableOpacity><Text style={styles.subHeaderTitle}>{selectedBook?.name}</Text></View>
        <FlatList data={chapters} numColumns={compact ? 4 : 6} key={compact ? 'chapters-4' : 'chapters-6'} keyExtractor={(item) => String(item)} contentContainerStyle={styles.numberGrid} renderItem={({ item }) => (
          <TouchableOpacity style={styles.numberTile} onPress={() => handleChapterSelect(item)}><Text style={styles.numberText}>{item}</Text></TouchableOpacity>
        )} />
      </View>
    );
  };

  const renderVerses = () => {
    if (chapterLoading) {
      return (
        <View style={styles.browserView}>
          <View style={styles.subHeader}><TouchableOpacity onPress={goBack}><ChevronLeft size={23} color={APP_COLORS.gold} /></TouchableOpacity><Text style={styles.subHeaderTitle}>{selectedBook?.name} {selectedChapter}</Text></View>
          <View style={styles.centerState}><ActivityIndicator color={APP_COLORS.gold} size="large" /><Text style={styles.centerStateText}>Loading scripture…</Text></View>
        </View>
      );
    }
    if (chapterError) {
      return (
        <View style={styles.browserView}>
          <View style={styles.subHeader}><TouchableOpacity onPress={goBack}><ChevronLeft size={23} color={APP_COLORS.gold} /></TouchableOpacity><Text style={styles.subHeaderTitle}>{selectedBook?.name} {selectedChapter}</Text></View>
          <View style={styles.centerState}><Text style={styles.errorText}>{chapterError}</Text><TouchableOpacity style={styles.primaryButton} onPress={() => selectedBook && selectedChapter && void fetchChapter(selectedBook.name, selectedChapter)}><Text style={styles.primaryButtonText}>TRY AGAIN</Text></TouchableOpacity></View>
        </View>
      );
    }
    return (
      <View style={styles.browserView}>
        <View style={styles.subHeader}><TouchableOpacity onPress={goBack}><ChevronLeft size={23} color={APP_COLORS.gold} /></TouchableOpacity><Text style={styles.subHeaderTitle}>{selectedBook?.name} {selectedChapter}</Text></View>
        <FlatList data={chapterVerses} keyExtractor={(item) => `${item.chapter}-${item.verse}`} contentContainerStyle={styles.verseList} renderItem={({ item }) => (
          <TouchableOpacity style={styles.verseRow} onPress={() => handleVerseSelect(item.verse)}>
            <Text style={styles.verseNumber}>{item.verse}</Text>
            <Text style={styles.verseText}>{item.text.trim()}</Text>
          </TouchableOpacity>
        )} />
      </View>
    );
  };

  const renderContent = () => (
    <ScrollView contentContainerStyle={styles.readingContent}>
      <View style={styles.subHeader}><TouchableOpacity onPress={goBack}><ChevronLeft size={23} color={APP_COLORS.gold} /></TouchableOpacity><Text style={styles.subHeaderTitle}>{selectedBook?.name} {selectedChapter}:{selectedVerse}</Text></View>
      <View style={styles.readingCard}>
        <Book color={APP_COLORS.gold} size={36} />
        <Text style={styles.reference}>{selectedBook?.name} {selectedChapter}:{selectedVerse} ({readerTranslation})</Text>
        {selectedVerseData ? <Text style={styles.verseBody}>“{selectedVerseData.text.trim()}”</Text> : <Text style={styles.errorText}>That verse could not be found. Go back and choose it again.</Text>}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving || hasSaved || !selectedVerseData}>
          {isSaving ? <ActivityIndicator size="small" color={APP_COLORS.gold} /> : hasSaved ? <Check size={17} color={APP_COLORS.gold} /> : <Bookmark size={17} color={APP_COLORS.gold} />}
          <Text style={styles.saveButtonText}>{hasSaved ? 'SAVED TO MY LIST' : 'SAVE TO MY LIST'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={() => setView('books')}><Text style={styles.primaryButtonText}>BROWSE MORE</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.screen}>
      {view === 'books' && renderBooks()}
      {view === 'chapters' && renderChapters()}
      {view === 'verses' && renderVerses()}
      {view === 'content' && renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_COLORS.navy },
  booksContent: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 24, paddingBottom: 40 },
  headingBlock: { alignItems: 'center', marginBottom: 18 },
  title: { color: APP_COLORS.gold, fontFamily: APP_FONTS.serif, fontSize: 26, fontWeight: '700', letterSpacing: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 14 },
  searchBox: { flex: 1, minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: APP_COLORS.border, backgroundColor: APP_COLORS.navyDeep, paddingHorizontal: 13 },
  searchInput: { flex: 1, color: APP_COLORS.cream, fontFamily: APP_FONTS.sans, fontSize: 11 },
  searchButton: { width: 112, backgroundColor: APP_COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: APP_COLORS.goldSoft },
  searchButtonText: { color: APP_COLORS.navyDeep, fontFamily: APP_FONTS.serif, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  translationNotice: { borderWidth: 1, borderColor: APP_COLORS.borderSoft, backgroundColor: APP_COLORS.panel, padding: 10, marginBottom: 14 },
  translationNoticeText: { color: APP_COLORS.goldSoft, fontFamily: APP_FONTS.sans, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  bookGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  bookTile: { width: '32%', minHeight: 92, borderWidth: 1, borderColor: APP_COLORS.border, backgroundColor: APP_COLORS.navyDeep, alignItems: 'center', justifyContent: 'center', gap: 8 },
  bookTileCompact: { width: '48.5%' },
  bookTileText: { color: APP_COLORS.cream, fontFamily: APP_FONTS.sans, fontSize: 12, fontWeight: '600' },
  banner: { width: '100%', height: 150, marginTop: 18, borderWidth: 1, borderColor: APP_COLORS.border },
  emptyText: { color: APP_COLORS.goldSoft, fontFamily: APP_FONTS.sans, fontSize: 12, textAlign: 'center', marginTop: 24 },
  browserView: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 18 },
  subHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: APP_COLORS.borderSoft, paddingHorizontal: 4 },
  subHeaderTitle: { color: APP_COLORS.gold, fontFamily: APP_FONTS.serif, fontSize: 19, fontWeight: '700' },
  numberGrid: { paddingVertical: 18 },
  numberTile: { flex: 1, aspectRatio: 1, minWidth: 50, margin: 5, borderWidth: 1, borderColor: APP_COLORS.borderSoft, backgroundColor: APP_COLORS.navyDeep, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: APP_COLORS.gold, fontFamily: APP_FONTS.display, fontSize: 16, fontWeight: '600' },
  centerState: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  centerStateText: { color: APP_COLORS.goldSoft, fontFamily: APP_FONTS.sans, fontSize: 12 },
  errorText: { color: '#ffd5d8', fontFamily: APP_FONTS.sans, fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 14 },
  verseList: { paddingVertical: 14 },
  verseRow: { flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: APP_COLORS.borderSoft, paddingVertical: 12, paddingHorizontal: 4 },
  verseNumber: { width: 30, color: APP_COLORS.gold, fontFamily: APP_FONTS.serif, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  verseText: { flex: 1, color: APP_COLORS.cream, fontFamily: APP_FONTS.display, fontSize: 15, lineHeight: 23 },
  readingContent: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 30 },
  readingCard: { marginTop: 22, borderWidth: 1, borderColor: APP_COLORS.border, backgroundColor: APP_COLORS.navyDeep, padding: 28, alignItems: 'center' },
  reference: { color: APP_COLORS.gold, fontFamily: APP_FONTS.serif, fontSize: 13, fontWeight: '700', letterSpacing: 1, marginTop: 15, marginBottom: 18, textAlign: 'center' },
  verseBody: { color: APP_COLORS.cream, fontFamily: APP_FONTS.display, fontSize: 20, fontStyle: 'italic', lineHeight: 31, textAlign: 'center', marginBottom: 24 },
  saveButton: { width: '100%', minHeight: 44, borderWidth: 1, borderColor: APP_COLORS.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 10 },
  saveButtonText: { color: APP_COLORS.gold, fontFamily: APP_FONTS.serif, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  primaryButton: { width: '100%', minHeight: 44, backgroundColor: APP_COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: APP_COLORS.navyDeep, fontFamily: APP_FONTS.serif, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
});
