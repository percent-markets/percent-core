import { IVault } from './types/vault.interface';

export class Vault implements IVault {
  constructor() {
    
  }

  async splitTokens(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async mergeTokens(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}