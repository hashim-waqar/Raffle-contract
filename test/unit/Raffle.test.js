const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle, vrfCoordinatorV2Mock, deployer, entranceFee, interval
          const chainId = network.config.chainId

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
              entranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("Constructor", function () {
              it("it initializes the raffle correctly", async function () {
                  //ideally we make one assert per "it"
                  const raffleState = await raffle.getRaffleState()
                  const raffleInterval = interval
                  const raffleEntranceFee = await raffle.getEntranceFee()

                  assert.equal(raffleState.toString(), "0")
                  assert.equal(raffleInterval.toString(), networkConfig[chainId]["interval"])
                  assert.equal(raffleEntranceFee.toString(), networkConfig[chainId]["entranceFee"])
              })
          })

          describe("enterRaffle", function () {
              it("reverts when you don't pay enough", async function () {
                  //   const enterRaffle = await raffle.enterRaffle({
                  //       value: ethers.utils.parseEther("0.001"),
                  //   })
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle_NotEnoughEthEntered()"
                  )
              })
              it("records when players enter", async function () {
                  const enterRaffle = await raffle.enterRaffle({
                      value: entranceFee,
                  })
                  const player = await raffle.getPlayer(0)
                  assert.equal(player, deployer)
              })
              it("emits event on enter", async function () {
                  await expect(raffle.enterRaffle({ value: entranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })
              it("doesn't allows users to enter when raffle is calculating", async function () {
                  const enterRaffle = await raffle.enterRaffle({ value: entranceFee })
                  // after entering block number and timestamp
                  let blockNumber = await ethers.provider.getBlockNumber()
                  let blockTime = await ethers.provider.getBlock(blockNumber)
                  console.log(`${blockNumber} and ${blockTime.timestamp}`)
                  // increasing time and mining block
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  //after increasing time and mining block then  block number and time
                  blockNumber = await ethers.provider.getBlockNumber()
                  blockTime = await ethers.provider.getBlock(blockNumber)
                  console.log(`${blockNumber} and ${blockTime.timestamp}`)

                  await raffle.performUpkeep([])
                  //after perform upkeep blocknumber and timestamp
                  blockNumber = await ethers.provider.getBlockNumber()
                  blockTime = await ethers.provider.getBlock(blockNumber)
                  console.log(`${blockNumber} and ${blockTime.timestamp}`)

                  //entering lottery again

                  await expect(raffle.enterRaffle({ value: entranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen()"
                  )
              })
          })
          describe("check upkeep", function () {
              it("returns false if people haven't send eth", async function () {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })
              it("returns false if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep([])
                  const raffleState = await raffle.getRaffleState()
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert.equal(raffleState.toString(), "1")
                  assert.equal(upkeepNeeded, false)
              })
              it("returns false if enough time hasn't passed", async function () {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 2])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert.equal(upkeepNeeded, false)
              })
              it("returns true if enough time passed", async function () {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert.equal(upkeepNeeded, true)
              })
          })
          describe("performUpkeep", function () {
              it("only run if checkupkeep is true", async function () {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  const tx = await raffle.performUpkeep([])
                  assert(tx)
              })
              it("reverts when checkupKeep needed", async function () {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle_upkeepNotNeeded"
                  )
              })
              it("updates the raffle state, emits and event,calls the vrf coordinator", async function () {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine")
                  const txResponse = await raffle.performUpkeep([])
                  const txRecipt = await txResponse.wait(1)
                  const requestId = await txRecipt.events[1].args.requestId
                  console.log(requestId)
                  console.log(requestId.toNumber())
                  const raffleState = await raffle.getRaffleState()
                  assert(requestId.toNumber() > 0)
                  assert.equal(raffleState.toString(), "1")
              })
          })
          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: ethers.utils.parseEther("2") })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
              })
              it("it only calls when upkeep perform", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                  ).to.be.revertedWith("nonexistent request")
              })
              it("it picks a winner ,reset the lottery, and send money", async function () {
                  const additionalEntrants = 3
                  const startingAccountIndex = 1 //deployer 0
                  const accounts = await ethers.getSigners()

                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedRaffle = await raffle.connect(accounts[i])
                      await accountConnectedRaffle.enterRaffle({ value: entranceFee })
                  }

                  const startingTimeStamp = await raffle.getLatestTimeStamp()
                  let winnerAddress
                  await new Promise(async (resolve, reject) => {
                      raffle.once("winnerPicked", async () => {
                          console.log("winner picked event fired")
                          try {
                              // Now lets get the ending values...
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerBalance = await accounts[2].getBalance()
                              const endingTimeStamp = await raffle.getLastTimeStamp()
                              await expect(raffle.getPlayer(0)).to.be.reverted
                              // Comparisons to check if our ending values are correct:
                              assert.equal(recentWinner.toString(), accounts[2].address)
                              assert.equal(raffleState, 0)
                              assert.equal(
                                  winnerBalance.toString(),
                                  startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                                      .add(
                                          raffleEntranceFee
                                              .mul(additionalEntrances)
                                              .add(raffleEntranceFee)
                                      )
                                      .toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                          } catch (e) {
                              reject(e)
                          }
                          resolve()
                      })
                  })
                  const tx = await raffle.performUpkeep([])
                  const txReceipt = await tx.wait(1)
                  const startingBalance = await accounts[2].getBalance()
                  console.log(txReceipt.events[1].args.requestId)
                  console.log(raffle.address)
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      txReceipt.events[1].args.requestId,
                      raffle.address
                  )
              })
          })
      })
