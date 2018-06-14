<template>
  <div id="container">
    <div class="header text-align-center">MP3 Splitter {{ platform }}</div>
    <div v-show="errors.length > 0" class="errors text-align-center">
      <div v-for="error in errors">{{ error }}</div>
    </div>
    <main>
      <div style="display: flex; flex-direction: column; justify-content: space-between;" class="height100 width100">
        <div class="flex justify-content-space-between width100">

          <div class="flex flex-basis-50 flex-direction-column padding-20 height100">
            <div class="margin-bottom-20">Files: {{ filesCount }} total</div>
            <a @click="addFiles()" v-bind:class="buttonStyles" class="btn margin-bottom-20">Add Files</a>
            <div v-for="file in files" class="flex position-relative">
              <div @click="removeFile(file.path)" class="close"></div>
              <div @click="openFile(file.path)" class="blue-btn width100">{{ file.path }} - {{ humanTime(file.duration) }}</div>
            </div>
          </div>
          <div class="flex flex-basis-50 flex-direction-column padding-20 height100">
            <label class="margin-bottom-20">Clip duration (minutes)<input v-model="clipDuration" type="text" :disabled="disabled" /></label>
            <label class="margin-bottom-20">Time overlap (seconds)<input v-model="overlap" :disabled="disabled" type="text" /></label>
            <label class="margin-bottom-20">Output</label>
            <div v-show="outputs.length === 0">None</div>
            <div v-show="outputs.length !== 0">
              <div v-for="output in outputs">
                {{ output }}
              </div>
            </div>
          </div>

        </div>
        <div id="bottom" class="flex justify-content-space-between width100">
          <a @click="split()" v-bind:class="buttonStyles" class="btn text-align-center width50">Split!</a>
          <a @click="clearOutput()" class="red btn text-align-center width50">Clear Output/Reset</a>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ipcRenderer, shell, remote } from 'electron'; // eslint-disable-line import/no-extraneous-dependencies
import { spawnSync } from 'child_process';
import ffbinaries from 'ffbinaries';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
// import fs from 'fs';
import path from 'path';

export default {
  name: 'home-page',
  mounted() {
    ipcRenderer.on('selected-directory', (event, path) => {
      this.directories = this.directories.concat(path);
    });
    // const testFiles = [{
    //   path: '/Users/tytuser/Documents/test.mp3',
    //   duration: this.getDuration('/Users/tytuser/Documents/test.mp3'),
    // }];
    // this.files = testFiles;
  },
  methods: {
    humanTime(seconds) {
      return new Date(1000 * seconds).toISOString().substr(11, 8);
    },
    // addDirectory() {
    //   ipcRenderer.send('open-file-dialog');
    // },
    addFiles() {
      const files = remote.dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
      });
      if (!files) return;
      files.forEach((file) => {
        if (!this.files.includes(file)) {
          this.files.push({
            path: file,
            duration: this.getDuration(file),
          });
        }
      });
    },
    removeFile(file) {
      this.files = this.files.filter(f => f.path !== file);
    },
    getDuration(file) {
      try {
        // const ffprobe = `${__static}/ffprobe-${this.platform}`;
        // const result = spawnSync('ls', [ffprobe]);
        const program = ffprobe.path.replace('app.asar', 'app.asar.unpacked');
        const options = [...'-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1'.split(' '), ...[file]];
        const stdout = this.runCommand(program, options);
        const duration = parseFloat(stdout.trim());
        return duration;
      } catch (err) {
        console.log(err); // eslint-disable-line
        // this.errors.push(err.message);
        remote.dialog.showMessageBox({
          message: `Error: ${err.message}`,
        });
        return 'Error';
      }
    },
    clearOutput() {
      this.outputs = [];
      this.disabled = false;
    },
    runCommand(program, options) {
      // const result = spawnSync('ls', [file]);
      // const stdout = result.stdout.toString();
      // return stdout;
      const result = spawnSync(program, options);
      const stdout = result.stdout.toString();
      return stdout;
    },
    openFile(file) {
      shell.openItem(file);
    },
    async split() {
      this.disabled = true;
      this.files.map((file) => {
        const name = path.basename(file.path, path.extname(file.path));
        const ext = path.extname(file.path);
        const step = this.clipDuration * 60;
        const overlap = this.overlap;
        const times = Math.ceil(file.duration / step);
        let startTime = 0;
        let endTime = step;
        for (let part = 0; part < times; part += 1) {
          const partName = `${name}-${(part + 1).toString().padStart(2, '0')}`;
          const fileOutput = `${partName}${ext}`;

          endTime += overlap;
          if (endTime > file.duration) {
            endTime = file.duration;
          }
          this.outputs.push(`Splitting ${this.humanTime(startTime)} - ${this.humanTime(endTime)} ${fileOutput}`);
          const program = ffmpeg.path.replace('app.asar', 'app.asar.unpacked');
          // eslint-disable-next-line
          const options = `-y -i ${file.path} -ss ${startTime} -to ${endTime} -c copy ${fileOutput}`.split(' ');
          this.runCommand(program, options);
          endTime -= overlap;
          startTime += step;
          endTime += step;
        }
        return file;
      });
    },
  },
  computed: {
    filesCount() {
      return this.files.length;
    },
    buttonStyles() {
      return {
        green: !this.disabled,
        disabled: this.disabled,
      };
    },
  },
  watch: {
  },
  data() {
    return {
      platform: ffbinaries.detectPlatform(),
      errors: [],
      files: [],
      outputs: [],
      clipDuration: 60,
      overlap: 10,
      disabled: false,
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

main {
  display: flex;
}

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

.flex {
  display: flex
}

.justify-content-space-between {
  justify-content: space-between;
}

.flex-basis-50 {
  flex-basis: 50%;
}

.flex-grow {
  flex-grow: 1;
}

.text-align-center {
  text-align: center;
}

.flex-direction-column {
  flex-direction: column;
}

.padding-20 {
  padding: 20px;
}

.margin-bottom-20 {
  margin-bottom: 20px;
}

.height100 {
  height: 100%;
}

.width100 {
  width: 100%;
}

.width50 {
  width: 50%;
}

.position-relative {
  position: relative;
}

#case-sensitive {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 12px;
  line-height: 20px;
}

#case-sensitive > input {
  font-size: x-large;
}

#container {
  background: rgba(229, 229, 229, .3);
  height: 100%;
  padding: 20px;
  width: 100%;
  display: flex;
  flex-direction: column;
}

#bottom > a {
  margin: 5px;
}

.header {
  color: #2c3e50;
  font-size: 24px;
  font-weight: bold;
}

.title {
  color: #2c3e50;
  font-size: 20px;
  font-weight: bold;
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

.errors {
  position: absolute;
  top: 0;
  right: 0;
  margin: 20px;
  padding: 10px;
  font-size: 14px;
  box-shadow: 0 5px 5px rgba(0, 0, 0, 0.125);
  background: #fff8c4;
  border: 1px solid #f2c779;
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
