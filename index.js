/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // Grab elements from DOM.
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // Detect desktop or mobile mode.
  if (window.matchMedia) {
    var setMode = function() {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    setMode();
    mql.addListener(setMode);
  } else {
    document.body.classList.add('desktop');
  }

  // Detect whether we are on a touch device.
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });
  window.closeOverlay = function () {
  document.getElementById('interactiveOverlay').classList.add('hidden');
  resetZoom();
  activeZoomImg = null;
};
  // Use tooltip fallback mode on IE < 11.
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Viewer options.
  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    }
  };

  // Initialize viewer.
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // Create scenes.
  var scenes = data.scenes.map(function(data) {
    var urlPrefix = "tiles";
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + "/" + data.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: urlPrefix + "/" + data.id + "/preview.jpg" });
    var geometry = new Marzipano.CubeGeometry(data.levels);

    var limiter = Marzipano.RectilinearView.limit.traditional(data.faceSize, 100*Math.PI/180, 120*Math.PI/180);
    var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });
    // Create link hotspots.
    data.linkHotspots.forEach(function(hotspot) {
      var element = createLinkHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    // Create info hotspots.
    data.infoHotspots.forEach(function(hotspot) {
      var element = createInfoHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    data.interactiveHotspots.forEach(function(hotspot) {
  let element;
  if (hotspot.type === "gallery") {
    element = createGalleryHotspotElement(hotspot);
  } else {
    element = createInteractiveHotspotElement(hotspot);
  }
  scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
});

    return {
      data: data,
      scene: scene,
      view: view
    };
  });

  // Set up autorotate, if enabled.
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.03,
    targetPitch: 0,
    targetFov: Math.PI/2
  });
  if (data.settings.autorotateEnabled) {
    autorotateToggleElement.classList.add('enabled');
  }

  // Set handler for autorotate toggle.
  autorotateToggleElement.addEventListener('click', toggleAutorotate);

  // Set up fullscreen mode, if supported.
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() {
      screenfull.toggle();
    });
    screenfull.on('change', function() {
      if (screenfull.isFullscreen) {
        fullscreenToggleElement.classList.add('enabled');
      } else {
        fullscreenToggleElement.classList.remove('enabled');
      }
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // Set handler for scene list toggle.
  sceneListToggleElement.addEventListener('click', toggleSceneList);

  // Start with the scene list open on desktop.
  if (!document.body.classList.contains('mobile')) {
    showSceneList();
  }

  // Set handler for scene switch.
  scenes.forEach(function(scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    el.addEventListener('click', function() {
      switchScene(scene);
      // On mobile, hide scene list after selecting a scene.
      if (document.body.classList.contains('mobile')) {
        hideSceneList();
      }
    });
  });

  // DOM elements for view controls.
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  var viewInElement = document.querySelector('#viewIn');
  var viewOutElement = document.querySelector('#viewOut');

  // Dynamic parameters for controls.
  var velocity = 0.7;
  var friction = 3;

  // Associate view controls with elements.
  var controls = viewer.controls();
  controls.registerMethod('upElement',    new Marzipano.ElementPressControlMethod(viewUpElement,     'y', -velocity, friction), true);
  controls.registerMethod('downElement',  new Marzipano.ElementPressControlMethod(viewDownElement,   'y',  velocity, friction), true);
  controls.registerMethod('leftElement',  new Marzipano.ElementPressControlMethod(viewLeftElement,   'x', -velocity, friction), true);
  controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement,  'x',  velocity, friction), true);
  controls.registerMethod('inElement',    new Marzipano.ElementPressControlMethod(viewInElement,  'zoom', -velocity, friction), true);
  controls.registerMethod('outElement',   new Marzipano.ElementPressControlMethod(viewOutElement, 'zoom',  velocity, friction), true);

  function sanitize(s) {
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
  }

  function switchScene(scene) {
    stopAutorotate();
    scene.view.setParameters(scene.data.initialViewParameters);
    scene.scene.switchTo();
    startAutorotate();
    updateSceneName(scene);
    updateSceneList(scene);
  }

  function updateSceneName(scene) {
    sceneNameElement.innerHTML = sanitize(scene.data.name);
  }

  function updateSceneList(scene) {
    for (var i = 0; i < sceneElements.length; i++) {
      var el = sceneElements[i];
      if (el.getAttribute('data-id') === scene.data.id) {
        el.classList.add('current');
      } else {
        el.classList.remove('current');
      }
    }
  }

  function showSceneList() {
    sceneListElement.classList.add('enabled');
    sceneListToggleElement.classList.add('enabled');
  }

  function hideSceneList() {
    sceneListElement.classList.remove('enabled');
    sceneListToggleElement.classList.remove('enabled');
  }

  function toggleSceneList() {
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  }

  function startAutorotate() {
    if (!autorotateToggleElement.classList.contains('enabled')) {
      return;
    }
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  function openOverlay() {
  document.getElementById('interactiveOverlay').classList.remove('hidden');
}


  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  function toggleAutorotate() {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  }

  function createLinkHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('link-hotspot');

    // Create image element.
    var icon = document.createElement('img');
    icon.src = 'img/link.png';
    icon.classList.add('link-hotspot-icon');

    // Set rotation transform.
    var transformProperties = [ '-ms-transform', '-webkit-transform', 'transform' ];
    for (var i = 0; i < transformProperties.length; i++) {
      var property = transformProperties[i];
      icon.style[property] = 'rotate(' + hotspot.rotation + 'rad)';
    }

    // Add click event handler.
    wrapper.addEventListener('click', function() {
      switchScene(findSceneById(hotspot.target));
    });

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    // Create tooltip element.
    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip');
    tooltip.classList.add('link-hotspot-tooltip');
    tooltip.innerHTML = findSceneDataById(hotspot.target).name;

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);

    return wrapper;
  }
  function createInteractiveHotspotElement(hotspot) {

    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('interactive-hotspot');

    var icon = document.createElement('img');
    icon.src = 'img/info.png';

    wrapper.appendChild(icon);

    wrapper.addEventListener('click', function() {
      openWall(hotspot);
    });

    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }
  function createInfoHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('info-hotspot');

    // Create hotspot/tooltip header.
    var header = document.createElement('div');
    header.classList.add('info-hotspot-header');

    // Create image element.
    var iconWrapper = document.createElement('div');
    iconWrapper.classList.add('info-hotspot-icon-wrapper');
    var icon = document.createElement('img');
    icon.src = 'img/info.png';
    icon.classList.add('info-hotspot-icon');
    iconWrapper.appendChild(icon);

    // Create title element.
    var titleWrapper = document.createElement('div');
    titleWrapper.classList.add('info-hotspot-title-wrapper');
    var title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.innerHTML = hotspot.title;
    titleWrapper.appendChild(title);

    // Create close element.
    var closeWrapper = document.createElement('div');
    closeWrapper.classList.add('info-hotspot-close-wrapper');
    var closeIcon = document.createElement('img');
    closeIcon.src = 'img/close.png';
    closeIcon.classList.add('info-hotspot-close-icon');
    closeWrapper.appendChild(closeIcon);

    // Construct header element.
    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    header.appendChild(closeWrapper);

    // Create text element.
    var text = document.createElement('div');
    text.classList.add('info-hotspot-text');
    text.innerHTML = hotspot.text;

    // Place header and text into wrapper element.
    wrapper.appendChild(header);
    wrapper.appendChild(text);

    // Create a modal for the hotspot content to appear on mobile mode.
    var modal = document.createElement('div');
    modal.innerHTML = wrapper.innerHTML;
    modal.classList.add('info-hotspot-modal');
    document.body.appendChild(modal);

    var toggle = function() {
      wrapper.classList.toggle('visible');
      modal.classList.toggle('visible');
    };

    // Show content when hotspot is clicked.
    wrapper.querySelector('.info-hotspot-header').addEventListener('click', toggle);

    // Hide content when close icon is clicked.
    modal.querySelector('.info-hotspot-close-wrapper').addEventListener('click', toggle);

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }

  // Prevent touch and scroll events from reaching the parent element.
  function stopTouchAndScrollEventPropagation(element, eventList) {
    var eventList = [ 'touchstart', 'touchmove', 'touchend', 'touchcancel',
                      'wheel', 'mousewheel' ];
    for (var i = 0; i < eventList.length; i++) {
      element.addEventListener(eventList[i], function(event) {
        event.stopPropagation();
      });
    }
  }

  function findSceneById(id) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.id === id) {
        return scenes[i];
      }
    }
    return null;
  }

  function findSceneDataById(id) {
    for (var i = 0; i < data.scenes.length; i++) {
      if (data.scenes[i].id === id) {
        return data.scenes[i];
      }
    }
    return null;
  }
function openWall(hotspot) {
  const container = document.getElementById("wallContainer");
  container.innerHTML = "";

  const mainWrapper = document.createElement("div");
  mainWrapper.className = "wall-main-wrapper";

  const imgWrapper = document.createElement("div");
  imgWrapper.className = "wall-image-wrapper";

  const img = document.createElement("img");
  img.src = hotspot.wallImage;
  img.classList.add("wall-image");

  imgWrapper.appendChild(img);
  mainWrapper.appendChild(imgWrapper);

  if (hotspot.comment) {
    const commentPanel = document.createElement("div");
    commentPanel.className = "comment-panel";
    commentPanel.innerHTML = hotspot.comment;
    mainWrapper.appendChild(commentPanel);
    mainWrapper.classList.add("with-comment");
  }

  container.appendChild(mainWrapper);

  img.onload = () => {
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const rect = img.getBoundingClientRect();
    const wrapperRect = imgWrapper.getBoundingClientRect();

    const offsetX = rect.left - wrapperRect.left;
    const offsetY = rect.top - wrapperRect.top;
    const dispW = rect.width;
    const dispH = rect.height;

    hotspot.paintings?.forEach((painting) => {
      if (!painting.points || painting.points.length !== 4) return;

      const zone = document.createElement("div");
      zone.classList.add("painting-zone");

      // Преобразуем 4 точки в polygon
      const polygonPoints = painting.points.map(([x, y]) => {
        const px = offsetX + (x / naturalW) * dispW;
        const py = offsetY + (y / naturalH) * dispH;
        return `${px}px ${py}px`;
      }).join(", ");

      zone.style.clipPath = `polygon(${polygonPoints})`;
      zone.style.position = "absolute";
      zone.style.left = "0";
      zone.style.top = "0";
      zone.style.width = "100%";
      zone.style.height = "100%";
      zone.style.cursor = "pointer";

      // Для лучшей кликабельности можно добавить псевдоэлемент
      zone.style.background = "transparent";
      zone.style.pointerEvents = "auto";

      zone.addEventListener("click", (e) => {
        e.stopImmediatePropagation();
        openViewerWithComment(painting.full, painting.comment || "");
      });

      imgWrapper.appendChild(zone);
    });
  };

  const ro = new ResizeObserver(() => {
    if (img.complete) img.dispatchEvent(new Event('load'));
  });
  ro.observe(img);

  document.getElementById("interactiveOverlay").classList.remove("hidden");
  setActiveZoomImage(img);
}

function openViewerWithComment(src, comment) {
  const viewer = document.getElementById("viewer");
  const viewerImg = document.getElementById("viewerImg");

  viewerImg.src = src;
  viewer.classList.remove("hidden");

  let commentPanel = document.getElementById("viewerCommentPanel");
  if (!commentPanel) {
    commentPanel = document.createElement("div");
    commentPanel.id = "viewerCommentPanel";
    commentPanel.className = "viewer-comment-panel";
    viewer.appendChild(commentPanel);
  }

  if (comment) {
    commentPanel.innerHTML = comment;
    commentPanel.style.display = "block";
    viewer.classList.add("with-comment");
  } else {
    commentPanel.style.display = "none";
    viewer.classList.remove("with-comment");
  }

  setActiveZoomImage(viewerImg);
}
function openViewer(src) {
  const viewerImg = document.getElementById("viewerImg");
  viewerImg.src = src;
  document.getElementById("viewer").classList.remove("hidden");
  setActiveZoomImage(viewerImg);
}

  // Display the initial scene.
  switchScene(scenes[0]);

  // ========== ЗУМ И ПЕРЕТАСКИВАНИЕ КАРТИНЫ (общий для viewer и gallery) ==========
let currentScale = 1;
let isDragging = false;
let startX, startY, translateX = 0, translateY = 0;
let activeZoomImg = null;

function setActiveZoomImage(img) {
  activeZoomImg = img;
  resetZoom();
}

function applyTransform() {
  if (!activeZoomImg) return;
  activeZoomImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
  updateZonesInteractivity();
}

function resetZoom() {
  currentScale = 1;
  translateX = 0;
  translateY = 0;
  if (activeZoomImg) {
    activeZoomImg.style.transform = 'translate(0px, 0px) scale(1)';
  }
  updateZonesInteractivity();
}

function updateZonesInteractivity() {
  if (!activeZoomImg || !activeZoomImg.classList.contains('wall-image')) return;

  const wrapper = activeZoomImg.closest('.wall-image-wrapper');
  if (!wrapper) return;

  const zones = wrapper.querySelectorAll('.painting-zone');
  const enabled = currentScale <= 1.02;

  zones.forEach(zone => {
    if (enabled) {
      zone.style.pointerEvents = 'auto';
      zone.style.opacity = '1';
      zone.style.visibility = 'visible';
    } else {
      zone.style.pointerEvents = 'none';
      zone.style.opacity = '0';
      zone.style.visibility = 'hidden';
    }
  });
}

function initZoomHandlers() {
  // Зум колёсиком
  document.addEventListener('wheel', function(e) {
    if (!activeZoomImg) return;
    // Проверяем, что курсор над самой картинкой
    if (e.target !== activeZoomImg) return;

    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.5, Math.min(currentScale * delta, 8));

    const rect = activeZoomImg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleFactor = newScale / currentScale;
    translateX = mouseX - (mouseX - translateX) * scaleFactor;
    translateY = mouseY - (mouseY - translateY) * scaleFactor;

    currentScale = newScale;
    applyTransform();
  }, { passive: false });

  // Перетаскивание
  document.addEventListener('mousedown', function(e) {
    if (!activeZoomImg || e.target !== activeZoomImg || currentScale <= 1) return;
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    activeZoomImg.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging || !activeZoomImg) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    applyTransform();
  });

  document.addEventListener('mouseup', function() {
    if (!isDragging) return;
    isDragging = false;
    if (activeZoomImg) activeZoomImg.style.cursor = 'grab';
  });

  // Двойной клик — сброс
  document.addEventListener('dblclick', function(e) {
    if (e.target === activeZoomImg) {
      resetZoom();
    }
  });
}

function initImageViewer() {
//
}

// Сразу инициализируем (не ждём load)
initImageViewer();
initZoomHandlers();

// На всякий случай ещё и на load
window.addEventListener('load', function() {
  initImageViewer();
  initZoomHandlers();
});

function closeViewer() {
  const viewer = document.getElementById("viewer");
  if (viewer) {
    viewer.classList.add("hidden");
    viewer.classList.remove("with-side-comment");
    resetZoom();
    activeZoomImg = null;

    // Если стена всё ещё открыта — возвращаем ей управление зумом
    const wallImg = document.querySelector('#wallContainer .wall-image');
    if (wallImg && !document.getElementById('interactiveOverlay').classList.contains('hidden')) {
      setActiveZoomImage(wallImg);
    }
  }
}
window.closeViewer = closeViewer;

// ==================== КОММЕНТАРИЙ СЦЕНЫ ВНИЗУ ====================

let sceneCommentElement = document.getElementById('sceneComment');
if (!sceneCommentElement) {
  sceneCommentElement = document.createElement('div');
  sceneCommentElement.id = 'sceneComment';
  sceneCommentElement.className = 'scene-comment';
  document.body.appendChild(sceneCommentElement);
}

let commentTimeout = null;

function showSceneComment(comment) {
  if (!comment) {
    sceneCommentElement.classList.remove('visible');
    return;
  }
  if (commentTimeout) clearTimeout(commentTimeout);
  sceneCommentElement.innerHTML = comment;
  sceneCommentElement.classList.add('visible');
}

function scheduleHideComment() {
  if (commentTimeout) clearTimeout(commentTimeout);
  commentTimeout = setTimeout(() => {
    sceneCommentElement.classList.remove('visible');
  }, 2000);
}

function activateComment() {
  const currentSceneObj = scenes.find(s => s.scene === viewer.scene());
  if (currentSceneObj?.data?.sceneComment) {
    showSceneComment(currentSceneObj.data.sceneComment);
  }
}

// Панорама — только краткий показ (с таймером)
panoElement.addEventListener('mouseenter', () => {
  activateComment();
  scheduleHideComment();
});

const bottomTrigger = document.createElement('div');
bottomTrigger.style.position = 'fixed';
bottomTrigger.style.bottom = '0';
bottomTrigger.style.left = '0';
bottomTrigger.style.width = '100%';
bottomTrigger.style.height = '8%'; 
bottomTrigger.style.zIndex = '8000';
bottomTrigger.style.pointerEvents = 'auto';
document.body.appendChild(bottomTrigger);

bottomTrigger.addEventListener('mouseenter', () => {
  activateComment();
});
bottomTrigger.addEventListener('mouseleave', scheduleHideComment);


sceneCommentElement.addEventListener('mouseenter', () => {
  if (commentTimeout) clearTimeout(commentTimeout);
});
sceneCommentElement.addEventListener('mouseleave', scheduleHideComment);

// При смене сцены
const originalSwitchScene = switchScene;
switchScene = function(scene) {
  originalSwitchScene.call(this, scene);

  setTimeout(() => {
    if (scene.data.sceneComment) {
      showSceneComment(scene.data.sceneComment);
      scheduleHideComment();
    }
  }, 400);
};
// ==================== ГАЛЕРЕЯ ФОТОГРАФИЙ ====================

function openGallery(galleryData) {
  let currentIndex = 0;
  const images = galleryData.images;

  const html = `
    <div id="galleryOverlay" class="overlay">
      <button class="close-btn" onclick="closeGallery()">✖</button>
      
      <div id="galleryViewer" class="viewer">
        <button class="gallery-arrow gallery-prev" onclick="prevGalleryImage()">‹</button>
        
        <div class="viewer-content">
          <img id="galleryImg" src="${images[0].src}" alt="Фото">
        </div>
        
        <button class="gallery-arrow gallery-next" onclick="nextGalleryImage()">›</button>
        
        <div id="galleryComment" class="viewer-comment-panel">
          ${images[0].comment || ''}
        </div>
      </div>
      
      <div class="gallery-counter" id="galleryCounter">1 / ${images.length}</div>
    </div>
  `;

  // Удаляем предыдущую
  const old = document.getElementById('galleryOverlay');
  if (old) old.remove();

  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container.firstElementChild);

window.currentGallery = { images, currentIndex };
  updateGalleryImage();

  // Включаем зум
  const galleryImg = document.getElementById('galleryImg');
  if (galleryImg) {
    setActiveZoomImage(galleryImg);
  }
}

function updateGalleryImage() {
  const g = window.currentGallery;
  if (!g) return;

  const galleryImg = document.getElementById('galleryImg');
  if (galleryImg) {
    // Меняем src только если это действительно другое фото
    const newSrc = g.images[g.currentIndex].src;
    if (galleryImg.src !== newSrc && !galleryImg.src.endsWith(newSrc)) {
      galleryImg.src = newSrc;
      setActiveZoomImage(galleryImg); // сброс только при смене фото
    }
  }

  document.getElementById('galleryComment').innerHTML = g.images[g.currentIndex].comment || '';
  document.getElementById('galleryCounter').textContent = `${g.currentIndex + 1} / ${g.images.length}`;
}

window.prevGalleryImage = function() {
  const g = window.currentGallery;
  g.currentIndex = (g.currentIndex - 1 + g.images.length) % g.images.length;
  updateGalleryImage();
};

window.nextGalleryImage = function() {
  const g = window.currentGallery;
  g.currentIndex = (g.currentIndex + 1) % g.images.length;
  updateGalleryImage();
};

window.closeGallery = function() {
  const el = document.getElementById('galleryOverlay');
  if (el) el.remove();
  delete window.currentGallery;
  resetZoom();
  activeZoomImg = null;
};

// ==================== СОЗДАНИЕ ГАЛЕРЕЙНОГО ХОТСПТА ====================

function createGalleryHotspotElement(hotspot) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('hotspot', 'interactive-hotspot', 'gallery-hotspot');

  const icon = document.createElement('img');
  icon.src = 'img/info.png'; 
  wrapper.appendChild(icon);

  wrapper.addEventListener('click', () => {
    openGallery(hotspot);
  });

  stopTouchAndScrollEventPropagation(wrapper);
  return wrapper;
}

})();