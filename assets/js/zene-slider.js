/* Zene: borito-korhinta + lejatszo (2026-10-18).
   Egy audio elem; a korhinta aktiv lapja adja a dalt. Ha szol valami es lapozol,
   az uj dal szol tovabb; ha all, all marad. A reszlet vegen a kovetkezo jon.
   Elgorgeteskor megall. */
(function(){
  var root = document.querySelector('.js-zene');
  if(!root || typeof Swiper === 'undefined') return;

  var audio = root.querySelector('.js-zene-audio');
  var titleEl = root.querySelector('.js-zene-title');
  var timeEl = root.querySelector('.js-zene-time');
  var progress = root.querySelector('.js-zene-progress');
  var playBtn = root.querySelector('.js-zene-play');
  var slides = Array.prototype.slice.call(root.querySelectorAll('.swiper-slide'));
  var spacer = document.querySelector('.js-zene-spacer');

  function fmt(s){
    s = Math.max(0, Math.floor(s || 0));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }
  function lang(){ return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'hu'; }

  // The page's language switch only swaps textContent; aria-labels are ours.
  function applyAria(){
    var l = lang();
    root.querySelectorAll('[data-aria-hu]').forEach(function(el){
      el.setAttribute('aria-label', el.getAttribute('data-aria-' + l));
    });
    slides.forEach(function(s){
      var img = s.querySelector('img');
      if(img) img.alt = s.getAttribute('data-title') + (l === 'en' ? ' cover' : ' borító');
    });
    playBtn.setAttribute('aria-label', playBtn.getAttribute('data-aria-' + l + (audio.paused ? '' : '-pause')));
  }

  function paintProgress(){
    var d = audio.duration || Number(progress.max) || 90;
    var t = audio.currentTime || 0;
    progress.max = d;
    progress.value = t;
    progress.style.setProperty('--p', (t / d * 100) + '%');
    timeEl.textContent = fmt(t) + ' / ' + fmt(d);
  }

  var current = -1;
  function load(i){
    var s = slides[i];
    if(!s || i === current) return;
    current = i;
    titleEl.textContent = s.getAttribute('data-title');
    audio.src = s.getAttribute('data-src');
    audio.currentTime = 0;
    paintProgress();
  }

  function setPlaying(on){
    root.classList.toggle('is-playing', on);
    applyAria();
  }
  function play(){ audio.play().catch(function(){ setPlaying(false); }); }
  function pause(){ audio.pause(); }

  var swiper = new Swiper(root.querySelector('.swiper'), {
    effect: 'coverflow',
    centeredSlides: true,
    slidesPerView: 'auto',
    initialSlide: Math.floor(root.querySelectorAll('.swiper-slide').length / 2),
    grabCursor: true,
    slideToClickedSlide: true,
    spaceBetween: 32,
    keyboard: { enabled: true, onlyInViewport: true },
    coverflowEffect: { rotate: 25, stretch: 0, depth: 60, modifier: 1, slideShadows: false }
  });

  load(swiper.activeIndex);

  swiper.on('slideChange', function(){
    var wasPlaying = !audio.paused;
    load(swiper.activeIndex);
    if(wasPlaying) play();
  });

  // Clicking the cover that is already in the middle toggles playback.
  slides.forEach(function(s, i){
    s.addEventListener('click', function(){
      if(i === swiper.activeIndex){ audio.paused ? play() : pause(); }
    });
  });

  playBtn.addEventListener('click', function(){ audio.paused ? play() : pause(); });
  root.querySelector('.js-zene-prev').addEventListener('click', function(){
    var wasPlaying = !audio.paused;
    if(audio.currentTime > 3 || swiper.activeIndex === 0){ audio.currentTime = 0; if(wasPlaying) play(); }
    else swiper.slidePrev();
  });
  root.querySelector('.js-zene-next').addEventListener('click', function(){
    if(swiper.activeIndex < slides.length - 1) swiper.slideNext();
    else swiper.slideTo(0);
  });

  audio.addEventListener('play', function(){ setPlaying(true); });
  audio.addEventListener('pause', function(){ setPlaying(false); });
  audio.addEventListener('timeupdate', paintProgress);
  audio.addEventListener('loadedmetadata', paintProgress);
  audio.addEventListener('ended', function(){
    var next = (swiper.activeIndex + 1) % slides.length;
    swiper.slideTo(next);
    load(next);
    play();
  });

  progress.addEventListener('input', function(){
    audio.currentTime = Number(progress.value);
    paintProgress();
  });

  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){
      es.forEach(function(en){ if(!en.isIntersecting) pause(); });
    }, { threshold: 0 }).observe(root);
  }

  // The red layer holds an empty block in this place; keep it the same height.
  if(spacer){
    var sync = function(){ spacer.style.height = root.offsetHeight + 'px'; };
    sync();
    if('ResizeObserver' in window) new ResizeObserver(sync).observe(root);
    else window.addEventListener('resize', sync);
  }

  new MutationObserver(applyAria).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  applyAria();
})();
