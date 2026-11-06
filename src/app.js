import { formatBytes, processTorrentFiles } from './process.js';

const fileInput = document.querySelector('#file-input');
const dropzone = document.querySelector('#dropzone');
const results = document.querySelector('#results');
const statusMessage = document.querySelector('#status-message');
const clearButton = document.querySelector('#clear-results');
const fileCount = document.querySelector('#file-count');
const conversionProgress = document.querySelector('#conversion-progress');
const batchActions = document.querySelector('#batch-actions');
const linksReady = document.querySelector('#links-ready');
const copyAllButton = document.querySelector('#copy-all');
const downloadLinksButton = document.querySelector('#download-links');
let isWorking = false;
let nextId = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function magnetLinks() {
  return Array.from(results.querySelectorAll('.magnet-output'), (field) => field.value);
}

function updateResultControls() {
  const count = results.childElementCount;
  const links = magnetLinks();
  fileCount.textContent = `${count} ${count === 1 ? 'file' : 'files'}`;
  clearButton.disabled = count === 0;
  batchActions.hidden = links.length === 0;
  linksReady.textContent = `${links.length} ${links.length === 1 ? 'link' : 'links'} ready`;
}

function resetConversionProgress() {
  conversionProgress.hidden = true;
  conversionProgress.max = 1;
  conversionProgress.value = 0;
  conversionProgress.setAttribute('aria-valuetext', 'No files converted');
}

function addRemoveButton(row, name) {
  const removeButton = element('button', 'remove-button', 'Remove');
  removeButton.type = 'button';
  removeButton.setAttribute('aria-label', `Remove ${name}`);
  removeButton.addEventListener('click', () => {
    row.remove();
    updateResultControls();
    if (results.childElementCount === 0) resetConversionProgress();
    statusMessage.textContent = results.childElementCount ? `Removed ${name}.` : 'Results cleared. Ready when you are.';
  });
  return removeButton;
}

function renderResult(item) {
  const row = element('article', 'result-row');
  const heading = element('div', 'result-heading');
  const title = element('h3', 'result-title', item.name);
  const titleId = `file-${++nextId}`;
  title.id = titleId;
  row.setAttribute('aria-labelledby', titleId);
  heading.append(title);

  if (item.error) {
    const error = element('p', 'error-message', item.error);
    error.setAttribute('role', 'alert');
    const header = element('div', 'result-header');
    header.append(heading, addRemoveButton(row, item.name));
    row.append(header, error);
    return row;
  }

  const { result } = item;
  const summary = element('p', 'result-meta', `${formatBytes(result.size)} · Content size`);
  heading.append(summary);
  const protocol = element('span', 'protocol-tag', result.protocol);
  const header = element('div', 'result-header');
  const headerActions = element('div', 'result-header-actions');
  headerActions.append(protocol, addRemoveButton(row, item.name));
  header.append(heading, headerActions);

  const label = element('label', 'magnet-field-label', 'Magnet link');
  const output = element('textarea', 'magnet-output');
  output.readOnly = true;
  output.value = result.uri;
  const outputId = `magnet-${nextId}`;
  output.id = outputId;
  label.htmlFor = outputId;

  const actions = element('div', 'result-actions');
  const copyButton = element('button', 'copy-button', 'Copy link');
  copyButton.type = 'button';
  const copyStatus = element('p', 'copy-status');
  copyStatus.setAttribute('role', 'status');
  copyStatus.setAttribute('aria-live', 'polite');
  copyButton.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(result.uri);
      copyButton.textContent = 'Copied';
      copyStatus.textContent = 'Magnet link copied.';
      window.setTimeout(() => { copyButton.textContent = 'Copy link'; }, 1800);
    } catch {
      output.focus();
      output.select();
      copyStatus.textContent = 'Link selected. Press Ctrl+C or use Copy from your device menu.';
    }
  });
  actions.append(copyButton, copyStatus);
  row.append(header, label, output, actions);
  return row;
}

async function addFiles(fileList) {
  const files = Array.from(fileList ?? []);
  if (!files.length) return;
  if (isWorking) {
    statusMessage.textContent = 'Please wait for the current files to finish.';
    return;
  }

  isWorking = true;
  fileInput.disabled = true;
  dropzone.classList.add('is-working');
  conversionProgress.max = files.length;
  conversionProgress.value = 0;
  conversionProgress.setAttribute('aria-valuetext', `0 of ${files.length} files converted`);
  conversionProgress.hidden = false;
  statusMessage.textContent = `Reading ${files.length} ${files.length === 1 ? 'file' : 'files'}…`;
  const completed = [];
  for (const [index, file] of files.entries()) {
    statusMessage.textContent = `Converting file ${index + 1} of ${files.length}: ${file.name}`;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const [item] = await processTorrentFiles([{ name: file.name, bytes }]);
      completed.push(item);
    } catch {
      completed.push({ name: file.name, error: 'This file could not be read. Try selecting it again.' });
    }
    conversionProgress.value = index + 1;
    conversionProgress.setAttribute('aria-valuetext', `${index + 1} of ${files.length} files converted`);
  }
  for (const item of completed) results.append(renderResult(item));

  const successes = completed.filter((item) => item.result).length;
  const failures = completed.length - successes;
  statusMessage.textContent = failures
    ? `Converted ${successes} ${successes === 1 ? 'file' : 'files'}; ${failures} ${failures === 1 ? 'file needs' : 'files need'} attention.`
    : `Converted ${successes} ${successes === 1 ? 'file' : 'files'}.`;
  updateResultControls();
  fileInput.disabled = false;
  dropzone.classList.remove('is-working');
  isWorking = false;
}

fileInput.addEventListener('change', async () => {
  await addFiles(fileInput.files);
  fileInput.value = '';
});

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('is-dragging');
});
dropzone.addEventListener('dragleave', (event) => {
  if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('is-dragging');
});
dropzone.addEventListener('drop', async (event) => {
  event.preventDefault();
  dropzone.classList.remove('is-dragging');
  await addFiles(event.dataTransfer?.files);
});

clearButton.addEventListener('click', () => {
  results.replaceChildren();
  resetConversionProgress();
  statusMessage.textContent = 'Results cleared. Ready when you are.';
  updateResultControls();
});

copyAllButton.addEventListener('click', async () => {
  const links = magnetLinks();
  if (!links.length) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(links.join('\n'));
    copyAllButton.textContent = 'Copied';
    statusMessage.textContent = `Copied ${links.length} magnet ${links.length === 1 ? 'link' : 'links'}.`;
    window.setTimeout(() => { copyAllButton.textContent = 'Copy all links'; }, 1800);
  } catch {
    statusMessage.textContent = 'Clipboard access is unavailable. Copy links individually from their result cards.';
  }
});

downloadLinksButton.addEventListener('click', () => {
  const links = magnetLinks();
  if (!links.length) return;
  const blob = new Blob([`${links.join('\n')}\n`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const download = element('a');
  download.href = url;
  download.download = 'magnet-links.txt';
  document.body.append(download);
  download.click();
  download.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  statusMessage.textContent = `Downloaded ${links.length} magnet ${links.length === 1 ? 'link' : 'links'} as TXT.`;
});
