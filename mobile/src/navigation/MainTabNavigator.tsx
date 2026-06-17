import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { HistoryScreen } from '../screens/History/HistoryScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { ScanNavigator } from './ScanNavigator';
import { useTheme } from '../hooks/useTheme';

export type MainTabParamList = {
  Home: undefined;
  Scan: undefined;
  History: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function ScanTabButton({ onPress, color }: { onPress: () => void; color: string }) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} style={[styles.scanButton, { backgroundColor: color, shadowColor: color }]} activeOpacity={0.85}>
      <View style={styles.scanButtonInner}>
        <Ionicons name="camera" size={28} color="#ffffff" />
      </View>
    </TouchableOpacity>
  );
}

export function MainTabNavigator() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
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
        name="Scan"
        component={ScanNavigator}
        options={{
          tabBarLabel: '',
          tabBarButton: (props) => (
            <ScanTabButton onPress={props.onPress as () => void} color={theme.primary} />
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
