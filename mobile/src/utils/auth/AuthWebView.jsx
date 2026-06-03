import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuthStore } from './store';

const callbackUrl = '/api/auth/token';
const callbackQueryString = `callbackUrl=${callbackUrl}`;

/**
 * This renders a WebView for authentication and handles both web and native platforms.
 */
export const AuthWebView = ({ mode, proxyURL, baseURL }) => {
  const [currentURI, setURI] = useState(`${baseURL}/account/${mode}?${callbackQueryString}`);
  const [isPageReady, setIsPageReady] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { auth, setAuth, isReady } = useAuthStore();
  const isAuthenticated = isReady ? !!auth : null;
  const iframeRef = useRef(null);
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    if (isAuthenticated) {
      router.back();
    }
  }, [isAuthenticated]);
  useEffect(() => {
    if (isAuthenticated) {
      return;
    }
    setIsPageReady(false);
    fadeAnim.setValue(0);
    setURI(`${baseURL}/account/${mode}?${callbackQueryString}`);
  }, [mode, baseURL, isAuthenticated, fadeAnim]);

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
        backgroundColor: '#1C1917',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
      }}
      pointerEvents="none"
    >
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 24,
          backgroundColor: '#F97316',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>AC</Text>
      </View>
      <ActivityIndicator color="#F97316" />
      <Text style={{ marginTop: 12, color: '#D6D3D1', fontSize: 13, fontWeight: '700' }}>
        Opening Auto Ride...
      </Text>
    </View>
  );

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
        console.error('Auth error:', event.data.error);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [setAuth]);

  if (Platform.OS === 'web') {
    const handleIframeError = () => {
      console.error('Failed to load auth iframe');
    };

    return (
      <View style={{ flex: 1, backgroundColor: '#1C1917' }}>
        {!isPageReady && loadingView}
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <iframe
            ref={iframeRef}
            title="Auto Ride authentication"
            src={`${proxyURL}/account/${mode}?callbackUrl=/api/auth/expo-web-success`}
            style={{ width: '100%', height: '100%', border: 'none' }}
            onLoad={handlePageLoaded}
            onError={handleIframeError}
          />
        </Animated.View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: '#1C1917' }}>
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
          onShouldStartLoadWithRequest={(request) => {
            if (request.url === `${baseURL}${callbackUrl}`) {
              fetch(request.url, { credentials: 'include' }).then(async (response) => {
                if (!response.ok) {
                  console.error('[AuthWebView] Token fetch failed:', response.status);
                  return;
                }
                response.json().then((data) => {
                  if (!data.jwt) {
                    console.error('[AuthWebView] Token response missing jwt');
                    return;
                  }
                  setAuth({ jwt: data.jwt, user: data.user });
                });
              }).catch((err) => {
                console.error('[AuthWebView] Token fetch error:', err);
              });
              return false;
            }
            if (request.url === currentURI) return true;

            const hasParams = request.url.includes('?');
            const separator = hasParams ? '&' : '?';
            const newURL = request.url.replaceAll(proxyURL, baseURL);
            if (newURL.endsWith(callbackUrl)) {
              setURI(newURL);
              return false;
            }
            setURI(`${newURL}${separator}${callbackQueryString}`);
            return false;
          }}
          style={{ flex: 1, backgroundColor: '#1C1917' }}
        />
      </Animated.View>
    </View>
  );
};
