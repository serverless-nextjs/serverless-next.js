const path = require('path')
const chokidar = require('chokidar')
const chalk = require('chalk')
const args = require('minimist')(process.argv.slice(2))
const { utils } = require('@serverless/core')
const cliVersion = require('../package.json').version
const coreVersion = require('@serverless/core/package.json').version
const processBackendNotificationRequest = require('@serverless/utils/process-backend-notification-request')
const Context = require('./Context')
const generateNotifiationsPayload = require('./notifications/generate-payload')
const requestNotification = require('./notifications/request')

const getServerlessFile = (dir) => {
  const jsFilePath = path.join(dir, 'serverless.js')
  const ymlFilePath = path.join(dir, 'serverless.yml')
  const yamlFilePath = path.join(dir, 'serverless.yaml')
  const jsonFilePath = path.join(dir, 'serverless.json')

  if (utils.fileExistsSync(jsFilePath)) {
    delete require.cache[require.resolve(jsFilePath)]
    return require(jsFilePath)
  }

  try {
    if (utils.fileExistsSync(ymlFilePath)) {
      return utils.readFileSync(ymlFilePath)
    }
    if (utils.fileExistsSync(yamlFilePath)) {
      return utils.readFileSync(yamlFilePath)
    }
  } catch (e) {
    // todo currently our YAML parser does not support
    // CF schema (!Ref for example). So we silent that error
    // because the framework can deal with that
    if (e.name !== 'YAMLException') {
      throw e
    }
    return false
  }

  if (utils.fileExistsSync(jsonFilePath)) {
    return utils.readFileSync(jsonFilePath)
  }

  return false
}

const isComponentsTemplate = (serverlessFile) => {
  if (typeof serverlessFile !== 'object') {
    return false
  }

  // make sure it's NOT a framework file
  if (serverlessFile.provider && serverlessFile.provider.name) {
    return false
  }

  // make sure it IS a components file
  for (const key in serverlessFile) {
    if (serverlessFile[key] && serverlessFile[key].component) {
      return true
    }
  }

  return false
}

const isComponentsFile = (serverlessFile) => {
  if (typeof serverlessFile === 'function' || isComponentsTemplate(serverlessFile)) {
    return true
  }
  return false
}
// // needs to be a sync function to work simply with v1
const runningComponents = () => {
  const serverlessFile = getServerlessFile(process.cwd())

  if (serverlessFile && isComponentsFile(serverlessFile)) {
    return true
  }

  return false
}

const watch = (component, inputs, method, context) => {
  let isProcessing = false
  let queuedOperation = false
  let outputs
  const directory = process.cwd()
  const directoryName = path.basename(directory)
  const watcher = chokidar.watch(directory, { ignored: /\.serverless/ })

  watcher.on('ready', async () => {
    component.context.instance._.useTimer = false
    component.context.instance.renderStatus('Watching', directoryName)

    // UNCOMMENT if we wanna start with deployment before watching

    // try {
    //   if (method) {
    //     outputs = await component[method](inputs)
    //   } else {
    //     outputs = await component(inputs)
    //   }
    //   component.context.instance.renderOutputs(outputs)
    //   component.context.instance._.useTimer = false
    //   component.context.instance.renderStatus('Watching', directoryName)
    // } catch (e) {
    //   component.context.instance.renderError(e)
    //   component.context.instance._.useTimer = false
    //   component.context.instance.renderStatus('Watching', directoryName)
    // }
  })

  watcher.on('change', async () => {
    component.context.instance._.useTimer = true
    try {
      if (isProcessing && !queuedOperation) {
        queuedOperation = true
      } else if (!isProcessing) {
        // perform operation
        isProcessing = true

        const serverlessFile = getServerlessFile(process.cwd())

        let Component
        if (isComponentsTemplate(serverlessFile)) {
          Component = require('@serverless/template')
          inputs.template = serverlessFile
        } else {
          Component = serverlessFile
        }

        component = new Component(undefined, context)
        await component.init()

        component.context.instance._.seconds = 0
        if (method) {
          outputs = await component[method](inputs)
        } else {
          outputs = await component(inputs)
        }
        // check if another operation is queued
        if (queuedOperation) {
          component.context.instance._.seconds = 0
          if (method) {
            outputs = await component[method](inputs)
          } else {
            outputs = await component(inputs)
          }
        }
        // reset everything
        isProcessing = false
        queuedOperation = false
        component.context.instance.renderOutputs(outputs)

        component.context.instance._.useTimer = false
        component.context.instance.renderStatus('Watching', directoryName)
      }
    } catch (e) {
      isProcessing = false
      queuedOperation = false
      component.context.instance.renderError(e)
      component.context.instance._.useTimer = false
      component.context.instance.renderStatus('Watching', directoryName)
    }
  })
}

const runComponents = async (serverlessFileArg) => {
  const serverlessFile = serverlessFileArg || getServerlessFile(process.cwd())

  if (!serverlessFile || !isComponentsFile(serverlessFile)) {
    return
  }

  const method = args._[0] || undefined
  const inputs = args
  delete inputs._ // remove the method name if any

  let Component
  if (isComponentsTemplate(serverlessFile)) {
    Component = require('@serverless/template')
    inputs.template = serverlessFile
  } else {
    Component = serverlessFile
  }

  const config = {
    root: process.cwd(),
    stateRoot: path.join(process.cwd(), '.serverless'),
    debug: inputs.debug,
    entity: serverlessFile.name // either the name prop of the yaml, or class name of js
  }

  const context = new Context(config)

  try {
    const component = new Component(undefined, context)
    await component.init()

    if (inputs.watch) {
      delete inputs.watch // remove it so that it doesn't pass as an input
      return watch(component, inputs, method, context)
    }

    let outputs
    const deferredNotificationsData = method
      ? null
      : requestNotification(
          Object.assign(generateNotifiationsPayload(serverlessFile), { command: 'deploy' })
        )

    if (method) {
      if (typeof component[method] !== 'function') {
        throw Error(`  method ${method} not found`)
      }
      outputs = await component[method](inputs)
    } else {
      outputs = await component(inputs)
    }

    context.renderOutputs(outputs)
    if (deferredNotificationsData) {
      const notification = processBackendNotificationRequest(await deferredNotificationsData)
      if (notification) {
        const borderLength = Math.min(notification.message.length, process.stdout.columns - 2)
        context.log(
          `${'*'.repeat(borderLength)}\n  ${chalk.bold(notification.message)}\n  ${'*'.repeat(
            borderLength
          )}\n`
        )
      }
    }
    context.close('done')
  } catch (e) {
    context.renderError(e)
    context.close('error', e)
  }
}

module.exports = { runningComponents, runComponents, cliVersion, coreVersion }
