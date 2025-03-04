/*eslint no-console: 0*/

import * as Redis from 'redis';
import RedisGCRA from '../lib/index.js';

const redis = Redis.createClient({
  scripts: RedisGCRA.defineNodeRedisScripts(Redis)
});

redis.connect();

const limiter = RedisGCRA({ redis });

const limitOpts = {
  key: 'user/myUser@example.com',
  burst: 1000,  // limit on maximum tokens available
  rate: 5,      // rate at which tokens regenerate per period
  period: 1000, // period, in milliseconds, for token regeneration
  cost: 5       // cost in tokens for this limit request
};

// make sure we are starting from a reset key
limiter.reset({ key: 'user/myUser@example.com' })
  .then(() => {
    return limiter.limit(limitOpts);
  })
  .then((result) => {
    console.log('Not limited: ', result);
    /* Example result
     * {
     *   limited: false,
     *   remaining: 995,
     *   retryIn: 0,
     *   resetIn: 1000
     * }
     */
    return Promise.all([...Array(198)].map(() => {
      return limiter.limit(limitOpts);
    }));
  })
  .then(() => {
    return limiter.limit(limitOpts);
  })
  .then((result) => {
    console.log('Last one allowed: ', result);
    /* Example result
     * {
     *   limited: false,
     *   remaining: 0,
     *   retryIn: 0,
     *   resetIn: 200000
     * }
     */
    return limiter.limit(limitOpts);
  })
  .then((result) => {
    console.log('Limited: ', result);
    /* Example result
     * {
     *   limited: true,
     *   remaining: 0,
     *   retryIn: 1000,
     *   resetIn: 200000
     * }
     */
    console.log('Waiting to regenerate tokens....');
    return new Promise((fulfill) => {
      // let it regenerate a 2nd token
      setTimeout(fulfill, result.retryIn);
    });
  })
  .then(() => {
    return limiter.limit(limitOpts);
  })
  .then((result) => {
    console.log('Can get another one: ', result);
    /* Example result
     * {
     *   limited: false,
     *   remaining: 0,
     *   retryIn: 0,
     *   resetIn: 200000
     * }
     */

    // shutting down redis, just to be nice, so this script can exit
    return redis.quit();
  });

redis.quit();
