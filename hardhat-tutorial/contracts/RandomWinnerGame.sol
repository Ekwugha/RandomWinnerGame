// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";

contract RandomWinnerGame is VRFConsumerBase, Ownable {

    // The amount of LINK to send with the request
    uint256 public fee;
    // ID of public key against which randomness is generated
    bytes32 public keyHash;


    // Address of the players
    address[] public players;
    //Max number of players in one game
    uint8 maxPlayers;
    // Variable to indicate if the game has started or not
    bool public gameStarted;
    // the fees for entering the game
    uint256 entryFee;
    // current game id
    uint256 public gameId;


    // emitted when the game starts
    event GameStarted(uint256 gameId, uint8 maxPlayers, uint256 entryFee);
    // emitted when someone joins a game
    event PlayerJoined(uint256 gameId, address player);
    // emitted when the game ends
    event GameEnded(uint256 gameId, address winner,bytes32 requestId);


    
    constructor(address vrfCoordinator, address linkToken, bytes32 vrfKeyHash, uint256 vrfFee) VRFConsumerBase(vrfCoordinator, linkToken) {
        keyHash = vrfKeyHash;
        fee = vrfFee;
        gameStarted = false;
    }



    // startGame starts the game by setting appropriate values for all the variables
    function startGame(uint8 _maxPlayers, uint256 _entryFee) public onlyOwner {
        // Check if there is a game already running
        require(!gameStarted, "Game is currently running");
        // empty the players array
        delete players;
        // set the max players for this game
        maxPlayers = _maxPlayers;
        // set the game started to true
        gameStarted = true;
        // setup the entryFee for the game
        entryFee = _entryFee;
        gameId += 1;
        emit GameStarted(gameId, maxPlayers, entryFee);
    }


    // It's called when a player want to enter the game
    function joinGame() public payable {
        // to check if game is runiing already
        require (gameStarted, "Game has not been started yet");
        // check if the value sent by the user matches the entry fee
        require(msg.value == entryFee, "Value sent is not equal to entry fee");
        // check if there's still some space left to add another player
        require(players.length < maxPlayers, "Game is full");
        // add the sender to the players list
        players.push(msg.sender);
        emit PlayerJoined(gameId, msg.sender);
        // If the list is full start the winner selection process
        if(players.length == maxPlayers) {
            getRandomWinner();
        }
    }


    function getRandomWinner() private returns (bytes32 requestId) {
        // LINK is an internal interface for Link token found within the VRFConsumerBase
        // Here we use the balanceOF method from that interface to make sure that our
        // contract has enough link so that we can request the VRFCoordinator for randomness
        require(LINK.balanceOf(address(this)) >= fee, "Not enough LINK");
        // requestRandomness is a function within the VRFConsumerBase which makes the initial request for randomness.
        return requestRandomness(keyHash, fee);
    }

   
    // fulfillRandomness is called by VRFCoordinator which is the function that receives and does something with verified randomness.
    // This function is overrided to act upon the random number generated by Chainlink VRF.
    // requestId  this ID is unique for the request we sent to the VRF Coordinator
    // randomness this is a random unit256 generated and returned to us by the VRF Coordinator
    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal virtual override {
        //  winnerIndex to be in the length from 0 to players.length-1 and for this we mod(%) it with the player.length value
        uint256 winnerIndex = randomness % players.length;
        // get the address of the winner from the players array
        address winner = players[winnerIndex];
        // send the ether in the contract to the winner
        (bool sent,) = winner.call{value: address(this).balance}("");
        require(sent, "Failed to send Ether");
        // Emit that the game has ended
        emit GameEnded(gameId, winner, requestId);
        // set the gameStarted variable to false
        gameStarted = false;
    }



    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}





    










}