import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

// Own's tab symbols share a 24-point grid, rounded ends and optical weight.
export function TabIcon({ name, color }: { name: string; color: string }) {
  const paths: Record<string, string> = {
    HomeTab: 'M3.5 10.5 12 3.5l8.5 7M5.5 9.2v10.3h4v-6h5v6h4V9.2',
    ChatsTab: 'M5.5 4.5h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-5.5 3v-14a2 2 0 0 1 1-2ZM8 9h8M8 13h5',
    ProjectsTab: 'M3.5 7V5.5h6l2 2h9v11h-17V7ZM3.5 10h17M8 14h8',
    ModelsTab: 'M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5ZM3.5 12.5 12 17l8.5-4.5M3.5 17 12 21.5l8.5-4.5',
    SettingsTab: 'M3.5 7h5M13.5 7h7M3.5 17h9M17.5 17h3',
  };
  return <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
    <Path d={paths[name] || paths.HomeTab} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {name === 'SettingsTab' && <><Circle cx={11} cy={7} r={2.5} stroke={color} strokeWidth={1.8} fill="none" /><Circle cx={15} cy={17} r={2.5} stroke={color} strokeWidth={1.8} fill="none" /></>}
  </Svg>;
}
