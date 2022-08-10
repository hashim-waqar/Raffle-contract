const { developmentChains } = require("./../helper-hardhat-config")
const { network, ethers } = require("hardhat")

const BASE_FEE = "250000000000000000" //0.25 is premium it const 0.25 link
const GAS_PRICE_LINK = 1e9 //calculated value base on the gas price of the link

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    const args = [BASE_FEE, GAS_PRICE_LINK]

    if (developmentChains.includes(network.name)) {
        log("local network detected! Deploying mocks........")
        // deploy a mock vrfcoordinator...
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            args: args,
            log: true,
        })
        log("Mocks deployed")
        log("-----------------------------------------")
    }
}

module.exports.tags = ["all", "mocks"]
