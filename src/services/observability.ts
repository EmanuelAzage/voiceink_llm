import * as Sentry from '@sentry/react-native';
import Config from 'react-native-config';

export function initObservability(): void {
  if (!Config.SENTRY_DSN) return;
  Sentry.init({
    dsn: Config.SENTRY_DSN,
    enableLogs: true,
    tracesSampleRate: 0,
  });
}

export function reportExtractionFailure(
  reason: 'timeout' | 'network' | 'invalid-response',
  model: string,
): void {
  Sentry.logger.warn('extraction failed', { reason, model });
}

export function reportFallbackModelUsed(primaryModel: string, fallbackModel: string): void {
  Sentry.logger.info('extraction fallback model used', { primaryModel, fallbackModel });
}
