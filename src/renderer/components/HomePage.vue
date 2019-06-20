<template>
  <main>
    <div class="top">
      <div class="title"><img id="logo" src="~@/assets/note.png" alt="logo"><span class="title-text">MP3 Splitter</span></div>
      <div class="info">
        <div>Platform: {{ platform }}</div>
        <div>Version: {{ version }}</div>
      </div>
    </div>
    <div class="middle">
      <div class="left">
        <div class="input-container">
          <div>
            <div class="smaller-title">Input</div>
            <div class="input-btn-container">
              <a @click="addFile()" class="blue btn" id="add-btn">Add File</a>
              <a @click="openFile(inputFilePath)" class="blue btn" :class="{ disabled: !inputFilePath }" id="open-btn">Open File</a>
            </div>
            <div>Path: {{ inputFilePath }}</div>
            <div>Duration: {{ humanTime(inputFileDuration) }}</div>
          </div>
        </div>
        <div class="output-container">
          <div class="smaller-title">Output</div>
          <div>Path: {{ outputPath }}</div>
          <div>Files: </div>
          <div class="output-files">
            <div v-for="file in outputFilesPath">
              {{ file }}
            </div>
          </div>
        </div>
      </div>
      <div class="right">
        <label class="">Clip duration (minutes)<input v-model="clipDuration" type="text" :disabled="disabled" /></label>
        <label class="">Clip overlap (seconds)<input v-model="overlap" :disabled="disabled" type="text" /></label>
        <label class="">Log</label>
        <div class="log-container">
          <div class="log" v-for="log in logs">
            <span v-if="log.level === 'info'">[{{ log.time }}]: {{ log.message }}</span>
            <span v-if="log.level === 'error'" class="error">[{{ log.time }}]: {{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="bottom">
      <a @click="split()"
        :class="{
          green: !disabled,
          disabled: disabled,
        }" class="btn">Split!</a>
      <a @click="reset()" class="red btn">Reset</a>
    </div>
  </main>
</template>

<script>
import util from 'util';
import path from 'path';
import os from 'os';
import { ipcRenderer, shell, remote } from 'electron'; // eslint-disable-line import/no-extraneous-dependencies
import { exec, execSync } from 'child_process';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
const execPromise = util.promisify(exec); // eslint-disable-line

export default {
  name: 'home-page',
  mounted() {
    ipcRenderer.on('selected-directory', (event, path) => {
      this.directories = this.directories.concat(path);
    });
    this.addLog('Ready');
    this.outputPath = path.join(os.homedir(), 'Desktop');

    // remote.dialog.showMessageBox({
    //   message: `Error: ${err.message}`,
    // });
  },
  methods: {
    addLog(message, level = 'info') {
      this.logs.push({
        time: new Date().toLocaleTimeString('en-US'),
        message,
        level,
      });
      this.$nextTick(() => {
        const container = this.$el.querySelector('.log-container');
        container.scrollTop = container.scrollHeight;
      });
    },
    getPlatform() {
      const type = os.type().toLowerCase();
      const arch = os.arch().toLowerCase();
      if (type === 'darwin') {
        return 'osx-64';
      // } else if (type === 'windows_nt') {
      }
      return arch === 'x64' ? 'windows-64' : 'windows-32';
    },
    humanTime(seconds) {
      try {
        return new Date(1000 * seconds).toISOString().substr(11, 8);
      } catch (err) {
        console.error(err); // eslint-disable-line no-console
        this.addLog(err.message, 'error');
        return 'Error';
      }
    },
    addFile() {
      const files = remote.dialog.showOpenDialog({
        // properties: ['openFile', 'multiSelections'],
        properties: ['openFile'],
      });
      if (!files) return;
      this.disabled = false;
      files.forEach((file) => {
        this.inputFilePath = file;
        this.inputFileDuration = this.getDuration(file);
        this.addLog(`Added file: ${file}`);
      });
    },
    reset() {
      this.logs = [];
      this.inputFilePath = null;
      this.inputFileDuration = null;
      this.outputPath = path.join(os.homedir(), 'Desktop');
      this.outputFilesPath = [];
      this.clipDuration = 60;
      this.overlap = 10;
      this.disabled = true;
      this.addLog('Ready');
    },
    openFile(file) {
      if (!file) {
        this.addLog('No file selected', 'error');
        return;
      }
      shell.openItem(file);
    },
    runCommand(program, options, sync = true) {
      // Run command blocking execution
      if (sync) {
        const result = execSync(`${program} ${options}`);
        return result.toString();
      }
      // Return a promise
      return execPromise(`${program} ${options}`);
    },
    getDuration(file) {
      try {
        const program = ffprobe.path.replace('app.asar', 'app.asar.unpacked');
        const options = '-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1';
        const stdout = this.runCommand(program, `"${file}" ${options}`);
        const duration = parseFloat(stdout.trim());
        return duration;
      } catch (err) {
        console.error(err); // eslint-disable-line no-console
        this.addLog(err.message, 'error');
        return 0;
      }
    },
    async split() {
      this.addLog('Split starting...');
      this.disabled = true;
      try {
        // eslint-disable-next-line
        const name = path.basename(this.inputFilePath, path.extname(this.inputFilePath));
        const ext = path.extname(this.inputFilePath);
        const step = this.clipDuration * 60;
        const { overlap } = this;
        const times = Math.ceil(this.inputFileDuration / step);
        let startTime = 0;
        let endTime = step;
        const promises = [];
        for (let part = 0; part < times; part += 1) {
          const partName = `${name}-${(part + 1).toString().padStart(2, '0')}`;
          const fileOutput = `${partName}${ext}`;

          endTime += overlap;
          if (endTime > this.inputFileDuration) {
            endTime = this.inputFileDuration;
          }
          const program = ffmpeg.path.replace('app.asar', 'app.asar.unpacked');
          const output = `${this.outputPath}/${fileOutput}`;
          // eslint-disable-next-line
          const options = `-y -i "${this.inputFilePath}" -ss ${startTime} -to ${endTime} -c copy "${output}"`
          const promise = this.runCommand(program, options, false);
          // eslint-disable-next-line
          const prepFunc = (startTime, endTime, output) => {
            const func = () => {
              this.addLog(`Splitted file ${this.humanTime(startTime)} - ${this.humanTime(endTime)} to ${fileOutput.replace(/\\ /g, ' ')}`);
              this.outputFilesPath.push(output.replace(/\\ /g, ' '));
            };
            return func;
          };
          const func = prepFunc(startTime, endTime, output);

          promise.then(func).catch(err => this.addLog(err.message, 'error'));
          promises.push(promise);
          endTime -= overlap;
          startTime += step;
          endTime += step;
        }
        Promise.all(promises).then(() => this.addLog('Split finished!'));
      } catch (err) {
        console.error(err); // eslint-disable-line no-console
        this.addLog(err.message, 'error');
      }
    },
  },
  computed: {
  },
  watch: {
    outputFilesPath() {
      this.$nextTick(() => {
        const container = this.$el.querySelector('.output-files');
        container.scrollTop = container.scrollHeight;
      });
    },
  },
  data() {
    return {
      platform: this.getPlatform(),
      version: '1.1.1',
      logs: [],
      inputFilePath: null,
      inputFileDuration: null,
      outputPath: null,
      outputFilesPath: [],
      clipDuration: 60,
      overlap: 10,
      disabled: true,
    };
  },
};
</script>

<style>
@import url('https://fonts.googleapis.com/css?family=Source+Sans+Pro');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #app, main {
  height: 100%;
  width: 100%;
  margin: 0px;
  padding: 0px;
}

body { font-family: 'Source Sans Pro', sans-serif; }

input[type=text] {
  width: 100%;
  background: #fff;
  box-shadow: 0 6px 10px 0 rgba(0, 0, 0, 0.1);
  border: 0;
  outline: 0;
  padding: 15px 10px;
  font-size: 16px;
}

li {
  list-style: none;
}

main {
  /* background: rgba(229, 229, 229, .3); */
  background: #E0F2F1;
  height: 100%;
  padding: 20px;
  width: 100%;
  display: flex;
  flex-direction: column;
}

#logo {
  vertical-align: middle;
  width: 50px;
}

.title-text {
  vertical-align: middle;
}

.middle {
  display: flex;
  flex-grow: 1;
  margin-top: 20px;
  margin-bottom: 20px;
}

.bottom {
  display: flex;
}

.bottom > * {
  width: 100%;
  text-align: center;
}

.bottom > :not(:last-child) {
  margin-right: 20px;
}

.bottom > :not(:first-child):not(:last-child) {
  margin-right: 20px;
  margin-left: 20px;
}

.title {
  text-align: center;
  color: #2c3e50;
  font-size: 36px;
  font-weight: bold;
}

.info {
  position: absolute;
  top: 20px;
  right: 20px;
}

.left {
  display: flex;
  flex-direction: column;
  flex: 0 0 50%;
  padding-right: 10px;
}

.right {
  display: flex;
  flex-direction: column;
  flex: 0 0 50%;
  padding-left: 10px;
}

.right input {
  margin-bottom: 20px;
}

.log-container {
  padding: 5px;
  border: 1px solid grey;
  flex-grow: 1;
  height: 180px;
  overflow-y: auto;
}

.error {
  color: red;
}

.input-container {
  position: relative;
  margin-bottom: 20px;
}

.input-btn-container {
  display: flex;
  justify-content: space-between;
}

.output-container {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.smaller-title {
  font-size: 24px;
  margin-bottom: 5px;
  text-decoration: underline;
  /* box-shadow: 0 5px 5px rgba(0, 0, 0, 0.125); */
  /* background: #fff8c4; */
  /* border: 1px solid #f2c779; */
}

#add-btn {
  width: 48%;
}

#open-btn {
  width: 48%;
}

.output-files {
  padding: 5px;
  overflow-y: auto;
  flex-grow: 1;
  border: 1px solid grey;
}

.close {
  position: absolute;
  right: 5px;
  top: 11px;
  width: 20px;
  height: 20px;
  opacity: 0.3;
}
.close:hover {
  opacity: 1;
}
.close:before, .close:after {
  position: absolute;
  left: 10px;
  content: ' ';
  height: 20px;
  width: 2px;
  background-color: red;
}
.close:before {
  transform: rotate(45deg);
}
.close:after {
  transform: rotate(-45deg);
}

.title.alt {
  font-size: 16px;
}

.btn {
  cursor: pointer;
  padding: 10px;
  outline: none;
  display: inline-block;
  box-sizing: border-box;
  transition: all 0.15s ease;
  user-select: none;
}

.blue.btn {
  color: #fff;
  background-color: #3F51B5;
  border: 1px solid #3F51B5;
}

.green.btn {
  color: #fff;
  background-color: #4fc08d;
  border: 1px solid #4fc08d;
}

.red.btn {
  color: #fff;
  background-color: #8b0000;
  border: 1px solid #8b0000;
}

.disabled.btn {
  color: #fff;
  background-color: grey;
  border: 1px solid grey;
  pointer-events: none;
}

.green-btn.alt {
  color: #42b983;
  background-color: transparent;
}

.blue-btn {
  cursor: pointer;
  padding: 10px;
  outline: none;
  display: inline-block;
  border: 1px solid #2196f3;
  box-sizing: border-box;
  color: #2196f3;
  user-select: none;
  transition: all 0.15s ease;
}
.blue-btn.active {
  color: white;
  background-color: #2196f3;
}

::-webkit-scrollbar {
  -webkit-appearance: none;
  width: 7px;
  height: 7px;
}
::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background-color: rgba(0,0,0,.5);
  -webkit-box-shadow: 0 0 1px rgba(255,255,255,.5);
  overflow: auto;
}

</style>
