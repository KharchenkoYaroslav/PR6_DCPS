import { NextRequest, NextResponse } from 'next/server';
import {
  calculateNextGeneration,
  findFlammableCells,
  generateCoordMap,
} from '../../algorithm/algorithm';
import { Cell, Field, ForestFireParams } from '../../../types/types';
import { v4 as uuidv4 } from 'uuid';

const sessions = new Map<
  string,
  {
    field: Field;
    params: ForestFireParams;
    coordMap: Map<string, number>;
    abortController: AbortController;
  }
>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { field, params, coords } = body;

    if (!field || !params || !coords) {
      return NextResponse.json(
        { error: 'Missing field or params' },
        { status: 400 }
      );
    }

    const sessionId = uuidv4();
    const coordMap = new Map<string, number>(Object.entries(coords));

    // Reconstruct the full field with all cells
    const fullField: Field = {
      width: field.width,
      height: field.height,
      cells: [],
      coordMap: new Map()
    };

    // Initialize all cells as 'T' (Trees)
    const halfWidth = Math.floor(field.width / 2);
    const halfHeight = Math.floor(field.height / 2);
    const startX = -halfWidth;
    const startY = -halfHeight;
    const endX = halfWidth + (field.width % 2 === 0 ? 0 : 1);
    const endY = halfHeight + (field.height % 2 === 0 ? 0 : 1);

    // First create all cells as Trees
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        fullField.cells.push({ x, y, state: 'T', burnTime: 0 });
      }
    }

    // Then update with the non-T cells we received
    for (const cell of field.cells) {
      const coord = `${cell.x},${cell.y}`;
      const index = coordMap.get(coord);
      if (index !== undefined) {
        fullField.cells[index] = cell;
      }
    }

    // Generate the full coordMap
    fullField.coordMap = generateCoordMap(fullField.cells);

    sessions.set(sessionId, {
      field: fullField,
      params,
      coordMap: fullField.coordMap, // Use the full coordMap
      abortController: new AbortController(),
    });

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  if (!sessionId || !sessions.has(sessionId)) {
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (updatedCellsMap: Map<string, Cell>) => {
        if (session.abortController.signal.aborted) return;
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              updatedCellsMap: Object.fromEntries(updatedCellsMap),
            })}\n\n`
          )
        );
      };

      try {
        let flammableCells = findFlammableCells(session.field);

        while (!session.abortController.signal.aborted) {
          await new Promise((resolve) =>
            setTimeout(resolve, session.params.updateInterval * 1000)
          );

          const result = calculateNextGeneration(
            session.field,
            session.params,
            flammableCells,
            session.coordMap
          );

          flammableCells = result.flammableCells;

          if (result.updatedCellsMap.size > 0) {
            send(result.updatedCellsMap);
          }

          if (flammableCells.size === 0) {
            controller.enqueue(encoder.encode(`event: end\ndata: {}\n\n`));
            break;
          }
        }
      } catch (error) {
        console.error('Error in SSE loop:', error);
      } finally {
        controller.close();
        sessions.delete(sessionId);
      }
    },
    cancel() {
      session.abortController.abort();
      sessions.delete(sessionId);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export async function DELETE(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  if (!sessionId || !sessions.has(sessionId)) {
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  session.abortController.abort();
  sessions.delete(sessionId);
  return NextResponse.json({ success: true });
}
