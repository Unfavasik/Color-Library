/**
 * Desktop Shell Helper for ColorNest
 * Provides keyboard shortcuts and desktop layout responsiveness.
 */
(function () {
  'use strict';
  // Esc key closes any open overlays or dialogs
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var activeBackdrop = document.querySelector('.drawer-backdrop:not([hidden]), .me-backdrop.open');
      if (activeBackdrop && activeBackdrop.click) {
        activeBackdrop.click();
      }
    }
  });
})();
