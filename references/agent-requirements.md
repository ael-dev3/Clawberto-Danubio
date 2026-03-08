# Agent requirements for Danubio launch automation

## Launch path requirements

An autonomous agent must have all of these before attempting broadcast:

1. **RPC access** to HyperEVM (`https://rpc.hyperliquid.xyz/evm`)
2. **Chain ID** fixed to `999`
3. **Signer access** (private key or wallet integration)
4. **Native HYPE** for:
   - `launchFee()`
   - gas
5. **Token metadata**:
   - `name`
   - `symbol`
6. **Preflight logic** that checks:
   - `launchFee()`
   - `estimateGas(launch(...))`
   - current `blockGasLimit`
   - current gas price
   - wallet native balance vs recommended total required

## Funding rules by launcher

### KITTEN launcher

- contract: `0x2ccD3b07b105800480668C482625454E0e26ad27`
- quote token: `KITTEN`
- current `launchFee()`: `0`
- practical funding requirement: native HYPE for gas

### WHYPE launcher

- contract: `0x9005A8504069b1Bd94A98C64F447b93Ed742bF6c`
- quote token: `WHYPE`
- current `launchFee()`: `0.1 HYPE`
- practical funding requirement: native HYPE for fee + gas
- important: wrapped WHYPE is **not** enough by itself because the fee is paid through `msg.value`

## Real execution lesson

A launch can fail even when:
- the contract address is correct
- the ABI is correct
- the signer is valid
- the wallet is funded

Why? Because the chain may not currently allow a transaction that large to fit in a block.

## 2026-03-08 measured values

- block gas limit: about `3,000,000`
- KITTEN launch estimate: about `9,664,427`
- WHYPE launch estimate: about `9,670,948`
- gas price: about `0.1 gwei`
- estimated pure network fee: about `0.00097 HYPE`
- WHYPE launch total native requirement at that point: about `0.10097 HYPE` before buffer

## Operational rule

Before any autonomous send:

```text
if estimateGas > blockGasLimit:
  do not send
```

That one check prevents a lot of fake-success logic and pointless retries.
