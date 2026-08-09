import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, TextInput, Platform } from 'react-native';
import { useUser } from '../UserContext';
import {
  NAVY,
  DARK_NAVY,
  GOLD,
  SOFT_GOLD,
  WHITE,
  gold,
  surfaces,
  fonts,
  fontSize,
  tracking,
  radius,
  spacing,
  buttons,
  glow,
  TOUCH_TARGET,
  MAX_CONTENT_WIDTH,
} from '../theme';

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
            accessibilityRole="button"
            accessibilityLabel="Send to David"
            activeOpacity={0.75}
          >
            <Text style={styles.searchSubmitText}>TALK</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mood Selection Section */}
      <View style={styles.moodSection}>
        <Text style={styles.sectionLabel}>HOW ARE YOU FEELING</Text>
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
              accessibilityRole="button"
              accessibilityLabel={mood.label}
              accessibilityState={{ selected: selectedMood === mood.key }}
              activeOpacity={0.75}
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

          <TouchableOpacity
            onPress={handleReflection}
            style={styles.reflectionTap}
            accessibilityRole="button"
            accessibilityLabel="Read David's reflection on this verse"
            activeOpacity={0.75}
          >
            <Text style={styles.reflectionLink}>TAP FOR DAVID'S REFLECTION</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Talk with David Section */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={styles.talkButton}
          onPress={handleTalkWithDavid}
          accessibilityRole="button"
          accessibilityLabel="Talk with David"
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + 44,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },

  // Primary Emotional Search Section
  searchSection: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignItems: 'center',
    marginBottom: spacing.section,
  },

  searchShell: {
    width: '100%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: gold.a30,
    borderRadius: radius.sm,
    backgroundColor: surfaces.sunken,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    ...glow,
  },

  searchShellFocused: {
    borderColor: gold.a70,
    backgroundColor: 'rgba(5, 16, 32, 0.82)',
    shadowOpacity: 0.34,
    shadowRadius: 24,
  },

  searchInput: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    color: '#fff8df',
    fontSize: 16,
    fontStyle: 'italic',
    fontFamily: fonts.display,
    letterSpacing: 0.3,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },

  searchSubmit: {
    minWidth: 70,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
  },

  searchSubmitDisabled: {
    ...buttons.disabled,
  },

  searchSubmitText: {
    fontFamily: fonts.ui,
    fontSize: fontSize.button,
    fontWeight: '700',
    color: DARK_NAVY,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase',
  },

  // Section label — matches the reference's field-label treatment
  sectionLabel: {
    fontFamily: fonts.ui,
    fontSize: fontSize.micro,
    fontWeight: '700',
    color: gold.a60,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },

  // Mood Selection
  moodSection: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    marginBottom: spacing.section,
  },

  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  moodButton: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: gold.a30,
    borderRadius: radius.sm,
    backgroundColor: surfaces.input,
  },

  moodButtonSecondRow: {},

  moodButtonActive: {
    borderColor: GOLD,
    backgroundColor: gold.a10,
    ...glow,
  },

  moodButtonText: {
    fontFamily: fonts.ui,
    fontSize: fontSize.tiny,
    fontWeight: '700',
    color: gold.a60,
    letterSpacing: tracking.normal,
    textTransform: 'uppercase',
  },

  moodButtonTextActive: {
    color: SOFT_GOLD,
  },

  // Verse of the Day
  verseSection: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    marginBottom: spacing.section,
  },

  verseBorder: {
    borderWidth: 1,
    borderColor: gold.a30,
    borderRadius: radius.sm,
    backgroundColor: surfaces.input,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },

  verseLabel: {
    fontFamily: fonts.ui,
    fontSize: fontSize.micro,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },

  verseDate: {
    fontFamily: fonts.ui,
    fontSize: fontSize.micro,
    color: gold.a50,
    letterSpacing: tracking.normal,
    textTransform: 'uppercase',
    marginBottom: spacing.xl,
  },

  verseText: {
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 28,
    fontStyle: 'italic',
    color: WHITE,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  verseReference: {
    fontFamily: fonts.ui,
    fontSize: fontSize.tiny,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
    marginBottom: spacing.xl,
  },

  reflectionTap: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },

  reflectionLink: {
    fontFamily: fonts.ui,
    fontSize: fontSize.tiny,
    fontWeight: '600',
    color: gold.a50,
    letterSpacing: tracking.tight,
    textTransform: 'uppercase',
  },

  // Talk with David
  actionSection: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignItems: 'center',
    marginBottom: spacing.section,
  },

  talkButton: {
    ...buttons.secondary,
    width: '100%',
  },

  talkButtonText: {
    ...buttons.secondaryText,
  },

  actionSubtitle: {
    fontFamily: fonts.ui,
    fontSize: fontSize.micro,
    color: gold.a50,
    letterSpacing: tracking.normal,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // Footer
  footer: {
    width: '100%',
    alignItems: 'center',
  },

  footerText: {
    fontFamily: fonts.ui,
    fontSize: fontSize.micro,
    color: gold.a30,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase',
  },
});
