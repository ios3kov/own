import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabIcon } from './TabIcon';
import { SpotlightTourProvider } from 'react-native-spotlight-tour';
import { useTheme } from '../theme';
import { triggerHaptic } from '../utils/haptics';
import { useAppStore } from '../stores';
import { createSpotlightSteps } from '../components/onboarding/spotlightConfig';
import {
  OnboardingScreen,
  ModelDownloadScreen,
  HomeScreen,
  ModelsScreen,
  ChatScreen,
  SettingsScreen,
  ProjectsScreen,
  ChatsListScreen,
  ProjectDetailScreen,
  ProjectEditScreen,
  ProjectChatsScreen,
  KnowledgeBaseScreen,
  DocumentPreviewScreen,
  DownloadManagerScreen,
  ModelSettingsScreen,
  VoiceSettingsScreen,
  DeviceInfoScreen,
  StorageSettingsScreen,
  SecuritySettingsScreen,
  GalleryScreen,
  RemoteServersScreen,
  AboutScreen,
} from '../screens';
import {
  RootStackParamList,
  MainTabParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const mainTabsStyles = StyleSheet.create({
  label: { fontSize: 11, lineHeight: 14, textAlign: 'center', paddingHorizontal: 2 },
  selectedLabel: { fontWeight: '600' },
  plainLabel: { fontWeight: '400' },
  container: { flex: 1 },
});

// Main Tab Navigator
const MainTabs: React.FC = () => {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  const navigationScale = Math.min(fontScale, 1.5);
  const tabBarHeight = 36 + 14 * navigationScale + bottomInset;

  return (
    <View style={mainTabsStyles.container}>
      <Tab.Navigator
        backBehavior="history"
        screenListeners={({ navigation }) => ({
          tabPress: () => { if (!navigation.isFocused()) triggerHaptic('selection'); },
        })}
        screenOptions={({ route }) => ({
          headerShown: false,
          animation: 'fade',
          lazy: true,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingBottom: bottomInset,
            paddingTop: 6,
          },
          tabBarHideOnKeyboard: true,
          tabBarActiveBackgroundColor: `${colors.primary}12`,
          tabBarItemStyle: { borderRadius: 12, marginHorizontal: 2 },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarIcon: ({ focused }) => (
            <TabIcon name={route.name} color={focused ? colors.primary : colors.textMuted} />
          ),
          tabBarLabel: ({ focused, children }) => (
            <Text maxFontSizeMultiplier={1.5} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[mainTabsStyles.label, focused ? mainTabsStyles.selectedLabel : mainTabsStyles.plainLabel,
              { color: focused ? colors.primary : colors.textMuted }]}>
              {children}
            </Text>
          ),
        })}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{ title: 'Home', tabBarButtonTestID: 'home-tab' }}
        />
        <Tab.Screen
          name="ChatsTab"
          component={ChatsListScreen}
          options={{ title: 'Chats', tabBarButtonTestID: 'chats-tab' }}
        />
        <Tab.Screen
          name="ProjectsTab"
          component={ProjectsScreen}
          options={{ title: 'Projects', tabBarButtonTestID: 'projects-tab' }}
        />
        <Tab.Screen
          name="ModelsTab"
          component={ModelsScreen}
          options={{ title: 'Models', tabBarButtonTestID: 'models-tab' }}
        />
        <Tab.Screen
          name="SettingsTab"
          component={SettingsScreen}
          options={{ title: 'Settings', tabBarButtonTestID: 'settings-tab' }}
        />
      </Tab.Navigator>
    </View >
  );
};

// Root Navigator — SpotlightTourProvider wraps entire stack so all screens
// (both tab screens and RootStack screens) can use useSpotlightTour()
export const AppNavigator: React.FC = () => {
  const { colors, isDark } = useTheme();
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);
  const steps = useMemo(() => createSpotlightSteps(), []);

  // Determine initial route
  const initialRoute: keyof RootStackParamList = hasCompletedOnboarding ? 'Main' : 'Onboarding';

  return (
    <SpotlightTourProvider
      steps={steps}
      overlayColor="black"
      overlayOpacity={isDark ? 0.78 : 0.62}
      onBackdropPress="stop"
      motion="fade"
      shape={{ type: 'rectangle', padding: 8 }}
    >
      <RootStack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        <RootStack.Screen name="ModelDownload" component={ModelDownloadScreen} />
        <RootStack.Screen name="Main" component={MainTabs} />
        <RootStack.Screen name="Chat" component={ChatScreen} />
        <RootStack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
        <RootStack.Screen name="ProjectChats" component={ProjectChatsScreen} />
        <RootStack.Screen
          name="ProjectEdit"
          component={ProjectEditScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <RootStack.Screen name="KnowledgeBase" component={KnowledgeBaseScreen} />
        <RootStack.Screen name="DocumentPreview" component={DocumentPreviewScreen} />
        <RootStack.Screen name="ModelSettings" component={ModelSettingsScreen} />
        <RootStack.Screen name="RemoteServers" component={RemoteServersScreen} />
        <RootStack.Screen name="VoiceSettings" component={VoiceSettingsScreen} />
        <RootStack.Screen name="DeviceInfo" component={DeviceInfoScreen} />
        <RootStack.Screen name="StorageSettings" component={StorageSettingsScreen} />
        <RootStack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />

        <RootStack.Screen
          name="About"
          component={AboutScreen}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="DownloadManager"
          component={DownloadManagerScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <RootStack.Screen
          name="Gallery"
          component={GalleryScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </RootStack.Navigator>
    </SpotlightTourProvider>
  );
};
