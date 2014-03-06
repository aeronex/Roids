/*
 * model.js
 *
 * uses ES6 proxies to make an object that tracks its own changes.
 * this is used for global game state so we can easily send minimal
 * diffs down to clients
 */

var resolvePath = require('./lib/resolve-path');

/*
 * given a plain JavaScript object, return an ES6 proxy that
 * wraps and records changes to the object
 *
 * there are a few limitations to this approach:
 * - object identity is not preserved
 * - it might be slow but i haven't benchmarked
 *
 * to be safe, compare objects with primitives, not by reference.
 * one way to do this is to assign interesting objects a unique id.
 * i don't think our game calls for much of this, so it may not be
 * a concern in practice
 */
var createProxyHandler = function (obj) {

  /*
   * Just read this: http://wiki.ecmascript.org/doku.php?id=harmony:proxies
   * #goodluck
   */
  return {
    getOwnPropertyDescriptor: function () {
      return Object.getOwnPropertyDescriptor(obj);
    },
    getPropertyDescriptor: function () {
      return Object.getOwnPropertyDescriptor(obj);
    },
    getOwnPropertyNames: function () {
      return Object.getOwnPropertyNames(obj);
    },
    getPropertyNames: function () {
      return Object.getOwnPropertyNames(obj);
    },
    defineProperty: function (name, desc) {
      return Object.defineProperty(obj, name, desc);
    },
    delete: function (name) {
      obj.__dirty[name] = true;
      return obj[name] = null;
    },
    fix: function () {

    },
    get: function (rec, name) {
      if (name.substr(0, 2) === '__' || name === 'inspect') {
        return;
      }

      if (!obj[name]) {
        obj[name] = createModel();
      }

      if (typeof val === 'object' && obj[name] !== Object(obj[name])) {
        obj[name] = createModel(obj[name]);
      }

      return obj[name];
    },
    set: function (rec, name, val) {
      if (name === '__diff') {
        return false;
      }
      if (obj[name] === val) {
        return false;
      }

      if (typeof val === 'object') {
        val = createModel(val);
      } else {
        obj.__dirty[name] = true;
      }

      obj[name] = val;

      return true;
    },
    has: function (name) {
      return name in obj;
    },
    keys: function () {
      return Object.keys(obj).filter(function (key) {
        return key.substr(0, 2) !== '__';
      });
    }
  };
};

var createModel = module.exports = function (obj) {

  if (obj === undefined) {
    obj = {};
  } else if (typeof obj !== 'object') {
    return obj;
  }

  // init dirty tracking

  obj.__dirty = {};
  Object.keys(obj).forEach(function (key) {
    if (typeof obj[key] !== 'object' &&
        typeof obj[key] !== 'function') {

      obj.__dirty[key] = true;
    }
  });

  /*
   * this is a private API.
   * you probably want to use `obj.diff()`
   *
   * returns an array of property paths (`obj.a.b.c`)
   * corresponding to the properties of the object that
   * changed since `obj._diff()` was last called.
   */
  obj._diff = function () {
    var dirt = Object.keys(this).
      filter(isBoring).
      map(function (key) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          return obj[key]._diff().map(function (subKey) {
            return key + '.' + subKey;
          });
        }
        return [];
      }).
      reduce(function (a, b) {
        return a.concat(b);
      }, []).
      concat(Object.keys(obj.__dirty));

    obj.__dirty = {};

    return dirt;
  };

  /*
   * keys that start with `_` or are functions are boring
   * and we don't care about them
   */
  function isBoring (key) {
    return key[0] !== '_' && typeof obj[key] !== 'function';
  }

  /*
   * Public API
   */

  /*
   * returns a list of key-value pairs that have changed since the last time
   * this method was invoked
   */
  obj.diff = function () {
    return obj._diff().
      map(function (path) {
        return {
          key: path,
          value: resolvePath(path, obj)
        };
      });
  };


  /*
   * returns a copy of the state of this object, but stripping out:
   * 1. functions
   * 2. underscore-prefixed properties
   *
   * this is used for initializing the game state to a client
   * (for instance, when they first connect)
   */
  obj.state = function () {
    Object.keys(obj).
      filter(isBoring).
      reduce(function (repr, key) {
        repr[key] = (typeof obj[key] === 'object' && obj[key] !== null) ? obj[key].state() : obj[key];
        return repr;
      }, {});
  };

  return Proxy.create(createProxyHandler(obj));
};
