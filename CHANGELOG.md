# Changelog

All notable changes to this project are documented here. This file is maintained by [release-please](https://github.com/googleapis/release-please) from the [Conventional Commits](https://www.conventionalcommits.org/) merged into `master`: don't edit released entries by hand. New versions are inserted above the previous ones.

## [0.9.0](https://github.com/pprb/tankobon/compare/v0.8.1...v0.9.0) (2026-10-18)


### Features

* **profile:** show and clear the reading history ([#137](https://github.com/pprb/tankobon/issues/137)) ([e784873](https://github.com/pprb/tankobon/commit/e784873887c1f4fb7035caf734aae4ee2354c823))
* **settings:** add light/dark/system theme choice ([#131](https://github.com/pprb/tankobon/issues/131)) ([daf4f78](https://github.com/pprb/tankobon/commit/daf4f78d02066809f5d93f6b11826ca0aa1c0110))
* **users:** delete a user while another one remains ([#136](https://github.com/pprb/tankobon/issues/136)) ([4b0ef13](https://github.com/pprb/tankobon/commit/4b0ef13fa5dccb64e6300b920cbe83ba9687a05e))
* **users:** manage several users sharing one library ([#134](https://github.com/pprb/tankobon/issues/134)) ([8a9a4d8](https://github.com/pprb/tankobon/commit/8a9a4d80471e5c4d4599f639453064c42bd5d4b5))
* **users:** offer a user choice screen at startup ([#138](https://github.com/pprb/tankobon/issues/138)) ([dc68081](https://github.com/pprb/tankobon/commit/dc68081a1a8e2e35ea9608718d8bd37178a4c3a6))

## [0.8.1](https://github.com/pprb/tankobon/compare/v0.8.0...v0.8.1) (2026-10-18)


### Bug Fixes

* **reader:** keep the scroll position when a page above the viewport changes height ([#132](https://github.com/pprb/tankobon/issues/132)) ([0ad9a24](https://github.com/pprb/tankobon/commit/0ad9a24f17913a2bd2994caceba85975c92dd92a))

## [0.8.0](https://github.com/pprb/tankobon/compare/v0.7.0...v0.8.0) (2026-10-14)


### Features

* **decoder:** time out hung file opens, close a window's archives with it ([#129](https://github.com/pprb/tankobon/issues/129)) ([c04d1c4](https://github.com/pprb/tankobon/commit/c04d1c4d5e1c23217a5cc561bc75d8454ddd72d0))


### Bug Fixes

* **a11y:** drop the link role on book rows, label the tag field and the stars ([#126](https://github.com/pprb/tankobon/issues/126)) ([a57b83c](https://github.com/pprb/tankobon/commit/a57b83cd4aa9ce2630473506be8b5e4cd214d46b))
* **app:** allow a single instance and wait for the database lock ([#112](https://github.com/pprb/tankobon/issues/112)) ([923d5a0](https://github.com/pprb/tankobon/commit/923d5a0b93e235548ae6cd111bb43b69d5fd3428))
* **cbr:** refuse pages that unpack above the entry size limit ([#111](https://github.com/pprb/tankobon/issues/111)) ([d0628de](https://github.com/pprb/tankobon/commit/d0628de333befcf040d60e1d8b8852351ac074e8))
* **comic:** close the decoder archive when comic:open fails after opening it ([#110](https://github.com/pprb/tankobon/issues/110)) ([77ed34f](https://github.com/pprb/tankobon/commit/77ed34f099210eb21c28378252c8138ff6bc36b3))
* **data:** roll back optimistic writes that the main process refuses ([#115](https://github.com/pprb/tankobon/issues/115)) ([0ca40c7](https://github.com/pprb/tankobon/commit/0ca40c7d0715631aed1adb904d0364e27259beaf))
* **db:** make clear() and metadata updates atomic, tolerate bad settings rows ([#116](https://github.com/pprb/tankobon/issues/116)) ([92e2099](https://github.com/pprb/tankobon/commit/92e2099b6c561bef639ef7995a059a86762a0da7))
* **import:** only accept absolute paths of supported comics ([#117](https://github.com/pprb/tankobon/issues/117)) ([67f916c](https://github.com/pprb/tankobon/commit/67f916c31b191e7d914bf18c6e04d4a89f0c15fe))
* **library:** treat names starting with two dots as inside their folder ([#113](https://github.com/pprb/tankobon/issues/113)) ([530319a](https://github.com/pprb/tankobon/commit/530319a54b31ee3b51d43d959bee550a37fd8c67))
* **metadata:** cap response sizes and refuse redirects to another site ([#119](https://github.com/pprb/tankobon/issues/119)) ([3964b82](https://github.com/pprb/tankobon/commit/3964b826d7c207f5069f21609745c8aab1eff0e8))
* **reader:** flush the continuous reader's pending progress when it closes ([#114](https://github.com/pprb/tankobon/issues/114)) ([3593d47](https://github.com/pprb/tankobon/commit/3593d47edccc6f54e0eeb28d3ffcdf04be246920))
* **reader:** key the upscaler cache by page, not by blob URL ([#124](https://github.com/pprb/tankobon/issues/124)) ([edae8d7](https://github.com/pprb/tankobon/commit/edae8d737a5e64c0be26e83719fd77335b5ba1dc))
* **reader:** release continuous-mode pages that are far from the viewport ([#123](https://github.com/pprb/tankobon/issues/123)) ([523f56d](https://github.com/pprb/tankobon/commit/523f56d8c1eac3826a1a9e61bc8c5847bda10c5b))


### Performance Improvements

* **achievements:** stop recounting at every page turn ([#125](https://github.com/pprb/tankobon/issues/125)) ([897102b](https://github.com/pprb/tankobon/commit/897102b5f28864ad83cc8635b3bf7e03f9e452a3))


### Documentation

* update the dependency audit section ([#121](https://github.com/pprb/tankobon/issues/121)) ([bfedb20](https://github.com/pprb/tankobon/commit/bfedb20f41634cb4475ddbffca901af6e633e3c8))

## [0.7.0](https://github.com/pprb/tankobon/compare/v0.6.0...v0.7.0) (2026-10-12)


### Features

* **home:** add a continue reading block ([#102](https://github.com/pprb/tankobon/issues/102)) ([e588f18](https://github.com/pprb/tankobon/commit/e588f181936299fbce115952afac09a0adbc42e9))
* **home:** add an empty home page shown at start-up ([#101](https://github.com/pprb/tankobon/issues/101)) ([0230102](https://github.com/pprb/tankobon/commit/0230102c04b40a2336e5874c21428a10298b8753))
* **home:** choose the home page's sections and order in the settings ([#107](https://github.com/pprb/tankobon/issues/107)) ([3d34a00](https://github.com/pprb/tankobon/commit/3d34a0073f320a69b5dff0acaad9c418a9eb1bca))
* **home:** list the 5 most recently added books ([#103](https://github.com/pprb/tankobon/issues/103)) ([968304c](https://github.com/pprb/tankobon/commit/968304cbe1f1db4a2abf65b1ee18e0b32dfaf335))
* **home:** list the lowest-rated books to give them a second chance ([#108](https://github.com/pprb/tankobon/issues/108)) ([d848cb0](https://github.com/pprb/tankobon/commit/d848cb025493849aa4751b6e3494235f8a19b0e0))
* **home:** set how many books each section shows, with arrows and hide-when-empty ([#109](https://github.com/pprb/tankobon/issues/109)) ([772756f](https://github.com/pprb/tankobon/commit/772756fa64fe399516ca7c4b42f53a8520f7ae93))
* **home:** suggest five random unread books ([#104](https://github.com/pprb/tankobon/issues/104)) ([a28cf25](https://github.com/pprb/tankobon/commit/a28cf2552fcaa1d368feea038c25ec7410203b57))
* **home:** suggest the five best-rated books to rediscover ([#106](https://github.com/pprb/tankobon/issues/106)) ([db538f4](https://github.com/pprb/tankobon/commit/db538f46627245fe62f7beeb9e073c5f01507411))


### Bug Fixes

* **reader:** find the continuous scroll area by its role in the e2e tests ([#99](https://github.com/pprb/tankobon/issues/99)) ([c4a2e97](https://github.com/pprb/tankobon/commit/c4a2e979828d9f9521da42d3461e438f21b5a568))

## [0.6.0](https://github.com/pprb/tankobon/compare/v0.5.0...v0.6.0) (2026-10-11)


### Features

* **app:** check for a newer release at startup ([#84](https://github.com/pprb/tankobon/issues/84)) ([fef6c07](https://github.com/pprb/tankobon/commit/fef6c07fcfbffded62ff0c30ffbba1f52e6371a2))
* **app:** show a loader while the application starts ([#87](https://github.com/pprb/tankobon/issues/87)) ([f9ed33e](https://github.com/pprb/tankobon/commit/f9ed33ee051df3fb4f89cdc1a63b2480499437d9))
* **library:** choose the organized folder's tree ([#94](https://github.com/pprb/tankobon/issues/94)) ([f7e6b06](https://github.com/pprb/tankobon/commit/f7e6b064a51049f742b3ea9a5e7ba58f0ea6cd1c))
* **library:** group the library list by series ([#92](https://github.com/pprb/tankobon/issues/92)) ([636ee86](https://github.com/pprb/tankobon/commit/636ee865c25d751f9dca3e0922b4205d653fd0f9))
* **library:** move added comics into an organized folder ([#89](https://github.com/pprb/tankobon/issues/89)) ([025a2e1](https://github.com/pprb/tankobon/commit/025a2e1d34c328b828f1fdca30758382711d7c4d))
* **library:** rename organized files from a template of metadata fields ([#98](https://github.com/pprb/tankobon/issues/98)) ([37d7f35](https://github.com/pprb/tankobon/commit/37d7f352428cc94bc7ce5406a5e714b7a853b27b))
* **library:** sort the library by date added, release date or title ([#95](https://github.com/pprb/tankobon/issues/95)) ([2fe058a](https://github.com/pprb/tankobon/commit/2fe058ae9a161a9c1c2764474c82454c0d407855))
* **lists:** add a whole series or a selection of books to a reading list ([#93](https://github.com/pprb/tankobon/issues/93)) ([4d0f9b9](https://github.com/pprb/tankobon/commit/4d0f9b91583349754ca6d27be2b625bf5af7eec1))
* **lists:** offer the library's display modes on a reading list's page ([#97](https://github.com/pprb/tankobon/issues/97)) ([82e1bf9](https://github.com/pprb/tankobon/commit/82e1bf91dacee364dc7c3fcbc44c6f2270af75c4))
* **reader:** resize pages in continuous scroll mode ([#83](https://github.com/pprb/tankobon/issues/83)) ([695ba4d](https://github.com/pprb/tankobon/commit/695ba4d0dcd07ab6bd476229c74ed3046fc87e96))
* **settings:** add the MIT license file and a license section to About ([#96](https://github.com/pprb/tankobon/issues/96)) ([ac5b48a](https://github.com/pprb/tankobon/commit/ac5b48adea36b91a5fdbd00311c49665d7da2507))


### Bug Fixes

* **library:** align the rating filter and view picker heights with the search field ([#91](https://github.com/pprb/tankobon/issues/91)) ([5531336](https://github.com/pprb/tankobon/commit/55313362d455518aa8e09ae82ba4a837c4253bd7))


### Performance Improvements

* **reader:** cache and prefetch rendered PDF pages ([#85](https://github.com/pprb/tankobon/issues/85)) ([3abea33](https://github.com/pprb/tankobon/commit/3abea33ebb9931426325283b44f5be1db25234f9))

## [0.5.0](https://github.com/pprb/tankobon/compare/v0.4.0...v0.5.0) (2026-10-06)


### Features

* **achievements:** add achievements with manga-style badges and unlock toasts ([#81](https://github.com/pprb/tankobon/issues/81)) ([3ac6ca1](https://github.com/pprb/tankobon/commit/3ac6ca11cd4b60cb617b0502892b70f455fa7b36))
* **app:** add the application icon ([#79](https://github.com/pprb/tankobon/issues/79)) ([92e5b74](https://github.com/pprb/tankobon/commit/92e5b747cc0986ad21ac1576f825067d318109e9))
* **app:** replace the default menu bar with a minimal translated one ([#80](https://github.com/pprb/tankobon/issues/80)) ([87fff94](https://github.com/pprb/tankobon/commit/87fff94e03278c3fa194d2d853db9002289e5681))
* **i18n:** show country flags in language pickers and book languages ([#82](https://github.com/pprb/tankobon/issues/82)) ([89fa8cf](https://github.com/pprb/tankobon/commit/89fa8cf319e6fdb8f31104587346560ccc566b7c))
* **library:** add full, medium and compact display modes ([#74](https://github.com/pprb/tankobon/issues/74)) ([be4ef08](https://github.com/pprb/tankobon/commit/be4ef0881268becad7c48b83d612b7c0b0920c92))
* **library:** measure average page size in the background ([#75](https://github.com/pprb/tankobon/issues/75)) ([84f382c](https://github.com/pprb/tankobon/commit/84f382c6ce0c0ac3669666b16f3b4362e39938e3))
* **library:** resync also checks files added individually ([#73](https://github.com/pprb/tankobon/issues/73)) ([0b8ee57](https://github.com/pprb/tankobon/commit/0b8ee5792ddab2b2fb28d4e2742136f62f9e395b))
* **reader:** offer to remove a library book that fails to open ([#72](https://github.com/pprb/tankobon/issues/72)) ([b5d2bbe](https://github.com/pprb/tankobon/commit/b5d2bbe5bd0ec91ca5c20becd7f00b34c308c5dd))
* **stats:** add a reading statistics page ([#77](https://github.com/pprb/tankobon/issues/77)) ([bfa718f](https://github.com/pprb/tankobon/commit/bfa718f1a615b59e3e6268b65c64d73460eace02))


### Bug Fixes

* **reader:** start a zoomed page at its top or bottom edge after a page turn ([#76](https://github.com/pprb/tankobon/issues/76)) ([692ba36](https://github.com/pprb/tankobon/commit/692ba36005ccd6b83c009653d829e077726c8493))

## [0.4.0](https://github.com/pprb/tankobon/compare/v0.3.0...v0.4.0) (2026-10-04)


### Features

* **db:** versioned schema migrations with PRAGMA user_version ([#54](https://github.com/pprb/tankobon/issues/54)) ([086f981](https://github.com/pprb/tankobon/commit/086f981cd4d5b4b0f1cc767c73cf848a85a365b8))
* **decoder:** decode comic files in a utility process ([#56](https://github.com/pprb/tankobon/issues/56)) ([640d119](https://github.com/pprb/tankobon/commit/640d1196a001cfffce1354cc1d81248f6df60693))
* **ipc:** validate renderer arguments and stop taking paths from it ([#53](https://github.com/pprb/tankobon/issues/53)) ([9a77747](https://github.com/pprb/tankobon/commit/9a777470e07412782b9b9e3f775bcbb4c591e161))
* **library:** add a drag handle to library rows ([#66](https://github.com/pprb/tankobon/issues/66)) ([caaba2a](https://github.com/pprb/tankobon/commit/caaba2a0b9a41c7d9989f01bafc30c89bb6ea73e))
* **library:** confirm before removing a book ([#46](https://github.com/pprb/tankobon/issues/46)) ([82fada0](https://github.com/pprb/tankobon/commit/82fada068d3bd22f6600659f556b89ad6443b6f2))
* **library:** let the user close the scan progress bar ([#63](https://github.com/pprb/tankobon/issues/63)) ([3a4ccaf](https://github.com/pprb/tankobon/commit/3a4ccafbd69e5a4c7786321fb07c0075e13f4487))
* **library:** open the add-folder dialog in the previously scanned directory ([#62](https://github.com/pprb/tankobon/issues/62)) ([fe0dc55](https://github.com/pprb/tankobon/commit/fe0dc551bdef71e520d85d68bc8139242b771c23))
* **library:** resynchronize the library with its folders ([#67](https://github.com/pprb/tankobon/issues/67)) ([72ca859](https://github.com/pprb/tankobon/commit/72ca8597e5477b0c18b993958f3b64fe513c30dc))
* **library:** show the file format (CBZ, CBR, PDF) in the library ([#65](https://github.com/pprb/tankobon/issues/65)) ([79e346c](https://github.com/pprb/tankobon/commit/79e346cf6f925f9286e1d23704ee7003d4eef047))
* **reader:** option to add opened books to the library, anonymous reading otherwise ([#64](https://github.com/pprb/tankobon/issues/64)) ([6fb93bd](https://github.com/pprb/tankobon/commit/6fb93bd3aa1c15541af114cf4decca1d2d18ee64))
* **renderer:** single data store fed by a data:changed push, virtualized library ([#59](https://github.com/pprb/tankobon/issues/59)) ([6717519](https://github.com/pprb/tankobon/commit/6717519e3c771fb226e4b46f94995d4ce1f56302))
* **ui:** confirm destructive actions in an in-app dialog ([#71](https://github.com/pprb/tankobon/issues/71)) ([1178b45](https://github.com/pprb/tankobon/commit/1178b45da4ccf8fd1a5ac2ff2d7bdd8d05854cb2))


### Bug Fixes

* **archive:** refuse images with huge dimensions before decoding them ([#55](https://github.com/pprb/tankobon/issues/55)) ([27682c5](https://github.com/pprb/tankobon/commit/27682c531d491fe474d17fe6cd972102af3b79e2))
* **data:** report export and clear failures to the user ([#43](https://github.com/pprb/tankobon/issues/43)) ([145fed1](https://github.com/pprb/tankobon/commit/145fed1111376ab428a572e44b12d5b40d7a791e))
* **db:** run the JSON import and multi-statement writes in transactions ([#39](https://github.com/pprb/tankobon/issues/39)) ([5845aa6](https://github.com/pprb/tankobon/commit/5845aa6c78193a0b3a0d2ce375722b0e194ac3c9))
* **ipc:** validate renderer arguments in the main process ([#49](https://github.com/pprb/tankobon/issues/49)) ([da2d9c3](https://github.com/pprb/tankobon/commit/da2d9c39376d459484f56bcd88fc35101ab0a4ad))
* **library:** add a single file to the library without opening the reader ([#69](https://github.com/pprb/tankobon/issues/69)) ([21dba9b](https://github.com/pprb/tankobon/commit/21dba9b6a29bb20c8e6cbfed68fe17c9b343b90d))
* **lists:** reset the reading list page when switching lists ([#38](https://github.com/pprb/tankobon/issues/38)) ([62350b3](https://github.com/pprb/tankobon/commit/62350b3f635a050eb81551b5a126e183da4b9ab6))
* **pdf:** cap the rendered page size ([#40](https://github.com/pprb/tankobon/issues/40)) ([624a5bc](https://github.com/pprb/tankobon/commit/624a5bcfb9fb8050c2661a5711f8709f0a7ec373))
* **pdf:** make pdf.js run its Node code paths in the decoder process ([#70](https://github.com/pprb/tankobon/issues/70)) ([04c145f](https://github.com/pprb/tankobon/commit/04c145f8ff80d17050cb5971bee2a27b428a43bf))
* **reader:** close an archive opened after the reader left or switched books ([#42](https://github.com/pprb/tankobon/issues/42)) ([a8138a0](https://github.com/pprb/tankobon/commit/a8138a059a2215d384f096bb6bff7d8caf2fd384))
* **reader:** keep the UI responsive during AI upscaling ([#60](https://github.com/pprb/tankobon/issues/60)) ([9f8b37e](https://github.com/pprb/tankobon/commit/9f8b37e2367f44dde468413a4476af5a448b3413))
* **reader:** keep the zoomed page centered when smaller than the viewport ([#61](https://github.com/pprb/tankobon/issues/61)) ([bfa8342](https://github.com/pprb/tankobon/commit/bfa8342adfbc9e9f75622f1e792be8b0da1aca26))
* **reader:** show a French message when a book cannot be opened ([#44](https://github.com/pprb/tankobon/issues/44)) ([3eb0455](https://github.com/pprb/tankobon/commit/3eb0455c3c4dfbdbbef2ea188983ec0fc4d253f3))
* **reader:** track the active page in continuous mode whatever its height ([#36](https://github.com/pprb/tankobon/issues/36)) ([ba75a66](https://github.com/pprb/tankobon/commit/ba75a660d947e0c9f51c5dda1f80bb3da84c4706))
* **security:** block navigation, new windows and file drops on the main window ([#37](https://github.com/pprb/tankobon/issues/37)) ([7c49795](https://github.com/pprb/tankobon/commit/7c4979559f547b514cf956c25fae3a7fc361ce46))
* **settings:** reload every settings view after an import ([#48](https://github.com/pprb/tankobon/issues/48)) ([7ff21cd](https://github.com/pprb/tankobon/commit/7ff21cd617818f185e0ba7097b2c91b7c9e94870))
* **thumbnails:** queue thumbnail removal behind a running generation ([#57](https://github.com/pprb/tankobon/issues/57)) ([eddd15e](https://github.com/pprb/tankobon/commit/eddd15eab078ac5f7c639710330d6123c7bba209))

## [0.3.0](https://github.com/pprb/tankobon/compare/v0.2.1...v0.3.0) (2026-10-02)


### Features

* **data:** add a button to clear the library ([#25](https://github.com/pprb/tankobon/issues/25)) ([8f59797](https://github.com/pprb/tankobon/commit/8f5979714b7df104d7ba87f740f7c35dadd316a4))
* **data:** add the time to the export's default file name ([#28](https://github.com/pprb/tankobon/issues/28)) ([fe6a855](https://github.com/pprb/tankobon/commit/fe6a85563d3c574c7cebec92a0b8c7b66ddb57ee))
* **i18n:** translate the interface into English and French ([#35](https://github.com/pprb/tankobon/issues/35)) ([785fd5a](https://github.com/pprb/tankobon/commit/785fd5a0957ec279f9f4721e09431a976882d85f))
* **library:** edit a book's information by hand ([#26](https://github.com/pprb/tankobon/issues/26)) ([a38f74f](https://github.com/pprb/tankobon/commit/a38f74f3322d6b807974ef016027d7d64a8d3a55))
* **library:** show cover thumbnails for books ([#22](https://github.com/pprb/tankobon/issues/22)) ([65c8bab](https://github.com/pprb/tankobon/commit/65c8bab9de0d2a905dabf3844e00700ee86645ab))
* **lists:** add a book to a reading list by dragging it from the library ([#29](https://github.com/pprb/tankobon/issues/29)) ([ed2e481](https://github.com/pprb/tankobon/commit/ed2e4819cbfa619b96c825ccaaabc010a9e6147b))
* **lists:** add reading lists ([#21](https://github.com/pprb/tankobon/issues/21)) ([301cf1a](https://github.com/pprb/tankobon/commit/301cf1ac193ac4fdca3744cf658ea5b366222342))
* **lists:** reorder reading lists by drag and drop in the sidebar ([#27](https://github.com/pprb/tankobon/issues/27)) ([a1ba051](https://github.com/pprb/tankobon/commit/a1ba05178a31bed3b0f4fcff82a118ecaa32822a))
* **lists:** show reading lists in the sidebar ([#24](https://github.com/pprb/tankobon/issues/24)) ([03c047f](https://github.com/pprb/tankobon/commit/03c047f1a4812a35f4752dd2bddf6af78f587e8a))
* **settings:** add an "À propos" section with versions and project links ([#30](https://github.com/pprb/tankobon/issues/30)) ([906b4ac](https://github.com/pprb/tankobon/commit/906b4aca6106de17b269c2c8b70feb48339964de))
* **ui:** show the hand cursor on clickable controls ([#31](https://github.com/pprb/tankobon/issues/31)) ([1040202](https://github.com/pprb/tankobon/commit/1040202cfbad81f5e061c188cfb92ac15ed97c09))


### Bug Fixes

* **library:** use the move pointer when dragging a book onto a reading list ([#33](https://github.com/pprb/tankobon/issues/33)) ([8f90025](https://github.com/pprb/tankobon/commit/8f90025419c8f7ca0022f10118364465a615c4b7))

## [0.2.1](https://github.com/pprb/tankobon/compare/v0.2.0...v0.2.1) (2026-10-01)


### Bug Fixes

* **build:** name the Linux executable after the package name ([#19](https://github.com/pprb/tankobon/issues/19)) ([61e5274](https://github.com/pprb/tankobon/commit/61e5274084ea709c47a3cfa97246c8c24cddbfba))

## [0.2.0](https://github.com/pprb/tankobon/compare/v0.1.1...v0.2.0) (2026-10-01)


### Features

* **library:** look up book metadata in Comic Vine and Google Books ([#15](https://github.com/pprb/tankobon/issues/15)) ([2ca3afb](https://github.com/pprb/tankobon/commit/2ca3afbbda0908e115004d7ac9004c0c2f851431))
* **library:** read book metadata from a pasted Bédéthèque album link ([#18](https://github.com/pprb/tankobon/issues/18)) ([186a380](https://github.com/pprb/tankobon/commit/186a380ba75e3d6a9a6bb1e78f3f43eb4eca7e17))


### Bug Fixes

* force LF line endings in every file ([#14](https://github.com/pprb/tankobon/issues/14)) ([dd773ba](https://github.com/pprb/tankobon/commit/dd773ba4ce2898954ed13093874679c20f18167b))


### Documentation

* **adr:** confirm rationale and alternatives of ADRs 0001, 0002 and 0004 ([#12](https://github.com/pprb/tankobon/issues/12)) ([47ea932](https://github.com/pprb/tankobon/commit/47ea9327523be1ddbfc7c9f2cb2a41290fd61326))
* **preload:** declare window.tankobon as documented interfaces ([#11](https://github.com/pprb/tankobon/issues/11)) ([0a15739](https://github.com/pprb/tankobon/commit/0a15739f9a278903204d4046fb41e557368ff60c))

## [0.1.1](https://github.com/pprb/tankobon/compare/v0.1.0...v0.1.1) (2026-09-30)


### Bug Fixes

* **cbr:** keep reading a CBR after another one was opened ([#9](https://github.com/pprb/tankobon/issues/9)) ([a0cb56d](https://github.com/pprb/tankobon/commit/a0cb56d33c1641c90b407560973c3e15abf2b8e3))
* **deps:** update dependencies and clear the npm audit findings ([#10](https://github.com/pprb/tankobon/issues/10)) ([a58cab5](https://github.com/pprb/tankobon/commit/a58cab5797ef1e6416e5250a0d88ac6edf2f086b))


### Documentation

* set up maintainable documentation ([#2](https://github.com/pprb/tankobon/issues/2)) ([f3d5d64](https://github.com/pprb/tankobon/commit/f3d5d640196abb089d92cc91a0c89319a70ed32a))

## 0.1.0

Initial version, released before the adoption of Conventional Commits (history up to `5db3ea8`): its changes are not listed.
