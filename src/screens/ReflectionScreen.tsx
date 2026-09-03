import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { motion } from 'motion/react';
import { Sparkles, Bookmark, Check, Globe } from 'lucide-react';
import {
  DailyReflectionLimitError,
  getVerseReflection,
  getVerseOfTheDay,
  ReflectionRequestError,
} from '../services/ai';
import { saveScripture, supabase } from '../services/supabase';
import { createCheckoutSession } from '../services/stripe';
import { Scripture } from '../types';
import { useUser } from '../UserContext';
import { hasPremiumAccess } from '../utils/tier';
import DailyLimitUpgrade from '../components/DailyLimitUpgrade';

const MotionView = motion.create(View);

const TRANSLATIONS = ['NIV', 'KJV', 'NLT', 'ESV', 'NKJV', 'CSB'];

export default function ReflectionScreen({ navigation }: any) {
  const { profile, signOut } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [dailyVerse, setDailyVerse] = useState<Scripture | null>(null);
  const [reflection, setReflection] = useState<string | null>(null);
  const [loadingReflection, setLoadingReflection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [signInRequired, setSignInRequired] = useState(false);

  const isPaid = hasPremiumAccess(profile);

  const fetchDailyVerse = async () => {
    try {
      const verse = await getVerseOfTheDay(profile?.preferred_translation || 'KJV');
      setDailyVerse(verse);
      setHasSaved(false);
    } catch (error) {
      console.error('Error fetching daily verse:', error);
    }
  };

  useEffect(() => {
    fetchDailyVerse();
  }, [profile?.preferred_translation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDailyVerse();
    setRefreshing(false);
  };

  const handleSave = async () => {
    if (!profile || !dailyVerse || isSaving || hasSaved) return;
    
    setIsSaving(true);
    try {
      await saveScripture(
        profile.id, 
        dailyVerse, 
        profile.preferred_translation || 'KJV',
        'Daily Verse'
      );
      setHasSaved(true);
    } catch (error) {
      console.error('Error saving scripture:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReflect = async () => {
    if (loadingReflection || !dailyVerse) return;

    setReflectionError(null);
    setSignInRequired(false);

    if (!profile || profile.id === 'guest') {
      setReflectionError('Sign in to use your three free reflections each day.');
      setSignInRequired(true);
      return;
    }

    setLoadingReflection(true);
    try {
      const verse = dailyVerse?.verse || "";
      const ref = dailyVerse?.reference || "";
      if (verse && ref) {
        const text = await getVerseReflection(verse, ref);
        setReflection(text);
      }
    } catch (error: any) {
      console.error(error);
      if (error instanceof DailyReflectionLimitError) {
        setLimitReached(true);
        return;
      }

      if (error instanceof ReflectionRequestError && error.code === 'AUTH_REQUIRED') {
        setSignInRequired(true);
      }
      setReflectionError(error?.message || 'David could not create a reflection right now. Please try again.');
    } finally {
      setLoadingReflection(false);
    }
  };

  const handleUpgrade = async (plan: 'plus' | 'pro') => {
    if (upgradeLoading) return;
    try {
      setUpgradeLoading(true);
      await createCheckoutSession(plan);
    } catch (error: any) {
      console.error('Upgrade error:', error);
      setReflectionError(error?.message || 'Unable to start checkout right now.');
      setLimitReached(false);
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleTranslationSelect = async (t: string) => {
    if (!profile) return;
    const { error } = await supabase
      .from('profiles')
      .update({ preferred_translation: t })
      .eq('id', profile.id);
    if (!error) {
      setShowTranslations(false);
    }
  };

  if (limitReached && !isPaid) {
    return (
      <DailyLimitUpgrade
        feature="reflections"
        onUpgradePlus={() => void handleUpgrade('plus')}
        onUpgradePro={() => void handleUpgrade('pro')}
        onDismiss={() => setLimitReached(false)}
        busy={upgradeLoading}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4af37" />}
      >
        <View style={styles.header}>
          <Text style={styles.title} role="heading" aria-level={1}>DAILY REFLECTION</Text>
          <View style={styles.titleUnderline} />
          <Text style={styles.allowanceText}>
            {isPaid ? 'UNLIMITED REFLECTIONS' : '3 FREE REFLECTIONS DAILY'}
          </Text>
        </View>

        <View style={styles.versionRow}>
          <TouchableOpacity role="button" 
            style={styles.translationSelector}
            onPress={() => setShowTranslations(!showTranslations)}
          >
            <Globe size={12} color="#d4af37" />
            <Text style={styles.translationText}>{profile?.preferred_translation || 'KJV'}</Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
          
          {showTranslations && (
            <View style={styles.translationDropdown}>
              <ScrollView style={{ maxHeight: 200 }}>
                {TRANSLATIONS.map(t => (
                  <TouchableOpacity role="button" 
                    key={t} 
                    style={styles.dropdownItem}
                    onPress={() => handleTranslationSelect(t)}
                  >
                    <Text style={[
                      styles.dropdownText,
                      profile?.preferred_translation === t && styles.dropdownTextActive
                    ]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <MotionView 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={styles.verseCard}
        >
          <Text style={styles.verseLabel}>VERSE OF THE DAY</Text>
          <Text style={styles.verseText}>
            {dailyVerse?.verse || "Loading your daily word..."}
          </Text>
          {dailyVerse && (
            <Text style={styles.verseReference}>— {dailyVerse.reference} ({profile?.preferred_translation || 'KJV'})</Text>
          )}
          
          <View style={styles.verseActions}>
            <TouchableOpacity role="button" 
              style={[styles.saveButton, hasSaved && styles.saveButtonActive]} 
              onPress={handleSave}
              disabled={isSaving || hasSaved || !dailyVerse}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#0b1e3d" />
              ) : hasSaved ? (
                <View style={styles.saveButtonContent}>
                  <Check size={14} color="#7fb894" style={{ marginRight: 6 }} />
                  <Text style={[styles.saveButtonText, { color: '#7fb894' }]}>SAVED</Text>
                </View>
              ) : (
                <View style={styles.saveButtonContent}>
                  <Bookmark size={14} color="#0b1e3d" style={{ marginRight: 6 }} />
                  <Text style={styles.saveButtonText}>SAVE TO MY LIST</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {reflection ? (
            <MotionView
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ width: '100%' }}
            >
              <View style={styles.reflectionContainer}>
                <View style={styles.reflectionHeader}>
                  <Sparkles size={16} color="#d4af37" />
                  <Text style={styles.reflectionTitle}>DAVID'S REFLECTION</Text>
                </View>
                <Text style={styles.reflectionBody}>{reflection}</Text>
                <TouchableOpacity role="button" onPress={() => setReflection(null)} style={styles.closeReflection}>
                  <Text style={styles.closeReflectionText}>CLOSE</Text>
                </TouchableOpacity>
              </View>
            </MotionView>
          ) : (
            <TouchableOpacity role="button" 
              style={styles.reflectionButton} 
              onPress={handleReflect}
              disabled={loadingReflection || !dailyVerse}
            >
              {loadingReflection ? (
                <ActivityIndicator size="small" color="#0b1e3d" />
              ) : (
                <View style={styles.reflectionButtonContent}>
                  <Sparkles size={14} color="#051020" style={{ marginRight: 8 }} />
                  <Text style={styles.reflectionText}>
                    {"TAP FOR DAVID'S REFLECTION"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {reflectionError && (
            <View style={styles.reflectionErrorBox}>
              <Text style={styles.reflectionErrorText}>{reflectionError}</Text>
              {signInRequired && (
                <TouchableOpacity
                  style={styles.signInButton}
                  onPress={() => void signOut()}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in"
                >
                  <Text style={styles.signInButtonText}>SIGN IN</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </MotionView>

        <View style={styles.infoBox}>
          <Sparkles size={20} color="#d4af37" style={{ marginBottom: 15 }} />
          <Text style={styles.infoTitle}>Deepen Your Connection</Text>
          <Text style={styles.infoText}>
            Every day, David picks a special word just for you. Take a moment to sit in silence, read the word, and listen to the reflection.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 40,
    paddingBottom: 40,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    color: '#d4af37',
    fontFamily: 'Playfair Display',
    fontWeight: '700',
    letterSpacing: 3,
  },
  titleUnderline: {
    width: 40,
    height: 1,
    backgroundColor: '#d4af37',
    marginTop: 8,
    opacity: 0.3,
  },
  allowanceText: {
    color: 'rgba(212, 175, 55, 0.68)',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1.3,
    marginTop: 12,
  },
  versionRow: {
    alignItems: 'center',
    marginBottom: 30,
    zIndex: 1000,
  },
  translationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  translationText: {
    color: '#d4af37',
    fontSize: 13,
    fontWeight: 'bold',
    marginHorizontal: 10,
    letterSpacing: 1,
  },
  dropdownArrow: {
    color: '#d4af37',
    fontSize: 8,
    opacity: 0.5,
  },
  translationDropdown: {
    position: 'absolute',
    top: 50,
    backgroundColor: '#0a1a30',
    borderRadius: 15,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.5)',
    elevation: 20,
    width: 140,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.05)',
  },
  dropdownText: {
    color: 'rgba(212, 175, 55, 0.5)',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
  },
  dropdownTextActive: {
    color: '#d4af37',
  },
  verseCard: {
    backgroundColor: 'rgba(10, 26, 48, 0.8)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    marginBottom: 24,
  },
  verseLabel: {
    color: '#d4af37',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 16,
    opacity: 0.6,
  },
  verseText: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Playfair Display',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 16,
  },
  verseReference: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    marginBottom: 24,
  },
  verseActions: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    minWidth: 160,
    alignItems: 'center',
  },
  saveButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#7fb894',
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#051020',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  reflectionButton: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 28,
    marginTop: 16,
    minWidth: 180,
    alignItems: 'center',
  },
  reflectionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reflectionText: {
    color: '#051020',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  reflectionErrorBox: {
    width: '100%',
    marginTop: 16,
    padding: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 12,
  },
  reflectionErrorText: {
    color: '#fecaca',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  signInButton: {
    marginTop: 12,
    minHeight: 40,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: '#d4af37',
    borderRadius: 20,
  },
  signInButtonText: {
    color: '#051020',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  reflectionContainer: {
    marginTop: 24,
    padding: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    width: '100%',
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  reflectionTitle: {
    color: '#d4af37',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginLeft: 8,
  },
  reflectionBody: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Playfair Display',
    fontStyle: 'italic',
    opacity: 0.9,
  },
  closeReflection: {
    marginTop: 20,
    padding: 8,
  },
  closeReflectionText: {
    color: 'rgba(212, 175, 55, 0.4)',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  infoBox: {
    backgroundColor: 'rgba(10, 26, 48, 0.4)',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  infoTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Playfair Display',
    marginBottom: 8,
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  }
});
