---
name: kubernetes-review
description: >
  Review Kubernetes and Helm manifest changes. Analyzes replicas, resources,
  HPA, PDB, affinity, and service exposure with old→new comparisons.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# Kubernetes & Helm Review

Review K8s/Helm changes in: $ARGUMENTS

## Checklist

- [ ] Replica changes documented (old → new)
- [ ] CPU/memory requests and limits compared
- [ ] HPA configuration reviewed
- [ ] PDB won't block node maintenance
- [ ] Service exposure changes flagged
- [ ] Resource limits prevent noisy neighbor
- [ ] Anti-affinity for HA workloads

## Output

Save to `<output_dir>/kubernetes-helm.md` with resource change table and findings.
