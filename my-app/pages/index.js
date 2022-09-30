import { BigNumber, Contract, ethers, providers, utils } from "ethers";
import Head from "next/head";
import React, { useEffect, useRef, useState } from "react";
import Web3Modal from "web3modal";
import { abi, RANDOM_GAME_NFT_CONTRACT_ADDRESS } from "../constants";
import { FETCH_CREATED_GAME } from "../queries";
import styles from "../styles/Home.module.css";
import { subgraphQuery } from "../utils";

export default function Home() {

  const zero = BigNumber.from("0");
  // walletConnected keep track of whether the user's wallet is connected or not
  const [walletConnected, setWalletConnected] = useState(false);
  // loading is set to true when we are waiting for a transaction to get mined
  const [loading, setLoading] = useState(false);
  // boolean to keep track of whether the current connected account is owner or not
  const [isOwner, setIsOwner] = useState(false);
  // entryFee is the ether required to enter a game
  const [entryFee, setEntryFee] = useState(zero);
  // maxPlayers is the max number of players that can play the game
  const [maxPlayers, setMaxPlayers] = useState(0);
  // Checks if a game started or not
  const [gameStarted, setGameStarted] = useState(false);
  // Players that joined the game
  const [players, setPlayers] = useState([]);
  // Winner of the game
  const [winner, setWinner] = useState();
  // Keep a track of all the logs for a given game
  const [logs, setLogs] = useState([]);
  // Create a reference to the Web3 Modal (used for connecting to Metamask) which persists as long as the page is open
  const web3ModalRef = useRef();

  // This is used to force react to re render the page when we want to
  // in our case we will use force update to show new logs
  const forceUpdate = React.useReducer(() => ({}), {})[1];



  const getProviderOrSigner = async (needSigner = false) => {
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    const { chainId } = await web3Provider.getNetwork();
    if (chainId !== 80001) {
      window.alert("CHange the network to Mumbai");
      throw new Error("Change network to Mumbai");
    }

    if (needSigner) {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  }




  const connectWallet = async () => {
    try {
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (error) {
      console.error(error)
    }
  }



  useEffect(() => {
    if (!walletConnected) {
      // Assign the Web3Modal class to the reference object by setting it's `current` value
      // The `current` value is persisted throughout as long as this page is open
      web3ModalRef.current = new Web3Modal({
        network: "mumbai",
        providerOptions: {},
        disableInjectedProvider: false,
      });
      connectWallet();
      getOwner();
      checkIfGameStarted();
      setInterval(() => {
        checkIfGameStarted();
      }, 2000);
    }
  }, [walletConnected]);




  // This is called by the owner to start the game
  const startGame = async () => {
    try {
      const signer = await getProviderOrSigner(true);

      const randomGameNFTContract = new Contract (
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        signer
      );
      setLoading(true);
      const tx = await randomGameNFTContract.startGame(maxPlayers, entryFee);
      await tx.wait();
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  }



  const joinGame = async () => {
    try {
      const signer = await getProviderOrSigner(true);

      const randomGameNFTContract = new Contract(
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        signer
      );
      setLoading(true);
      const tx = await randomGameNFTContract.joinGame({
        value: entryFee,
      });
      await tx.wait();
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  }



  // checks if the game has started or not and intializes the logs for the game
  const checkIfGameStarted = async () => {
    try {
      const provider = await getProviderOrSigner();

      const randomGameNFTContract = new Contract(
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        provider
      );

      // read the gameStarted boolean from the contract
      const _gameStarted = await randomGameNFTContract.gameStarted();

      const _gameArray = await subgraphQuery(FETCH_CREATED_GAME());
      const _game = _gameArray.games[0];
      let _logs = [];

      // Initialize the logs array and query the graph for current gameID
      if (_gameStarted) {
        _logs = [`Game has started with ID: ${_game.id}`];
        if (_game.players && _game.players.length > 0) {
          _logs.push(
            `${_game.players.length} / ${_game.maxPlayers} already joined 👀 `
          );
          _game.players.forEach((player) => {
            _logs.push(`${player} joined 🏃‍♂️`);
          });
        }
        setEntryFee(BigNumber.from(_game.entryFee));
        setMaxPlayers(_game.maxPlayers);
      } else if (!gameStarted && _game.winner) {
        _logs = [
          `Last game has ended with ID: ${_game.id}`,
          `Winner is: ${_game.winner} 🎉 `,
          `Waiting for host to start new game....`,
        ];

        setWinner(_game.winner);
      }
      setLogs(_logs);
      setPlayers(_game.players);
      setGameStarted(_gameStarted);
      forceUpdate();

    } catch (error) {
      console.error(error);
    }
  }



  // calls the contract to retrieve the owner
  const getOwner = async () => {
    try {
      const provider = await getProviderOrSigner();
      const randomGameNFTContract = new Contract(
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        provider
      );
      const _owner = await randomGameNFTContract.owner();
      const signer = await getProviderOrSigner(true);
      const address = await signer.getAddress();
      if (address.toLowerCase() === _owner.toLowerCase()) {
        setIsOwner(true);
      }
    } catch (err) {
      console.error(err.message)
    }
  }



  const renderButton = () => {
    // If wallet is not connected, return a button which allows them to connect their wllet
    if (!walletConnected) {
      return (
        <button onClick={connectWallet} className={styles.button}>
          Connect your wallet
        </button>
      );
    }

    if (loading) {
      return <button className={styles.button}>Loading...</button>;
    }


    if (gameStarted) {
      if (players.length === maxPlayers) {
        return (
          <button className={styles.button} disabled>
            Choosing winner...
          </button>
        );
      }
      return (
        <div>
          <button className={styles.button} onClick={joinGame}>
            Join Game 🚀
          </button>
        </div>
      );
    }


     // Start the game
     if (isOwner && !gameStarted) {
      return (
        <div>
          <input
            type="number"
            className={styles.input}
            onChange={(e) => {
              // The user will enter the value in ether, we will need to convert
              // it to WEI using parseEther
              setEntryFee(
                e.target.value >= 0
                  ? utils.parseEther(e.target.value.toString())
                  : zero
              );
            }}
            placeholder="Entry Fee (ETH)"
          />
          <input
            type="number"
            className={styles.input}
            onChange={(e) => {
              // The user will enter the value in ether, we will need to convert
              // it to WEI using parseEther
              setMaxPlayers(e.target.value ?? 0);
            }}
            placeholder="Max players"
          />
          <button className={styles.button} onClick={startGame}>
            Start Game 🚀
          </button>
        </div>
      );
    }
  };


  return (
    <div>
      <Head>
        <title>Random Winner Game</title>
        <meta name="description" content="LW3Punks-Dapp" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Random Winner Game!</h1>
          <div className={styles.description}>
            Its a lottery game where a winner is chosen at random and wins the
            entire lottery pool
          </div>
          {renderButton()}
          {logs &&
            logs.map((log, index) => (
              <div className={styles.log} key={index}>
                {log}
              </div>
            ))}
        </div>
        <div>
          <img className={styles.image} src="./randomWinner.png" />
        </div>
      </div>

      <footer className={styles.footer}>Made with &#10084; by Elo</footer>
    </div>
  );
}

