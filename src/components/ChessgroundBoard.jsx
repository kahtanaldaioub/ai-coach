import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

export default function ChessgroundBoard({ fen, orientation = 'white' }) {
  const boardRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (!boardRef.current) return;

    if (gameRef.current) {
      gameRef.current.destroy();
      gameRef.current = null;
    }

    const validFen = fen && typeof fen === 'string' && fen.split(' ').length === 6 ? fen : 'start';

    gameRef.current = Chessground(boardRef.current, {
      fen: validFen,
      orientation: orientation,
      movable: { free: false },
      drawable: { enabled: false },
      highlight: { lastMove: true, check: true },
      animation: { duration: 200 },
      viewOnly: true,
    });

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (gameRef.current && fen) {
      const validFen = fen.split(' ').length === 6 ? fen : 'start';
      gameRef.current.set({ fen: validFen });
    }
  }, [fen]);

  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.set({ orientation: orientation });
    }
  }, [orientation]);

  return (
    <div className="flex flex-col items-center w-full">
      <div
        ref={boardRef}
        className="w-full max-w-[500px] aspect-square mx-auto"
        style={{
          backgroundColor: '#302e2b',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  );
}