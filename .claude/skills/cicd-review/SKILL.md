---
name: cicd-review
description: >
  Review CI/CD pipeline changes. Checks secrets handling, OIDC, version pinning,
  security scanning, artifact signing, and deployment safety gates.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# CI/CD Review

Review pipeline changes in: $ARGUMENTS

## Checklist

- [ ] No hardcoded secrets in workflow files
- [ ] Actions pinned to SHA or specific version (not @main)
- [ ] OIDC preferred over long-lived tokens
- [ ] Security scanning steps present and not skipped
- [ ] Staging before production deployment
- [ ] Manual approval for production
- [ ] Rollback mechanism defined
- [ ] SBOM generation if applicable

## Output

Save to `<output_dir>/cicd.md` with Finding/Risk/Recommendation format.
