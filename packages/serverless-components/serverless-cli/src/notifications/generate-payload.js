const versions = {
  '@serverless/cli': require('../../package').version,
  '@serverless/core': require('@serverless/core/package').version,
  '@serverless/template': require('@serverless/template/package').version
}

module.exports = (config) => {
  return {
    cliName: '@serverless/cli',
    config: {
      components: Object.values(config)
        .map((value) =>
          value && typeof value.component === 'string' ? { component: value.component } : null
        )
        .filter(Boolean)
    },
    versions,
    isStandalone: Boolean(process.pkg),
    isDashboardEnabled: false
  }
}
