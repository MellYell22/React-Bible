import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { motion } from 'motion/react';
import { getMoodScriptures, generateSpeech, SPEECH_USER_TAP } from '../services/ai';

const MotionView = motion(View);
import { MoodResponse } from '../types';
import {
  Sparkles,
  Search,
  Send,
  Volume2,
  Frown,
  Wind,
  User,
  Heart,
  Flame,
  Sun,
  HelpCircle,
  Layers,
  Cloud,
  X,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Check,
  MessageCircle,
  Mic,
} from 'lucide-react';
import { saveAIFeedback, saveScripture } from '../services/supabase';
import { MOODS_DATA, MoodData } from '../constants/moods';
import { useUser } from '../UserContext';
import { hasProAccess } from '../utils/tier';

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
  },
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
  "Generate a calm, conversational response based on the user's input. Detect the user's query, then deliver a relevant Bible verse or reflection with a smooth, unhurried pace. Keep responses short, reflective, and responsive to the user's emotional tone.";

const NT_BOOKS = [
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians',
  'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation',
];

export default function MoodScreen({ route, navigation }: any) {
  const { profile } = useUser();
  const [mood, setMood] = useState(route?.params?.mood || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MoodResponse | null>(null);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [guidanceExpanded, setGuidanceExpanded] = useState(false);
  // Roughly where a reply stops fitting a phone screen alongside the actions
  // beneath it. Longer replies open clamped with a "continue reading" toggle.
  const isLongGuidance = (result?.encouragement?.length ?? 0) > 420;
  const [testamentFilter, setTestamentFilter] = useState<'all' | 'old' | 'new'>('all');
  const [readingMode] = useState<ReadingMode>('sanctuary');
  const [fontSize] = useState<FontSize>('medium');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);

  const theme = THEMES[readingMode];
  const fonts = FONT_SIZES[fontSize];
  const voiceIncluded = hasProAccess(profile);

  const buildStaticMoodEncouragement = (staticMood: MoodData): string => {
    const reaction = staticMood.davidReaction[0];
    const scripture = staticMood.scriptures[0];
    const followUp = staticMood.davidFollowUps[0];

    if (!reaction || !scripture || !followUp) {
      return `Yeah. ${staticMood.label.toLowerCase()} can be a lot to carry. Let's sit with God's word for a minute.`;
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
      void handleInitialSearch(route.params.mood);
    }
  }, [route?.params?.mood]);

  const handleInitialSearch = async (initialMood: string) => {
    // Ahead of the static-mood early return below, or a reply that was expanded
    // stays expanded when the next one replaces it.
    setGuidanceExpanded(false);
    const staticMood = MOODS_DATA.find(m => m.key === initialMood.toUpperCase());

    if (staticMood) {
      setResult({
        scriptures: staticMood.scriptures.map(s => ({ ...s, explanation: "Reflecting on God's word for your heart today." })),
        encouragement: buildStaticMoodEncouragement(staticMood),
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
        MOOD_VOICE_RESPONSE_INSTRUCTION,
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
    if (!query || loading) return;

    setGuidanceExpanded(false);

    const staticMood = MOODS_DATA.find(
      m => m.label.toLowerCase() === query.toLowerCase() || m.key === query.toUpperCase(),
    );

    if (staticMood) {
      setMood(staticMood.key);
      setSearchQuery('');
      setResult({
        scriptures: staticMood.scriptures.map(s => ({ ...s, explanation: "Reflecting on God's word for your heart today." })),
        encouragement: buildStaticMoodEncouragement(staticMood),
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setMood(query);
    setSearchQuery('');
    setTestamentFilter('all');
    setFeedback(null);

    try {
      const data = await getMoodScriptures(
        query,
        profile?.preferred_translation || 'KJV',
        profile?.preferred_response_length || 'medium',
        MOOD_VOICE_RESPONSE_INSTRUCTION,
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
      // generateSpeech returns a blob URL — use HTML Audio directly (NOT base64/AudioContext)
      const audioUrl = await generateSpeech(result.encouragement, { source: SPEECH_USER_TAP });
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        // Read-aloud should feel close and calm, never like a loud media player.
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
      console.error('Speech error:', error);
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
      await saveScripture(
        profile.id,
        item,
        profile.preferred_translation || 'KJV',
        mood || 'Search',
      );
      setSavedIds(prev => new Set(prev).add(index));
    } catch (error) {
      console.error('Error saving scripture:', error);
    } finally {
      setSavingId(null);
    }
  };

  const continueInTextChat = () => {
    const moodText = mood ? `I'm feeling ${String(mood).toLowerCase()}.` : '';
    navigation.navigate('Chat', moodText ? {
      initialPrompt: moodText,
      source: 'mood-screen',
      submittedAt: Date.now(),
    } : undefined);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerContainer}>
          <Text style={[styles.title, { color: theme.accent, fontFamily: 'Playfair Display' }]} role="heading" aria-level={1}>
            {mood ? `Reflections on ${mood}` : 'How are you feeling?'}
          </Text>
        </View>

        <View style={styles.searchSection}>
          <Text style={[styles.searchHelp, { color: theme.muted }]}>TYPE A FEELING, THEN TAP SEND</Text>
          <View style={[styles.searchBar, { borderColor: theme.border }]}>
            <View style={styles.searchIconContainer}>
              <Search size={16} color={theme.accent} />
            </View>
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="I am feeling..."
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="send"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity role="button" aria-label="Clear search" onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <X size={14} color={theme.muted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.searchSubmit,
                { backgroundColor: theme.accent },
                (!searchQuery.trim() || loading) && styles.searchSubmitDisabled,
              ]}
              onPress={handleSearch}
              disabled={!searchQuery.trim() || loading}
              accessibilityRole="button"
              accessibilityLabel="Send feeling"
            >
              <Send size={15} color="#0b1e3d" />
              <Text style={styles.searchSubmitText}>SEND</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.moodPills}>
            {MOOD_CONFIG.map((m) => (
              <MotionView
                key={m.key}
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(212, 175, 55, 0.05)' }}
                whileTap={{ scale: 0.98 }}
                style={{ width: '31%', marginBottom: 10 }}
              >
                <TouchableOpacity role="button"
                  style={[
                    styles.moodPill,
                    {
                      borderColor: mood === m.key ? theme.accent : theme.border,
                      width: '100%',
                      marginBottom: 0,
                      backgroundColor: mood === m.key ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    setSearchQuery('');
                    setMood(m.key);
                    void handleInitialSearch(m.key);
                  }}
                >
                  <m.icon size={18} color={mood === m.key ? theme.accent : theme.muted} style={{ marginBottom: 6 }} />
                  <Text style={[styles.moodPillText, { color: mood === m.key ? theme.accent : theme.text }]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              </MotionView>
            ))}
          </View>
        </View>

        {!mood && !loading && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              Enter how you're feeling above or select a mood to see scriptures.
            </Text>
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        )}

        {result && !loading && (
          <View style={styles.resultContainer}>
            <View style={[styles.encouragementCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.guidanceHeader}>
                <View style={styles.guidanceLabelRow}>
                  <Sparkles color={theme.accent} size={20} />
                  <Text style={[styles.guidanceLabel, { color: theme.accent }]}>DAVID'S GUIDANCE</Text>
                </View>
                <TouchableOpacity role="button" onPress={speakEncouragement} disabled={isSpeaking} style={styles.readAloudButton}>
                  {isSpeaking ? (
                    <ActivityIndicator size="small" color={theme.accent} />
                  ) : (
                    <Volume2 color={theme.accent} size={18} />
                  )}
                  <Text style={[styles.readAloudText, { color: theme.accent }]}>READ ALOUD</Text>
                </TouchableOpacity>
              </View>

              <Text
                style={[styles.encouragementText, { color: theme.text, fontSize: fonts.verse - 2, fontFamily: 'Playfair Display' }]}
                numberOfLines={guidanceExpanded ? undefined : 9}
              >
                {result.encouragement}
              </Text>
              {isLongGuidance && (
                <TouchableOpacity
                  role="button"
                  onPress={() => setGuidanceExpanded(v => !v)}
                  style={styles.guidanceToggle}
                >
                  <Text style={[styles.guidanceToggleText, { color: theme.accent }]}>
                    {guidanceExpanded ? 'SHOW LESS' : 'CONTINUE READING'}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.feedbackContainer}>
                <Text style={[styles.feedbackLabel, { color: theme.muted }]}>Was this helpful?</Text>
                <View style={styles.feedbackButtons}>
                  <TouchableOpacity role="button"
                    aria-label="This was helpful"
                    onPress={() => handleFeedback('up')}
                    style={[styles.feedbackButton, feedback === 'up' && { backgroundColor: 'rgba(127, 184, 148, 0.2)' }]}
                  >
                    <ThumbsUp size={16} color={feedback === 'up' ? '#7fb894' : theme.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity role="button"
                    aria-label="This was not helpful"
                    onPress={() => handleFeedback('down')}
                    style={[styles.feedbackButton, feedback === 'down' && { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}
                  >
                    <ThumbsDown size={16} color={feedback === 'down' ? '#ef4444' : theme.muted} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.continueActions}>
                <TouchableOpacity role="button"
                  style={[styles.continueButton, styles.freeChatButton, { backgroundColor: theme.accent }]}
                  onPress={continueInTextChat}
                >
                  <MessageCircle size={15} color="#0b1e3d" />
                  <Text style={styles.freeChatButtonText}>CHAT WITH DAVID</Text>
                  <Text style={styles.freeTag}>FREE</Text>
                </TouchableOpacity>

                <TouchableOpacity role="button"
                  style={[styles.continueButton, styles.voiceButton, { borderColor: theme.accent }]}
                  onPress={() => navigation.navigate('Voice', { mood })}
                >
                  <Mic size={15} color={theme.accent} />
                  <Text style={[styles.voiceButtonText, { color: theme.accent }]}>VOICE WITH DAVID</Text>
                  <Text style={[styles.proTag, { color: theme.accent }]}>{voiceIncluded ? 'INCLUDED' : 'PRO'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterContainer}>
              <TouchableOpacity role="button"
                style={[styles.filterPill, testamentFilter === 'all' && { backgroundColor: theme.accent }]}
                onPress={() => setTestamentFilter('all')}
              >
                <Text style={[styles.filterText, testamentFilter === 'all' && { color: '#fff' }]}>ALL</Text>
              </TouchableOpacity>
              <TouchableOpacity role="button"
                style={[styles.filterPill, testamentFilter === 'old' && { backgroundColor: theme.accent }]}
                onPress={() => setTestamentFilter('old')}
              >
                <Text style={[styles.filterText, testamentFilter === 'old' && { color: '#fff' }]}>OLD TESTAMENT</Text>
              </TouchableOpacity>
              <TouchableOpacity role="button"
                style={[styles.filterPill, testamentFilter === 'new' && { backgroundColor: theme.accent }]}
                onPress={() => setTestamentFilter('new')}
              >
                <Text style={[styles.filterText, testamentFilter === 'new' && { color: '#fff' }]}>NEW TESTAMENT</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              {testamentFilter === 'all'
                ? 'Relevant Scriptures'
                : testamentFilter === 'old'
                  ? 'Old Testament Wisdom'
                  : 'New Testament Hope'}
            </Text>

            {filteredScriptures.length === 0 ? (
              <View style={styles.noResults}>
                <Text style={[styles.noResultsText, { color: theme.muted }]}>
                  No scriptures found in this testament for your search.
                </Text>
              </View>
            ) : (
              filteredScriptures.map((item, index) => (
                <View
                  key={index}
                  style={[styles.scriptureCard, { backgroundColor: theme.scripture, borderColor: theme.border }]}
                >
                  <View style={styles.verseHeader}>
                    <View style={[styles.verseNumber, { backgroundColor: theme.accent }]}>
                      <Text style={styles.verseNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={[styles.referenceText, { color: theme.accent, fontSize: fonts.ref - 2, marginTop: 0 }]}>
                      {item.reference}
                    </Text>
                  </View>

                  <Text style={[styles.verseText, { color: theme.text, fontSize: fonts.verse - 2, textAlign: 'left', fontFamily: 'Playfair Display' }]}>
                    “{item.verse}”
                  </Text>

                  <View style={[styles.divider, { backgroundColor: theme.border }]} />

                  <View style={styles.verseActions}>
                    <TouchableOpacity role="button"
                      style={[styles.verseActionButton, { borderColor: theme.accent }, savedIds.has(index) && { opacity: 0.7 }]}
                      onPress={() => handleSave(item, index)}
                      disabled={savingId === index || savedIds.has(index)}
                    >
                      {savingId === index ? (
                        <ActivityIndicator size="small" color={theme.accent} />
                      ) : savedIds.has(index) ? (
                        <Check size={14} color="#7fb894" />
                      ) : (
                        <Bookmark size={14} color={theme.accent} />
                      )}
                      <Text style={[styles.verseActionButtonText, { color: savedIds.has(index) ? '#7fb894' : theme.accent }]}>
                        {savedIds.has(index) ? 'SAVED' : 'SAVE VERSE'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.explanationContainer}>
                    <Text style={[styles.explanationLabel, { color: theme.accent }]}>Reflection</Text>
                    <Text style={[styles.explanationText, { color: theme.muted, fontSize: fonts.exp - 2, textAlign: 'left' }]}>
                      {item.explanation}
                    </Text>
                  </View>
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
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 40,
    paddingBottom: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d4af37',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  searchSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  searchHelp: {
    alignSelf: 'flex-start',
    marginBottom: 7,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  searchBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 18,
    paddingLeft: 13,
    paddingRight: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Playfair Display',
    fontStyle: 'italic',
    paddingLeft: 8,
  },
  searchIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButton: {
    padding: 8,
  },
  searchSubmit: {
    minHeight: 34,
    borderRadius: 15,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  searchSubmitDisabled: {
    opacity: 0.35,
  },
  searchSubmitText: {
    color: '#0b1e3d',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  moodPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  moodPill: {
    width: '31%',
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
  },
  moodPillText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  loadingContainer: {
    marginTop: 50,
    alignItems: 'center',
  },
  resultContainer: {
    marginTop: 8,
  },
  encouragementCard: {
    backgroundColor: 'rgba(13, 34, 61, 0.66)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  guidanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  guidanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guidanceToggle: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },

  guidanceToggleText: {
    fontFamily: 'Cinzel',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  guidanceLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  readAloudButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 5,
  },
  readAloudText: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  encouragementText: {
    lineHeight: 22,
    color: '#ffffff',
    fontWeight: '500',
    textAlign: 'center',
    fontStyle: 'italic',
    fontSize: 14,
  },
  continueActions: {
    marginTop: 14,
    gap: 8,
  },
  continueButton: {
    width: '100%',
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  freeChatButton: {
    borderWidth: 0,
  },
  freeChatButtonText: {
    flex: 1,
    color: '#0b1e3d',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  freeTag: {
    color: '#0b1e3d',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  voiceButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  voiceButtonText: {
    flex: 1,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  proTag: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#f5d77a',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  scriptureCard: {
    backgroundColor: 'rgba(18, 47, 83, 0.62)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  verseText: {
    lineHeight: 22,
    color: '#ffffff',
    fontStyle: 'italic',
    fontSize: 14,
  },
  referenceText: {
    fontWeight: 'bold',
    color: '#d4af37',
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    marginVertical: 15,
  },
  explanationText: {
    color: '#f5d77a',
    lineHeight: 18,
    fontSize: 13,
  },
  emptyState: {
    marginTop: 100,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 1,
  },
  verseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  verseNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  verseNumberText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  explanationContainer: {
    marginTop: 5,
  },
  explanationLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  filterText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#d4af37',
    letterSpacing: 0.8,
  },
  noResults: {
    padding: 40,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  feedbackLabel: {
    fontSize: 9,
    fontStyle: 'italic',
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  feedbackButton: {
    padding: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  verseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 15,
  },
  verseActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  verseActionButtonText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
