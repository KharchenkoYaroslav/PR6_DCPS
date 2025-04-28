'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './page.module.scss';
import { Cell, Field, ForestFireParams, ForestFireState } from '../types/types';
import Canvas, { CanvasRef } from './components/Canvas';
import ControlMenu from './components/ControlMenu';
import { generateCoordMap } from './algorithm/algorithm';


const initializeField = (interactionArea: number): Field => {
  const cells: Cell[] = [];

  const halfArea = Math.floor(interactionArea / 2);
  const startX = -halfArea;
  const startY = -halfArea;
  const endX = halfArea + (interactionArea % 2 === 0 ? 0 : 1);
  const endY = halfArea + (interactionArea % 2 === 0 ? 0 : 1);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      cells.push({ x, y, state: 'T', burnTime: 0 });
    }
  }

  return { cells, width: interactionArea, height: interactionArea, coordMap: generateCoordMap(cells) };
};

const Page: React.FC = () => {
  const [state, setState] = useState<ForestFireState>(() => {
    const initialParams = {
      pBurn: 0.3,
      burnTime: 3,
      interactionArea: 20,
      updateInterval: 0.1,
    };
    return {
      isRunning: false,
      params: initialParams,
      field: initializeField(initialParams.interactionArea),
    };
  });

  const [sessionId, setSessionId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const canvasRef = useRef<CanvasRef>(null);

  const startSimulation = useCallback(async () => {
    try {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setState((prev) => ({ ...prev, isRunning: true }));

      const response = await fetch('/api/forest-fire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field: state.field,
          params: state.params,
          coords: Object.fromEntries(state.field.coordMap),
        }),
        signal: AbortSignal.timeout(30000),
      });

      const data = await response.json();

      if (!response.ok || !data.sessionId) {
        throw new Error(data.error || 'Failed to start simulation');
      }

      setSessionId(data.sessionId);

      const eventSource = new EventSource(
        `/api/forest-fire?sessionId=${data.sessionId}`
      );
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const { updatedCellsMap } = JSON.parse(event.data) as {
          updatedCellsMap: Record<string, Cell>;
        };

        canvasRef.current?.updateCells(updatedCellsMap);

        setState((prev) => {
          const newCells = prev.field.cells.slice();
          const { coordMap } = prev.field;

          for (const coord in updatedCellsMap) {
            const index = coordMap.get(coord);
            if (index !== undefined) {
              newCells[index] = updatedCellsMap[coord];
            }
          }

          return {
            ...prev,
            field: {
              ...prev.field,
              cells: newCells,
            },
          };
        });
      };

      eventSource.addEventListener('end', () => {
        setState((prev) => ({
          ...prev,
          isRunning: false,
        }));
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        setSessionId(null);
      });

      eventSource.onerror = () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        setState((prev) => ({ ...prev, isRunning: false }));
        setSessionId(null);
      };
    } catch (error) {
      console.error('Error starting simulation:', error);
      setState((prev) => ({ ...prev, isRunning: false }));
      setSessionId(null);
    }
  }, [state.field, state.params]);

  const stopSimulation = useCallback(async () => {
    try {
      if (sessionId) {
        await fetch(`/api/forest-fire?sessionId=${sessionId}`, {
          method: 'DELETE',
          signal: AbortSignal.timeout(30000),
        });
      }
    } catch (error) {
      console.error('Error stopping simulation:', error);
    } finally {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setState((prev) => ({ ...prev, isRunning: false }));
      setSessionId(null);
    }
  }, [sessionId]);

  const handleCellClick = useCallback(
    (cell: Cell) => {
      if (state.isRunning) return;
      setState((prev) => ({
        ...prev,
        field: {
          ...prev.field,
          cells: prev.field.cells.map((c) =>
            c.x === cell.x && c.y === cell.y
              ? {
                  ...c,
                  state: c.state === 'T' ? 'B' : c.state === 'B' ? 'E' : 'T',
                }
              : c
          ),
        },
      }));
    },
    [state.isRunning]
  );

  const handleToggleRunning = useCallback(async () => {
    if (state.isRunning) {
      await stopSimulation();
    } else {
      await startSimulation();
    }
  }, [state.isRunning, startSimulation, stopSimulation]);

  const handleParamsChange = useCallback(
    (newParams: Partial<ForestFireParams>) => {
      setState((prev) => {
        const updatedParams = { ...prev.params, ...newParams };

        if ('interactionArea' in newParams && !prev.isRunning) {
          return {
            ...prev,
            params: updatedParams,
            field: initializeField(updatedParams.interactionArea),
          };
        }

        return {
          ...prev,
          params: updatedParams,
        };
      });
    },
    []
  );

  const handleClear = useCallback(() => {
    if (state.isRunning) return;
    setState((prev) => ({
      ...prev,
      field: initializeField(prev.params.interactionArea),
    }));
  }, [state.isRunning]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className={styles.page}>
      <Canvas
        ref={canvasRef}
        field={state.field}
        onCellClick={handleCellClick}
        isRunning={state.isRunning}
      />
      <ControlMenu
        params={state.params}
        onParamsChange={handleParamsChange}
        isRunning={state.isRunning}
        onToggleRunning={handleToggleRunning}
        onCenter={() => canvasRef.current?.centerCanvas()}
        onClear={handleClear}
      />
    </div>
  );
};

export default Page;