# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.7.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.23...@sls-next/lambda-at-edge@1.7.0) (2020-11-02)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.7.0-alpha.23](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.22...@sls-next/lambda-at-edge@1.7.0-alpha.23) (2020-10-29)

### Bug Fixes

- **lambda-at-edge:** add retries for s3 calls ([#720](https://github.com/serverless-nextjs/serverless-next.js/issues/720)) ([72252fc](https://github.com/serverless-nextjs/serverless-next.js/commit/72252fc08dbc90a7c487cbceb5d61a696594676c))

# [1.7.0-alpha.22](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.21...@sls-next/lambda-at-edge@1.7.0-alpha.22) (2020-10-28)

### Bug Fixes

- **lambda-at-edge:** don't rewrite data requests ([#719](https://github.com/serverless-nextjs/serverless-next.js/issues/719)) ([5b6f848](https://github.com/serverless-nextjs/serverless-next.js/commit/5b6f84891724c7d2b83d8ee6c2708bb3874f0ccd))

# [1.7.0-alpha.21](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.20...@sls-next/lambda-at-edge@1.7.0-alpha.21) (2020-10-27)

### Bug Fixes

- **lambda-at-edge:** fix dynamic route precedence conflicting with fallback pages ([#714](https://github.com/serverless-nextjs/serverless-next.js/issues/714)) ([e667e76](https://github.com/serverless-nextjs/serverless-next.js/commit/e667e76cef137d68ef215e91a72490dba7f7199f))

# [1.7.0-alpha.20](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.19...@sls-next/lambda-at-edge@1.7.0-alpha.20) (2020-10-23)

### Bug Fixes

- **lambda-at-edge:** fail build when "public/static" folder exists as this conflicts with static/\* cache behavior ([#709](https://github.com/serverless-nextjs/serverless-next.js/issues/709)) ([187bbc8](https://github.com/serverless-nextjs/serverless-next.js/commit/187bbc8bd3b4c5284db155dced94c8d857b7f68a))

# [1.7.0-alpha.19](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.18...@sls-next/lambda-at-edge@1.7.0-alpha.19) (2020-10-22)

### Bug Fixes

- **lambda-at-edge:** fix broken npm install by changing src/command.js -> dist/command.js ([fde41ee](https://github.com/serverless-nextjs/serverless-next.js/commit/fde41ee098c06759b3b71e9dc489a6aef98baff2))

# [1.7.0-alpha.18](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.17...@sls-next/lambda-at-edge@1.7.0-alpha.18) (2020-10-22)

### Features

- **lambda-at-edge:** add a binary to allow use without copying example ([#688](https://github.com/serverless-nextjs/serverless-next.js/issues/688)) ([0c138a2](https://github.com/serverless-nextjs/serverless-next.js/commit/0c138a2d63b230b3c0ec5a37080b8987bfcc86ff))
- **lambda-at-edge-compat, lambda-at-edge, nextjs-component:** let CloudFront do the Gzipping ([#692](https://github.com/serverless-nextjs/serverless-next.js/issues/692)) ([05fb0eb](https://github.com/serverless-nextjs/serverless-next.js/commit/05fb0ebdf38096fb7e0427956c4747e782c680a8))

# [1.7.0-alpha.17](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.16...@sls-next/lambda-at-edge@1.7.0-alpha.17) (2020-10-21)

### Bug Fixes

- **lambda-at-edge:** non-dynamic routes for rewrite should not include routes in prerender manifest ([#700](https://github.com/serverless-nextjs/serverless-next.js/issues/700)) ([06d4edb](https://github.com/serverless-nextjs/serverless-next.js/commit/06d4edb72da2662affc9ad25a2e4eb5550d415e9))
- **lambda-at-edge:** serve HTML pages with no props (i.e static pages) properly on preview mode enabled ([#701](https://github.com/serverless-nextjs/serverless-next.js/issues/701)) ([57cd668](https://github.com/serverless-nextjs/serverless-next.js/commit/57cd6689152530064635eb9d53c5201d580c9b61))

# [1.7.0-alpha.16](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.15...@sls-next/lambda-at-edge@1.7.0-alpha.16) (2020-10-21)

### Bug Fixes

- **lambda-at-edge, e2e-tests:** don't rewrite non-dynamic api routes ([#698](https://github.com/serverless-nextjs/serverless-next.js/issues/698)) ([27526e7](https://github.com/serverless-nextjs/serverless-next.js/commit/27526e70c57d3bab016f734a0672d62c9d43bcca))

# [1.7.0-alpha.15](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.14...@sls-next/lambda-at-edge@1.7.0-alpha.15) (2020-10-20)

### Bug Fixes

- **lambda-at-edge, e2e-tests:** non-dynamic routes should never be rewritten ([#697](https://github.com/serverless-nextjs/serverless-next.js/issues/697)) ([f16c9a0](https://github.com/serverless-nextjs/serverless-next.js/commit/f16c9a0811e80bb5d45d9ebd517c2ae8f3b35316))

# [1.7.0-alpha.14](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.13...@sls-next/lambda-at-edge@1.7.0-alpha.14) (2020-10-20)

### Features

- **lambda-at-edge, nextjs-component:** allow `handler` input for custom handler code ([#649](https://github.com/serverless-nextjs/serverless-next.js/issues/649)) ([cecd327](https://github.com/serverless-nextjs/serverless-next.js/commit/cecd327993d593c582eeb140538b271b2eef509a))

# [1.7.0-alpha.13](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.12...@sls-next/lambda-at-edge@1.7.0-alpha.13) (2020-10-18)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.7.0-alpha.12](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.11...@sls-next/lambda-at-edge@1.7.0-alpha.12) (2020-10-16)

### Bug Fixes

- **lambda-at-edge:** non-dynamic pages (SSG, SSR) should be prioritized over dynamic fallback pages ([#685](https://github.com/serverless-nextjs/serverless-next.js/issues/685)) ([71b61e7](https://github.com/serverless-nextjs/serverless-next.js/commit/71b61e7644874da15715c6ec9af60cdc3746f71a))

# [1.7.0-alpha.11](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.10...@sls-next/lambda-at-edge@1.7.0-alpha.11) (2020-10-15)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.7.0-alpha.10](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.9...@sls-next/lambda-at-edge@1.7.0-alpha.10) (2020-10-15)

### Bug Fixes

- **lambda-at-edge, e2e-tests:** PUT or DELETE S3 methods should just … ([#680](https://github.com/serverless-nextjs/serverless-next.js/issues/680)) ([f9910a0](https://github.com/serverless-nextjs/serverless-next.js/commit/f9910a023511240337ee62251a169f9504ffbfec))

### Features

- **lambda-at-edge:** support fallback: false for getStaticPaths and fix cache-control header ([#681](https://github.com/serverless-nextjs/serverless-next.js/issues/681)) ([3ef5c17](https://github.com/serverless-nextjs/serverless-next.js/commit/3ef5c17032bd206f706323b9a85e940b594cfc38))

# [1.7.0-alpha.9](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.8...@sls-next/lambda-at-edge@1.7.0-alpha.9) (2020-10-15)

### Bug Fixes

- **lambda-at-edge:** fix dynamic routes with getStaticPaths interfering with public files ([#679](https://github.com/serverless-nextjs/serverless-next.js/issues/679)) ([17beb1f](https://github.com/serverless-nextjs/serverless-next.js/commit/17beb1f7a994ec17d3e378bee931237b2b5cc54f))

# [1.7.0-alpha.8](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.7...@sls-next/lambda-at-edge@1.7.0-alpha.8) (2020-10-13)

### Bug Fixes

- **lambda-at-edge:** fix possible redirect loop in API handler ([#671](https://github.com/serverless-nextjs/serverless-next.js/issues/671)) ([ed92ebc](https://github.com/serverless-nextjs/serverless-next.js/commit/ed92ebce73720c46fdb5c7c9065127d7f8a51078))

# [1.7.0-alpha.7](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.6...@sls-next/lambda-at-edge@1.7.0-alpha.7) (2020-10-10)

### Features

- **lambda-at-edge:** support custom headers (with caveats) ([#662](https://github.com/serverless-nextjs/serverless-next.js/issues/662)) ([8b9e822](https://github.com/serverless-nextjs/serverless-next.js/commit/8b9e822a7071fc3277711ed476860564577e0af3))

# [1.7.0-alpha.6](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.5...@sls-next/lambda-at-edge@1.7.0-alpha.6) (2020-10-09)

### Features

- **lambda-at-edge:** add minifyHandlers input to minify handler code using Terser ([#659](https://github.com/serverless-nextjs/serverless-next.js/issues/659)) ([1b33e72](https://github.com/serverless-nextjs/serverless-next.js/commit/1b33e72bf1e578e1a8bd6c7a77aeb99db412471a))

# [1.7.0-alpha.5](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.4...@sls-next/lambda-at-edge@1.7.0-alpha.5) (2020-10-07)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.7.0-alpha.4](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.3...@sls-next/lambda-at-edge@1.7.0-alpha.4) (2020-10-06)

### Bug Fixes

- **lambda-at-edge:** fix compilation of query strings in redirect des… ([#647](https://github.com/serverless-nextjs/serverless-next.js/issues/647)) ([9ed7159](https://github.com/serverless-nextjs/serverless-next.js/commit/9ed7159a759eccedd5cf6ee98a261c1cbcab1d90))

### Features

- **lambda-at-edge:** support page and API rewrites ([#653](https://github.com/serverless-nextjs/serverless-next.js/issues/653)) ([f187b91](https://github.com/serverless-nextjs/serverless-next.js/commit/f187b91dd40012810cb96308d416736f2e032222))
- **lambda-at-edge, nextjs-component:** add new input domainRedirects ([#639](https://github.com/serverless-nextjs/serverless-next.js/issues/639)) ([a12e31a](https://github.com/serverless-nextjs/serverless-next.js/commit/a12e31ac06378f9fe26189b95a9b032942656380))

# [1.7.0-alpha.3](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.2...@sls-next/lambda-at-edge@1.7.0-alpha.3) (2020-09-30)

### Features

- **lambda-at-edge:** support custom redirects from API routes ([#640](https://github.com/serverless-nextjs/serverless-next.js/issues/640)) ([b68d46a](https://github.com/serverless-nextjs/serverless-next.js/commit/b68d46a4592a48ee55a35e089e4d8554edadaa17))

# [1.7.0-alpha.2](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.7.0-alpha.1...@sls-next/lambda-at-edge@1.7.0-alpha.2) (2020-09-30)

### Bug Fixes

- **lambda-at-edge:** fix broken redirects with full URLs as destinations ([#638](https://github.com/serverless-nextjs/serverless-next.js/issues/638)) ([ee95e54](https://github.com/serverless-nextjs/serverless-next.js/commit/ee95e549cdb620865d536435e74e1ea3026ecd20))

# [1.7.0-alpha.1](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.6.0...@sls-next/lambda-at-edge@1.7.0-alpha.1) (2020-09-29)

### Features

- **lambda-at-edge:** support custom redirects ([#627](https://github.com/serverless-nextjs/serverless-next.js/issues/627)) ([d2f9679](https://github.com/serverless-nextjs/serverless-next.js/commit/d2f9679a5074285cb8a5111d4c1e34f8bbde0b0f))

# [1.7.0-alpha.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.6.0...@sls-next/lambda-at-edge@1.7.0-alpha.0) (2020-09-29)

### Features

- **lambda-at-edge:** support custom redirects ([#627](https://github.com/serverless-nextjs/serverless-next.js/issues/627)) ([d2f9679](https://github.com/serverless-nextjs/serverless-next.js/commit/d2f9679a5074285cb8a5111d4c1e34f8bbde0b0f))

# [1.6.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.6.0-alpha.11...@sls-next/lambda-at-edge@1.6.0) (2020-09-26)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.6.0-alpha.11](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.6.0-alpha.10...@sls-next/lambda-at-edge@1.6.0-alpha.11) (2020-09-23)

### Bug Fixes

- **lambda-at-edge, e2e-tests:** fix issue where SSR data request should be directly rendered in Lambda, not retrieved from S3 ([2fa8910](https://github.com/serverless-nextjs/serverless-next.js/commit/2fa8910aea85626a5ae37efd4c8a2e6ece86c4ce))

# [1.6.0-alpha.10](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.6.0-alpha.9...@sls-next/lambda-at-edge@1.6.0-alpha.10) (2020-09-16)

### Bug Fixes

- **lambda-at-edge:** exclude prerender js files from default handler if no API routes are used ([#600](https://github.com/serverless-nextjs/serverless-next.js/issues/600)) ([73d0f48](https://github.com/serverless-nextjs/serverless-next.js/commit/73d0f4821212ae7b3d0a46d3ca34fef6425277ab))

# [1.6.0-alpha.9](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.6.0-alpha.8...@sls-next/lambda-at-edge@1.6.0-alpha.9) (2020-09-10)

### Bug Fixes

- **lambda-at-edge:** move path-to-regexp to prod deps ([e4d9dbd](https://github.com/serverless-nextjs/serverless-next.js/commit/e4d9dbd3f12b12cd5f10936d0daf511134c70ae7))

# [1.6.0-alpha.8](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.6.0-alpha.7...@sls-next/lambda-at-edge@1.6.0-alpha.8) (2020-09-10)

### Features

- **lambda-at-edge:** use new aws s3 client for faster require time ([#583](https://github.com/serverless-nextjs/serverless-next.js/issues/583)) ([f9eef45](https://github.com/serverless-nextjs/serverless-next.js/commit/f9eef458552e5ff5ee60e9b43df7ccf221a2ec0c))
- **lambda-at-edge, next-aws-cloudfront:** support Preview Mode ([#562](https://github.com/serverless-nextjs/serverless-next.js/issues/562)) ([5e1ea38](https://github.com/serverless-nextjs/serverless-next.js/commit/5e1ea3891e48d75de5973902a014b67f14c8380a))

# [1.6.0-alpha.7](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.6.0-alpha.6...@sls-next/lambda-at-edge@1.6.0-alpha.7) (2020-08-31)

### Bug Fixes

- **lambda-at-edge:** fix data request routing / client-side navigation for SSR index page ([#574](https://github.com/serverless-nextjs/serverless-next.js/issues/574)) ([f580786](https://github.com/serverless-nextjs/serverless-next.js/commit/f580786e5859f217e5ce79824cdaa0ef17ef0e42))
- **lambda-at-edge:** fix for 404s on public files ([#577](https://github.com/serverless-nextjs/serverless-next.js/issues/577)) ([a854139](https://github.com/serverless-nextjs/serverless-next.js/commit/a854139f4344530de1a42268828231a4d38c7c91))

# [1.6.0-alpha.6](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.6.0-alpha.5...@sls-next/lambda-at-edge@1.6.0-alpha.6) (2020-08-29)

### Bug Fixes

- **lambda-at-edge:** fix reading next.config.js in build step when it exports a function ([#569](https://github.com/serverless-nextjs/serverless-next.js/issues/569)) ([16272b4](https://github.com/serverless-nextjs/serverless-next.js/commit/16272b43b8d1cfcdebe1eddad91a8bae7bcc890c))
- **lambda-at-edge:** fix routing for pages with basePath ([#572](https://github.com/serverless-nextjs/serverless-next.js/issues/572)) ([b185a7a](https://github.com/serverless-nextjs/serverless-next.js/commit/b185a7a088b58651780542d1539660c951cd63a6))
- **lambda-at-edge:** render Next 500 page when SSR render fails, and ensure 404 pages return 404 status codes ([#570](https://github.com/serverless-nextjs/serverless-next.js/issues/570)) ([bdd1e3f](https://github.com/serverless-nextjs/serverless-next.js/commit/bdd1e3f9feb7e0c9eec42de7298882dce084aa67))

# [1.6.0-alpha.5](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.6.0-alpha.4...@sls-next/lambda-at-edge@1.6.0-alpha.5) (2020-08-27)

### Features

- **lambda-at-edge:** support trailing slash / non-trailing slash redirects ([#556](https://github.com/serverless-nextjs/serverless-next.js/issues/556)) ([ca63b80](https://github.com/serverless-nextjs/serverless-next.js/commit/ca63b80d4bf784ebfdc5a32352a53dde85b4b4d9))

# [1.6.0-alpha.4](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.6.0-alpha.3...@sls-next/lambda-at-edge@1.6.0-alpha.4) (2020-08-19)

### Bug Fixes

- **lambda-at-edge:** ignore package.json during serverless-trace ([#552](https://github.com/serverless-nextjs/serverless-next.js/issues/552)) ([d21f1d5](https://github.com/serverless-nextjs/serverless-next.js/commit/d21f1d56b8b21bad38b86ec91ae5f26c8c9472bc))

### Features

- **lambda-at-edge:** add opt in lambda execution times logging ([#549](https://github.com/serverless-nextjs/serverless-next.js/issues/549)) ([066bd27](https://github.com/serverless-nextjs/serverless-next.js/commit/066bd270ce8b8f915298b7bac51c2aeb3ab27126))

# [1.6.0-alpha.3](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.6.0-alpha.2...@sls-next/lambda-at-edge@1.6.0-alpha.3) (2020-08-14)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.6.0-alpha.2](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.6.0-alpha.1...@sls-next/lambda-at-edge@1.6.0-alpha.2) (2020-08-14)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.6.0-alpha.1](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.6.0-alpha.0...@sls-next/lambda-at-edge@1.6.0-alpha.1) (2020-08-14)

### Features

- **serverless-component, lambda-at-edge, lambda-at-edge-compat, s3-static-assets:** add support for getStaticPaths fallback true ([#544](https://github.com/serverless-nextjs/serverless-next.js/issues/544)) ([a08217b](https://github.com/serverless-nextjs/serverless-next.js/commit/a08217ba26ea90f67c562fe4ae9510b617d14d08))

# [1.6.0-alpha.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.5.2...@sls-next/lambda-at-edge@1.6.0-alpha.0) (2020-08-06)

### Features

- **lambda-at-edge,serverless-component:** basePath support ([#510](https://github.com/serverless-nextjs/serverless-next.js/issues/510)) ([b17ce30](https://github.com/serverless-nextjs/serverless-next.js/commit/b17ce30b1f18f994f1d2e9ebfe833a74aae6676b))

## [1.5.2](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.5.2-alpha.1...@sls-next/lambda-at-edge@1.5.2) (2020-08-01)

### Bug Fixes

- **lambda-at-edge:** fix next 9.5 root uri problem ([#528](https://github.com/serverless-nextjs/serverless-next.js/issues/528)) ([ceb9218](https://github.com/serverless-nextjs/serverless-next.js/commit/ceb9218dcdd15e1b36228fc3752e2f5e4b4082c0))

## [1.5.2-alpha.1](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.5.2-alpha.0...@sls-next/lambda-at-edge@1.5.2-alpha.1) (2020-07-30)

**Note:** Version bump only for package @sls-next/lambda-at-edge

## [1.5.2-alpha.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.5.1...@sls-next/lambda-at-edge@1.5.2-alpha.0) (2020-07-14)

**Note:** Version bump only for package @sls-next/lambda-at-edge

## [1.5.1](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.5.0...@sls-next/lambda-at-edge@1.5.1) (2020-07-11)

### Bug Fixes

- **lambda-at-edge:** fix s3 bucket not being normalized for public assets ([#497](https://github.com/serverless-nextjs/serverless-next.js/issues/497)) ([7e39902](https://github.com/serverless-nextjs/serverless-next.js/commit/7e399022ebf9c45aa782c6bc9104c55192bb3af7))

# [1.5.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.5.0-alpha.0...@sls-next/lambda-at-edge@1.5.0) (2020-07-11)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.5.0-alpha.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.4.1-alpha.5...@sls-next/lambda-at-edge@1.5.0-alpha.0) (2020-07-05)

### Features

- **lambda-at-edge:** use S3 regional endpoint when not in us-east-1 ([#474](https://github.com/serverless-nextjs/serverless-next.js/issues/474)) ([5ecff1a](https://github.com/serverless-nextjs/serverless-next.js/commit/5ecff1a50e26c22f7de9ec9da3cf2cba4390d77d))

## [1.4.1-alpha.5](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.4.1-alpha.4...@sls-next/lambda-at-edge@1.4.1-alpha.5) (2020-06-30)

**Note:** Version bump only for package @sls-next/lambda-at-edge

## [1.4.1-alpha.4](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.4.1-alpha.3...@sls-next/lambda-at-edge@1.4.1-alpha.4) (2020-06-29)

**Note:** Version bump only for package @sls-next/lambda-at-edge

## [1.4.1-alpha.3](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.4.1-alpha.2...@sls-next/lambda-at-edge@1.4.1-alpha.3) (2020-06-29)

**Note:** Version bump only for package @sls-next/lambda-at-edge

## [1.4.1-alpha.2](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.4.1-alpha.1...@sls-next/lambda-at-edge@1.4.1-alpha.2) (2020-06-28)

**Note:** Version bump only for package @sls-next/lambda-at-edge

## [1.4.1-alpha.1](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.4.1-alpha.0...@sls-next/lambda-at-edge@1.4.1-alpha.1) (2020-06-24)

### Bug Fixes

- **serverless-component:** don't overwrite the cloudfront default.forward config ([#460](https://github.com/serverless-nextjs/serverless-next.js/issues/460)) ([12da1de](https://github.com/serverless-nextjs/serverless-next.js/commit/12da1de31855b68b9addef801ec21dffd3202a21))

## [1.4.1-alpha.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.4.0...@sls-next/lambda-at-edge@1.4.1-alpha.0) (2020-06-21)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.4.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.4.0-alpha.0...@sls-next/lambda-at-edge@1.4.0) (2020-06-16)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.4.0-alpha.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.3.0...@sls-next/lambda-at-edge@1.4.0-alpha.0) (2020-06-12)

### Features

- **serverless-component, lambda-at-edge:** add support for static 404.html page ([#432](https://github.com/serverless-nextjs/serverless-next.js/issues/432)) ([0ba8931](https://github.com/serverless-nextjs/serverless-next.js/commit/0ba8931807258de58eeaccf449a7b714fc66e15c))

# [1.3.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.2.0...@sls-next/lambda-at-edge@1.3.0) (2020-06-07)

### Features

- **serverless-component,lambda-at-edge:** getServerSideProps support ([#429](https://github.com/serverless-nextjs/serverless-next.js/issues/429)) ([7aeb26e](https://github.com/serverless-nextjs/serverless-next.js/commit/7aeb26e5052498c580baf7db38e63fefafc38ea4))

# [1.2.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.2.0-alpha.5...@sls-next/lambda-at-edge@1.2.0) (2020-06-05)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.2.0-alpha.5](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.2.0-alpha.4...@sls-next/lambda-at-edge@1.2.0-alpha.5) (2020-06-03)

### Bug Fixes

- **lambda-at-edge:** resolve dependencies using .next/serverless as base path ([#425](https://github.com/serverless-nextjs/serverless-next.js/issues/425)) ([d60982f](https://github.com/serverless-nextjs/serverless-next.js/commit/d60982f10e85f716badd1676c3f89a57a6c04019))

# [1.2.0-alpha.4](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.2.0-alpha.3...@sls-next/lambda-at-edge@1.2.0-alpha.4) (2020-05-31)

### Features

- **lambda-at-edge:** autogenerate serverless config ([#418](https://github.com/serverless-nextjs/serverless-next.js/issues/418)) ([0f9a176](https://github.com/serverless-nextjs/serverless-next.js/commit/0f9a176f65207d31d0b66a11d6fbceafe27fade5))

# [1.2.0-alpha.3](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.2.0-alpha.2...@sls-next/lambda-at-edge@1.2.0-alpha.3) (2020-05-23)

### Bug Fixes

- **lambda-at-edge:** explicitly set host header for s3 origin ([#412](https://github.com/serverless-nextjs/serverless-next.js/issues/412)) ([2f44795](https://github.com/serverless-nextjs/serverless-next.js/commit/2f44795aed0579acb5f1fea90370b0066c170bcb))

# [1.2.0-alpha.2](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.2.0-alpha.1...@sls-next/lambda-at-edge@1.2.0-alpha.2) (2020-05-19)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.2.0-alpha.1](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.2.0-alpha.0...@sls-next/lambda-at-edge@1.2.0-alpha.1) (2020-05-17)

### Features

- **lambda-at-edge:** add serverless trace target support ([#405](https://github.com/serverless-nextjs/serverless-next.js/issues/405)) ([d800951](https://github.com/serverless-nextjs/serverless-next.js/commit/d800951673474965c386ab94b2d8db18790099f7))

# [1.2.0-alpha.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.1.3...@sls-next/lambda-at-edge@1.2.0-alpha.0) (2020-05-15)

### Bug Fixes

- **lambda-at-edge:** fix routing issue when looking up root / path in prerender-manifest ([7eedd69](https://github.com/serverless-nextjs/serverless-next.js/commit/7eedd6931923cb0c5ed87255075a401345505bc7))

### Features

- **serverless-component:** implement getStaticProps / getStaticPaths [fallback: false](<[#390](https://github.com/serverless-nextjs/serverless-next.js/issues/390)>) ([5185649](https://github.com/serverless-nextjs/serverless-next.js/commit/518564944435767759fae8ae5978baf3afc49d7a))

## [1.1.3](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.1.2...@sls-next/lambda-at-edge@1.1.3) (2020-05-07)

**Note:** Version bump only for package @sls-next/lambda-at-edge

## [1.1.2](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.1.2-alpha.1...@sls-next/lambda-at-edge@1.1.2) (2020-05-05)

**Note:** Version bump only for package @sls-next/lambda-at-edge

## [1.1.2-alpha.1](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.1.2-alpha.0...@sls-next/lambda-at-edge@1.1.2-alpha.1) (2020-05-05)

### Bug Fixes

- **lambda-at-edge:** dont throw when no prev .next dir ([8dfd19d](https://github.com/serverless-nextjs/serverless-next.js/commit/8dfd19dc3b479edd43862051de756e895b56c88e))

## [1.1.2-alpha.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.1.1...@sls-next/lambda-at-edge@1.1.2-alpha.0) (2020-05-05)

### Bug Fixes

- **serverless-component:** upload whole .next/static folder and dont clear cache between builds ([4406ebb](https://github.com/serverless-nextjs/serverless-next.js/commit/4406ebbb8937c75dfbc5644913b7c0d05ff3a52f))

## [1.1.1](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.1.1-alpha.0...@sls-next/lambda-at-edge@1.1.1) (2020-05-04)

**Note:** Version bump only for package @sls-next/lambda-at-edge

## [1.1.1-alpha.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.1.0...@sls-next/lambda-at-edge@1.1.1-alpha.0) (2020-05-03)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.1.0](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.1.0-alpha.2...@sls-next/lambda-at-edge@1.1.0) (2020-04-25)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.1.0-alpha.2](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.1.0-alpha.1...@sls-next/lambda-at-edge@1.1.0-alpha.2) (2020-04-23)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# [1.1.0-alpha.1](https://github.com/serverless-nextjs/serverless-next.js/compare/@sls-next/lambda-at-edge@1.1.0-alpha.0...@sls-next/lambda-at-edge@1.1.0-alpha.1) (2020-04-23)

**Note:** Version bump only for package @sls-next/lambda-at-edge

# 1.1.0-alpha.0 (2020-04-23)

### Features

- **lambda-at-edge:** create new package with Lambda@Edge builder and handlers ([94f0a29](https://github.com/serverless-nextjs/serverless-next.js/commit/94f0a29f0654f51d60653c8218c15802b2abb476))
