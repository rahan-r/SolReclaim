import express from "express";
import * as dotenv from "dotenv";
dotenv.config();
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());


const chunks = (array, chunkSize = 10) => {
  let res = [];
  for (
    let currentChunk = 0;
    currentChunk < array.length;
    currentChunk += chunkSize
  ) {
    res.push(array.slice(currentChunk, currentChunk + chunkSize));
  }
  return res;
};

async function closeEmptyTokenAccounts(connection, wallet, feePayer) {
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    wallet.publicKey,
    { programId: TOKEN_PROGRAM_ID }
  );

  const filteredAccounts = tokenAccounts.value.filter(
    (account) => account.account.data.parsed.info.tokenAmount.uiAmount === 0
  );

  const transactions = [];
  const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  for (const chunk of chunks(filteredAccounts)) {
    const txn = new Transaction();
    txn.feePayer = feePayer.publicKey;
    txn.recentBlockhash = recentBlockhash;

    for (const account of chunk) {
      txn.add(
        createCloseAccountInstruction(
          account.pubkey,
          wallet.publicKey,
          wallet.publicKey
        )
      );
    }
    transactions.push(txn);
  }

  if (transactions.length > 0) {
    const signedTransactions = await wallet.signAllTransactions(transactions);
    const results = [];

    for (const signedTx of signedTransactions) {
      const serializedTransaction = signedTx.serialize();
      try {
        const txid = await connection.sendRawTransaction(serializedTransaction);
        results.push({ status: "success", txid });
      } catch (error) {
        results.push({ status: "error", error: error.message });
      }
    }
    return results;
  } else {
    return [
      {
        status: "success",
        message: "No zero-balance token accounts found to close.",
      },
    ];
  }
}

app.get("/close-accounts", async (req, res) => {
  try {
    const cluster = process.env.SOLANA_CLUSTER || "devnet";
    const connection = new Connection(clusterApiUrl(cluster), "confirmed");

    const feePayerSecretKey = process.env.FEE_PAYER_SECRET_KEY;
    if (!feePayerSecretKey) {
      throw new Error("FEE_PAYER_SECRET_KEY is not set in the .env file");
    }
    const feePayer = Keypair.fromSecretKey(bs58.decode(feePayerSecretKey));

    const walletPublicKeyString = req.query.walletPublicKey;
    if (!walletPublicKeyString) {
      return res
        .status(400)
        .json({
          status: "error",
          message: "Missing walletPublicKey query parameter",
        });
    }

    try {
      new PublicKey(walletPublicKeyString);
    } catch (error) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid walletPublicKey format" });
    }
    const walletPublicKey = new PublicKey(walletPublicKeyString);

    const dummyWallet = {
      publicKey: walletPublicKey,
      async signTransaction(tx) {
        tx.sign(feePayer);
        return tx;
      },
      async signAllTransactions(txs) {
        return txs.map((tx) => {
          tx.sign(feePayer);
          return tx;
        });
      },
    };

    const results = await closeEmptyTokenAccounts(
      connection,
      dummyWallet,
      feePayer
    );
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
