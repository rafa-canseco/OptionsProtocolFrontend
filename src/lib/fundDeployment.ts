import type { Address } from "viem";

export type TrustedFundBinding = {
  address: Address;
  implementation: Address | null;
};

export type FundStrategyKind = "cash_secured_put" | "covered_call";

export type TrustedFundDeployment = {
  chainId: number;
  fundKey: string;
  fundAddress: Address;
  shareAddress: Address;
  accountingAssetAddress: Address;
  wethAddress: Address;
  deploymentFirstBlock: number;
  strategyKind: FundStrategyKind;
  environmentPrefix: "CSP_FUND" | "COVERED_CALL_FUND";
  contracts: Record<string, TrustedFundBinding>;
};

/**
 * B1N-352 v2 trust anchor for the only fund supported in Hito 1.
 *
 * This is intentionally committed code rather than API-provided configuration:
 * the B1N-353 response must match these bindings before the frontend enables a
 * smart-wallet write.
 */
export const BASE_SEPOLIA_CSP_FUND = {
  chainId: 84532,
  fundKey: "base-sepolia:csp",
  fundAddress: "0x53e38Baf2fC55259729085b7542BFF066F6a509e",
  shareAddress: "0x07Db1F574ecCFD15c4A8bd4582e5d25baA84De7d",
  accountingAssetAddress: "0xAB51a471493832C1D70cef8ff937A850cf37c860",
  wethAddress: "0x8A6Aa2304797898d46eC1d342Fedc817D3a973B6",
  deploymentFirstBlock: 44_541_995,
  strategyKind: "cash_secured_put",
  environmentPrefix: "CSP_FUND",
  contracts: {
    fund_vault: {
      address: "0x53e38Baf2fC55259729085b7542BFF066F6a509e",
      implementation: "0xAf77368c61ef4C0Cfc4A9b64D53d17807204F5A1",
    },
    fund_share: {
      address: "0x07Db1F574ecCFD15c4A8bd4582e5d25baA84De7d",
      implementation: "0xaefF1f67F925a8410D7BE36703FaB63e265b158F",
    },
    fund_accounting: {
      address: "0x21d3acc5a2c64666dA93ABC8c77AB483b96836a3",
      implementation: "0x95902E4fbC65a008703a43f308C4Bb6694E431B1",
    },
    fund_flow_manager: {
      address: "0x0206C0A5050b09B7A2AD4E8CbF83a06ae2193080",
      implementation: "0x3e7dB54f340C23A7c8479AaAf8a8626Ce4b34b9E",
    },
    strategy_manager: {
      address: "0xfC28237145596D4E1dfD28B80e186EFC09A1F988",
      implementation: "0x6EA9FC22349a23634cF99C7363023d64fb625ACa",
    },
    csp_adapter: {
      address: "0x68e5C9f55201a4fa87040830b1A53A4B6E26b0e3",
      implementation: "0x0d8AcE03650C5212658d544A4aDe7987f7F3d475",
    },
    controller: {
      address: "0xD52EFbBaA1b02BA65A7f0A1604A5dFb4C4dB1572",
      implementation: "0x5cfB9ca0437D4a5b3735bba0d9E2490a05F532bc",
    },
    batch_settler: {
      address: "0xb94D6270B336dca566C2077d50c2C50F06398cB8",
      implementation: "0x040219e594de2862D1480a6A3c1d45c5c032aCE6",
    },
    claim_escrow: {
      address: "0xf0E540dfb0D3d8c3eDfCB5B5E457CafE116C5439",
      implementation: null,
    },
    access_manager: {
      address: "0x729d5076C1C59a7C2676Faf3fB9133Ff80cDaB12",
      implementation: null,
    },
    address_book: {
      address: "0x033d9d37Baf83dBc71935239b6fA22a6905dbaa0",
      implementation: null,
    },
    csp_valuator: {
      address: "0x63aB18b546d2b7a6e9e68eF7C784Ecfa41B76798",
      implementation: null,
    },
    margin_pool: {
      address: "0xeEab53b8022C32349A80C8d905492EBa6b2deaE9",
      implementation: null,
    },
    nav_verifier: {
      address: "0x3093a0f0634aF2991ACD265d1f1F325480113d40",
      implementation: null,
    },
    oracle: {
      address: "0xF95CC4aED4a0bD68e0F1BE7c779BC281189F8187",
      implementation: null,
    },
    otoken_factory: {
      address: "0x193ED89eB64d0179b4dB08E87E541b7b3c30002A",
      implementation: null,
    },
    swap_router: {
      address: "0x7442287A564D7A7f412a12Ff986a242E1A969abB",
      implementation: null,
    },
    whitelist: {
      address: "0xe0Ca66a93341eB0af0C136651c8B57C187aa60Ab",
      implementation: null,
    },
  } satisfies Record<string, TrustedFundBinding>,
} as const satisfies TrustedFundDeployment;

/**
 * B1N-360 Base Sepolia trust anchor for the WETH covered-call fund.
 *
 * The backend registry and config response must match every binding before
 * smart-wallet writes are enabled.
 */
export const BASE_SEPOLIA_COVERED_CALL_FUND = {
  chainId: 84532,
  fundKey: "base-sepolia:covered-call",
  fundAddress: "0x9060946E6ACC4E430A823E90120743c7305EE2CA",
  shareAddress: "0xaA1070adb74C5455320285618BF1ED804d3745C3",
  accountingAssetAddress: "0x8A6Aa2304797898d46eC1d342Fedc817D3a973B6",
  wethAddress: "0x8A6Aa2304797898d46eC1d342Fedc817D3a973B6",
  deploymentFirstBlock: 44_709_928,
  strategyKind: "covered_call",
  environmentPrefix: "COVERED_CALL_FUND",
  contracts: {
    fund_vault: {
      address: "0x9060946E6ACC4E430A823E90120743c7305EE2CA",
      implementation: "0xCae10a81aE1aA0183A4b4283A3ACbE9A2642613A",
    },
    fund_share: {
      address: "0xaA1070adb74C5455320285618BF1ED804d3745C3",
      implementation: "0x900264215ED313a6cC95e8BA8BF47b20069777fC",
    },
    fund_accounting: {
      address: "0x9a112A65FE8510bCf5DC894fFBf06aEa8d12d311",
      implementation: "0xca698509f7770465A580Be3733E56D3CbC8bCd76",
    },
    fund_flow_manager: {
      address: "0x59fc0d88aAF3D14b82696cc7E91ea37b629E48cc",
      implementation: "0x20EB957dfF753074a52487CbC3F4297879E9536e",
    },
    strategy_manager: {
      address: "0x745422dd14E84ee27C2E56D2845C3BB1658027d9",
      implementation: "0x88CDCF59F289b0346F568a751Fd8e08409B08271",
    },
    covered_call_adapter: {
      address: "0x0BF96C5cE0D637d4D686d342aE42Bc00fDa19De9",
      implementation: "0x42e603131671Aba8C9e2b0B21b0f7B376C9151Be",
    },
    controller: {
      address: "0xD52EFbBaA1b02BA65A7f0A1604A5dFb4C4dB1572",
      implementation: "0x5cfB9ca0437D4a5b3735bba0d9E2490a05F532bc",
    },
    batch_settler: {
      address: "0xb94D6270B336dca566C2077d50c2C50F06398cB8",
      implementation: "0x040219e594de2862D1480a6A3c1d45c5c032aCE6",
    },
    claim_escrow: {
      address: "0x8842372431CA713402Ac15E868Eb7d8A7c98A807",
      implementation: null,
    },
    access_manager: {
      address: "0x5AfD3d840ec2f7fE078b44b75462C2dCD3DC3F6D",
      implementation: null,
    },
    address_book: {
      address: "0x033d9d37Baf83dBc71935239b6fA22a6905dbaa0",
      implementation: null,
    },
    covered_call_valuator: {
      address: "0xA1BFC1bE3C7fCA77CA0b32d25de1Ce58A50333A0",
      implementation: null,
    },
    margin_pool: {
      address: "0xeEab53b8022C32349A80C8d905492EBa6b2deaE9",
      implementation: null,
    },
    nav_verifier: {
      address: "0xb71252822F1Bd5F526E80A225ade2520d6903dB8",
      implementation: null,
    },
    oracle: {
      address: "0xF95CC4aED4a0bD68e0F1BE7c779BC281189F8187",
      implementation: null,
    },
    otoken_factory: {
      address: "0x193ED89eB64d0179b4dB08E87E541b7b3c30002A",
      implementation: null,
    },
    swap_router: {
      address: "0x7442287A564D7A7f412a12Ff986a242E1A969abB",
      implementation: null,
    },
    whitelist: {
      address: "0xe0Ca66a93341eB0af0C136651c8B57C187aa60Ab",
      implementation: null,
    },
  } satisfies Record<string, TrustedFundBinding>,
} as const satisfies TrustedFundDeployment;

export type TrustedFundRole =
  | keyof typeof BASE_SEPOLIA_CSP_FUND.contracts
  | keyof typeof BASE_SEPOLIA_COVERED_CALL_FUND.contracts;
