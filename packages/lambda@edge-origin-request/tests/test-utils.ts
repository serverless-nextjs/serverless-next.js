import type { OriginRequestEvent } from '../src/index';

export const createCloudFrontEvent = ({ uri, host, origin }): OriginRequestEvent => ({
  Records: [
    {
      cf: {
        request: {
          method: 'GET',
          uri,
          clientIp: '1.2.3.4',
          querystring: '',
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
