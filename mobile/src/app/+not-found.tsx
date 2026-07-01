import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/theme/tokens';

export default function NotFoundScreen() {
  const router = useRouter();

  const goHome = () => {
    router.replace('/');
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Not Found', headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.flagBar}>
          <View style={[styles.flagSegment, { backgroundColor: theme.accent }]} />
          <View style={[styles.flagSegment, { backgroundColor: theme.surface1 }]} />
          <View style={[styles.flagSegment, { backgroundColor: theme.ok }]} />
        </View>

        <View style={styles.content}>
          <View style={styles.logo}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.kicker}>Route not found</Text>
          <Text style={styles.title}>This road is not open yet.</Text>
          <Text style={styles.subtitle}>
            Head back to TukTukGo and continue from a known screen.
          </Text>

          <TouchableOpacity style={styles.button} onPress={goHome} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Back to TukTukGo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  flagBar: {
    height: 4,
    flexDirection: 'row',
  },
  flagSegment: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logo: {
    width: 82,
    height: 82,
    borderRadius: 24,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  logoImage: {
    width: 74,
    height: 74,
    borderRadius: 22,
  },
  kicker: {
    color: theme.accentText,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  title: {
    color: theme.text1,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 16,
    color: theme.text2,
    fontSize: 15,
    lineHeight: 23,
  },
  button: {
    marginTop: 28,
    backgroundColor: theme.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: theme.surface1,
    fontSize: 16,
    fontWeight: '900',
  },
});

