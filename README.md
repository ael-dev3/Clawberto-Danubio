# Clawberto-Danubio

Danubio token-launcher skill + preflight tooling for HyperEVM.

This repo now does two things:
- preserves the official one-call launcher integration data
- adds the practical checks we learned from actually trying to deploy live on HyperEVM

## What an agent needs before it can launch

### Hard requirements

- HyperEVM RPC access (`https://rpc.hyperliquid.xyz/evm`)
- chain id `999`
- signer/private key able to send live txs
- enough **native HYPE** for:
  - `launchFee()`
  - gas
- name + symbol
- a preflight step that compares estimated gas against the **current** block gas limit

### Important gotchas from live testing

- The launcher is real and verified.
- The launcher is also **monolithic**: token deploy + pool create + initialize + LP mint + LP lock all happen in one transaction.
- If current block gas limit is too low, the launch will fail even when the contract address, signer, and calldata are all correct.
- For the **WHYPE launcher**, the fee is still paid in **native HYPE via `msg.value`**. Holding wrapped WHYPE alone is not enough.
- A successful standalone ERC-20 deployment is **not** a successful Danubio launch. Pool creation is the heavy part.

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

## Launcher requirements matrix

| Launcher | Pair quote token | `launchFee()` source | What the agent must hold to launch | Notes |
|---|---|---:|---|---|
| KITTEN | KITTEN | native HYPE `msg.value` (currently `0`) | native HYPE for gas | KITTEN is the quote token for the pool, but the launcher itself mints/creates internally |
| WHYPE | WHYPE | native HYPE `msg.value` (currently `0.1 HYPE`) | native HYPE for fee **and** gas | Wrapped WHYPE does **not** satisfy `launchFee()` |

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

## Real launch cost model for agents

Agents should not rely on a static marketing number like “~$0.06 per launch”.

Instead, compute this live every time:

```text
required native HYPE = launchFee() + (estimatedGas * currentGasPrice) + safety buffer
```

This repo’s preflight now reports:
- `launchFee`
- `gasPrice`
- `estimatedGas`
- `recommendedGasLimit`
- `estimatedNetworkFee`
- `recommendedNetworkFee`
- `recommendedTotalNativeRequired`

## Live chain-status note

As tested live on `2026-03-08`, the contract addresses were valid, but the launch path was blocked by HyperEVM block gas limits.

Observed live values:
- latest block gas limit: about `3,000,000`
- current gas price: about `0.1 gwei`
- KITTEN launcher gas estimate: about `9.66M`
- WHYPE launcher gas estimate: about `9.67M`
- estimated pure network fee at that gas price: about `0.00097 HYPE`
- WHYPE launch fee: `0.1 HYPE`
- even splitting the flow only helped partially:
  - direct ERC-20 deploy succeeded
  - fresh `createPool(token,KITTEN,0x)` alone still estimated about `8.31M`
  - `createAndInitializePoolIfNecessary(...)` still estimated about `8.47M`

So at that checkpoint, the real blocker was not signer setup, not router approvals, and not contract discovery. It was the chain gas envelope for fresh pair creation.

## Install

```bash
npm install
```

## Preflight

```bash
node scripts/danubio_launch.mjs preflight --name Clawberto --symbol CLAW
node scripts/danubio_launch.mjs preflight --name Clawberto --symbol CLAW --launcher whype
node scripts/danubio_launch.mjs preflight --name Clawberto --symbol CLAW --json
```

Example statuses:
- `SAFE_TO_SEND`
- `BLOCKED_BY_BLOCK_GAS_LIMIT`
- `BLOCKED_BY_INSUFFICIENT_NATIVE`

Example checks included now:
- quote token
- launch fee
- gas price
- estimated gas
- recommended gas limit
- estimated network fee
- recommended total native required
- blockers
- practical notes

## Launch

Uses env var `HYPEREVM_EXEC_PRIVATE_KEY` by default.

```bash
export HYPEREVM_EXEC_PRIVATE_KEY=0x...
node scripts/danubio_launch.mjs launch --name Clawberto --symbol CLAW
```

If the chain is still constrained, the script exits before sending.

## Lessons learned from live deployment attempts

### 1) Always preflight the block gas limit

Docs can be right and the chain can still be temporarily unlaunchable.

### 2) Treat WHYPE carefully

The launcher name says WHYPE, but the fee still comes from native HYPE via `msg.value`.

### 3) Don’t mistake partial progress for success

We successfully deployed a standalone token contract during testing, but that was **not** a valid Danubio launch because no pool/LP lock existed yet.

### 4) Pool creation is the expensive step

If you ever need fallback paths, assume fresh pool creation is the bottleneck, not the ERC-20 deployment.

## If the agent also wants to buy after launch

Launching and buying are different requirements.

For a post-launch buy flow, the agent additionally needs:
- KITTEN balance (or whatever route is being used)
- router approval for the input token
- swap slippage / limitSqrtPrice handling
- receipt parsing for the emitted token/pool addresses

## Skill file

OpenClaw-style skill doc:
- `skills/danubio-token-launcher/SKILL.md`

## References

- `references/live-notes-2026-03-08.md`

## Notes

- KITTEN launcher `launchFee()` currently reads `0`.
- WHYPE launcher `launchFee()` currently reads `0.1 HYPE`.
- Official integration docs referenced `https://danubio.fun/agents`; host fetch returned `404` at one test point, so this repo keeps the key data locally.
