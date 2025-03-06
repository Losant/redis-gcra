import fs from 'fs';
import path from 'path';
import * as url from 'url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const GCRA_LUA = fs.readFileSync(path.join(__dirname, 'gcra.lua'));
const DEFAULTS = { burst: 60, rate: 1, period: 1000, cost: 1 };

const validateNumber = (val, name, min, max) => {
  if (typeof(val) !== 'number') {
    throw new TypeError(`${name} must be a number`);
  }
  if (!isFinite(val)) {
    throw new RangeError(`${name} must be finite`);
  }
  if (val < min) {
    throw new RangeError(`${name} must be at least ${min}`);
  }
  if (val >= max) {
    throw new RangeError(`${name} must be less than ${max}`);
  }
};

const resolveArguments = (args, fallback) => {
  args = Object.assign({}, fallback, args);
  validateNumber(args.burst, 'burst', 1, Number.MAX_SAFE_INTEGER);
  validateNumber(args.rate, 'rate', 1, Number.MAX_SAFE_INTEGER);
  validateNumber(args.period, 'period', 1, Number.MAX_SAFE_INTEGER);
  validateNumber(args.cost, 'cost', 0, Number.MAX_SAFE_INTEGER);
  return args;
};

const resolveKey = (key, keyPrefix) => {
  if (!key) { throw new TypeError('key is required'); }
  if (keyPrefix) {
    return `${keyPrefix}/${key}`;
  } else {
    return `${key}`;
  }
};

const performLimit = async (redis, key, keyPrefix, args, defaults) => {
  args = resolveArguments(args, defaults);
  key = resolveKey(key, keyPrefix);

  const result = await redis.performGcraRateLimit(
    key,
    Date.now(),
    args.burst,
    args.rate,
    args.period,
    args.cost
  );

  return {
    limited:   !!result[0],
    remaining: result[1],
    retryIn:   args.cost > args.burst ? Infinity : result[2],
    resetIn:   result[3]
  };
};

const RedisGCRA = ({ redis, keyPrefix, ...defaults }) => {
  if (!redis || (typeof(redis.defineCommand) !== 'function' && typeof(redis.executeScript) !== 'function')) {
    throw new TypeError('An ioRedis or node-redis instance must be provided');
  }

  defaults = resolveArguments(defaults, DEFAULTS);

  if (!redis.performGcraRateLimit) {
    if (typeof(redis.executeScript) === 'function') {
      throw new TypeError('Must pass a node-redis instance with pre-defined performGcraRateLimit script; check documentation.');
    }
    if (typeof(redis.defineCommand) === 'function') {
      redis.defineCommand('performGcraRateLimit',
        { numberOfKeys: 1, lua: GCRA_LUA });
    }
  }

  return {
    limit: ({ key, ...args }) => {
      return performLimit(redis, key, keyPrefix, args, defaults);
    },
    peek: async ({ key, ...args }) => {
      args.cost = 0;
      const { limited, remaining, resetIn } = await performLimit(redis, key, keyPrefix, args, defaults);
      return { limited, remaining, resetIn };
    },
    reset: async ({ key }) => {
      key = resolveKey(key, keyPrefix);
      const result = await redis.del(key);
      return result > 0;
    }
  };

};

RedisGCRA.defineNodeRedisScripts = (nodeRedis) => {
  return {
    performGcraRateLimit: nodeRedis.defineScript({
      NUMBER_OF_KEYS: 1,
      SCRIPT: GCRA_LUA,
      transformArguments(key, now, burst, rate, period, cost) {
        return [key, now.toString(), burst.toString(), rate.toString(), period.toString(), cost.toString()];
      },
      transformReply(reply) {
        return reply;
      }
    })
  };
};

RedisGCRA.GCRA_LUA = GCRA_LUA;

export default RedisGCRA;
