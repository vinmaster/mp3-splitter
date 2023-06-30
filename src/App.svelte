<script lang="ts">
  import Greet from './lib/Greet.svelte';
  import { invoke } from '@tauri-apps/api/tauri';
  import { listen } from '@tauri-apps/api/event';
  import { message, open } from '@tauri-apps/api/dialog';
  import { arch, platform, version } from '@tauri-apps/api/os';
  import { onMount, afterUpdate } from 'svelte';
  import { getDuration, splitFile } from './lib/runners';

  interface File {
    filename: string;
    folder: string;
    path: string;
    duration: number;
  }

  interface Settings {
    clipDuration: number;
    clipOverlap: number;
  }

  interface Log {
    timestamp: Date;
    text: string;
    file?: File;
  }

  let systemInfo = { arch: '', platform: '', version: '' };
  let showFileDrop = false;
  let files: File[] = [];
  let settings: Settings = {
    clipDuration: 60,
    clipOverlap: 10,
  };
  let outputPath: string;
  let logs: Log[] = [];
  let logContainer;

  listen('tauri://file-drop', async event => {
    showFileDrop = false;
    for (let path of event.payload as string[]) {
      await addFiles(path);
    }
  });
  listen('tauri://file-drop-hover', () => (showFileDrop = true));
  listen('tauri://file-drop-cancelled', () => (showFileDrop = false));

  onMount(() => mount());

  afterUpdate(() => {
    if (logs.length !== 0) scrollLogsToBottom(logContainer);
  });

  async function mount() {
    await setSystemInfo();
    log('Ready!');
  }

  function log(...args) {
    logs = [
      ...logs,
      { timestamp: new Date(), text: args[0], file: args.length > 1 ? args[1] : null },
    ];
    console.log(...args);
  }

  const scrollLogsToBottom = async node => {
    node.scroll({ top: node.scrollHeight, behavior: 'smooth' });
  };

  async function setSystemInfo() {
    systemInfo.arch = await arch();
    systemInfo.platform = await platform();
    switch (systemInfo.platform) {
      case 'darwin':
        systemInfo.platform = 'macOS';
        break;
      case 'win32':
        systemInfo.platform = 'Windows';
        break;
      default:
        break;
    }
    systemInfo.version = await version();
  }

  async function onAdd() {
    const selected = await open({
      multiple: true,
      filters: [{ name: 'Audio files', extensions: ['mp3'] }],
    });
    await addFiles(selected);
  }

  async function addFiles(paths: string[] | string) {
    if (Array.isArray(paths)) {
      // log('user selected multiple files');
      await addFiles(paths[0]);
      // paths.forEach(async path => {
      //   await addFiles(path);
      // });
    } else if (paths === null) {
      // log('user cancelled the selection');
    } else {
      let folder: string = await invoke('get_folder', { path: paths });
      let filename: string = await invoke('get_filename', { path: paths });
      try {
        let duration = await getDuration(paths);
        // Not handling multiple inputs yet
        // files = [...files, { filename, folder, path: paths, duration }];
        let file: File = { filename, folder, path: paths, duration };
        files = [file];
        outputPath = folder;
        log(`Added file`, file);
      } catch (error) {
        log(`Error: ${error.message}`);
      }
    }
  }

  async function onSplit() {
    if (files.length === 0) {
      // log('No file(s) to split');
      message('No file(s) to split');
      return;
    }
    log('Split start...');
    try {
      let outputFiles = await splitFile(files[0], settings);
      log('Split Finished!');
      outputFiles.forEach(file => {
        log(`File created`, file);
      });
    } catch (error) {
      log(`Error: ${error.message}`);
    }
  }

  function onReset() {
    files = [];
    logs = [];
    settings = {
      clipDuration: 60,
      clipOverlap: 10,
    };
    outputPath = undefined;
    log('Ready!');
  }
</script>

{#if showFileDrop}
  <div id="file-drop-container">
    <svg
      id="file-drop-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="50"
      height="43"
      viewBox="0 0 50 43"
      ><path
        d="M48.4 26.5c-.9 0-1.7.7-1.7 1.7v11.6h-43.3v-11.6c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v13.2c0 .9.7 1.7 1.7 1.7h46.7c.9 0 1.7-.7 1.7-1.7v-13.2c0-1-.7-1.7-1.7-1.7zm-24.5 6.1c.3.3.8.5 1.2.5.4 0 .9-.2 1.2-.5l10-11.6c.7-.7.7-1.7 0-2.4s-1.7-.7-2.4 0l-7.1 8.3v-25.3c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v25.3l-7.1-8.3c-.7-.7-1.7-.7-2.4 0s-.7 1.7 0 2.4l10 11.6z"
      /></svg
    >
    <span id="file-drop-text">Drop file(s) here</span>
  </div>
{/if}

<header style="height: 70px; positition: relative; margin-top: 16px;">
  <div style="display: flex; justify-content: center; align-items: center;">
    <img src="/icon.png" style="margin-right: 8px;" height="50" alt="Logo" />
    <h1>MP3 Splitter</h1>
  </div>
  <div style="position: absolute; top: 16px; right: 16px; font-size: 12px;">
    <div>Platform: {systemInfo.platform} ({systemInfo.arch})</div>
    <div>Version: 2.0.0</div>
  </div>
</header>
<main style="display: flex; margin: 0 16px; gap: 16px; height: calc(100vh - 146px)">
  <div style="display: flex; flex-direction: column; text-align: left; width: 100%;">
    <h2>Input</h2>
    <button on:click={onAdd} style="background-color: cadetblue; width: fit-content;"
      >Add File (Or drop file here)</button
    >
    <span style="font-size: 14px;">Path: {files.length === 0 ? 'undefined' : files.at(0).path}</span
    >
    <span style="font-size: 14px;"
      >Duration: {files.length === 0 ? 'undefined' : files.at(0).duration}</span
    >

    <h2>Settings</h2>
    <label for="clip-duration">Clip duration (minutes)</label>
    <input id="clip-duration" type="number" bind:value={settings.clipDuration} />
    <label for="clip-overlap">Clip overlap (seconds)</label>
    <input id="clip-overlap" type="number" bind:value={settings.clipOverlap} />
  </div>

  <div style="width: 100%; display: flex; flex-direction: column; padding-bottom: 16px;">
    <h2>Output</h2>
    <span style="font-size: 14px;">Path: {outputPath}</span>
    <div
      style="font-size: 12px; flex-grow: 1; padding: 8px; line-height: normal;"
      class="log-container"
      bind:this={logContainer}
    >
      {#each logs as log}
        <div style="overflow-wrap: anywhere; margin-bottom: 4px;">
          <span style="font-weight: bold; margin-right: 4px;"
            >[{log.timestamp.toLocaleTimeString('en-US')}]:</span
          >
          <span>{log.text}</span>
          {#if log.file}
            <span style="border: 1px solid orange; border-radius: 5px; padding: 1px 4px;"
              >{log.file.filename}</span
            >
          {/if}
        </div>
      {/each}
    </div>
    <!-- <Greet /> -->
  </div>
</main>
<footer style="display: flex; margin: 0 16px; gap: 16px;">
  <button on:click={onSplit} style="flex-grow: 1;"> Split! </button>
  <button on:click={onReset} style="flex-grow: 1; background-color:#EF5350;"> Reset </button>
</footer>

<style>
  #file-drop-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: #c8dadf;
    outline: 2px dashed #92b0b3;
    outline-offset: -20px;
    transition: outline-offset 0.15s ease-in-out, background-color 0.15s linear;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  #file-drop-icon {
    width: 100%;
    height: 80px;
    fill: #92b0b3;
    display: block;
  }

  #file-drop-text {
    margin-top: 16px;
    color: #0f0f0f;
  }
</style>
