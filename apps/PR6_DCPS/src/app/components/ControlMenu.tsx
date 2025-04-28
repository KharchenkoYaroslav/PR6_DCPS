import React from 'react';
import styles from '../page.module.scss';
import { ForestFireParams } from '@/types/types';

interface ControlMenuProps {
  params: ForestFireParams;
  onParamsChange: (params: Partial<ForestFireParams>) => void;
  isRunning: boolean;
  onToggleRunning: () => void;
  onCenter: () => void;
  onClear: () => void;
}

const ControlMenu: React.FC<ControlMenuProps> = ({
  params,
  onParamsChange,
  isRunning,
  onToggleRunning,
  onCenter,
  onClear
}) => {
  return (
    <div className={styles.controlMenu}>
      <div className={styles.inputGroup}>
        <label htmlFor="interactionArea">Область взаємодії:</label>
        <input
          id="interactionArea"
          type="number"
          value={params.interactionArea}
          onChange={(e) => onParamsChange({ interactionArea: Number(e.target.value) })}
          min="1"
          className={styles.input}
          disabled={isRunning}
        />
      </div>
      <div className={styles.inputGroup}>
        <label htmlFor="pBurn">Ймовірність загоряння:</label>
        <input
          id="pBurn"
          type="number"
          value={params.pBurn}
          onChange={(e) => onParamsChange({ pBurn: Number(e.target.value) })}
          min="0"
          max="1"
          step="0.1"
          className={styles.input}
          disabled={isRunning}
        />
      </div>
      <div className={styles.inputGroup}>
        <label htmlFor="burnTime">Час горіння:</label>
        <input
          id="burnTime"
          type="number"
          value={params.burnTime}
          onChange={(e) => onParamsChange({ burnTime: Number(e.target.value) })}
          min="1"
          className={styles.input}
          disabled={isRunning}
        />
      </div>
      <div className={styles.inputGroup}>
        <label htmlFor="updateInterval">Інтервал оновлення:</label>
        <input
          id="updateInterval"
          type="number"
          value={params.updateInterval}
          onChange={(e) => onParamsChange({ updateInterval: Number(e.target.value) })}
          min="0.1"
          step="0.1"
          className={styles.input}
          disabled={isRunning}
        />
      </div>
      <div className={styles.buttonGroup}>
        <button
          onClick={onToggleRunning}
          className={`${styles.menuButton} ${isRunning ? styles.stopButton : styles.startButton}`}
        >
          {isRunning ? 'Стоп' : 'Старт'}
        </button>
        <button
          onClick={onCenter}
          className={styles.menuButton}
        >
          Центрувати
        </button>
        <button
          onClick={onClear}
          className={styles.menuButton}
          disabled={isRunning}
        >
          Очистити
        </button>
      </div>
    </div>
  );
};

export default React.memo(ControlMenu);