import type * as Redis from "redis";

/**
 * The redis-gcra module exposes a single function, which returns a limiter instance when called.
 */
declare function RedisGCRA(options: RedisGCRAOptions): {

  /**
   * This function will attempt to consume the given cost from the token pool for this key. If there are not enough tokens available for the given cost, no tokens will be consumed.
   */
  limit: (props: {
    /**
     * The key to limit/throttle on. The actual Redis key will be prefixed with any keyPrefix given when the limiter was created.
     */
    key: string,

    /**
     * The maximum number of tokens available (i.e., token regeneration stops when this number is reached). If not provided, defaults to the burst value provided when the limiter was created. If provided, must be a number greater than or equal to 1.
     */
    burst?: number,

    /**
     * The rate at which tokens regenerate over the given period. If not provided, defaults to the rate value provided when the limiter was created. If provided, must be a number greater than or equal to 1.
     */
    rate?: number,

    /**
     * The period (in milliseconds) over which tokens are regenerated at rate. If not provided, defaults to the period value provided when the limiter was created. If provided, must be a number greater than or equal to 1.
     */
    period?: number,

    /**
     * The cost in tokens of this limit call. If not provided, defaults to the cost value provided when the limiter was created. If provided, must be a number greater than or equal to 0.
     */
    cost?: number,
  }) => Promise<{
    /**
     * Represents whether the given limit request was fulfilled.
     */
    limited: boolean,

    /**
     * The number of tokens remaining after this limit request. A request may be limited even if there are tokens available, if the cost was higher than the tokens available. If limited is true, remaining will be the number of tokens currently available without the requested cost being subtracted.
     */
    remaining: number,

    /**
     * The number of milliseconds to wait until the given request would be allowed. Will always be 0 if limited is false, and greater than 0 if limited is true. If the cost was higher than burst, it is never possible to fulfill the request, and so retryIn will be Infinity.
     */
    retryIn: number,

    /**
     * The number of milliseconds until the token pool has regenerated to burst. Will be 0 if the token pool is already at the burst value.
     */
    resetIn: number,
  }>

  /**
   * The peek function allows you to look at the given state of the token pool for the given key. It will not consume any tokens.
   */
  peek: (props: {
    /**
     * The limiter key to peek at. The actual Redis key will be prefixed with any keyPrefix given when the limiter was created.
     */
    key: string,

    /**
     * The maximum number of tokens available (i.e., token regeneration stops when this number is reached). If not provided, defaults to the burst value provided when the limiter was created. If provided, must be a number greater than or equal to 1.
     */
    burst?: number,

    /**
     * The rate at which tokens regenerate over the given period. If not provided, defaults to the rate value provided when the limiter was created. If provided, must be a number greater than or equal to 1.
     */
    rate?: number,

    /**
     * The period (in milliseconds) over which tokens are regenerated at rate. If not provided, defaults to the period value provided when the limiter was created. If provided, must be a number greater than or equal to 1.
     */
    period?: number,
  }) => Promise<{
    /**
     * Represents if the given key is currently limited. This will be true only if there are no tokens in the pool.
     */
    limited: boolean,

    /**
     * The number of tokens remaining in the given key's token pool.
     */
    remaining: number,

    /**
     * The number of milliseconds until the token pool has regenerated to burst. Will be 0 if the token pool is already at the burst value.
     */
    resetIn: number,
  }>

  /**
   * The reset function allows you to reset the token pool for the given key. In essence, this just deletes the relevant key in Redis, which means the key is immediately back to having burst tokens available.
   * If the result is true, the key was reset. If the result is false, the key did not need to be reset; there were already burst tokens available.
   */
  reset: (props: {
    /**
     * The limiter key to reset. The actual Redis key will be prefixed with any keyPrefix given when the limiter was created.
     */
    key: string,
  }) => Promise<boolean>
}

/**
 * node-redis custom defineScript for NodeGCRA
 */
export function defineNodeRedisScripts(redis: typeof Redis): Record<string, ReturnType<typeof Redis.defineScript>>

/**
 * lua script for NodeGCRA
 */
export const GCRA_LUA: string

export default RedisGCRA

export type RedisGCRAOptions = {
  /**
   * The Redis client to be used. (* If you use node-redis, additional setup work is required; see below. You may also use a Redis-client-like wrapper that exposes the defineCommand method and the Redis del method.)
   */
  redis: RedisClientLike

  /**
   * A prefix for any keys that this limiter instance tries to create/access.
   */
  keyPrefix?: string,

  /**
   * The default burst value for this limiter instance. If provided, must be a number greater than or equal to 1.
   *
   * @default 60
   */
  burst?: number,

  /**
   * The default rate value for this limiter instance. If provided, must be a number greater than or equal to 1.
   *
   * @default 1
   */
  rate?: number,

  /**
   * The default period value for this limiter instance (milliseconds). If provided, must be a number greater than or equal to 1.
   *
   * @default 1000
   */
  period?: number,

  /**
   * The default cost value for for this limiter instance. If provided, must be a number greater than or equal to 0.
   *
   * @default 1
   */
  cost?: number,
}

/**
 * Bare minimum Redis client interface
 */
type RedisClientLike = {
  del: unknown,
} & ({
  defineCommand: unknown,
}|{
  executeScript: unknown,
})