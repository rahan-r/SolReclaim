# Solana Auto-Claim SOL API Server

A simple Node.js server that automatically claims back unused SOL locked in rent-exempt token accounts on the Solana blockchain with a single API call.

---

## Description

This server exposes a single API endpoint that, given a wallet public key, scans for unclosed token accounts holding SOL deposits and automatically submits transactions to close them, returning the SOL back to the wallet — **no manual confirmation required**.

---

## Installation

```bash
git clone https://github.com/rahan-r/SolReclaim.git
cd SolReclaim
npm install
npm start


## API Reference

#### Get all items


GET /close-accounts?walletPublicKey=<your-wallet-address>


| Parameter | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `api_key` | `string` | **Required**. Your API key |

#### Get item
