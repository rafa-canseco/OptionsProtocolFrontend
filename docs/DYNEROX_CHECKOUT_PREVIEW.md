# Dynerox Checkout stage preview

B1N-390 currently exposes only Dynerox's hosted stage Checkout for local and
staging QA. It does not call the Dynerox API and must not receive API keys or
webhook secrets.

## Local setup

Add the following public identifiers to `.env.local`:

```dotenv
NEXT_PUBLIC_DEPLOYMENT_ENV=testnet
NEXT_PUBLIC_DYNEROX_CHECKOUT_BASE_URL=https://stage-app.dynerox.com
NEXT_PUBLIC_DYNEROX_TENANT_CODE=tenbin
```

`tenbin` is Dynerox's shared demo tenant. Replace it with b1nary's tenant code
when Dynerox provides it. Restart `bun dev` after changing public environment
variables.

The method fails closed unless the base URL is exactly
`https://stage-app.dynerox.com`, the tenant code is present, and the deployment
is local development, `devnet`, `testnet`, or `staging`. It is always hidden
when `NEXT_PUBLIC_DEPLOYMENT_ENV=mainnet`.

## Current QA boundary

- Deposit opens `MXN/SPEI -> USDC/ethereum`.
- Withdraw opens `USDC/ethereum -> MXN/SPEI`.
- Checkout opens in a new tab and owns registration, identity verification, and
  route authorization.
- b1nary does not receive or track completion state in this preview.
- Use synthetic stage data only. Activity under `tenbin` belongs to that demo
  merchant.
- Do not enable for production. Base/Base Sepolia support remains blocked until
  Dynerox provides its canonical network value and confirms USDC support.

## Rollback

Remove either Dynerox public variable (or set the deployment to `mainnet`) and
restart/redeploy the frontend. The bank-transfer choice disappears while the
existing crypto-transfer flow remains available.
