import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, TextInput, useWindowDimensions } from 'react-native';
import { motion } from 'motion/react';
import { getMoodScriptures, generateSpeech, SPEECH_USER_TAP } from '../services/ai';

const MotionView = motion.create(View);
import { MoodResponse } from '../types';
import { Sparkles, Search, Volume2, Frown, Wind, User, Heart, Flame, Sun, HelpCircle, Layers, Cloud, X, ThumbsUp, ThumbsDown, Bookmark, Check } from 'lucide-react';
import { supabase, saveAIFeedback, saveScripture } from '../services/supabase';
import { Profile } from '../types';
import { MOODS_DATA, MoodData } from '../constants/moods';
import { MessageCircle } from 'lucide-react';

type ReadingMode = 'sanctuary' | 'parchment' | 'midnight';
type FontSize = 'small' | 'medium' | 'large';

const THEMES = {
  sanctuary: {
    bg: 'transparent',
    card: '#0f2a52',
    scripture: '#163d73',
    text: '#ffffff',
    accent: '#d4af37',
    muted: '#f5d77a',
    border: 'rgba(212, 175, 55, 0.3)',
  },
  parchment: {
    bg: '#f4f1ea',
    card: '#ffffff',
    scripture: '#fffcf5',
    text: '#2c2c2c',
    accent: '#8b4513',
    muted: '#5d4037',
    border: 'rgba(139, 69, 19, 0.2)',
  },
  midnight: {
    bg: '#000000',
    card: '#121212',
    scripture: '#1a1a1a',
    text: '#e0e0e0',
    accent: '#d4af37',
    muted: '#a0a0a0',
    border: 'rgba(255, 255, 255, 0.1)',
  }
};

const FONT_SIZES = {
  small: { verse: 16, ref: 12, exp: 12 },
  medium: { verse: 18, ref: 14, exp: 14 },
  large: { verse: 22, ref: 16, exp: 16 },
};

const MOOD_CONFIG = [
  { key: 'ANXIOUS', label: 'Anxious', icon: Wind },
  { key: 'SAD', label: 'Sad', icon: Frown },
  { key: 'LONELY', label: 'Lonely', icon: User },
  { key: 'STRESSED', label: 'Stressed', icon: Wind },
  { key: 'OVERWHELMED', label: 'Overwhelmed', icon: Layers },
  { key: 'HOPEFUL', label: 'Hopeful', icon: Sun },
  { key: 'GRATEFUL', label: 'Grateful', icon: Heart },
  { key: 'ANGRY', label: 'Angry', icon: Flame },
  { key: 'CONFUSED', label: 'Confused', icon: HelpCircle },
  { key: 'JOYFUL', label: 'Joyful', icon: Sun },
  { key: 'PEACEFUL', label: 'Peaceful', icon: Cloud },
];

const MOOD_VOICE_RESPONSE_INSTRUCTION =
  "Generate a real-time, calm, and conversational voice response based on the user's input. Detect the user's query, then deliver a relevant Bible verse or reflection with a smooth, unhurried pace. Keep responses short, reflective, and responsive to the user's emotional tone.";

const NT_BOOKS = [
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 
  'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', 
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', 
  '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

import { useUser } from '../UserContext';

export default function MoodScreen({ route, navigation }: any) {
  const { profile } = useUser();
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const [mood, setMood] = useState(route?.params?.mood || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MoodResponse | null>(null);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [testamentFilter, setTestamentFilter] = useState<'all' | 'old' | 'new'>('all');
  
  const [readingMode, setReadingMode] = useState<ReadingMode>('sanctuary');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);

  const theme = THEMES[readingMode];
  const fonts = FONT_SIZES[fontSize];

  const buildStaticMoodEncouragement = (staticMood: MoodData): string => {
    const reaction = staticMood.davidReaction[0];
    const scripture = staticMood.scriptures[0];
    const followUp = staticMood.davidFollowUps[0];

    if (!reaction || !scripture || !followUp) {
      return `yeah… ${staticMood.label.toLowerCase()} can be a lot to carry. let's sit with God's word for a minute.`;
    }

    return [
      reaction,
      `${scripture.davidIntro} ${scripture.verse}`,
      `${scripture.reference}. ${scripture.davidReflection}`,
      followUp,
    ].join(' ');
  };

  React.useEffect(() => {
    if (route?.params?.mood) {
      handleInitialSearch(route.params.mood);
    }
  }, [route?.params?.mood]);

  const handleInitialSearch = async (initialMood: string) => {
    const staticMood = MOODS_DATA.find(m => m.key === initialMood.toUpperCase());
    
    if (staticMood) {
      setResult({
        scriptures: staticMood.scriptures.map(s => ({ ...s, explanation: 'Reflecting on God\'s word for your heart today.' })),
        encouragement: buildStaticMoodEncouragement(staticMood)
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getMoodScriptures(
        initialMood, 
        profile?.preferred_translation || 'KJV',
        profile?.preferred_response_length || 'medium',
        MOOD_VOICE_RESPONSE_INSTRUCTION
      );
      setResult(data);
      setFeedback(null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    const query = (searchQuery || mood).trim();
    if (!query) return;

    const staticMood = MOODS_DATA.find(m => m.label.toLowerCase() === query.toLowerCase() || m.key === query.toUpperCase());
    if (staticMood) {
      setMood(staticMood.key);
      setResult({
        scriptures: staticMood.scriptures.map(s => ({ ...s, explanation: 'Reflecting on God\'s word for your heart today.' })),
        encouragement: buildStaticMoodEncouragement(staticMood)
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setMood(query);
    setTestamentFilter('all');
    setFeedback(null);
    try {
      const data = await getMoodScriptures(
        query, 
        profile?.preferred_translation || 'KJV',
        profile?.preferred_response_length || 'medium',
        MOOD_VOICE_RESPONSE_INSTRUCTION
      );
      setResult(data);
    } catch (error) {
      alert('Failed to fetch scriptures. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredScriptures = result?.scriptures.filter(item => {
    if (testamentFilter === 'all') return true;
    const bookName = item.reference.split(' ')[0];
    const fullBookName = item.reference.match(/^[1-3]?\s?[a-zA-Z\s]+(?=\s\d)/)?.[0] || bookName;
    const isNT = NT_BOOKS.includes(fullBookName.trim());
    return testamentFilter === 'new' ? isNT : !isNT;
  }) || [];

  const speakEncouragement = async () => {
    if (!result || isSpeaking) return;
    
    setIsSpeaking(true);
    try {
      const audioUrl = await generateSpeech(result.encouragement, { source: SPEECH_USER_TAP });
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.volume = 0.55;
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          console.error('[MoodScreen] Audio playback error');
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err: any) => {
            console.error('[MoodScreen] audio.play() blocked:', err?.message);
            setIsSpeaking(false);
          });
        }
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("Speech error:", error);
      setIsSpeaking(false);
    }
  };

  const handleFeedback = async (type: 'up' | 'down') => {
    if (!result || !profile) return;
    const isHelpful = type === 'up';
    setFeedback(type);
    await saveAIFeedback(profile.id, 'mood', result.encouragement, isHelpful);
  };

  const handleSave = async (item: any, index: number) => {
    if (!profile || savingId !== null || savedIds.has(index)) return;
    setSavingId(index);
    try {
      await saveScripture(profile.id, item, profile.preferred_translation || 'KJV', mood || 'Search');
      setSavedIds(prev => new Set(prev).add(index));
    } catch (error) {
      console.error('Error saving scripture:', error);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.headingBlock}>
          <Text style={styles.title}>{mood ? `REFLECTIONS ON ${mood}` : 'HOW ARE YOU FEELING?'}</Text>
          <Text style={styles.subtitle}>SELECT A MOOD TO FIND SCRIPTURE, OR TELL DAVID IN YOUR OWN WORDS.</Text>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={19} color="#e1b632" />
            <TextInput
              style={styles.searchInput}
              placeholder="I am feeling..."
              placeholderTextColor="rgba(255,248,231,0.58)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <X size={15} color="#f1d477" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>SEARCH</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.moodGrid}>
          {MOOD_CONFIG.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.moodTile, compact && styles.moodTileCompact, mood === m.key && styles.moodTileActive]}
              onPress={() => {
                setSearchQuery('');
                setMood(m.key);
                handleInitialSearch(m.key);
              }}
            >
              <m.icon size={28} color="#e1b632" strokeWidth={1.8} />
              <Text style={styles.moodTileText}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!mood && !loading && (
          <View style={styles.chatPrompt}>
            <View style={styles.promptRule} />
            <Text style={styles.promptTitle}>NOT SURE HOW YOU FEEL?</Text>
            <Text style={styles.promptText}>Talk to David and just share what’s on your mind.</Text>
            <TouchableOpacity style={styles.chatCta} onPress={() => navigation.navigate('Chat')}>
              <MessageCircle size={19} color="#071a35" />
              <Text style={styles.chatCtaText}>CHAT WITH DAVID</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#e1b632" /></View>}

        {result && !loading && (
          <View style={styles.resultContainer}>
            <View style={styles.encouragementCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardLabelRow}>
                  <Sparkles color="#e1b632" size={18} />
                  <Text style={styles.cardLabel}>DAVID'S GUIDANCE</Text>
                </View>
                <View style={styles.iconActions}>
                  <TouchableOpacity onPress={speakEncouragement} disabled={isSpeaking}>
                    {isSpeaking ? <ActivityIndicator size="small" color="#e1b632" /> : <Volume2 color="#e1b632" size={18} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => navigation.navigate('Chat', { initialPrompt: mood })}>
                    <MessageCircle color="#e1b632" size={18} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.encouragementText}>{result.encouragement}</Text>
              <View style={styles.feedbackRow}>
                <Text style={styles.feedbackLabel}>Was this helpful?</Text>
                <TouchableOpacity onPress={() => handleFeedback('up')} style={styles.feedbackButton}><ThumbsUp size={15} color={feedback === 'up' ? '#e1b632' : 'rgba(241,212,119,0.55)'} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleFeedback('down')} style={styles.feedbackButton}><ThumbsDown size={15} color={feedback === 'down' ? '#ef6a72' : 'rgba(241,212,119,0.55)'} /></TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterRow}>
              {(['all', 'old', 'new'] as const).map((filter) => (
                <TouchableOpacity key={filter} style={[styles.filterButton, testamentFilter === filter && styles.filterButtonActive]} onPress={() => setTestamentFilter(filter)}>
                  <Text style={[styles.filterText, testamentFilter === filter && styles.filterTextActive]}>
                    {filter === 'all' ? 'ALL' : filter === 'old' ? 'OLD TESTAMENT' : 'NEW TESTAMENT'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>RELEVANT SCRIPTURES</Text>
            {filteredScriptures.length === 0 ? (
              <View style={styles.noResults}><Text style={styles.noResultsText}>No scriptures found in this testament for your search.</Text></View>
            ) : (
              filteredScriptures.map((item, index) => (
                <View key={`${item.reference}-${index}`} style={styles.scriptureCard}>
                  <View style={styles.scriptureHeader}>
                    <Text style={styles.referenceText}>{item.reference}</Text>
                    <TouchableOpacity onPress={() => handleSave(item, index)} disabled={savingId === index || savedIds.has(index)}>
                      {savingId === index ? <ActivityIndicator size="small" color="#e1b632" /> : savedIds.has(index) ? <Check size={18} color="#54ba83" /> : <Bookmark size={18} color="#e1b632" />}
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.verseText}>“{item.verse}”</Text>
                  {!!item.explanation && <Text style={styles.explanationText}>{item.explanation}</Text>}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#071a35' },
  scrollView: { flex: 1 },
  content: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 42 },
  headingBlock: { alignItems: 'center', marginBottom: 20 },
  title: { color: '#e1b632', fontFamily: 'Cinzel', fontSize: 28, fontWeight: '700', letterSpacing: 0.7, textAlign: 'center' },
  subtitle: { color: '#f1d477', fontFamily: 'Cinzel', fontSize: 9, fontWeight: '600', letterSpacing: 1, marginTop: 7, textAlign: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 16 },
  searchBox: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: 'rgba(225,182,50,0.68)', backgroundColor: '#03101f', paddingHorizontal: 14 },
  searchInput: { flex: 1, color: '#fff8e7', fontFamily: 'Playfair Display', fontSize: 14, fontStyle: 'italic', paddingVertical: 10 },
  clearButton: { padding: 4 },
  searchButton: { width: 120, backgroundColor: '#e1b632', borderWidth: 1, borderColor: '#f1d477', alignItems: 'center', justifyContent: 'center' },
  searchButtonText: { color: '#071a35', fontFamily: 'Cinzel', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  moodTile: { width: '32%', minHeight: 100, borderWidth: 1, borderColor: 'rgba(225,182,50,0.62)', backgroundColor: '#071a35', alignItems: 'center', justifyContent: 'center', gap: 8 },
  moodTileCompact: { width: '48.5%', minHeight: 92 },
  moodTileActive: { backgroundColor: '#0a2346', borderWidth: 2, borderColor: '#e1b632' },
  moodTileText: { color: '#fff8e7', fontFamily: 'Inter', fontSize: 12, fontWeight: '600' },
  chatPrompt: { alignItems: 'center', marginTop: 28 },
  promptRule: { width: 170, height: 1, backgroundColor: 'rgba(225,182,50,0.72)', marginBottom: 18 },
  promptTitle: { color: '#e1b632', fontFamily: 'Cinzel', fontSize: 16, fontWeight: '700', letterSpacing: 0.8 },
  promptText: { color: '#fff8e7', fontFamily: 'Playfair Display', fontSize: 13, marginTop: 8, textAlign: 'center' },
  chatCta: { minWidth: 330, maxWidth: '100%', minHeight: 46, marginTop: 15, paddingHorizontal: 28, backgroundColor: '#e1b632', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  chatCtaText: { color: '#071a35', fontFamily: 'Cinzel', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  loadingContainer: { paddingVertical: 34, alignItems: 'center' },
  resultContainer: { marginTop: 28, gap: 14 },
  encouragementCard: { borderWidth: 1, borderColor: 'rgba(225,182,50,0.62)', backgroundColor: '#03101f', padding: 18 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLabel: { color: '#e1b632', fontFamily: 'Cinzel', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  iconActions: { flexDirection: 'row', gap: 16 },
  encouragementText: { color: '#fff8e7', fontFamily: 'Playfair Display', fontSize: 16, lineHeight: 24 },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 9, marginTop: 12 },
  feedbackLabel: { color: 'rgba(241,212,119,0.72)', fontFamily: 'Inter', fontSize: 10 },
  feedbackButton: { padding: 4 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterButton: { borderWidth: 1, borderColor: 'rgba(225,182,50,0.48)', paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#03101f' },
  filterButtonActive: { backgroundColor: '#e1b632' },
  filterText: { color: '#f1d477', fontFamily: 'Cinzel', fontSize: 8, fontWeight: '700' },
  filterTextActive: { color: '#071a35' },
  sectionTitle: { color: '#e1b632', fontFamily: 'Cinzel', fontSize: 14, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  scriptureCard: { borderWidth: 1, borderColor: 'rgba(225,182,50,0.48)', backgroundColor: '#0a2141', padding: 18 },
  scriptureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  referenceText: { color: '#e1b632', fontFamily: 'Cinzel', fontSize: 12, fontWeight: '700', letterSpacing: 0.7 },
  verseText: { color: '#fff8e7', fontFamily: 'Playfair Display', fontSize: 18, lineHeight: 27, fontStyle: 'italic' },
  explanationText: { color: 'rgba(255,248,231,0.72)', fontFamily: 'Inter', fontSize: 12, lineHeight: 19, marginTop: 10 },
  noResults: { borderWidth: 1, borderColor: 'rgba(225,182,50,0.38)', padding: 18 },
  noResultsText: { color: '#f1d477', fontFamily: 'Inter', fontSize: 12, textAlign: 'center' },
});
