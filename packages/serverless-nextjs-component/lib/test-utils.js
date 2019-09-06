const createCloudFrontEvent = ({ uri, host, origin }) => ({
  Records: [
    {
      cf: {
        request: {
          uri,
          headers: {
            host: [
              {
                key: "host",
                value: host
              }
            ]
          },
          origin
        }
      }
    }
  ]
});

module.exports = {
  createCloudFrontEvent
};
