/* กันการซูมหน้าเว็บ (pinch / double-tap / Ctrl+ล้อเมาส์ / Ctrl +,-,0) */
(function () {
  var stop = function (e) { e.preventDefault(); };
  var opt = { passive: false };

  // iOS Safari ไม่สนใจ user-scalable=no จึงต้องกันท่า pinch เอง
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) {
    document.addEventListener(n, stop, opt);
  });

  // pinch ด้วยสองนิ้วบน Android/เบราว์เซอร์อื่น
  document.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, opt);

  // Ctrl + ล้อเมาส์ / pinch บนทัชแพด
  document.addEventListener('wheel', function (e) {
    if (e.ctrlKey) e.preventDefault();
  }, opt);

  // Ctrl/Cmd + (+ - 0)
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].indexOf(e.key) > -1) e.preventDefault();
  });
})();
