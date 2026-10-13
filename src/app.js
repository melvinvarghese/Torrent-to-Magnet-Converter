import { formatBytes, processTorrentFiles } from './process.js';

const fileInput = document.querySelector('#file-input');
const dropzone = document.querySelector('#dropzone');
const results = document.querySelector('#results');
const statusMessage = document.querySelector('#status-message');
const clearButton = document.querySelector('#clear-results');
let isWorking = false;
let nextId = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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
    row.append(heading, error);
    return row;
  }

  const { result } = item;
  const summary = element('p', 'result-meta', `Content size ${formatBytes(result.size)}`);
  heading.append(summary);
  const protocol = element('span', 'protocol-tag', result.protocol);
  const header = element('div', 'result-header');
  header.append(heading, protocol);

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
      copyStatus.textContent = 'Magnet link copied.';
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
  statusMessage.textContent = `Reading ${files.length} ${files.length === 1 ? 'file' : 'files'}…`;
  const completed = [];
  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const [item] = await processTorrentFiles([{ name: file.name, bytes }]);
      completed.push(item);
    } catch {
      completed.push({ name: file.name, error: 'This file could not be read. Try selecting it again.' });
    }
  }
  for (const item of completed) results.append(renderResult(item));

  const successes = completed.filter((item) => item.result).length;
  const failures = completed.length - successes;
  statusMessage.textContent = failures
    ? `Converted ${successes} ${successes === 1 ? 'file' : 'files'}; ${failures} ${failures === 1 ? 'file needs' : 'files need'} attention.`
    : `Converted ${successes} ${successes === 1 ? 'file' : 'files'}.`;
  clearButton.disabled = results.childElementCount === 0;
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
  clearButton.disabled = true;
  statusMessage.textContent = 'Results cleared. Ready when you are.';
});
