# Live notes — 2026-03-08

## Wallet actions executed

- Wrapped `0.02 HYPE` to WHYPE successfully
  - tx: `0xbb1a0dcfc9c9a01177e31103bb86d08b918c7c17e5d78a8f07ad82bd4ccbcc58`

## Launcher retry results

- KITTEN launcher live send with `gasLimit=10,000,000`:
  - result: `exceeds block gas limit`
- WHYPE launcher live send with `0.1 HYPE` value and `gasLimit=10,000,000`:
  - result: `exceeds block gas limit`

## Live chain readings

- latest block gas limit: about `3,000,000`
- KITTEN `launchFee()`: `0`
- WHYPE `launchFee()`: `0.1 HYPE`
- KITTEN `launch(Clawberto, CLAW)` estimate: about `9,664,427`
- WHYPE `launch(Clawberto, CLAW)` estimate: about `9,670,948`

## Split-flow experiment

Direct token deployment works, but pool creation remains too heavy.

- deployed token: `0x4812216700Dab9Bf78D134283Cc932b8Aa5D7943`
- deploy tx: `0x03c94667718ce5117f6736f2f02b3ba631c509f69eb0787057977af7d92c2167`
- `createPool(token,KITTEN,0x)` estimate: about `8,307,468`
- `createAndInitializePoolIfNecessary(...)` estimate: about `8,467,074`

## Conclusion

At this checkpoint, the blocker is the live HyperEVM gas envelope for fresh Danubio/KittenSwap pair creation.
