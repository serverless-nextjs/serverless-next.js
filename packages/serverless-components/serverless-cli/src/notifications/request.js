const notificationsUrl = require('@serverless/utils/analytics-and-notfications-url')

module.exports = async (payload) => {
  if (!notificationsUrl) {
    return null
  }

  const http = notificationsUrl.startsWith('http:') ? require('http') : require('https')

  const requestBody = JSON.stringify(payload)

  return new Promise((resolve) => {
    const request = http.request(
      notificationsUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': requestBody.length
        }
      },
      (response) => {
        if (response.statusCode !== 200) {
          // ignore errors
          resolve(null)
          return
        }
        let responseBody = ''
        response.on('data', (chunk) => (responseBody += chunk))
        response.on('error', () => {
          resolve(null)
        })
        response.on('end', () => {
          resolve(
            (() => {
              try {
                return JSON.parse(responseBody)
              } catch (error) {
                return null
              }
            })()
          )
        })
      }
    )
    request.on('error', () => {
      resolve(null)
    })

    request.write(requestBody)
    request.end()
  })
}
