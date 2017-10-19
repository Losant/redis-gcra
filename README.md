# Node Redis GCRA Library

This module is an implementation of [GCRA](https://en.wikipedia.org/wiki/Generic_cell_rate_algorithm) for rate limiting based on Redis.

## Installation

```js
yarn install "redis-gcra"
```

## Usage

In order to perform rate limiting, you need to call the `limit` method.

In this example the rate limit bucket has 1000 tokens in it and recovers at
speed of 100 tokens per minute.

```js
const Redis     = require('ioredis');
const RedisGCRA = require('redis-gcra');

const redis = new Redis();
const limiter = RedisGCRA({ redis });

let result = await limiter.limit({
  key: 'user/myUser@example.com',
  burst: 1000,
  rate: 1,
  period: 1000,
  cost: 2
});

result.limited;   // => false - request should not be limited
result.remaining; // => 998   - remaining number of requests until limited
result.retry_in;  // => 0     - can retry without delay
result.reset_in;  // => ~2000 - in approximately 2 seconds rate limiter will completely reset

// call limit 500 more times in rapid succession and the 500th call will have:
// result = await limiter.limit(....)
result.limited;   // => true     - request should be limited
result.remaining; // => 0        - remaining number of requests until limited
result.retry_in;  // => ~2000    - can retry in approximately 2 seconds
result.reset_in;  // => ~1000000 - in approximately 1000 seconds rate limiter will completely reset
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
result.remaining; // => 1000  - remaining number of requests until limited
result.retry_in;  // => 0     - can retry without delay
result.reset_in;  // => 0     - the rate limiter is reset
```

## Inspiration

This code was inspired by the ruby gem [redis-gcra](https://github.com/rwz/redis-gcra).

## License

The module is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).