import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLogHubStore, openLogHub } from '../store/logHubStore';
import { useDeepLinkStore } from '../store/deepLinkStore';
import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { HistoryScreen } from '../screens/History/HistoryScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import type { ScanMode } from './ScanNavigator';
import { LogHubSheet } from '../components/LogHubSheet';
import type { RootStackParamList } from './RootNavigator';
import { T, spacing } from '../theme';

export type MainTabParamList = {
  Home: undefined;
  /**
   * A placeholder that is never navigated to. It exists only so the tab bar
   * keeps its five-slot layout with the raised button in the middle — the
   * button opens the log hub, and the camera itself lives on the root stack.
   */
  LogButton: undefined;
  History: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Never rendered — see `LogButton` above. */
const NoopScreen = () => null;

function ScanTabButton({ onPress }: { onPress: () => void }) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.scanButton}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Log something"
    >
      <View style={styles.scanButtonInner}>
        <Ionicons name="add" size={32} color={T.textOnPrimary} />
      </View>
    </TouchableOpacity>
  );
}

export function MainTabNavigator() {
  // MainTabNavigator is itself a root-stack screen, so this is the root
  // navigator — which is what Water and LogFromHistory live on.
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const hubOpen = useLogHubStore((s) => s.open);
  const setHubOpen = useLogHubStore((s) => s.setOpen);

  const openScan = (mode: ScanMode) => rootNav.navigate('Scan', { mode });

  // Launcher shortcuts land here. This navigator only mounts for a signed-in,
  // onboarded user, so a link parked during the splash or a sign-out is applied
  // the moment the gate opens — and one arriving while the app is already up
  // navigates straight away.
  const pendingLink = useDeepLinkStore((s) => s.pending);
  useEffect(() => {
    if (!pendingLink) return;
    const link = useDeepLinkStore.getState().consume();
    if (!link) return;
    setHubOpen(false);
    if (link.name === 'Scan') rootNav.navigate('Scan', link.params);
    else rootNav.navigate('Water');
  }, [pendingLink]);

  return (
    <>
      <Tab.Navigator
        // Android hardware back from History or Profile returns to Home rather
        // than closing the app.
        backBehavior="initialRoute"
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            ...styles.tabBar,
            // Home-indicator phones get their inset; everything else a 12px floor.
            // The height must be set explicitly: without it the navigator keeps
            // its 49pt default and the padding squeezes the icon and label until
            // they clip.
            paddingBottom: Math.max(insets.bottom, spacing.md),
            height: TAB_CONTENT_HEIGHT + Math.max(insets.bottom, spacing.md),
          },
          tabBarItemStyle: styles.tabItem,
          tabBarActiveTintColor:   T.primary,
          tabBarInactiveTintColor: T.textMuted,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tab.Screen
          name="Home"
          component={DashboardScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="LogButton"
          component={NoopScreen}
          options={{
            tabBarLabel: '',
            // The centre button no longer jumps straight to the camera. There are
            // four ways to log now and only one of them needs a lens, so it opens
            // the hub instead — the tab's own `onPress` is never called, which is
            // why the screen behind it is a no-op.
            tabBarButton: () => <ScanTabButton onPress={openLogHub} />,
          }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{
            tabBarLabel: 'History',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>

      <LogHubSheet
        visible={hubOpen}
        onClose={() => setHubOpen(false)}
        onPhoto={() => openScan('meal')}
        onVoice={() => openScan('voice')}
        onHistory={() => rootNav.navigate('LogFromHistory')}
        onWaterMore={() => rootNav.navigate('Water')}
      />
    </>
  );
}

/** Icon (24) + label (16) + gaps, plus the bar's own top padding. */
const TAB_CONTENT_HEIGHT = 60;

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    backgroundColor: T.surface,
    borderTopColor: T.border,
  },
  tabLabel: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  tabItem: { paddingTop: 2, paddingBottom: 2 },
  scanButton: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: T.primary,
    shadowColor: T.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  scanButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
