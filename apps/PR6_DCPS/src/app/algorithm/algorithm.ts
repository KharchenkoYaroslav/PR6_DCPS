import { Cell, Field, ForestFireParams } from '../../types/types';

function getNeighborIndices(
  cell: Cell,
  coordMap: Map<string, number>
): number[] {
  const neighbors: number[] = [];
  const directions = [
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ];

  for (const dir of directions) {
    const nx = cell.x + dir.x;
    const ny = cell.y + dir.y;
    const key = `${nx},${ny}`;
    const neighborIndex = coordMap.get(key);
    if (neighborIndex !== undefined) {
      neighbors.push(neighborIndex);
    }
  }

  return neighbors;
}

export function generateCoordMap(cells: Cell[]): Map<string, number> {
  const coordMap = new Map<string, number>();
  cells.forEach((cell, index) =>
    coordMap.set(`${cell.x},${cell.y}`, index)
  );
  return coordMap;
}

export function findFlammableCells(field: Field): Set<number> {
  const burningCells = new Set<number>();

  for (let i = 0; i < field.cells.length; i++) {
    if (field.cells[i].state === 'B') {
      burningCells.add(i);
    }
  }

  return burningCells;
}

export function calculateNextGeneration(
  field: Field,
  params: ForestFireParams,
  flammableCells: Set<number>,
  coordMap: Map<string, number>
): { flammableCells: Set<number>; updatedCellsMap: Map<string, Cell> } {
  const cellsToCheck = new Set<number>();
  const updatedCells: Cell[] = [];

  for (const i of flammableCells) {
    const cell = field.cells[i];
    const burnTime = (cell.burnTime || 0) + 1;

    if (burnTime > params.burnTime) {
      const updated: Cell = { ...cell, state: 'E', burnTime: 0 };
      field.cells[i] = updated;
      updatedCells.push(updated);
      flammableCells.delete(i);
    } else {
      const updated = { ...cell, burnTime };
      field.cells[i] = updated;
      updatedCells.push(updated);

      for (const neighborIndex of getNeighborIndices(cell, coordMap)) {
        if (field.cells[neighborIndex].state === 'T') {
          cellsToCheck.add(neighborIndex);
        }
      }
    }
  }

  for (const i of cellsToCheck) {
    if (Math.random() < params.pBurn) {
      const cell = field.cells[i];
      const updated: Cell = { ...cell, state: 'B', burnTime: 0 };
      field.cells[i] = updated;
      updatedCells.push(updated);
      flammableCells.add(i);
    }
  }

  const updatedCellsMap = new Map<string, Cell>();
  updatedCells.forEach((cell, idx) => {
    updatedCellsMap.set(`${cell.x},${cell.y}`, cell);
  });

  return {
    flammableCells,
    updatedCellsMap
  };
}
