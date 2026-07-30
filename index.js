/**
 * @format
 */

// Must be the very first import — react-native-gesture-handler patches
// native event handling and misbehaves if anything else imports first.
import 'react-native-gesture-handler';

import { AppRegistry } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { setPendingDeepLinkCardId } from './src/services/notifications';

// Registered here, outside the component tree: Android can wake the JS
// engine specifically to run this while the app is fully backgrounded, before
// any React code (and therefore any navigationRef) exists. It just persists
// the target card id; RootNavigator picks it up and navigates on next launch.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const cardId = detail.notification?.data?.cardId;
  if (type === EventType.PRESS && typeof cardId === 'string') {
    setPendingDeepLinkCardId(cardId);
  }
});

AppRegistry.registerComponent(appName, () => App);
