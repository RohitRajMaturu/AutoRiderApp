import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect } from 'react';
import { useAuthModal, useAuthStore, authKey, secureStoreOptions } from './store';
import useAppStore from '@/store/useAppStore';
import queryClient from '@/utils/queryClient';

const MOBILE_SIGNUP_ROLES = new Set(['passenger', 'driver']);

function getMobileSignupRole(role) {
  return MOBILE_SIGNUP_ROLES.has(role) ? role : 'passenger';
}

/**
 * This hook provides authentication functionality.
 * It may be easier to use the `useAuthModal` or `useRequireAuth` hooks
 * instead as those will also handle showing authentication to the user
 * directly.
 */
export const useAuth = () => {
  const { isReady, auth, setAuth, isSigningOut, setSigningOut } = useAuthStore();
  const { close, open } = useAuthModal();
  const disableTestMode = useAppStore((state) => state.disableTestMode);
  const resetSessionState = useAppStore((state) => state.resetSessionState);

  const initiate = useCallback(() => {
    // The auth state machine must always reach a terminal state. SecureStore
    // can throw or hang in TestFlight release builds (Keychain access denied,
    // missing keychain-access-groups entitlement after EAS migration, locked
    // device first-unlock state, or iOS 26 TurboModule rethrow). Without a
    // catch the unhandled rejection leaves isReady=false forever and the
    // RootLayout renders null — the user sees a blank screen indefinitely.
    Promise.race([
      SecureStore.getItemAsync(authKey, secureStoreOptions),
      new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
    ])
      .then((stored) => {
        const nextAuth = stored ? JSON.parse(stored) : null;
        queryClient.clear();
        useAuthStore.setState({
          auth: nextAuth,
          isReady: true,
        });
      })
      .catch(() => {
        queryClient.clear();
        useAuthStore.setState({ auth: null, isReady: true });
      });
  }, []);

  useEffect(() => {}, []);

  const signIn = useCallback((options) => {
    open({ mode: 'signin', params: options?.params });
  }, [open]);
  const signUp = useCallback((options) => {
    const params = options?.params || {};
    open({
      mode: 'signup',
      params: {
        ...params,
        role: getMobileSignupRole(params.role),
      },
    });
  }, [open]);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    try {
      close();

      await queryClient.cancelQueries();

      setAuth(null);
      queryClient.removeQueries({ queryKey: ["userProfile"] });

      await Promise.allSettled([
        Promise.resolve(resetSessionState()),
        Promise.resolve(disableTestMode()),
        SecureStore.deleteItemAsync(authKey, secureStoreOptions),
      ]);
    } finally {
      setTimeout(() => setSigningOut(false), 500);
    }
  }, [close, disableTestMode, resetSessionState, setAuth, setSigningOut]);

  return {
    isReady,
    isAuthenticated: isReady ? !!auth : null,
    isSigningOut,
    signIn,
    signOut,
    signUp,
    auth,
    setAuth,
    initiate,
  };
};

/**
 * This hook will automatically open the authentication modal if the user is not authenticated.
 */
export const useRequireAuth = (options) => {
  const { isAuthenticated, isReady } = useAuth();
  const { open } = useAuthModal();

  useEffect(() => {
    if (!isAuthenticated && isReady) {
      open({ mode: options?.mode });
    }
  }, [isAuthenticated, open, options?.mode, isReady]);
};

export default useAuth;
