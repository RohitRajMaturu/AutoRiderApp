import { SplashScreen } from 'expo-router/build/exports';
import * as Updates from 'expo-updates';
import React, { type ReactNode, useCallback, useEffect } from 'react';
import { Platform, View } from 'react-native';
import { isErrorLike, serializeError } from 'serialize-error';
import { Button, SharedErrorBoundary } from './SharedErrorBoundary';
import { reportErrorToRemote } from './report-error-to-remote';
import { getTestFlightLogger } from './testflight-logger';

type ErrorBoundaryState = {
  hasError: boolean;
  error: unknown | null;
  sentLogs: boolean;
};

const DeviceErrorBoundary = ({ sentLogs }: { sentLogs: boolean }) => {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const handleReload = useCallback(async () => {
    if (Platform.OS === 'web') {
      window.location.reload();
      return;
    }

    Updates.reloadAsync().catch(() => {});
  }, []);

  return (
    <SharedErrorBoundary
      isOpen
      description={
        sentLogs
          ? 'Auto Ride ran into an unexpected issue and saved the error details for diagnostics.'
          : 'Auto Ride ran into an unexpected issue. Please restart the app and try again.'
      }
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button color="primary" onPress={handleReload}>
          Restart app
        </Button>
      </View>
    </SharedErrorBoundary>
  );
};

export class DeviceErrorBoundaryWrapper extends React.Component<
  {
    children: ReactNode;
  },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    sentLogs: false,
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error, sentLogs: false };
  }

  componentDidCatch(error: unknown): void {
    this.setState({ error });
    const logger = getTestFlightLogger();
    if (logger) {
      const serialized = serializeError(error);
      logger.logError(
        `[ERROR_BOUNDARY] ${isErrorLike(serialized) ? serialized.message : JSON.stringify(serialized)}`
      );
    }
    reportErrorToRemote({ error })
      .then(({ success }) => {
        this.setState({ hasError: true, sentLogs: success });
      })
      .catch(() => {
        this.setState({ hasError: true, sentLogs: false });
      });
  }

  render() {
    if (this.state.hasError) {
      return <DeviceErrorBoundary sentLogs={this.state.sentLogs} />;
    }
    return this.props.children;
  }
}
