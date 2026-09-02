"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _cors = _interopRequireDefault(require("cors"));

var _dotenv = _interopRequireDefault(require("dotenv"));

var _index = require("./config/index.js");

var _db = require("./lib/db.js");

var _productRoutes = _interopRequireDefault(require("./routes/productRoutes.js"));

var _orderRoutes = _interopRequireDefault(require("./routes/orderRoutes.js"));

var _userRoutes = _interopRequireDefault(require("./routes/userRoutes.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

_dotenv["default"].config();

var app = (0, _express["default"])();
var allowedOrigins = [_index.config.clientUrl, 'http://127.0.0.1:3000', 'http://localhost:3000', 'http://127.0.0.1:3001', 'http://localhost:3001', 'http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:5174', 'http://localhost:5174'];
app.use((0, _cors["default"])({
  origin: function origin(_origin, callback) {
    if (!_origin || allowedOrigins.includes(_origin)) {
      return callback(null, true);
    }

    callback(new Error("CORS policy does not allow access from origin ".concat(_origin)));
  },
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(_express["default"].json());
app.use(_express["default"].urlencoded({
  extended: true
}));
app.get('/api/health', function (_req, res) {
  res.json({
    status: 'OK',
    message: 'Victoria Fresh Fish API is running',
    timestamp: new Date().toISOString()
  });
});
app.use('/api/products', _productRoutes["default"]);
app.use('/api/orders', _orderRoutes["default"]);
app.use('/api/users', _userRoutes["default"]);
app.use(function (_req, res) {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found'
  });
});
app.use(function (err, _req, res, _next) {
  console.error(err.stack);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error'
  });
});

function startServer() {
  return regeneratorRuntime.async(function startServer$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          (0, _index.assertProductionConfiguration)();
          _context.next = 3;
          return regeneratorRuntime.awrap((0, _db.connectToDatabase)());

        case 3:
          _context.next = 5;
          return regeneratorRuntime.awrap((0, _db.seedVerifiedProducts)());

        case 5:
          app.listen(_index.config.port, function () {
            console.log("Victoria Fresh Fish API running on http://localhost:".concat(_index.config.port));
            console.log("Environment: ".concat(_index.config.nodeEnv));
          });

        case 6:
        case "end":
          return _context.stop();
      }
    }
  });
}

startServer()["catch"](function (error) {
  console.error('Failed to start backend:', error);
  process.exit(1);
});
var _default = app;
exports["default"] = _default;
//# sourceMappingURL=index.dev.js.map
