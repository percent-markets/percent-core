export interface IVault {
  splitTokens(): Promise<void>;
  mergeTokens(): Promise<void>;
}