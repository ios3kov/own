/**
 * @format
 */

import 'react-native-url-polyfill/auto';
import { AppRegistry } from 'react-native';
import { installPrivacyGuard } from './src/services/privacyGuard';
import { name as appName } from './app.json';

installPrivacyGuard();
const App = require('./App').default;
AppRegistry.registerComponent(appName, () => App);
