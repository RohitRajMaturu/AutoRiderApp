import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Platform, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Contacts from 'expo-contacts';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthModal, useAuthStore } from './store';
import TukTukGoLoader from '@/components/TukTukGoLoader';

const callbackUrl = '/api/auth/token?client=mobile';
const callbackPath = '/api/auth/token';
const onboardingUrl = '/onboarding';
const MOBILE_SIGNUP_ROLES = new Set(['passenger', 'driver']);

function contactDisplayName(contact) {
  return (
    contact?.name?.trim() ||
    [contact?.firstName, contact?.middleName, contact?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    contact?.nickname?.trim() ||
    ''
  );
}

function normalizeAuthParams(mode, params = {}) {
  if (mode !== 'signup') {
    return params || {};
  }

  const role = MOBILE_SIGNUP_ROLES.has(params?.role) ? params.role : 'passenger';
  return {
    ...(params || {}),
    role,
  };
}

function buildAuthPath(mode, params = {}, callback = callbackUrl) {
  const query = new URLSearchParams({ callbackUrl: callback, client: 'mobile' });
  const page = mode === 'signup' ? 'signin' : mode;
  if (mode === 'signup') {
    query.set('mode', 'signup');
  }
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  return `/account/${page}?${query.toString()}`;
}

function buildFreshAuthPath(mode, params = {}, callback = callbackUrl) {
  const next = buildAuthPath(mode, params, callback);
  return `/account/logout?next=${encodeURIComponent(next)}`;
}

/**
 * This renders a WebView for authentication and handles both web and native platforms.
 */
export const AuthWebView = ({ mode, params, proxyURL, baseURL }) => {
  const insets = useSafeAreaInsets();
  const mobileParams = useMemo(() => normalizeAuthParams(mode, params), [mode, params]);
  const isMobileSignup = mode === 'signup';
  const authCallback = isMobileSignup ? onboardingUrl : callbackUrl;
  const authParams = useMemo(
    () => (isMobileSignup ? { ...mobileParams, finalCallbackUrl: callbackUrl } : mobileParams),
    [isMobileSignup, mobileParams],
  );
  const [currentURI, setURI] = useState(`${baseURL}${buildFreshAuthPath(mode, authParams, authCallback)}`);
  const [isPageReady, setIsPageReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { auth, setAuth, isReady, isSigningOut } = useAuthStore();
  const { close, isOpen } = useAuthModal();
  const isAuthenticated = isReady ? !!auth : null;
  const iframeRef = useRef(null);
  const nativeWebViewRef = useRef(null);
  const initialPageLoadedRef = useRef(false);
  useEffect(() => {
    if (isSigningOut) {
      return;
    }
    if (Platform.OS === 'web') {
      return;
    }
    if (isAuthenticated) {
      close();
    }
  }, [isAuthenticated, close, isSigningOut]);
  useEffect(() => {
    if (isSigningOut) {
      return;
    }
    if (!isOpen) {
      return;
    }
    if (isAuthenticated) {
      return;
    }
    setIsPageReady(false);
    setAuthError(null);
    initialPageLoadedRef.current = false;
    fadeAnim.setValue(0);
    const nextUri = `${baseURL}${buildFreshAuthPath(mode, authParams, authCallback)}`;
    setURI(nextUri);
  }, [mode, authParams, authCallback, baseURL, isAuthenticated, fadeAnim, isOpen, isSigningOut]);

  useEffect(() => {
    if (isSigningOut) {
      return;
    }
    if (isPageReady || isAuthenticated) {
      return;
    }
    const timer = setTimeout(() => {
      setAuthError('Still loading. Check the server URL and try again.');
      setIsPageReady(true);
      fadeAnim.setValue(1);
    }, 8000);
    return () => clearTimeout(timer);
  }, [isPageReady, isAuthenticated, currentURI, fadeAnim, isSigningOut]);

  const handlePageLoaded = () => {
    initialPageLoadedRef.current = true;
    setIsPageReady(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const loadingView = (
    <View
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: '#EAF0F1',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
      }}
      pointerEvents="none"
    >
      <TukTukGoLoader
        size={76}
        color="#43B8B3"
        textColor="#586C70"
        label={authError || 'Opening TukTukGo...'}
      />
    </View>
  );

  const errorBanner = authError ? (
    <View
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 24,
        zIndex: 3,
        borderRadius: 14,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        padding: 12,
      }}
    >
      <Text style={{ color: '#B91C1C', fontSize: 13, fontWeight: '800', textAlign: 'center' }}>
        {authError}
      </Text>
    </View>
  ) : null;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) {
      return;
    }
    const handleMessage = (event) => {
      // Verify the origin for security
      if (event.origin !== process.env.EXPO_PUBLIC_PROXY_BASE_URL) {
        return;
      }
      if (event.data.type === 'AUTH_SUCCESS') {
        setAuth({
          jwt: event.data.jwt,
          user: event.data.user,
        });
      } else if (event.data.type === 'AUTH_ERROR') {
        setAuthError(event.data.error || 'Authentication failed');
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [setAuth]);

  if (Platform.OS === 'web') {
    const handleIframeError = () => {
      setAuthError('Authentication page failed to load');
    };

    return (
      <View style={{ flex: 1, backgroundColor: '#EAF0F1' }}>
        {!isPageReady && loadingView}
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <iframe
            ref={iframeRef}
            title="TukTukGo authentication"
            src={`${proxyURL}${buildFreshAuthPath(
              mode,
              isMobileSignup
                ? { ...mobileParams, finalCallbackUrl: '/api/auth/expo-web-success' }
                : mobileParams,
              isMobileSignup ? onboardingUrl : '/api/auth/expo-web-success',
            )}`}
            style={{ width: '100%', height: '100%', border: 'none' }}
            onLoad={handlePageLoaded}
            onError={handleIframeError}
          />
        </Animated.View>
        {errorBanner}
      </View>
    );
  }

  const handleNativeMessage = async (event) => {
    let message;
    try {
      message = JSON.parse(event.nativeEvent?.data || '{}');
    } catch {
      return;
    }
    if (message?.type === 'AUTH_SUCCESS') {
      if (!message.jwt) {
        setAuthError('Login response was incomplete. Please try again.');
        return;
      }
      setAuthError(null);
      setAuth({ jwt: message.jwt, user: message.user });
      return;
    }
    if (message?.type === 'AUTH_ERROR') {
      setAuthError(message.error || 'Login did not complete. Please try again.');
      setIsPageReady(true);
      return;
    }
    if (message?.type !== 'PICK_EMERGENCY_CONTACT') return;

    try {
      const permission = await Contacts.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Contacts Permission', 'Allow contacts access to choose an emergency contact.');
        return;
      }
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;
      const phone = contact.phoneNumbers?.find((item) => item.number)?.number || '';
      const detail = JSON.stringify({ name: contactDisplayName(contact), phone });
      nativeWebViewRef.current?.injectJavaScript(`
        window.dispatchEvent(new CustomEvent('TUKTUKGO_CONTACT_SELECTED', {
          detail: ${detail}
        }));
        true;
      `);
    } catch {
      Alert.alert('Contact Picker Unavailable', 'Please enter the emergency contact manually.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#EAF0F1' }}>
      <TouchableOpacity
        onPress={close}
        activeOpacity={0.82}
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 16,
          zIndex: 4,
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: '#FFFFFFEE',
          borderWidth: 1,
          borderColor: '#D8E4E5',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityRole="button"
        accessibilityLabel="Back to TukTukGo home"
      >
        <ArrowLeft size={20} color="#17272B" />
      </TouchableOpacity>
      {!isPageReady && loadingView}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <WebView
          ref={nativeWebViewRef}
          sharedCookiesEnabled
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          keyboardDisplayRequiresUserAction={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled
          nestedScrollEnabled
          source={{
            uri: currentURI,
          }}
          headers={{
            'x-createxyz-project-group-id': process.env.EXPO_PUBLIC_PROJECT_GROUP_ID,
            host: process.env.EXPO_PUBLIC_HOST,
            'x-forwarded-host': process.env.EXPO_PUBLIC_HOST,
            'x-createxyz-host': process.env.EXPO_PUBLIC_HOST,
          }}
          onLoadStart={() => {
            // Only the initial auth-page load should use the full-screen
            // watchdog. Credential submissions and callback redirects are
            // normal WebView navigations and must not restart that timer.
            if (!initialPageLoadedRef.current) {
              setIsPageReady(false);
              fadeAnim.setValue(0);
            }
          }}
          onLoadEnd={handlePageLoaded}
          onError={(event) => {
            setAuthError(event.nativeEvent?.description || 'WebView failed to load');
            setIsPageReady(true);
            fadeAnim.setValue(1);
          }}
          onHttpError={(event) => {
            setAuthError(`HTTP ${event.nativeEvent?.statusCode || ''} while loading auth`);
            setIsPageReady(true);
            fadeAnim.setValue(1);
          }}
          onMessage={handleNativeMessage}
          onShouldStartLoadWithRequest={(request) => {
            const requestPath = (() => {
              try {
                return new URL(request.url).pathname;
              } catch {
                return "";
              }
            })();
            if (requestPath === callbackPath) {
              setAuthError(null);
              // Let the authenticated WebView open the callback. The callback
              // posts the token through ReactNativeWebView, preserving the
              // WebView cookie jar instead of using React Native fetch.
              return true;
            }
            return true;
          }}
          style={{ flex: 1, backgroundColor: '#EAF0F1' }}
        />
      </Animated.View>
      {errorBanner}
    </View>
  );
};
