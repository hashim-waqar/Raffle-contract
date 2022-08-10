// Enter the lottery (paying some amount)
// pick a random winner (verifiably) random
// winner to be selected every x minute -> completely automated
// chainlink oracle -> Randomness, Automated Execution (chainlink keeper)

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

// imports

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

//errors

error Raffle_NotEnoughEthEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle_upkeepNotNeeded(uint256 currentBalance,uint256 numPlayers,uint256 raffleState);

/** @title A sample Raffle Contract
*   @author Hashim Waqar 
*   @notice The contract is for creating an untemperable decentralized smartContract
*   @dev This implements Chainlink VRF v2 and chainlink keepers
*/



contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    //Type declaration

    enum RaffleState{
        OPEN,
        CALCULATING
    } 


    // State variables

    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64  private immutable i_subscriptionId;
    uint32  private immutable i_callbackGasLimit;
    uint16  private constant  REQUEST_CONFIRMATION=3;
    uint32  private constant  NUM_WORDS=1;
    

/**Lottery variables */
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    
    uint256 private immutable i_interval;
   
    /* Events*/

    event RaffleEnter(address indexed player);
    event RequestRaffleWinner(uint256 indexed requestId);
    event winnerPicked(address indexed winner);


    constructor
    (
        address vrfCoordinateV2,  
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval

    ) VRFConsumerBaseV2(vrfCoordinateV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinateV2);
        i_gasLane = gasLane;
        i_subscriptionId=subscriptionId;
        i_callbackGasLimit=callbackGasLimit;
        s_raffleState=RaffleState.OPEN;
        s_lastTimeStamp=block.timestamp;
        i_interval=interval;
    }



    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle_NotEnoughEthEntered();
        }
        if(s_raffleState!=RaffleState.OPEN) {revert Raffle__NotOpen();}
        s_players.push(payable(msg.sender));

        // emit and event when we update a dynamic array
        emit RaffleEnter(msg.sender);
    }


/**
*@dev This function that the chainlink keeper nodes call
*they look for the 'upKeepNeeded' to return true
 * In order to return true
 * 1- Our time interval should passed
 * 2- The lottery should have atleast 1 player, and have some ETH
 * 3- our subscription is funded with LINK
 * 4- The lottery should be in an "open" state. 
 */

    function checkUpkeep(bytes memory /*checkDate*/) public override 
        returns (bool upkeepNeeded,bytes memory /*performData*/)

{
    bool isOpen=(RaffleState.OPEN==s_raffleState);
    bool timePassed=((block.timestamp - s_lastTimeStamp) > i_interval);
    bool hasPlayers=(s_players.length>0);
    bool hasBalance=(address(this).balance>0);
    upkeepNeeded=(isOpen && timePassed && hasPlayers && hasBalance);
}

    function performUpkeep(bytes calldata /*performData */) external override{
        // Request the random number
        // Once we get do something with it
        // 2 transaction process
        (bool upkeepNeeded,)=checkUpkeep("");
        if(!upkeepNeeded) {revert Raffle_upkeepNotNeeded(address(this).balance,s_players.length,uint256(s_raffleState));}
        s_raffleState=RaffleState.CALCULATING;
        uint256 requestId= i_vrfCoordinator.requestRandomWords(
            i_gasLane, //gaslane
            i_subscriptionId,
            REQUEST_CONFIRMATION,
            i_callbackGasLimit,
            NUM_WORDS
        );

        emit RequestRaffleWinner(requestId);
    }

    function fulfillRandomWords(uint256 /*requestId*/, uint256[] memory randomWords)
        internal
        override
        {
                uint256 indexedOfWinner=randomWords[0] % s_players.length;
                address payable recentWinner=s_players[indexedOfWinner];
                s_recentWinner=recentWinner;
                s_raffleState=RaffleState.OPEN;
                s_players=new address payable[](0);
                s_lastTimeStamp=block.timestamp;
                (bool success,)=recentWinner.call{value:address(this).balance}("");
                if(!success){revert Raffle__TransferFailed();}
                emit winnerPicked(recentWinner);
        }   


// view and pure functions
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns(address)
    {
        return s_recentWinner;
    }

    function getRaffleState() public view returns(RaffleState){
        return s_raffleState;
    }

    function getNumWords() public pure returns(uint256){
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns(uint256)
    {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns(uint256)
    {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns(uint256)
    {
        return REQUEST_CONFIRMATION;
    }

    function getInterval() public view returns(uint256)
    {
        return i_interval;
    }
}

