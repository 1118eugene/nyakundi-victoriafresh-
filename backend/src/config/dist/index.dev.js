"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getMpesaConfigurationStatus = getMpesaConfigurationStatus;
exports.assertProductionConfiguration = assertProductionConfiguration;
exports["default"] = exports.config = void 0;

var _dotenv = _interopRequireDefault(require("dotenv"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

_dotenv["default"].config();

function isConfiguredValue(value) {
  return Boolean(value && !/(your-|change-me|example|placeholder)/i.test(value));
}

function isPublicCallbackUrl(value) {
  try {
    var url = new URL(value);
    return url.protocol === 'https:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch (_unused) {
    return false;
  }
}

var nodeEnv = process.env.NODE_ENV || 'development';
var isProduction = nodeEnv === 'production'; // Database and environment configuration

var config = {
  port: process.env.PORT || 5000,
  nodeEnv: nodeEnv,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  mongoUri: process.env.MONGODB_URI || (isProduction ? '' : 'mongodb://localhost:27017/victoria-fresh-fish'),
  dbName: process.env.DB_NAME || 'victoria-fresh-fish',
  defaultLimit: 10,
  maxLimit: 100,
  adminDashboardKey: process.env.ADMIN_DASHBOARD_KEY || '',
  mpesaBaseUrl: process.env.MPESA_BASE_URL || process.env.MPESA_API_URL || (isProduction ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'),
  mpesaConsumerKey: process.env.MPESA_CONSUMER_KEY || '',
  mpesaConsumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  mpesaShortcode: process.env.MPESA_SHORTCODE || process.env.MPESA_BUSINESS_SHORTCODE || '',
  mpesaPasskey: process.env.MPESA_PASSKEY || '',
  mpesaCallbackUrl: process.env.MPESA_CALLBACK_URL || process.env.MPESA_PAYMENT_CALLBACK_URL || process.env.MPESA_LOCAL_CALLBACK_URL || 'http://localhost:5000/api/orders/mpesa/callback',
  mpesaTransactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline'
};
exports.config = config;

function getMpesaConfigurationStatus() {
  var required = ['mpesaConsumerKey', 'mpesaConsumerSecret', 'mpesaShortcode', 'mpesaPasskey'];
  var missing = required.filter(function (key) {
    return !isConfiguredValue(config[key]);
  });
  var callbackReady = isPublicCallbackUrl(config.mpesaCallbackUrl);
  return {
    configured: missing.length === 0 && callbackReady,
    missing: missing,
    callbackReady: callbackReady
  };
}

function assertProductionConfiguration() {
  if (!isProduction) return;
  var missing = [];
  if (!isConfiguredValue(config.mongoUri)) missing.push('MONGODB_URI');
  if (!isConfiguredValue(config.clientUrl)) missing.push('CLIENT_URL');
  if (!isConfiguredValue(config.adminDashboardKey)) missing.push('ADMIN_DASHBOARD_KEY');
  if (!getMpesaConfigurationStatus().configured) missing.push('live M-Pesa credentials and a public HTTPS MPESA_CALLBACK_URL');

  if (missing.length) {
    throw new Error("Production configuration is incomplete: ".concat(missing.join(', ')));
  }
}

var _default = config;
exports["default"] = _default;
//# sourceMappingURL=index.dev.js.map
