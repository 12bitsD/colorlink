# Independent releases

Each app owns its version in `apps/<app>/package.json`. Shared packages are included in an app artifact when needed; a shared change does not require an unrelated app release.

## Tags

```text
clock-v<version>
calendar-v<version>
notes-v<version>
```

Example:

```sh
git tag clock-v0.1.0
git push origin clock-v0.1.0
```

The release workflow runs tests, packages that app with `agent-core` and `design-system`, and creates a GitHub Release with a ZIP asset. A tag for an app without `index.html` fails rather than publishing a placeholder.

The first Clock artifact is a browser prototype, not an APK. Android artifacts should use the same app-specific tags once native builds exist.
