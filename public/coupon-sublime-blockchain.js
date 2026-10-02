/**
 * COUP SUBLIME - Blockchain Traceability Module
 * Ledger immuable des predictions avec hash SHA-256 simule
 * SOLITAIRE HACK SIGNATURE
 */

class SublimeBlockchain {
  constructor() {
    this.chain = [];
    this.pendingTransactions = [];
    this.difficulty = 2;
    
    this.init();
  }

  init() {
    this.createGenesisBlock();
    this.generateMockChain();
    this.renderLedger();
    this.startMiningSimulation();
  }

  createGenesisBlock() {
    const genesisBlock = {
      index: 0,
      timestamp: Date.now(),
      transactions: [],
      previousHash: '0',
      hash: this.calculateHash(0, [], '0', Date.now()),
      nonce: 0
    };
    this.chain.push(genesisBlock);
  }

  calculateHash(index, transactions, previousHash, timestamp, nonce = 0) {
    // Simplified hash simulation (real implementation would use crypto.subtle)
    const data = `${index}${JSON.stringify(transactions)}${previousHash}${timestamp}${nonce}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  generateMockChain() {
    const mockTransactions = [
      { type: 'coupon', data: 'PSG vs OM - Prediction: 1', amount: 1000 },
      { type: 'validation', data: 'Ticket #12345 - Confirme', amount: 0 },
      { type: 'export', data: 'Export Telegram - Image HD', amount: 0 },
      { type: 'coupon', data: 'Real vs Barca - Prediction: X2', amount: 2500 },
      { type: 'win', data: 'Gain realise: 5,200 FCFA', amount: 5200 },
      { type: 'strategy', data: 'Strategy shared: Safe & Steady', amount: 0 }
    ];

    mockTransactions.forEach((tx, i) => {
      this.addTransaction(tx);
      this.minePendingTransactions();
    });
  }

  addTransaction(transaction) {
    this.pendingTransactions.push({
      ...transaction,
      id: this.generateTransactionId(),
      timestamp: Date.now()
    });
  }

  generateTransactionId() {
    return 'tx_' + Math.random().toString(36).substr(2, 16);
  }

  minePendingTransactions() {
    if (this.pendingTransactions.length === 0) return;

    const previousBlock = this.chain[this.chain.length - 1];
    const newBlock = this.createBlock(previousBlock);
    
    this.chain.push(newBlock);
    this.pendingTransactions = [];

    return newBlock;
  }

  createBlock(previousBlock) {
    let nonce = 0;
    let hash;
    const timestamp = Date.now();
    const index = this.chain.length;

    // Simplified proof of work
    do {
      hash = this.calculateHash(index, this.pendingTransactions, previousBlock.hash, timestamp, nonce);
      nonce++;
    } while (!hash.startsWith('0'.repeat(this.difficulty)));

    return {
      index,
      timestamp,
      transactions: [...this.pendingTransactions],
      previousHash: previousBlock.hash,
      hash,
      nonce: nonce - 1
    };
  }

  startMiningSimulation() {
    // Update blockchain stats periodically
    setInterval(() => {
      this.updateStats();
    }, 5000);
  }

  updateStats() {
    const txCount = document.getElementById('bcTxCount');
    const hashRate = document.getElementById('bcHashRate');
    const lastBlock = document.getElementById('bcLastBlock');

    if (txCount) {
      const current = parseInt(txCount.textContent) || 0;
      txCount.textContent = current + Math.floor(Math.random() * 3);
    }

    if (hashRate) {
      const rate = (2 + Math.random()).toFixed(1);
      hashRate.textContent = `${rate} TH/s`;
    }

    if (lastBlock && this.chain.length > 0) {
      lastBlock.textContent = `#${(884291 + this.chain.length).toLocaleString()}`;
    }
  }

  renderLedger() {
    const container = document.getElementById('ledgerList');
    if (!container) return;

    // Show last 5 blocks
    const recentBlocks = this.chain.slice(-5).reverse();

    container.innerHTML = recentBlocks.map(block => `
      <div class="ledger-item">
        <div class="ledger-hash">${this.shortenHash(block.hash)}</div>
        <div class="ledger-info">
          <div class="ledger-tx">${block.transactions.length} transaction${block.transactions.length > 1 ? 's' : ''}</div>
          <div class="ledger-time">${this.formatTime(block.timestamp)}</div>
        </div>
        <div class="ledger-status confirmed">Confirme</div>
      </div>
    `).join('');
  }

  shortenHash(hash) {
    return hash.substr(0, 8) + '...' + hash.substr(-8);
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Maintenant';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return date.toLocaleDateString('fr-FR');
  }

  verifyChain() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      if (current.previousHash !== previous.hash) {
        return false;
      }

      if (current.hash !== this.calculateHash(
        current.index,
        current.transactions,
        current.previousHash,
        current.timestamp,
        current.nonce
      )) {
        return false;
      }
    }
    return true;
  }

  addRealTransaction(type, data, amount = 0) {
    this.addTransaction({ type, data, amount });
    const newBlock = this.minePendingTransactions();
    this.renderLedger();
    
    if (newBlock) {
      this.showToast(`Transaction enregistree - Block #${newBlock.index}`, 'success');
    }
  }

  showToast(message, type = 'info') {
    if (window.sublimeApp) {
      window.sublimeApp.showToast(message, type);
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.sublimeBlockchain = new SublimeBlockchain();
});

window.SublimeBlockchain = SublimeBlockchain;
