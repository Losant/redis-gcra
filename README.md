# Node Redis GCRA Library

This module is an implementation of [GCRA](https://en.wikipedia.org/wiki/Generic_cell_rate_algorithm) for rate limiting based on Redis.

## Installation

```bash
npm install "redis-gcra"
```

or

```bash
yarn install "redis-gcra"
```

## Usage

In order to perform rate limiting, you need to call the `limit` method.

In this example the rate limit bucket has 1000 tokens in it and recovers at
speed of 1 token per second.

```js
const Redis     = require('ioredis');
const RedisGCRA = require('redis-gcra');

const redis = new Redis();
const limiter = RedisGCRA({ redis });

let result = await limiter.limit({
  key: 'user/myUser@example.com',
  burst: 1000,  // limit on maximum tokens available
  rate: 1,      // rate per period at which tokens regenerate
  period: 1000, // period, in milliseconds, for token regeneration
  cost: 2       // cost in tokens for this limit request
});

result.limited;   // => false - request should not be limited
result.remaining; // => 998   - remaining number of tokens until limited
result.retryIn;   // => 0     - can retry without delay
result.resetIn;   // => ~2000 - in approximately 2 seconds tokens will be regenerated to burst limit

// call limit 500 more times in rapid succession and the 500th call will have:
// result = await limiter.limit(....)
result.limited;   // => true     - request should be limited
result.remaining; // => 0        - remaining number of tokens until limited
result.retryIn;   // => ~2000    - can retry in approximately 2 seconds
result.resetIn;   // => ~1000000 - in approximately 1000 seconds tokens will be regenerated to burst limit
```

The implementation utilizes single key in Redis that matches the key you pass
to the `limit` method. If you need to reset rate limiter for particular key,
call the reset method:

```js
// Let's imagine 'user/myUser@example.com' is limited.
// This will effectively reset limit for the key:
await limiter.reset({ key: 'overall-account/bob@example.com' })
// limit is reset
```

You call also retrieve the current state of rate limiter for particular key
without actually modifying the state. In order to do that, use the `peek`
method:

```js
let result = await limiter.peek({
  key: 'user/myUser@example.com',
  burst: 1000,
  rate: 1,
  period: 1000
});

result.limited;   // => false - request should not be limited
result.remaining; // => 1000  - remaining number of tokens until limited
result.resetIn;   // => 0     - "burst" tokens are already available
```

## API Documentation

```javascript
const limiter = RedisGCRA({
  redis: undefined,
  keyPrefix: '',
  burst: 60,
  rate: 1,
  period: 1000,
  cost: 1
});
```

The redis-gcra module exposes a single function, which, when called, returns a limiter instance.
It takes the following options:

* redis  
  The redis client instance to be used. This is required, and is expected to be an [ioredis](https://www.npmjs.com/package/ioredis)
  instance - or at the very least, a redis-client-like wrapper that exposes a [defineCommand](https://www.npmjs.com/package/ioredis#lua-scripting)
  method (and the redis 'del' method).
* keyPrefix  
  A prefix for any keys that this limiter instance tries to create/access. Defaults to an empty string (i.e., no prefix).
* burst  
  The default burst value for this limiter instance. Defaults to 60 when not provided.
  If provided, must be a number greater than or equal to 1.
* rate  
  The default rate value for for this limiter instance. Defaults to 1 when not provided.
  If provided, must be a number greater than or equal to 1.
* period  
  The default period value for for this limiter instance (milliseconds).
  Defaults to 1000 (1 second) when not provided.
  If provided, must be a number greater than or equal to 1.
* cost  
  The default cost value for for this limiter instance. Defaults to 1 when not provided.
  If provided, must be a number greater than or equal to 0.

### Instance Functions

#### limit

```javascript
limiter.limit({
  key: 'user/myUser@example.com',
  burst: 1000,
  rate: 1,
  period: 1000,
  cost: 2
});
```

The limit function will attempt to consume the given `cost` from the token pool for this key.
If there are not enough tokens available for the given cost, no tokens will be consumed.
It takes the following options:

* key  
  The key to limit/throttle on. This is required. The actual redis key will be prefixed with
  any `keyPrefix` given when the limiter was created.
* burst  
  The maximum number of tokens available (i.e., token regeneration stops when this number is
  reached). If not provided, defaults to the `burst` value provided when the limiter was created.
  If provided, must be a number greater than or equal to 1.
* rate  
  The rate at which tokens regenerate over the given `period`. If not provided,
  defaults to the `rate` value provided when the limiter was created.
  If provided, must be a number greater than or equal to 1.
* period  
  The period (in milliseconds) over which tokens are regenerated at `rate`. If not provided,
  defaults to the `period` value provided when the limiter was created.
  If provided, must be a number greater than or equal to 1.
* cost  
  The cost in tokens of this limit call. If not provided,
  defaults to the `cost` value provided when the limiter was created.
  If provided, must be a number greater than or equal to 0.

The `limit` call returns a promise, which will resolve to the following object:

```javascript
{
  limited: <boolean>,
  remaining: <number, token count>,
  retryIn: <number, milliseconds>,
  resetIn: <number, milliseconds>
}
```

* limited  
  A boolean, representing if the given limit request was fufilled or not.
* remaining  
  The number of tokens remaining after this limit request. A request may be limited
  even if there are tokens available, if the cost was higher than the tokens available.
  If `limited` is true, remaining will be the number of tokens currently available,
  the requested cost will not be subtracted.
* retryIn  
  The number of milliseconds to wait until the given request would be allowed. Will always be
  0 if `limited` is false, and greater than 0 if `limited` is true. If the `cost` was higher than
  `burst`, it is never possible to fulfill the request, and so `retryIn` will be `Infinity`.
* resetIn  
  The number of milliseconds until the token pool has regenerated to `burst`. Will be 0
  if the token pool is already at the `burst` value.

#### peek

```javascript
limiter.peek({
  key: 'user/myUser@example.com',
  burst: 1000,
  rate: 1,
  period: 1000
});
```

The peek function allows you to look at the given state of the token pool for the given key. It
will not consume any tokens. It takes the following options:

* key  
  The limiter key to peek at. This is required. The actual redis key will be prefixed with
  any `keyPrefix` given when the limiter was created.
* burst  
  The maximum number of tokens available (i.e., token regeneration stops when this number is
  reached). If not provided, defaults to the `burst` value provided when the limiter was created.
  If provided, must be a number greater than or equal to 1.
* rate  
  The rate at which tokens regenerate over the given `period`. If not provided,
  defaults to the `rate` value provided when the limiter was created.
  If provided, must be a number greater than or equal to 1.
* period  
  The period (in milliseconds) over which tokens are regenerated at `rate`. If not provided,
  defaults to the `period` value provided when the limiter was created.
  If provided, must be a number greater than or equal to 1.

The `peek` call returns a promise, which will resolve to the following object:

```javascript
{
  limited: <boolean>,
  remaining: <number, token count>,
  resetIn: <number, milliseconds>
}
```

* limited  
  A boolean, representing if given key is currently limited. This will be true only if
  there are no tokens in the pool.
* remaining  
  The number of tokens remaining in the given key's token pool.
* resetIn  
  The number of milliseconds until the token pool has regenerated to `burst`. Will be 0
  if the token pool is already at the `burst` value.

#### reset

```javascript
limiter.reset({
  key: 'user/myUser@example.com'
});
```

The reset function allows you to reset the token pool for the given key. In essence, this just
deletes the relevant key in redis - which means the key is immediately back to having `burst` tokens
available.  It takes the following options:

* key  
  The limiter key to reset. This is required. The actual redis key will be prefixed with
  any `keyPrefix` given when the limiter was created.

The `reset` call returns a promise, which will resolve to a boolean. If the result is true,
the key was reset. If the result is false, the key did not need to be reset - there were already
`burst` tokens available.

## Inspiration

This code was inspired by the ruby gem [redis-gcra](https://github.com/rwz/redis-gcra).

## License

The module is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).