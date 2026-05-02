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
    'apiBaseUrl': 'https://livo-streaming-app.onrender.com/api',
    'socketUrl': 'https://livo-streaming-app.onrender.com',
    'agoraAppId': '5199b1d9a24c483391eb9f333fdea2db',
    'firebase': {
      'apiKey': 'AIzaSyDfriBDQSWio_maCPu6Q4bZY2-8vjpOIV4',
      'projectId': 'livo-app-84e7f',
      'appId': '1:588874602493:android:f8d7d25f1da8ec9151ab94',
      'messagingSenderId': 'YOUR_FIREBASE_MESSAGING_SENDER_ID_DEV',
    },
    'debug': true,
    'logLevel': 'debug',
    'enableAnalytics': false,
  };
  
  static final Map<String, dynamic> _productionConfig = {
    'apiBaseUrl': 'https://livo-streaming-app.onrender.com/api',
    'socketUrl': 'https://livo-streaming-app.onrender.com',
    'agoraAppId': '5199b1d9a24c483391eb9f333fdea2db',
    'firebase': {
      'apiKey': 'AIzaSyDfriBDQSWio_maCPu6Q4bZY2-8vjpOIV4',
      'projectId': 'livo-app-84e7f',
      'appId': '1:588874602493:android:f8d7d25f1da8ec9151ab94',
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