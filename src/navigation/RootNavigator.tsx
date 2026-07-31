import { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef, useNavigation } from '@react-navigation/native';
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
import { useTheme } from '@/theme';
import { consumePendingDeepLinkCardId } from '@/services/notifications';

const Stack = createNativeStackNavigator<RootStackParamList>();

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
