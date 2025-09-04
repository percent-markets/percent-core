export interface IAMM {
  fetchPrice(): Promise<void>;
  addLiquidity(): Promise<void>;
  removeLiquidity(): Promise<void>;
  executeTrade(): Promise<void>;
  fetchLPStatus(): Promise<void>;
  fetchStatus(): Promise<void>;
}