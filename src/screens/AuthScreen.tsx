import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Globe, Menu, Search, Settings, User } from 'lucide-react';
import { supabase } from '../services/supabase';
import { trackEvent } from '../services/analytics';
import { useUser } from '../UserContext';
import { BibleTranslation } from '../types';
import { APP_COLORS, APP_FONTS } from '../designSystem';

const TRANSLATIONS = ['NIV', 'KJV', 'NLT', 'ESV', 'NKJV', 'CSB'];

export default function AuthScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const { continueAsGuest } = useUser();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'apple' | 'google' | null>(null);
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

    if (isResettingPassword) {
      if (!email.trim()) {
        setError('Please enter your email');
        return;
      }
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) throw error;
        setIsResettingPassword(false);
        setError('Password reset link sent. Check your email.');
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isSignUp && !firstName.trim()) return setError('Please enter your first name');
    if (!email.trim() || !password) return setError('Please enter both email and password');
    if (isSignUp && password !== confirmPassword) return setError('Passwords do not match');
    if (isSignUp && !acceptedTerms) return setError('Please agree to the Terms and Privacy Policy to create your account');

    setLoading(true);
    try {
      if (isSignUp) {
        const cleanFirstName = firstName.trim();
        const cleanEmail = email.trim();
        const emailRedirectTo = typeof window !== 'undefined' ? window.location.origin : 'https://www.mybibleaicompanion.com';
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo,
            data: { full_name: cleanFirstName, name: cleanFirstName, preferred_translation: preferredTranslation },
          },
        });
        if (error) throw error;
        trackEvent('signup', { confirmed: Boolean(data.session) });
        if (data.user && data.session) {
          await supabase.from('profiles').insert([{
            id: data.user.id,
            email: data.user.email,
            subscription_tier: 'free',
            has_completed_onboarding: false,
            preferred_translation: preferredTranslation,
          }]);
        }
        if (!data.session) setError('Check your email to confirm your account, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'apple' | 'google') => {
    setError(null);
    setOauthLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error: any) {
      setError(error?.message || `Unable to continue with ${provider}.`);
      setOauthLoading(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Menu size={19} color={APP_COLORS.gold} />
          {!compact && <Search size={19} color={APP_COLORS.gold} />}
          {!compact && <User size={19} color={APP_COLORS.gold} />}
        </View>

        <View style={styles.brand}>
          <Text style={styles.brandTitle}>BIBLE MOOD SEARCH</Text>
          <Text style={styles.brandTagline}>DISCOVER SCRIPTURE FOR EVERY FEELING.</Text>
        </View>

        <View style={styles.headerRight}>
          <View>
            <TouchableOpacity style={styles.translationButton} onPress={() => setShowTranslations((v) => !v)}>
              <Text style={styles.translationText}>{preferredTranslation}</Text>
              <Globe size={12} color={APP_COLORS.gold} />
            </TouchableOpacity>
            {showTranslations && (
              <View style={styles.translationMenu}>
                {TRANSLATIONS.map((translation) => (
                  <TouchableOpacity key={translation} style={styles.translationItem} onPress={() => { setPreferredTranslation(translation); setShowTranslations(false); }}>
                    <Text style={[styles.translationItemText, translation === preferredTranslation && styles.translationItemActive]}>{translation}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.signupHeaderButton} onPress={isSignUp ? showSignIn : showSignUp}>
            <Text style={styles.signupHeaderText}>{isSignUp ? 'SIGN IN' : 'SIGN UP'}</Text>
          </TouchableOpacity>
          {!compact && <Settings size={19} color={APP_COLORS.gold} />}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{isResettingPassword ? 'RESET PASSWORD' : isSignUp ? 'CREATE YOUR ACCOUNT' : 'ENTER SANCTUARY'}</Text>

        <View style={styles.form}>
          {error && <View style={styles.messageBox}><Text style={styles.messageText}>{error}</Text></View>}

          {isSignUp && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>FIRST NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Your first name"
                placeholderTextColor="rgba(241,212,119,0.38)"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoComplete="name-given"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="rgba(241,212,119,0.38)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              onSubmitEditing={handleAuth}
            />
          </View>

          {!isResettingPassword && (
            <View style={styles.inputGroup}>
              <View style={styles.passwordHeader}>
                <Text style={styles.label}>PASSWORD</Text>
                {!isSignUp && (
                  <TouchableOpacity onPress={() => setIsResettingPassword(true)}>
                    <Text style={styles.forgotText}>FORGOT PASSWORD?</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="rgba(241,212,119,0.38)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                onSubmitEditing={handleAuth}
              />
            </View>
          )}

          {isSignUp && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="rgba(241,212,119,0.38)"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                onSubmitEditing={handleAuth}
              />
            </View>
          )}

          {isSignUp && (
            <TouchableOpacity style={styles.rememberRow} onPress={() => setAcceptedTerms((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }}>
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>{acceptedTerms && <Text style={styles.checkmark}>✓</Text>}</View>
              <Text style={styles.termsText}>I agree to the Terms of Service and Privacy Policy.</Text>
            </TouchableOpacity>
          )}

          {!isResettingPassword && !isSignUp && (
            <TouchableOpacity style={styles.rememberRow} onPress={() => setRememberMe((v) => !v)}>
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>{rememberMe && <Text style={styles.checkmark}>✓</Text>}</View>
              <Text style={styles.rememberText}>REMEMBER ME</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={handleAuth} disabled={loading}>
            {loading ? <ActivityIndicator color={APP_COLORS.navyDeep} /> : (
              <Text style={styles.primaryButtonText}>{isResettingPassword ? 'SEND RESET LINK' : isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}</Text>
            )}
          </TouchableOpacity>

          {!isResettingPassword && !isSignUp && (
            <TouchableOpacity style={styles.outlineButton} onPress={showSignUp}>
              <Text style={styles.outlineButtonText}>CREATE FREE ACCOUNT</Text>
            </TouchableOpacity>
          )}

          {isSignUp && (
            <TouchableOpacity style={styles.backLink} onPress={showSignIn}><Text style={styles.backLinkText}>Already have an account? Sign in</Text></TouchableOpacity>
          )}
          {isResettingPassword && (
            <TouchableOpacity style={styles.backLink} onPress={() => setIsResettingPassword(false)}><Text style={styles.backLinkText}>Back to sign in</Text></TouchableOpacity>
          )}

          {!isSignUp && !isResettingPassword && (
            <>
              <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>or continue with</Text><View style={styles.orLine} /></View>
              <TouchableOpacity style={styles.oauthButton} onPress={() => handleOAuth('apple')} disabled={!!oauthLoading}>
                {oauthLoading === 'apple' ? <ActivityIndicator size="small" color={APP_COLORS.cream} /> : <Text style={styles.oauthText}>●   Continue with Apple</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.oauthButton} onPress={() => handleOAuth('google')} disabled={!!oauthLoading}>
                {oauthLoading === 'google' ? <ActivityIndicator size="small" color={APP_COLORS.cream} /> : <Text style={styles.oauthText}>G   Continue with Google</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.guestButton} onPress={() => continueAsGuest(preferredTranslation as BibleTranslation)}>
                <Text style={styles.guestText}>CONTINUE AS GUEST</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Image source={{ uri: '/design/auth-banner.png' }} style={styles.banner} resizeMode="cover" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: '100vh' as any, backgroundColor: APP_COLORS.navy },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: APP_COLORS.borderSoft, paddingHorizontal: 22 },
  headerLeft: { width: 120, flexDirection: 'row', gap: 20, alignItems: 'center' },
  brand: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  brandTitle: { color: APP_COLORS.gold, fontFamily: APP_FONTS.serif, fontSize: 15, fontWeight: '700', letterSpacing: 1.4, textAlign: 'center' },
  brandTagline: { color: APP_COLORS.goldSoft, fontFamily: APP_FONTS.serif, fontSize: 7, fontWeight: '600', letterSpacing: 1.4, marginTop: 3, textAlign: 'center' },
  headerRight: { width: 230, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  translationButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, borderWidth: 1, borderColor: APP_COLORS.borderSoft },
  translationText: { color: APP_COLORS.gold, fontFamily: APP_FONTS.serif, fontSize: 10, fontWeight: '700' },
  translationMenu: { position: 'absolute', top: 38, right: 0, minWidth: 68, backgroundColor: APP_COLORS.navyDeep, borderWidth: 1, borderColor: APP_COLORS.gold, zIndex: 30 },
  translationItem: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: APP_COLORS.borderSoft },
  translationItemText: { color: APP_COLORS.muted, fontFamily: APP_FONTS.serif, fontSize: 9, textAlign: 'center' },
  translationItemActive: { color: APP_COLORS.gold, fontWeight: '700' },
  signupHeaderButton: { backgroundColor: APP_COLORS.gold, minHeight: 34, justifyContent: 'center', paddingHorizontal: 16 },
  signupHeaderText: { color: APP_COLORS.navyDeep, fontFamily: APP_FONTS.serif, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 980, alignSelf: 'center', alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 },
  title: { color: APP_COLORS.cream, fontFamily: APP_FONTS.display, fontSize: 31, fontWeight: '600', letterSpacing: 1.3, marginBottom: 24, textAlign: 'center' },
  form: { width: '100%', maxWidth: 520 },
  messageBox: { borderWidth: 1, borderColor: APP_COLORS.border, backgroundColor: APP_COLORS.panel, padding: 10, marginBottom: 14 },
  messageText: { color: APP_COLORS.goldSoft, fontFamily: APP_FONTS.sans, fontSize: 11, textAlign: 'center' },
  inputGroup: { marginBottom: 15 },
  label: { color: APP_COLORS.gold, fontFamily: APP_FONTS.serif, fontSize: 8, fontWeight: '700', letterSpacing: 1.2, marginBottom: 7 },
  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forgotText: { color: APP_COLORS.gold, fontFamily: APP_FONTS.serif, fontSize: 8, fontWeight: '700', letterSpacing: 0.6 },
  input: { minHeight: 44, borderWidth: 1, borderColor: APP_COLORS.border, backgroundColor: APP_COLORS.navyDeep, color: APP_COLORS.cream, paddingHorizontal: 12, fontFamily: APP_FONTS.display, fontSize: 13 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, alignSelf: 'flex-start' },
  checkbox: { width: 16, height: 16, borderWidth: 1, borderColor: APP_COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: APP_COLORS.gold },
  checkmark: { color: APP_COLORS.navyDeep, fontSize: 11, fontWeight: '900' },
  rememberText: { color: APP_COLORS.gold, fontFamily: APP_FONTS.serif, fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  termsText: { flex: 1, color: APP_COLORS.cream, fontFamily: APP_FONTS.sans, fontSize: 10, lineHeight: 15 },
  primaryButton: { minHeight: 44, backgroundColor: APP_COLORS.gold, borderWidth: 1, borderColor: APP_COLORS.goldSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  primaryButtonText: { color: APP_COLORS.navyDeep, fontFamily: APP_FONTS.serif, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  outlineButton: { minHeight: 44, borderWidth: 1, borderColor: APP_COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  outlineButtonText: { color: APP_COLORS.cream, fontFamily: APP_FONTS.serif, fontSize: 10, fontWeight: '600', letterSpacing: 1.1 },
  backLink: { paddingVertical: 12, alignItems: 'center' },
  backLinkText: { color: APP_COLORS.goldSoft, fontFamily: APP_FONTS.sans, fontSize: 11 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: APP_COLORS.borderSoft },
  orText: { color: APP_COLORS.cream, fontFamily: APP_FONTS.sans, fontSize: 10 },
  oauthButton: { minHeight: 42, borderWidth: 1, borderColor: APP_COLORS.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 9, backgroundColor: APP_COLORS.navyDeep },
  oauthText: { color: APP_COLORS.cream, fontFamily: APP_FONTS.sans, fontSize: 12 },
  guestButton: { paddingVertical: 10, alignItems: 'center' },
  guestText: { color: APP_COLORS.gold, fontFamily: APP_FONTS.serif, fontSize: 9, fontWeight: '600', letterSpacing: 0.9 },
  banner: { width: '100%', maxWidth: 720, height: 170, marginTop: 20, borderWidth: 1, borderColor: APP_COLORS.gold },
});
