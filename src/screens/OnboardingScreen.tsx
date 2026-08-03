import React, { useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Search, MessageCircle, Mic, BookOpen, ChevronRight, Check } from 'lucide-react';
import { supabase } from '../services/supabase';
import { BibleTranslation } from '../types';
import { FullScreenBackground } from '../components/FullScreenBackground';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Sanctuary',
    subtitle: 'Your AI Scripture Companion',
    description: 'A space for peace, reflection, and spiritual growth guided by the wisdom of the Bible.',
    icon: BookOpen,
  },
  {
    id: 'mood',
    title: 'Mood Search',
    subtitle: 'Scripture for every emotion',
    description: 'Find comfort, joy, or strength by searching for verses that match exactly how you feel right now.',
    icon: Search,
  },
  {
    id: 'chat',
    title: 'Meet David',
    subtitle: 'Your Biblical Companion',
    description: 'Chat with David, our AI companion trained to provide compassionate, scripture-based encouragement.',
    icon: MessageCircle,
  },
  {
    id: 'voice',
    title: 'Voice with David',
    subtitle: 'Immersive Dialogue',
    description: 'Experience real-time spiritual conversations with a warm, thoughtful voice that listens and responds.',
    icon: Mic,
  },
  {
    id: 'setup',
    title: 'Initial Setup',
    subtitle: 'Personalize your experience',
    description: 'Choose your preferred Bible translation to begin your journey.',
    icon: Check,
  },
];

const TRANSLATIONS: BibleTranslation[] = ['KJV', 'NIV', 'ESV', 'NKJV', 'NASB', 'NLT', 'CSB', 'AMP', 'MSG'];

const TRANSLATION_DETAILS: Record<BibleTranslation, string> = {
  KJV: 'King James Version - Classic and poetic.',
  NIV: 'New International Version - Modern and readable.',
  ESV: 'English Standard Version - Word-for-word accuracy.',
  NKJV: 'New King James Version - Modernized classic.',
  NASB: 'New American Standard Bible - Highly literal.',
  NLT: 'New Living Translation - Easy to understand.',
  CSB: 'Christian Standard Bible - Optimal blend of accuracy and readability.',
  AMP: 'Amplified Bible - Expanded meanings for deeper study.',
  MSG: 'The Message - Contemporary paraphrase.',
};

type OnboardingScreenProps = {
  onComplete: () => void | Promise<void>;
};

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTranslation, setSelectedTranslation] = useState<BibleTranslation>('KJV');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const step = STEPS[currentStep];
  const Icon = step.icon;
  const isFinalStep = currentStep === STEPS.length - 1;

  const handleNext = async () => {
    if (!isFinalStep) {
      setSubmitError(null);
      setCurrentStep((previousStep) => previousStep + 1);
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (!supabase) {
        throw new Error('The app connection is unavailable. Please refresh and try again.');
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user?.id;
      if (!userId) {
        throw new Error('Your sign-in session expired. Please sign in again.');
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          has_completed_onboarding: true,
          preferred_translation: selectedTranslation,
          preferred_response_length: 'medium',
          verse_of_the_day_enabled: true,
          verse_of_the_day_time: '08:00',
        })
        .eq('id', userId)
        .select('id, has_completed_onboarding')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updatedProfile?.has_completed_onboarding) {
        throw new Error('Your setup could not be saved. Please try again.');
      }

      await onComplete();
    } catch (error: any) {
      console.error('[Onboarding] Could not complete setup:', error);
      setSubmitError(error?.message || 'Setup could not be completed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FullScreenBackground center>
      <View style={styles.container}>
        <View style={styles.progressContainer}>
          {STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index <= currentStep && styles.progressDotActive,
                index === currentStep && styles.progressDotCurrent,
              ]}
            />
          ))}
        </View>

        <View style={styles.iconContainer}>
          <Icon color="#d4af37" size={64} strokeWidth={1.5} />
        </View>

        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>
        <Text style={styles.description}>{step.description}</Text>

        {step.id === 'setup' && (
          <View style={styles.setupWrapper}>
            <View style={styles.translationContainer}>
              {TRANSLATIONS.map((translation) => (
                <TouchableOpacity
                  key={translation}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedTranslation === translation }}
                  style={[
                    styles.translationButton,
                    selectedTranslation === translation && styles.translationButtonActive,
                  ]}
                  onPress={() => setSelectedTranslation(translation)}
                  disabled={isSubmitting}
                >
                  <Text
                    style={[
                      styles.translationText,
                      selectedTranslation === translation && styles.translationTextActive,
                    ]}
                  >
                    {translation}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.detailCard}>
              <Text style={styles.detailText}>{TRANSLATION_DETAILS[selectedTranslation]}</Text>
            </View>
          </View>
        )}

        {submitError && (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {submitError}
          </Text>
        )}

        <View style={styles.footer}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={isFinalStep ? 'Get started' : 'Continue'}
            accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
            style={[styles.nextButton, isSubmitting && styles.nextButtonDisabled]}
            onPress={() => void handleNext()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator color="#0b1e3d" size="small" />
                <Text style={[styles.nextButtonText, styles.submittingText]}>SAVING...</Text>
              </>
            ) : (
              <>
                <Text style={styles.nextButtonText}>{isFinalStep ? 'GET STARTED' : 'CONTINUE'}</Text>
                <ChevronRight color="#0b1e3d" size={20} />
              </>
            )}
          </TouchableOpacity>

          {!isFinalStep && (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.skipButton}
              onPress={() => setCurrentStep(STEPS.length - 1)}
            >
              <Text style={styles.skipButtonText}>SKIP</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.appFooter}>
          <Text style={styles.appFooterText}>CREATED BY AA DESIGNS</Text>
        </View>
      </View>
    </FullScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    marginBottom: 60,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.5)',
  },
  progressDotCurrent: {
    backgroundColor: '#d4af37',
    width: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  title: {
    fontSize: 32,
    color: '#d4af37',
    fontFamily: 'Playfair Display',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    color: '#f5d77a',
    fontFamily: 'Cinzel',
    letterSpacing: 4,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.8,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
    fontFamily: 'Playfair Display',
    fontStyle: 'italic',
  },
  translationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 40,
  },
  translationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    margin: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.02)',
  },
  translationButtonActive: {
    backgroundColor: '#d4af37',
    borderColor: '#d4af37',
  },
  translationText: {
    color: '#d4af37',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  translationTextActive: {
    color: '#0b1e3d',
  },
  setupWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
    width: '100%',
    marginTop: 10,
  },
  detailText: {
    color: '#f5d77a',
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'Playfair Display',
  },
  errorText: {
    color: '#ffb4b4',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  nextButton: {
    minWidth: 190,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4af37',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 40,
    marginBottom: 20,
  },
  nextButtonDisabled: {
    opacity: 0.65,
  },
  nextButtonText: {
    color: '#0b1e3d',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginRight: 8,
  },
  submittingText: {
    marginLeft: 10,
    marginRight: 0,
  },
  skipButton: {
    padding: 10,
  },
  skipButtonText: {
    color: 'rgba(212, 175, 55, 0.5)',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  appFooter: {
    marginTop: 40,
    paddingBottom: 20,
    alignItems: 'center',
  },
  appFooterText: {
    color: 'rgba(212, 175, 55, 0.3)',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
});
