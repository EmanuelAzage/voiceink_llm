import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, Text } from 'react-native';
import type { RootStackParamList } from './types';
import HomeScreen from '@/screens/HomeScreen';
import CaptureScreen from '@/screens/CaptureScreen';
import ReviewScreen from '@/screens/ReviewScreen';
import DetailScreen from '@/screens/DetailScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import { useTheme } from '@/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Defined once at module scope (not inside RootNavigator's render) and passed by
// reference to `headerRight` below, so it never trips eslint's
// no-unstable-nested-components: it isn't recreated on every render.
function HomeHeaderRight() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Home'>>();

  return (
    <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}>
      <Text style={{ color: colors.primary }}>Settings</Text>
    </Pressable>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer>
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
