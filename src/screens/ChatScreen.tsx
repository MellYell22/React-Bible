import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Send, PhoneCall, ThumbsUp, ThumbsDown, Volume2, Square } from 'lucide-react';
import {
  getChatResponseStream,
  generateSpeech,
  isChatLimitReachedError,
  SPEECH_USER_TAP,
  ChatHistoryMessage,
} from '../services/ai';
import { ChatMessage } from '../types';
import { saveAIFeedback } from '../services/supabase';
import { useUser } from '../UserContext';
import { DAVID_CHAT_GREETINGS } from '../constants/persona';
import DailyLimitUpgrade from '../components/DailyLimitUpgrade';
import { createCheckoutSession } from '../services/stripe';
import { trackEvent } from '../services/analytics';
import type { CheckoutPlan } from '../services/stripe';

export default function ChatScreen({ navigation, route }: any) {
  const { profile } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const initialPromptHandledRef = useRef<string | null>(null);

  const submitMessage = async (
    rawText: string,
    baseMessages: ChatMessage[] = messages,
    clearComposer: boolean = true
  ) => {
    const trimmedInput = rawText.trim();
    if (!trimmedInput || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmedInput };
    const nextMessages = [...baseMessages, userMessage];
    const modelMessageIndex = nextMessages.length;

    setMessages([...nextMessages, { role: 'assistant', content: "David is reflecting…" }]);
    if (clearComposer) setInput('');
    setLoading(true);

    try {
      const history: ChatHistoryMessage[] = baseMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
      history.push({ role: 'user', content: userMessage.content });


      // Natural delay (1-2 seconds) before response starts
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

      // Clear thinking indicator and start streaming response
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[modelMessageIndex] = { role: 'assistant', content: "" };
        return newMessages;
      });

      const response = await getChatResponseStream(history, (fullText) => {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[modelMessageIndex] = { role: 'assistant', content: fullText };
          return newMessages;
        });
      }, profile?.preferred_response_length || 'medium', undefined, { userId: profile?.id || null });

      if (!response) {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[modelMessageIndex] = { role: 'assistant', content: "Something didn't come through clearly. Try saying that again, a little slower." };
          return newMessages;
        });
      }
    } catch (error: any) {
      // The free daily limit is not a failure — it is the paywall. Roll the
      // transcript back to before this turn so the conversation stays clean,
      // then hand over to the upgrade screen.
      if (isChatLimitReachedError(error)) {
        console.log('[Chat] Free daily limit reached — showing upgrade screen.');
        trackEvent('chat_limit_reached');
        setMessages(baseMessages);
        if (!clearComposer) setInput(trimmedInput);
        setLimitReached(true);
        setLoading(false);
        return;
      }

      console.error("Chat Error:", error);
      let errorMessage = "I'm having a bit of trouble connecting right now. Let's try again in a moment.";
      if (error?.message?.includes("quota") || error?.message?.includes("rate limit")) {
        errorMessage = "I need a short breather — a lot of people are talking with me right now. Try me again in a few minutes.";
      }
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages.length > modelMessageIndex) {
          newMessages[modelMessageIndex] = { role: 'assistant', content: errorMessage };
          return newMessages;
        }
        return [...prev, { role: 'assistant', content: errorMessage }];
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialPrompt = typeof route?.params?.initialPrompt === 'string'
      ? route.params.initialPrompt.trim()
      : '';
    const initialPromptKey = `${route?.params?.submittedAt || ''}:${initialPrompt}`;

    if (initialPrompt) {
      if (initialPromptHandledRef.current === initialPromptKey) return;
      initialPromptHandledRef.current = initialPromptKey;
      submitMessage(initialPrompt, [], false);
      return;
    }

    const randomGreeting = DAVID_CHAT_GREETINGS[Math.floor(Math.random() * DAVID_CHAT_GREETINGS.length)];
    setMessages([{ role: 'assistant', content: randomGreeting }]);
  }, [route?.params?.initialPrompt, route?.params?.submittedAt]);

  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  const handleSend = async () => {
    await submitMessage(input);
  };

  const handleFeedback = async (index: number, type: 'up' | 'down') => {
    const message = messages[index];
    if (!message || message.role !== 'assistant' || !profile) return;
    const isHelpful = type === 'up';
    setMessages(prev => prev.map((msg, i) =>
      i === index ? { ...msg, feedback: msg.feedback === type ? undefined : type } : msg
    ));
    await saveAIFeedback(profile.id, 'chat', message.content, isHelpful);
  };

  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setSpeakingIndex(null);
  };

  const speakMessage = async (index: number, text: string) => {
    if (speakingIndex === index) {
      stopSpeaking();
      return;
    }
    stopSpeaking();
    setSpeakingIndex(index);
    try {
      // generateSpeech returns a blob URL — use HTML Audio directly
      // Typed chat is silent. Audio here only ever comes from this button.
      const audioUrl = await generateSpeech(text, { source: SPEECH_USER_TAP });
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        audio.onended = () => {
          setSpeakingIndex(null);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
        };
        audio.onerror = () => {
          setSpeakingIndex(null);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
        };
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => setSpeakingIndex(null));
        }
      } else {
        setSpeakingIndex(null);
      }
    } catch (error) {
      console.error("Speech error:", error);
      setSpeakingIndex(null);
    }
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const startUpgrade = async (plan: CheckoutPlan) => {
    if (upgradeBusy) return;
    setUpgradeBusy(true);
    try {
      // Fired before the redirect: once Stripe takes over the tab, this code
      // no longer runs, so a post-redirect event would never be sent.
      trackEvent('checkout_started', { plan, from: 'chat_limit' });
      // Redirects to Stripe Checkout on success, so this rarely returns.
      await createCheckoutSession(plan);
    } catch (error: any) {
      console.error('[Chat] Upgrade could not start:', error?.message || error);
      setUpgradeBusy(false);
      setLimitReached(false);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: error?.message || "I couldn't open checkout just now. Please try again in a moment.",
      }]);
    }
  };

  // Free account has spent today's conversations — show the upgrade screen
  // instead of the composer. Dismissing returns them to the transcript.
  if (limitReached) {
    return (
      <DailyLimitUpgrade
        onUpgradePlus={() => startUpgrade('plus')}
        onUpgradePro={() => startUpgrade('pro')}
        onDismiss={() => setLimitReached(false)}
        busy={upgradeBusy}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>David</Text>
        </View>
        <Text style={styles.headerSubtitle}>AI Spiritual Companion</Text>
        <TouchableOpacity
          style={styles.headerCallButton}
          onPress={() => navigation.navigate('Voice')}
          accessibilityRole="button"
          accessibilityLabel="Start voice call with David"
        >
          <PhoneCall color="#ffffff" size={16} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatContainer}
        contentContainerStyle={styles.chatContent}
      >
        {messages.map((msg, index) => (
          <View
            key={index}
            style={[
              styles.messageBubble,
              msg.role === 'user' ? styles.userBubble : styles.modelBubble
            ]}
          >
            <Text style={[
              styles.messageText,
              msg.role === 'user' ? styles.userText : styles.modelText
            ]}>
              {msg.content}
            </Text>
            {msg.role === 'assistant' && (
              <View style={styles.feedbackContainer}>
                <TouchableOpacity
                  onPress={() => speakMessage(index, msg.content)}
                  style={styles.feedbackButton}
                >
                  {speakingIndex === index ? (
                    <Square size={14} color="#d4af37" fill="#d4af37" />
                  ) : (
                    <Volume2 size={14} color="rgba(212, 175, 55, 0.6)" />
                  )}
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => handleFeedback(index, 'up')} style={styles.feedbackButton}>
                  <ThumbsUp
                    size={14}
                    color={msg.feedback === 'up' ? '#d4af37' : 'rgba(212, 175, 55, 0.4)'}
                    fill={msg.feedback === 'up' ? '#d4af37' : 'transparent'}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleFeedback(index, 'down')} style={styles.feedbackButton}>
                  <ThumbsDown
                    size={14}
                    color={msg.feedback === 'down' ? '#ef4444' : 'rgba(212, 175, 55, 0.4)'}
                    fill={msg.feedback === 'down' ? '#ef4444' : 'transparent'}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
        {loading && (
          <View style={[styles.messageBubble, styles.modelBubble]}>
            <ActivityIndicator color="#d4af37" size="small" />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type your message..."
          value={input}
          onChangeText={setInput}
          multiline
          blurOnSubmit={false}
          onKeyPress={(e: any) => {
            if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={loading || !input.trim()}
        >
          <Send color="#fff" size={20} opacity={(!input.trim() || loading) ? 0.5 : 1} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: 40,
    paddingBottom: 14,
    paddingHorizontal: 18,
    backgroundColor: '#0b1e3d',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.3)',
    position: 'relative',
  },
  headerTitle: {
    fontFamily: 'Cinzel',
    fontSize: 15,
    fontWeight: '700',
    color: '#d4af37',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontFamily: 'Cinzel',
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(212, 175, 55, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 3,
  },
  headerCallButton: {
    position: 'absolute',
    top: 36,
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.5)',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  chatContainer: {
    flex: 1,
    minHeight: 0,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  messageBubble: {
    maxWidth: '85%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 4,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#d4af37',
  },
  modelBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(5, 16, 32, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  messageText: {
    fontFamily: 'Playfair Display',
    fontSize: 15,
    lineHeight: 24,
  },
  userText: {
    color: '#051020',
  },
  modelText: {
    color: '#ffffff',
  },
  feedbackContainer: {
    flexDirection: 'row',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.15)',
    paddingTop: 8,
    justifyContent: 'flex-end',
  },
  feedbackButton: {
    marginLeft: 10,
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0b1e3d',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.15)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(5, 16, 32, 0.5)',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 100,
    fontFamily: 'Playfair Display',
    fontSize: 14,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  sendButton: {
    backgroundColor: '#d4af37',
    width: 44,
    height: 44,
    borderRadius: 4,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(212, 175, 55, 0.3)',
  },
});
