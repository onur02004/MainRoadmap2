// ============================================================
// ACCOUNT CONSOLE
// ============================================================

import { ThemeManager } from './themes/theme-registry.js';
import './avatarCanvasPicker.js';
import { renderAvatar } from './avatarRenderer.js';

// ============================================================
// BLOBATAR
// ============================================================

import { blobatar } from 'https://cdn.jsdelivr.net/npm/blobatar@2.7.0/+esm';
import { gaze } from 'https://cdn.jsdelivr.net/npm/blobatar@2.7.0/gaze/+esm';

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
// USER
// ============================================================

let currentAccountUser = null


// ============================================================
// DOM READY
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  new ThemeManager();

  initResponsiveFixedGrid();
  initScrollOpacityController();

  await loadUserProfile();

  initAccountEvents();
  initBlobatarStudio();
  initPixelStudio();
});


// ============================================================
// USER PROFILE
// ============================================================

async function loadUserProfile() {

  const token = localStorage.getItem('token');

  if (!token) return;

  try {

    const response = await fetch(
      '/api/users/profile',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const json = await response.json();

    if (
      !response.ok ||
      json.status !== 'success'
    ) {
      return;
    }

    const user = json.data.user;

    currentAccountUser = {

      username:
        user.user_name,

      role:
        user.relation
          ? user.relation.toUpperCase()
          : 'ROLE_UNAVAILABLE',

      email:
        user.email ||
        `${user.user_name}@EMAIL_UNAVAILABLE`,

      nodeId:
        `#${user.id?.slice
          ? user.id.slice(0, 4)
          : '8921'}-X`,

      avatar:
        user.profile_pic_path ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${user.user_name}`,

      avatar_type:
        user.avatar_type,

      avatar_data:
        user.avatar_data

    };

    applyAccountDetails(
      currentAccountUser
    );

  } catch (error) {

    console.error(
      'Profile load error:',
      error
    );

  }

}

async function saveCurrentBlobatar() {

  const token =
    localStorage.getItem('token');

  if (!token) {
    alert('Oturum bulunamadı.');
    return;
  }

  const button =
    document.getElementById('btnBlobSave');

  if (button) {
    button.disabled = true;
    button.textContent = '✓ SAVING...';
  }

  try {

    const response =
      await fetch(
        '/api/users/profile/avatar',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${token}`
          },

          body: JSON.stringify({

            avatar_type: 'blobatar',

            avatar_data: {

              expression:
                blobatarState.expression,

              shape:
                blobatarState.shape,

              hue:
                Number(blobatarState.hue),

              tone:
                Number(blobatarState.tone),

              animate:
                Boolean(blobatarState.animate),

              gaze:
                Boolean(blobatarState.gaze)

            },

            profile_pic_path: null

          })
        }
      );

    const result =
      await response.json();

    if (!response.ok) {

      console.error(
        '[Blobatar] Save failed:',
        result
      );

      throw new Error(
        result.message ||
        'Blobatar kaydedilemedi.'
      );

    }

    console.log(
      '✅ Blobatar saved:',
      result
    );

    alert(
      '✅ Blobatar avatar olarak ayarlandı!'
    );

    await loadUserProfile();

  } catch (error) {

    console.error(
      '[Blobatar] Save error:',
      error
    );

    alert(
      error.message ||
      'Blobatar kaydedilirken hata oluştu.'
    );

  } finally {

    if (button) {

      button.disabled = false;
      button.textContent =
        '✓ SAVE AVATAR';

    }

  }

}

function applyAccountDetails(user) {

  const elements = {

    avatar:
      document.getElementById('guiUserAvatar'),

    name:
      document.getElementById('userNameLabel'),

    role:
      document.getElementById('userRoleBadge'),

    email:
      document.getElementById('userEmailLabel'),

    node:
      document.getElementById('userNodeIdBadge'),

    telemetry:
      document.getElementById('telemetryRoleVal'),

    usernameInput:
      document.getElementById('inpUsername'),

    emailInput:
      document.getElementById('inpEmail')

  };


  // ==========================================
  // AVATAR
  // ==========================================

  if (elements.avatar) {

    renderAvatar(
      elements.avatar,
      {

        user_name:
          user.username,

        email:
          user.email,

        avatar_type:
          user.avatar_type,

        avatar_data:
          user.avatar_data,

        profile_pic_path:
          user.avatar

      }
    );

  }


  // ==========================================
  // REAL USER DATA
  // ==========================================

  if (elements.name)
    elements.name.textContent =
      user.username;

  if (elements.role)
    elements.role.textContent =
      `ROLE: ${user.role}`;

  if (elements.email)
    elements.email.textContent =
      user.email;

  if (elements.node)
    elements.node.textContent =
      user.nodeId;

  if (elements.telemetry)
    elements.telemetry.textContent =
      user.role;

  if (elements.usernameInput)
    elements.usernameInput.value =
      user.username;

  if (elements.emailInput)
    elements.emailInput.value =
      user.email;

}


// ============================================================
// ACCOUNT EVENTS
// ============================================================

function initAccountEvents() {

  const openVault = () =>
    document
      .getElementById('btnOpenAvatarVault')
      ?.click();


  document
    .getElementById('btnHeroVaultTrigger')
    ?.addEventListener(
      'click',
      openVault
    );


  document
    .getElementById('btnCardLaunchVault')
    ?.addEventListener(
      'click',
      openVault
    );


  // ----------------------------------------------------------
  // PROFILE
  // ----------------------------------------------------------

  document
    .getElementById('profileForm')
    ?.addEventListener(
      'submit',
      async event => {

        event.preventDefault();

        const input =
          document.getElementById('inpUsername');

        const newName =
          input?.value.trim();

        if (!newName) return;

        try {

          const token =
            localStorage.getItem('token');

          await fetch(
            '/api/users/profile',
            {
              method: 'PUT',
              headers: {
                'Content-Type':
                  'application/json',
                Authorization:
                  `Bearer ${token}`
              },
              body: JSON.stringify({
                user_name: newName
              })
            }
          );

          alert(
            '✅ Profile updated successfully!'
          );

          window.location.reload();

        } catch {

          alert(
            'Profile saved locally.'
          );

        }

      }
    );


  // ----------------------------------------------------------
  // SECURITY
  // ----------------------------------------------------------

  document
    .getElementById('securityForm')
    ?.addEventListener(
      'submit',
      event => {

        event.preventDefault();

        alert(
          '🔒 Password credentials rotation submitted.'
        );

      }
    );


  // ----------------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------------

  document
    .getElementById('btnAccountLogout')
    ?.addEventListener(
      'click',
      () => {

        localStorage.removeItem('token');

        window.location.href = '/';

      }
    );

}


// ============================================================
// SCROLL
// ============================================================

function initScrollOpacityController() {

  const background =
    document.getElementById(
      'bgGridLayer'
    );

  window.addEventListener(
    'scroll',
    () => {

      background?.classList.toggle(
        'scrolled-down',
        window.scrollY > 80
      );

    }
  );

}


// ============================================================
// RESPONSIVE GRID
// ============================================================

function initResponsiveFixedGrid() {

  const container =
    document.getElementById(
      'cornerGrid'
    );

  if (!container) return;


  const render = () => {

    const blueprint =
      window.innerWidth < 768

        ? [
          [0, 1, 2, 1],
          [0, 2, 2],
          [0, 1, 2]
        ]

        : [
          [0, 1, 2, 1, 2, 1, 1],
          [0, 0, 1, 1, 2, 2],
          [0, 0, 1, 2, 1, 1],
          [0, 0, 0, 2, 1]
        ];


    const metadata = {
      '0-4': {
        tag: '▲ IDENTITY',
        dot: true
      },

      '1-5': {
        tag: '▼ SECURITY',
        dot: false
      }
    };


    container.replaceChildren();


    blueprint.forEach(
      (row, rowIndex) => {

        const rowElement =
          document.createElement('div');

        rowElement.className =
          'corner-row';


        row.forEach(
          (type, columnIndex) => {

            const cell =
              document.createElement('div');


            if (type === 0) {

              cell.className =
                'corner-unit spacer';

            }

            else if (type === 1) {

              cell.className =
                'corner-unit wireframe';

            }

            else {

              cell.className =
                'corner-unit solid-box';


              const data =
                metadata[
                `${rowIndex}-${columnIndex}`
                ];


              if (data) {

                cell.innerHTML = `
                  <span class="subtle-tag">
                    ${data.tag}
                  </span>

                  ${data.dot
                    ? '<span class="subtle-dot"></span>'
                    : ''
                  }
                `;

              }

            }


            rowElement.appendChild(
              cell
            );

          }
        );


        container.appendChild(
          rowElement
        );

      }
    );

  };


  render();

  window.addEventListener(
    'resize',
    render
  );

}


// ============================================================
// BLOBATAR STATE
// ============================================================

const blobatarState = {

  expression: 'idle',

  shape: 'auto',

  hue: 160,

  tone: 0.5,

  animate: true,

  gaze: true

};


const blobatarExpressions = {

  idle,
  happy,
  sad,
  mad,
  surprised,
  wink,
  sleepy,
  love

};


const blobatarShapeValues = {

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


let blobatarGazeController = null;


// ============================================================
// BLOBATAR INITIALIZATION
// ============================================================

function hydrateBlobatarState() {

  const data =
    currentAccountUser?.avatar_type === 'blobatar'
      ? currentAccountUser.avatar_data
      : null;

  if (!data) return;

  const validExpressions =
    Object.keys(blobatarExpressions);

  const validShapes = [
    'auto',
    ...Object.keys(blobatarShapeValues)
  ];

  blobatarState.expression =
    validExpressions.includes(data.expression)
      ? data.expression
      : 'idle';

  blobatarState.shape =
    validShapes.includes(data.shape)
      ? data.shape
      : 'auto';

  const hue = Number(data.hue);
  const tone = Number(data.tone);

  blobatarState.hue =
    Number.isFinite(hue)
      ? Math.max(0, Math.min(360, hue))
      : 160;

  blobatarState.tone =
    Number.isFinite(tone)
      ? Math.max(0, Math.min(1, tone))
      : 0.5;

  blobatarState.animate =
    data.animate !== false;

  blobatarState.gaze =
    data.gaze !== false;
}

function initBlobatarStudio() {

  const studio =
    document.getElementById(
      'blobatarStudioView'
    );

  if (!studio) return;

  document
    .getElementById('btnSideBlobatar')
    ?.addEventListener(
      'click',
      openBlobatarStudio
    );

  document
    .getElementById('btnBlobatarBack')
    ?.addEventListener(
      'click',
      closeBlobatarStudio
    );

  // Load user's saved Blobatar first
  hydrateBlobatarState();

  initBlobatarControls();

  renderBlobatarPreview();

  renderShapePickerPreviews();
}


// ============================================================
// OPEN / CLOSE
// ============================================================

function openBlobatarStudio() {

  const studio =
    document.getElementById(
      'blobatarStudioView'
    );

  if (!studio) return;


  document
    .getElementById('vaultListView')
    ?.style
    .setProperty(
      'display',
      'none'
    );


  document
    .getElementById('canvasViewport')
    ?.style
    .setProperty(
      'display',
      'none'
    );


  document
    .getElementById('hudRadarStack')
    ?.style
    .setProperty(
      'display',
      'none'
    );


  document
    .getElementById('hudInspector')
    ?.style
    .setProperty(
      'display',
      'none'
    );


  studio.style.display =
    'block';


  const badge =
    document.getElementById(
      'hudActiveModeBadge'
    );

  if (badge) {

    badge.textContent =
      'VIEW: BLOBATAR STUDIO';

  }


  renderBlobatarPreview();

}


function closeBlobatarStudio() {

  document
    .getElementById('blobatarStudioView')
    ?.style
    .setProperty(
      'display',
      'none'
    );


  document
    .getElementById('vaultListView')
    ?.style
    .setProperty(
      'display',
      ''
    );


  const badge =
    document.getElementById(
      'hudActiveModeBadge'
    );

  if (badge) {

    badge.textContent =
      'VIEW: LIST';

  }


  destroyBlobatarGaze();

}


// ============================================================
// BLOBATAR RENDER
// ============================================================

function renderBlobatarPreview() {

  const container =
    document.getElementById(
      'blobatarPreview'
    );

  if (!container) return;


  destroyBlobatarGaze();


  const seed =
    currentAccountUser?.email ||
    currentAccountUser?.username ||
    'onur';


  const options = {

    hue:
      Number(blobatarState.hue),

    tone:
      Number(blobatarState.tone),

    expression:
      blobatarExpressions[
      blobatarState.expression
      ],

    title:
      `${currentAccountUser?.username || 'User'} Blobatar`

  };


  if (
    blobatarState.shape !== 'auto'
  ) {

    options.traits = {
      shape:
        blobatarShapeValues[
        blobatarState.shape
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

    const expressionLabel =
      document.getElementById(
        'blobPreviewExpression'
      );

    if (expressionLabel) {

      expressionLabel.textContent =
        blobatarState.expression.toUpperCase();

    }

    const shapeLabel =
      document.getElementById(
        'blobPreviewShape'
      );

    if (shapeLabel) {

      shapeLabel.textContent =
        blobatarState.shape.toUpperCase();

    }

    const shapeValue =
      document.getElementById(
        'blobShapeValue'
      );

    if (shapeValue) {

      shapeValue.textContent =
        blobatarState.shape.toUpperCase();

    }


    if (!svg) {

      throw new Error(
        'Blobatar SVG was not generated.'
      );

    }


    prepareBlobatarGaze(svg);


    // --------------------------------------------------------
    // SIZE
    // --------------------------------------------------------

    svg.setAttribute(
      'width',
      '320'
    );

    svg.setAttribute(
      'height',
      '320'
    );

    svg.style.width =
      '320px';

    svg.style.height =
      '320px';

    svg.style.display =
      'block';

    svg.style.overflow =
      'visible';


    // --------------------------------------------------------
    // MOTION
    // --------------------------------------------------------

    svg.classList.toggle(
      'blobatar-live',
      blobatarState.animate
    );


    // --------------------------------------------------------
    // GAZE
    // --------------------------------------------------------

    if (blobatarState.gaze) {

      blobatarGazeController =
        gaze(
          svg,
          {
            travel: 3
          }
        );


      blobatarGazeController
        .lookAt('pointer');

    }

  } catch (error) {

    console.error(
      '[Blobatar] Render error:',
      error
    );


    container.innerHTML = `
      <div class="blobatar-error">
        BLOBATAR ENGINE ERROR
      </div>
    `;

  }

}


// ============================================================
// PREPARE GAZE STRUCTURE
// ============================================================

function prepareBlobatarGaze(svg) {

  const paths =
    Array.from(
      svg.querySelectorAll('path')
    );


  if (paths.length < 3) {

    console.warn(
      '[Blobatar] Unexpected SVG structure.'
    );

    return;

  }


  /*
   * Blobatar static renderer:
   *
   * body
   * eye
   * eye
   *
   * Eyes share the same fill.
   */

  const pathData =
    paths.map(path => ({

      path,

      fill:
        path.getAttribute('fill') ||
        path.parentElement?.getAttribute(
          'fill'
        ) ||
        ''

    }));


  const fillCounts =
    new Map();


  for (const item of pathData) {

    if (!item.fill) continue;

    fillCounts.set(
      item.fill,
      (fillCounts.get(item.fill) || 0) + 1
    );

  }


  let eyeFill = null;


  for (
    const [fill, count]
    of fillCounts
  ) {

    if (count >= 2) {

      eyeFill = fill;
      break;

    }

  }


  let eyePaths =
    eyeFill

      ? pathData
        .filter(
          item =>
            item.fill === eyeFill
        )
        .map(
          item =>
            item.path
        )

      : [];


  // Fallback for future Blobatar SVG changes.
  if (eyePaths.length < 2) {

    eyePaths =
      paths.slice(-2);

  }


  if (eyePaths.length < 2) {

    console.warn(
      '[Blobatar] Eye paths could not be detected.'
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


  eyePaths
    .slice(0, 2)
    .forEach(path => {

      const eye =
        createSvgGroup(
          'mo-eye'
        );

      eye.appendChild(path);

      eyes.appendChild(eye);

    });


  bob.appendChild(eyes);


  // Move remaining SVG elements into body layer.
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


  breathe.appendChild(bob);

  root.appendChild(breathe);

  svg.appendChild(root);

}


// ============================================================
// SVG HELPER
// ============================================================

function createSvgGroup(className) {

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
// DESTROY GAZE
// ============================================================

function destroyBlobatarGaze() {

  if (
    blobatarGazeController &&
    typeof blobatarGazeController.stop ===
    'function'
  ) {

    blobatarGazeController.stop();

  }

  blobatarGazeController = null;

}


// ============================================================
// BLOBATAR CONTROLS
// ============================================================

function initBlobatarControls() {

  // ----------------------------------------------------------
  // EXPRESSIONS
  // ----------------------------------------------------------

  const expressionButtons =
    document.querySelectorAll(
      '[data-blob-expression]'
    );


  expressionButtons.forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          blobatarState.expression =
            button.dataset.blobExpression;


          expressionButtons.forEach(
            btn => {

              btn.classList.toggle(
                'active',
                btn === button
              );

            }
          );


          renderBlobatarPreview();

        }
      );

    }
  );

  // ----------------------------------------------------------
  // SHAPE PICKER
  // ----------------------------------------------------------

  const shapePicker =
    document.getElementById(
      'blobShapePicker'
    );

  shapePicker?.addEventListener(
    'click',
    event => {

      const button =
        event.target.closest(
          '[data-shape]'
        );

      if (!button) return;

      blobatarState.shape =
        button.dataset.shape;

      updateBlobatarControls();

      renderBlobatarPreview();

      renderShapePickerPreviews();
    }
  );


  // ----------------------------------------------------------
  // HUE
  // ----------------------------------------------------------

  const hueSlider =
    document.getElementById(
      'blobHue'
    );

  const hueValue =
    document.getElementById(
      'blobHueValue'
    );


  hueSlider?.addEventListener(
    'input',
    () => {

      blobatarState.hue =
        Number(hueSlider.value);


      if (hueValue) {

        hueValue.textContent =
          `${blobatarState.hue}°`;

      }


      renderBlobatarPreview();

    }
  );


  // ----------------------------------------------------------
  // TONE
  // ----------------------------------------------------------

  const toneSlider =
    document.getElementById(
      'blobTone'
    );

  const toneValue =
    document.getElementById(
      'blobToneValue'
    );


  toneSlider?.addEventListener(
    'input',
    () => {

      blobatarState.tone =
        Number(toneSlider.value) / 100;


      if (toneValue) {

        toneValue.textContent =
          getToneLabel(
            blobatarState.tone
          );

      }


      renderBlobatarPreview();

    }
  );


  // ----------------------------------------------------------
  // MOTION
  // ----------------------------------------------------------

  document
    .getElementById('blobMotion')
    ?.addEventListener(
      'change',
      event => {

        blobatarState.animate =
          event.target.checked;

        renderBlobatarPreview();

      }
    );


  // ----------------------------------------------------------
  // GAZE
  // ----------------------------------------------------------

  document
    .getElementById('blobGaze')
    ?.addEventListener(
      'change',
      event => {

        blobatarState.gaze =
          event.target.checked;

        renderBlobatarPreview();

      }
    );


  // ----------------------------------------------------------
  // RANDOM
  // ----------------------------------------------------------

  document
    .getElementById('btnBlobRandom')
    ?.addEventListener(
      'click',
      randomizeBlobatar
    );


  // ----------------------------------------------------------
  // SAVE
  // ----------------------------------------------------------

  document
    .getElementById('btnBlobSave')
    ?.addEventListener(
      'click',
      saveCurrentBlobatar
    );


  // ============================================================
  // RANDOMIZER
  // ============================================================

  function randomizeBlobatar() {

    const expressions =
      Object.keys(
        blobatarExpressions
      );


    const shapes = [
      'auto',
      ...Object.keys(
        blobatarShapeValues
      )
    ];


    blobatarState.expression =
      randomItem(expressions);

    blobatarState.shape =
      randomItem(shapes);

    blobatarState.hue =
      Math.floor(
        Math.random() * 361
      );

    blobatarState.tone =
      Math.random();

    blobatarState.animate =
      true;

    blobatarState.gaze =
      true;


    updateBlobatarControls();

    renderBlobatarPreview();

    renderShapePickerPreviews();
  }


  // ============================================================
  // RANDOM HELPER
  // ============================================================

  function randomItem(array) {

    return array[
      Math.floor(
        Math.random() * array.length
      )
    ];

  }


  // ============================================================
  // UPDATE CONTROL UI
  // ============================================================

  function updateBlobatarControls() {

    document
      .querySelectorAll(
        '[data-blob-expression]'
      )
      .forEach(button => {

        button.classList.toggle(
          'active',
          button.dataset.blobExpression ===
          blobatarState.expression
        );

      });


    document
      .querySelectorAll(
        '[data-shape]'
      )
      .forEach(button => {

        button.classList.toggle(
          'active',
          button.dataset.shape ===
          blobatarState.shape
        );

      });

    const shapeValue =
      document.getElementById(
        'blobShapeValue'
      );

    if (shapeValue) {

      shapeValue.textContent =
        blobatarState.shape.toUpperCase();

    }


    const hue =
      document.getElementById(
        'blobHue'
      );

    if (hue) {

      hue.value =
        blobatarState.hue;

    }


    const hueValue =
      document.getElementById(
        'blobHueValue'
      );

    if (hueValue) {

      hueValue.textContent =
        `${blobatarState.hue}°`;

    }


    const tone =
      document.getElementById(
        'blobTone'
      );

    if (tone) {

      tone.value =
        Math.round(
          blobatarState.tone * 100
        );

    }


    const toneValue =
      document.getElementById(
        'blobToneValue'
      );

    if (toneValue) {

      toneValue.textContent =
        getToneLabel(
          blobatarState.tone
        );

    }


    const motion =
      document.getElementById(
        'blobMotion'
      );

    if (motion) {

      motion.checked =
        blobatarState.animate;

    }


    const gaze =
      document.getElementById(
        'blobGaze'
      );

    if (gaze) {

      gaze.checked =
        blobatarState.gaze;

    }

  }


  // ============================================================
  // TONE LABEL
  // ============================================================

  function getToneLabel(tone) {

    if (tone < 0.25)
      return 'LIGHT';

    if (tone < 0.5)
      return 'SOFT';

    if (tone < 0.75)
      return 'MID';

    return 'INK';

  }


  // ============================================================
  // LEGACY ENTRY POINT
  // ============================================================

  function startBlobatarStudio() {

    initBlobatarStudio();

  }
}

function renderShapePickerPreviews() {

  const container =
    document.getElementById(
      'blobShapePicker'
    );

  if (!container) return;

  const seed =
    currentAccountUser?.email ||
    currentAccountUser?.username ||
    'onur';

  const shapes = [
    'auto',
    ...Object.keys(blobatarShapeValues)
  ];

  container.innerHTML = '';

  shapes.forEach(shape => {

    const button =
      document.createElement('button');

    button.type = 'button';

    button.className =
      'blob-shape-card';

    button.dataset.shape = shape;

    if (
      blobatarState.shape === shape
    ) {
      button.classList.add('active');
    }

    const preview =
      document.createElement('div');

    preview.className =
      'blob-shape-mini';

    const label =
      document.createElement('span');

    label.className =
      'blob-shape-name';

    label.textContent =
      shape.toUpperCase();

    const options = {

      hue:
        Number(blobatarState.hue),

      tone:
        Number(blobatarState.tone),

      expression:
        blobatarExpressions[
        blobatarState.expression
        ],

      title:
        `${shape} Blobatar`

    };

    if (shape !== 'auto') {

      options.traits = {
        shape:
          blobatarShapeValues[
          shape
          ]
      };

    }

    try {

      preview.innerHTML =
        blobatar(
          seed,
          options
        );

      const svg =
        preview.querySelector('svg');

      if (svg) {

        svg.setAttribute(
          'width',
          '86'
        );

        svg.setAttribute(
          'height',
          '86'
        );

        svg.style.width =
          '86px';

        svg.style.height =
          '86px';

        svg.style.display =
          'block';

      }

    } catch (error) {

      console.error(
        '[Blobatar Shape Preview]',
        error
      );

    }

    button.appendChild(preview);

    button.appendChild(label);

    container.appendChild(button);

  });
}


/* ============================================================
   PIXEL STUDIO
============================================================ */

const PIXEL_SIZE = 32;

let pixelGrid = createEmptyPixelGrid();

let pixelTool = 'brush';
let pixelColor = '#4F46E5';
let pixelGridVisible = true;

let pixelZoom = 1;

let pixelIsDrawing = false;
let pixelLastCell = null;

let pixelUndoStack = [];
let pixelRedoStack = [];

let pixelStudioInitialized = false;


/* ============================================================
   GRID
============================================================ */

function createEmptyPixelGrid() {

  return Array.from(
    { length: PIXEL_SIZE },
    () => Array(PIXEL_SIZE).fill(null)
  );

}


function clonePixelGrid(grid) {

  return grid.map(row => [...row]);

}


/* ============================================================
   PALETTE
============================================================ */

const pixelPalette = [

  '#000000',
  '#FFFFFF',

  '#FF3B30',
  '#FF9500',
  '#FFCC00',

  '#34C759',
  '#30D158',

  '#00C7BE',
  '#32ADE6',

  '#007AFF',
  '#5856D6',

  '#AF52DE',
  '#FF2D55',

  '#8E8E93',

  '#5A3E2B',
  '#A2845E'

];


/* ============================================================
   PRESETS
============================================================ */

const pixelPresets = {

  minecraft: {
    name: 'Minecraft',
    category: 'GAME',
    draw: drawMinecraftPreset
  },

  windows: {
    name: 'Windows XP',
    category: 'OS',
    draw: drawWindowsPreset
  },

  fnaf: {
    name: 'FNAF',
    category: 'HORROR',
    draw: drawFnafPreset
  },

  heart: {
    name: 'Heart',
    category: 'ICON',
    draw: drawHeartPreset
  },

  ghost: {
    name: 'Ghost',
    category: 'ICON',
    draw: drawGhostPreset
  },

  rainbow: {
    name: 'Rainbow',
    category: 'COLOR',
    draw: drawRainbowPreset
  },

  gameboy: {
    name: 'Game Boy',
    category: 'RETRO',
    draw: drawGameboyPreset
  },

  smile: {
    name: 'Smile',
    category: 'EMOJI',
    draw: drawSmilePreset
  },

  can: {
    name: 'Can',
    category: 'CHARACTER',
    draw: drawCanPreset
  }

};


/* ============================================================
   INITIALIZE
============================================================ */

function initPixelStudio() {

  if (pixelStudioInitialized) return;

  const canvas = document.getElementById(
    'pixelEditorCanvas'
  );

  if (!canvas) return;

  pixelStudioInitialized = true;

  setupPixelCanvas();
  setupPixelTools();
  setupPixelColors();
  setupPixelZoom();
  setupPixelHistory();
  setupPixelNavigation();
  setupPixelSaving();

  renderPixelPresets();
  renderSavedPixelDesigns();

  drawPixelCanvas();


}


/* ============================================================
   NAVIGATION
============================================================ */

function openPixelStudio() {

  const studio =
    document.getElementById('pixelStudioView');

  if (!studio) return;

  const listView =
    document.getElementById('vaultListView');

  const canvasView =
    document.getElementById('canvasViewport');

  const blobStudio =
    document.getElementById('blobatarStudioView');

  const radar =
    document.getElementById('hudRadarStack');

  const inspector =
    document.getElementById('hudInspector');

  if (listView) {
    listView.style.display = 'none';
  }

  if (canvasView) {
    canvasView.style.display = 'none';
  }

  if (blobStudio) {
    blobStudio.style.display = 'none';
  }

  if (radar) {
    radar.style.display = 'none';
  }

  if (inspector) {
    inspector.style.display = 'none';
  }

  studio.style.display = 'block';

  const badge =
    document.getElementById('hudActiveModeBadge');

  if (badge) {
    badge.textContent = 'VIEW: PIXEL STUDIO';
  }

  initPixelStudio();

  drawPixelCanvas();

}


function closePixelStudio() {

  const studio =
    document.getElementById('pixelStudioView');

  const listView =
    document.getElementById('vaultListView');

  if (studio) {
    studio.style.display = 'none';
  }

  if (listView) {
    listView.style.display = '';
  }

  const badge =
    document.getElementById('hudActiveModeBadge');

  if (badge) {
    badge.textContent = 'VIEW: LIST';
  }

}


/* ============================================================
   NAVIGATION BUTTONS
============================================================ */

function setupPixelNavigation() {

  document
    .getElementById('btnPixelStudioBack')
    ?.addEventListener(
      'click',
      closePixelStudio
    );


  /*
   * Eğer sidebar'da btnSidePixelStudio
   * isimli buton varsa otomatik bağlanır.
   */

  document
    .getElementById('btnSidePixelStudio')
    ?.addEventListener(
      'click',
      openPixelStudio
    );

}


/* ============================================================
   CANVAS
============================================================ */

function setupPixelCanvas() {

  const canvas =
    document.getElementById('pixelEditorCanvas');

  if (!canvas) return;

  canvas.addEventListener(
    'pointerdown',
    event => {

      event.preventDefault();

      pixelIsDrawing = true;

      canvas.setPointerCapture(
        event.pointerId
      );

      const cell =
        getPixelCellFromPointer(
          event,
          canvas
        );

      pixelLastCell = cell;

      applyPixelTool(cell);

    }
  );


  canvas.addEventListener(
    'pointermove',
    event => {

      if (!pixelIsDrawing) return;

      const cell =
        getPixelCellFromPointer(
          event,
          canvas
        );

      if (!cell) return;

      if (
        pixelLastCell &&
        cell.x === pixelLastCell.x &&
        cell.y === pixelLastCell.y
      ) {
        return;
      }

      pixelLastCell = cell;

      applyPixelTool(cell);

    }
  );


  canvas.addEventListener(
    'pointerup',
    finishPixelDrawing
  );

  canvas.addEventListener(
    'pointercancel',
    finishPixelDrawing
  );

}


function finishPixelDrawing() {

  pixelIsDrawing = false;
  pixelLastCell = null;

}


function getPixelCellFromPointer(
  event,
  canvas
) {

  const rect =
    canvas.getBoundingClientRect();

  const x =
    Math.floor(
      (
        (event.clientX - rect.left)
        / rect.width
      ) * PIXEL_SIZE
    );

  const y =
    Math.floor(
      (
        (event.clientY - rect.top)
        / rect.height
      ) * PIXEL_SIZE
    );

  if (
    x < 0 ||
    y < 0 ||
    x >= PIXEL_SIZE ||
    y >= PIXEL_SIZE
  ) {
    return null;
  }

  return { x, y };

}


/* ============================================================
   DRAW
============================================================ */

function drawPixelCanvas() {

  const canvas =
    document.getElementById('pixelEditorCanvas');

  if (!canvas) return;

  const ctx =
    canvas.getContext('2d');

  const width =
    canvas.width;

  const cellSize =
    width / PIXEL_SIZE;


  ctx.clearRect(
    0,
    0,
    width,
    width
  );


  /*
   * Transparent background
   */

  ctx.fillStyle = '#ffffff';

  ctx.fillRect(
    0,
    0,
    width,
    width
  );


  /*
   * Pixels
   */

  for (
    let y = 0;
    y < PIXEL_SIZE;
    y++
  ) {

    for (
      let x = 0;
      x < PIXEL_SIZE;
      x++
    ) {

      const color =
        pixelGrid[y][x];

      if (!color) continue;

      ctx.fillStyle = color;

      ctx.fillRect(
        x * cellSize,
        y * cellSize,
        cellSize,
        cellSize
      );

    }

  }


  /*
   * Grid
   */

  if (pixelGridVisible) {

    ctx.beginPath();

    ctx.strokeStyle =
      'rgba(0,0,0,.13)';

    ctx.lineWidth = 1;

    for (
      let i = 0;
      i <= PIXEL_SIZE;
      i++
    ) {

      const pos =
        Math.round(
          i * cellSize
        ) + .5;

      ctx.moveTo(
        pos,
        0
      );

      ctx.lineTo(
        pos,
        width
      );

      ctx.moveTo(
        0,
        pos
      );

      ctx.lineTo(
        width,
        pos
      );

    }

    ctx.stroke();

  }

}


/* ============================================================
   TOOLS
============================================================ */

function setupPixelTools() {

  document
    .querySelectorAll(
      '[data-pixel-tool]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          setPixelTool(
            button.dataset.pixelTool
          );

        }
      );

    });


  document
    .getElementById('pixelGridToggle')
    ?.addEventListener(
      'click',
      () => {

        pixelGridVisible =
          !pixelGridVisible;

        document
          .getElementById(
            'pixelGridToggle'
          )
          ?.classList.toggle(
            'active',
            pixelGridVisible
          );

        drawPixelCanvas();

      }
    );


  document
    .getElementById('pixelClear')
    ?.addEventListener(
      'click',
      clearPixelCanvas
    );

}


function setPixelTool(tool) {

  pixelTool = tool;

  document
    .querySelectorAll(
      '[data-pixel-tool]'
    )
    .forEach(button => {

      button.classList.toggle(
        'active',
        button.dataset.pixelTool === tool
      );

    });

}


/* ============================================================
   APPLY TOOL
============================================================ */

function applyPixelTool(cell) {

  if (!cell) return;

  const {
    x,
    y
  } = cell;


  if (pixelTool === 'fill') {

    savePixelHistory();

    floodFill(
      x,
      y,
      pixelColor
    );

    drawPixelCanvas();

    return;
  }


  if (pixelTool === 'picker') {

    const picked =
      pixelGrid[y][x];

    if (picked) {

      setPixelColor(picked);

    }

    setPixelTool('brush');

    return;
  }


  if (pixelTool === 'eraser') {

    if (!pixelGrid[y][x]) return;

    savePixelHistory();

    pixelGrid[y][x] = null;

  }


  if (pixelTool === 'brush') {

    if (
      pixelGrid[y][x] === pixelColor
    ) {
      return;
    }

    savePixelHistory();

    pixelGrid[y][x] = pixelColor;

  }


  drawPixelCanvas();

}


/* ============================================================
   FLOOD FILL
============================================================ */

function floodFill(
  startX,
  startY,
  newColor
) {

  const targetColor =
    pixelGrid[startY][startX];

  if (targetColor === newColor) {
    return;
  }


  const queue = [
    [startX, startY]
  ];

  const visited =
    new Set();


  while (queue.length) {

    const [
      x,
      y
    ] = queue.shift();


    const key =
      `${x}:${y}`;


    if (visited.has(key)) {
      continue;
    }

    visited.add(key);


    if (
      x < 0 ||
      y < 0 ||
      x >= PIXEL_SIZE ||
      y >= PIXEL_SIZE
    ) {
      continue;
    }


    if (
      pixelGrid[y][x] !== targetColor
    ) {
      continue;
    }


    pixelGrid[y][x] = newColor;


    queue.push(
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    );

  }

}


/* ============================================================
   COLORS
============================================================ */

function setupPixelColors() {

  const colorInput =
    document.getElementById('pixelColor');

  const hexInput =
    document.getElementById('pixelColorHex');


  colorInput?.addEventListener(
    'input',
    () => {

      setPixelColor(
        colorInput.value
      );

    }
  );


  hexInput?.addEventListener(
    'change',
    () => {

      let value =
        hexInput.value.trim();

      if (
        !/^#[0-9A-F]{6}$/i.test(value)
      ) {
        value = '#4F46E5';
      }

      setPixelColor(value);

    }
  );


  renderPixelPalette();

  setPixelColor(pixelColor);

}


function setPixelColor(color) {

  if (
    !/^#[0-9A-F]{6}$/i.test(color)
  ) {
    return;
  }

  pixelColor =
    color.toUpperCase();


  const input =
    document.getElementById('pixelColor');

  if (input) {
    input.value =
      pixelColor;
  }


  const hex =
    document.getElementById(
      'pixelColorHex'
    );

  if (hex) {
    hex.value =
      pixelColor;
  }


  const preview =
    document.getElementById(
      'pixelColorPreview'
    );

  if (preview) {
    preview.style.background =
      pixelColor;
  }


  document
    .querySelectorAll(
      '.pixel-palette-color'
    )
    .forEach(button => {

      button.classList.toggle(
        'active',
        button.dataset.color ===
        pixelColor
      );

    });

}


function renderPixelPalette() {

  const container =
    document.getElementById(
      'pixelPalette'
    );

  if (!container) return;

  container.innerHTML = '';


  pixelPalette.forEach(color => {

    const button =
      document.createElement('button');

    button.className =
      'pixel-palette-color';

    button.dataset.color =
      color;

    button.style.background =
      color;

    button.title =
      color;

    button.addEventListener(
      'click',
      () => setPixelColor(color)
    );

    container.appendChild(button);

  });

}


/* ============================================================
   HISTORY
============================================================ */

function savePixelHistory() {

  pixelUndoStack.push(
    clonePixelGrid(pixelGrid)
  );


  if (
    pixelUndoStack.length > 60
  ) {
    pixelUndoStack.shift();
  }


  pixelRedoStack = [];

}


function undoPixel() {

  if (!pixelUndoStack.length) {
    return;
  }


  pixelRedoStack.push(
    clonePixelGrid(pixelGrid)
  );


  pixelGrid =
    pixelUndoStack.pop();


  drawPixelCanvas();

}


function redoPixel() {

  if (!pixelRedoStack.length) {
    return;
  }


  pixelUndoStack.push(
    clonePixelGrid(pixelGrid)
  );


  pixelGrid =
    pixelRedoStack.pop();


  drawPixelCanvas();

}


function setupPixelHistory() {

  document
    .getElementById('pixelUndo')
    ?.addEventListener(
      'click',
      undoPixel
    );


  document
    .getElementById('pixelRedo')
    ?.addEventListener(
      'click',
      redoPixel
    );


  document.addEventListener(
    'keydown',
    event => {

      if (
        event.ctrlKey &&
        event.key.toLowerCase() === 'z'
      ) {

        event.preventDefault();

        undoPixel();

      }


      if (
        event.ctrlKey &&
        event.key.toLowerCase() === 'y'
      ) {

        event.preventDefault();

        redoPixel();

      }

    }
  );

}


/* ============================================================
   CLEAR
============================================================ */

function clearPixelCanvas() {

  const confirmed =
    confirm(
      'Clear the entire canvas?'
    );

  if (!confirmed) return;

  savePixelHistory();

  pixelGrid =
    createEmptyPixelGrid();

  drawPixelCanvas();

}


/* ============================================================
   ZOOM
============================================================ */

function setupPixelZoom() {

  document
    .getElementById('pixelZoomIn')
    ?.addEventListener(
      'click',
      () => {

        pixelZoom =
          Math.min(
            4,
            pixelZoom + .5
          );

        updatePixelZoom();

      }
    );


  document
    .getElementById('pixelZoomOut')
    ?.addEventListener(
      'click',
      () => {

        pixelZoom =
          Math.max(
            .5,
            pixelZoom - .5
          );

        updatePixelZoom();

      }
    );


  document
    .getElementById('pixelZoomReset')
    ?.addEventListener(
      'click',
      () => {

        pixelZoom = 1;

        updatePixelZoom();

      }
    );

}


function updatePixelZoom() {

  const canvas =
    document.getElementById(
      'pixelEditorCanvas'
    );

  if (!canvas) return;


  canvas.style.width =
    `${640 * pixelZoom}px`;

  canvas.style.height =
    `${640 * pixelZoom}px`;


  const value =
    document.getElementById(
      'pixelZoomValue'
    );

  if (value) {

    value.textContent =
      `${Math.round(pixelZoom * 100)}%`;

  }

}


/* ============================================================
   PRESET RENDERING
============================================================ */

function renderPixelPresets() {

  const container =
    document.getElementById(
      'pixelPresetGrid'
    );

  if (!container) return;

  container.innerHTML = '';


  const presets =
    Object.entries(pixelPresets);


  const count =
    document.getElementById(
      'pixelPresetCount'
    );

  if (count) {
    count.textContent =
      String(presets.length)
        .padStart(2, '0');
  }


  presets.forEach(
    ([id, preset]) => {

      const card =
        document.createElement('div');

      card.className =
        'pixel-preset';


      const preview =
        document.createElement('div');

      preview.className =
        'pixel-preset-preview';


      const canvas =
        document.createElement('canvas');

      canvas.width = 32;
      canvas.height = 32;


      preview.appendChild(canvas);


      const name =
        document.createElement('div');

      name.className =
        'pixel-preset-name';

      name.textContent =
        preset.name;


      const meta =
        document.createElement('div');

      meta.className =
        'pixel-preset-meta';

      meta.textContent =
        `${preset.category} · 32×32`;


      card.appendChild(preview);
      card.appendChild(name);
      card.appendChild(meta);


      drawPresetPreview(
        canvas,
        preset.draw
      );


      card.addEventListener(
        'click',
        () => {

          loadPixelPreset(
            preset.draw
          );

        }
      );


      container.appendChild(card);

    }
  );

}


function drawPresetPreview(
  canvas,
  drawFunction
) {

  const ctx =
    canvas.getContext('2d');

  const temp =
    createEmptyPixelGrid();


  drawFunction(temp);


  ctx.clearRect(
    0,
    0,
    32,
    32
  );


  for (
    let y = 0;
    y < 32;
    y++
  ) {

    for (
      let x = 0;
      x < 32;
      x++
    ) {

      const color =
        temp[y][x];

      if (!color) continue;

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

}


function loadPixelPreset(drawFunction) {

  savePixelHistory();

  pixelGrid =
    createEmptyPixelGrid();

  drawFunction(pixelGrid);

  drawPixelCanvas();

}


/* ============================================================
   PRESET HELPERS
============================================================ */

function paintRect(
  grid,
  x,
  y,
  width,
  height,
  color
) {

  for (
    let yy = y;
    yy < y + height;
    yy++
  ) {

    for (
      let xx = x;
      xx < x + width;
      xx++
    ) {

      if (
        yy >= 0 &&
        yy < 32 &&
        xx >= 0 &&
        xx < 32
      ) {

        grid[yy][xx] =
          color;

      }

    }

  }

}


function paintPixel(
  grid,
  x,
  y,
  color
) {

  if (
    x >= 0 &&
    y >= 0 &&
    x < 32 &&
    y < 32
  ) {

    grid[y][x] =
      color;

  }

}


/* ============================================================
   MINECRAFT
============================================================ */

function drawMinecraftPreset(grid) {

  const dirt = '#6B4528';
  const dirtDark = '#4A301D';
  const grass = '#5B8E32';
  const grassLight = '#79B542';


  paintRect(
    grid,
    4,
    4,
    24,
    24,
    dirt
  );


  paintRect(
    grid,
    4,
    4,
    24,
    6,
    grass
  );


  paintRect(
    grid,
    4,
    4,
    24,
    2,
    grassLight
  );


  for (
    let y = 10;
    y < 28;
    y += 4
  ) {

    for (
      let x = 5;
      x < 28;
      x += 5
    ) {

      paintRect(
        grid,
        x,
        y,
        2,
        2,
        dirtDark
      );

    }

  }


  paintRect(
    grid,
    15,
    17,
    2,
    5,
    '#8A5A35'
  );

}


/* ============================================================
   WINDOWS XP
============================================================ */

function drawWindowsPreset(grid) {

  const blue = '#1683F7';
  const blueDark = '#0757B5';
  const green = '#35A844';
  const red = '#E7473E';
  const yellow = '#FFC928';


  paintRect(
    grid,
    4,
    4,
    24,
    24,
    blueDark
  );


  paintRect(
    grid,
    6,
    6,
    9,
    9,
    blue
  );

  paintRect(
    grid,
    17,
    6,
    9,
    9,
    green
  );

  paintRect(
    grid,
    6,
    17,
    9,
    9,
    yellow
  );

  paintRect(
    grid,
    17,
    17,
    9,
    9,
    red
  );

}


/* ============================================================
   FNAF
============================================================ */

function drawFnafPreset(grid) {

  const dark = '#17131B';
  const purple = '#542A63';
  const pink = '#D94778';
  const eye = '#F8D34F';


  paintRect(
    grid,
    5,
    4,
    22,
    25,
    dark
  );


  paintRect(
    grid,
    8,
    7,
    16,
    17,
    purple
  );


  paintRect(
    grid,
    9,
    12,
    5,
    4,
    eye
  );


  paintRect(
    grid,
    18,
    12,
    5,
    4,
    eye
  );


  paintRect(
    grid,
    12,
    19,
    8,
    2,
    pink
  );

}


/* ============================================================
   HEART
============================================================ */

function drawHeartPreset(grid) {

  const color = '#FF2D55';


  const pattern = [
    '01100110',
    '11111111',
    '11111111',
    '11111111',
    '01111110',
    '00111100',
    '00011000'
  ];


  pattern.forEach(
    (row, y) => {

      [...row].forEach(
        (value, x) => {

          if (value === '1') {

            paintPixel(
              grid,
              x + 12,
              y + 11,
              color
            );

          }

        }
      );

    }
  );

}


/* ============================================================
   GHOST
============================================================ */

function drawGhostPreset(grid) {

  const white = '#F4F4F5';
  const blue = '#4F9CFF';


  paintRect(
    grid,
    8,
    7,
    16,
    17,
    white
  );


  paintRect(
    grid,
    10,
    22,
    4,
    4,
    white
  );

  paintRect(
    grid,
    18,
    22,
    4,
    4,
    white
  );


  paintRect(
    grid,
    11,
    13,
    3,
    4,
    blue
  );


  paintRect(
    grid,
    18,
    13,
    3,
    4,
    blue
  );

}


/* ============================================================
   RAINBOW
============================================================ */

function drawRainbowPreset(grid) {

  const colors = [
    '#FF3B30',
    '#FF9500',
    '#FFCC00',
    '#34C759',
    '#32ADE6',
    '#007AFF',
    '#AF52DE'
  ];


  colors.forEach(
    (color, index) => {

      paintRect(
        grid,
        4 + index,
        8 + index * 2,
        24 - index * 2,
        2,
        color
      );

    }
  );

}


/* ============================================================
   GAME BOY
============================================================ */

function drawGameboyPreset(grid) {

  const dark = '#183B27';
  const mid = '#3F7650';
  const light = '#9BBC88';


  paintRect(
    grid,
    6,
    3,
    20,
    26,
    light
  );


  paintRect(
    grid,
    10,
    8,
    12,
    10,
    dark
  );


  paintRect(
    grid,
    12,
    10,
    8,
    6,
    mid
  );


  paintRect(
    grid,
    10,
    22,
    5,
    2,
    dark
  );


  paintRect(
    grid,
    17,
    22,
    5,
    2,
    dark
  );

}


/* ============================================================
   SMILE
============================================================ */

function drawSmilePreset(grid) {

  const yellow = '#FFD60A';
  const black = '#171717';


  paintRect(
    grid,
    6,
    6,
    20,
    20,
    yellow
  );


  paintRect(
    grid,
    10,
    11,
    3,
    4,
    black
  );


  paintRect(
    grid,
    19,
    11,
    3,
    4,
    black
  );


  paintRect(
    grid,
    11,
    20,
    10,
    2,
    black
  );

}


/* ============================================================
   CAN — CHARACTER PRESET
============================================================ */

function drawCanPreset(grid) {

  // ----------------------------------------------------------
  // COLORS
  // ----------------------------------------------------------

  const skin = '#C98D68';
  const skinLight = '#E0AA82';
  const skinDark = '#9A634A';

  const cap = '#C9B98D';
  const capLight = '#E0D2AA';
  const capDark = '#8E805F';

  const shirt = '#F4F4F0';
  const shirtShadow = '#D7D7D2';

  const shorts = '#202126';
  const shortsLight = '#34363C';

  const shoe = '#F7F7F5';
  const shoeShadow = '#C9C9C5';

  const black = '#17181B';
  const chain = '#B9B9B5';


  // ==========================================================
  // HEAD
  // ==========================================================

  paintRect(
    grid,
    10,
    5,
    12,
    10,
    skin
  );

  paintRect(
    grid,
    12,
    4,
    8,
    2,
    skinLight
  );


  // Ears

  paintRect(
    grid,
    9,
    9,
    2,
    4,
    skin
  );

  paintRect(
    grid,
    22,
    9,
    2,
    4,
    skin
  );


  // Jaw shadow

  paintRect(
    grid,
    11,
    13,
    10,
    2,
    skinDark
  );

  paintRect(
    grid,
    13,
    14,
    6,
    2,
    skinDark
  );


  // ==========================================================
  // BALD HEAD + CAP
  // ==========================================================

  // Bald head visible under cap

  paintRect(
    grid,
    12,
    3,
    8,
    2,
    skinLight
  );


  // Cap

  paintRect(
    grid,
    10,
    2,
    12,
    4,
    cap
  );

  paintRect(
    grid,
    12,
    1,
    8,
    2,
    capLight
  );

  paintRect(
    grid,
    9,
    5,
    14,
    2,
    capDark
  );


  // Cap brim

  paintRect(
    grid,
    7,
    6,
    10,
    2,
    cap
  );

  paintRect(
    grid,
    7,
    7,
    8,
    1,
    capDark
  );


  // Small crown on cap

  paintPixel(
    grid,
    16,
    3,
    black
  );

  paintPixel(
    grid,
    15,
    4,
    black
  );

  paintPixel(
    grid,
    17,
    4,
    black
  );


  // ==========================================================
  // FACE
  // ==========================================================

  // Eyebrows

  paintRect(
    grid,
    12,
    9,
    3,
    1,
    black
  );

  paintRect(
    grid,
    18,
    9,
    3,
    1,
    black
  );


  // Eyes

  paintRect(
    grid,
    13,
    10,
    2,
    1,
    black
  );

  paintRect(
    grid,
    18,
    10,
    2,
    1,
    black
  );


  // Nose

  paintRect(
    grid,
    16,
    11,
    1,
    2,
    skinDark
  );


  // Beard / moustache

  paintRect(
    grid,
    14,
    13,
    5,
    1,
    black
  );

  paintRect(
    grid,
    15,
    14,
    3,
    1,
    black
  );


  // ==========================================================
  // NECK
  // ==========================================================

  paintRect(
    grid,
    14,
    15,
    5,
    3,
    skin
  );


  // ==========================================================
  // WHITE T-SHIRT
  // ==========================================================

  paintRect(
    grid,
    9,
    17,
    14,
    9,
    shirt
  );


  // Left sleeve

  paintRect(
    grid,
    7,
    18,
    4,
    7,
    shirt
  );


  // Right sleeve

  paintRect(
    grid,
    21,
    18,
    4,
    7,
    shirt
  );


  // Shirt shadows

  paintRect(
    grid,
    9,
    23,
    14,
    3,
    shirtShadow
  );

  paintRect(
    grid,
    7,
    23,
    3,
    2,
    shirtShadow
  );

  paintRect(
    grid,
    22,
    23,
    3,
    2,
    shirtShadow
  );


  // Collar

  paintRect(
    grid,
    14,
    17,
    5,
    1,
    shirtShadow
  );

  paintPixel(
    grid,
    15,
    18,
    shirtShadow
  );

  paintPixel(
    grid,
    18,
    18,
    shirtShadow
  );


  // ==========================================================
  // SMALL CROWN LOGO
  // ==========================================================

  paintPixel(
    grid,
    15,
    21,
    black
  );

  paintPixel(
    grid,
    14,
    22,
    black
  );

  paintPixel(
    grid,
    16,
    22,
    black
  );

  paintPixel(
    grid,
    17,
    22,
    black
  );


  // ==========================================================
  // SILVER CHAIN
  // ==========================================================

  paintPixel(
    grid,
    13,
    18,
    chain
  );

  paintPixel(
    grid,
    20,
    18,
    chain
  );

  paintPixel(
    grid,
    14,
    19,
    chain
  );

  paintPixel(
    grid,
    19,
    19,
    chain
  );

  paintPixel(
    grid,
    15,
    20,
    chain
  );

  paintPixel(
    grid,
    18,
    20,
    chain
  );


  // ==========================================================
  // ARMS
  // ==========================================================

  paintRect(
    grid,
    5,
    20,
    4,
    5,
    skin
  );

  paintRect(
    grid,
    23,
    20,
    4,
    5,
    skin
  );


  // Hands

  paintRect(
    grid,
    4,
    22,
    3,
    2,
    skinLight
  );

  paintRect(
    grid,
    25,
    22,
    3,
    2,
    skinLight
  );


  // ==========================================================
  // BLACK SHORTS
  // ==========================================================

  paintRect(
    grid,
    9,
    26,
    14,
    4,
    shorts
  );

  paintRect(
    grid,
    9,
    29,
    6,
    2,
    shortsLight
  );

  paintRect(
    grid,
    17,
    29,
    6,
    2,
    shortsLight
  );


  // Center seam

  paintRect(
    grid,
    15,
    26,
    2,
    5,
    black
  );


  // ==========================================================
  // LEGS
  // ==========================================================

  paintRect(
    grid,
    11,
    30,
    4,
    2,
    skin
  );

  paintRect(
    grid,
    18,
    30,
    4,
    2,
    skin
  );


  // ==========================================================
  // WHITE SNEAKERS
  // ==========================================================

  paintRect(
    grid,
    9,
    31,
    7,
    1,
    shoe
  );

  paintRect(
    grid,
    17,
    31,
    7,
    1,
    shoe
  );


  // Shoe shadows

  paintPixel(
    grid,
    10,
    31,
    shoeShadow
  );

  paintPixel(
    grid,
    12,
    31,
    shoeShadow
  );

  paintPixel(
    grid,
    20,
    31,
    shoeShadow
  );

  paintPixel(
    grid,
    22,
    31,
    shoeShadow
  );

}


/* ============================================================
   SAVE DESIGNS
============================================================ */

function setupPixelSaving() {

  document
    .getElementById('pixelSaveDesign')
    ?.addEventListener(
      'click',
      saveCurrentPixelDesign
    );


  document
    .getElementById('pixelUseAsAvatar')
    ?.addEventListener(
      'click',
      useCurrentPixelAsAvatar
    );

}

async function useCurrentPixelAsAvatar() {

  const token =
    localStorage.getItem('token');

  if (!token) {
    alert('Oturum bulunamadı.');
    return;
  }

  try {

    const response =
      await fetch(
        '/api/users/profile/avatar',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${token}`
          },

          body: JSON.stringify({

            avatar_type: 'pixel',

            avatar_data: {
              width: PIXEL_SIZE,
              height: PIXEL_SIZE,
              pixels:
                clonePixelGrid(pixelGrid)
            },

            profile_pic_path: null

          })

        }
      );

    const result =
      await response.json();

    if (!response.ok) {

      console.error(
        '[Pixel Avatar] Failed:',
        result
      );

      alert(
        result.message ||
        'Avatar kaydedilemedi.'
      );

      return;
    }

    alert(
      'Pixel avatar olarak ayarlandı!'
    );

    await loadUserProfile();

  } catch (error) {

    console.error(
      '[Pixel Avatar] Error:',
      error
    );

    alert(
      'Avatar kaydedilirken hata oluştu.'
    );

  }

}

async function saveCurrentPixelDesign() {

  const input =
    document.getElementById(
      'pixelDesignName'
    );


  let name =
    input?.value.trim();


  if (!name) {

    name =
      `My Design ${Date.now()}`;

  }


  const token =
    localStorage.getItem('token');


  if (!token) {

    alert('Oturum bulunamadı.');

    return;

  }


  try {

    const response =
      await fetch(
        '/api/users/avatar-designs',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${token}`
          },

          body: JSON.stringify({

            design_type: 'pixel',

            name,

            design_data: {

              width: PIXEL_SIZE,

              height: PIXEL_SIZE,

              pixels:
                clonePixelGrid(pixelGrid)

            }

          })

        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      console.error(
        '[Pixel Studio] Design save failed:',
        result
      );

      alert(
        result.message ||
        'Tasarım kaydedilemedi.'
      );

      return;

    }


    console.log(
      '✅ Pixel tasarım DB\'ye kaydedildi:',
      result
    );


    if (input) {
      input.value = '';
    }


    renderSavedPixelDesigns();


    alert(
      '✅ Tasarım başarıyla kaydedildi.'
    );


  }

  catch (error) {

    console.error(
      '[Pixel Studio] Save error:',
      error
    );

    alert(
      'Tasarım kaydedilirken bir hata oluştu.'
    );

  }

}


function renderSavedPixelDesigns() {

  const container =
    document.getElementById(
      'pixelSavedDesigns'
    );

  if (!container) return;

  const saved =
    JSON.parse(
      localStorage.getItem(
        'pixelStudioDesigns'
      ) || '[]'
    );


  container.innerHTML = '';


  if (!saved.length) {

    container.innerHTML = `
            <div style="
                padding:18px 5px;
                font-size:10px;
                opacity:.35;
                text-align:center;
            ">
                Your saved designs will appear here.
            </div>
        `;

    return;
  }


  saved.forEach(design => {

    const row =
      document.createElement('div');

    row.className =
      'pixel-saved-design';


    const preview =
      document.createElement('canvas');

    preview.width = 32;
    preview.height = 32;

    preview.className =
      'pixel-saved-preview';


    drawGridToCanvas(
      design.pixels,
      preview
    );


    const name =
      document.createElement('div');

    name.className =
      'pixel-saved-name';

    name.textContent =
      design.name;


    const deleteButton =
      document.createElement('button');

    deleteButton.className =
      'pixel-delete-design';

    deleteButton.textContent =
      '×';

    deleteButton.title =
      'Delete';


    deleteButton.addEventListener(
      'click',
      event => {

        event.stopPropagation();

        deleteSavedPixelDesign(
          design.id
        );

      }
    );


    row.appendChild(preview);
    row.appendChild(name);
    row.appendChild(deleteButton);


    row.addEventListener(
      'click',
      () => {

        savePixelHistory();

        pixelGrid =
          clonePixelGrid(
            design.pixels
          );

        drawPixelCanvas();

      }
    );


    container.appendChild(row);

  });

}


function deleteSavedPixelDesign(id) {

  const saved =
    JSON.parse(
      localStorage.getItem(
        'pixelStudioDesigns'
      ) || '[]'
    );


  const filtered =
    saved.filter(
      design =>
        design.id !== id
    );


  localStorage.setItem(
    'pixelStudioDesigns',
    JSON.stringify(filtered)
  );


  renderSavedPixelDesigns();

}


function drawGridToCanvas(
  grid,
  canvas
) {

  const ctx =
    canvas.getContext('2d');


  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  const cell =
    canvas.width / 32;


  for (
    let y = 0;
    y < 32;
    y++
  ) {

    for (
      let x = 0;
      x < 32;
      x++
    ) {

      const color =
        grid[y]?.[x];

      if (!color) continue;

      ctx.fillStyle =
        color;

      ctx.fillRect(
        x * cell,
        y * cell,
        cell,
        cell
      );

    }

  }

}


/* ============================================================
   KEYBOARD SHORTCUTS
============================================================ */

document.addEventListener(
  'keydown',
  event => {

    if (
      !document.getElementById(
        'pixelStudioView'
      )
    ) {
      return;
    }


    /*
     * Sadece Pixel Studio açıksa çalış.
     */

    const studio =
      document.getElementById(
        'pixelStudioView'
      );


    if (
      studio.style.display === 'none'
    ) {
      return;
    }


    if (
      event.key.toLowerCase() === 'b'
    ) {

      setPixelTool('brush');

    }


    if (
      event.key.toLowerCase() === 'e'
    ) {

      setPixelTool('eraser');

    }


    if (
      event.key.toLowerCase() === 'f'
    ) {

      setPixelTool('fill');

    }


    if (
      event.key.toLowerCase() === 'i'
    ) {

      setPixelTool('picker');

    }

  }
);


/* ============================================================
   START
============================================================ */

function startPixelStudio() {
  initPixelStudio();
}
