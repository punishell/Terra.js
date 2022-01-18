import 'dotenv/config.js'
import {
  deployContract,
  executeContract,
  instantiateContract,
  queryContract,
  recover,
  setTimeoutDuration,
  uploadContract,
} from "./helpers.js"
import { LCDClient, LocalTerra, Wallet } from "@terra-money/terra.js"
import { join } from "path"

// consts

const ARTIFACTS_PATH = "../artifacts"

// main

async function main() {
  let terra: LCDClient | LocalTerra
  let deployer: Wallet
  let nft_owner: Wallet
  let random: Wallet
  const isTestnet = process.env.NETWORK === "testnet"


  // terra = new LCDClient({
  // URL: 'https://bombay-lcd.terra.dev',
  // chainID: 'bombay-12'
  
  // wallet = recover(terra, process.env.TEST_MAIN!)

  
  terra = new LocalTerra()
  deployer = (terra as LocalTerra).wallets.test1
  random = (terra as LocalTerra).wallets.test2

  setTimeoutDuration(0)
    


  console.log(`Wallet address from seed: ${deployer.key.accAddress}`)

  

  /*************************************** Deploy TerraSwap Contract *****************************************/
  console.log("[+] Uploading terraswap token...")
  const token_code_id = await uploadContract(
    terra,
    deployer,
    join(ARTIFACTS_PATH, 'terraswap_token.wasm')
  )
  console.log("[+] Terraswap token code_id:" + token_code_id )

  console.log("[+] Uploading pair contract...")
  const pair_code_id = await uploadContract(
    terra,
    deployer,
    join(ARTIFACTS_PATH, 'terraswap_pair.wasm')
  )
  console.log("[+] Pair code_id:" + pair_code_id )
  console.log("[+] Deploying Factory...")

  const factory = await deployContract(
    terra,
    deployer,
    join(ARTIFACTS_PATH, 'terraswap_factory.wasm'),
    {"pair_code_id":pair_code_id, "token_code_id":token_code_id, },
  )

  console.log("[+] Factory Contract Address: " + factory)

  console.log("[+] Deploying Normal Token...")

  const normal_token = await deployContract(
    terra,
    deployer,
    join(ARTIFACTS_PATH, 'terraswap_token.wasm'),
    {"name":"Normal Token","symbol":"NOR","decimals":6,"initial_balances":[{"address":deployer.key.accAddress, "amount":"1000000000"}]},
  )
  console.log("[+] Normal_Token Contract Address: " + normal_token)
  
  const evil_token = await deployContract(
    terra,
    deployer,
    join(ARTIFACTS_PATH, 'terraswap_token_evil.wasm'),
    {"name":"Evil Token","symbol":"EVL","decimals":6,"initial_balances":[{"address":deployer.key.accAddress, "amount":"1000000000"}]},
  )
  console.log("[+] Evil_Token Contract Address: " + evil_token)


   /*************************************** Create Pairs *****************************************/

  let normal_result = await executeContract(terra, deployer, factory, {"create_pair":{"asset_infos":[{"token":{"contract_addr":normal_token}},{"native_token":{"denom":"uluna"}}]}});
  let normal_pair = normal_result.logs[0].eventsByType["from_contract"]["pair_contract_addr"][0];
  console.log("[+] Normal pair address: " + normal_pair);
  
  let evil_result = await executeContract(terra, deployer, factory, {"create_pair":{"asset_infos":[{"token":{"contract_addr":evil_token}},{"native_token":{"denom":"uluna"}}]}});
  let evil_pair = evil_result.logs[0].eventsByType["from_contract"]["pair_contract_addr"][0];
  console.log("[+] Evil pair address: " + evil_pair);
  /*************************************** Provide Liquidity for Normal Token *****************************************/
  
  console.log("[+] Increse Allowance of normal token for normal pair")
  console.log(await  executeContract(terra,deployer, normal_token ,{"increase_allowance":{"spender":normal_pair, "amount":"1000000000"}}))
  console.log("[+] Provide Liquidity of normal token for normal pair")
  console.log(await executeContract(terra, deployer, normal_pair, {
    "provide_liquidity": {
      "assets": [
        {
        "info": {
          "token": {
            "contract_addr": normal_token
          }
          },"amount": "1000000000"
      }, 
        {
        "info": {
          "native_token": {
            "denom": "uluna"
          }
        },
        "amount": "1000000"
      }]
    }
  },"1000000uluna"))

  let query_balance_result = await queryContract(terra,normal_token,{"balance":{"address":normal_pair}})
  console.log("[+] Balance of Normal Token for Normal Pair contract: " + query_balance_result.balance)

    /*************************************** Provide Liquidity for Evil Token *****************************************/
  
    console.log("[+] Increse Allowance of evil token for evil pair")
    console.log(await  executeContract(terra,deployer, evil_token ,{"increase_allowance":{"spender":evil_pair, "amount":"1000000000"}}))
    console.log("[+] Provide Liquidity of evil  token for evil pair")
    console.log(await executeContract(terra, deployer, evil_pair, {
      "provide_liquidity": {
        "assets": [
          {
          "info": {
            "token": {
              "contract_addr": evil_token
            }
            },"amount": "1000000000"
        }, 
          {
          "info": {
            "native_token": {
              "denom": "uluna"
            }
          },
          "amount": "1000000"
        }]
      }
    },"1000000uluna"))
  
    let query_balance_result_for_evil_token = await queryContract(terra,evil_token,{"balance":{"address":evil_pair}})
    console.log("[+] Balance of Evil Token for Evil Pair contract: " + query_balance_result_for_evil_token.balance)


  /*************************************** Swap Coins for Tokens *****************************************/
  console.log("[+] Swap Luna for normal token:");
  console.log(await executeContract(terra, random, normal_pair, {"swap":{"offer_asset":{"info":{"native_token":{"denom":"uluna"}},"amount":"1000000"}}},"1000000uluna"));
  let query_normal_token_swap_result = await queryContract(terra,normal_token,{"balance":{"address":random.key.accAddress}});
  console.log("[+] User balance of normal token after swaping 1luna:" + query_normal_token_swap_result.balance );

  console.log("[+] Swap Luna for normal token:");
  console.log(await executeContract(terra, random, evil_pair, {"swap":{"offer_asset":{"info":{"native_token":{"denom":"uluna"}},"amount":"1000000"}}},"1000000uluna"));
  let query_evil_token_swap_result = await queryContract(terra,evil_token,{"balance":{"address":random.key.accAddress}});
  console.log("[+] User balance of evil token after swaping 1luna:" + query_evil_token_swap_result.balance );

}
main().catch(console.log)
