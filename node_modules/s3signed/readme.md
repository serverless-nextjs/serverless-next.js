# s3signed

Generate a temporary signed URL for a private object on S3.

## Usage

First, confirm that your shell is configured with appropriate AWS credentials.

```
s3signed <s3 url> [seconds until expires]
```

- `s3url` must be of the form `s3://my-bucket/my/private/file`
- defaults to expire in 10 min if unspecified

## Example

```
# Copy the signed URL to the clipboard on OSX
$ s3signed s3://my-bucket/my/private/file 3600 | pbcopy
```
