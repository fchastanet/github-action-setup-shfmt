# github-action-setup-shfmt

This action downloads [shfmt](https://github.com/mvdan/sh) binary and adds it
to the PATH.

## Inputs

| Name            | Type    | Description                                          |
| --------------- | ------- | ---------------------------------------------------- |
| `shfmt-version` | String  | The version to use or `latest` (default)             |
| `use-cache`     | Boolean | use github cache to store the binary (default: true) |
| `bin-dir`       | String  | Indicates the full path the binary directory         |
|                 |         | (Default: /usr/local/bin)                            |

## Outputs

## Example usage

To use the latest `shfmt`:

```yaml
steps:
  - uses: fchastanet/github-action-setup-shfmt@v1.0.0
  - run: shfmt -d script.bash
```

Or with a specific version:

```yaml
steps:
  - uses: fchastanet/github-action-setup-shfmt@v1.0.0
    with:
      shfmt-version: 3.3.1
  - run: shfmt -d script.bash
```
