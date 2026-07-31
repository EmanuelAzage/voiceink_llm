import { useEffect } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  createNavigationContainerRef,
  useNavigation,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable } from 'react-native';
import { Settings as SettingsIcon } from 'lucide-react-native';
import notifee, { EventType } from '@notifee/react-native';
import type { RootStackParamList } from './types';
import HomeScreen from '@/screens/HomeScreen';
import CaptureScreen from '@/screens/CaptureScreen';
import ReviewScreen from '@/screens/ReviewScreen';
import DetailScreen from '@/screens/DetailScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import { useTheme, colors as themeColors } from '@/theme';
import { consumePendingDeepLinkCardId } from '@/services/notifications';

const Stack = createNativeStackNavigator<RootStackParamList>();

// React Navigation's own DefaultTheme/DarkTheme (light chrome regardless of
// OS scheme unless a theme is explicitly passed) don't know about this app's
// palette — without this, the native header stays light in dark mode while
// every screen body (driven by useTheme()) goes dark. Built from our own
// tokens so header chrome always matches the rest of the UI.
const lightNavTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: themeColors.light.primary,
    background: themeColors.light.background,
    card: themeColors.light.background,
    text: themeColors.light.text,
    border: themeColors.light.border,
  },
};
const darkNavTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: themeColors.dark.primary,
    background: themeColors.dark.background,
    card: themeColors.dark.background,
    text: themeColors.dark.text,
    border: themeColors.dark.border,
  },
};

const navigationRef = createNavigationContainerRef<RootStackParamList>();

// The container isn't necessarily ready the instant a tap/cold-start deep
// link resolves (getInitialNotification is async), so a nav requested too
// early is queued here and flushed from NavigationContainer's onReady below.
let pendingNavigation: (() => void) | null = null;

function navigateToCardDetail(cardId: string) {
  const action = () => navigationRef.navigate('Detail', { cardId });
  if (navigationRef.isReady()) {
    action();
  } else {
    pendingNavigation = action;
  }
}

// Defined once at module scope (not inside RootNavigator's render) and passed by
// reference to `headerRight` below, so it never trips eslint's
// no-unstable-nested-components: it isn't recreated on every render.
function HomeHeaderRight() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Home'>>();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('Settings')}
      accessibilityLabel="Settings"
      hitSlop={13}
    >
      <SettingsIcon size={22} color={colors.primary} />
    </Pressable>
  );
}

export function RootNavigator() {
  const { scheme } = useTheme();

  useEffect(() => {
    notifee.getInitialNotification().then(initial => {
      const cardId = initial?.notification.data?.cardId;
      if (typeof cardId === 'string') navigateToCardDetail(cardId);
    });

    const pendingCardId = consumePendingDeepLinkCardId();
    if (pendingCardId) navigateToCardDetail(pendingCardId);

    return notifee.onForegroundEvent(({ type, detail }) => {
      const cardId = detail.notification?.data?.cardId;
      if (type === EventType.PRESS && typeof cardId === 'string') navigateToCardDetail(cardId);
    });
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={scheme === 'dark' ? darkNavTheme : lightNavTheme}
      onReady={() => {
        pendingNavigation?.();
        pendingNavigation = null;
      }}
    >
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'VoiceInk', headerRight: HomeHeaderRight }}
        />
        <Stack.Screen
          name="Capture"
          component={CaptureScreen}
          options={{ presentation: 'modal', title: 'Capture' }}
        />
        <Stack.Screen name="Review" component={ReviewScreen} options={{ title: 'Review' }} />
        <Stack.Screen name="Detail" component={DetailScreen} options={{ title: 'Detail' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
