// General page interactions, independent of the point-cloud renderer.
(function () {
'use strict';
  function initStageCards() {
    var cards = document.querySelectorAll('.ostage');

    cards.forEach(function (card) {
      var head = card.querySelector('.ostage-head');
      if (!head) return;

      head.addEventListener('click', function () {
        var isOpen = card.classList.toggle('open');
        head.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });

    // 默认展开 (b)
    var defaultOpen = document.querySelector('.ostage[data-stage="b"]');
    if (defaultOpen) {
      defaultOpen.classList.add('open');
      var dHead = defaultOpen.querySelector('.ostage-head');
      if (dHead) dHead.setAttribute('aria-expanded', 'true');
    }
  }

  initStageCards();

  var toTop = document.getElementById('toTop');
  window.addEventListener('scroll', function () {
    if (document.documentElement.scrollTop > 700) toTop.classList.add('show');
    else toTop.classList.remove('show');
  }, { passive: true });

  toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

})();
