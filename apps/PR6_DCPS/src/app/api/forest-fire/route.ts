import { NextRequest, NextResponse } from 'next/server';
import {
  calculateNextGeneration,
  findFlammableCells,
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
    const { nonTreeCells, params, coords, width, height } = body;

    if (!nonTreeCells || !params || !coords || !width || !height) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const sessionId = uuidv4();
    const cells: Cell[] = [];

    const coordMap = new Map<string, number>(Object.entries(coords));

    console.log(coordMap);
    for (const [coord, index] of coordMap.entries()) {
      const [xStr, yStr] = coord.split(',');
      const x = Number(xStr);
      const y = Number(yStr);

      const nonTreeCell = nonTreeCells.find((cell: Cell) => cell.x === x && cell.y === y);

      cells[index] = nonTreeCell || { x, y, state: 'T', burnTime: 0 };
    }

    const field: Field = {
      cells,
      width,
      height,
      coordMap,
    };

    sessions.set(sessionId, {
      field,
      params,
      coordMap,
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

          await new Promise((resolve) =>
            setTimeout(resolve, session.params.updateInterval * 1000)
          );
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
