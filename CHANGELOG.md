# Redis GCRA Changelog

***
## 0.5.0 - 2023-03-27

- Add support for node-redis

## 0.4.0 - 2022-10-12

- Update development/test dependencies.
- Add support for ioredis 5.
- Drop support for ioredis 2 and 3.
- Add Node 16, 18 to travis.yml.
- Remove Node 10, 12, 13, and 15 from travis.yaml.
- Drop support for Node 10 and Node 12.

## 0.3.1 - 2020-10-21

- Update development/test dependencies.
- Add Node 14 and 15 to travis.yml.
- Fix a few minor linting issues.

## 0.3.0 - 2020-04-16

- Fix issue where the TTL of the key (which is in milliseconds) was getting treated as a TTL in seconds for redis expiration
- Update development/test dependencies
- Add Node 13 to travis.yml
- Remove support for Node 8 and 9, and remove Node 8 and 9 from travis.yml (since mocha/eslint no longer supports them).

## 0.2.0 - 2019-07-18

- Stop rounding remaining tokens
- Update development/test dependencies
- Add Node 11 & 12 to travis.yml

***

## 0.1.1 - 2018-10-22

- Update development/test dependencies
- Verify that ioredis >= 4.0 works and accept in package.json
- Update lint rules and fix affected tests
- Add Node 9 & 10 to travis.yml

***

## 0.1.0 - 2017-10-21

- Initial release
