import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Globe, Menu, Search, User, Settings } from 'lucide-react';
import { supabase } from '../services/supabase';
import { trackEvent } from '../services/analytics';
import { FullScreenBackground } from '../components/FullScreenBackground';
import { useUser } from '../UserContext';
import { BibleTranslation } from '../types';

const TRANSLATIONS = ['NIV', 'KJV', 'NLT', 'ESV', 'NKJV', 'CSB'];

export default function AuthScreen() {
  const { continueAsGuest } = useUser();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [preferredTranslation, setPreferredTranslation] = useState('NIV');
  const [showTranslations, setShowTranslations] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showSignUp = () => {
    setError(null);
    setIsResettingPassword(false);
    setIsSignUp(true);
  };

  const showSignIn = () => {
    setError(null);
    setIsResettingPassword(false);
    setIsSignUp(false);
    setConfirmPassword('');
    setAcceptedTerms(false);
  };

  const handleAuth = async () => {
    setError(null);

    if (!supabase) {
      setError('Sign-in is not available yet. Tap "Continue as Guest" to explore the app.');
      return;
    }

    if (isResettingPassword) {
      if (!email.trim()) {
        setError('Please enter your email');
        return;
      }
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        alert('Password reset link sent to your email!');
        setIsResettingPassword(false);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isSignUp && !firstName.trim()) {
      setError('Please enter your first name');
      return;
    }

    if (!email.trim() || !password) {
      setError('Please enter both email and password');
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (isSignUp && !acceptedTerms) {
      setError('Please agree to the Terms and Privacy Policy to create your account');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const cleanFirstName = firstName.trim();
        const cleanEmail = email.trim();
        const emailRedirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}`
            : 'https://www.mybibleaicompanion.com';

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo,
            data: {
              full_name: cleanFirstName,
              name: cleanFirstName,
              preferred_translation: preferredTranslation,
            },
          },
        });
        if (error) throw error;

        // `confirmed` separates the two funnels: accounts that land straight in
        // the app, and accounts parked waiting on a confirmation email.
        trackEvent('signup', { confirmed: Boolean(data.session) });

        // When email confirmation is ON, signUp returns a user but NO session.
        // Inserting into `profiles` here would run as an anon user and fail
        // silently under RLS. Only create the profile row when we already have
        // an authenticated session (confirmation OFF / auto-login).
        if (data.user && data.session) {
          await supabase.from('profiles').insert([
            {
              id: data.user.id,
              email: data.user.email,
              subscription_tier: 'free',
              has_completed_onboarding: false,
              preferred_translation: preferredTranslation,
            },
          ]);
        }

        // Only tell the user to check email if confirmation is actually pending
        // (i.e. no active session was returned). Otherwise they're already in.
        if (!data.session) {
          alert('Check your email to confirm your account, then sign in.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FullScreenBackground center={false}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Navigation */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.headerIcon}>
              <Menu size={20} color="#d4af37" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon}>
              <Search size={20} color="#d4af37" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon}>
              <User size={20} color="#d4af37" />
            </TouchableOpacity>
          </View>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>BIBLE MOOD SEARCH</Text>
            <Text style={styles.headerSubtitle}>DISCOVER SCRIPTURE FOR EVERY FEELING.</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.signUpButton}
              onPress={isSignUp ? showSignIn : showSignUp}
            >
              <Text style={styles.signUpText}>{isSignUp ? 'SIGN IN' : 'SIGN UP'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon}>
              <Settings size={20} color="#d4af37" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Translation Selector - Top Right */}
        <View style={styles.translationContainer}>
          <TouchableOpacity
            style={styles.translationSelector}
            onPress={() => setShowTranslations(!showTranslations)}
          >
            <Text style={styles.translationLabel}>{preferredTranslation}</Text>
            <Globe size={12} color="#d4af37" />
          </TouchableOpacity>

          {showTranslations && (
            <View style={styles.translationDropdown}>
              {TRANSLATIONS.map(t => (
                <TouchableOpacity
                  key={t}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setPreferredTranslation(t);
                    setShowTranslations(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      preferredTranslation === t && styles.dropdownTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          <Text style={styles.mainTitle}>
            {isResettingPassword
              ? 'RESET PASSWORD'
              : isSignUp
                ? 'CREATE YOUR ACCOUNT'
                : 'ENTER SANCTUARY'}
          </Text>

          <View style={styles.form}>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* First Name Input */}
            {isSignUp && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FIRST NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your first name"
                  placeholderTextColor="rgba(212, 175, 55, 0.4)"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  autoComplete="name-given"
                  textContentType="givenName"
                  returnKeyType="next"
                />
                <Text style={styles.inputHint}>David can use this to greet you personally.</Text>
              </View>
            )}

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="rgba(212, 175, 55, 0.4)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType={isResettingPassword ? 'send' : 'next'}
                onSubmitEditing={isResettingPassword ? handleAuth : undefined}
              />
            </View>

            {/* Password Input */}
            {!isResettingPassword && (
              <View style={styles.inputGroup}>
                <View style={styles.passwordHeader}>
                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  {!isSignUp && (
                    <TouchableOpacity onPress={() => setIsResettingPassword(true)}>
                      <Text style={styles.forgotPasswordLink}>FORGOT PASSWORD?</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(212, 175, 55, 0.4)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  textContentType={isSignUp ? 'newPassword' : 'password'}
                  returnKeyType={isSignUp ? 'next' : 'go'}
                  onSubmitEditing={isSignUp ? undefined : handleAuth}
                />
              </View>
            )}

            {/* Confirm Password Input */}
            {isSignUp && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(212, 175, 55, 0.4)"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={handleAuth}
                />
              </View>
            )}

            {/* Remember Me Checkbox */}
            {!isResettingPassword && !isSignUp && (
              <View style={styles.rememberMeContainer}>
                <TouchableOpacity
                  style={[styles.checkbox, rememberMe && styles.checkboxChecked]}
                  onPress={() => setRememberMe(!rememberMe)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                >
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
                <Text style={styles.rememberMeText}>REMEMBER ME</Text>
              </View>
            )}

            {/* Terms Checkbox */}
            {isSignUp && (
              <TouchableOpacity
                style={styles.termsContainer}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}
                activeOpacity={0.75}
              >
                <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                  {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.termsText}>
                  I agree to the Terms of Service and Privacy Policy.
                </Text>
              </TouchableOpacity>
            )}

            {/* Primary Auth Button */}
            <TouchableOpacity
              style={[styles.signInButton, loading && styles.primaryButtonDisabled]}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#051020" />
              ) : (
                <Text style={styles.signInButtonText}>
                  {isResettingPassword ? 'SEND RESET LINK' : isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Create Free Account Button */}
            {!isResettingPassword && !isSignUp && (
              <TouchableOpacity style={styles.createAccountButton} onPress={showSignUp}>
                <Text style={styles.createAccountText}>CREATE FREE ACCOUNT</Text>
              </TouchableOpacity>
            )}

            {/* Continue as Guest Link */}
            {!isResettingPassword && !isSignUp && (
              <TouchableOpacity
                style={styles.guestLinkContainer}
                onPress={() => continueAsGuest(preferredTranslation as BibleTranslation)}
              >
                <Text style={styles.guestLink}>CONTINUE AS GUEST</Text>
              </TouchableOpacity>
            )}

            {/* Toggle between Sign In and Sign Up */}
            {isSignUp && (
              <TouchableOpacity style={styles.toggleContainer} onPress={showSignIn}>
                <Text style={styles.toggleText}>Already have an account? Sign in</Text>
              </TouchableOpacity>
            )}

            {isResettingPassword && (
              <TouchableOpacity
                style={styles.toggleContainer}
                onPress={() => setIsResettingPassword(false)}
              >
                <Text style={styles.toggleText}>Back to Login</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </FullScreenBackground>
  );
}

const GOLD = '#d4af37';
const SOFT_GOLD = '#f5d77a';
const NAVY = '#0b1e3d';
const DARK_NAVY = '#051020';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  // Header Navigation
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.1)',
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 20,
  },

  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: 'Cinzel',
  },

  headerSubtitle: {
    fontSize: 8,
    color: SOFT_GOLD,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 2,
    fontFamily: 'Cinzel',
    opacity: 0.8,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  headerIcon: {
    padding: 8,
  },

  signUpButton: {
    backgroundColor: GOLD,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },

  signUpText: {
    color: DARK_NAVY,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: 'Cinzel',
  },

  // Translation Selector
  translationContainer: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 100,
  },

  translationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 4,
  },

  translationLabel: {
    color: GOLD,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: 'Cinzel',
  },

  translationDropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#0f2a52',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: GOLD,
    overflow: 'hidden',
  },

  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.1)',
  },

  dropdownText: {
    color: 'rgba(212, 175, 55, 0.6)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Cinzel',
  },

  dropdownTextActive: {
    color: GOLD,
  },

  // Main Content
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 32,
  },

  mainTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 40,
    fontFamily: 'Playfair Display',
    textAlign: 'center',
  },

  // Form
  form: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },

  errorContainer: {
    width: '100%',
    padding: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: 20,
  },

  errorText: {
    color: '#ef4444',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
    fontFamily: 'Playfair Display',
  },

  // Input Group
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },

  inputLabel: {
    fontSize: 8,
    color: 'rgba(212, 175, 55, 0.6)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: '700',
    fontFamily: 'Cinzel',
  },

  inputHint: {
    marginTop: 7,
    color: 'rgba(245, 215, 122, 0.45)',
    fontSize: 10,
    lineHeight: 15,
    fontFamily: 'Playfair Display',
  },

  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  forgotPasswordLink: {
    fontSize: 8,
    color: GOLD,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
    fontFamily: 'Cinzel',
  },

  input: {
    width: '100%',
    backgroundColor: 'rgba(5, 16, 32, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#ffffff',
    fontFamily: 'Playfair Display',
  },

  // Remember Me
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 20,
    gap: 6,
  },

  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    flexShrink: 0,
  },

  checkboxChecked: {
    backgroundColor: GOLD,
  },

  checkmark: {
    color: DARK_NAVY,
    fontSize: 12,
    fontWeight: 'bold',
  },

  rememberMeText: {
    fontSize: 9,
    color: 'rgba(212, 175, 55, 0.7)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
    fontFamily: 'Cinzel',
  },

  termsContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginBottom: 20,
  },

  termsText: {
    flex: 1,
    color: 'rgba(245, 215, 122, 0.68)',
    fontSize: 10,
    lineHeight: 16,
    fontFamily: 'Playfair Display',
  },

  // Sign In Button (Gold/Yellow)
  signInButton: {
    width: '100%',
    backgroundColor: GOLD,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 12,
  },

  primaryButtonDisabled: {
    opacity: 0.65,
  },

  signInButtonText: {
    color: DARK_NAVY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: 'Cinzel',
  },

  // Create Free Account Button (Outlined)
  createAccountButton: {
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.5)',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 16,
  },

  createAccountText: {
    color: 'rgba(212, 175, 55, 0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'Cinzel',
  },

  // Continue as Guest
  guestLinkContainer: {
    paddingVertical: 8,
  },

  guestLink: {
    color: 'rgba(212, 175, 55, 0.5)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: 'Cinzel',
  },

  // Toggle
  toggleContainer: {
    marginTop: 24,
    paddingVertical: 8,
  },

  toggleText: {
    color: SOFT_GOLD,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textAlign: 'center',
    fontFamily: 'Playfair Display',
  },
});
