# Development Release Guide

This document describes the release workflow for the simple-rpc-ai-backend package.

## Release Workflow

The project follows a Git Flow-inspired workflow:

1. All development happens on the `develop` branch
2. When ready for a release, merge `develop` into `next` to create pre-release versions
3. After testing pre-releases, create a PR from `next` to `master` for final release

## Branch Strategy

- `develop`: Active development branch
- `next`: Pre-release testing branch (for beta/rc releases)
- `master`: Production-ready code for official releases

## Local Release Process

### Prerequisites

1. Ensure you have an npm account and are authorized to publish to the package
2. Generate a GitHub personal access token with appropriate permissions
3. Have access to your authenticator app for 2FA codes

### For Official Release (master branch)

1. **Switch to master branch and ensure it's up-to-date:**
   ```bash
   git checkout master
   git pull origin master
   ```

2. **Login to npm:**
   ```bash
   npm login
   ```
   Follow the prompts to enter your npm credentials.

3. **Set your GitHub token:**
   ```bash
   export GITHUB_TOKEN=your_github_token_here
   ```
   Replace `your_github_token_here` with your actual GitHub personal access token.

4. **Perform the release:**
   ```bash
   npm_config_OTP=<your-6-digit-otp> pnpm release --ci false
   ```
   Replace `<your-6-digit-otp>` with the current code from your authenticator app.

### For Pre-Release (next branch)

1. **Switch to next branch and ensure it's up-to-date:**
   ```bash
   git checkout next
   git pull origin next
   ```

2. **Login to npm:**
   ```bash
   npm login
   ```
   Follow the prompts to enter your npm credentials.

3. **Set your GitHub token:**
   ```bash
   export GITHUB_TOKEN=your_github_token_here
   ```
   Replace `your_github_token_here` with your actual GitHub personal access token.

4. **Perform the pre-release:**
   ```bash
   npm_config_OTP=<your-6-digit-otp> pnpm release:next --ci false
   ```
   Replace `<your-6-digit-otp>` with the current code from your authenticator app.

## Complete Development-to-Release Process

1. **Development Phase**
   - Work on features/fixes in feature branches from `develop`
   - Merge completed work back to `develop`

2. **Pre-Release Testing Phase**
   - When features are ready, merge `develop` into `next`
   - Release to npm using the pre-release process above
   - Test the pre-release in various environments
   - Fix issues on `develop` and merge to `next` as needed

3. **Final Release Phase**
   - When pre-release is stable, create a PR from `next` to `master`
   - Review and merge the PR
   - Release to npm using the official release process above

4. **Post-Release Merge Back**
   - After releasing from `master`, merge `master` back into `develop` to sync version bumps and changelog updates
   - **Important**: Before merging, ensure there are no conflicts between release commits and ongoing development
   - If conflicts occur, resolve them carefully, prioritizing release-related changes (like version numbers) from `master`
   - Command: `git checkout develop && git merge master`
   - If conflicts arise, use: `git checkout develop && git merge --no-ff master` and resolve conflicts manually

## Release Notes

- Semantic versioning follows conventional commits (feat → minor, fix → patch, breaking changes → major)
- The `next` branch uses `prerelease` tags for npm packages
- Official releases go to the `latest` tag on npm
- GitHub releases are automatically created during the release process