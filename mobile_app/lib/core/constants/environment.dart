class Environment {
  static const String development = 'development';
  static const String production = 'production';
  
  static String get current {
    return const bool.fromEnvironment('dart.vm.product')
        ? production
        : development;
  }
  
  static bool get isDevelopment => current == development;
  static bool get isProduction => current == production;
  
  static Map<String, dynamic> get config {
    if (isProduction) {
      return _productionConfig;
    } else {
      return _developmentConfig;
    }
  }
  
  static final Map<String, dynamic> _developmentConfig = {
    'apiBaseUrl': 'http://localhost:3000/api',
    'socketUrl': 'http://localhost:3000',
    'agoraAppId': 'YOUR_AGORA_APP_ID_DEV',
    'firebase': {
      'apiKey': 'YOUR_FIREBASE_API_KEY_DEV',
      'projectId': 'YOUR_FIREBASE_PROJECT_ID_DEV',
      'appId': 'YOUR_FIREBASE_APP_ID_DEV',
      'messagingSenderId': 'YOUR_FIREBASE_MESSAGING_SENDER_ID_DEV',
    },
    'debug': true,
    'logLevel': 'debug',
    'enableAnalytics': false,
  };
  
  static final Map<String, dynamic> _productionConfig = {
    'apiBaseUrl': 'https://api.yourdomain.com/api',
    'socketUrl': 'https://api.yourdomain.com',
    'agoraAppId': 'YOUR_AGORA_APP_ID_PROD',
    'firebase': {
      'apiKey': 'YOUR_FIREBASE_API_KEY_PROD',
      'projectId': 'YOUR_FIREBASE_PROJECT_ID_PROD',
      'appId': 'YOUR_FIREBASE_APP_ID_PROD',
      'messagingSenderId': 'YOUR_FIREBASE_MESSAGING_SENDER_ID_PROD',
    },
    'debug': false,
    'logLevel': 'error',
    'enableAnalytics': true,
  };
  
  static String get apiBaseUrl => config['apiBaseUrl'] as String;
  static String get socketUrl => config['socketUrl'] as String;
  static String get agoraAppId => config['agoraAppId'] as String;
  static Map<String, dynamic> get firebaseConfig => config['firebase'] as Map<String, dynamic>;
  static bool get debug => config['debug'] as bool;
  static String get logLevel => config['logLevel'] as String;
  static bool get enableAnalytics => config['enableAnalytics'] as bool;
}