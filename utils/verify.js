const { run } = require("hardhat")

const verify = async (contractAddress, args) => {
    console.log("verification contract...")

    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        })
    } catch (e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("all ready verified")
        } else {
            console.log(e)
        }
    }
}
module.exports = { verify }
