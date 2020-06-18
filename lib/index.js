'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.default = exports._getApplePublicKeys = exports.verifyIdToken = exports.refreshAuthorizationToken = exports.getAuthorizationToken = exports.getClientSecret = exports.getAuthorizationUrl = void 0;
var _url = require('url');
var _fs = _interopRequireDefault(require('fs'));
var _jsonwebtoken = _interopRequireDefault(require('jsonwebtoken'));
var _nodeRsa = _interopRequireDefault(require('node-rsa'));
var _nodeFetch = _interopRequireDefault(require('node-fetch'));
function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}
function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly)
      symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    keys.push.apply(keys, symbols);
  }
  return keys;
}
function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    if (i % 2) {
      ownKeys(source, true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(source).forEach(function (key) {
        Object.defineProperty(
          target,
          key,
          Object.getOwnPropertyDescriptor(source, key),
        );
      });
    }
  }
  return target;
}
function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
const ENDPOINT_URL = 'https://appleid.apple.com';
let APPLE_KEYS_CACHE = {};
const getAuthorizationUrl = (options = {}) => {
  var _options$scope;
  if (!options.clientID) {
    throw Error('clientID is empty');
  }
  if (!options.redirectUri) {
    throw Error('redirectUri is empty');
  }
  const url = new _url.URL(ENDPOINT_URL);
  url.pathname = '/auth/authorize';
  url.searchParams.append('response_type', 'code id_token');
  url.searchParams.append('state', options.state || 'state');
  url.searchParams.append('client_id', options.clientID);
  url.searchParams.append('redirect_uri', options.redirectUri);
  url.searchParams.append('scope', `openid${` ${options.scope}`}`);
  if (
    (_options$scope = options.scope) === null || _options$scope === void 0
      ? void 0
      : _options$scope.includes('email')
  ) {
    url.searchParams.append('response_mode', 'form_post');
  } else if (options.responseMode) {
    url.searchParams.append('response_mode', options.response_mode);
  }
  return url.toString();
};
exports.getAuthorizationUrl = getAuthorizationUrl;
const getClientSecret = (options = {}) => {
  if (!options.clientID) {
    throw new Error('clientID is empty');
  }
  if (!options.teamId) {
    throw new Error('teamId is empty');
  }
  if (!options.keyIdentifier) {
    throw new Error('keyIdentifier is empty');
  }
  if (!options.privateKeyPath && !options.privateKey) {
    throw new Error('privateKey and privateKeyPath are empty');
  }
  if (options.privateKeyPath && options.privateKey) {
    throw new Error(
      'privateKey and privateKeyPath cannot be passed together, choose one of them',
    );
  }
  if (
    options.privateKeyPath &&
    !_fs.default.existsSync(options.privateKeyPath)
  ) {
    throw new Error("Can't find private key");
  }
  const timeNow = Math.floor(Date.now() / 1000);
  const claims = {
    iss: options.teamId,
    iat: timeNow,
    exp: timeNow + (options.expAfter || 300),
    aud: ENDPOINT_URL,
    sub: options.clientID,
  };
  const header = { alg: 'ES256', kid: options.keyIdentifier };
  const key = options.privateKeyPath
    ? _fs.default.readFileSync(options.privateKeyPath)
    : options.privateKey;
  return _jsonwebtoken.default.sign(claims, key, {
    algorithm: 'ES256',
    header,
  });
};
exports.getClientSecret = getClientSecret;
const getAuthorizationToken = async (code, options) => {
  if (!options.clientID) {
    throw new Error('clientID is empty');
  }
  if (!options.clientSecret) {
    throw new Error('clientSecret is empty');
  }
  const url = new _url.URL(ENDPOINT_URL);
  url.pathname = '/auth/token';
  const form = {
    client_id: options.clientID,
    client_secret: options.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: options.redirectUri,
  };
  if (options.redirectUri) {
    form.redirect_uri = options.redirectUri;
  }
  return (0, _nodeFetch.default)(url.toString(), {
    method: 'POST',
    body: JSON.stringify(form),
  }).then((res) => res.json());
};
exports.getAuthorizationToken = getAuthorizationToken;
const refreshAuthorizationToken = async (refreshToken, options) => {
  if (!options.clientID) {
    throw new Error('clientID is empty');
  }
  if (!options.clientSecret) {
    throw new Error('clientSecret is empty');
  }
  const url = new _url.URL(ENDPOINT_URL);
  url.pathname = '/auth/token';
  const form = {
    client_id: options.clientID,
    client_secret: options.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  };
  return (0, _nodeFetch.default)(url.toString(), {
    method: 'POST',
    body: JSON.stringify(form),
  }).then((res) => res.json());
};
exports.refreshAuthorizationToken = refreshAuthorizationToken;
const _getApplePublicKeys = async ({ disableCaching } = {}) => {
  const url = new _url.URL(ENDPOINT_URL);
  url.pathname = '/auth/keys';
  const data = await (0, _nodeFetch.default)(url.toString(), {
    method: 'GET',
  }).then((res) => res.json());
  APPLE_KEYS_CACHE = {};
  const keyValues = data.keys.map((key) => {
    const publKeyObj = new _nodeRsa.default();
    publKeyObj.importKey(
      { n: Buffer.from(key.n, 'base64'), e: Buffer.from(key.e, 'base64') },
      'components-public',
    );
    const publicKey = publKeyObj.exportKey(['public']);
    if (!disableCaching) {
      APPLE_KEYS_CACHE[key.kid] = publicKey;
    }
    return publicKey;
  });
  return keyValues;
};
exports._getApplePublicKeys = _getApplePublicKeys;
const _getIdTokenApplePublicKey = async (header, cb) => {
  if (APPLE_KEYS_CACHE[header.kid]) {
    return cb(null, APPLE_KEYS_CACHE[header.kid]);
  }
  await _getApplePublicKeys();
  if (APPLE_KEYS_CACHE[header.kid]) {
    return cb(null, APPLE_KEYS_CACHE[header.kid]);
  }
  return cb(new Error('input error: Invalid id token public key id'));
};
const verifyIdToken = async (idToken, options = {}) =>
  new Promise((resolve, reject) =>
    _jsonwebtoken.default.verify(
      idToken,
      _getIdTokenApplePublicKey,
      _objectSpread({ algorithms: 'RS256', issuer: ENDPOINT_URL }, options),
      (error, decoded) => (error ? reject(error) : resolve(decoded)),
    ),
  );
exports.verifyIdToken = verifyIdToken;
var _default = {
  getAuthorizationUrl,
  getClientSecret,
  getAuthorizationToken,
  refreshAuthorizationToken,
  verifyIdToken,
  _getApplePublicKeys,
};
exports.default = _default;
//# sourceMappingURL=index.js.map
