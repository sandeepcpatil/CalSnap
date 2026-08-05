import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { HistoryScreen } from '../screens/History/HistoryScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import type { ScanMode } from './ScanNavigator';
import { LogHubSheet } from '../components/LogHubSheet';
import { useTheme } from '../hooks/useTheme';
import type { RootStackParamList } from './RootNavigator';

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

function ScanTabButton({ onPress, color }: { onPress: () => void; color: string }) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.scanButton, { backgroundColor: color, shadowColor: color }]}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Log something"
    >
      <View style={styles.scanButtonInner}>
        <Ionicons name="add" size={32} color="#ffffff" />
      </View>
    </TouchableOpacity>
  );
}

export function MainTabNavigator() {
  const { theme } = useTheme();
  // MainTabNavigator is itself a root-stack screen, so this is the root
  // navigator — which is what Water and LogFromHistory live on.
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [hubOpen, setHubOpen] = useState(false);

  const openScan = (mode: ScanMode) => rootNav.navigate('Scan', { mode });

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
            backgroundColor: theme.tabBarBg,
            borderTopColor: theme.tabBarBorder,
          },
          tabBarActiveTintColor:   theme.tabBarActive,
          tabBarInactiveTintColor: theme.tabBarInactive,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        }}
      >
        <Tab.Screen
          name="Home"
          component={DashboardScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
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
            tabBarButton: () => (
              <ScanTabButton onPress={() => setHubOpen(true)} color={theme.primary} />
            ),
          }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{
            tabBarLabel: 'History',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
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

const styles = StyleSheet.create({
  tabBar: {
    height: 80,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  scanButton: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
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
