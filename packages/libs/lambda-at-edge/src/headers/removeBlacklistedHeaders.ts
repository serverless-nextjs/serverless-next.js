// Blacklisted or read-only headers in CloudFront
import { CloudFrontHeaders } from "aws-lambda";

const blacklistedHeaders = [
  "connection",
  "expect",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "trailer",
  "upgrade",
  "x-accel-buffering",
  "x-accel-charset",
  "x-accel-limit-rate",
  "x-accel-redirect",
  "x-cache",
  "x-forwarded-proto",
  "x-real-ip"
];

const blacklistedHeaderPrefixes = ["x-amz-cf-", "x-amzn-", "x-edge-"];

export function isBlacklistedHeader(name: string): boolean {
  const lowerCaseName = name.toLowerCase();

  for (const prefix of blacklistedHeaderPrefixes) {
    if (lowerCaseName.startsWith(prefix)) {
      return true;
    }
  }

  return blacklistedHeaders.includes(lowerCaseName);
}

export function removeBlacklistedHeaders(headers: CloudFrontHeaders): void {
  for (const header in headers) {
    if (isBlacklistedHeader(header)) {
      delete headers[header];
    }
  }
}
