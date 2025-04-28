export type CellState = 'T' | 'B' | 'E';

export interface Cell {
  state: CellState;
  x: number;
  y: number;
  burnTime: number;
}

export interface Field {
  cells: Cell[];
  width: number;
  height: number;
  coordMap: Map<string, number>;
}

export interface ForestFireParams {
  pBurn: number;
  burnTime: number;
  interactionArea: number;
  updateInterval: number;
}

export interface ForestFireState {
  isRunning: boolean;
  params: ForestFireParams;
  field: Field;
}
