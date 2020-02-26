# Node Redis GCRA Library

[![Build Status](https://travis-ci.org/Losant/redis-gcra.svg?branch=master)](https://travis-ci.org/Losant/redis-gcra) [![npm version](https://badge.fury.io/js/redis-gcra.svg)](https://badge.fury.io/js/redis-gcra)

This module is an implementation of [GCRA](https://en.wikipedia.org/wiki/Generic_cell_rate_algorithm) for rate limiting based on [Redis](https://redis.io/).

* [Installation](#installation)
* [API Documentation](#api-documentation)
  * [Initializer](#redisgcra-redis-keyprefix-burst-rate-period-cost-)
  * [Instance Functions](#instance-functions)
    * [limit](#limit-key-burst-rate-period-cost-)
    * [peek](#peek-key-burst-rate-period-)
    * [reset](#reset)
* [Example](#example)
* [Inspiration](#inspiration)
* [License](#license)

## Installation

```bash
npm install redis-gcra
```

or

```bash
yarn install redis-gcra
```

## API Documentation

### RedisGCRA({ redis, keyPrefix, burst, rate, period, cost })

```javascript
const RedisGCRA = require('redis-gcra');

const limiter = RedisGCRA({
  redis: undefined,
  keyPrefix: '',
  burst: 60,
  rate: 1,
  period: 1000,
  cost: 1
});
```

The redis-gcra module exposes a single function, which returns a limiter instance when called.
It takes the following options:

| Option | Type | Default | Description |
| :----- | :--- | ------- | :---------- |
| redis | [ioredis](https://www.npmjs.com/package/ioredis) instance* | | **Required.** The Redis client to be used. _(* You may also use a Redis-client-like wrapper that exposes the [defineCommand](https://www.npmjs.com/package/ioredis#lua-scripting) method and the Redis `del` method.)_ |
| keyPrefix | String | | A prefix for any keys that this limiter instance tries to create/access. |
| burst | Number | 60 | The default burst value for this limiter instance. If provided, must be a number greater than or equal to 1. |
| rate | Number | 1 | The default rate value for this limiter instance. If provided, must be a number greater than or equal to 1. |
| period | Number | 1000 | The default period value for this limiter instance (milliseconds). If provided, must be a number greater than or equal to 1. |
| cost | Number | 1 | The default cost value for for this limiter instance. If provided, must be a number greater than or equal to 0. |

### Instance Functions

#### limit({ key, burst, rate, period, cost })

```javascript
limiter.limit({
  key: 'user/myUser@example.com',
  burst: 1000,
  rate: 1,
  period: 1000,
  cost: 2
});
```

In order to perform rate limiting, you need to call the `limit` method. This function will attempt to consume the given `cost` from the token pool for this key.
If there are not enough tokens available for the given cost, no tokens will be consumed.
It takes the following options:

| Option | Type | Description |
| :----- | :--- | :---------- |
| key | String | **Required.** The key to limit/throttle on. The actual Redis key will be prefixed with any `keyPrefix` given when the limiter was created. |
| burst | Number | The maximum number of tokens available (i.e., token regeneration stops when this number is reached). If not provided, defaults to the `burst` value provided when the limiter was created. If provided, must be a number greater than or equal to 1. |
| rate | Number | The rate at which tokens regenerate over the given `period`. If not provided, defaults to the `rate` value provided when the limiter was created. If provided, must be a number greater than or equal to 1. |
| period | Number | The period (in milliseconds) over which tokens are regenerated at `rate`. If not provided, defaults to the `period` value provided when the limiter was created. If provided, must be a number greater than or equal to 1. |
| cost | Number | The cost in tokens of this limit call. If not provided, defaults to the `cost` value provided when the limiter was created. If provided, must be a number greater than or equal to 0. |

The `limit` call returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise), which will resolve to an object with the following properties:

| Property | Type | Description |
| :------  | :--- | :---------- |
| limited | Boolean | Represents whether the given limit request was fulfilled. |
| remaining | Number | The number of tokens remaining after this limit request. A request may be limited even if there are tokens available, if the cost was higher than the tokens available. If `limited` is true, `remaining` will be the number of tokens currently available _without_ the requested cost being subtracted. |
| retryIn | Number | The number of milliseconds to wait until the given request would be allowed. Will always be 0 if `limited` is false, and greater than 0 if `limited` is true. If the `cost` was higher than `burst`, it is never possible to fulfill the request, and so `retryIn` will be `Infinity`. |
| resetIn | Number | The number of milliseconds until the token pool has regenerated to `burst`. Will be 0 if the token pool is already at the `burst` value. |

#### peek({ key, burst, rate, period })

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

| Option | Type | Description |
| :----- | :--- | :---------- |
| key | String | **Required.**  The limiter key to peek at. The actual Redis key will be prefixed with any `keyPrefix` given when the limiter was created. |
| burst | Number | The maximum number of tokens available (i.e., token regeneration stops when this number is reached). If not provided, defaults to the `burst` value provided when the limiter was created. If provided, must be a number greater than or equal to 1. |
| rate | Number | The rate at which tokens regenerate over the given `period`. If not provided, defaults to the `rate` value provided when the limiter was created. If provided, must be a number greater than or equal to 1. |
| period | Number |  The period (in milliseconds) over which tokens are regenerated at `rate`. If not provided, defaults to the `period` value provided when the limiter was created. If provided, must be a number greater than or equal to 1. |

The `peek` call returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise), which will resolve to an object with the following properties:

| Property | Type | Description |
| :------- | :--- | :---------- |
| limited | Boolean | Represents if the given key is currently limited. This will be `true` only if there are no tokens in the pool. |
| remaining | Number | The number of tokens remaining in the given key's token pool. |
| resetIn | Number | The number of milliseconds until the token pool has regenerated to `burst`. Will be 0 if the token pool is already at the `burst` value. |

#### reset

```javascript
limiter.reset({
  key: 'user/myUser@example.com'
});
```

The reset function allows you to reset the token pool for the given key. In essence, this just
deletes the relevant key in Redis, which means the key is immediately back to having `burst` tokens
available. It takes the following options:

| Option | Type | Description |
| :----- | :--- | :---------- |
| key | String | **Required.** The limiter key to reset. The actual Redis key will be prefixed with any `keyPrefix` given when the limiter was created. |

The `reset` call returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise), which will resolve to a Boolean. If the result is `true`, the key was reset. If the result is `false`, the key did not need to be reset; there were already `burst` tokens available.

## Example

In this example the rate limit bucket has 1000 tokens, recovering at
a speed of 1 token per second.

```js
const Redis     = require('ioredis');
const RedisGCRA = require('redis-gcra');

const redis = new Redis();
const limiter = RedisGCRA({ redis });

// In order to perform rate limiting, you need to call the 'limit' method.
let result = await limiter.limit({
  key: 'user/myUser@example.com',
  burst: 1000,  // limit on maximum tokens available
  rate: 1,      // rate at which tokens regenerate per period
  period: 1000, // period, in milliseconds, for token regeneration
  cost: 2       // cost in tokens for this limit request
});

result.limited;   // => false - request should not be limited
result.remaining; // => 998   - remaining number of tokens until limited
result.retryIn;   // => 0     - can retry without delay
result.resetIn;   // => ~2000 - in approximately 2 seconds tokens will be regenerated to burst limit

// call limit 500 more times in rapid succession and the 500th call will have:
// result = await limiter.limit(....)
result.limited;   // => true    - request should be limited
result.remaining; // => 0       - remaining number of tokens until limited
result.retryIn;   // => 2000    - can retry in approximately 2 seconds
result.resetIn;   // => 1000000 - in approximately 1000 seconds tokens will be regenerated to burst limit
```

The implementation utilizes a single key in Redis that matches the key you pass
to the `limit` method. If you need to reset the rate limiter for a particular key,
call the reset method:

```js
// Let's imagine 'user/myUser@example.com' is limited.
// This will effectively reset the limit for the key:
await limiter.reset({ key: 'user/myUser@example.com' })
// limit is reset
```

You can also retrieve the current state of the rate limiter for a particular key
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

## Inspiration

This code was inspired by the Ruby gem [redis-gcra](https://github.com/rwz/redis-gcra).

## License

The module is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).
