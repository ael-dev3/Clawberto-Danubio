# Clawberto-Danubio

Danubio token-launcher skill + preflight tooling for HyperEVM.

This repo now does two things:
- preserves the official one-call launcher integration data you sent
- adds a reality check before broadcast, because the current live HyperEVM block gas limit is lower than the launcher's required gas

## Contracts

HyperEVM — chain id `999`

- RPC: `https://rpc.hyperliquid.xyz/evm`
- TokenLauncher (KITTEN): `0x2ccD3b07b105800480668C482625454E0e26ad27`
- TokenLauncher (WHYPE): `0x9005A8504069b1Bd94A98C64F447b93Ed742bF6c`
- KittenSwap Factory: `0x5f95E92c338e6453111Fc55ee66D4AafccE661A7`
- KittenSwap Router: `0x4e73E421480a7E0C24fB3c11019254edE194f736`
- KittenSwap Position Manager: `0x9ea4459c8DefBF561495d95414b9CF1E2242a3E2`
- KITTEN: `0x618275F8EFE54c2afa87bfB9F210A52F0fF89364`
- WHYPE: `0x5555555555555555555555555555555555555555`

## Official launcher flow

```js
const launcher = new ethers.Contract(
  '0x2ccD3b07b105800480668C482625454E0e26ad27',
  ['function launch(string name, string symbol) external payable returns (address token, address pool)'],
  signer,
);

const tx = await launcher.launch('AgentToken', 'AGENT', { gasLimit: 10_000_000n });
const receipt = await tx.wait();
```

What it is supposed to do in one tx:
1. deploy 1B-supply ERC-20
2. create KittenSwap Algebra pool
3. seed 98% into LP
4. burn/lock LP position
5. send 2% creator allocation

## Live chain-status note

As tested live on `2026-03-08`, the contract addresses are valid, but the launch path is currently blocked by HyperEVM block gas limits.

Observed live values:
- latest block gas limit: about `3,000,000`
- KITTEN launcher gas estimate: about `9.66M`
- WHYPE launcher gas estimate: about `9.67M`
- even splitting the flow helps only partially:
  - direct ERC-20 deploy succeeds
  - fresh `createPool(token,KITTEN,0x)` alone still estimates about `8.31M`

So this repo includes a preflight script that checks the live chain first and refuses to broadcast when the tx cannot fit in a block.

## Install

```bash
npm install
```

## Preflight

```bash
node scripts/danubio_launch.mjs preflight --name Clawberto --symbol CLAW
node scripts/danubio_launch.mjs preflight --name Clawberto --symbol CLAW --launcher whype
```

Example output shape:
- `SAFE_TO_SEND`
- `BLOCKED_BY_BLOCK_GAS_LIMIT`
- `BLOCKED_BY_INSUFFICIENT_NATIVE`

## Launch

Uses env var `HYPEREVM_EXEC_PRIVATE_KEY` by default.

```bash
export HYPEREVM_EXEC_PRIVATE_KEY=0x...
node scripts/danubio_launch.mjs launch --name Clawberto --symbol CLAW
```

If the chain is still constrained, the script exits before sending.

## JSON mode

```bash
node scripts/danubio_launch.mjs preflight --name Clawberto --symbol CLAW --json
```

## Skill file

OpenClaw-style skill doc:
- `skills/danubio-token-launcher/SKILL.md`

## Notes

- KITTEN launcher `launchFee()` currently reads `0`.
- WHYPE launcher `launchFee()` currently reads `0.1 HYPE`.
- Official integration docs referenced `https://danubio.fun/agents`; host fetch returned `404` at one test point, so this repo keeps the key data locally.
