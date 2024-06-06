<script setup lang="ts">
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { message, open } from '@tauri-apps/api/dialog';
import { arch, platform, version } from '@tauri-apps/api/os';
import { getDuration, getSplitRanges, splitFile } from './lib/runners';
import { nextTick, onMounted, reactive, ref } from 'vue';

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

let systemInfo = reactive({ arch: '', platform: '', version: '' });
let showFileDrop = ref(false);
let files = ref<File[]>([]);
let settings = reactive<Settings>({
  clipDuration: 60,
  clipOverlap: 10,
});
let outputPath = ref('');
let logs = ref<Log[]>([]);
let isDisabled = ref(false);
// Dom element
let logContainer = ref();

listen('tauri://file-drop', async event => {
  showFileDrop.value = false;
  for (let path of event.payload as string[]) {
    await addFiles(path);
  }
});
listen('tauri://file-drop-hover', () => (showFileDrop.value = true));
listen('tauri://file-drop-cancelled', () => (showFileDrop.value = false));

onMounted(async () => {
  await setSystemInfo();
  log('Ready!');
});

function log(msg: string, file?: File) {
  logs.value = [
    ...logs.value,
    { timestamp: new Date(), text: msg, file: file ?? undefined },
  ];
  // console.log(msg);
  scrollLogsToBottom(logContainer.value);
}

function humanizeTime(seconds: number) {
  return new Date(1000 * seconds).toISOString().substring(11, 19);
}

const scrollLogsToBottom = async (node: HTMLElement) => {
  await nextTick();
  setTimeout(() => {
    (node.lastElementChild as HTMLElement).scrollIntoView({ behavior: 'smooth' });
  }, 100);
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
      log('Sorry, system not supported');
      message('Sorry, system not supported');
      isDisabled.value = true;
      break;
  }
  systemInfo.version = await version();
}

async function onAdd() {
  const selected = await open({
    multiple: true,
    filters: [{ name: 'Audio files', extensions: ['mp3'] }],
  });
  if (!selected) {
    log('No files selected');
    return;
  }
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
      // TODO: Not handling multiple inputs yet
      // files = [...files, { filename, folder, path: paths, duration }];
      let file: File = { filename, folder, path: paths, duration };
      files.value = [file];
      outputPath.value = folder;
      log(`Added file`, file);
    } catch (error: any) {
      console.error(error);
      log(`Error: ${error.message}`);
      message(`Error: ${error.message}`);
    }
  }
}

async function onSplit() {
  if (files.value.length === 0) {
    log('No file(s) to split');
    return;
  }
  if (settings.clipDuration <= 0) {
    message(`Duration cannot be ${settings.clipDuration}`);
    return;
  }
  if (settings.clipOverlap < 0) {
    message(`Overlap cannot be ${settings.clipOverlap}`);
    return;
  }

  log('Split start...');
  try {
    let outputFiles = await splitFile(files.value[0], settings);
    if (!outputFiles) {
      log('Error occurred');
      return;
    } else {
      log('Split Finished!');
    }
    outputFiles.forEach(file => {
      log(`File created`, file);
    });
  } catch (error: any) {
    console.error(error);
    log(`Error: ${error.message}`);
    message(`Error: ${error.message}`);
  }
}

function onReset() {
  files.value = [];
  logs.value = [];
  Object.assign(settings, {
    clipDuration: 60,
    clipOverlap: 10,
  });
  outputPath.value = '';
  log('Ready!');
}
</script>

<template>
  <div id="file-drop-container" v-if="showFileDrop">
    <svg id="file-drop-icon" xmlns="http://www.w3.org/2000/svg" width="50" height="43" viewBox="0 0 50 43">
      <path
        d="M48.4 26.5c-.9 0-1.7.7-1.7 1.7v11.6h-43.3v-11.6c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v13.2c0 .9.7 1.7 1.7 1.7h46.7c.9 0 1.7-.7 1.7-1.7v-13.2c0-1-.7-1.7-1.7-1.7zm-24.5 6.1c.3.3.8.5 1.2.5.4 0 .9-.2 1.2-.5l10-11.6c.7-.7.7-1.7 0-2.4s-1.7-.7-2.4 0l-7.1 8.3v-25.3c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v25.3l-7.1-8.3c-.7-.7-1.7-.7-2.4 0s-.7 1.7 0 2.4l10 11.6z" />
    </svg>
    <span id="file-drop-text">Drop file(s) here</span>
  </div>

  <header style="height: 70px; position: relative; margin-top: 16px;">
    <div style="display: flex; justify-content: center; align-items: center;">
      <img src="/icon.png" style="margin-right: 8px;" height="50" alt="Logo" />
      <h1>MP3 Splitter</h1>
    </div>
    <div style="position: absolute; top: 16px; right: 16px; font-size: 12px;">
      <div>Platform: {{ systemInfo.platform }} ({{ systemInfo.arch }})</div>
      <div>Version: 2.0.0</div>
    </div>
  </header>
  <main style="display: flex; margin: 0 16px; gap: 16px; height: calc(100vh - 146px)">
    <div style="display: flex; flex-direction: column; gap: 4px; text-align: left; width: 100%;">
      <div style="display: flex; align-items: center; gap: 4px;">
        <h2>Input</h2>
        <button @click="onAdd" style="background-color: #2dd4bf; font-size: 12px;">Add File (Or drop file)</button>
      </div>

      <div style="display: flex; flex-direction: column;">
        <span style="font-size: 14px;">Path:
          <span v-if="files.length !== 0">{{ files[0].folder }}/
            <span class="file" style="margin-left: 0px;">{{ files[0].filename }}</span>
          </span>
        </span>
        <span style="font-size: 14px;">Duration: {{ files.length === 0 ? '' : humanizeTime(files[0].duration)
          }}</span>
      </div>

      <h2 style="margin-bottom: 0px;">Settings</h2>
      <label for="clip-duration">Clip duration (minutes)</label>
      <input id="clip-duration" type="number" v-model="settings.clipDuration" />
      <label for="clip-overlap">Clip overlap (seconds)</label>
      <input id="clip-overlap" type="number" v-model="settings.clipOverlap" />
    </div>

    <div style="width: 100%; display: flex; flex-direction: column; padding-bottom: 16px;">
      <div style="display: flex; align-items: center;">
        <h2>Output</h2>
        <label style="margin-left: 5px;" v-if="files.length !== 0">({{ getSplitRanges(files[0].duration,
    settings)?.length }} file<span v-if="getSplitRanges(files[0].duration,
    settings)?.length !== 1">s</span> will be created)</label>
      </div>
      <span style="font-size: 14px;">Path: {{ outputPath }}</span>
      <div style="font-size: 12px; flex-grow: 1; padding: 8px; line-height: 1.5;" class="log-container"
        ref="logContainer">
        <div style="overflow-wrap: anywhere; margin-bottom: 4px;" v-for="log in logs">
          <span style="font-weight: bold; margin-right: 4px;">[{{ log.timestamp.toLocaleTimeString('en-US') }}]:</span>
          <span>{{ log.text }}</span>
          <span v-if="log.file">&nbsp;</span>
          <span v-if="log.file" class="file">{{
    log.file.filename }}</span>
        </div>
      </div>
      <!-- <Greet /> -->
    </div>
  </main>
  <footer style="display: flex; margin: 0 16px; gap: 16px;">
    <button @click="onSplit" style="flex-grow: 1;" :disabled="isDisabled || files.length === 0"> Split! </button>
    <button @click="onReset" style="flex-grow: 1; background-color:#f87171;"> Reset </button>
  </footer>
</template>

<style scoped>
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
