import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, TextInput, Platform } from 'react-native';
import { useUser } from '../UserContext';

const GOLD = '#d4af37';
const SOFT_GOLD = '#f5d77a';
const NAVY = '#0b1e3d';
const DARK_NAVY = '#051020';

// Mood buttons configuration
const MOODS = [
  { key: 'SAD', label: 'SAD' },
  { key: 'ANXIOUS', label: 'ANXIOUS' },
  { key: 'LONELY', label: 'LONELY' },
  { key: 'GRATEFUL', label: 'GRATEFUL' },
  { key: 'ANGRY', label: 'ANGRY' },
  { key: 'HOPEFUL', label: 'HOPEFUL' },
];

// Sample verses of the day
const VERSES_OF_THE_DAY = [
  {
    text: '"Whoever dwells in the shelter of the Most High will rest in the shadow of the Almighty."',
    reference: 'PSALM 91:1',
    date: 'MONDAY, MARCH 2',
  },
  {
    text: '"For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope."',
    reference: 'JEREMIAH 29:11',
    date: 'TUESDAY, MARCH 3',
  },
  {
    text: '"Cast all your anxiety on him because he cares for you."',
    reference: '1 PETER 5:7',
    date: 'WEDNESDAY, MARCH 4',
  },
];

export default function HomeScreen({ navigation }: any) {
  const { profile } = useUser();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [verseIndex, setVerseIndex] = useState(0);
  const [emotionalEntry, setEmotionalEntry] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const currentVerse = VERSES_OF_THE_DAY[verseIndex];

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setVerseIndex((prev) => (prev + 1) % VERSES_OF_THE_DAY.length);
    }, 1000);
  }, []);

  const handleMoodSelect = (mood: string) => {
    setSelectedMood(mood);
    navigation.navigate('Mood', { mood });
  };

  const handleEmotionalEntrySubmit = () => {
    const prompt = emotionalEntry.trim();
    if (!prompt) return;

    setEmotionalEntry('');
    navigation.navigate('Chat', {
      initialPrompt: prompt,
      source: 'home-emotional-search',
      submittedAt: Date.now(),
    });
  };

  const handleTalkWithDavid = () => {
    navigation.navigate('Voice');
  };

  const handleReflection = () => {
    navigation.navigate('Reflection');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Primary Emotional Entry Section */}
      <View style={styles.searchSection}>
        <View style={[styles.searchShell, searchFocused && styles.searchShellFocused]}>
          <TextInput
            value={emotionalEntry}
            onChangeText={setEmotionalEntry}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onSubmitEditing={handleEmotionalEntrySubmit}
            placeholder="I am feeling…"
            placeholderTextColor="rgba(245, 215, 122, 0.46)"
            returnKeyType="send"
            style={styles.searchInput}
            multiline={false}
            accessibilityLabel="Tell David how you are feeling"
          />
          <TouchableOpacity
            style={[styles.searchSubmit, !emotionalEntry.trim() && styles.searchSubmitDisabled]}
            onPress={handleEmotionalEntrySubmit}
            disabled={!emotionalEntry.trim()}
            activeOpacity={0.75}
          >
            <Text style={styles.searchSubmitText}>TALK</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mood Selection Section */}
      <View style={styles.moodSection}>
        <View style={styles.moodGrid}>
          {MOODS.map((mood, index) => (
            <TouchableOpacity
              key={mood.key}
              style={[
                styles.moodButton,
                selectedMood === mood.key && styles.moodButtonActive,
                index >= 3 && styles.moodButtonSecondRow,
              ]}
              onPress={() => handleMoodSelect(mood.key)}
            >
              <Text
                style={[
                  styles.moodButtonText,
                  selectedMood === mood.key && styles.moodButtonTextActive,
                ]}
              >
                {mood.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Verse of the Day Section */}
      <View style={styles.verseSection}>
        <View style={styles.verseBorder}>
          <Text style={styles.verseLabel}>VERSE OF THE DAY</Text>
          <Text style={styles.verseDate}>{currentVerse.date}</Text>

          <Text style={styles.verseText}>{currentVerse.text}</Text>

          <Text style={styles.verseReference}>— {currentVerse.reference}</Text>

          <TouchableOpacity onPress={handleReflection} activeOpacity={0.75}>
            <Text style={styles.reflectionLink}>TAP FOR DAVID'S REFLECTION</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Talk with David Section */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={styles.talkButton}
          onPress={handleTalkWithDavid}
          activeOpacity={0.75}
        >
          <Text style={styles.talkButtonText}>TALK WITH DAVID</Text>
        </TouchableOpacity>

        <Text style={styles.actionSubtitle}>PERSONAL DIALOGUE WITH YOUR BIBLICAL COMPANION</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>CREATED BY AA DESIGNS</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 34,
    paddingBottom: 48,
    alignItems: 'center',
  },

  // Primary Emotional Search Section
  searchSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 36,
  },

  searchShell: {
    width: '100%',
    maxWidth: 520,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    borderRadius: 28,
    backgroundColor: 'rgba(5, 16, 32, 0.62)',
    paddingLeft: 22,
    paddingRight: 6,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: Platform.OS === 'web' ? 0.22 : 0.16,
    shadowRadius: 18,
    elevation: 4,
  },

  searchShellFocused: {
    borderColor: 'rgba(245, 215, 122, 0.82)',
    backgroundColor: 'rgba(5, 16, 32, 0.82)',
    shadowOpacity: 0.34,
    shadowRadius: 24,
  },

  searchInput: {
    flex: 1,
    height: 48,
    color: '#fff8df',
    fontSize: 16,
    fontStyle: 'italic',
    fontFamily: 'Playfair Display',
    letterSpacing: 0.3,
    outlineStyle: 'none' as any,
  },

  searchSubmit: {
    minWidth: 70,
    height: 40,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(245, 215, 122, 0.9)',
  },

  searchSubmitDisabled: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: 'rgba(212, 175, 55, 0.22)',
  },

  searchSubmitText: {
    fontSize: 9,
    fontWeight: '800',
    color: DARK_NAVY,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    fontFamily: 'Cinzel',
  },

  // Mood Section
  moodSection: {
    marginBottom: 64,
    alignItems: 'center',
  },

  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    maxWidth: 540,
  },

  moodButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    borderRadius: 20,
    backgroundColor: 'transparent',
    marginBottom: 6,
  },

  moodButtonActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },

  moodButtonSecondRow: {
    marginTop: 8,
  },

  moodButtonText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(212, 175, 55, 0.6)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'Cinzel',
  },

  moodButtonTextActive: {
    color: DARK_NAVY,
  },

  // Verse of the Day Section
  verseSection: {
    marginBottom: 70,
    alignItems: 'center',
    width: '100%',
  },

  verseBorder: {
    width: '100%',
    maxWidth: 500,
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(5, 16, 32, 0.16)',
  },

  verseLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
    fontFamily: 'Cinzel',
  },

  verseDate: {
    fontSize: 7,
    color: 'rgba(212, 175, 55, 0.5)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 20,
    fontFamily: 'Cinzel',
  },

  verseText: {
    fontSize: 17,
    color: '#ffffff',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 16,
    fontFamily: 'Playfair Display',
    fontWeight: '400',
  },

  verseReference: {
    fontSize: 9,
    color: GOLD,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 18,
    fontFamily: 'Cinzel',
  },

  reflectionLink: {
    fontSize: 8,
    color: 'rgba(212, 175, 55, 0.6)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
    fontFamily: 'Cinzel',
  },

  // Action Section
  actionSection: {
    alignItems: 'center',
    marginBottom: 62,
  },

  talkButton: {
    paddingHorizontal: 34,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: 4,
    backgroundColor: 'rgba(5, 16, 32, 0.18)',
    marginBottom: 14,
  },

  talkButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: 'Cinzel',
  },

  actionSubtitle: {
    fontSize: 7.5,
    color: 'rgba(212, 175, 55, 0.5)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
    fontFamily: 'Cinzel',
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: 16,
  },

  footerText: {
    fontSize: 7,
    color: 'rgba(212, 175, 55, 0.3)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
    fontFamily: 'Cinzel',
  },
});
