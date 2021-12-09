## CI API

This is a locked down API meant to be used in CI workflows to post comments for pull requests, including forks.

Currently, it can only post a comment to a specific PR about size information. It requires basic auth with credentials visible to forks, just as a small step so that no one can randomly access it.

This is required since forks do not have access to a GITHUB_TOKEN secret that can post a comment.
