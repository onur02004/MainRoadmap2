// ============================================================
// GLOBAL AVATAR RENDERER
// ============================================================

import {
  blobatar
} from 'https://cdn.jsdelivr.net/npm/blobatar@2.7.0/+esm';

import {
  gaze
} from 'https://cdn.jsdelivr.net/npm/blobatar@2.7.0/gaze/+esm';

import {
  idle,
  happy,
  sad,
  mad,
  surprised,
  wink,
  sleepy,
  love
} from 'https://cdn.jsdelivr.net/npm/blobatar@2.7.0/expression/+esm';


// ============================================================
// BLOBATAR CONFIG
// ============================================================

const BLOBATAR_EXPRESSIONS = {
  idle,
  happy,
  sad,
  mad,
  surprised,
  wink,
  sleepy,
  love
};


const BLOBATAR_SHAPES = {
  round: 0.05,
  organic: 0.15,
  boxy: 0.25,
  nub: 0.35,
  cloud: 0.45,
  sun: 0.55,
  capsule: 0.65,
  triangle: 0.75,
  hexagon: 0.85,
  droplet: 0.95
};


// ============================================================
// CACHE
// ============================================================

let cachedUser = null;
let userPromise = null;


// Her Blobatar için ayrı gaze controller
const blobatarGazeControllers =
  new WeakMap();


// ============================================================
// LOAD CURRENT USER
// ============================================================

export async function getCurrentUser(
  force = false
) {

  if (
    cachedUser &&
    !force
  ) {
    return cachedUser;
  }


  if (
    userPromise &&
    !force
  ) {
    return userPromise;
  }


  const token =
    localStorage.getItem(
      'token'
    );


  if (!token) {
    return null;
  }


  userPromise =
    fetch(
      '/api/users/profile',
      {
        headers: {
          Authorization:
            `Bearer ${token}`
        }
      }
    )

      .then(
        async response => {

          const json =
            await response.json();


          if (
            !response.ok ||
            json.status !==
              'success'
          ) {

            throw new Error(
              json.message ||
              'Profil alınamadı.'
            );

          }


          cachedUser =
            json.data.user;


          return cachedUser;

        }
      )

      .catch(
        error => {

          console.error(
            '[AvatarRenderer] Profile error:',
            error
          );

          return null;

        }
      )

      .finally(
        () => {

          userPromise =
            null;

        }
      );


  return userPromise;
}


// ============================================================
// PUBLIC RENDER FUNCTION
// ============================================================

export function renderAvatar(
  element,
  user,
  options = {}
) {

  if (
    !element ||
    !user
  ) {
    return;
  }


  const size =
    options.size ||
    element.dataset.avatarSize ||
    48;


  const type =
    user.avatar_type ||
    'photo';


  const data =
    user.avatar_data ||
    {};


  // ----------------------------------------------------------
  // RESET
  // ----------------------------------------------------------

  // Eğer daha önce Blobatar vardıysa
  // onun gaze controller'ını durdur.
  stopBlobatarGaze(
    element
  );


  element.innerHTML =
    '';


  element.classList.add(
    'global-avatar-renderer'
  );


  element.style.width =
    typeof size === 'number'
      ? `${size}px`
      : size;


  element.style.height =
    typeof size === 'number'
      ? `${size}px`
      : size;


  element.style.overflow =
    'hidden';


  element.style.position =
    'relative';


  // ----------------------------------------------------------
  // BLOBATAR
  // ----------------------------------------------------------

  if (
    type === 'blobatar'
  ) {

    renderBlobatar(
      element,
      user,
      data,
      size
    );

    return;
  }


  // ----------------------------------------------------------
  // PIXEL
  // ----------------------------------------------------------

  if (
    type === 'pixel'
  ) {

    renderPixelAvatar(
      element,
      data,
      size
    );

    return;
  }


  // ----------------------------------------------------------
  // PHOTO
  // ----------------------------------------------------------

  renderImageAvatar(
    element,
    user,
    size
  );
}


// ============================================================
// BLOBATAR
// ============================================================

function renderBlobatar(
  container,
  user,
  data,
  size
) {

  const username =
    user.user_name ||
    user.username ||
    'user';

  const seed =
    user.email ||
    username;

  const expressionName =
    data.expression ||
    'idle';

  const options = {

    hue:
      Number(
        data.hue ?? 160
      ),

    tone:
      Number(
        data.tone ?? 0.5
      ),

    expression:
      BLOBATAR_EXPRESSIONS[
        expressionName
      ] ||
      BLOBATAR_EXPRESSIONS.idle,

    title:
      `${username} Blobatar`

  };

  if (
    data.shape &&
    data.shape !== 'auto' &&
    BLOBATAR_SHAPES[
      data.shape
    ] !== undefined
  ) {

    options.traits = {

      shape:
        BLOBATAR_SHAPES[
          data.shape
        ]

    };

  }

  try {

    container.innerHTML =
      blobatar(
        seed,
        options
      );

    const svg =
      container.querySelector('svg');

    if (!svg) {
      throw new Error(
        'Blobatar SVG oluşturulamadı.'
      );
    }

    // ---------------------------------------------------------
    // GLOBAL CLASS
    // ---------------------------------------------------------

    svg.classList.add(
      'blobatar-global'
    );

    if (data.animate !== false) {

      svg.classList.add(
        'blobatar-live'
      );

    }

    // ---------------------------------------------------------
    // SVG SIZE
    // ---------------------------------------------------------

    svg.setAttribute(
      'width',
      '100%'
    );

    svg.setAttribute(
      'height',
      '100%'
    );

    svg.style.width =
      '100%';

    svg.style.height =
      '100%';

    svg.style.display =
      'block';

    svg.style.overflow =
      'visible';

    // ---------------------------------------------------------
    // PREPARE EYES
    // ---------------------------------------------------------

    prepareBlobatarGaze(svg);

    // ---------------------------------------------------------
    // GAZE
    // ---------------------------------------------------------

    if (data.gaze !== false) {

      const controller =
        gaze(
          svg,
          {
            travel: 3
          }
        );

      controller.lookAt(
        'pointer'
      );

      // Container silinirse controller'ı temizle
      container._blobatarGaze =
        controller;

    }

  }

  catch (error) {

    console.error(
      '[AvatarRenderer] Blobatar render failed:',
      error
    );

    renderFallbackAvatar(
      container,
      username,
      size
    );

  }

}



// ============================================================
// BLOBATAR MOTION / GAZE STRUCTURE
// ============================================================

function prepareBlobatarGaze(
  svg
) {

  const paths =
    Array.from(
      svg.querySelectorAll(
        'path'
      )
    );


  if (
    paths.length < 3
  ) {

    console.warn(
      '[AvatarRenderer] Unexpected Blobatar SVG structure.'
    );

    return;
  }


  // ----------------------------------------------------------
  // Find eye paths
  // ----------------------------------------------------------

  const pathData =
    paths.map(
      path => ({

        path,

        fill:
          path.getAttribute(
            'fill'
          ) ||
          path.parentElement
            ?.getAttribute(
              'fill'
            ) ||
          ''

      })
    );


  const fillCounts =
    new Map();


  for (
    const item of pathData
  ) {

    if (
      !item.fill
    ) {
      continue;
    }


    fillCounts.set(
      item.fill,
      (
        fillCounts.get(
          item.fill
        ) || 0
      ) + 1
    );

  }


  let eyeFill =
    null;


  for (
    const [
      fill,
      count
    ]
    of fillCounts
  ) {

    if (
      count >= 2
    ) {

      eyeFill =
        fill;

      break;

    }

  }


  let eyePaths =
    eyeFill

      ? pathData
          .filter(
            item =>
              item.fill ===
              eyeFill
          )
          .map(
            item =>
              item.path
          )

      : [];


  // Fallback
  if (
    eyePaths.length < 2
  ) {

    eyePaths =
      paths.slice(
        -2
      );

  }


  if (
    eyePaths.length < 2
  ) {

    console.warn(
      '[AvatarRenderer] Blobatar eye paths could not be detected.'
    );

    return;
  }


  // ----------------------------------------------------------
  // MOTION TREE
  // ----------------------------------------------------------

  const root =
    createSvgGroup(
      'mo-root mo-always'
    );


  const breathe =
    createSvgGroup(
      'mo-breathe'
    );


  const bob =
    createSvgGroup(
      'mo-bob'
    );


  const eyes =
    createSvgGroup(
      'mo-eyes'
    );


  eyes.style.setProperty(
    '--mo-track-travel',
    '3px'
  );


  // ----------------------------------------------------------
  // EYES
  // ----------------------------------------------------------

  eyePaths
    .slice(
      0,
      2
    )
    .forEach(
      path => {

        const eye =
          createSvgGroup(
            'mo-eye'
          );


        eye.appendChild(
          path
        );


        eyes.appendChild(
          eye
        );

      }
    );


  bob.appendChild(
    eyes
  );


  // ----------------------------------------------------------
  // MOVE BODY ELEMENTS
  // ----------------------------------------------------------

  const remaining =
    Array.from(
      svg.children
    );


  remaining.forEach(
    element => {

      bob.insertBefore(
        element,
        eyes
      );

    }
  );


  breathe.appendChild(
    bob
  );


  root.appendChild(
    breathe
  );


  svg.appendChild(
    root
  );

}


// ============================================================
// SVG GROUP HELPER
// ============================================================

function createSvgGroup(
  className
) {

  const group =
    document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g'
    );


  group.setAttribute(
    'class',
    className
  );


  return group;
}


// ============================================================
// STOP GAZE
// ============================================================

function stopBlobatarGaze(
  container
) {

  const controller =
    blobatarGazeControllers.get(
      container
    );


  if (
    controller &&
    typeof controller.stop ===
      'function'
  ) {

    controller.stop();

  }


  blobatarGazeControllers.delete(
    container
  );

}


// ============================================================
// PIXEL AVATAR
// ============================================================

function renderPixelAvatar(
  container,
  data,
  size
) {

  const pixels =
    data.pixels;


  const width =
    Number(
      data.width ||
      32
    );


  const height =
    Number(
      data.height ||
      32
    );


  if (
    !Array.isArray(
      pixels
    ) ||
    !pixels.length
  ) {

    renderFallbackAvatar(
      container,
      'pixel',
      size
    );

    return;
  }


  const canvas =
    document.createElement(
      'canvas'
    );


  canvas.width =
    width;


  canvas.height =
    height;


  canvas.style.width =
    '100%';


  canvas.style.height =
    '100%';


  canvas.style.display =
    'block';


  canvas.style.imageRendering =
    'pixelated';


  const ctx =
    canvas.getContext(
      '2d'
    );


  ctx.imageSmoothingEnabled =
    false;


  for (
    let y = 0;
    y < height;
    y++
  ) {

    for (
      let x = 0;
      x < width;
      x++
    ) {

      const color =
        pixels[y]?.[x];


      if (
        !color ||
        color ===
          'transparent'
      ) {

        continue;

      }


      ctx.fillStyle =
        color;


      ctx.fillRect(
        x,
        y,
        1,
        1
      );

    }

  }


  container.appendChild(
    canvas
  );

}


// ============================================================
// NORMAL IMAGE
// ============================================================

function renderImageAvatar(
  container,
  user,
  size
) {

  const src =
    user.profile_pic_path;


  if (!src) {

    renderFallbackAvatar(
      container,
      user.user_name ||
        'user',
      size
    );

    return;
  }


  const img =
    document.createElement(
      'img'
    );


  img.src =
    src;


  img.alt =
    user.user_name ||
    'Avatar';


  img.draggable =
    false;


  img.style.width =
    '100%';


  img.style.height =
    '100%';


  img.style.display =
    'block';


  img.style.objectFit =
    'cover';


  img.onerror =
    () => {

      renderFallbackAvatar(
        container,
        user.user_name ||
          'user',
        size
      );

    };


  container.appendChild(
    img
  );

}


// ============================================================
// FALLBACK
// ============================================================

function renderFallbackAvatar(
  container,
  username,
  size
) {

  const img =
    document.createElement(
      'img'
    );


  img.src =
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
      username ||
      'user'
    )}`;


  img.alt =
    'Avatar';


  img.style.width =
    '100%';


  img.style.height =
    '100%';


  img.style.objectFit =
    'cover';


  container.appendChild(
    img
  );

}


// ============================================================
// RENDER ALL GLOBAL AVATARS
// ============================================================

export async function renderAllAvatars(
  force = false
) {

  const elements =
    document.querySelectorAll(
      '[data-avatar]'
    );


  if (
    !elements.length
  ) {

    return;

  }


  const user =
    await getCurrentUser(
      force
    );


  if (!user) {

    return;

  }


  elements.forEach(
    element => {

      renderAvatar(
        element,
        user
      );

    }
  );

}


// ============================================================
// INITIALIZE
// ============================================================

export async function initAvatarRenderer() {

  await renderAllAvatars();

}


// ============================================================
// REFRESH AFTER AVATAR CHANGE
// ============================================================

export async function refreshAvatar() {

  cachedUser =
    null;


  await renderAllAvatars(
    true
  );

}


// ============================================================
// GLOBAL API
// ============================================================

window.AvatarRenderer = {

  render:
    renderAvatar,

  renderAll:
    renderAllAvatars,

  refresh:
    refreshAvatar,

  getCurrentUser

};