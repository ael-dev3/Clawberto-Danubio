#!/usr/bin/env node
import { ethers } from 'ethers';

const RPC_URL = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
const CHAIN_ID = 999;
const DEFAULT_PK_ENV = 'HYPEREVM_EXEC_PRIVATE_KEY';

const LAUNCHERS = {
  kitten: {
    label: 'KITTEN',
    address: '0x2ccD3b07b105800480668C482625454E0e26ad27',
  },
  whype: {
    label: 'WHYPE',
    address: '0x9005A8504069b1Bd94A98C64F447b93Ed742bF6c',
  },
};

const TOKEN_LAUNCHED_EVENT =
  'event TokenLaunched(uint256 indexed launchId, address indexed token, address indexed pool, string handle, string name, string symbol, uint256 creatorAmount, uint256 nftId)';

const LAUNCHER_ABI = [
  'function launch(string name, string symbol) external payable returns (address token, address pool)',
  'function launchFee() external view returns (uint256)',
  TOKEN_LAUNCHED_EVENT,
];

function usage() {
  console.log(`Usage:
  node scripts/danubio_launch.mjs preflight --name <NAME> --symbol <SYMBOL> [--launcher kitten|whype] [--json]
  node scripts/danubio_launch.mjs launch --name <NAME> --symbol <SYMBOL> [--launcher kitten|whype] [--pk-env ENV] [--force] [--json]

Notes:
- Default RPC: ${RPC_URL}
- Default launcher: kitten
- launch refuses when estimated gas exceeds current block gas limit unless --force is passed
- private key is read only from env (default: ${DEFAULT_PK_ENV})`);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function mustString(v, flag) {
  if (!v || typeof v !== 'string') throw new Error(`Missing required ${flag}`);
  return v;
}

function pickLauncher(name = 'kitten') {
  const key = String(name).toLowerCase();
  const picked = LAUNCHERS[key];
  if (!picked) throw new Error(`Unknown launcher: ${name}`);
  return { key, ...picked };
}

function toPrintable(obj) {
  return JSON.stringify(obj, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
}

async function buildContext({ launcherName, name, symbol, pkEnv }) {
  const launcherMeta = pickLauncher(launcherName);
  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const launcher = new ethers.Contract(launcherMeta.address, LAUNCHER_ABI, provider);
  const latestBlock = await provider.getBlock('latest');
  const launchFee = await launcher.launchFee();
  const data = launcher.interface.encodeFunctionData('launch', [name, symbol]);
  const txReq = {
    to: launcherMeta.address,
    data,
    value: launchFee,
  };

  const estimate = await provider.estimateGas(txReq);
  const blockGasLimit = latestBlock.gasLimit;
  const blockedByBlockGasLimit = estimate > blockGasLimit;

  let wallet = null;
  let address = null;
  let nativeBalance = null;
  let hasEnoughNative = null;

  const pk = process.env[pkEnv];
  if (pk) {
    wallet = new ethers.Wallet(pk, provider);
    address = await wallet.getAddress();
    nativeBalance = await provider.getBalance(address);
    hasEnoughNative = nativeBalance >= launchFee;
  }

  const status = blockedByBlockGasLimit
    ? 'BLOCKED_BY_BLOCK_GAS_LIMIT'
    : hasEnoughNative === false
      ? 'BLOCKED_BY_INSUFFICIENT_NATIVE'
      : 'SAFE_TO_SEND';

  return {
    rpcUrl: RPC_URL,
    chainId: CHAIN_ID,
    launcher: launcherMeta,
    name,
    symbol,
    launchFee,
    estimate,
    blockGasLimit,
    blockedByBlockGasLimit,
    status,
    walletAddress: address,
    nativeBalance,
    hasEnoughNative,
    signerReady: Boolean(wallet),
    provider,
    wallet,
    launcherContract: launcher,
  };
}

function projectResult(ctx) {
  return {
    status: ctx.status,
    launcher: ctx.launcher.label,
    launcherAddress: ctx.launcher.address,
    name: ctx.name,
    symbol: ctx.symbol,
    launchFeeWei: ctx.launchFee,
    launchFeeHype: ethers.formatEther(ctx.launchFee),
    estimatedGas: ctx.estimate,
    blockGasLimit: ctx.blockGasLimit,
    walletAddress: ctx.walletAddress,
    nativeBalanceWei: ctx.nativeBalance,
    nativeBalanceHype: ctx.nativeBalance == null ? null : ethers.formatEther(ctx.nativeBalance),
    signerReady: ctx.signerReady,
  };
}

async function runPreflight(args) {
  const ctx = await buildContext({
    launcherName: args.launcher || 'kitten',
    name: mustString(args.name, '--name'),
    symbol: mustString(args.symbol, '--symbol'),
    pkEnv: args['pk-env'] || DEFAULT_PK_ENV,
  });
  const result = projectResult(ctx);
  if (args.json) {
    console.log(toPrintable(result));
    return;
  }
  console.log(`status: ${result.status}`);
  console.log(`launcher: ${result.launcher} (${result.launcherAddress})`);
  console.log(`launchFee: ${result.launchFeeHype} HYPE`);
  console.log(`estimatedGas: ${result.estimatedGas}`);
  console.log(`blockGasLimit: ${result.blockGasLimit}`);
  if (result.walletAddress) {
    console.log(`wallet: ${result.walletAddress}`);
    console.log(`nativeBalance: ${result.nativeBalanceHype} HYPE`);
  }
}

async function runLaunch(args) {
  const pkEnv = args['pk-env'] || DEFAULT_PK_ENV;
  const ctx = await buildContext({
    launcherName: args.launcher || 'kitten',
    name: mustString(args.name, '--name'),
    symbol: mustString(args.symbol, '--symbol'),
    pkEnv,
  });

  if (!ctx.wallet) throw new Error(`Missing private key in env: ${pkEnv}`);
  if (ctx.status !== 'SAFE_TO_SEND' && !args.force) {
    const result = projectResult(ctx);
    if (args.json) {
      console.log(toPrintable(result));
    } else {
      console.log(`status: ${result.status}`);
      console.log(`estimatedGas: ${result.estimatedGas}`);
      console.log(`blockGasLimit: ${result.blockGasLimit}`);
    }
    process.exitCode = 2;
    return;
  }

  const contract = ctx.launcherContract.connect(ctx.wallet);
  const gasLimit = ctx.estimate + (ctx.estimate / 10n) + 25_000n;
  const tx = await contract.launch(ctx.name, ctx.symbol, { value: ctx.launchFee, gasLimit });
  const receipt = await tx.wait();
  const iface = new ethers.Interface(LAUNCHER_ABI);
  let token = null;
  let pool = null;

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'TokenLaunched') {
        token = parsed.args.token;
        pool = parsed.args.pool;
        break;
      }
    } catch {}
  }

  const result = {
    status: receipt.status === 1 ? 'SUCCESS' : 'REVERTED',
    txHash: receipt.hash,
    launcher: ctx.launcher.label,
    launcherAddress: ctx.launcher.address,
    token,
    pool,
    gasUsed: receipt.gasUsed,
    effectiveGasPriceWei: receipt.gasPrice ?? null,
  };

  if (args.json) {
    console.log(toPrintable(result));
    return;
  }

  console.log(`status: ${result.status}`);
  console.log(`txHash: ${result.txHash}`);
  if (token) console.log(`token: ${token}`);
  if (pool) console.log(`pool: ${pool}`);
  console.log(`gasUsed: ${result.gasUsed}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (!command || args.help || args.h) {
    usage();
    return;
  }
  if (command === 'preflight') {
    await runPreflight(args);
    return;
  }
  if (command === 'launch') {
    await runLaunch(args);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((err) => {
  console.error(`ERROR: ${err.message || String(err)}`);
  process.exit(1);
});
