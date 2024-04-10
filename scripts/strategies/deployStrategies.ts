import hre, { ethers } from "hardhat";
import { Validator } from "../utils/Validator";
import { Args, deployContractUsingFactory } from "../utils/deployProxy";
import { Deployments, verifyContract } from "../utils/scripts";

export async function deployStrategies(
  strategyName: string,
  version: string,
  additionalArgs?: Args
): Promise<string> {
  const network = await ethers.provider.getNetwork();
  const networkName = await hre.network.name;
  const chainId = Number(network.chainId);
  const account = (await ethers.getSigners())[0];
  const deployerAddress = await account.getAddress();
  // const blocksToWait = networkName === "localhost" ? 0 : 5;
  const balance = await ethers.provider.getBalance(deployerAddress);

  const fileName = strategyName.toLowerCase();
  const deployments = new Deployments(chainId, fileName);

  const alloAddress = deployments.getAllo();

  console.log(`
    ////////////////////////////////////////////////////
      Deploys ${strategyName}.sol on ${networkName}
    ////////////////////////////////////////////////////
  `);

  console.table({
    contract: `${strategyName}.sol`,
    chainId: chainId,
    network: networkName,
    deployerAddress: deployerAddress,
    balance: ethers.formatEther(balance),
  });

  console.log(`Deploying ${strategyName}.sol`);

  const types = ["address", "string"].concat(additionalArgs?.types ?? []);
  const values = [alloAddress, strategyName + version].concat(
    additionalArgs?.values ?? []
  );

  const impl = await deployContractUsingFactory(
    deployments.getContractFactory(),
    strategyName,
    version,
    {
      types,
      values,
    }
  );

  const hashBytesStrategyName = ethers.keccak256(
    new ethers.AbiCoder().encode(["string"], [strategyName + version])
  );

  const objToWrite = {
    id: hashBytesStrategyName,
    name: strategyName,
    version: version,
    address: impl.toString(),
    deployerAddress: deployerAddress,
  };

  deployments.write(objToWrite);

  await verifyContract(impl, [...values]);

  const validator = await new Validator(strategyName, impl);
  await validator.validate("getAllo", [], alloAddress);
  await validator.validate("getStrategyId", [], hashBytesStrategyName);

  return impl.toString();
}

export async function deployStrategyDirectly(
  strategyName: string,
  version: string,
  args: any = []
): Promise<string> {
  const network = await ethers.provider.getNetwork();
  const networkName = await hre.network.name;
  const chainId = Number(network.chainId);
  const account = (await ethers.getSigners())[0];
  const deployerAddress = await account.getAddress();

  const fileName = strategyName.toLowerCase();
  const deploymentIo = new Deployments(chainId, fileName);

  const deployments = new Deployments(chainId, fileName);
  const alloAddress = deploymentIo.getAllo();

  console.log(`
    ////////////////////////////////////////////////////
        Deploys ${strategyName}.sol on ${networkName}
    ////////////////////////////////////////////////////`);

  console.table({
    contract: `Deploy ${strategyName}.sol`,
    version: version,
    chainId: chainId,
    network: networkName,
    deployerAddress: deployerAddress,
  });

  console.log(`Deploying ${strategyName}.sol...`);

  const StrategyFactory = await ethers.getContractFactory(strategyName);
  const feeData = await ethers.provider.getFeeData();

  const strategyNameWithVersion = strategyName + version;

  const instance = await StrategyFactory.deploy(
    alloAddress, strategyNameWithVersion, ...args,
    {
      account: account,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    }
  );

  await instance.waitForDeployment();

  const hashBytesStrategyName = ethers.keccak256(
    new ethers.AbiCoder().encode(["string"], [strategyName + version])
  );

  console.log(`${strategyNameWithVersion} deployed to:`, instance.target);

  const objToWrite = {
    id: hashBytesStrategyName,
    name: strategyName,
    version: version,
    address: instance.target,
    deployerAddress: deployerAddress,
  };

  deploymentIo.write(objToWrite);

  return instance.target.toString();
}

// Note: Deploy script to run in terminal:
// npx hardhat run scripts/deployStrategies.ts --network sepolia
