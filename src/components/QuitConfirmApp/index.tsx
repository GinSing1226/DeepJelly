import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './styles.css';

export function QuitConfirmApp() {
  const { t } = useTranslation(['confirm', 'common']);

  // Handle header drag - programmatic drag like other windows
  const handleHeaderMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }

    try {
      const window = getCurrentWindow();
      await window.startDragging();
    } catch (error) {
      console.error('[QuitConfirm] Failed to start dragging:', error);
    }
    e.preventDefault();
  }, []);

  // Handle confirm button click - close window and exit
  const handleConfirm = useCallback(async () => {
    console.log('[QuitConfirm] Confirm clicked, calling confirm_quit command...');
    try {
      // Rust command will handle closing window and exiting
      await invoke('confirm_quit');
      console.log('[QuitConfirm] confirm_quit returned (should not reach here)');
    } catch (error) {
      console.error('[QuitConfirm] Failed to quit application:', error);
    }
  }, []);

  // Handle cancel button click - just close the window
  const handleCancel = useCallback(async () => {
    console.log('[QuitConfirm] Cancel clicked, closing window...');
    try {
      await invoke('close_quit_confirm_window');
    } catch (error) {
      console.error('[QuitConfirm] Failed to close quit confirm window:', error);
    }
  }, []);

  // Handle window close event
  const handleClose = useCallback(async () => {
    console.log('[QuitConfirm] Window close requested, treating as cancel');
    await handleCancel();
  }, [handleCancel]);

  return (
    <div className="quit-confirm-window">
      <div className="quit-confirm-content">
        {/* Draggable header */}
        <div className="quit-confirm-header" onMouseDown={handleHeaderMouseDown}>
          <span className="quit-confirm-title">{t('quit_title') || t('common:quit')}</span>
        </div>

        <p>{t('quit_message')}</p>

        <div className="quit-confirm-actions">
          <button className="btn-cancel" onClick={handleCancel}>
            {t('cancel')}
          </button>
          <button className="btn-confirm" onClick={handleConfirm}>
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuitConfirmApp;
