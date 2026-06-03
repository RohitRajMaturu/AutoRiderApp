import React from 'react';
import '@expo/metro-runtime';
import 'react-native-url-polyfill/auto';
import './src/__create/polyfills';
import { Buffer } from 'buffer';
import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';

global.Buffer = Buffer;

const context = require.context('./src/app');

function AutoRideApp() {
  return <ExpoRoot context={context} />;
}

registerRootComponent(AutoRideApp);
