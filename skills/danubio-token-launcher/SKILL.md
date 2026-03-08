---
name: danubio-token-launcher
description: Danubio token-launcher integration + live preflight checks for HyperEVM.
---

# Danubio Token Launcher

## Purpose

This skill wraps the Danubio launch contracts on HyperEVM and adds a safety check against live chain constraints.

Use it when you want to:
- launch a token via the KITTEN or WHYPE Danubio launcher
- check current launch fee
- check whether the tx fits under the current block gas limit
- parse token/pool addresses from launch receipts

## Contracts

- Chain: `999`
- RPC: `https://rpc.hyperliquid.xyz/evm`
- TokenLauncher (KITTEN): `0x2ccD3b07b105800480668C482625454E0e26ad27`
- TokenLauncher (WHYPE): `0x9005A8504069b1Bd94A98C64F447b93Ed742bF6c`
- KittenSwap Factory: `0x5f95E92c338e6453111Fc55ee66D4AafccE661A7`
- KittenSwap Router: `0x4e73E421480a7E0C24fB3c11019254edE194f736`
- KittenSwap Position Manager: `0x9ea4459c8DefBF561495d95414b9CF1E2242a3E2`
- KITTEN: `0x618275F8EFE54c2afa87bfB9F210A52F0fF89364`
- WHYPE: `0x5555555555555555555555555555555555555555`

## One-call launch ABI

```js
const launcher = new ethers.Contract(
  '0x2ccD3b07b105800480668C482625454E0e26ad27',
  ['function launch(string name, string symbol) external payable returns (address token, address pool)'],
  signer,
);
```

## CLI wrapper

### Preflight

```bash
node scripts/danubio_launch.mjs preflight --name Clawberto --symbol CLAW
node scripts/danubio_launch.mjs preflight --name Clawberto --symbol CLAW --launcher whype
node scripts/danubio_launch.mjs preflight --name Clawberto --symbol CLAW --json
```

### Launch

```bash
export HYPEREVM_EXEC_PRIVATE_KEY=0x...
node scripts/danubio_launch.mjs launch --name Clawberto --symbol CLAW
```

## Output states

- `SAFE_TO_SEND`
- `BLOCKED_BY_BLOCK_GAS_LIMIT`
- `BLOCKED_BY_INSUFFICIENT_NATIVE`
- `SUCCESS`
- `REVERTED`

## Current live note

The launcher contracts are real and verified, but live launchability depends on current HyperEVM block gas limits.

Observed on `2026-03-08`:
- block gas limit near `3,000,000`
- launcher estimates near `9.66M` gas
- fresh pool creation alone still estimates above `8.3M`

So at that test point, launch was blocked by chain conditions, not by contract address resolution or wallet setup.
