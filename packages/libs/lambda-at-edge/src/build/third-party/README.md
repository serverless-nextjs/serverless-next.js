## Third party integrations

This will support common third-party integrations such as `next-i18next`. The integrations here are meant to auto-detect what your project is using and copy the default expected files to the build artifacts.

Currently there is no way to customize the behavior of these integrations, so if you have custom settings (e.g different settings/paths of files to copy than the integration expects), then you will need to write your own command in `postBuildCommands` to copy them.

### next-i18next

This integration will copy `next-i18next.config.js` and `public/locales` (default locale path per `next-i18next`).

Note that if you have custom paths, you will need to write your own `postBuildCommands` to copy the files yourself.
