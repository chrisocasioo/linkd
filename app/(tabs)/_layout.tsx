import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { COLORS } from '../../constants/colors';

function GenerateIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Rect x={2} y={2} width={8} height={8} rx={2} fill={color} />
      <Rect x={12} y={2} width={8} height={8} rx={2} fill={color} />
      <Rect x={2} y={12} width={8} height={8} rx={2} fill={color} />
      <Rect x={14} y={14} width={4} height={4} rx={1} fill={color} />
      <Rect x={12} y={12} width={4} height={4} rx={1} fill={color} opacity={0.4} />
      <Rect x={18} y={12} width={2} height={2} rx={0.5} fill={color} opacity={0.4} />
      <Rect x={12} y={18} width={2} height={2} rx={0.5} fill={color} opacity={0.4} />
    </Svg>
  );
}

function ScanIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Rect x={3} y={2} width={16} height={2} rx={1} fill={color} />
      <Rect x={3} y={18} width={16} height={2} rx={1} fill={color} />
      <Rect x={2} y={2} width={2} height={18} rx={1} fill={color} />
      <Rect x={18} y={2} width={2} height={18} rx={1} fill={color} />
      <Rect x={6} y={9} width={10} height={1.5} rx={0.75} fill={color} />
      <Rect x={6} y={12} width={7} height={1.5} rx={0.75} fill={color} />
    </Svg>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Circle cx={11} cy={8} r={4} fill={color} />
      <Path
        d="M3 19c0-4 3.6-7 8-7s8 3 8 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="generate"
        options={{
          title: 'Generate',
          tabBarIcon: ({ color }) => <GenerateIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) => <ScanIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 10,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: 'DMSans-Medium',
    letterSpacing: 0.1,
  },
});
