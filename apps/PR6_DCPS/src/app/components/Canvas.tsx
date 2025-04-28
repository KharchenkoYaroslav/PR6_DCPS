import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  memo,
} from 'react';
import styles from '../page.module.scss';
import { Cell, Field } from '@/types/types';

const CELL_SIZE = 25;

interface CanvasProps {
  field: Field;
  onCellClick: (cell: Cell) => void;
  isRunning: boolean;
}

export interface CanvasRef {
  centerCanvas: () => void;
  updateCells: (updatedCellsMap: Record<string, Cell>) => void;
}

const Canvas = forwardRef<CanvasRef, CanvasProps>(
  ({ field, onCellClick, isRunning }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const cellsRef = useRef<Cell[]>(field.cells);
    const coordMapRef = useRef<Map<string, number>>(field.coordMap);
    const cellCacheRef = useRef<Map<number, { x: number; y: number }>>(
      new Map()
    );
    const transformRef = useRef({
      offsetX: 0,
      offsetY: 0,
      scale: 1,
    });

    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

    const drawCell = useCallback(
      (
        ctx: CanvasRenderingContext2D,
        cell: Cell,
        size: number,
        x: number,
        y: number,
        Full: boolean
      ) => {
        if (cell.state === 'B' && !Full) {
          ctx.fillStyle = '#FF4500';
        } else if (cell.state === 'E' || (cell.state === 'B' && Full)) {
          ctx.fillStyle = '#8B4513';

        } else if (cell.state === 'T') {
          ctx.fillStyle = '#90EE90';

        } else {
          ctx.fillStyle = 'gray';

        }
        if (!Full && cell.state === 'B') {
          ctx.fillRect(x+0.5, y+0.5, size-1, size-1);
        } else {
          ctx.fillRect(x+0.1, y+0.1, size-0.2, size-0.2);
        }
      },
      []
    );

    const drawFullGrid = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = ctxRef.current || canvas.getContext('2d');
      if (!ctx) return;
      ctxRef.current = ctx;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const { offsetX, offsetY, scale } = transformRef.current;
      const halfArea = Math.floor(field.width / 2);
      const totalSize = field.width * CELL_SIZE * scale;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        offsetX - halfArea * CELL_SIZE * scale,
        offsetY - halfArea * CELL_SIZE * scale,
        totalSize,
        totalSize
      );

      cellsRef.current.forEach((cell) => {
        const { offsetX, offsetY, scale } = transformRef.current;
        const size = CELL_SIZE * scale;
        const x = offsetX + cell.x * CELL_SIZE * scale;
        const y = offsetY + cell.y * CELL_SIZE * scale;
        drawCell(ctx, cell, size, x, y, isRunning);
      });


    }, [field.width, drawCell, isRunning]);

    const setScale = useCallback(
      (newScale: number) => {
        transformRef.current.scale = newScale;
        drawFullGrid();
      },
      [drawFullGrid]
    );

    useEffect(() => {
      cellsRef.current = field.cells;
      coordMapRef.current = field.coordMap;
      const cache = new Map<number, { x: number; y: number }>();

      field.cells.forEach((cell, index) => {
        cache.set(index, { x: cell.x, y: cell.y });
      });

      cellCacheRef.current = cache;
      if (!isRunning) {
        drawFullGrid();
      }
    }, [field, drawFullGrid, isRunning]);

    const centerCanvas = useCallback(() => {
      if (canvasRef.current) {
        transformRef.current = {
          offsetX: canvasRef.current.width / 2,
          offsetY: canvasRef.current.height / 2,
          scale: transformRef.current.scale
        };

        drawFullGrid();
      }
    }, [drawFullGrid]);

    const updateCells = useCallback(
      (updatedCellsMap: Record<string, Cell>) => {
        const ctx = ctxRef.current;

        if (!ctx) return;

        const { offsetX, offsetY, scale } = transformRef.current;
        const size = CELL_SIZE * scale;

        Object.entries(updatedCellsMap).forEach(([key, cell]) => {
          const x = offsetX + cell.x * CELL_SIZE * scale;
          const y = offsetY + cell.y * CELL_SIZE * scale;

          drawCell(ctx, cell, size, x, y, false);
        });


      },
      [drawCell]
    );

    useImperativeHandle(
      ref,
      () => ({
        centerCanvas,
        updateCells,
      }),
      [centerCanvas, updateCells]
    );

    const getCellAtPosition = useCallback(
      (clientX: number, clientY: number): Cell | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const { offsetX, offsetY, scale } = transformRef.current;

        const worldX = Math.floor((x - offsetX) / (CELL_SIZE * scale));
        const worldY = Math.floor((y - offsetY) / (CELL_SIZE * scale));

        const halfArea = Math.floor(field.width / 2);
        if (Math.abs(worldX) > halfArea || Math.abs(worldY) > halfArea) {
          return null;
        }

        const index = coordMapRef.current.get(`${worldX},${worldY}`);
        return index !== undefined ? cellsRef.current[index] : null;
      },
      [field.width]
    );

    const handleCellClick = useCallback(
      (e: MouseEvent) => {
        if (isDragging || isRunning) return;

        e.preventDefault();

        const cell = getCellAtPosition(e.clientX, e.clientY);
        if (cell) {
          onCellClick(cell);
        }
      },
      [isDragging, isRunning, getCellAtPosition, onCellClick]
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        centerCanvas();
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }, [centerCanvas]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const handleMouseDown = (e: MouseEvent) => {
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;

        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;

        transformRef.current.offsetX += dx;
        transformRef.current.offsetY += dy;

        setLastMousePos({ x: e.clientX, y: e.clientY });

        drawFullGrid();
      };

      const handleMouseUp = () => {
        setIsDragging(false);
      };

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const { offsetX, offsetY, scale } = transformRef.current;
        const worldX = (mouseX - offsetX) / scale;
        const worldY = (mouseY - offsetY) / scale;

        const newScale = Math.max(0.1, Math.min(5, scale * delta));

        transformRef.current = {
          offsetX: mouseX - worldX * newScale,
          offsetY: mouseY - worldY * newScale,
          scale: newScale,
        };

        setScale(newScale);
      };

      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('click', handleCellClick);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('wheel', handleWheel, { passive: false });

      return () => {
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('click', handleCellClick);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        canvas.removeEventListener('wheel', handleWheel);
      };
    }, [isDragging, lastMousePos, handleCellClick, setScale, drawFullGrid]);

    return <canvas ref={canvasRef} className={styles.canvas} />;
  }
);

Canvas.displayName = 'Canvas';

export default memo(Canvas);
