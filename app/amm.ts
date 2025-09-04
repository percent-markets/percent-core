import { IAMM } from './types/amm.interface';

export class AMM implements IAMM {
  constructor() {
    
  }

  async fetchPrice(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async addLiquidity(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async removeLiquidity(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async executeTrade(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async fetchLPStatus(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async fetchStatus(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}