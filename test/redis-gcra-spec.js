const Redis     = require('ioredis');
const RedisGCRA = require('../lib');

describe('RedisGCRA', function() {
  before(function() {
    this.redis = new Redis({ db: 4 });
    this.redis.on('error', (err) => { throw err; });
    this.limiter = RedisGCRA({ redis: this.redis });
  });

  after(function() {
    return this.redis.quit();
  });

  beforeEach(function() {
    return this.redis.flushdb();
  });

  it('should perform basic limit and regen', async function() {
    const opts = { key: 'testKey', burst: 2, rate: 1, period: 1000, cost: 1 };
    let result = await this.limiter.limit(opts);
    result.limited.should.equal(false);
    result.remaining.should.equal(1);
    result.retryIn.should.equal(0);
    result.resetIn.should.be.within(990, 1000);

    result = await this.limiter.limit(opts);
    result.limited.should.equal(false);
    result.remaining.should.equal(0);
    result.retryIn.should.equal(0);
    result.resetIn.should.be.within(1980, 2000);

    result = await this.limiter.limit(opts);
    result.limited.should.equal(true);
    result.remaining.should.equal(0);
    result.retryIn.should.be.within(870, 1000);
    result.resetIn.should.be.within(1970, 2000);

    await new Promise((fulfill) => {
      setTimeout(fulfill, result.retryIn);
    });

    result = await this.limiter.limit(opts);
    result.limited.should.equal(false);
    result.remaining.should.equal(0);
    result.retryIn.should.equal(0);
    result.resetIn.should.be.within(1960, 2000);
  });

  it('limits different keys independently', async function() {
    const results = await Promise.all([
      this.limiter.limit({ key: 'key1' }),
      this.limiter.limit({ key: 'key2' }),
      this.limiter.limit({ key: 'key1' })
    ]);

    const key2Result = results[1];
    key2Result.limited.should.equal(false);
    key2Result.remaining.should.equal(59);
    key2Result.retryIn.should.equal(0);
    key2Result.resetIn.should.be.within(990, 1000);

    let key1Result1 = results[0];
    let key1Result2 = results[2];
    // flip them if they executed in reverse order
    if (key1Result1.remaining < key1Result2.remaining) {
      key1Result1 = results[2];
      key1Result2 = results[0];
    }

    key1Result1.limited.should.equal(false);
    key1Result1.remaining.should.equal(59);
    key1Result1.retryIn.should.equal(0);
    key1Result1.resetIn.should.be.within(990, 1000);

    key1Result2.limited.should.equal(false);
    key1Result2.remaining.should.equal(58);
    key1Result2.retryIn.should.equal(0);
    key1Result2.resetIn.should.be.within(1980, 2000);
  });

  it('respects key prefixes and defaults', async function() {
    const prefixed = RedisGCRA({ redis: this.redis, keyPrefix: 'hello', cost: 5 });
    let results = await Promise.all([
      this.limiter.limit({ key: 'key1' }),
      prefixed.limit({ key: 'key1' }),
    ]);

    let key1Result = results[0];
    key1Result.limited.should.equal(false);
    key1Result.remaining.should.equal(59);
    key1Result.retryIn.should.equal(0);
    key1Result.resetIn.should.be.within(990, 1000);

    let prefixedResult = results[1];
    prefixedResult.limited.should.equal(false);
    prefixedResult.remaining.should.equal(55);
    prefixedResult.retryIn.should.equal(0);
    prefixedResult.resetIn.should.be.within(4990, 5000);

    await prefixed.reset({ key: 'key1' });
    results = await Promise.all([
      this.limiter.peek({ key: 'key1' }),
      prefixed.peek({ key: 'key1' }),
    ]);

    key1Result = results[0];
    key1Result.limited.should.equal(false);
    key1Result.remaining.should.equal(59);
    key1Result.retryIn.should.equal(0);
    key1Result.resetIn.should.be.within(980, 1000);

    prefixedResult = results[1];
    prefixedResult.limited.should.equal(false);
    prefixedResult.remaining.should.equal(60);
    prefixedResult.retryIn.should.equal(0);
    prefixedResult.resetIn.should.equal(0);
  });

  const testCases = [
    { burst: 4500, rate: 75,  period: 60000, cost: 1,    repeat: 1,   remaining: 4499, limited: false },
    { burst: 4500, rate: 75,  period: 60000, cost: 1,    repeat: 2,   remaining: 4498, limited: false },
    { burst: 4500, rate: 75,  period: 60000, cost: 2,    repeat: 1,   remaining: 4498, limited: false },
    { burst: 1000, rate: 100, period: 60000, cost: 200,  repeat: 1,   remaining: 800,  limited: false },
    { burst: 1000, rate: 100, period: 60000, cost: 200,  repeat: 4,   remaining: 200,  limited: false },
    { burst: 1000, rate: 100, period: 60000, cost: 200,  repeat: 5,   remaining: 0,    limited: false },
    { burst: 1000, rate: 100, period: 60000, cost: 1,    repeat: 137, remaining: 863,  limited: false },
    { burst: 1000, rate: 100, period: 60000, cost: 1001, repeat: 1,   remaining: 0,    limited: true }
  ];

  testCases.forEach((row, index) => {
    it(`calculates test case ${index} correctly`, async function() {
      const promises = [];
      for (let i=0; i<row.repeat-1; i++) {
        promises.push(this.limiter.limit({
          key: 'testCase',
          burst: row.burst,
          rate: row.rate,
          period: row.period,
          cost: row.cost
        }));
      }

      await Promise.all(promises);

      const finalResult = await this.limiter.limit({
        key: 'testCase',
        burst: row.burst,
        rate: row.rate,
        period: row.period,
        cost: row.cost
      });

      finalResult.remaining.should.equal(row.remaining);
      finalResult.limited.should.equal(row.limited);
    });
  });

  it('should not modify when using peek', async function() {
    let results = await Promise.all([
      this.limiter.peek({ key: 'key1' }),
      this.limiter.peek({ key: 'key1' }),
      this.limiter.peek({ key: 'key1' })
    ]);
    results[0].should.deepEqual({ limited: false, remaining: 60, retryIn: 0, resetIn: 0 });
    results[0].should.deepEqual(results[1]);
    results[0].should.deepEqual(results[2]);

    await this.limiter.limit({ key: 'key1' });
    results = await Promise.all([
      this.limiter.peek({ key: 'key1' }),
      this.limiter.peek({ key: 'key1' }),
      this.limiter.peek({ key: 'key1' })
    ]);

    results[0].limited.should.equal(false);
    results[0].remaining.should.equal(59);
    results[0].retryIn.should.equal(0);
    results[0].resetIn.should.be.within(980, 1000);
    results[0].should.deepEqual(results[1]);
    results[0].should.deepEqual(results[2]);
  });

});
