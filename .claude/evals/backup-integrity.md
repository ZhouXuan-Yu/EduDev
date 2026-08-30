# Local backup integrity eval

## Capability

- Export creates `omni-edu-backup-manifest.v1.json` with bounded relative paths, byte sizes and SHA-256 hashes.
- Export immediately verifies its own result and returns `verified=true` only after readback.
- Verification reports missing, changed and unexpected files separately.

## Adversarial

- Destination inside the source data root is rejected before recursive copy.
- Tampering with a copied file is detected.
- Missing/invalid manifest and unsafe/duplicate entries fail closed.
- Manifest itself is excluded from the signed file set to avoid circular hashes.

## Evidence command

```text
npm run test:deeptutor-backup-integrity
```

Current result: 9/9 local deterministic cases. Automatic restore and cross-disk disaster recovery remain out of scope for this slice.
