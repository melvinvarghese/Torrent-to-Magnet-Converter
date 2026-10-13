import { makeHybridTorrent, makeV1Torrent, makeV2Torrent, utf8 } from '../test/fixtures.js';

const report = document.querySelector('#report');
const frame = document.querySelector('#app-frame');
const lines = [];

function check(condition, description) {
  if (!condition) throw new Error(description);
  lines.push(`PASS ${description}`);
}

function waitFor(condition, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = () => {
      if (condition()) return resolve();
      if (Date.now() - start > timeout) return reject(new Error('Timed out waiting for the page to update'));
      setTimeout(poll, 30);
    };
    poll();
  });
}

async function run() {
  try {
    await new Promise((resolve, reject) => {
      const expectedUrl = new URL(frame.src, location.href).href;
      const cleanup = () => {
        frame.removeEventListener('load', checkReady);
        frame.removeEventListener('error', fail);
      };
      const checkReady = () => {
        if (frame.contentDocument?.readyState === 'complete' && frame.contentDocument.URL === expectedUrl) {
          cleanup();
          resolve();
        }
      };
      const fail = () => {
        cleanup();
        reject(new Error('Could not load the app preview'));
      };
      frame.addEventListener('load', checkReady);
      frame.addEventListener('error', fail);
      checkReady();
    });
    const view = frame.contentWindow;
    const app = frame.contentDocument;
    const input = app.querySelector('#file-input');
    check(Boolean(input), 'file picker exists');
    check(input.getAttribute('aria-label') === 'Select .torrent files', 'file picker has an accessible name');
    check(input.tabIndex >= 0, 'file picker is keyboard reachable');
    const dropzone = app.querySelector('#dropzone');
    check(dropzone.tagName === 'LABEL' && dropzone.htmlFor === 'file-input', 'drop zone is the accessible file-picker label');
    let pickerActivations = 0;
    const countPickerActivation = (event) => {
      pickerActivations += 1;
      event.preventDefault();
    };
    input.addEventListener('click', countPickerActivation);
    dropzone.click();
    input.removeEventListener('click', countPickerActivation);
    check(pickerActivations === 1, 'clicking the drop zone activates the file picker');
    const focusRule = Array.from(app.styleSheets).flatMap((sheet) => Array.from(sheet.cssRules))
      .find((rule) => rule.selectorText?.includes('#file-input:focus-visible + .dropzone'));
    check(focusRule?.style.outlineStyle === 'solid' && focusRule.style.outlineWidth === '3px', 'file picker has a visible keyboard-focus outline');
    const hasReducedMotionRule = Array.from(app.styleSheets).some((sheet) =>
      Array.from(sheet.cssRules).some((rule) => rule.conditionText === '(prefers-reduced-motion: reduce)'));
    check(hasReducedMotionRule, 'reduced-motion styling is present');
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      check(parseFloat(view.getComputedStyle(app.querySelector('#dropzone')).transitionDuration) < 0.001, 'reduced-motion preference minimizes transitions');
    }

    if (view.innerWidth > 850) {
      const introBounds = app.querySelector('.intro').getBoundingClientRect();
      const converterBounds = app.querySelector('.converter').getBoundingClientRect();
      check(converterBounds.left >= introBounds.right - 1 && converterBounds.top <= introBounds.top + 24, 'desktop layout places converter beside the intro');
    }

    const dangerousName = '<img src=x onerror=alert(1)>.torrent';
    const files = new view.DataTransfer();
    files.items.add(new view.File([makeV1Torrent().bytes], dangerousName, { type: 'application/x-bittorrent' }));
    files.items.add(new view.File([utf8('not bencode')], 'broken.torrent', { type: 'application/x-bittorrent' }));
    let activeReads = 0;
    let maxConcurrentReads = 0;
    for (const file of files.files) {
      const read = file.arrayBuffer.bind(file);
      Object.defineProperty(file, 'arrayBuffer', { configurable: true, value: async () => {
        activeReads += 1;
        maxConcurrentReads = Math.max(maxConcurrentReads, activeReads);
        try {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return await read();
        } finally {
          activeReads -= 1;
        }
      } });
    }
    Object.defineProperty(input, 'files', { configurable: true, value: files.files });
    input.dispatchEvent(new view.Event('change', { bubbles: true }));

    await waitFor(() => app.querySelector('#status-message').textContent.startsWith('Converted 1 file;'));
    check(maxConcurrentReads === 1, 'files are read one at a time to limit peak memory');
    const rows = [...app.querySelectorAll('.result-row')];
    check(rows.length === 2, 'one output row is rendered per input file');
    check(rows[0].querySelector('.result-title').textContent === dangerousName, 'untrusted filename is rendered as plain text');
    check(rows[0].querySelector('img') === null, 'untrusted filename cannot inject HTML');
    check(rows[0].querySelector('.protocol-tag').textContent === 'v1', 'valid torrent shows its protocol');
    check(rows[1].querySelector('[role=alert]')?.textContent.length > 0, 'invalid torrent gets a visible error');

    rows[0].querySelector('.copy-button').click();
    await waitFor(() => Boolean(rows[0].querySelector('.copy-status').textContent));
    check(/copied|selected/i.test(rows[0].querySelector('.copy-status').textContent), 'copy action reports success or selects a fallback link');

    app.querySelector('#clear-results').click();
    check(app.querySelectorAll('.result-row').length === 0, 'clear removes all results');

    const modernFormats = new view.DataTransfer();
    modernFormats.items.add(new view.File([makeV2Torrent().bytes], 'v2.torrent', { type: 'application/x-bittorrent' }));
    modernFormats.items.add(new view.File([makeHybridTorrent().bytes], 'hybrid.torrent', { type: 'application/x-bittorrent' }));
    Object.defineProperty(input, 'files', { configurable: true, value: modernFormats.files });
    input.dispatchEvent(new view.Event('change', { bubbles: true }));
    await waitFor(() => app.querySelector('#status-message').textContent === 'Converted 2 files.');
    const modernRows = [...app.querySelectorAll('.result-row')];
    check(modernRows[0].querySelector('.protocol-tag').textContent === 'v2', 'browser computes a v2 magnet link');
    check(new URL(modernRows[0].querySelector('.magnet-output').value).searchParams.get('xt').startsWith('urn:btmh:1220'), 'v2 topic is in the browser-generated link');
    check(modernRows[1].querySelector('.protocol-tag').textContent === 'hybrid', 'browser accepts a hybrid torrent');
    check(new URL(modernRows[1].querySelector('.magnet-output').value).searchParams.getAll('xt').length === 2, 'hybrid link includes both exact topics');
    app.querySelector('#clear-results').click();

    const dropFiles = new view.DataTransfer();
    dropFiles.items.add(new view.File([makeV1Torrent().bytes], 'dropped.torrent', { type: 'application/x-bittorrent' }));
    const dragOver = new view.Event('dragover', { bubbles: true, cancelable: true });
    app.querySelector('#dropzone').dispatchEvent(dragOver);
    check(dragOver.defaultPrevented, 'drop zone accepts drag-over events');
    const drop = new view.Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: dropFiles });
    app.querySelector('#dropzone').dispatchEvent(drop);
    await waitFor(() => app.querySelector('#status-message').textContent === 'Converted 1 file.');
    check(app.querySelectorAll('.result-row').length === 1, 'drop converts the supplied torrent');
    app.querySelector('#clear-results').click();

    frame.style.width = '375px';
    await new Promise((resolve) => setTimeout(resolve, 100));
    check(app.documentElement.scrollWidth <= app.documentElement.clientWidth, 'no horizontal overflow at 375px');
    const mobileIntro = app.querySelector('.intro').getBoundingClientRect();
    const mobileConverter = app.querySelector('.converter').getBoundingClientRect();
    check(mobileConverter.top >= mobileIntro.bottom, 'mobile layout stacks the converter below the intro');
    frame.style.width = '100%';

    const resources = [
      ...performance.getEntriesByType('resource'),
      ...view.performance.getEntriesByType('resource'),
    ];
    const externalRequests = resources
      .filter((entry) => entry.name.startsWith('http') && new URL(entry.name).origin !== location.origin);
    check(externalRequests.length === 0, 'page made no external network requests');
    report.className = 'pass';
    report.textContent = lines.join('\n');
  } catch (error) {
    report.className = 'fail';
    report.textContent = `${lines.join('\n')}\nFAIL ${error.message}`;
  }
}

run();
