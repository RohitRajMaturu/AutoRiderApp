import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuthModal, useAuthStore } from './store';
import AutoRiderLoader from '@/components/AutoRiderLoader';

const callbackUrl = '/api/auth/token';
const onboardingUrl = '/onboarding';

function buildAuthPath(mode, params = {}, callback = callbackUrl) {
  const query = new URLSearchParams({ callbackUrl: callback });
  const page = mode === 'signup' ? 'signin' : mode;
  if (mode === 'signup') {
    query.set('mode', 'signup');
    query.set('client', 'mobile');
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
  const isAdminSignup = mode === 'signup' && params?.role === 'admin';
  const authCallback = mode === 'signup' && !isAdminSignup ? onboardingUrl : callbackUrl;
  const authParams = useMemo(
    () => (mode === 'signup' && !isAdminSignup ? { ...params, finalCallbackUrl: callbackUrl } : params),
    [mode, params, isAdminSignup],
  );
  const [currentURI, setURI] = useState(`${baseURL}${buildFreshAuthPath(mode, authParams, authCallback)}`);
  const [isPageReady, setIsPageReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { auth, setAuth, isReady } = useAuthStore();
  const { close } = useAuthModal();
  const isAuthenticated = isReady ? !!auth : null;
  const iframeRef = useRef(null);
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    if (isAuthenticated) {
      close();
    }
  }, [isAuthenticated, close]);
  useEffect(() => {
    if (isAuthenticated) {
      return;
    }
    setIsPageReady(false);
    setAuthError(null);
    fadeAnim.setValue(0);
    const nextUri = `${baseURL}${buildFreshAuthPath(mode, authParams, authCallback)}`;
    setURI(nextUri);
  }, [mode, authParams, authCallback, baseURL, isAuthenticated, fadeAnim]);

  useEffect(() => {
    if (isPageReady || isAuthenticated) {
      return;
    }
    const timer = setTimeout(() => {
      setAuthError('Still loading. Check the server URL and try again.');
      setIsPageReady(true);
      fadeAnim.setValue(1);
    }, 8000);
    return () => clearTimeout(timer);
  }, [isPageReady, isAuthenticated, currentURI, fadeAnim]);

  const handlePageLoaded = () => {
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
      <AutoRiderLoader
        size={76}
        color="#43B8B3"
        textColor="#586C70"
        label={authError || 'Opening Auto Ride...'}
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
            title="Auto Ride authentication"
            src={`${proxyURL}${buildFreshAuthPath(
              mode,
              mode === 'signup' && params?.role !== 'admin'
                ? { ...params, finalCallbackUrl: '/api/auth/expo-web-success' }
                : params,
              mode === 'signup' && params?.role !== 'admin' ? onboardingUrl : '/api/auth/expo-web-success',
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
  return (
    <View style={{ flex: 1, backgroundColor: '#EAF0F1' }}>
      {!isPageReady && loadingView}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <WebView
          sharedCookiesEnabled
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
            setIsPageReady(false);
            fadeAnim.setValue(0);
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
          onShouldStartLoadWithRequest={(request) => {
            const requestPath = (() => {
              try {
                return new URL(request.url).pathname;
              } catch {
                return "";
              }
            })();
            if (requestPath === callbackUrl) {
              setAuthError(null);
              fetch(request.url, { credentials: 'include' }).then(async (response) => {
                if (!response.ok) {
                  setAuthError('Login did not complete. Please try again.');
                  setIsPageReady(true);
                  setURI(`${baseURL}${buildFreshAuthPath(mode, authParams, authCallback)}`);
                  return;
                }
                response.json().then((data) => {
                  if (!data.jwt) {
                    setAuthError('Login response was incomplete. Please try again.');
                    setIsPageReady(true);
                    setURI(`${baseURL}${buildFreshAuthPath(mode, authParams, authCallback)}`);
                    return;
                  }
                  setAuth({ jwt: data.jwt, user: data.user });
                });
              }).catch(() => {
                setAuthError('Login failed. Please try again.');
                setIsPageReady(true);
                setURI(`${baseURL}${buildFreshAuthPath(mode, authParams, authCallback)}`);
              });
              return false;
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
