# Changelog

## [0.2.0](https://github.com/windsornguyen/schedule.pizza/compare/v0.1.0...v0.2.0) (2026-06-26)


### Features

* **auth:** add better auth user backend ([#27](https://github.com/windsornguyen/schedule.pizza/issues/27)) ([58d72d6](https://github.com/windsornguyen/schedule.pizza/commit/58d72d6ef42c3a2017fb98d7c7e34be500611506))


### Bug Fixes

* **deploy:** declare cloudflare publish target ([cebe429](https://github.com/windsornguyen/schedule.pizza/commit/cebe429e8c9816e8f9ff9d135290b861e3ccca08))
* **deploy:** update wrangler action pin ([0fb16d1](https://github.com/windsornguyen/schedule.pizza/commit/0fb16d1bcd9bc3e7b5133d31c9c4f74aceb77370))
* pre-bundle bip39 wordlist for cloudflare workers ([2d52b9e](https://github.com/windsornguyen/schedule.pizza/commit/2d52b9ed193f6f5a4eee6cfc91ff6e77253038a3))


### Refactors

* **ui:** simplify frontend layout ([a2e3bd2](https://github.com/windsornguyen/schedule.pizza/commit/a2e3bd2b9c9820c820547927476e203a9d077b1e))

## [0.1.0](https://github.com/windsornguyen/schedule.pizza/compare/v0.0.1...v0.1.0) (2026-06-26)


### Features

* **api:** persist booking endpoints ([#25](https://github.com/windsornguyen/schedule.pizza/issues/25)) ([5ed4c86](https://github.com/windsornguyen/schedule.pizza/commit/5ed4c865f371261a608ce44924050f610da928af))
* **auth:** add booking code authorization gate ([#24](https://github.com/windsornguyen/schedule.pizza/issues/24)) ([80e6e35](https://github.com/windsornguyen/schedule.pizza/commit/80e6e35207ebcd2dda45f0ed959493973e99fdb4))
* **scheduling:** add default slot primitives ([#23](https://github.com/windsornguyen/schedule.pizza/issues/23)) ([4e86cb5](https://github.com/windsornguyen/schedule.pizza/commit/4e86cb5749a6a474ac8e0f3723f8da5cfacc798c))


### Bug Fixes

* **ui:** center content and autofocus input ([#22](https://github.com/windsornguyen/schedule.pizza/issues/22)) ([7358e22](https://github.com/windsornguyen/schedule.pizza/commit/7358e222c2f249486b383d1f1701805aaa7c61db))


### Refactors

* move API to Hono, React Router for UI only ([#26](https://github.com/windsornguyen/schedule.pizza/issues/26)) ([379e6fe](https://github.com/windsornguyen/schedule.pizza/commit/379e6fe89ea86a2d82b0b5992549d4241f9fa742))


### Chores

* **release:** correct initial release metadata ([#20](https://github.com/windsornguyen/schedule.pizza/issues/20)) ([dd47358](https://github.com/windsornguyen/schedule.pizza/commit/dd47358ed4a64915bf6dc215e614a516c91eacf3))

## 0.0.1 (2026-06-24)


### Features

* add login page and dashboard shell ([01d0fb4](https://github.com/windsornguyen/schedule.pizza/commit/01d0fb492d6db4eae839b06e3b48c31d7a4bece0))
* auth-aware homepage, remove dashboard ([0dae413](https://github.com/windsornguyen/schedule.pizza/commit/0dae413f19fdc9f3bf25bb01b9311595825db5e0))
* **auth:** add login page and dashboard shell ([#13](https://github.com/windsornguyen/schedule.pizza/issues/13)) ([692c262](https://github.com/windsornguyen/schedule.pizza/commit/692c2622747fb86ae7c8ca38cb3b0e0172ce4e8b))
* **auth:** wire better-auth with Google social provider ([#15](https://github.com/windsornguyen/schedule.pizza/issues/15)) ([95658a6](https://github.com/windsornguyen/schedule.pizza/commit/95658a6a22cecd1abdc90c6280a0519b86b5a42b))
* **db:** add drizzle schema ([2ce6403](https://github.com/windsornguyen/schedule.pizza/commit/2ce64030377908b1a09def98e913a4d78085dcf2))
* **db:** add drizzle schema ([#3](https://github.com/windsornguyen/schedule.pizza/issues/3)) ([a594446](https://github.com/windsornguyen/schedule.pizza/commit/a5944465929f0a8b44fc8a94b2fc139c6ae10a9f))
* **iac:** manage dev and prod d1 databases ([3915278](https://github.com/windsornguyen/schedule.pizza/commit/3915278e9d2f347d5b7e066fbc56913262233f81))
* **meta:** add opengraph link previews ([#1](https://github.com/windsornguyen/schedule.pizza/issues/1)) ([ed82587](https://github.com/windsornguyen/schedule.pizza/commit/ed8258744505a7c44c5ca2b6d72971a917a9cb80))
* **style:** init shadcn ui ([eb4abd6](https://github.com/windsornguyen/schedule.pizza/commit/eb4abd680695d9b62bb629c71e75ee075fae85bb))
* **style:** init shadcn/ui ([#11](https://github.com/windsornguyen/schedule.pizza/issues/11)) ([793fc0b](https://github.com/windsornguyen/schedule.pizza/commit/793fc0b884a2431c16b824c28aa31b0b0c2c34db))
* wire better-auth with Google social provider ([5c7a6f3](https://github.com/windsornguyen/schedule.pizza/commit/5c7a6f3d21fb960252243e8132852a7319e414b8))
* wire D1 database binding ([51a5ea5](https://github.com/windsornguyen/schedule.pizza/commit/51a5ea51695fac4a10f47416b1a9ad4463e1b74c))
* wire D1 database binding ([#14](https://github.com/windsornguyen/schedule.pizza/issues/14)) ([6eeb50d](https://github.com/windsornguyen/schedule.pizza/commit/6eeb50d1e2d379565891bc9e0e7f69bbe52d6075))


### Bug Fixes

* **build:** order cloudflare plugin after router ([4710ea3](https://github.com/windsornguyen/schedule.pizza/commit/4710ea374128211682b0535ca56f555d3c933055))
* **build:** order cloudflare plugin after router ([#2](https://github.com/windsornguyen/schedule.pizza/issues/2)) ([714cbb9](https://github.com/windsornguyen/schedule.pizza/commit/714cbb9862a618926c71c56c0fa44fbbb7bff600))
* **ci:** install dependencies before audit ([32c0f6c](https://github.com/windsornguyen/schedule.pizza/commit/32c0f6c57b823cdadf20870fff58c2429ba2da53))
* **ci:** install dependencies before audit ([#19](https://github.com/windsornguyen/schedule.pizza/issues/19)) ([5df918c](https://github.com/windsornguyen/schedule.pizza/commit/5df918c386581b29b4114da69f47a987d0bbbf1f))
* **security:** audit pnpm lockfile ([1fef7dc](https://github.com/windsornguyen/schedule.pizza/commit/1fef7dc51d84ea53c2d04310f9aee04befa26693))
* **security:** generate workflow with hollywood ([1bb3bee](https://github.com/windsornguyen/schedule.pizza/commit/1bb3bee8235ea38469d92f919b42fd6608f17784))
* **style:** apply better design palette ([#16](https://github.com/windsornguyen/schedule.pizza/issues/16)) ([be28205](https://github.com/windsornguyen/schedule.pizza/commit/be28205c237e16d7ed27bd402301a042bae29349))
* **style:** refine design palette and typography ([deaf72b](https://github.com/windsornguyen/schedule.pizza/commit/deaf72beca3516e73aa637ef2d202adb550f7a3d))
* use idiomatic cloudflare vite config per official docs ([bae302b](https://github.com/windsornguyen/schedule.pizza/commit/bae302bbc7ae3ab02ca784ed0f8351e20ae2b283))


### Refactors

* **iac:** split terraform files ([cbd17b6](https://github.com/windsornguyen/schedule.pizza/commit/cbd17b6c3a4f7853c6e64b37443a0f9b36b4efb6))
* **iac:** split terraform files ([#17](https://github.com/windsornguyen/schedule.pizza/issues/17)) ([220c0a9](https://github.com/windsornguyen/schedule.pizza/commit/220c0a93907c433758d4f8a7d3aa1140a0ecc5e4))


### Documentation

* add schema and algorithm specs ([9cc3634](https://github.com/windsornguyen/schedule.pizza/commit/9cc3634baa062e34fbac172c18528b1007c27726))
* **algorithm:** describe group availability ([e4bb3af](https://github.com/windsornguyen/schedule.pizza/commit/e4bb3af5e0b8330e7f725e1d86b3f3b6df8d2062))
* **algorithm:** describe group availability ([#10](https://github.com/windsornguyen/schedule.pizza/issues/10)) ([493d3a3](https://github.com/windsornguyen/schedule.pizza/commit/493d3a39660000512a8ae1f56fa20ff5f25a7468))
* **security:** link github reporting ([750bfbb](https://github.com/windsornguyen/schedule.pizza/commit/750bfbb65bfd5311f232f61e042b5b28cc6c6dec))
* **security:** trim duplicate contact section ([4576be5](https://github.com/windsornguyen/schedule.pizza/commit/4576be54d015fcf2be48552379f446c84de9f125))
* **style:** add backend blockers ([d27e0a6](https://github.com/windsornguyen/schedule.pizza/commit/d27e0a6edb61bbe35f39f2facd1a3575327a5f07))
* **style:** add typescript guide ([d46b505](https://github.com/windsornguyen/schedule.pizza/commit/d46b5051e481c609b343783ce977a06598194d20))


### Chores

* bump to ts 7 rc, vite 8.1, add tsgo ([c9df2f3](https://github.com/windsornguyen/schedule.pizza/commit/c9df2f330c2d635c1b0e413703cd24355a55d9bc))
* **deps:** add dependabot config ([cd3b886](https://github.com/windsornguyen/schedule.pizza/commit/cd3b886824db389d39070fc3d0eb89cf04fef233))
* **deps:** add dependabot config ([#7](https://github.com/windsornguyen/schedule.pizza/issues/7)) ([7d24d17](https://github.com/windsornguyen/schedule.pizza/commit/7d24d17fb8959ab35cb823ee3bfc6896f43024ff))
* **github:** add pull request template ([f3d3b79](https://github.com/windsornguyen/schedule.pizza/commit/f3d3b79804bb6b52112c024e3caf475e6a3fbb7c))
* **github:** add pull request template ([#5](https://github.com/windsornguyen/schedule.pizza/issues/5)) ([36bc14a](https://github.com/windsornguyen/schedule.pizza/commit/36bc14a0773e2ae4ab473ca636e9e5560d6b3103))
* **iac:** record d1 database bindings ([93c63a6](https://github.com/windsornguyen/schedule.pizza/commit/93c63a665adc77c697674bf1d4e8940500d76c90))
* **lint:** tighten repository checks ([27dccf8](https://github.com/windsornguyen/schedule.pizza/commit/27dccf8da2e8c68cbbbf5882b753d24264507b40))
* **lint:** tighten repository checks ([#4](https://github.com/windsornguyen/schedule.pizza/issues/4)) ([11c5b58](https://github.com/windsornguyen/schedule.pizza/commit/11c5b583aca762e3239b3d9bc707dbeab0523aa9))
* **oss:** add security boilerplate ([4d838a7](https://github.com/windsornguyen/schedule.pizza/commit/4d838a7453be3ce619a8f580f51917a422686f7b))
* **oss:** add security boilerplate ([#6](https://github.com/windsornguyen/schedule.pizza/issues/6)) ([c4389c5](https://github.com/windsornguyen/schedule.pizza/commit/c4389c514144634587de024479b6759c377d7f3f))
* **paths:** rename path alias to @/, add server-context ([#9](https://github.com/windsornguyen/schedule.pizza/issues/9)) ([e0b4c27](https://github.com/windsornguyen/schedule.pizza/commit/e0b4c276fc45f2c197e80504895a542cd222a7fe))
* **release:** add release please ([8214e0e](https://github.com/windsornguyen/schedule.pizza/commit/8214e0efed60390d197a03f991d5e574e0bd614b))
* **release:** add release please ([#8](https://github.com/windsornguyen/schedule.pizza/issues/8)) ([6c21bef](https://github.com/windsornguyen/schedule.pizza/commit/6c21befb6632cb39a58130d0d33fb4892be551ff))
* rename path alias to @/, add server-context ([8e4d378](https://github.com/windsornguyen/schedule.pizza/commit/8e4d3784f147cc861078792ef5a0e8b5a326bf23))
* **scripts:** prefer single-verb commands ([afc6b50](https://github.com/windsornguyen/schedule.pizza/commit/afc6b509d9e2b586f46b4044e3cae0c2126a9da0))
